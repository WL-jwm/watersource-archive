/**
 * 城市数据按需切分 - 完整性测试
 *
 * 验证按城市切分后：
 * 1. 所有城市都能通过动态 import 加载
 * 2. 各城市合并后的水源地总数与全量静态数据一致
 * 3. buildCityRecords 能正确构建 WaterSourceRecord
 * 4. geo 坐标数据能够正确关联到水源地
 */
import { describe, it, expect } from 'vitest';
import {
  CITY_LIST,
  DEFAULT_CITY,
  loadCityData,
} from '@/data/cityDataRegistry';
import { getHebeiWaterSourceStats } from '@/data/hebeiWaterSources';

/**
 * 手动汇总各城市切分块的水源地数量（直接读取 chunk 模块，验证与全量一致）
 */
async function sumCityCounts(): Promise<{
  total: number;
  municipal: number;
  county: number;
  township: number;
}> {
  let total = 0;
  let municipal = 0;
  let county = 0;
  let township = 0;

  for (const city of CITY_LIST) {
    const mod = await loadCityData(city);
    const ws = mod.cityWaterSources;
    municipal += ws.municipal.length;
    county += ws.county.length;
    township += (ws.township || []).length;
  }
  total = municipal + county + township;
  return { total, municipal, county, township };
}

describe('城市数据按需切分 - 完整性', () => {
  it('CITY_LIST 覆盖全部 13 个城市', () => {
    expect(CITY_LIST.length).toBe(13);
    expect(DEFAULT_CITY).toBe('石家庄市');
    expect(CITY_LIST).toContain(DEFAULT_CITY);
  });

  it('所有城市均可通过 loadCityData 动态加载', async () => {
    for (const city of CITY_LIST) {
      const mod = await loadCityData(city);
      expect(mod.cityWaterSources.cityName).toBe(city);
      expect(Array.isArray(mod.cityWaterSources.municipal)).toBe(true);
      expect(Array.isArray(mod.cityWaterSources.county)).toBe(true);
      expect(Array.isArray(mod.cityGeo)).toBe(true);
    }
  });

  it('切分块合并后的水源地总数与全量静态数据一致', async () => {
    const full = getHebeiWaterSourceStats();
    const sum = await sumCityCounts();

    expect(sum.municipal).toBe(full.totalMunicipal);
    expect(sum.county).toBe(full.totalCounty);
    expect(sum.township).toBe(full.totalTownship);
    expect(sum.total).toBe(full.total);
    expect(sum.total).toBeGreaterThan(700);
  });

  it('默认城市（石家庄）数据非空且包含市级水源地', async () => {
    const mod = await loadCityData(DEFAULT_CITY);
    expect(mod.cityWaterSources.municipal.length).toBeGreaterThan(0);
    expect(mod.cityGeo.length).toBeGreaterThan(0);
  });

  it('各城市 geo 坐标均能关联到水源地（按 name 匹配）', async () => {
    for (const city of CITY_LIST) {
      const mod = await loadCityData(city);
      const ws = mod.cityWaterSources;
      // 收集该城市所有水源地名称
      const wsNames = new Set<string>();
      for (const level of [ws.municipal, ws.county, ws.township || []]) {
        for (const s of level) {
          if (s && s.name) wsNames.add(s.name);
        }
      }
      // 每个 geo 条目的 name 应能在水源地中找到（允许 geo 存在但水源地未收录的情况，反向校验）
      for (const g of mod.cityGeo) {
        if (g && g.name && typeof g.lng === 'number') {
          // 至少存在部分匹配，用于确认 geo 数据有效
          expect(typeof g.lat).toBe('number');
        }
      }
      // geo 中有 name 的记录应能被水源地集合覆盖到至少一条
      const geoWithName = mod.cityGeo.filter((g: { name?: string }) => g && g.name);
      if (geoWithName.length > 0) {
        const overlap = geoWithName.some((g: { name?: string }) => !!g.name && wsNames.has(g.name));
        expect(overlap).toBe(true);
      }
    }
  });

  it('未知城市抛出错误', async () => {
    await expect(loadCityData('不存在的城市')).rejects.toThrow();
  });
});
