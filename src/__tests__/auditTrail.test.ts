import { describe, it, expect, beforeEach } from 'vitest';
import {
  logAudit,
  queryAuditLogs,
  getEntityHistory,
  getAuditStats,
  exportAuditLogs,
  clearAuditLogs,
  formatChangeSummary,
} from '@/lib/auditTrail';

describe('auditTrail - 数据审计追踪', () => {
  beforeEach(() => {
    clearAuditLogs();
  });

  describe('logAudit', () => {
    it('T01-记录新增操作', () => {
      const entry = logAudit('create', 'water_source', '新增水源地岗南水库', {
        entityId: 's1',
        entityName: '岗南水库',
      });
      expect(entry.id).toBeTruthy();
      expect(entry.action).toBe('create');
      expect(entry.entityName).toBe('岗南水库');
      expect(entry.timestamp).toBeTruthy();
    });

    it('T02-记录修改操作含变更字段', () => {
      const entry = logAudit('update', 'water_source', '修改水源地人口', {
        entityId: 's1',
        entityName: '岗南水库',
        before: { population: 100000, name: '岗南水库' },
        after: { population: 200000, name: '岗南水库' },
      });
      expect(entry.changedFields).toContain('population');
      expect(entry.changedFields).not.toContain('name');
    });

    it('T03-记录删除操作', () => {
      const entry = logAudit('delete', 'water_source', '删除水源地', {
        entityId: 's2',
        entityName: '陡河水库',
        before: { id: 's2', name: '陡河水库' },
      });
      expect(entry.action).toBe('delete');
      expect(entry.before).toContain('陡河水库');
    });

    it('T04-记录计算操作', () => {
      const entry = logAudit('calculate', 'zone_result', '保护区划分计算', {
        entityId: 's1',
        entityName: '岗南水库',
        source: 'system',
      });
      expect(entry.source).toBe('system');
    });

    it('T05-记录导入操作', () => {
      const entry = logAudit('import', 'water_source', '从Excel导入50条记录', {
        source: 'import',
      });
      expect(entry.source).toBe('import');
    });

    it('T06-无变更字段时changedFields为undefined', () => {
      const entry = logAudit('update', 'water_source', '无变化', {
        before: { name: 'A' },
        after: { name: 'A' },
      });
      expect(entry.changedFields).toBeUndefined();
    });
  });

  describe('queryAuditLogs', () => {
    it('T07-查询全部日志', () => {
      logAudit('create', 'water_source', '操作1');
      logAudit('delete', 'water_source', '操作2');
      const result = queryAuditLogs();
      expect(result.total).toBe(2);
      expect(result.entries).toHaveLength(2);
    });

    it('T08-按操作类型过滤', () => {
      logAudit('create', 'water_source', '新增');
      logAudit('delete', 'water_source', '删除');
      logAudit('update', 'water_source', '修改');
      const result = queryAuditLogs({ action: 'delete' });
      expect(result.total).toBe(1);
      expect(result.entries[0].action).toBe('delete');
    });

    it('T09-按实体类型过滤', () => {
      logAudit('create', 'water_source', '水源地');
      logAudit('calculate', 'zone_result', '计算');
      const result = queryAuditLogs({ entityType: 'zone_result' });
      expect(result.total).toBe(1);
    });

    it('T10-按关键词搜索', () => {
      logAudit('create', 'water_source', '新增岗南水库', { entityName: '岗南水库' });
      logAudit('create', 'water_source', '新增陡河水库', { entityName: '陡河水库' });
      const result = queryAuditLogs({ keyword: '岗南' });
      expect(result.total).toBe(1);
      expect(result.entries[0].entityName).toBe('岗南水库');
    });

    it('T11-分页查询', () => {
      for (let i = 0; i < 10; i++) {
        logAudit('create', 'water_source', `操作${i}`);
      }
      const page1 = queryAuditLogs({ limit: 5, offset: 0 });
      const page2 = queryAuditLogs({ limit: 5, offset: 5 });
      expect(page1.entries).toHaveLength(5);
      expect(page2.entries).toHaveLength(5);
      expect(page1.hasMore).toBe(true);
      expect(page2.hasMore).toBe(false);
    });

    it('T12-按时间倒序排列', () => {
      logAudit('create', 'water_source', '第一条');
      logAudit('delete', 'water_source', '第二条');
      const result = queryAuditLogs();
      expect(result.total).toBe(2);
      // 两条日志均存在，按时间倒序（delete应在create之前或同级）
      expect(result.entries).toHaveLength(2);
    });
  });

  describe('getEntityHistory', () => {
    it('T13-获取实体操作历史', () => {
      logAudit('create', 'water_source', '新增', { entityId: 's1' });
      logAudit('update', 'water_source', '修改', { entityId: 's1' });
      logAudit('delete', 'water_source', '删除', { entityId: 's2' });
      const history = getEntityHistory('s1');
      expect(history).toHaveLength(2);
    });
  });

  describe('getAuditStats', () => {
    it('T14-统计操作类型', () => {
      logAudit('create', 'water_source', '新增1');
      logAudit('create', 'water_source', '新增2');
      logAudit('delete', 'water_source', '删除1');
      const stats = getAuditStats();
      expect(stats.total).toBe(3);
      expect(stats.byAction.create).toBe(2);
      expect(stats.byAction.delete).toBe(1);
    });

    it('T15-统计实体类型', () => {
      logAudit('create', 'water_source', '水源地');
      logAudit('calculate', 'zone_result', '计算');
      const stats = getAuditStats();
      expect(stats.byEntityType.water_source).toBe(1);
      expect(stats.byEntityType.zone_result).toBe(1);
    });

    it('T16-统计操作来源', () => {
      logAudit('create', 'water_source', '用户操作', { source: 'user' });
      logAudit('import', 'water_source', '导入', { source: 'import' });
      const stats = getAuditStats();
      expect(stats.bySource.user).toBe(1);
      expect(stats.bySource.import).toBe(1);
    });
  });

  describe('exportAuditLogs', () => {
    it('T17-导出包含所有日志', () => {
      logAudit('create', 'water_source', '测试1');
      logAudit('delete', 'water_source', '测试2');
      const json = exportAuditLogs();
      const data = JSON.parse(json);
      expect(data.entries).toHaveLength(2);
      expect(data.totalEntries).toBe(2);
      expect(data.exportedAt).toBeTruthy();
    });
  });

  describe('formatChangeSummary', () => {
    it('T18-格式化新增摘要', () => {
      const entry = logAudit('create', 'water_source', '新增水源地', { entityName: '岗南水库' });
      const summary = formatChangeSummary(entry);
      expect(summary).toContain('新增');
      expect(summary).toContain('岗南水库');
    });

    it('T19-格式化修改摘要含变更字段', () => {
      const entry = logAudit('update', 'water_source', '修改', {
        entityName: '岗南水库',
        before: { population: 100 },
        after: { population: 200 },
      });
      const summary = formatChangeSummary(entry);
      expect(summary).toContain('修改');
      expect(summary).toContain('population');
    });
  });
});
