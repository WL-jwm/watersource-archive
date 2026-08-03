/* ===== S11.8: 回收站引擎测试 =====
 * 由于 trashEngine 依赖 IndexedDB，测试中使用 mock
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock idb 模块
vi.mock('@/lib/idb', () => ({
  dbPut: vi.fn(),
  dbGet: vi.fn(),
  dbDelete: vi.fn(),
  dbGetAll: vi.fn(),
  dbPutBatch: vi.fn(),
  dbGetByIndex: vi.fn(),
  dbCount: vi.fn(),
  dbClear: vi.fn(),
}));

import { dbPut, dbGet, dbDelete, dbGetAll } from '@/lib/idb';
import {
  softDelete,
  restore,
  purge,
  purgeAll,
  purgeExpired,
  listTrash,
  getTrashStats,
  getDaysRemaining,
  formatExpiry,
  type TrashItem,
} from '@/lib/trashEngine';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';

function makeRecord(overrides: Partial<WaterSourceRecord> = {}): WaterSourceRecord {
  return {
    id: 'test-1',
    cityName: '石家庄市',
    level: 'municipal',
    name: '测试水源地',
    type: '地下水',
    county: '平山县',
    status: '在用',
    dataVersion: 1,
    ...overrides,
  };
}

describe('trashEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===== softDelete =====
  describe('softDelete', () => {
    it('应将记录移入回收站并设置过期时间', async () => {
      const record = makeRecord();
      const item = await softDelete(record, 'user');

      expect(item.record).toEqual(record);
      expect(item.originalId).toBe('test-1');
      expect(item.id).toContain('trash_test-1_');
      expect(item.deletedBy).toBe('user');
      expect(item.deletedAt).toBeTruthy();
      expect(item.expiresAt).toBeTruthy();

      // 过期时间应为 30 天后
      const expiryMs = new Date(item.expiresAt).getTime();
      const deleteMs = new Date(item.deletedAt).getTime();
      const diffDays = (expiryMs - deleteMs) / (24 * 60 * 60 * 1000);
      expect(diffDays).toBeCloseTo(30, 0);

      expect(dbPut).toHaveBeenCalledWith('trash', item);
    });

    it('应生成唯一 ID', async () => {
      const record = makeRecord();
      const item1 = await softDelete(record);
      const item2 = await softDelete(record);
      expect(item1.id).not.toBe(item2.id);
    });
  });

  // ===== restore =====
  describe('restore', () => {
    it('应从回收站恢复记录并删除回收站条目', async () => {
      const trashItem: TrashItem = {
        id: 'trash_1',
        originalId: 'orig-1',
        record: makeRecord({ id: 'orig-1' }),
        deletedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        deletedBy: 'user',
      };
      vi.mocked(dbGet).mockResolvedValue(trashItem);

      const result = await restore('trash_1');
      expect(result).toEqual(trashItem.record);
      expect(dbDelete).toHaveBeenCalledWith('trash', 'trash_1');
    });

    it('回收站中不存在的记录应返回 null', async () => {
      vi.mocked(dbGet).mockResolvedValue(undefined);
      const result = await restore('nonexistent');
      expect(result).toBeNull();
    });
  });

  // ===== purge =====
  describe('purge', () => {
    it('应删除回收站条目', async () => {
      await purge('trash_1');
      expect(dbDelete).toHaveBeenCalledWith('trash', 'trash_1');
    });
  });

  // ===== purgeAll =====
  describe('purgeAll', () => {
    it('应清空全部回收站并返回数量', async () => {
      const items: TrashItem[] = [
        { id: 't1', originalId: 'r1', record: makeRecord(), deletedAt: '', expiresAt: '', deletedBy: '' },
        { id: 't2', originalId: 'r2', record: makeRecord(), deletedAt: '', expiresAt: '', deletedBy: '' },
      ];
      vi.mocked(dbGetAll).mockResolvedValue(items);

      const count = await purgeAll();
      expect(count).toBe(2);
      expect(dbDelete).toHaveBeenCalledTimes(2);
    });

    it('空回收站应返回 0', async () => {
      vi.mocked(dbGetAll).mockResolvedValue([]);
      const count = await purgeAll();
      expect(count).toBe(0);
    });
  });

  // ===== purgeExpired =====
  describe('purgeExpired', () => {
    it('应清理过期记录', async () => {
      const now = Date.now();
      const items: TrashItem[] = [
        { id: 't1', originalId: 'r1', record: makeRecord(), deletedAt: '', expiresAt: new Date(now - 86400000).toISOString(), deletedBy: '' }, // 已过期
        { id: 't2', originalId: 'r2', record: makeRecord(), deletedAt: '', expiresAt: new Date(now + 86400000 * 20).toISOString(), deletedBy: '' }, // 未过期
      ];
      vi.mocked(dbGetAll).mockResolvedValue(items);

      const purged = await purgeExpired();
      expect(purged).toBe(1);
      expect(dbDelete).toHaveBeenCalledWith('trash', 't1');
      expect(dbDelete).not.toHaveBeenCalledWith('trash', 't2');
    });

    it('无过期记录时返回 0', async () => {
      vi.mocked(dbGetAll).mockResolvedValue([]);
      const purged = await purgeExpired();
      expect(purged).toBe(0);
    });
  });

  // ===== listTrash =====
  describe('listTrash', () => {
    it('应按删除时间倒序返回', async () => {
      const items: TrashItem[] = [
        { id: 't1', originalId: 'r1', record: makeRecord(), deletedAt: '2024-01-01T00:00:00Z', expiresAt: '', deletedBy: '' },
        { id: 't2', originalId: 'r2', record: makeRecord(), deletedAt: '2024-01-03T00:00:00Z', expiresAt: '', deletedBy: '' },
        { id: 't3', originalId: 'r3', record: makeRecord(), deletedAt: '2024-01-02T00:00:00Z', expiresAt: '', deletedBy: '' },
      ];
      vi.mocked(dbGetAll).mockResolvedValue(items);

      const result = await listTrash();
      expect(result[0].id).toBe('t2'); // 最近的
      expect(result[1].id).toBe('t3');
      expect(result[2].id).toBe('t1');
    });
  });

  // ===== getTrashStats =====
  describe('getTrashStats', () => {
    it('应正确统计总数/即将过期/已过期', async () => {
      const now = Date.now();
      const items: TrashItem[] = [
        { id: 't1', originalId: 'r1', record: makeRecord(), deletedAt: '', expiresAt: new Date(now - 86400000).toISOString(), deletedBy: '' }, // 已过期
        { id: 't2', originalId: 'r2', record: makeRecord(), deletedAt: '', expiresAt: new Date(now + 3 * 86400000).toISOString(), deletedBy: '' }, // 即将过期(3天)
        { id: 't3', originalId: 'r3', record: makeRecord(), deletedAt: '', expiresAt: new Date(now + 20 * 86400000).toISOString(), deletedBy: '' }, // 正常
      ];
      vi.mocked(dbGetAll).mockResolvedValue(items);

      const stats = await getTrashStats();
      expect(stats.total).toBe(3);
      expect(stats.expired).toBe(1);
      expect(stats.expiringSoon).toBe(1);
    });
  });

  // ===== 时间工具 =====
  describe('时间工具函数', () => {
    it('getDaysRemaining 应返回剩余天数', () => {
      const future = new Date(Date.now() + 5 * 86400000).toISOString();
      const days = getDaysRemaining(future);
      expect(days).toBeGreaterThanOrEqual(4);
      expect(days).toBeLessThanOrEqual(5);
    });

    it('getDaysRemaining 过期应返回 0', () => {
      const past = new Date(Date.now() - 86400000).toISOString();
      expect(getDaysRemaining(past)).toBe(0);
    });

    it('formatExpiry 应返回中文描述', () => {
      const expired = new Date(Date.now() - 86400000).toISOString();
      expect(formatExpiry(expired)).toBe('已过期');

      const tomorrow = new Date(Date.now() + 86400000).toISOString();
      expect(formatExpiry(tomorrow)).toContain('天');
    });
  });
});
