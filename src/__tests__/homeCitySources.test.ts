/**
 * Home 城市水源地转换工具测试
 */
import { describe, it, expect } from 'vitest';
import {
  getCityKnownSources,
  countCityKnownSources,
  toWaterSourceInfo,
} from '@/lib/homeCitySources';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';

const records: WaterSourceRecord[] = [
  {
    id: 'sjz_m_1',
    cityName: '石家庄市',
    level: 'municipal',
    name: '岗南水库',
    type: '地表水',
    subType: '湖库型',
    county: '平山县',
    status: '在用',
  },
  {
    id: 'sjz_m_2',
    cityName: '石家庄市',
    level: 'municipal',
    name: '磁河地下水水源地',
    type: '地下水',
    county: '灵寿县',
    status: '在用',
  },
  {
    id: 'sjz_c_1',
    cityName: '石家庄市',
    level: 'county',
    name: '栾城区水利局第一供水厂',
    type: '地下水',
    county: '栾城区',
    status: '在用',
  },
  {
    id: 'hd_m_1',
    cityName: '邯郸市',
    level: 'municipal',
    name: '邯郸市东武仕水库',
    type: '地表水',
    county: '磁县',
    status: '在用',
  },
  {
    id: 'hd_t_1',
    cityName: '邯郸市',
    level: 'township',
    name: '某乡镇水厂',
    type: '地下水',
    county: '涉县',
    status: '在建',
  },
];

describe('getCityKnownSources', () => {
  it('按城市+级别分组过滤扁平记录', () => {
    const sjz = getCityKnownSources('石家庄市', records);
    expect(sjz.municipal.length).toBe(2);
    expect(sjz.county.length).toBe(1);
    expect(sjz.township.length).toBe(0);
  });

  it('正确转换字段（name/type/subType/county/status）', () => {
    const sjz = getCityKnownSources('石家庄市', records);
    expect(sjz.municipal[0]).toEqual({
      name: '岗南水库',
      type: '地表水',
      subType: '湖库型',
      county: '平山县',
      status: '在用',
    });
  });

  it('不同城市互不干扰', () => {
    const hd = getCityKnownSources('邯郸市', records);
    expect(hd.municipal.length).toBe(1);
    expect(hd.township.length).toBe(1);
    expect(hd.county.length).toBe(0);
  });

  it('未知城市返回空分组', () => {
    const none = getCityKnownSources('保定市', records);
    expect(none.municipal).toEqual([]);
    expect(none.county).toEqual([]);
    expect(none.township).toEqual([]);
  });

  it('空数组返回空分组', () => {
    const empty = getCityKnownSources('石家庄市', []);
    expect(empty.municipal).toEqual([]);
    expect(empty.county).toEqual([]);
    expect(empty.township).toEqual([]);
  });
});

describe('countCityKnownSources', () => {
  it('汇总各级别总数', () => {
    const sjz = getCityKnownSources('石家庄市', records);
    expect(countCityKnownSources(sjz)).toBe(3);
  });
});

describe('toWaterSourceInfo', () => {
  it('单条记录转换为展示信息', () => {
    const info = toWaterSourceInfo(records[0]);
    expect(info.name).toBe('岗南水库');
    expect(info.type).toBe('地表水');
    expect(info.subType).toBe('湖库型');
  });
});
