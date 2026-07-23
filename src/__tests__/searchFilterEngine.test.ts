import { describe, it, expect, beforeEach } from 'vitest';
import {
  type SortCriteria,
  advancedFilter,
  quickSearch,
  getSearchSuggestions,
  extractFilterOptions,
  emptyCriteria,
  debounce,
  getHighlightSegments,
  loadFilterPresets,
  saveFilterPreset,
  deleteFilterPreset,
} from '@/lib/searchFilterEngine';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';

// ===== 测试数据 =====

function makeRecord(overrides: Partial<WaterSourceRecord> = {}): WaterSourceRecord {
  return {
    id: 'test_1',
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
    lat: 38.2739,
    dataVersion: 1,
    ...overrides,
  };
}

const testData: WaterSourceRecord[] = [
  makeRecord({ id: 'r1', name: '岗南水库', cityName: '石家庄市', county: '平山县', level: 'municipal', type: '地表水', subType: '湖库型', status: '在用', population: 500000, river: '滹沱河', lng: 114.21, lat: 38.27 }),
  makeRecord({ id: 'r2', name: '黄壁庄水库', cityName: '石家庄市', county: '鹿泉区', level: 'municipal', type: '地表水', subType: '湖库型', status: '在用', population: 480000, river: '滹沱河', lng: 114.30, lat: 38.09 }),
  makeRecord({ id: 'r3', name: '陡河水库', cityName: '唐山市', county: '开平区', level: 'municipal', type: '地表水', subType: '湖库型', status: '在用', population: 300000, river: '陡河', lng: 118.32, lat: 39.70 }),
  makeRecord({ id: 'r4', name: '洋河水库', cityName: '秦皇岛市', county: '抚宁区', level: 'municipal', type: '地表水', subType: '湖库型', status: '备用', population: 200000, river: '洋河', lng: 119.25, lat: 39.88 }),
  makeRecord({ id: 'r5', name: '万全镇水源地', cityName: '张家口市', county: '万全区', level: 'county', type: '地下水', subType: '孔隙水', status: '在用', population: 35000, river: undefined, lng: 114.74, lat: 40.78 }),
  makeRecord({ id: 'r6', name: '安家堡水源地', cityName: '张家口市', county: '万全区', level: 'county', type: '地下水', subType: '孔隙水', status: '在用', population: 28000, river: undefined, lng: 114.70, lat: 40.75 }),
  makeRecord({ id: 'r7', name: '云州水库', cityName: '张家口市', county: '赤城县', level: 'municipal', type: '地表水', subType: '湖库型', status: '备用', population: 100000, river: '白河', lng: 115.73, lat: 40.70 }),
  makeRecord({ id: 'r8', name: '观洲湖水库', cityName: '沧州市', county: '吴桥县', level: 'county', type: '地表水', subType: '湖库型', status: '取消', population: 0, river: undefined, lng: 116.45, lat: 37.65 }),
];

// ===== 筛选测试 =====

describe('advancedFilter - 基础筛选', () => {
  it('T01-空条件返回全部', () => {
    const result = advancedFilter(testData, emptyCriteria());
    expect(result.records.length).toBe(8);
    expect(result.stats.filtered).toBe(8);
    expect(result.stats.total).toBe(8);
  });

  it('T02-城市筛选', () => {
    const result = advancedFilter(testData, { ...emptyCriteria(), cities: ['石家庄市'] });
    expect(result.records.length).toBe(2);
    expect(result.records.every((r) => r.cityName === '石家庄市')).toBe(true);
  });

  it('T03-多城市筛选', () => {
    const result = advancedFilter(testData, { ...emptyCriteria(), cities: ['石家庄市', '唐山市'] });
    expect(result.records.length).toBe(3);
  });

  it('T04-级别筛选', () => {
    const result = advancedFilter(testData, { ...emptyCriteria(), levels: ['county'] });
    expect(result.records.length).toBe(3);
    expect(result.records.every((r) => r.level === 'county')).toBe(true);
  });

  it('T05-类型筛选', () => {
    const result = advancedFilter(testData, { ...emptyCriteria(), types: ['地下水'] });
    expect(result.records.length).toBe(2);
    expect(result.records.every((r) => r.type === '地下水')).toBe(true);
  });

  it('T06-状态筛选', () => {
    const result = advancedFilter(testData, { ...emptyCriteria(), statuses: ['备用'] });
    expect(result.records.length).toBe(2);
    expect(result.records.every((r) => r.status === '备用')).toBe(true);
  });

  it('T07-子类型筛选', () => {
    const result = advancedFilter(testData, { ...emptyCriteria(), subTypes: ['孔隙水'] });
    expect(result.records.length).toBe(2);
  });

  it('T08-河流筛选', () => {
    const result = advancedFilter(testData, { ...emptyCriteria(), rivers: ['滹沱河'] });
    expect(result.records.length).toBe(2);
  });
});

describe('advancedFilter - 组合筛选', () => {
  it('T09-城市+级别组合', () => {
    const result = advancedFilter(testData, {
      ...emptyCriteria(),
      cities: ['张家口市'],
      levels: ['county'],
    });
    expect(result.records.length).toBe(2);
  });

  it('T10-城市+类型+状态组合', () => {
    const result = advancedFilter(testData, {
      ...emptyCriteria(),
      cities: ['石家庄市'],
      types: ['地表水'],
      statuses: ['在用'],
    });
    expect(result.records.length).toBe(2);
  });

  it('T11-人口范围筛选', () => {
    const result = advancedFilter(testData, {
      ...emptyCriteria(),
      populationMin: 100000,
      populationMax: 500000,
    });
    expect(result.records.length).toBe(5); // r1(500k), r2(480k), r3(300k), r4(200k), r7(100k)
  });

  it('T12-仅含有坐标的记录', () => {
    const result = advancedFilter(testData, {
      ...emptyCriteria(),
      hasCoordsOnly: true,
    });
    expect(result.records.length).toBe(8); // 所有测试数据都有坐标
  });

  it('T13-经度范围筛选', () => {
    const result = advancedFilter(testData, {
      ...emptyCriteria(),
      lngRange: [114.0, 115.0],
    });
    expect(result.records.length).toBe(4); // r1, r2, r5, r6
  });
});

// ===== 搜索测试 =====

describe('advancedFilter - 关键词搜索', () => {
  it('T14-名称搜索', () => {
    const result = advancedFilter(testData, { ...emptyCriteria(), keyword: '岗南' });
    expect(result.records.length).toBe(1);
    expect(result.records[0].name).toBe('岗南水库');
  });

  it('T15-县区搜索', () => {
    const result = advancedFilter(testData, { ...emptyCriteria(), keyword: '平山' });
    expect(result.records.length).toBe(1);
    expect(result.records[0].county).toBe('平山县');
  });

  it('T16-河流搜索', () => {
    const result = advancedFilter(testData, { ...emptyCriteria(), keyword: '滹沱河' });
    expect(result.records.length).toBe(2);
  });

  it('T17-拼音搜索-sjz匹配石家庄', () => {
    const result = advancedFilter(testData, { ...emptyCriteria(), keyword: 'sjz' });
    expect(result.records.length).toBe(2); // 石家庄市的两个
  });

  it('T18-拼音搜索-gn匹配岗南', () => {
    const result = advancedFilter(testData, { ...emptyCriteria(), keyword: 'gn' });
    expect(result.records.length).toBeGreaterThanOrEqual(1);
    expect(result.records.some((r) => r.name === '岗南水库')).toBe(true);
  });

  it('T19-搜索匹配信息返回', () => {
    const result = advancedFilter(testData, { ...emptyCriteria(), keyword: '岗南' });
    expect(result.matches.size).toBe(1);
    const matchList = result.matches.get('r1');
    expect(matchList).toBeDefined();
    expect(matchList![0].field).toBe('name');
  });

  it('T20-大小写不敏感', () => {
    const result = advancedFilter(testData, { ...emptyCriteria(), keyword: 'SJZ' });
    expect(result.records.length).toBe(2);
  });

  it('T21-无匹配返回空', () => {
    const result = advancedFilter(testData, { ...emptyCriteria(), keyword: '不存在的名字xyz' });
    expect(result.records.length).toBe(0);
  });

  it('T22-空关键词不做搜索过滤', () => {
    const result = advancedFilter(testData, { ...emptyCriteria(), keyword: '' });
    expect(result.records.length).toBe(8);
  });
});

// ===== 排序测试 =====

describe('advancedFilter - 排序', () => {
  it('T23-按名称升序', () => {
    const sort: SortCriteria = { field: 'name', direction: 'asc' };
    const result = advancedFilter(testData, emptyCriteria(), sort);
    expect(result.records[0].name).toBe('安家堡水源地');
  });

  it('T24-按名称降序', () => {
    const sort: SortCriteria = { field: 'name', direction: 'desc' };
    const result = advancedFilter(testData, emptyCriteria(), sort);
    expect(result.records[0].name).toBe('云州水库');
  });

  it('T25-按人口降序', () => {
    const sort: SortCriteria = { field: 'population', direction: 'desc' };
    const result = advancedFilter(testData, emptyCriteria(), sort);
    expect(result.records[0].population).toBe(500000);
  });

  it('T26-按城市升序', () => {
    const sort: SortCriteria = { field: 'cityName', direction: 'asc' };
    const result = advancedFilter(testData, emptyCriteria(), sort);
    expect(result.records[0].cityName).toBe('沧州市'); // 按拼音排序 C < S
  });

  it('T27-无排序保持原序', () => {
    const result = advancedFilter(testData, emptyCriteria());
    expect(result.records[0].id).toBe('r1');
    expect(result.records[7].id).toBe('r8');
  });
});

// ===== 统计测试 =====

describe('advancedFilter - 统计', () => {
  it('T28-按城市统计', () => {
    const result = advancedFilter(testData, { ...emptyCriteria(), types: ['地下水'] });
    expect(result.stats.byCity['张家口市']).toBe(2);
    expect(result.stats.byCity['石家庄市']).toBeUndefined();
  });

  it('T29-按级别统计', () => {
    const result = advancedFilter(testData, emptyCriteria());
    expect(result.stats.byLevel['municipal']).toBe(5);
    expect(result.stats.byLevel['county']).toBe(3);
  });

  it('T30-按状态统计', () => {
    const result = advancedFilter(testData, emptyCriteria());
    expect(result.stats.byStatus['在用']).toBe(5);
    expect(result.stats.byStatus['备用']).toBe(2);
    expect(result.stats.byStatus['取消']).toBe(1);
  });
});

// ===== 快速搜索测试 =====

describe('quickSearch', () => {
  it('T31-返回带匹配信息的结果', () => {
    const results = quickSearch(testData, '水库', 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].matches.length).toBeGreaterThan(0);
  });

  it('T32-limit参数生效', () => {
    const results = quickSearch(testData, '水', 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it('T33-空关键词返回空', () => {
    const results = quickSearch(testData, '', 5);
    expect(results.length).toBe(0);
  });

  it('T34-拼音快速搜索', () => {
    const results = quickSearch(testData, 'dh', 5);
    expect(results.some((r) => r.record.name === '陡河水库')).toBe(true);
  });

  it('T35-按权重排序（名称匹配优先）', () => {
    const results = quickSearch(testData, '洋河', 5);
    // 洋河水库（名称匹配）应排在前面
    const idx = results.findIndex((r) => r.record.name === '洋河水库');
    expect(idx).toBe(0);
  });
});

// ===== 搜索建议测试 =====

describe('getSearchSuggestions', () => {
  it('T36-返回名称建议', () => {
    const suggestions = getSearchSuggestions(testData, '水库', 5);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => s.includes('水库'))).toBe(true);
  });

  it('T37-返回河流建议', () => {
    const suggestions = getSearchSuggestions(testData, '滹', 5);
    expect(suggestions).toContain('滹沱河');
  });

  it('T38-limit限制', () => {
    const suggestions = getSearchSuggestions(testData, '水', 3);
    expect(suggestions.length).toBeLessThanOrEqual(3);
  });

  it('T39-空关键词返回空', () => {
    const suggestions = getSearchSuggestions(testData, '', 5);
    expect(suggestions.length).toBe(0);
  });
});

// ===== 选项提取测试 =====

describe('extractFilterOptions', () => {
  it('T40-提取城市列表', () => {
    const options = extractFilterOptions(testData);
    expect(options.cities.length).toBe(5); // 石家庄/唐山/秦皇岛/张家口/沧州
    expect(options.cities).toContain('石家庄市');
  });

  it('T41-提取级别列表', () => {
    const options = extractFilterOptions(testData);
    expect(options.levels).toContain('municipal');
    expect(options.levels).toContain('county');
  });

  it('T42-提取状态列表', () => {
    const options = extractFilterOptions(testData);
    expect(options.statuses).toContain('在用');
    expect(options.statuses).toContain('备用');
    expect(options.statuses).toContain('取消');
  });

  it('T43-提取河流列表', () => {
    const options = extractFilterOptions(testData);
    expect(options.rivers).toContain('滹沱河');
    expect(options.rivers).toContain('陡河');
  });
});

// ===== 高亮工具测试 =====

describe('getHighlightSegments', () => {
  it('T44-无匹配返回整段普通文本', () => {
    const segments = getHighlightSegments('岗南水库', undefined);
    expect(segments.length).toBe(1);
    expect(segments[0].highlighted).toBe(false);
  });

  it('T45-开头匹配', () => {
    const segments = getHighlightSegments('岗南水库', { field: 'name', start: 0, length: 2 });
    expect(segments.length).toBe(2);
    expect(segments[0].text).toBe('岗南');
    expect(segments[0].highlighted).toBe(true);
    expect(segments[1].text).toBe('水库');
    expect(segments[1].highlighted).toBe(false);
  });

  it('T46-中间匹配', () => {
    const segments = getHighlightSegments('黄壁庄水库', { field: 'name', start: 1, length: 2 });
    expect(segments.length).toBe(3);
    expect(segments[0].text).toBe('黄');
    expect(segments[1].text).toBe('壁庄');
    expect(segments[1].highlighted).toBe(true);
    expect(segments[2].text).toBe('水库');
  });

  it('T47-全长匹配', () => {
    const segments = getHighlightSegments('岗南', { field: 'name', start: 0, length: 2 });
    expect(segments.length).toBe(1);
    expect(segments[0].highlighted).toBe(true);
  });
});

// ===== 防抖测试 =====

describe('debounce', () => {
  it('T48-防抖延迟执行', async () => {
    let called = 0;
    const debounced = debounce(() => { called++; }, 100);
    debounced();
    debounced();
    debounced();
    expect(called).toBe(0);
    await new Promise((r) => setTimeout(r, 150));
    expect(called).toBe(1);
  });
});

// ===== 筛选预设测试 =====

describe('Filter Presets', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('T49-保存和加载预设', () => {
    const preset = {
      id: 'preset_1',
      name: '石家庄地下水',
      criteria: { ...emptyCriteria(), cities: ['石家庄市'], types: ['地下水'] },
      createdAt: new Date().toISOString(),
    };
    saveFilterPreset(preset);
    const presets = loadFilterPresets();
    expect(presets.length).toBe(1);
    expect(presets[0].name).toBe('石家庄地下水');
  });

  it('T50-更新已有预设', () => {
    const preset = {
      id: 'preset_1',
      name: '原始名称',
      criteria: emptyCriteria(),
      createdAt: new Date().toISOString(),
    };
    saveFilterPreset(preset);
    saveFilterPreset({ ...preset, name: '更新名称' });
    const presets = loadFilterPresets();
    expect(presets.length).toBe(1);
    expect(presets[0].name).toBe('更新名称');
  });

  it('T51-删除预设', () => {
    const preset = {
      id: 'preset_1',
      name: '测试',
      criteria: emptyCriteria(),
      createdAt: new Date().toISOString(),
    };
    saveFilterPreset(preset);
    expect(loadFilterPresets().length).toBe(1);
    deleteFilterPreset('preset_1');
    expect(loadFilterPresets().length).toBe(0);
  });
});
