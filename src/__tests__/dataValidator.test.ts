import { describe, it, expect } from 'vitest';
import { validateWaterSources, quickValidate, checkDuplicates } from '../lib/dataValidator';
import type { WaterSourceInfo } from '@/types';

const validSource: WaterSourceInfo = {
  name: '岗南水库',
  type: '地表水',
  subType: '湖库型',
  county: '平山县',
  status: '在用',
  remark: '石家庄主城区主要水源',
};

const makeSources = (...overrides: Partial<WaterSourceInfo>[]): WaterSourceInfo[] =>
  overrides.map((o) => ({ ...validSource, ...o }));

describe('dataValidator', () => {
  describe('validateWaterSources', () => {
    it('应该通过有效数据', () => {
      const result = validateWaterSources([validSource]);
      expect(result.valid).toBe(true);
    });

    it('应该检测到缺少名称', () => {
      const data = makeSources({ name: '' });
      const result = validateWaterSources(data);
      expect(result.valid).toBe(false);
      expect(result.summary.errors).toBeGreaterThanOrEqual(1);
      expect(result.items.some((i) => i.rule === 'name_required')).toBe(true);
    });

    it('应该检测到无效的水源类型', () => {
      const data = makeSources({ type: '海水' as '地表水' });
      const result = validateWaterSources(data);
      expect(result.valid).toBe(false);
      expect(result.items.some((i) => i.rule === 'type_valid')).toBe(true);
    });

    it('应该警告缺少县区', () => {
      const data = makeSources({ county: '未知' });
      const result = validateWaterSources(data);
      // 缺少县区不是error，是warning，所以valid仍为true
      expect(result.valid).toBe(true);
      expect(result.items.some((i) => i.rule === 'county_required')).toBe(true);
    });

    it('应该检测到无效的使用状态', () => {
      const data = makeSources({ status: '未知' as '在用' });
      const result = validateWaterSources(data);
      expect(result.valid).toBe(false);
      expect(result.items.some((i) => i.rule === 'status_valid')).toBe(true);
    });

    it('应该检测到名称重复', () => {
      const data = makeSources({ name: '重复水源地' }, { name: '重复水源地' });
      const result = validateWaterSources(data);
      expect(result.items.some((i) => i.rule === 'name_duplicate')).toBe(true);
    });

    it('应该警告名称过长', () => {
      const data = makeSources({ name: 'A'.repeat(101) });
      const result = validateWaterSources(data);
      expect(result.items.some((i) => i.rule === 'name_length')).toBe(true);
    });

    it('应该info级别提醒细分类型过长', () => {
      const data = makeSources({ subType: 'A'.repeat(51) });
      const result = validateWaterSources(data);
      expect(result.items.some((i) => i.rule === 'subtype_length')).toBe(true);
    });

    it('应该info级别提醒备注过长', () => {
      const data = makeSources({ remark: 'A'.repeat(501) });
      const result = validateWaterSources(data);
      expect(result.items.some((i) => i.rule === 'remark_length')).toBe(true);
    });

    it('应该正确处理多条数据多种问题', () => {
      const data = makeSources(
        { name: '', type: '地表水', county: '长安区', status: '在用' },
        { name: '有效水源地', type: '地表水', county: '长安区', status: '在用' },
        { name: '无效类型', type: '海水' as '地表水', county: '长安区', status: '在用' },
        { name: '重复名称', type: '地下水', county: '长安区', status: '在用' },
        { name: '重复名称', type: '地下水', county: '长安区', status: '在用' },
      );
      const result = validateWaterSources(data);
      expect(result.valid).toBe(false);
      expect(result.summary.errors).toBeGreaterThanOrEqual(1);
    });

    it('应该生成正确的按规则分组统计', () => {
      const data = makeSources(
        { name: '', type: '海水' as '地表水', county: '长安区', status: '在用' },
        { name: '', type: '地下水', county: '长安区', status: '在用' },
      );
      const result = validateWaterSources(data);
      expect(result.summary.failedByRule['name_required']).toBe(2);
      expect(result.summary.failedByRule['type_valid']).toBe(1);
    });
  });

  describe('quickValidate', () => {
    it('应该通过有效数据', () => {
      const result = quickValidate([validSource]);
      expect(result.valid).toBe(true);
    });

    it('应该检测到缺失名称', () => {
      const data = makeSources({ name: '' });
      const result = quickValidate(data);
      expect(result.valid).toBe(false);
      expect(result.missingNames.length).toBeGreaterThan(0);
    });

    it('应该检测到无效类型', () => {
      const data = makeSources({ type: '海水' as '地表水' });
      const result = quickValidate(data);
      expect(result.valid).toBe(false);
      expect(result.invalidTypes.length).toBeGreaterThan(0);
    });

    it('应该检测到无效状态', () => {
      const data = makeSources({ status: '未知' as '在用' });
      const result = quickValidate(data);
      expect(result.valid).toBe(false);
      expect(result.invalidStatuses.length).toBeGreaterThan(0);
    });
  });

  describe('checkDuplicates', () => {
    it('应该检测到与已有数据重复', () => {
      const existing: WaterSourceInfo[] = [validSource];
      const newData = makeSources(
        { name: '岗南水库', type: '地表水', county: '平山县', status: '在用' },
        { name: '新水源地', type: '地下水', county: '长安区', status: '在用' },
      );
      const result = checkDuplicates(newData, existing);
      expect(result.duplicate.length).toBe(1);
      expect(result.unique.length).toBe(1);
      expect(result.duplicate[0].name).toBe('岗南水库');
      expect(result.unique[0].name).toBe('新水源地');
    });

    it('没有重复时返回空数组', () => {
      const existing: WaterSourceInfo[] = [validSource];
      const newData = makeSources({ name: '新水源地' });
      const result = checkDuplicates(newData, existing);
      expect(result.duplicate.length).toBe(0);
      expect(result.unique.length).toBe(1);
    });

    it('全部重复时', () => {
      const existing: WaterSourceInfo[] = [validSource, { ...validSource, name: '水源地B' }];
      const newData = makeSources({ name: '岗南水库' }, { name: '水源地B' });
      const result = checkDuplicates(newData, existing);
      expect(result.duplicate.length).toBe(2);
      expect(result.unique.length).toBe(0);
    });
  });
});
