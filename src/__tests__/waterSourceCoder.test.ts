import { describe, it, expect } from 'vitest';
import {
  generateStandardCode,
  batchGenerateCodes,
  parseStandardCode,
  summarizeCodes,
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
});
