/* ===== S11.12: 定时备份引擎 =====
 * 自动创建版本快照 + 加密导出备份包
 * 备份策略存储于 IDB app_meta（key: 'backup_config'）
 * 备份记录存储于 IDB app_meta（key: 'backup_history'）
 */

import { dbGet, dbPut } from './idb';
import { createSnapshot } from './dataVersionEngine';
import { encryptData } from './cryptoExport';
import { saveAs } from 'file-saver';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';

// ===== 类型定义 =====

export type BackupFrequency = 'manual' | 'daily' | 'weekly' | 'monthly';

export interface BackupConfig {
  enabled: boolean;
  frequency: BackupFrequency;
  /** 上次备份时间 */
  lastBackupAt: string | null;
  /** 备份保留份数（超出自动删除） */
  maxRetention: number;
  /** 是否加密备份 */
  encrypted: boolean;
  /** 加密密码（明文，仅本地使用） */
  password?: string;
  /** 是否自动下载备份文件 */
  autoDownload: boolean;
}

export interface BackupRecord {
  id: string;
  createdAt: string;
  type: BackupFrequency;
  /** 数据条数 */
  recordCount: number;
  /** 文件大小（字节） */
  fileSize: number;
  /** 版本快照 ID */
  snapshotId?: string;
  /** 是否加密 */
  encrypted: boolean;
  /** 状态 */
  status: 'success' | 'failed';
  /** 错误信息 */
  error?: string;
}

// ===== 默认配置 =====

export const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  enabled: false,
  frequency: 'weekly',
  lastBackupAt: null,
  maxRetention: 10,
  encrypted: false,
  autoDownload: false,
};

// ===== 存储 =====

const CONFIG_KEY = 'backup_config';
const HISTORY_KEY = 'backup_history';

async function loadConfig(): Promise<BackupConfig> {
  const result = await dbGet<{ key: string; value: BackupConfig }>('app_meta', CONFIG_KEY);
  return result?.value || { ...DEFAULT_BACKUP_CONFIG };
}

async function saveConfig(config: BackupConfig): Promise<void> {
  await dbPut('app_meta', { key: CONFIG_KEY, value: config });
}

async function loadHistory(): Promise<BackupRecord[]> {
  const result = await dbGet<{ key: string; value: BackupRecord[] }>('app_meta', HISTORY_KEY);
  return result?.value || [];
}

async function saveHistory(history: BackupRecord[]): Promise<void> {
  await dbPut('app_meta', { key: HISTORY_KEY, value: history });
}

// ===== 配置管理 =====

export async function getBackupConfig(): Promise<BackupConfig> {
  return loadConfig();
}

export async function updateBackupConfig(updates: Partial<BackupConfig>): Promise<BackupConfig> {
  const config = await loadConfig();
  const newConfig = { ...config, ...updates };
  await saveConfig(newConfig);
  return newConfig;
}

// ===== 备份历史 =====

export async function getBackupHistory(): Promise<BackupRecord[]> {
  const history = await loadHistory();
  return history.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function clearBackupHistory(): Promise<void> {
  await saveHistory([]);
}

// ===== 检查是否需要备份 =====

export function shouldBackup(config: BackupConfig): boolean {
  if (!config.enabled) return false;
  if (config.frequency === 'manual') return false;
  if (!config.lastBackupAt) return true;

  const last = new Date(config.lastBackupAt).getTime();
  const now = Date.now();
  const diff = now - last;

  switch (config.frequency) {
    case 'daily':
      return diff >= 24 * 60 * 60 * 1000;
    case 'weekly':
      return diff >= 7 * 24 * 60 * 60 * 1000;
    case 'monthly':
      return diff >= 30 * 24 * 60 * 60 * 1000;
    default:
      return false;
  }
}

// ===== 执行备份 =====

export interface BackupResult {
  success: boolean;
  record: BackupRecord;
  fileSize: number;
  recordCount: number;
}

/**
 * 执行一次完整备份
 * 1. 创建版本快照
 * 2. （可选）加密
 * 3. （可选）自动下载
 * 4. 记录备份历史
 * 5. 清理超出保留份数的旧记录
 */
export async function performBackup(
  sources: WaterSourceRecord[],
  config?: BackupConfig,
): Promise<BackupResult> {
  const cfg = config || await loadConfig();
  const now = new Date().toISOString();

  const record: BackupRecord = {
    id: `backup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: now,
    type: cfg.frequency,
    recordCount: sources.length,
    fileSize: 0,
    encrypted: cfg.encrypted,
    status: 'success',
  };

  try {
    // 1. 创建版本快照
    const snapshot = await createSnapshot(sources as unknown as Record<string, unknown>[], {
      name: `自动备份 ${now.slice(0, 19).replace('T', ' ')}`,
      type: 'auto',
    });
    record.snapshotId = snapshot.id;

    // 2. 准备备份数据
    const backupData = JSON.stringify({
      version: '1.0',
      createdAt: now,
      recordCount: sources.length,
      sources,
    });

    let finalData: ArrayBuffer | string;
    if (cfg.encrypted && cfg.password) {
      finalData = await encryptData(backupData, cfg.password);
    } else {
      finalData = backupData;
    }

    record.fileSize = typeof finalData === 'string'
      ? new Blob([finalData]).size
      : finalData.byteLength;

    // 3. 自动下载
    if (cfg.autoDownload) {
      const blob = new Blob([finalData], {
        type: cfg.encrypted ? 'application/octet-stream' : 'application/json',
      });
      const dateStr = now.slice(0, 10);
      const ext = cfg.encrypted ? 'wbackup' : 'json';
      saveAs(blob, `watersource-backup_${dateStr}.${ext}`);
    }

    // 4. 更新配置中的 lastBackupAt
    await updateBackupConfig({ lastBackupAt: now });

    // 5. 记录历史
    const history = await loadHistory();
    history.push(record);

    // 6. 清理超出保留份数的记录
    if (history.length > cfg.maxRetention) {
      history.splice(0, history.length - cfg.maxRetention);
    }

    await saveHistory(history);

    return {
      success: true,
      record,
      fileSize: record.fileSize,
      recordCount: sources.length,
    };
  } catch (err) {
    record.status = 'failed';
    record.error = (err as Error).message;

    // 即使失败也记录历史
    const history = await loadHistory();
    history.push(record);
    if (history.length > cfg.maxRetention) {
      history.splice(0, history.length - cfg.maxRetention);
    }
    await saveHistory(history);

    return {
      success: false,
      record,
      fileSize: 0,
      recordCount: sources.length,
    };
  }
}

// ===== 手动下载备份 =====

export async function downloadBackup(sources: WaterSourceRecord[], password?: string): Promise<{ fileSize: number }> {
  const now = new Date().toISOString();
  const backupData = JSON.stringify({
    version: '1.0',
    createdAt: now,
    recordCount: sources.length,
    sources,
  });

  let blob: Blob;
  if (password) {
    const encrypted = await encryptData(backupData, password);
    blob = new Blob([encrypted], { type: 'application/octet-stream' });
    const dateStr = now.slice(0, 10);
    saveAs(blob, `watersource-backup_${dateStr}.wbackup`);
  } else {
    blob = new Blob([backupData], { type: 'application/json' });
    const dateStr = now.slice(0, 10);
    saveAs(blob, `watersource-backup_${dateStr}.json`);
  }

  return { fileSize: blob.size };
}

// ===== 统计 =====

export interface BackupStats {
  totalBackups: number;
  successfulBackups: number;
  failedBackups: number;
  totalSize: number;
  lastBackupAt: string | null;
  nextScheduledBackup: string | null;
}

export async function getBackupStats(): Promise<BackupStats> {
  const history = await loadHistory();
  const config = await loadConfig();

  const successful = history.filter((h) => h.status === 'success');
  const totalSize = successful.reduce((sum, h) => sum + h.fileSize, 0);

  let nextScheduled: string | null = null;
  if (config.enabled && config.lastBackupAt) {
    const last = new Date(config.lastBackupAt);
    switch (config.frequency) {
      case 'daily':
        last.setDate(last.getDate() + 1);
        break;
      case 'weekly':
        last.setDate(last.getDate() + 7);
        break;
      case 'monthly':
        last.setMonth(last.getMonth() + 1);
        break;
    }
    nextScheduled = last.toISOString();
  }

  return {
    totalBackups: history.length,
    successfulBackups: successful.length,
    failedBackups: history.filter((h) => h.status === 'failed').length,
    totalSize,
    lastBackupAt: config.lastBackupAt,
    nextScheduledBackup: nextScheduled,
  };
}

// ===== 格式化 =====

export function formatBackupFrequency(freq: BackupFrequency): string {
  const labels: Record<BackupFrequency, string> = {
    manual: '手动',
    daily: '每日',
    weekly: '每周',
    monthly: '每月',
  };
  return labels[freq];
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
