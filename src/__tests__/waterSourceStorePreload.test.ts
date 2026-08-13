/**
 * waterSourceStore 城市后台补齐（preloadRemainingCities）测试
 *
 * 背景（P6 优化）：进入统计页（Dashboard）会主动触发 preloadRemainingCities
 * 补齐其余城市数据。store 新增 preloadingCities 状态，用于在补齐过程中
 * 向统计面板提示"正在加载其余城市数据"。
 *
 * 本测试验证：
 * 1. 补齐完成后 sources 合并全部城市、preloadingCities 复位为 false
 * 2. missing 城市为空时不进入补齐（preloadingCities 保持 false）
 * 3. 防重入：补齐进行中重复调用直接返回
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ===== mock 外部依赖 =====

// idb：跟踪写入
const idbMocks = {
  dbGetAll: vi.fn(),
  dbPutBatch: vi.fn(),
  dbClear: vi.fn(),
};
vi.mock('@/lib/idb', () => ({
  dbClear: (...a: unknown[]) => idbMocks.dbClear(...a),
  dbGetAll: (...a: unknown[]) => idbMocks.dbGetAll(...a),
  dbPutBatch: (...a: unknown[]) => idbMocks.dbPutBatch(...a),
  dbPut: vi.fn(),
  dbCount: vi.fn(),
  dbDelete: vi.fn(),
}));

// cityDataRegistry：多城市，用于验证补齐合并
const cityMeta = (name: string, code: string) => ({
  cityWaterSources: {
    cityName: name,
    cityCode: code,
    municipal: [
      {
        name: `${name}水源地`,
        type: '地下水',
        county: '县',
        level: '市级',
        status: '在用',
      },
    ],
    district: [],
    county: [],
  },
});
vi.mock('@/data/cityDataRegistry', () => ({
  DEFAULT_CITY: '石家庄市',
  CITY_LIST: ['石家庄市', '唐山市', '保定市'],
  loadCityData: vi.fn(async (cityName: string) =>
    cityMeta(cityName, cityName === '石家庄市' ? '130100' : cityName === '唐山市' ? '130200' : '130600'),
  ),
}));

import { useWaterSourceStore } from '@/stores/waterSourceStore';

const shijiazhuang = {
  id: 'sjz-1',
  cityName: '石家庄市',
  level: 'municipal' as const,
  name: '岗南水库',
  type: '地下水' as const,
  county: '平山县',
  status: '在用' as const,
};

describe('waterSourceStore 城市后台补齐（preloadingCities）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWaterSourceStore.setState({
      loaded: true,
      sources: [shijiazhuang],
      cityMetas: [],
      preloadingCities: false,
      error: null,
    });
  });

  it('补齐完成后 sources 合并全部城市，preloadingCities 复位为 false', async () => {
    await useWaterSourceStore.getState().preloadRemainingCities();

    const { sources, preloadingCities } = useWaterSourceStore.getState();
    const cities = new Set(sources.map((s) => s.cityName));
    expect(cities).toEqual(new Set(['石家庄市', '唐山市', '保定市']));
    expect(preloadingCities).toBe(false);
  });

  it('missing 城市为空时不进入补齐，preloadingCities 保持 false', async () => {
    // 已加载全部城市 → missing 为空
    useWaterSourceStore.setState({
      sources: [
        shijiazhuang,
        { ...shijiazhuang, id: 'ts-1', cityName: '唐山市' },
        { ...shijiazhuang, id: 'bd-1', cityName: '保定市' },
      ],
    });

    await useWaterSourceStore.getState().preloadRemainingCities();

    expect(useWaterSourceStore.getState().preloadingCities).toBe(false);
    // 不触发任何写入
    expect(idbMocks.dbPutBatch).not.toHaveBeenCalled();
  });

  it('补齐进行中（preloadingCities=true）时重复调用直接返回（防重入）', async () => {
    useWaterSourceStore.setState({ preloadingCities: true });

    await useWaterSourceStore.getState().preloadRemainingCities();

    // 防重入提前 return，不触发写入、不清除标志
    expect(idbMocks.dbPutBatch).not.toHaveBeenCalled();
    expect(useWaterSourceStore.getState().preloadingCities).toBe(true);
  });
});
