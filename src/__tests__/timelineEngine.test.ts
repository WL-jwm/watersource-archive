/* ===== S11.11: 时间线引擎测试 ===== */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dataVersionEngine
vi.mock('@/lib/dataVersionEngine', () => ({
  getAllChangeLogs: vi.fn().mockResolvedValue([]),
  listVersions: vi.fn().mockResolvedValue([]),
}));

// Mock auditTrail
vi.mock('@/lib/auditTrail', () => ({
  queryAuditLogs: vi.fn().mockReturnValue({ entries: [], total: 0 }),
}));

import {
  filterTimeline,
  groupByDate,
  computeTimelineStats,
  formatTimelineType,
  formatTimelineTypeColor,
  type TimelineEntry,
} from '@/lib/timelineEngine';

function makeEntry(overrides: Partial<TimelineEntry> = {}): TimelineEntry {
  return {
    id: 'entry-1',
    type: 'change',
    timestamp: '2024-06-01T10:00:00.000Z',
    title: '测试条目',
    description: '测试描述',
    ...overrides,
  };
}

describe('timelineEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===== filterTimeline =====
  describe('filterTimeline', () => {
    it('按类型筛选', () => {
      const entries = [
        makeEntry({ id: '1', type: 'change' }),
        makeEntry({ id: '2', type: 'audit' }),
        makeEntry({ id: '3', type: 'version' }),
      ];
      const result = filterTimeline(entries, { types: ['change'] });
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('change');
    });

    it('按多个类型筛选', () => {
      const entries = [
        makeEntry({ id: '1', type: 'change' }),
        makeEntry({ id: '2', type: 'audit' }),
        makeEntry({ id: '3', type: 'version' }),
      ];
      const result = filterTimeline(entries, { types: ['change', 'audit'] });
      expect(result).toHaveLength(2);
    });

    it('按日期范围筛选', () => {
      const entries = [
        makeEntry({ id: '1', timestamp: '2024-06-01T10:00:00.000Z' }),
        makeEntry({ id: '2', timestamp: '2024-06-05T10:00:00.000Z' }),
        makeEntry({ id: '3', timestamp: '2024-06-10T10:00:00.000Z' }),
      ];
      const result = filterTimeline(entries, {
        startDate: '2024-06-03',
        endDate: '2024-06-08',
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });

    it('按实体名称筛选', () => {
      const entries = [
        makeEntry({ id: '1', entityName: '岗南水库' }),
        makeEntry({ id: '2', entityName: '黄壁庄水库' }),
      ];
      const result = filterTimeline(entries, { entityName: '岗南' });
      expect(result).toHaveLength(1);
      expect(result[0].entityName).toBe('岗南水库');
    });

    it('按动作筛选', () => {
      const entries = [
        makeEntry({ id: '1', action: 'add' }),
        makeEntry({ id: '2', action: 'delete' }),
      ];
      const result = filterTimeline(entries, { action: 'add' });
      expect(result).toHaveLength(1);
    });

    it('空筛选返回全部', () => {
      const entries = [makeEntry(), makeEntry({ id: '2' })];
      const result = filterTimeline(entries, {});
      expect(result).toHaveLength(2);
    });
  });

  // ===== groupByDate =====
  describe('groupByDate', () => {
    it('按日期分组', () => {
      const entries = [
        makeEntry({ id: '1', timestamp: '2024-06-01T10:00:00.000Z' }),
        makeEntry({ id: '2', timestamp: '2024-06-01T14:00:00.000Z' }),
        makeEntry({ id: '3', timestamp: '2024-06-02T10:00:00.000Z' }),
      ];
      const groups = groupByDate(entries);
      expect(groups).toHaveLength(2);
      expect(groups[0].date).toBe('2024-06-02'); // 倒序
      expect(groups[0].entries).toHaveLength(1);
      expect(groups[1].date).toBe('2024-06-01');
      expect(groups[1].entries).toHaveLength(2);
    });

    it('空列表返回空数组', () => {
      const groups = groupByDate([]);
      expect(groups).toHaveLength(0);
    });

    it('同一天的多条记录归入同一组', () => {
      const entries = [
        makeEntry({ id: '1', timestamp: '2024-06-01T01:00:00.000Z' }),
        makeEntry({ id: '2', timestamp: '2024-06-01T12:00:00.000Z' }),
        makeEntry({ id: '3', timestamp: '2024-06-01T23:00:00.000Z' }),
      ];
      const groups = groupByDate(entries);
      expect(groups).toHaveLength(1);
      expect(groups[0].entries).toHaveLength(3);
    });
  });

  // ===== computeTimelineStats =====
  describe('computeTimelineStats', () => {
    it('正确统计类型分布', () => {
      const entries = [
        makeEntry({ type: 'change' }),
        makeEntry({ type: 'change' }),
        makeEntry({ type: 'audit' }),
        makeEntry({ type: 'version' }),
      ];
      const stats = computeTimelineStats(entries);
      expect(stats.total).toBe(4);
      expect(stats.byType.change).toBe(2);
      expect(stats.byType.audit).toBe(1);
      expect(stats.byType.version).toBe(1);
    });

    it('正确统计动作分布', () => {
      const entries = [
        makeEntry({ action: 'add' }),
        makeEntry({ action: 'add' }),
        makeEntry({ action: 'delete' }),
      ];
      const stats = computeTimelineStats(entries);
      expect(stats.byAction.add).toBe(2);
      expect(stats.byAction.delete).toBe(1);
    });

    it('正确统计日期分布', () => {
      const entries = [
        makeEntry({ timestamp: '2024-06-01T10:00:00.000Z' }),
        makeEntry({ timestamp: '2024-06-01T14:00:00.000Z' }),
        makeEntry({ timestamp: '2024-06-02T10:00:00.000Z' }),
      ];
      const stats = computeTimelineStats(entries);
      expect(stats.byDate).toHaveLength(2);
      expect(stats.byDate[0].date).toBe('2024-06-02');
      expect(stats.byDate[0].count).toBe(1);
      expect(stats.byDate[1].count).toBe(2);
    });

    it('空列表返回零值', () => {
      const stats = computeTimelineStats([]);
      expect(stats.total).toBe(0);
      expect(stats.byType.change).toBe(0);
      expect(stats.byType.audit).toBe(0);
      expect(stats.byType.version).toBe(0);
    });
  });

  // ===== 格式化函数 =====
  describe('formatTimelineType', () => {
    it('change 格式化为 数据变更', () => {
      expect(formatTimelineType('change')).toBe('数据变更');
    });
    it('audit 格式化为 操作审计', () => {
      expect(formatTimelineType('audit')).toBe('操作审计');
    });
    it('version 格式化为 版本快照', () => {
      expect(formatTimelineType('version')).toBe('版本快照');
    });
  });

  describe('formatTimelineTypeColor', () => {
    it('change 返回蓝色', () => {
      expect(formatTimelineTypeColor('change')).toContain('blue');
    });
    it('audit 返回琥珀色', () => {
      expect(formatTimelineTypeColor('audit')).toContain('amber');
    });
    it('version 返回绿色', () => {
      expect(formatTimelineTypeColor('version')).toContain('green');
    });
  });
});
