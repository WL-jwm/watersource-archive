import { describe, expect, it } from 'vitest';
import {
  generateStandardCode,
  batchGenerateCodes,
  parseStandardCode,
  summarizeCodes,
  validateCode,
  validateRecordForCoding,
  batchValidateCodes,
  generateCodePreview,
  formatCodeForDisplay,
  summarizeValidation,
  CITY_CODES,
} from '@/lib/waterSourceCoder';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';

// 测试用水源地记录
const mockRecord: WaterSourceRecord = {
  id: '石家庄市_municipal_测试水源地',
  cityName: '石家庄市',
  level: 'municipal',
  name: '测试水源地',
  type: '地下水',
  county: '正定县',
  status: '在用',
  lng: 114.5,
  lat: 38.0,
};

const mockRecord2: WaterSourceRecord = {
  id: '唐山市_county_河流水源',
  cityName: '唐山市',
  level: 'county',
  name: '河流水源',
  type: '地表水',
  county: '丰润区',
  status: '在用',
  lng: 118.2,
  lat: 39.6,
};

describe('waterSourceCoder', () => {
  describe('generateStandardCode', () => {
    it('应生成正确格式的编码', () => {
      const code = generateStandardCode(mockRecord, 1);
      expect(code.code).toMatch(/^SD\d{6}\d{1}\d{1}\d{3}$/);
    });

    it('石家庄市编码应为130100', () => {
      const code = generateStandardCode(mockRecord, 1);
      expect(code.parts.adminCode).toBe('130100');
    });

    it('地下水类型编码应为1', () => {
      const code = generateStandardCode(mockRecord, 1);
      expect(code.parts.typeCode).toBe('1');
      expect(code.parts.typeName).toBe('地下水');
    });

    it('地表水类型编码应为2', () => {
      const code = generateStandardCode(mockRecord2, 1);
      expect(code.parts.typeCode).toBe('2');
      expect(code.parts.typeName).toBe('地表水');
    });

    it('市级编码应为1', () => {
      const code = generateStandardCode(mockRecord, 1);
      expect(code.parts.levelCode).toBe('1');
      expect(code.parts.levelName).toBe('市级');
    });

    it('县级编码应为2', () => {
      const code = generateStandardCode(mockRecord2, 1);
      expect(code.parts.levelCode).toBe('2');
      expect(code.parts.levelName).toBe('县级');
    });

    it('序号应补零到3位', () => {
      const code = generateStandardCode(mockRecord, 5);
      expect(code.parts.serial).toBe('005');
    });

    it('应保留原始ID', () => {
      const code = generateStandardCode(mockRecord, 1);
      expect(code.originalId).toBe(mockRecord.id);
    });

    it('完整编码验证', () => {
      const code = generateStandardCode(mockRecord, 1);
      // SD + 130100(石家庄) + 1(地下水) + 1(市级) + 001
      expect(code.code).toBe('SD13010011001');
    });
  });

  describe('batchGenerateCodes', () => {
    it('应批量生成编码', () => {
      const records = [mockRecord, mockRecord2];
      const codeMap = batchGenerateCodes(records);
      expect(codeMap.size).toBe(2);
    });

    it('相同城市+级别+类型的序号应递增', () => {
      const records: WaterSourceRecord[] = [
        { ...mockRecord, id: 'r1', name: '水源1' },
        { ...mockRecord, id: 'r2', name: '水源2' },
        { ...mockRecord, id: 'r3', name: '水源3' },
      ];
      const codeMap = batchGenerateCodes(records);
      const codes = records.map((r) => codeMap.get(r.id)!.code);
      expect(codes[0]).toBe('SD13010011001');
      expect(codes[1]).toBe('SD13010011002');
      expect(codes[2]).toBe('SD13010011003');
    });

    it('不同城市的序号应独立计数', () => {
      const records = [mockRecord, mockRecord2, { ...mockRecord, id: 'r3', name: '水源3' }];
      const codeMap = batchGenerateCodes(records);
      expect(codeMap.get(mockRecord.id)!.parts.serial).toBe('001');
      expect(codeMap.get(mockRecord2.id)!.parts.serial).toBe('001');
      expect(codeMap.get('r3')!.parts.serial).toBe('002');
    });
  });

  describe('parseStandardCode', () => {
    it('应正确解析标准编码', () => {
      const parsed = parseStandardCode('SD13010011001');
      expect(parsed).not.toBeNull();
      expect(parsed!.adminCode).toBe('130100');
      expect(parsed!.cityName).toBe('石家庄市');
      expect(parsed!.typeName).toBe('地下水');
      expect(parsed!.levelName).toBe('市级');
      expect(parsed!.serial).toBe('001');
    });

    it('无效编码应返回null', () => {
      expect(parseStandardCode('invalid')).toBeNull();
      expect(parseStandardCode('SD130100')).toBeNull();
    });

    it('唐山市编码应正确反查', () => {
      const parsed = parseStandardCode('SD13020022003');
      expect(parsed!.cityName).toBe('唐山市');
      expect(parsed!.typeName).toBe('地表水');
      expect(parsed!.levelName).toBe('县级');
      expect(parsed!.serial).toBe('003');
    });
  });

  describe('summarizeCodes', () => {
    it('应正确统计总数', () => {
      const records = [mockRecord, mockRecord2];
      const codeMap = batchGenerateCodes(records);
      const summary = summarizeCodes(codeMap);
      expect(summary.total).toBe(2);
    });

    it('应正确统计城市分布', () => {
      const records = [mockRecord, mockRecord2];
      const codeMap = batchGenerateCodes(records);
      const summary = summarizeCodes(codeMap);
      expect(summary.byCity.length).toBe(2);
      expect(summary.byCity.find((c) => c.city === '石家庄市')?.count).toBe(1);
      expect(summary.byCity.find((c) => c.city === '唐山市')?.count).toBe(1);
    });

    it('应正确统计类型分布', () => {
      const records = [mockRecord, mockRecord2];
      const codeMap = batchGenerateCodes(records);
      const summary = summarizeCodes(codeMap);
      expect(summary.byType.find((t) => t.type === '地下水')?.count).toBe(1);
      expect(summary.byType.find((t) => t.type === '地表水')?.count).toBe(1);
    });

    it('空Map应返回零值', () => {
      const summary = summarizeCodes(new Map());
      expect(summary.total).toBe(0);
      expect(summary.byCity.length).toBe(0);
    });
  });

  // ===== N2: 编码校验与补全 =====
  describe('formatCodeForDisplay', () => {
    it('应将紧凑编码格式化为可读形式', () => {
      expect(formatCodeForDisplay('SD13010011001')).toBe('SD130100-1-1-001');
    });

    it('应将唐山地表水县级编码格式化', () => {
      expect(formatCodeForDisplay('SD13020022003')).toBe('SD130200-2-2-003');
    });

    it('非标准编码应原样返回', () => {
      expect(formatCodeForDisplay('invalid')).toBe('invalid');
      expect(formatCodeForDisplay('SD130')).toBe('SD130');
    });
  });

  describe('validateRecordForCoding', () => {
    it('完整记录应校验通过', () => {
      const result = validateRecordForCoding(mockRecord);
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('缺少城市名应报告问题', () => {
      const result = validateRecordForCoding({ ...mockRecord, cityName: '' });
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('缺少城市名称');
    });

    it('未知城市应报告问题', () => {
      const result = validateRecordForCoding({ ...mockRecord, cityName: '北京市' });
      expect(result.valid).toBe(false);
      expect(result.issues.some((s) => s.includes('不在河北省行政区划代码表中'))).toBe(true);
    });

    it('无效水源类型应报告问题', () => {
      const result = validateRecordForCoding({ ...mockRecord, type: '再生水' as any });
      expect(result.valid).toBe(false);
      expect(result.issues.some((s) => s.includes('水源类型'))).toBe(true);
    });

    it('无效级别应报告问题', () => {
      const result = validateRecordForCoding({ ...mockRecord, level: 'village' as any });
      expect(result.valid).toBe(false);
      expect(result.issues.some((s) => s.includes('级别'))).toBe(true);
    });

    it('缺少名称应报告问题', () => {
      const result = validateRecordForCoding({ ...mockRecord, name: '' });
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('缺少水源地名称');
    });
  });

  describe('validateCode', () => {
    it('有效编码应校验通过', () => {
      const result = validateCode('SD13010011001');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('空编码应报错', () => {
      const result = validateCode('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('编码为空');
    });

    it('缺少SD前缀应报错', () => {
      const result = validateCode('XX13010011001');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('SD'))).toBe(true);
    });

    it('长度不足应报错', () => {
      const result = validateCode('SD130100');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('长度'))).toBe(true);
    });

    it('无效行政区划代码应报错', () => {
      const result = validateCode('SD99999911001');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('行政区划代码'))).toBe(true);
    });

    it('无效类型编码应报错', () => {
      const result = validateCode('SD13010091001');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('水源类型编码'))).toBe(true);
    });

    it('无效级别编码应报错', () => {
      const result = validateCode('SD13010019001');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('级别编码'))).toBe(true);
    });
  });

  describe('batchValidateCodes', () => {
    it('应为所有记录生成校验结果', () => {
      const records = [mockRecord, mockRecord2];
      const results = batchValidateCodes(records);
      expect(results).toHaveLength(2);
    });

    it('有效记录应标记为valid', () => {
      const results = batchValidateCodes([mockRecord]);
      expect(results[0].valid).toBe(true);
      expect(results[0].generatedCode).toBe('SD13010011001');
      expect(results[0].displayCode).toBe('SD130100-1-1-001');
    });

    it('无效记录应包含问题列表', () => {
      const invalid: WaterSourceRecord = {
        ...mockRecord,
        id: 'bad1',
        name: '',
        cityName: '北京市',
      };
      const results = batchValidateCodes([invalid]);
      expect(results[0].valid).toBe(false);
      expect(results[0].issues.length).toBeGreaterThan(0);
      // batchGenerateCodes 使用 fallback 139900 仍会生成编码，但 valid 为 false
      expect(results[0].generatedCode).toBe('SD13990011001');
      expect(results[0].displayCode).toBe('SD139900-1-1-001');
    });
  });

  describe('generateCodePreview', () => {
    it('应为完整表单数据生成预览编码', () => {
      const preview = generateCodePreview('石家庄市', 'municipal', '地下水', []);
      expect(preview).toBe('SD130100-1-1-001');
    });

    it('应考虑已有同组记录计算序号', () => {
      const existing = [
        { ...mockRecord, id: 'r1' },
        { ...mockRecord, id: 'r2' },
      ];
      const preview = generateCodePreview('石家庄市', 'municipal', '地下水', existing);
      expect(preview).toBe('SD130100-1-1-003');
    });

    it('编辑模式应排除当前记录', () => {
      const existing = [
        { ...mockRecord, id: 'r1' },
        { ...mockRecord, id: 'r2' },
        { ...mockRecord, id: 'r3' },
      ];
      const preview = generateCodePreview('石家庄市', 'municipal', '地下水', existing, 'r2');
      expect(preview).toBe('SD130100-1-1-003');
    });

    it('缺少城市应返回提示', () => {
      const preview = generateCodePreview('北京市', 'municipal', '地下水', []);
      expect(preview).toContain('请补全');
    });

    it('缺少类型应返回提示', () => {
      const preview = generateCodePreview('石家庄市', 'municipal', '再生水', []);
      expect(preview).toContain('请补全');
    });

    it('辛集市应使用130181编码', () => {
      const preview = generateCodePreview('辛集市', 'county', '地下水', []);
      expect(preview).toBe('SD130181-1-2-001');
    });

    it('定州市应使用130682编码', () => {
      const preview = generateCodePreview('定州市', 'county', '地表水', []);
      expect(preview).toBe('SD130682-2-2-001');
    });
  });

  describe('summarizeValidation', () => {
    it('应正确统计有效和无效数量', () => {
      const records = [mockRecord, mockRecord2, { ...mockRecord, id: 'bad1', cityName: '' }];
      const results = batchValidateCodes(records);
      const summary = summarizeValidation(results);
      expect(summary.total).toBe(3);
      expect(summary.valid).toBe(2);
      expect(summary.invalid).toBe(1);
    });

    it('应正确统计问题分布', () => {
      const records = [
        { ...mockRecord, id: 'bad1', cityName: '' },
        { ...mockRecord, id: 'bad2', cityName: '', name: '' },
      ];
      const results = batchValidateCodes(records);
      const summary = summarizeValidation(results);
      expect(summary.issueBreakdown['缺少城市名称']).toBe(2);
      expect(summary.issueBreakdown['缺少水源地名称']).toBe(1);
    });

    it('全部有效时invalid应为0', () => {
      const results = batchValidateCodes([mockRecord, mockRecord2]);
      const summary = summarizeValidation(results);
      expect(summary.invalid).toBe(0);
      expect(summary.valid).toBe(2);
    });
  });

  describe('CITY_CODES completeness', () => {
    it('应包含辛集市', () => {
      expect(CITY_CODES['辛集市']).toBe('130181');
    });

    it('应包含定州市', () => {
      expect(CITY_CODES['定州市']).toBe('130682');
    });

    it('应包含全部13个地级市+雄安新区+辛集+定州', () => {
      expect(Object.keys(CITY_CODES)).toHaveLength(14);
    });
  });
});
