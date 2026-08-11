/**
 * 辛集市 水源地数据（按城市切分 chunk）
 *
 * 由脚本从 hebeiWaterSources.ts / waterSourceGeoData.ts 自动拆分生成
 * 用于按需数据切分优化：首次只加载默认城市，其余城市空闲后台补齐
 */

import type { CityWaterSources } from '@/data/hebeiWaterSources';

export const cityWaterSources: CityWaterSources =   {
    cityName: '辛集市',
    cityCode: '130181',
    municipal: [
      {
        name: '辛集市北水厂一期工程水源地',
        type: '地下水',
        subType: '孔隙水',
        county: '辛集市',
        status: '在用',
      },
      {
        name: '辛集市南水北调水厂水源地',
        type: '地表水',
        subType: '南水北调',
        county: '辛集市',
        status: '在用',
      },
    ],
    county: [
      {
        name: '田家庄乡倾井水厂水源地',
        type: '地下水',
        county: '辛集市',
        status: '在用',
        remark: '一级保护区，2022年划定',
      },
      {
        name: '前营乡崔家庄水厂水源地',
        type: '地下水',
        county: '辛集市',
        status: '在用',
        remark: '一级保护区，2022年划定',
      },
    ],
    township: [
      // ===== 辛集市乡镇级水源地 =====
      // 说明：辛集市已实现城乡供水一体化，南水北调水源覆盖全市。
      {
        name: '辛集市城区集中供水工程水源地',
        type: '地下水',
        county: '辛集市',
        status: '在用',
        remark: '城乡供水一体化，南水北调水源覆盖全市',
      },
    ],
  };

export const cityGeo = [
  {
    city: '辛集市',
    level: 'municipal',
    name: '辛集市北水厂一期工程水源地',
    type: '地下水',
    subType: '孔隙水',
    county: '辛集市',
    status: '在用',
    lng: 115.309,
    lat: 37.9494,
  },,
  {
    city: '辛集市',
    level: 'municipal',
    name: '辛集市南水北调水厂水源地',
    type: '地表水',
    subType: '南水北调',
    county: '辛集市',
    status: '在用',
    lng: 115.332,
    lat: 37.9543,
  },,
  {
    city: '辛集市',
    level: 'county',
    name: '田家庄乡倾井水厂水源地',
    type: '地下水',
    county: '辛集市',
    status: '在用',
    remark: '一级保护区，2022年划定',
    lng: 115.3317,
    lat: 37.9614,
  },,
  {
    city: '辛集市',
    level: 'county',
    name: '前营乡崔家庄水厂水源地',
    type: '地下水',
    county: '辛集市',
    status: '在用',
    remark: '一级保护区，2022年划定',
    lng: 115.3073,
    lat: 37.917,
  },,
  {
    city: '辛集市',
    level: 'township',
    name: '辛集市城区集中供水工程水源地',
    type: '地下水',
    county: '辛集市',
    status: '在用',
    remark: '城乡供水一体化，南水北调水源覆盖全市',
    lng: 115.3301,
    lat: 37.941,
  },
];
