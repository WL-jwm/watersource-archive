/* ===== S11.4: 多用户数据同步引擎 =====
 * 基于版本变更日志的增量同步
 * 加密数据包（.wsync 格式）
 */

import { encryptData, decryptData } from './cryptoExport';
import { detectConflicts, type ConflictReport } from './conflictDetector';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';

// ===== 类型定义 =====

export interface SyncPackageMeta {
  /** 格式版本 */
  format: 'wsync-1';
  /** 生成时间 */
  createdAt: string;
  /** 源设备标识 */
  sourceDevice: string;
  /** 数据时间范围 */
  timeRange: { from: string; to: string };
  /** 记录数 */
  recordCount: number;
  /** 包类型 */
  type: 'incremental' | 'full';
}

export interface SyncPackage {
  meta: SyncPackageMeta;
  /** 新增的记录 */
  added: WaterSourceRecord[];
  /** 修改的记录 */
  updated: WaterSourceRecord[];
  /** 删除的记录 ID 列表 */
  deleted: string[];
}

export interface SyncPreview {
  /** 新增数 */
  addedCount: number;
  /** 更新数 */
  updatedCount: number;
  /** 删除数 */
  deletedCount: number;
  /** 冲突报告 */
  conflicts: ConflictReport;
  /** 总影响记录数 */
  totalAffected: number;
}

export interface SyncResult {
  applied: number;
  skipped: number;
  conflicts: number;
  errors: string[];
}

// ===== 增量变更提取 =====

/**
 * 从水源地列表中提取自指定时间以来的增量变更
 * 基于 dataVersionEngine 的 ChangeLog 机制
 *
 * 简化实现：直接对比当前数据与快照的差异
 */
export function extractIncrementalChanges(
  currentSources: WaterSourceRecord[],
  sinceTimestamp: string,
  previousSources?: WaterSourceRecord[],
): SyncPackage {
  const now = new Date().toISOString();

  if (!previousSources) {
    // 无对比基准，导出全量
    return {
      meta: {
        format: 'wsync-1',
        createdAt: now,
        sourceDevice: 'unknown',
        timeRange: { from: sinceTimestamp, to: now },
        recordCount: currentSources.length,
        type: 'full',
      },
      added: [...currentSources],
      updated: [],
      deleted: [],
    };
  }

  // 对比差异
  const prevMap = new Map(previousSources.map((s) => [s.id, s]));
  const currMap = new Map(currentSources.map((s) => [s.id, s]));

  const added: WaterSourceRecord[] = [];
  const updated: WaterSourceRecord[] = [];
  const deleted: string[] = [];

  // 新增和修改
  for (const [id, curr] of currMap) {
    const prev = prevMap.get(id);
    if (!prev) {
      added.push(curr);
    } else if (JSON.stringify(prev) !== JSON.stringify(curr)) {
      updated.push(curr);
    }
  }

  // 删除
  for (const [id] of prevMap) {
    if (!currMap.has(id)) {
      deleted.push(id);
    }
  }

  return {
    meta: {
      format: 'wsync-1',
      createdAt: now,
      sourceDevice: 'unknown',
      timeRange: { from: sinceTimestamp, to: now },
      recordCount: added.length + updated.length + deleted.length,
      type: 'incremental',
    },
    added,
    updated,
    deleted,
  };
}

// ===== 同步包加密导出 =====

/**
 * 生成加密同步包并触发下载
 */
export async function createSyncPackage(
  sources: WaterSourceRecord[],
  password: string,
  sinceTimestamp: string,
  previousSources?: WaterSourceRecord[],
  deviceName: string = 'unknown',
): Promise<{ success: boolean; fileSize: number; error?: string }> {
  try {
    const pkg = extractIncrementalChanges(sources, sinceTimestamp, previousSources);
    pkg.meta.sourceDevice = deviceName;

    const jsonStr = JSON.stringify(pkg);
    const encrypted = await encryptData(jsonStr, password);

    // 触发下载
    const blob = new Blob([encrypted], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `watersource-sync_${dateStr}.wsync`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return { success: true, fileSize: encrypted.byteLength };
  } catch (err) {
    return { success: false, fileSize: 0, error: (err as Error).message };
  }
}

// ===== 同步包导入预览 =====

/**
 * 解密同步包并生成预览
 */
export async function readSyncPackage(
  file: File,
  password: string,
): Promise<{ success: boolean; pkg?: SyncPackage; error?: string }> {
  try {
    const buffer = await file.arrayBuffer();
    const decrypted = await decryptData(buffer, password);
    const pkg = JSON.parse(decrypted) as SyncPackage;

    if (!pkg.meta || pkg.meta.format !== 'wsync-1') {
      return { success: false, error: '无效的同步包格式' };
    }

    return { success: true, pkg };
  } catch (err) {
    return { success: false, error: `解密失败: ${(err as Error).message}` };
  }
}

/**
 * 生成同步预览（冲突检测）
 */
export function previewSync(
  pkg: SyncPackage,
  existingSources: WaterSourceRecord[],
): SyncPreview {
  const allIncoming = [...pkg.added, ...pkg.updated];
  const conflicts = detectConflicts(allIncoming, existingSources);

  return {
    addedCount: pkg.added.length,
    updatedCount: pkg.updated.length,
    deletedCount: pkg.deleted.length,
    conflicts,
    totalAffected: allIncoming.length + pkg.deleted.length,
  };
}

// ===== 同步包应用 =====

/**
 * 应用同步包到现有数据
 * 返回需要写入的记录和需要删除的 ID
 */
export function applySyncPackage(
  pkg: SyncPackage,
  existingSources: WaterSourceRecord[],
  strategy: 'skip' | 'overwrite' | 'rename',
): {
  toAdd: WaterSourceRecord[];
  toUpdate: WaterSourceRecord[];
  toDelete: string[];
  skipped: number;
  errors: string[];
} {
  const existingMap = new Map(existingSources.map((s) => [s.id, s]));
  const existingByNameCity = new Map(
    existingSources.map((s) => [`${s.name}|${s.cityName}`, s]),
  );

  const toAdd: WaterSourceRecord[] = [];
  const toUpdate: WaterSourceRecord[] = [];
  const toDelete: string[] = [...pkg.deleted];
  const errors: string[] = [];
  let skipped = 0;

  // 处理新增
  for (const rec of pkg.added) {
    const conflictById = existingMap.has(rec.id);
    const conflictByName = existingByNameCity.has(`${rec.name}|${rec.cityName}`);

    if (conflictById || conflictByName) {
      if (strategy === 'skip') {
        skipped++;
      } else if (strategy === 'overwrite') {
        toUpdate.push(rec);
      } else if (strategy === 'rename') {
        let suffix = 2;
        let newName = rec.name;
        while (existingByNameCity.has(`${newName}|${rec.cityName}`)) {
          newName = `${rec.name}_${suffix}`;
          suffix++;
        }
        toAdd.push({ ...rec, name: newName, id: `${rec.id}_sync_${suffix}` });
      }
    } else {
      toAdd.push(rec);
    }
  }

  // 处理更新
  for (const rec of pkg.updated) {
    const existing = existingMap.get(rec.id);
    if (existing) {
      if (strategy === 'skip') {
        // 检查是否有差异
        if (JSON.stringify(existing) !== JSON.stringify(rec)) {
          skipped++;
        }
      } else {
        toUpdate.push(rec);
      }
    } else {
      // 目标不存在，作为新增处理
      toAdd.push(rec);
    }
  }

  return { toAdd, toUpdate, toDelete, skipped, errors };
}
