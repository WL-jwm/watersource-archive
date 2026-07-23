import { describe, it, expect } from 'vitest';
import { recommendParams, validateParams } from '@/lib/paramRecommenderV2';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';
import type { CalcParams } from '@/lib/zoneCalcEngine';

function makeSource(overrides: Partial<WaterSourceRecord> = {}): WaterSourceRecord {
  return {
    id: 's1',
    cityName: '石家庄市',
    level: 'municipal',
    name: '岗南水库',
    type: '地表水',
    subType: '湖库型',
    county: '平山县',
    status: '在用',
    population: 500000,
    river: '滹沱河',
    lng: 114.21,
    lat: 38.27,
    dataVersion: 1,
    ...overrides,
  };
}

describe('paramRecommenderV2 - 智能参数推荐', () => {
  describe('recommendParams', () => {
    it('T01-湖库型推荐经验值法', () => {
      const source = makeSource({ type: '地表水', subType: '湖库型', name: '岗南水库' });
      const result = recommendParams(source);
      expect(result.recommendedMethod).toBe('经验值法');
      expect(result.calcParams.swType).toBe('湖库型');
    });

    it('T02-河流型推荐经验值法', () => {
      const source = makeSource({ type: '地表水', subType: '河流型', name: '滹沱河取水口' });
      const result = recommendParams(source);
      expect(result.calcParams.swType).toBe('河流型');
    });

    it('T03-地下水推荐解析法', () => {
      const source = makeSource({ type: '地下水', subType: '孔隙水', name: '地下水井1' });
      const result = recommendParams(source);
      expect(result.recommendedMethod).toBe('解析法');
      expect(result.calcParams.gwType).toBe('孔隙水');
    });

    it('T04-岩溶水类型识别', () => {
      const source = makeSource({ type: '地下水', subType: '岩溶水', name: '岩溶泉' });
      const result = recommendParams(source);
      expect(result.calcParams.gwType).toBe('岩溶水');
      expect(result.warnings.some((w) => w.includes('岩溶'))).toBe(true);
    });

    it('T05-裂隙水类型识别', () => {
      const source = makeSource({ type: '地下水', subType: '裂隙水', name: '裂隙水井' });
      const result = recommendParams(source);
      expect(result.calcParams.gwType).toBe('裂隙水');
    });

    it('T06-渗透系数使用城市经验值', () => {
      const source = makeSource({ type: '地下水', cityName: '石家庄市' });
      const result = recommendParams(source);
      const kParam = result.params.find((p) => p.field === 'permeability');
      expect(kParam).toBeDefined();
      expect(kParam!.source).toBe('经验');
      expect(kParam!.range).toBeDefined();
    });

    it('T07-导水系数T=K*M自动计算', () => {
      const source = makeSource({ type: '地下水' });
      const result = recommendParams(source);
      const tParam = result.params.find((p) => p.field === 'transmissivity');
      expect(tParam).toBeDefined();
      expect(tParam!.source).toBe('计算');
      const K = result.calcParams.permeability!;
      const M = result.calcParams.aquiferThickness!;
      expect(result.calcParams.transmissivity).toBeCloseTo(K * M, 2);
    });

    it('T08-取水量按人口估算', () => {
      const source = makeSource({ type: '地下水', population: 100000 });
      const result = recommendParams(source);
      expect(result.calcParams.dailyYield).toBeCloseTo(12000, 0); // 100000 * 0.12 = 12000 m³/d
    });

    it('T09-沿海城市潮汐提示', () => {
      const source = makeSource({ type: '地表水', subType: '河流型', cityName: '唐山市', name: '陡河取水口' });
      const result = recommendParams(source);
      expect(result.calcParams.isTidal).toBe(true);
      expect(result.warnings.some((w) => w.includes('潮汐'))).toBe(true);
    });

    it('T10-内陆城市无潮汐', () => {
      const source = makeSource({ type: '地表水', subType: '河流型', cityName: '石家庄市', name: '滹沱河取水口' });
      const result = recommendParams(source);
      expect(result.calcParams.isTidal).toBe(false);
    });

    it('T11-水库规模按人口推断', () => {
      const source = makeSource({ type: '地表水', subType: '湖库型', population: 600000, name: '大型水库' });
      const result = recommendParams(source);
      expect(result.calcParams.reservoirSize).toBe('大型');
    });

    it('T12-缺少人口数据降低置信度', () => {
      const source = makeSource({ type: '地下水', population: 0 });
      const result = recommendParams(source);
      expect(result.confidence).toBeLessThan(80);
      expect(result.warnings.some((w) => w.includes('服务人口'))).toBe(true);
    });

    it('T13-缺少坐标降低置信度', () => {
      const source = makeSource({ type: '地下水', lng: 0, lat: 0 });
      const result = recommendParams(source);
      expect(result.warnings.some((w) => w.includes('坐标'))).toBe(true);
    });

    it('T14-河流参数使用经验值', () => {
      const source = makeSource({ type: '地表水', subType: '河流型', river: '滹沱河', name: '取水口' });
      const result = recommendParams(source);
      expect(result.calcParams.riverFlow).toBe(30);
      expect(result.calcParams.riverWidth).toBe(80);
    });

    it('T15-参数包含敏感性标注', () => {
      const source = makeSource({ type: '地下水' });
      const result = recommendParams(source);
      expect(result.params.every((p) => ['high', 'medium', 'low'].includes(p.sensitivity))).toBe(true);
    });
  });

  describe('validateParams', () => {
    it('T16-正常参数验证通过', () => {
      const params: CalcParams = {
        sourceType: '地下水',
        permeability: 10,
        aquiferThickness: 20,
        hydraulicGradient: 0.002,
        dailyYield: 5000,
      };
      const result = validateParams(params);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('T17-渗透系数为零报错', () => {
      const params: CalcParams = {
        sourceType: '地下水',
        permeability: 0,
      };
      const result = validateParams(params);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('渗透系数'))).toBe(true);
    });

    it('T18-渗透系数偏大警告', () => {
      const params: CalcParams = {
        sourceType: '地下水',
        permeability: 200,
      };
      const result = validateParams(params);
      expect(result.warnings.some((w) => w.includes('偏大'))).toBe(true);
    });

    it('T19-潮汐河段未设上溯距离警告', () => {
      const params: CalcParams = {
        sourceType: '地表水',
        swType: '河流型',
        isTidal: true,
      };
      const result = validateParams(params);
      expect(result.warnings.some((w) => w.includes('潮汐上溯'))).toBe(true);
    });

    it('T20-水力坡度偏大警告', () => {
      const params: CalcParams = {
        sourceType: '地下水',
        hydraulicGradient: 0.02,
      };
      const result = validateParams(params);
      expect(result.warnings.some((w) => w.includes('水力坡度'))).toBe(true);
    });
  });
});
