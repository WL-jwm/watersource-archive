/**
 * Home 页城市水源地转换工具
 *
 * 将 waterSourceStore 的扁平水源地记录（WaterSourceRecord[]）
 * 转换为 Home 页城市分组所需的按级别（municipal/county/township）列表。
 *
 * 用于 Home 页复用 store 数据源（P4 按城市切分 + 空闲补齐），
 * 替代原先从全量静态数据 hebeiWaterSources 直接读取。
 */
import type { WaterSourceInfo } from '@/types';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';

/** 单条记录 → WaterSourceInfo（供列表展示，仅取展示所需字段） */
export function toWaterSourceInfo(s: WaterSourceRecord): WaterSourceInfo {
  return {
    name: s.name,
    type: s.type,
    subType: s.subType,
    county: s.county,
    status: s.status as WaterSourceInfo['status'],
    remark: s.remark,
  };
}

export interface CityKnownSources {
  municipal: WaterSourceInfo[];
  county: WaterSourceInfo[];
  township: WaterSourceInfo[];
}

/** 从扁平 sources 提取某城市按级别分组的水源地列表 */
export function getCityKnownSources(
  cityName: string,
  sources: WaterSourceRecord[],
): CityKnownSources {
  const city = sources.filter((s) => s.cityName === cityName);
  return {
    municipal: city.filter((s) => s.level === 'municipal').map(toWaterSourceInfo),
    county: city.filter((s) => s.level === 'county').map(toWaterSourceInfo),
    township: city.filter((s) => s.level === 'township').map(toWaterSourceInfo),
  };
}

/** 汇总某城市水源地总数（市级+县级+乡镇级） */
export function countCityKnownSources(known: CityKnownSources): number {
  return known.municipal.length + known.county.length + known.township.length;
}
