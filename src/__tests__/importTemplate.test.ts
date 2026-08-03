/* ===== S11.1: 导入模板引擎测试 ===== */
import { describe, it, expect } from 'vitest';
import {
  TEMPLATE_COLUMNS,
  detectFieldMapping,
  normalizeLevel,
  normalizeType,
  normalizeStatus,
  levelToChinese,
  applyMapping,
  validateMappedRecord,
} from '@/lib/importTemplate';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';

describe('importTemplate', () => {
  // ===== TEMPLATE_COLUMNS =====
  describe('TEMPLATE_COLUMNS', () => {
    it('应包含 12 个标准列定义', () => {
      expect(TEMPLATE_COLUMNS).toHaveLength(12);
    });

    it('必填字段应包含 name, cityName, level, type', () => {
      const requiredFields = TEMPLATE_COLUMNS.filter((c) => c.required).map((c) => c.field);
      expect(requiredFields).toContain('name');
      expect(requiredFields).toContain('cityName');
      expect(requiredFields).toContain('level');
      expect(requiredFields).toContain('type');
    });

    it('select 类型列应提供 options', () => {
      const selectCols = TEMPLATE_COLUMNS.filter((c) => c.type === 'select');
      for (const col of selectCols) {
        expect(col.options).toBeDefined();
        expect(col.options!.length).toBeGreaterThan(0);
      }
    });

    it('每列应有 header, field, description, example', () => {
      for (const col of TEMPLATE_COLUMNS) {
        expect(col.header).toBeTruthy();
        expect(col.field).toBeTruthy();
        expect(col.description).toBeTruthy();
        expect(col.example).toBeDefined();
      }
    });
  });

  // ===== detectFieldMapping =====
  describe('detectFieldMapping', () => {
    it('精确匹配标准列名', () => {
      const cols = ['水源地名称', '城市', '级别', '水源类型', '县区', '状态'];
      const result = detectFieldMapping(cols);
      expect(result.mappedCount).toBe(6);
      expect(result.unmappedCount).toBe(0);
      expect(result.missingRequired).toHaveLength(0);
    });

    it('精确匹配英文列名', () => {
      const cols = ['name', 'city', 'level', 'type', 'county', 'status'];
      const result = detectFieldMapping(cols);
      expect(result.mappedCount).toBeGreaterThanOrEqual(5);
    });

    it('模糊匹配列名变体', () => {
      const cols = ['水源地名', '地级市', '等级', '类型', '所在县', '使用状态'];
      const result = detectFieldMapping(cols);
      expect(result.mappedCount).toBeGreaterThanOrEqual(4);
    });

    it('未匹配的列应标记为 none', () => {
      const cols = ['水源地名称', '未知列', '随便什么'];
      const result = detectFieldMapping(cols);
      expect(result.unmappedCount).toBe(2);
      const unmapped = result.mappings.filter((m) => m.matchType === 'none');
      expect(unmapped).toHaveLength(2);
    });

    it('必填字段缺失时应报告', () => {
      const cols = ['县区', '状态', '备注'];
      const result = detectFieldMapping(cols);
      expect(result.missingRequired.length).toBeGreaterThan(0);
      expect(result.missingRequired).toContain('name');
      expect(result.missingRequired).toContain('cityName');
    });

    it('同一字段不会被多列重复映射', () => {
      const cols = ['水源地名称', '名称', '水源地名'];
      const result = detectFieldMapping(cols);
      const nameMappings = result.mappings.filter((m) => m.targetField === 'name');
      expect(nameMappings).toHaveLength(1);
    });

    it('空列名列表应返回空映射', () => {
      const result = detectFieldMapping([]);
      expect(result.mappings).toHaveLength(0);
      expect(result.mappedCount).toBe(0);
      expect(result.missingRequired.length).toBeGreaterThan(0);
    });

    it('精确匹配的置信度应为 1.0', () => {
      const result = detectFieldMapping(['水源地名称']);
      const exact = result.mappings.find((m) => m.sourceColumn === '水源地名称');
      expect(exact?.confidence).toBe(1.0);
      expect(exact?.matchType).toBe('exact');
    });

    it('模糊匹配的置信度应为 0.7', () => {
      // '水源地名称正式' 不在别名表中但包含别名 '水源地名称'，应模糊匹配
      const result = detectFieldMapping(['水源地名称正式']);
      const fuzzy = result.mappings.find((m) => m.sourceColumn === '水源地名称正式');
      expect(fuzzy).toBeDefined();
      expect(fuzzy?.confidence).toBe(0.7);
      expect(fuzzy?.matchType).toBe('fuzzy');
    });
  });

  // ===== normalizeLevel =====
  describe('normalizeLevel', () => {
    it('应正确转换中文级别', () => {
      expect(normalizeLevel('市级')).toBe('municipal');
      expect(normalizeLevel('县级')).toBe('county');
      expect(normalizeLevel('乡镇级')).toBe('township');
    });

    it('应正确转换英文级别', () => {
      expect(normalizeLevel('municipal')).toBe('municipal');
      expect(normalizeLevel('county')).toBe('county');
      expect(normalizeLevel('township')).toBe('township');
    });

    it('无效级别应返回 null', () => {
      expect(normalizeLevel('省级')).toBeNull();
      expect(normalizeLevel('')).toBeNull();
      expect(normalizeLevel('xxx')).toBeNull();
    });

    it('应处理带空格的输入', () => {
      expect(normalizeLevel('  市级  ')).toBe('municipal');
    });
  });

  // ===== normalizeType =====
  describe('normalizeType', () => {
    it('应识别地表水', () => {
      expect(normalizeType('地表水')).toBe('地表水');
      expect(normalizeType('地表')).toBe('地表水');
      expect(normalizeType('surface')).toBe('地表水');
    });

    it('应识别地下水', () => {
      expect(normalizeType('地下水')).toBe('地下水');
      expect(normalizeType('地下')).toBe('地下水');
      expect(normalizeType('ground')).toBe('地下水');
    });

    it('无法识别的值保留原值', () => {
      expect(normalizeType('再生水')).toBe('再生水');
    });
  });

  // ===== normalizeStatus =====
  describe('normalizeStatus', () => {
    it('应标准化常见状态写法', () => {
      expect(normalizeStatus('在用')).toBe('在用');
      expect(normalizeStatus('使用中')).toBe('在用');
      expect(normalizeStatus('备用')).toBe('备用');
      expect(normalizeStatus('取消')).toBe('取消');
      expect(normalizeStatus('规划')).toBe('规划');
      expect(normalizeStatus('在建')).toBe('在建');
    });

    it('空值默认为"在用"', () => {
      expect(normalizeStatus('')).toBe('在用');
    });

    it('未知值保留原值', () => {
      expect(normalizeStatus('停用')).toBe('停用');
    });
  });

  // ===== levelToChinese =====
  describe('levelToChinese', () => {
    it('应正确转换枚举到中文', () => {
      expect(levelToChinese('municipal')).toBe('市级');
      expect(levelToChinese('county')).toBe('县级');
      expect(levelToChinese('township')).toBe('乡镇级');
    });

    it('未知值原样返回', () => {
      expect(levelToChinese('other')).toBe('other');
    });
  });

  // ===== applyMapping =====
  describe('applyMapping', () => {
    it('应正确应用映射转换行数据', () => {
      const row = {
        '水源地名称': '测试水源地',
        '城市': '石家庄市',
        '级别': '市级',
        '水源类型': '地下水',
        '县区': '平山县',
        '状态': '在用',
        '服务人口': '10000',
        '经度': '114.5',
        '纬度': '38.2',
      };
      const mappings = detectFieldMapping(Object.keys(row)).mappings;
      const record = applyMapping(row, mappings);

      expect(record.name).toBe('测试水源地');
      expect(record.cityName).toBe('石家庄市');
      expect(record.level).toBe('municipal');
      expect(record.type).toBe('地下水');
      expect(record.county).toBe('平山县');
      expect(record.status).toBe('在用');
      expect(record.population).toBe(10000);
      expect(record.lng).toBe(114.5);
      expect(record.lat).toBe(38.2);
    });

    it('空行应返回空对象', () => {
      const mappings = detectFieldMapping(['水源地名称']).mappings;
      const record = applyMapping({}, mappings);
      expect(Object.keys(record)).toHaveLength(0);
    });

    it('无效数值应被忽略', () => {
      const row = { '服务人口': 'abc', '经度': 'xyz', '水源地名称': '测试' };
      const mappings = detectFieldMapping(Object.keys(row)).mappings;
      const record = applyMapping(row, mappings);
      expect(record.population).toBeUndefined();
      expect(record.lng).toBeUndefined();
      expect(record.name).toBe('测试');
    });
  });

  // ===== validateMappedRecord =====
  describe('validateMappedRecord', () => {
    it('完整记录应通过校验', () => {
      const record: Partial<WaterSourceRecord> = {
        name: '测试水源地',
        cityName: '石家庄市',
        level: 'municipal',
        type: '地下水',
      };
      const result = validateMappedRecord(record, 2);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('缺少必填字段应报错', () => {
      const record: Partial<WaterSourceRecord> = {
        name: '测试水源地',
        // 缺少 cityName, level, type
      };
      const result = validateMappedRecord(record, 2);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });

    it('经度超出河北省范围应报错', () => {
      const record: Partial<WaterSourceRecord> = {
        name: '测试',
        cityName: '石家庄市',
        level: 'municipal',
        type: '地下水',
        lng: 200,
      };
      const result = validateMappedRecord(record, 2);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('经度'))).toBe(true);
    });

    it('纬度超出河北省范围应报错', () => {
      const record: Partial<WaterSourceRecord> = {
        name: '测试',
        cityName: '石家庄市',
        level: 'municipal',
        type: '地下水',
        lat: 50,
      };
      const result = validateMappedRecord(record, 2);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('纬度'))).toBe(true);
    });

    it('无效水源类型应报错', () => {
      const record: Partial<WaterSourceRecord> = {
        name: '测试',
        cityName: '石家庄市',
        level: 'municipal',
        type: '再生水' as '地下水',
      };
      const result = validateMappedRecord(record, 2);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('水源类型'))).toBe(true);
    });

    it('空记录应报多个错误', () => {
      const result = validateMappedRecord({}, 2);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
    });
  });
});
