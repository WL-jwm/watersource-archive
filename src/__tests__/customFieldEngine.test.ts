/* ===== S11.6: 自定义字段引擎测试 ===== */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock idb 模块
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

import { dbGet, dbPut } from '@/lib/idb';
import {
  getAllCustomFields,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  reorderCustomFields,
  getCustomFieldValues,
  setCustomFieldValue,
  batchSetCustomField,
  validateCustomFields,
  computeFieldStats,
  type CustomFieldDef,
} from '@/lib/customFieldEngine';
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

function makeDef(overrides: Partial<CustomFieldDef> = {}): CustomFieldDef {
  return {
    id: 'cf-1',
    name: '联系人',
    key: 'cf_contact',
    type: 'text',
    required: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    order: 1,
    ...overrides,
  };
}

describe('customFieldEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===== getAllCustomFields =====
  describe('getAllCustomFields', () => {
    it('返回已排序的字段定义', async () => {
      const defs = [
        makeDef({ id: 'cf-2', name: '电话', order: 3 }),
        makeDef({ id: 'cf-1', name: '联系人', order: 1 }),
        makeDef({ id: 'cf-3', name: '地址', order: 2 }),
      ];
      vi.mocked(dbGet).mockResolvedValue({ key: 'custom_field_defs', value: defs });

      const result = await getAllCustomFields();
      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('联系人');
      expect(result[1].name).toBe('地址');
      expect(result[2].name).toBe('电话');
    });

    it('无数据时返回空数组', async () => {
      vi.mocked(dbGet).mockResolvedValue(null);
      const result = await getAllCustomFields();
      expect(result).toHaveLength(0);
    });
  });

  // ===== createCustomField =====
  describe('createCustomField', () => {
    it('创建文本字段', async () => {
      vi.mocked(dbGet).mockResolvedValue(null);
      vi.mocked(dbPut).mockResolvedValue(undefined);

      const def = await createCustomField('联系人', 'text', { required: true, description: '紧急联系人' });

      expect(def.name).toBe('联系人');
      expect(def.type).toBe('text');
      expect(def.required).toBe(true);
      expect(def.description).toBe('紧急联系人');
      expect(def.id).toContain('cf_');
      expect(def.order).toBe(1);
      expect(dbPut).toHaveBeenCalledOnce();
    });

    it('创建下拉选择字段并保存选项', async () => {
      vi.mocked(dbGet).mockResolvedValue(null);
      vi.mocked(dbPut).mockResolvedValue(undefined);

      const def = await createCustomField('水源状态', 'select', {
        options: ['优良', '良好', '较差'],
      });

      expect(def.type).toBe('select');
      expect(def.options).toEqual(['优良', '良好', '较差']);
    });

    it('select 类型无选项时默认空数组', async () => {
      vi.mocked(dbGet).mockResolvedValue(null);
      vi.mocked(dbPut).mockResolvedValue(undefined);

      const def = await createCustomField('测试', 'select');
      expect(def.options).toEqual([]);
    });

    it('新字段 order 自动递增', async () => {
      const existing = [makeDef({ order: 1 }), makeDef({ id: 'cf-2', order: 2 })];
      vi.mocked(dbGet).mockResolvedValue({ key: 'custom_field_defs', value: existing });
      vi.mocked(dbPut).mockResolvedValue(undefined);

      const def = await createCustomField('新字段', 'number');
      expect(def.order).toBe(3);
    });

    it('字段名空格被去除', async () => {
      vi.mocked(dbGet).mockResolvedValue(null);
      vi.mocked(dbPut).mockResolvedValue(undefined);

      const def = await createCustomField('  联系电话  ', 'text');
      expect(def.name).toBe('联系电话');
    });
  });

  // ===== updateCustomField =====
  describe('updateCustomField', () => {
    it('更新字段属性', async () => {
      const defs = [makeDef()];
      vi.mocked(dbGet).mockResolvedValue({ key: 'custom_field_defs', value: defs });
      vi.mocked(dbPut).mockResolvedValue(undefined);

      await updateCustomField('cf-1', { name: '紧急联系人', required: true });

      const saved = vi.mocked(dbPut).mock.calls[0][1] as { value: CustomFieldDef[] };
      expect(saved.value[0].name).toBe('紧急联系人');
      expect(saved.value[0].required).toBe(true);
    });

    it('更新字段名时同步更新 key', async () => {
      const defs = [makeDef()];
      vi.mocked(dbGet).mockResolvedValue({ key: 'custom_field_defs', value: defs });
      vi.mocked(dbPut).mockResolvedValue(undefined);

      await updateCustomField('cf-1', { name: '新英文名' });
      const saved = vi.mocked(dbPut).mock.calls[0][1] as { value: CustomFieldDef[] };
      expect(saved.value[0].key).not.toBe('cf_contact');
    });

    it('更新不存在的字段不写入', async () => {
      vi.mocked(dbGet).mockResolvedValue({ key: 'custom_field_defs', value: [] });
      vi.mocked(dbPut).mockResolvedValue(undefined);

      await updateCustomField('nonexistent', { name: 'test' });
      expect(dbPut).not.toHaveBeenCalled();
    });
  });

  // ===== deleteCustomField =====
  describe('deleteCustomField', () => {
    it('从列表中移除字段', async () => {
      const defs = [makeDef(), makeDef({ id: 'cf-2', name: '电话' })];
      vi.mocked(dbGet).mockResolvedValue({ key: 'custom_field_defs', value: defs });
      vi.mocked(dbPut).mockResolvedValue(undefined);

      await deleteCustomField('cf-1');
      const saved = vi.mocked(dbPut).mock.calls[0][1] as { value: CustomFieldDef[] };
      expect(saved.value).toHaveLength(1);
      expect(saved.value[0].id).toBe('cf-2');
    });
  });

  // ===== reorderCustomFields =====
  describe('reorderCustomFields', () => {
    it('按给定顺序重新排列', async () => {
      const defs = [
        makeDef({ id: 'a', order: 1 }),
        makeDef({ id: 'b', order: 2 }),
        makeDef({ id: 'c', order: 3 }),
      ];
      vi.mocked(dbGet).mockResolvedValue({ key: 'custom_field_defs', value: defs });
      vi.mocked(dbPut).mockResolvedValue(undefined);

      await reorderCustomFields(['c', 'a', 'b']);
      const saved = vi.mocked(dbPut).mock.calls[0][1] as { value: CustomFieldDef[] };
      const aDef = saved.value.find(d => d.id === 'a')!;
      const bDef = saved.value.find(d => d.id === 'b')!;
      const cDef = saved.value.find(d => d.id === 'c')!;
      expect(cDef.order).toBe(1);
      expect(aDef.order).toBe(2);
      expect(bDef.order).toBe(3);
    });
  });

  // ===== getCustomFieldValues =====
  describe('getCustomFieldValues', () => {
    it('返回字段定义和对应值', () => {
      const def = makeDef({ key: 'cf_contact' });
      const record = makeRecord();
      (record as unknown as Record<string, unknown>).customFields = { cf_contact: '张三' };

      const result = getCustomFieldValues(record, [def]);
      expect(result[0].def).toEqual(def);
      expect(result[0].value).toBe('张三');
    });

    it('无值时返回 undefined', () => {
      const def = makeDef({ key: 'cf_phone' });
      const record = makeRecord();

      const result = getCustomFieldValues(record, [def]);
      expect(result[0].value).toBeUndefined();
    });
  });

  // ===== setCustomFieldValue =====
  describe('setCustomFieldValue', () => {
    it('设置字段值', () => {
      const record = makeRecord();
      const result = setCustomFieldValue(record, 'cf_contact', '张三');
      const cf = (result as unknown as Record<string, unknown>).customFields as Record<string, string>;
      expect(cf.cf_contact).toBe('张三');
    });

    it('空值时删除字段', () => {
      const record = makeRecord();
      const withValue = setCustomFieldValue(record, 'cf_contact', '张三');
      const cleared = setCustomFieldValue(withValue, 'cf_contact', undefined);
      const cf = (cleared as unknown as Record<string, unknown>).customFields as Record<string, string>;
      expect(cf.cf_contact).toBeUndefined();
    });

    it('保留已有的其他字段值', () => {
      const record = makeRecord();
      const withA = setCustomFieldValue(record, 'cf_a', 'valueA');
      const withB = setCustomFieldValue(withA, 'cf_b', 'valueB');
      const cf = (withB as unknown as Record<string, unknown>).customFields as Record<string, string>;
      expect(cf.cf_a).toBe('valueA');
      expect(cf.cf_b).toBe('valueB');
    });

    it('不修改原始记录', () => {
      const record = makeRecord();
      setCustomFieldValue(record, 'cf_contact', '张三');
      const cf = (record as unknown as Record<string, unknown>).customFields as Record<string, string> | undefined;
      expect(cf).toBeUndefined();
    });
  });

  // ===== batchSetCustomField =====
  describe('batchSetCustomField', () => {
    it('批量设置多条记录', () => {
      const records = [makeRecord({ id: 'a' }), makeRecord({ id: 'b' })];
      const result = batchSetCustomField(records, 'cf_x', '值');
      result.forEach(r => {
        const cf = (r as unknown as Record<string, unknown>).customFields as Record<string, string>;
        expect(cf.cf_x).toBe('值');
      });
    });
  });

  // ===== validateCustomFields =====
  describe('validateCustomFields', () => {
    it('必填字段为空时报错', () => {
      const def = makeDef({ required: true, key: 'cf_required' });
      const record = makeRecord();
      const result = validateCustomFields(record, [def]);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('必填');
    });

    it('必填字段有值时通过', () => {
      const def = makeDef({ required: true, key: 'cf_required' });
      const record = makeRecord();
      (record as unknown as Record<string, unknown>).customFields = { cf_required: '有值' };
      const result = validateCustomFields(record, [def]);
      expect(result.valid).toBe(true);
    });

    it('select 类型值不在选项中时报错', () => {
      const def = makeDef({ type: 'select', key: 'cf_select', options: ['A', 'B', 'C'] });
      const record = makeRecord();
      (record as unknown as Record<string, unknown>).customFields = { cf_select: 'D' };
      const result = validateCustomFields(record, [def]);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('不在可选项中');
    });

    it('select 类型值在选项中时通过', () => {
      const def = makeDef({ type: 'select', key: 'cf_select', options: ['A', 'B', 'C'] });
      const record = makeRecord();
      (record as unknown as Record<string, unknown>).customFields = { cf_select: 'A' };
      const result = validateCustomFields(record, [def]);
      expect(result.valid).toBe(true);
    });

    it('number 类型非数字值报错', () => {
      const def = makeDef({ type: 'number', key: 'cf_num' });
      const record = makeRecord();
      (record as unknown as Record<string, unknown>).customFields = { cf_num: '不是数字' };
      const result = validateCustomFields(record, [def]);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('数字');
    });

    it('number 类型数字值通过', () => {
      const def = makeDef({ type: 'number', key: 'cf_num' });
      const record = makeRecord();
      (record as unknown as Record<string, unknown>).customFields = { cf_num: 42 };
      const result = validateCustomFields(record, [def]);
      expect(result.valid).toBe(true);
    });

    it('无字段定义时返回 valid', () => {
      const result = validateCustomFields(makeRecord(), []);
      expect(result.valid).toBe(true);
    });
  });

  // ===== computeFieldStats =====
  describe('computeFieldStats', () => {
    it('正确统计填写率', () => {
      const def = makeDef({ key: 'cf_contact' });
      const sources = [
        makeRecord({ id: 's1' }),
        makeRecord({ id: 's2' }),
        makeRecord({ id: 's3' }),
        makeRecord({ id: 's4' }),
      ];
      (sources[0] as unknown as Record<string, unknown>).customFields = { cf_contact: '张三' };
      (sources[1] as unknown as Record<string, unknown>).customFields = { cf_contact: '李四' };
      // s2, s3 没有 cf_contact

      const stats = computeFieldStats(sources, [def]);
      expect(stats[0].filledCount).toBe(2);
      expect(stats[0].emptyCount).toBe(2);
      expect(stats[0].fillRate).toBe(0.5);
    });

    it('空数据源时 fillRate 为 0', () => {
      const def = makeDef();
      const stats = computeFieldStats([], [def]);
      expect(stats[0].fillRate).toBe(0);
      expect(stats[0].filledCount).toBe(0);
    });

    it('空字符串不计入已填写', () => {
      const def = makeDef({ key: 'cf_x' });
      const sources = [makeRecord({ id: 's1' })];
      (sources[0] as unknown as Record<string, unknown>).customFields = { cf_x: '' };

      const stats = computeFieldStats(sources, [def]);
      expect(stats[0].filledCount).toBe(0);
    });
  });
});
