/**
 * 定州市 水源地数据（按城市切分 chunk）
 *
 * 由脚本从 hebeiWaterSources.ts / waterSourceGeoData.ts 自动拆分生成
 * 用于按需数据切分优化：首次只加载默认城市，其余城市空闲后台补齐
 */

import type { CityWaterSources } from '@/data/hebeiWaterSources';

export const cityWaterSources: CityWaterSources =   {
    cityName: '定州市',
    cityCode: '130682',
    municipal: [
      {
        name: '定州市集中式饮用水水源地(西城区燕家佐)',
        type: '地下水',
        subType: '孔隙水',
        county: '定州市',
        status: '在用',
        remark: '位于定州市西城区燕家佐，2号水井口',
      },
      {
        name: '定州市南水北调水源地',
        type: '地表水',
        subType: '南水北调',
        county: '定州市',
        status: '在用',
        remark: '位于定州市西城区燕家佐，南水北调中线水源',
      },
    ],
    township: [
      // ===== 定州市乡镇级水源地 =====
      // 说明：定州市已实现城乡供水一体化，南水北调中线水源覆盖全市。
      {
        name: '定州市城区集中供水工程水源地',
        type: '地下水',
        county: '定州市',
        status: '在用',
        remark: '城乡供水一体化，南水北调中线水源覆盖全市25个乡镇',
      },
    ],
    county: [],
  };

export const cityGeo = [
  {
    city: '定州市',
    level: 'municipal',
    name: '定州市集中式饮用水水源地(西城区燕家佐)',
    type: '地下水',
    subType: '孔隙水',
    county: '定州市',
    status: '在用',
    remark: '位于定州市西城区燕家佐，2号水井口',
    lng: 115.0116,
    lat: 38.5363,
  },,
  {
    city: '定州市',
    level: 'municipal',
    name: '定州市南水北调水源地',
    type: '地表水',
    subType: '南水北调',
    county: '定州市',
    status: '在用',
    remark: '位于定州市西城区燕家佐，南水北调中线水源',
    lng: 115.0071,
    lat: 38.4925,
  },,
  {
    city: '定州市',
    level: 'county',
    name: '定州市城区集中供水工程水源地',
    type: '地下水',
    county: '定州市',
    status: '在用',
    remark: '城乡供水一体化，南水北调中线水源覆盖全市25个乡镇',
    lng: 115.0035,
    lat: 38.5129,
  },,
  {
    city: '定州市',
    level: 'township',
    name: '定州市城区集中供水工程水源地',
    type: '地下水',
    county: '定州市',
    status: '在用',
    remark: '城乡供水一体化，南水北调中线水源覆盖全市25个乡镇',
    lng: 115.0035,
    lat: 38.5129,
  },
];
