/**
 * 城市数据按需加载注册表
 *
 * 按城市数据切分优化：将全省水源地数据拆分为按城市的独立 chunk，
 * 首次只加载默认城市，其余城市通过动态 import 按需加载或空闲后台补齐。
 *
 * 每个城市模块导出：
 * - cityWaterSources: 该城市的水源地信息（CityWaterSources）
 * - cityGeo: 该城市的坐标数据
 */
import type { CityWaterSources } from '@/data/hebeiWaterSources';

 
export interface CityGeoEntry {
  city: string;
  name: string;
  lng?: number;
  lat?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface CityDataModule {
  cityWaterSources: CityWaterSources;
  /** 坐标数据，类型由各城市 chunk 推断（含可选字段联合），放宽为宽松数组 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cityGeo: any[];
}

/** 默认城市（首屏加载的城市，通常为省会） */
export const DEFAULT_CITY = '石家庄市';

/** 全部城市（省直管县市也纳入） */
export const CITY_LIST: string[] = [
  '石家庄市',
  '唐山市',
  '秦皇岛市',
  '邯郸市',
  '邢台市',
  '保定市',
  '张家口市',
  '承德市',
  '沧州市',
  '廊坊市',
  '衡水市',
  '辛集市',
  '定州市',
];

/** 城市 → 模块加载器的映射（动态 import 实现按需加载） */
 
type CityLoader = () => Promise<CityDataModule>;

export const cityLoaders: Record<string, CityLoader> = {
  石家庄市: () => import('@/data/cities/shijiazhuang'),
  唐山市: () => import('@/data/cities/tangshan'),
  秦皇岛市: () => import('@/data/cities/qinhuangdao'),
  邯郸市: () => import('@/data/cities/handan'),
  邢台市: () => import('@/data/cities/xingtai'),
  保定市: () => import('@/data/cities/baoding'),
  张家口市: () => import('@/data/cities/zhangjiakou'),
  承德市: () => import('@/data/cities/chengde'),
  沧州市: () => import('@/data/cities/cangzhou'),
  廊坊市: () => import('@/data/cities/langfang'),
  衡水市: () => import('@/data/cities/hengshui'),
  辛集市: () => import('@/data/cities/xinji'),
  定州市: () => import('@/data/cities/dingzhou'),
};

/** 按城市名加载数据模块 */
export async function loadCityData(cityName: string): Promise<CityDataModule> {
  const loader = cityLoaders[cityName];
  if (!loader) {
    throw new Error(`未知城市: ${cityName}`);
  }
  const mod = await loader();
  return {
    cityWaterSources: mod.cityWaterSources,
    cityGeo: mod.cityGeo || [],
  };
}
