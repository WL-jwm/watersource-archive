/* ===== S11.2: 冲突检测引擎测试 ===== */
import { describe, it, expect } from 'vitest';
import { detectConflicts, getConflictTypeLabel, getConflictTypeColor } from '@/lib/conflictDetector';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';

// 测试数据工厂
function makeRecord(overrides: Partial<WaterSourceRecord> = {}): WaterSourceRecord {
  return {
    id: 'test-1',
    cityName: '石家庄市',
    level: 'municipal',
    name: '黄壁庄水库',
    type: '地表水',
    county: '平山县',
    status: '在用',
    dataVersion: 1,
    ...overrides,
  };
}

describe('conflictDetector', () => {
  // ===== detectConflicts — 基本功能 =====
  describe('detectConflicts', () => {
    it('空导入列表应返回零冲突', () => {
      const existing = [makeRecord()];
      const report = detectConflicts([], existing);
      expect(report.conflictCount).toBe(0);
      expect(report.newCount).toBe(0);
    });

    it('空已有数据应全部为新增', () => {
      const imports: Partial<WaterSourceRecord>[] = [
        { name: '水源A', cityName: '石家庄市', level: 'municipal', type: '地下水' },
        { name: '水源B', cityName: '保定市', level: 'county', type: '地表水' },
      ];
      const report = detectConflicts(imports, []);
      expect(report.conflictCount).toBe(0);
      expect(report.newCount).toBe(2);
    });

    it('完全无冲突时应全部标记为新增', () => {
      const existing = [makeRecord({ name: '已有水源', id: 'existing-1' })];
      const imports: Partial<WaterSourceRecord>[] = [
        { name: '新水源A', cityName: '唐山市', level: 'county', type: '地下水' },
        { name: '新水源B', cityName: '保定市', level: 'county', type: '地表水' },
      ];
      const report = detectConflicts(imports, existing);
      expect(report.conflictCount).toBe(0);
      expect(report.newCount).toBe(2);
    });
  });

  // ===== ID 匹配 =====
  describe('ID 匹配', () => {
    it('相同 ID 应检测为冲突', () => {
      const existing = [makeRecord({ id: 'rec-001', name: '水源一' })];
      const imports: Partial<WaterSourceRecord>[] = [
        { id: 'rec-001', name: '水源一(更新)', cityName: '石家庄市', level: 'municipal', type: '地下水' },
      ];
      const report = detectConflicts(imports, existing);
      expect(report.conflictCount).toBe(1);
      expect(report.conflicts[0].type).toBe('id');
      expect(report.byType.id).toBe(1);
    });

    it('不同 ID 不应匹配', () => {
      const existing = [makeRecord({ id: 'rec-001', name: '水源一' })];
      const imports: Partial<WaterSourceRecord>[] = [
        { id: 'rec-002', name: '水源一', cityName: '石家庄市', level: 'municipal', type: '地下水' },
      ];
      const report = detectConflicts(imports, existing);
      // 名称+城市也匹配，所以应该是 name_city 冲突
      expect(report.conflictCount).toBe(1);
      expect(report.conflicts[0].type).toBe('name_city');
    });
  });

  // ===== 名称+城市匹配 =====
  describe('名称+城市匹配', () => {
    it('相同名称+相同城市应检测为冲突', () => {
      const existing = [makeRecord({ name: '岗南水库', cityName: '石家庄市' })];
      const imports: Partial<WaterSourceRecord>[] = [
        { name: '岗南水库', cityName: '石家庄市', level: 'municipal', type: '地表水' },
      ];
      const report = detectConflicts(imports, existing);
      expect(report.conflictCount).toBe(1);
      expect(report.conflicts[0].type).toBe('name_city');
    });

    it('相同名称+不同城市不应算冲突', () => {
      const existing = [makeRecord({ name: '清水河水源', cityName: '石家庄市' })];
      const imports: Partial<WaterSourceRecord>[] = [
        { name: '清水河水源', cityName: '保定市', level: 'county', type: '地下水' },
      ];
      const report = detectConflicts(imports, existing);
      expect(report.conflictCount).toBe(0);
      expect(report.newCount).toBe(1);
    });
  });

  // ===== 仅名称匹配 =====
  describe('仅名称匹配', () => {
    it('有名称无城市时应按名称匹配', () => {
      const existing = [makeRecord({ name: '某水源地', cityName: '石家庄市' })];
      const imports: Partial<WaterSourceRecord>[] = [
        { name: '某水源地', level: 'municipal', type: '地下水' } as Partial<WaterSourceRecord>,
      ];
      const report = detectConflicts(imports, existing);
      expect(report.conflictCount).toBe(1);
      expect(report.conflicts[0].type).toBe('name_only');
    });
  });

  // ===== 字段差异计算 =====
  describe('字段差异', () => {
    it('应正确识别变更字段', () => {
      const existing = [makeRecord({
        name: '测试水源',
        cityName: '石家庄市',
        level: 'municipal',
        type: '地下水',
        county: '平山县',
        status: '在用',
        population: 10000,
      })];
      const imports: Partial<WaterSourceRecord>[] = [
        {
          name: '测试水源',
          cityName: '石家庄市',
          level: 'municipal',
          type: '地下水',
          county: '平山县',
          status: '备用',
          population: 20000,
        },
      ];
      const report = detectConflicts(imports, existing);
      expect(report.conflictCount).toBe(1);
      const diffs = report.conflicts[0].fieldDiffs;
      expect(diffs.length).toBe(2);
      expect(diffs.some((d) => d.field === 'status')).toBe(true);
      expect(diffs.some((d) => d.field === 'population')).toBe(true);
    });

    it('完全相同的记录不应有字段差异', () => {
      const existing = [makeRecord({
        name: '测试水源',
        cityName: '石家庄市',
        level: 'municipal',
        type: '地下水',
        county: '平山县',
        status: '在用',
      })];
      const imports: Partial<WaterSourceRecord>[] = [
        {
          name: '测试水源',
          cityName: '石家庄市',
          level: 'municipal',
          type: '地下水',
          county: '平山县',
          status: '在用',
        },
      ];
      const report = detectConflicts(imports, existing);
      expect(report.conflictCount).toBe(1);
      expect(report.conflicts[0].fieldDiffs.length).toBe(0);
    });
  });

  // ===== 混合场景 =====
  describe('混合场景', () => {
    it('应正确处理部分冲突的批量导入', () => {
      const existing = [
        makeRecord({ id: 'r1', name: '水源A', cityName: '石家庄市' }),
        makeRecord({ id: 'r2', name: '水源B', cityName: '保定市' }),
      ];
      const imports: Partial<WaterSourceRecord>[] = [
        { name: '水源A', cityName: '石家庄市', level: 'municipal', type: '地下水' }, // 冲突
        { name: '水源C', cityName: '唐山市', level: 'county', type: '地表水' },     // 新增
        { id: 'r2', name: '水源B', cityName: '保定市', level: 'county', type: '地表水' }, // ID冲突
        { name: '水源D', cityName: '邯郸市', level: 'county', type: '地下水' },     // 新增
      ];
      const report = detectConflicts(imports, existing);
      expect(report.conflictCount).toBe(2);
      expect(report.newCount).toBe(2);
      expect(report.byType.name_city).toBe(1);
      expect(report.byType.id).toBe(1);
    });
  });

  // ===== 辅助函数 =====
  describe('辅助函数', () => {
    it('getConflictTypeLabel 应返回中文标签', () => {
      expect(getConflictTypeLabel('id')).toBe('ID匹配');
      expect(getConflictTypeLabel('name_city')).toBe('名称+城市匹配');
      expect(getConflictTypeLabel('name_only')).toBe('仅名称匹配');
      expect(getConflictTypeLabel('none')).toBe('无冲突');
    });

    it('getConflictTypeColor 应返回颜色类名', () => {
      expect(getConflictTypeColor('id')).toContain('red');
      expect(getConflictTypeColor('name_city')).toContain('orange');
      expect(getConflictTypeColor('none')).toContain('green');
    });
  });
});
