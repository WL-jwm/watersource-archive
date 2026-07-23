import { describe, it, expect } from 'vitest';
import { diffVersions, formatAction, formatVersionTime } from '../lib/dataVersionEngine';

describe('dataVersionEngine', () => {
  describe('diffVersions', () => {
    const oldData = [
      { id: '1', name: '水源地A', type: '地下水', county: '长安区', status: '在用' },
      { id: '2', name: '水源地B', type: '地表水', county: '平山县', status: '在用' },
      { id: '3', name: '水源地C', type: '地下水', county: '长安区', status: '备用' },
    ];

    it('相同数据应返回无差异', () => {
      const result = diffVersions(oldData, [...oldData]);
      expect(result.added.length).toBe(0);
      expect(result.removed.length).toBe(0);
      expect(result.modified.length).toBe(0);
      expect(result.unchanged).toBe(3);
    });

    it('应检测到新增记录', () => {
      const newData = [
        ...oldData,
        { id: '4', name: '水源地D', type: '地下水', county: '裕华区', status: '在用' },
      ];
      const result = diffVersions(oldData, newData);
      expect(result.added.length).toBe(1);
      expect(result.added[0].name).toBe('水源地D');
      expect(result.removed.length).toBe(0);
    });

    it('应检测到删除记录', () => {
      const newData = oldData.slice(0, 2);
      const result = diffVersions(oldData, newData);
      expect(result.removed.length).toBe(1);
      expect(result.removed[0].name).toBe('水源地C');
      expect(result.added.length).toBe(0);
    });

    it('应检测到修改记录', () => {
      const newData = oldData.map((d) =>
        d.id === '1' ? { ...d, status: '备用', remark: '已变更' } : d,
      );
      const result = diffVersions(oldData, newData);
      expect(result.modified.length).toBe(1);
      expect(result.modified[0].name).toBe('水源地A');
      expect(result.modified[0].changes.length).toBe(2);
      expect(result.modified[0].changes.some((c) => c.field === 'status')).toBe(true);
      expect(result.modified[0].changes.some((c) => c.field === 'remark')).toBe(true);
    });

    it('应同时检测到新增+删除+修改', () => {
      const newData = [
        { id: '1', name: '水源地A', type: '地下水', county: '长安区', status: '取消' },
        { id: '3', name: '水源地C', type: '地下水', county: '长安区', status: '备用' },
        { id: '4', name: '水源地D', type: '地表水', county: '平山县', status: '在用' },
      ];
      const result = diffVersions(oldData, newData);
      expect(result.added.length).toBe(1); // D
      expect(result.removed.length).toBe(1); // B
      expect(result.modified.length).toBe(1); // A (status changed)
    });

    it('应忽略 id 和 dataVersion 字段变化', () => {
      const newData = oldData.map((d) => ({ ...d, dataVersion: 2 }));
      const result = diffVersions(oldData, newData);
      expect(result.modified.length).toBe(0);
    });

    it('应处理空数据', () => {
      const result = diffVersions([], []);
      expect(result.added.length).toBe(0);
      expect(result.removed.length).toBe(0);
      expect(result.modified.length).toBe(0);
      expect(result.unchanged).toBe(0);
    });

    it('应从空到有数据', () => {
      const result = diffVersions([], oldData);
      expect(result.added.length).toBe(3);
      expect(result.removed.length).toBe(0);
    });
  });

  describe('formatAction', () => {
    it('应正确格式化', () => {
      expect(formatAction('add')).toBe('新增');
      expect(formatAction('update')).toBe('修改');
      expect(formatAction('delete')).toBe('删除');
      expect(formatAction('unknown')).toBe('unknown');
    });
  });

  describe('formatVersionTime', () => {
    it('应正确格式化ISO时间', () => {
      const result = formatVersionTime('2026-07-23T10:30:00.000Z');
      expect(result).toContain('2026');
      expect(result).toContain('07');
      expect(result).toContain('23');
    });
  });
});
