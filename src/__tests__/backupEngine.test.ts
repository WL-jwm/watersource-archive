/* ===== S11.12: 定时备份引擎测试 ===== */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock idb
vi.mock('@/lib/idb', () => ({
  dbGet: vi.fn(),
  dbPut: vi.fn(),
  dbDelete: vi.fn(),
  dbGetAll: vi.fn(),
  dbPutBatch: vi.fn(),
  dbGetByIndex: vi.fn(),
  dbCount: vi.fn(),
  dbClear: vi.fn(),
}));

// Mock dataVersionEngine
vi.mock('@/lib/dataVersionEngine', () => ({
  createSnapshot: vi.fn().mockResolvedValue({ id: 'snap-1' }),
}));

// Mock cryptoExport
vi.mock('@/lib/cryptoExport', () => ({
  encryptData: vi.fn().mockResolvedValue(new ArrayBuffer(100)),
}));

// Mock file-saver
vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

import { dbGet, dbPut } from '@/lib/idb';
import {
  getBackupConfig,
  updateBackupConfig,
  getBackupHistory,
  clearBackupHistory,
  shouldBackup,
  performBackup,
  getBackupStats,
  formatBackupFrequency,
  formatFileSize,
  DEFAULT_BACKUP_CONFIG,
  type BackupConfig,
} from '@/lib/backupEngine';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';

function makeRecord(overrides: Partial<WaterSourceRecord> = {}): WaterSourceRecord {
  return {
    id: 'src-1',
    cityName: '石家庄市',
    level: 'municipal',
    name: '岗南水库',
    type: '地表水',
    county: '平山县',
    status: '在用',
    dataVersion: 1,
    ...overrides,
  };
}

describe('backupEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===== DEFAULT_BACKUP_CONFIG =====
  describe('DEFAULT_BACKUP_CONFIG', () => {
    it('默认未启用自动备份', () => {
      expect(DEFAULT_BACKUP_CONFIG.enabled).toBe(false);
    });
    it('默认频率为每周', () => {
      expect(DEFAULT_BACKUP_CONFIG.frequency).toBe('weekly');
    });
    it('默认保留10份', () => {
      expect(DEFAULT_BACKUP_CONFIG.maxRetention).toBe(10);
    });
  });

  // ===== getBackupConfig =====
  describe('getBackupConfig', () => {
    it('返回已保存的配置', async () => {
      const config: BackupConfig = {
        ...DEFAULT_BACKUP_CONFIG,
        enabled: true,
        frequency: 'daily',
      };
      vi.mocked(dbGet).mockResolvedValue({ key: 'backup_config', value: config });

      const result = await getBackupConfig();
      expect(result.enabled).toBe(true);
      expect(result.frequency).toBe('daily');
    });

    it('无配置时返回默认值', async () => {
      vi.mocked(dbGet).mockResolvedValue(null);
      const result = await getBackupConfig();
      expect(result.enabled).toBe(false);
      expect(result.frequency).toBe('weekly');
    });
  });

  // ===== updateBackupConfig =====
  describe('updateBackupConfig', () => {
    it('更新配置并保存', async () => {
      vi.mocked(dbGet).mockResolvedValue({ key: 'backup_config', value: { ...DEFAULT_BACKUP_CONFIG } });
      vi.mocked(dbPut).mockResolvedValue(undefined);

      const result = await updateBackupConfig({ enabled: true, frequency: 'monthly' });
      expect(result.enabled).toBe(true);
      expect(result.frequency).toBe('monthly');
      expect(dbPut).toHaveBeenCalledOnce();
    });
  });

  // ===== getBackupHistory =====
  describe('getBackupHistory', () => {
    it('返回按时间倒序的历史记录', async () => {
      const history = [
        { id: 'b1', createdAt: '2024-06-01T10:00:00.000Z', type: 'weekly', recordCount: 100, fileSize: 5000, encrypted: false, status: 'success' },
        { id: 'b2', createdAt: '2024-06-05T10:00:00.000Z', type: 'weekly', recordCount: 102, fileSize: 5200, encrypted: false, status: 'success' },
      ];
      vi.mocked(dbGet).mockResolvedValue({ key: 'backup_history', value: history });

      const result = await getBackupHistory();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('b2'); // 更新的在前
    });

    it('无历史时返回空数组', async () => {
      vi.mocked(dbGet).mockResolvedValue(null);
      const result = await getBackupHistory();
      expect(result).toHaveLength(0);
    });
  });

  // ===== clearBackupHistory =====
  describe('clearBackupHistory', () => {
    it('清空历史记录', async () => {
      vi.mocked(dbPut).mockResolvedValue(undefined);
      await clearBackupHistory();
      expect(dbPut).toHaveBeenCalledOnce();
    });
  });

  // ===== shouldBackup =====
  describe('shouldBackup', () => {
    it('未启用时返回 false', () => {
      expect(shouldBackup({ ...DEFAULT_BACKUP_CONFIG, enabled: false })).toBe(false);
    });

    it('从未备份过时返回 true', () => {
      expect(shouldBackup({ ...DEFAULT_BACKUP_CONFIG, enabled: true, lastBackupAt: null })).toBe(true);
    });

    it('每日备份：超过24小时返回 true', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      expect(shouldBackup({
        ...DEFAULT_BACKUP_CONFIG,
        enabled: true,
        frequency: 'daily',
        lastBackupAt: twoDaysAgo,
      })).toBe(true);
    });

    it('每日备份：未超过24小时返回 false', () => {
      const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
      expect(shouldBackup({
        ...DEFAULT_BACKUP_CONFIG,
        enabled: true,
        frequency: 'daily',
        lastBackupAt: oneHourAgo,
      })).toBe(false);
    });

    it('每周备份：超过7天返回 true', () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      expect(shouldBackup({
        ...DEFAULT_BACKUP_CONFIG,
        enabled: true,
        frequency: 'weekly',
        lastBackupAt: tenDaysAgo,
      })).toBe(true);
    });

    it('每月备份：超过30天返回 true', () => {
      const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
      expect(shouldBackup({
        ...DEFAULT_BACKUP_CONFIG,
        enabled: true,
        frequency: 'monthly',
        lastBackupAt: fortyDaysAgo,
      })).toBe(true);
    });

    it('手动频率始终返回 false', () => {
      const config: BackupConfig = {
        ...DEFAULT_BACKUP_CONFIG,
        enabled: true,
        frequency: 'manual',
        lastBackupAt: null,
      };
      expect(shouldBackup(config)).toBe(false);
    });
  });

  // ===== performBackup =====
  describe('performBackup', () => {
    it('成功执行备份', async () => {
      const config: BackupConfig = {
        ...DEFAULT_BACKUP_CONFIG,
        enabled: true,
        frequency: 'weekly',
        encrypted: false,
        autoDownload: false,
      };
      vi.mocked(dbGet).mockImplementation((_store, key) => {
        if (key === 'backup_config') return Promise.resolve({ key, value: config });
        if (key === 'backup_history') return Promise.resolve({ key, value: [] });
        return Promise.resolve(null);
      });
      vi.mocked(dbPut).mockResolvedValue(undefined);

      const sources = [makeRecord(), makeRecord({ id: 's2' })];
      const result = await performBackup(sources);

      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(2);
      expect(result.record.status).toBe('success');
    });

    it('备份后更新 lastBackupAt', async () => {
      const config: BackupConfig = { ...DEFAULT_BACKUP_CONFIG, enabled: true };
      vi.mocked(dbGet).mockImplementation((_store, key) => {
        if (key === 'backup_config') return Promise.resolve({ key, value: config });
        if (key === 'backup_history') return Promise.resolve({ key, value: [] });
        return Promise.resolve(null);
      });
      vi.mocked(dbPut).mockResolvedValue(undefined);

      await performBackup([makeRecord()]);

      // dbPut should be called at least twice (config + history)
      expect(vi.mocked(dbPut).mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('备份历史超出保留份数时自动清理', async () => {
      const config: BackupConfig = { ...DEFAULT_BACKUP_CONFIG, maxRetention: 2 };
      const existingHistory = [
        { id: 'old1', createdAt: '2024-01-01', type: 'weekly', recordCount: 1, fileSize: 100, encrypted: false, status: 'success' },
        { id: 'old2', createdAt: '2024-02-01', type: 'weekly', recordCount: 1, fileSize: 100, encrypted: false, status: 'success' },
      ];
      vi.mocked(dbGet).mockImplementation((_store, key) => {
        if (key === 'backup_config') return Promise.resolve({ key, value: config });
        if (key === 'backup_history') return Promise.resolve({ key, value: existingHistory });
        return Promise.resolve(null);
      });
      vi.mocked(dbPut).mockResolvedValue(undefined);

      await performBackup([makeRecord()]);

      // Check the last dbPut call (history save)
      const lastCall = vi.mocked(dbPut).mock.calls[vi.mocked(dbPut).mock.calls.length - 1];
      const savedHistory = lastCall[1] as { value: { id: string }[] };
      expect(savedHistory.value.length).toBeLessThanOrEqual(2);
    });
  });

  // ===== getBackupStats =====
  describe('getBackupStats', () => {
    it('正确统计备份信息', async () => {
      const history = [
        { id: 'b1', createdAt: '2024-06-01', type: 'weekly', recordCount: 100, fileSize: 5000, encrypted: false, status: 'success' },
        { id: 'b2', createdAt: '2024-06-05', type: 'weekly', recordCount: 102, fileSize: 5200, encrypted: true, status: 'success' },
        { id: 'b3', createdAt: '2024-06-08', type: 'weekly', recordCount: 105, fileSize: 0, encrypted: false, status: 'failed' },
      ];
      const config: BackupConfig = { ...DEFAULT_BACKUP_CONFIG, enabled: true, lastBackupAt: '2024-06-08T10:00:00.000Z', frequency: 'weekly' };

      vi.mocked(dbGet)
        .mockResolvedValueOnce({ key: 'backup_history', value: history })
        .mockResolvedValueOnce({ key: 'backup_config', value: config });

      const stats = await getBackupStats();

      expect(stats.totalBackups).toBe(3);
      expect(stats.successfulBackups).toBe(2);
      expect(stats.failedBackups).toBe(1);
      expect(stats.totalSize).toBe(10200);
      expect(stats.lastBackupAt).toBe('2024-06-08T10:00:00.000Z');
    });

    it('无历史记录时返回零值', async () => {
      vi.mocked(dbGet)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const stats = await getBackupStats();
      expect(stats.totalBackups).toBe(0);
      expect(stats.successfulBackups).toBe(0);
      expect(stats.totalSize).toBe(0);
    });
  });

  // ===== 格式化函数 =====
  describe('formatBackupFrequency', () => {
    it('manual 格式化为 手动', () => {
      expect(formatBackupFrequency('manual')).toBe('手动');
    });
    it('daily 格式化为 每日', () => {
      expect(formatBackupFrequency('daily')).toBe('每日');
    });
    it('weekly 格式化为 每周', () => {
      expect(formatBackupFrequency('weekly')).toBe('每周');
    });
    it('monthly 格式化为 每月', () => {
      expect(formatBackupFrequency('monthly')).toBe('每月');
    });
  });

  describe('formatFileSize', () => {
    it('小于 1KB 显示 B', () => {
      expect(formatFileSize(500)).toBe('500 B');
    });
    it('小于 1MB 显示 KB', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });
    it('大于 1MB 显示 MB', () => {
      expect(formatFileSize(2 * 1024 * 1024)).toBe('2.00 MB');
    });
    it('0 字节显示 0 B', () => {
      expect(formatFileSize(0)).toBe('0 B');
    });
  });
});
