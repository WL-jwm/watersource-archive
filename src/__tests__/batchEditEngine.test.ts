/* ===== S11.9: 批量编辑引擎测试 ===== */
import { describe, expect, it } from 'vitest';
import {
  createBatchEditPlan,
  applyBatchEdit,
  formatLevelValue,
  BATCH_EDITABLE_FIELDS,
} from '@/lib/batchEditEngine';
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

describe('batchEditEngine', () => {
  // ===== BATCH_EDITABLE_FIELDS =====
  describe('BATCH_EDITABLE_FIELDS', () => {
    it('包含8个可编辑字段', () => {
      expect(BATCH_EDITABLE_FIELDS).toHaveLength(8);
    });

    it('包含 cityName 文本字段', () => {
      const field = BATCH_EDITABLE_FIELDS.find((f) => f.field === 'cityName');
      expect(field).toBeDefined();
      expect(field?.type).toBe('text');
      expect(field?.label).toBe('城市');
    });

    it('level 字段为 select 类型且有选项', () => {
      const field = BATCH_EDITABLE_FIELDS.find((f) => f.field === 'level');
      expect(field?.type).toBe('select');
      expect(field?.options).toEqual(['municipal', 'county', 'township']);
    });

    it('status 字段包含5种状态选项', () => {
      const field = BATCH_EDITABLE_FIELDS.find((f) => f.field === 'status');
      expect(field?.options).toHaveLength(5);
      expect(field?.options).toContain('在用');
      expect(field?.options).toContain('备用');
    });

    it('population 字段为 number 类型', () => {
      const field = BATCH_EDITABLE_FIELDS.find((f) => f.field === 'population');
      expect(field?.type).toBe('number');
    });
  });

  // ===== createBatchEditPlan =====
  describe('createBatchEditPlan', () => {
    it('创建包含正确ID和更新的计划', () => {
      const plan = createBatchEditPlan(['id-1', 'id-2'], { status: '备用' });

      expect(plan.ids).toEqual(['id-1', 'id-2']);
      expect(plan.updates).toEqual({ status: '备用' });
      expect(plan.affectedCount).toBe(2);
    });

    it('单个ID的计划', () => {
      const plan = createBatchEditPlan(['only-id'], { county: '鹿泉区' });

      expect(plan.affectedCount).toBe(1);
      expect(plan.updates.county).toBe('鹿泉区');
    });

    it('空ID列表创建零影响计划', () => {
      const plan = createBatchEditPlan([], { status: '在用' });

      expect(plan.affectedCount).toBe(0);
      expect(plan.ids).toHaveLength(0);
    });

    it('多字段同时更新', () => {
      const plan = createBatchEditPlan(['id-1'], {
        status: '备用',
        county: '正定县',
        level: 'county',
      });

      expect(Object.keys(plan.updates)).toHaveLength(3);
    });
  });

  // ===== applyBatchEdit =====
  describe('applyBatchEdit', () => {
    it('更新匹配ID的记录', () => {
      const records = [
        makeRecord({ id: 'a' }),
        makeRecord({ id: 'b' }),
        makeRecord({ id: 'c' }),
      ];
      const plan = createBatchEditPlan(['a', 'c'], { status: '备用' });

      const result = applyBatchEdit(records, plan);

      expect(result[0].status).toBe('备用');
      expect(result[1].status).toBe('在用'); // 未选中
      expect(result[2].status).toBe('备用');
    });

    it('不修改未选中的记录', () => {
      const records = [makeRecord({ id: 'a', county: '平山县' })];
      const plan = createBatchEditPlan(['nonexistent'], { county: '鹿泉区' });

      const result = applyBatchEdit(records, plan);
      expect(result[0].county).toBe('平山县');
    });

    it('保留原始记录中未更新的字段', () => {
      const records = [makeRecord({ id: 'a', name: '岗南水库', type: '地表水' })];
      const plan = createBatchEditPlan(['a'], { status: '规划' });

      const result = applyBatchEdit(records, plan);
      expect(result[0].name).toBe('岗南水库');
      expect(result[0].type).toBe('地表水');
      expect(result[0].status).toBe('规划');
    });

    it('空计划不影响任何记录', () => {
      const records = [makeRecord({ id: 'a' }), makeRecord({ id: 'b' })];
      const plan = createBatchEditPlan([], { status: '备用' });

      const result = applyBatchEdit(records, plan);
      expect(result[0].status).toBe('在用');
      expect(result[1].status).toBe('在用');
    });

    it('空记录列表返回空列表', () => {
      const plan = createBatchEditPlan(['a'], { status: '备用' });
      const result = applyBatchEdit([], plan);
      expect(result).toHaveLength(0);
    });

    it('所有记录都被选中时全部更新', () => {
      const records = [
        makeRecord({ id: 'a', level: 'municipal' }),
        makeRecord({ id: 'b', level: 'county' }),
      ];
      const plan = createBatchEditPlan(['a', 'b'], { level: 'township' });

      const result = applyBatchEdit(records, plan);
      expect(result.every((r) => r.level === 'township')).toBe(true);
    });

    it('数字类型字段正确更新', () => {
      const records = [makeRecord({ id: 'a', population: 1000 })];
      const plan = createBatchEditPlan(['a'], { population: 5000 });

      const result = applyBatchEdit(records, plan);
      expect(result[0].population).toBe(5000);
    });

    it('不修改原始数组（返回新数组）', () => {
      const records = [makeRecord({ id: 'a', status: '在用' })];
      const plan = createBatchEditPlan(['a'], { status: '备用' });

      const result = applyBatchEdit(records, plan);
      expect(records[0].status).toBe('在用'); // 原数组不变
      expect(result[0].status).toBe('备用');
    });
  });

  // ===== formatLevelValue =====
  describe('formatLevelValue', () => {
    it('municipal 格式化为 市级', () => {
      expect(formatLevelValue('municipal')).toBe('市级');
    });

    it('county 格式化为 县级', () => {
      expect(formatLevelValue('county')).toBe('县级');
    });

    it('township 格式化为 乡镇级', () => {
      expect(formatLevelValue('township')).toBe('乡镇级');
    });

    it('未知值原样返回', () => {
      expect(formatLevelValue('unknown')).toBe('unknown');
    });

    it('空字符串原样返回', () => {
      expect(formatLevelValue('')).toBe('');
    });
  });
});
