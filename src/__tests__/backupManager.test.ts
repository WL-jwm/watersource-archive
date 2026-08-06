/**
 * backupManager 全量数据备份管理器测试
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock IDB
vi.mock('@/lib/idb', () => ({
  dbGetAll: vi.fn().mockResolvedValue([]),
  dbPut: vi.fn().mockResolvedValue(undefined),
  dbPutBatch: vi.fn().mockResolvedValue(undefined),
  dbClear: vi.fn().mockResolvedValue(undefined),
  dbGet: vi.fn().mockResolvedValue(undefined),
}));

// Mock auditTrail
vi.mock('@/lib/auditTrail', () => ({
  exportAuditLogs: vi.fn().mockReturnValue(JSON.stringify({ exportedAt: '2025-01-01T00:00:00Z', totalEntries: 0, entries: [] })),
  clearAuditLogs: vi.fn(),
  logAudit: vi.fn(),
}));

import {
  getBackupSettings,
  setBackupSettings,
  exportAllData,
  importAllData,
  triggerBackupDownload,
  checkBackupNeeded,
  getLastBackupTime,
  formatBackupSize,
  formatDaysSince,
  tryAutoBackup,
} from '@/lib/backupManager';
import { dbClear, dbGet, dbGetAll, dbPut, dbPutBatch } from '@/lib/idb';

describe('backupManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ===== 设置管理 =====
  describe('Backup Settings', () => {
    it('returns default settings when none saved', () => {
      const settings = getBackupSettings();
      expect(settings.frequency).toBe('weekly');
      expect(settings.autoDownload).toBe(true);
      expect(settings.thresholdDays).toBe(7);
    });

    it('saves and retrieves settings', () => {
      setBackupSettings({ frequency: 'daily', thresholdDays: 3 });
      const settings = getBackupSettings();
      expect(settings.frequency).toBe('daily');
      expect(settings.thresholdDays).toBe(3);
      expect(settings.autoDownload).toBe(true); // preserved from default
    });

    it('partial update merges with existing', () => {
      setBackupSettings({ frequency: 'manual' });
      setBackupSettings({ autoDownload: false });
      const settings = getBackupSettings();
      expect(settings.frequency).toBe('manual');
      expect(settings.autoDownload).toBe(false);
    });
  });

  // ===== 备份时间 =====
  describe('Last Backup Time', () => {
    it('returns null when no backup recorded', async () => {
      vi.mocked(dbGet).mockResolvedValue(undefined);
      const time = await getLastBackupTime();
      expect(time).toBeNull();
    });

    it('returns stored backup time', async () => {
      vi.mocked(dbGet).mockResolvedValue({ key: 'last_backup_time', value: '2025-01-15T10:00:00Z' });
      const time = await getLastBackupTime();
      expect(time).toBe('2025-01-15T10:00:00Z');
    });
  });

  // ===== 备份检查 =====
  describe('checkBackupNeeded', () => {
    it('returns needed=false for manual frequency', async () => {
      setBackupSettings({ frequency: 'manual' });
      const result = await checkBackupNeeded();
      expect(result.needed).toBe(false);
    });

    it('returns needed=true when never backed up', async () => {
      setBackupSettings({ frequency: 'weekly' });
      vi.mocked(dbGet).mockResolvedValue(undefined);
      const result = await checkBackupNeeded();
      expect(result.needed).toBe(true);
      expect(result.daysSince).toBe(Infinity);
      expect(result.lastTime).toBeNull();
    });

    it('returns needed=false when recently backed up', async () => {
      setBackupSettings({ frequency: 'weekly', thresholdDays: 7 });
      const recent = new Date(Date.now() - 2 * 86400000).toISOString(); // 2 days ago
      vi.mocked(dbGet).mockResolvedValue({ key: 'last_backup_time', value: recent });
      const result = await checkBackupNeeded();
      expect(result.needed).toBe(false);
      expect(result.daysSince).toBe(2);
    });

    it('returns needed=true when threshold exceeded', async () => {
      setBackupSettings({ frequency: 'weekly', thresholdDays: 7 });
      const old = new Date(Date.now() - 10 * 86400000).toISOString(); // 10 days ago
      vi.mocked(dbGet).mockResolvedValue({ key: 'last_backup_time', value: old });
      const result = await checkBackupNeeded();
      expect(result.needed).toBe(true);
      expect(result.daysSince).toBe(10);
    });

    it('daily frequency checks 1 day threshold', async () => {
      setBackupSettings({ frequency: 'daily' });
      const recent = new Date(Date.now() - 1 * 86400000).toISOString(); // 1 day ago
      vi.mocked(dbGet).mockResolvedValue({ key: 'last_backup_time', value: recent });
      const result = await checkBackupNeeded();
      expect(result.needed).toBe(true);
    });
  });

  // ===== 全量导出 =====
  describe('exportAllData', () => {
    it('exports valid JSON with all sections', async () => {
      vi.mocked(dbGetAll).mockResolvedValue([{ id: 'test-1', name: 'Test Source' }]);
      const json = await exportAllData();
      const data = JSON.parse(json);

      expect(data.meta).toBeDefined();
      expect(data.meta.backupVersion).toBe(1);
      expect(data.meta.createdAt).toBeDefined();
      expect(data.idb).toBeDefined();
      expect(data.idb.water_sources).toHaveLength(1);
      expect(data.idb.cities).toBeDefined();
      expect(data.idb.zone_results).toBeDefined();
      expect(data.idb.data_versions).toBeDefined();
      expect(data.idb.data_changelog).toBeDefined();
      expect(data.localStorage).toBeDefined();
      expect(data.localStorage.reports).toBeDefined();
      expect(data.localStorage.settings).toBeDefined();
      expect(data.auditLogs).toBeDefined();
    });

    it('includes localStorage reports in export', async () => {
      vi.mocked(dbGetAll).mockResolvedValue([]);
      localStorage.setItem('watersource-archive-data', JSON.stringify([{ id: 'r1', title: 'Report 1' }]));
      const json = await exportAllData();
      const data = JSON.parse(json);
      expect(data.localStorage.reports).toHaveLength(1);
    });

    it('includes localStorage settings in export', async () => {
      vi.mocked(dbGetAll).mockResolvedValue([]);
      localStorage.setItem('ws-dark-mode', 'true');
      localStorage.setItem('ws-language', 'zh-CN');
      const json = await exportAllData();
      const data = JSON.parse(json);
      expect(data.localStorage.settings['ws-dark-mode']).toBe('true');
      expect(data.localStorage.settings['ws-language']).toBe('zh-CN');
    });

    it('handles empty IDB stores gracefully', async () => {
      vi.mocked(dbGetAll).mockResolvedValue([]);
      const json = await exportAllData();
      const data = JSON.parse(json);
      expect(data.idb.water_sources).toEqual([]);
      expect(data.idb.cities).toEqual([]);
    });
  });

  // ===== 全量恢复 =====
  describe('importAllData', () => {
    it('fails on invalid JSON', async () => {
      const result = await importAllData('not valid json');
      expect(result.success).toBe(false);
      expect(result.message).toContain('无法解析');
    });

    it('fails on missing required fields', async () => {
      const result = await importAllData(JSON.stringify({ foo: 'bar' }));
      expect(result.success).toBe(false);
      expect(result.message).toContain('格式不正确');
    });

    it('successfully restores valid backup', async () => {
      const backup = {
        meta: {
          appVersion: 'test',
          backupVersion: 1,
          createdAt: '2025-01-01T00:00:00Z',
          sourceStores: [],
        },
        idb: {
          water_sources: [{ id: 'ws1', name: 'Source 1' }],
          cities: [{ cityName: '石家庄市' }],
          app_meta: [{ key: 'test', value: 'val' }],
          zone_results: [{ id: 'zr1' }],
          data_versions: [{ id: 'v1' }],
          data_changelog: [{ id: 'c1' }],
        },
        localStorage: {
          reports: [{ id: 'r1' }],
          settings: { 'ws-dark-mode': 'true' },
        },
        auditLogs: JSON.stringify({ entries: [{ id: 'a1' }] }),
      };

      const result = await importAllData(JSON.stringify(backup));
      expect(result.success).toBe(true);
      expect(result.details.waterSources).toBe(1);
      expect(result.details.cities).toBe(1);
      expect(result.details.zoneResults).toBe(1);
      expect(result.details.dataVersions).toBe(1);
      expect(result.details.dataChangelog).toBe(1);
      expect(result.details.reports).toBe(1);
      expect(result.message).toContain('恢复成功');
    });

    it('restores localStorage settings', async () => {
      const backup = {
        meta: { appVersion: 'test', backupVersion: 1, createdAt: '2025-01-01', sourceStores: [] },
        idb: {
          water_sources: [], cities: [], app_meta: [], zone_results: [], data_versions: [], data_changelog: [],
        },
        localStorage: {
          reports: [],
          settings: { 'ws-dark-mode': 'true', 'ws-language': 'en' },
        },
        auditLogs: '{}',
      };
      const result = await importAllData(JSON.stringify(backup));
      expect(result.success).toBe(true);
      expect(localStorage.getItem('ws-dark-mode')).toBe('true');
      expect(localStorage.getItem('ws-language')).toBe('en');
    });

    it('calls dbClear before dbPutBatch for each store', async () => {
      const backup = {
        meta: { appVersion: 'test', backupVersion: 1, createdAt: '2025-01-01', sourceStores: [] },
        idb: {
          water_sources: [{ id: 'x' }],
          cities: [{ cityName: 'y' }],
          app_meta: [],
          zone_results: [],
          data_versions: [],
          data_changelog: [],
        },
        localStorage: { reports: [], settings: {} },
        auditLogs: '{}',
      };
      await importAllData(JSON.stringify(backup));
      expect(dbClear).toHaveBeenCalledWith('water_sources');
      expect(dbClear).toHaveBeenCalledWith('cities');
      expect(dbPutBatch).toHaveBeenCalledWith('water_sources', [{ id: 'x' }]);
      expect(dbPutBatch).toHaveBeenCalledWith('cities', [{ cityName: 'y' }]);
    });
  });

  // ===== 下载触发 =====
  describe('triggerBackupDownload', () => {
    it('creates download link and records backup time', async () => {
      vi.mocked(dbGetAll).mockResolvedValue([]);
      vi.mocked(dbPut).mockResolvedValue(undefined);

      // Mock DOM APIs
      const clickSpy = vi.fn();
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      const result = await triggerBackupDownload();

      expect(result.success).toBe(true);
      expect(result.fileName).toContain('watersource-backup_');
      expect(result.fileName).toContain('.json');
      expect(result.size).toBeGreaterThan(0);
      expect(dbPut).toHaveBeenCalledWith('app_meta', expect.objectContaining({ key: 'last_backup_time' }));
      expect(appendChildSpy).toHaveBeenCalled();

      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
      revokeSpy.mockRestore();
    });
  });

  // ===== 自动备份 =====
  describe('tryAutoBackup', () => {
    it('returns not triggered for manual mode', async () => {
      setBackupSettings({ frequency: 'manual' });
      const result = await tryAutoBackup();
      expect(result.triggered).toBe(false);
      expect(result.reason).toBe('manual_mode');
    });

    it('returns not triggered when autoDownload disabled', async () => {
      setBackupSettings({ frequency: 'weekly', autoDownload: false });
      const result = await tryAutoBackup();
      expect(result.triggered).toBe(false);
      expect(result.reason).toBe('manual_mode');
    });

    it('returns not triggered when backup not needed', async () => {
      setBackupSettings({ frequency: 'weekly', thresholdDays: 7 });
      const recent = new Date(Date.now() - 1 * 86400000).toISOString();
      vi.mocked(dbGet).mockResolvedValue({ key: 'last_backup_time', value: recent });
      const result = await tryAutoBackup();
      expect(result.triggered).toBe(false);
      expect(result.reason).toContain('not_needed');
    });
  });

  // ===== 格式化辅助 =====
  describe('format helpers', () => {
    it('formatBackupSize formats bytes', () => {
      expect(formatBackupSize(100)).toBe('100 B');
      expect(formatBackupSize(1024)).toBe('1.0 KB');
      expect(formatBackupSize(1024 * 1024)).toBe('1.00 MB');
      expect(formatBackupSize(512 * 1024)).toBe('512.0 KB');
    });

    it('formatDaysSince formats days', () => {
      expect(formatDaysSince(Infinity)).toBe('从未备份');
      expect(formatDaysSince(0)).toBe('今天');
      expect(formatDaysSince(1)).toBe('昨天');
      expect(formatDaysSince(5)).toBe('5 天前');
      expect(formatDaysSince(30)).toBe('30 天前');
    });
  });
});
