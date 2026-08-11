/**
 * waterSourceStore 二次访问缓存优化测试
 *
 * 验证 initDB 的短路逻辑：当 store 已加载完成（loaded && sources.length > 0）时，
 * 再次调用 initDB 直接返回，不再重复执行 dbCount + dbGetAll 全量读取。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ===== mock 外部依赖 =====

// idb：跟踪 dbCount / dbGetAll 调用次数
const idbMocks = {
  dbCount: vi.fn(),
  dbGetAll: vi.fn(),
  dbPutBatch: vi.fn(),
  dbPut: vi.fn(),
  dbClear: vi.fn(),
  dbDelete: vi.fn(),
};
vi.mock('@/lib/idb', () => ({
  dbClear: (...a: unknown[]) => idbMocks.dbClear(...a),
  dbCount: (...a: unknown[]) => idbMocks.dbCount(...a),
  dbDelete: (...a: unknown[]) => idbMocks.dbDelete(...a),
  dbGetAll: (...a: unknown[]) => idbMocks.dbGetAll(...a),
  dbPut: (...a: unknown[]) => idbMocks.dbPut(...a),
  dbPutBatch: (...a: unknown[]) => idbMocks.dbPutBatch(...a),
}));

// cityDataRegistry：返回默认城市数据
vi.mock('@/data/cityDataRegistry', () => ({
  DEFAULT_CITY: '石家庄市',
  CITY_LIST: ['石家庄市'],
  loadCityData: vi.fn(async () => ({
    cityWaterSources: {
      cityName: '石家庄市',
      cityCode: '130100',
      municipal: [
        {
          name: '岗南水库',
          type: '地表水',
          county: '平山县',
          status: '在用',
        },
      ],
      county: [],
    },
    cityGeo: [],
  })),
}));

// trashEngine / dataVersionEngine / undoManager / auditTrail / inverseOps
vi.mock('@/lib/trashEngine', () => ({
  getTrashStats: vi.fn(async () => ({ total: 0, expiringSoon: 0, expired: 0 })),
  listTrash: vi.fn(async () => []),
  purge: vi.fn(async () => {}),
  purgeAll: vi.fn(async () => 0),
  restore: vi.fn(async () => null),
  softDelete: vi.fn(async () => {}),
}));
vi.mock('@/lib/dataVersionEngine', () => ({
  createSnapshot: vi.fn(async () => {}),
  ensureVersionStores: vi.fn(async () => {}),
  recordChange: vi.fn(async () => {}),
}));
vi.mock('@/lib/undoManager', () => ({
  undoManager: { isExecuting: vi.fn(() => false) },
}));
vi.mock('@/lib/auditTrail', () => ({
  logAudit: vi.fn(),
}));
vi.mock('@/lib/inverseOps', () => ({
  recordAddSource: vi.fn(),
  recordUpdateSource: vi.fn(),
  recordDeleteSource: vi.fn(),
  recordImportReplace: vi.fn(),
  recordImportMerge: vi.fn(),
  recordSaveZoneResult: vi.fn(),
  recordDeleteZoneResult: vi.fn(),
  recordResetToStatic: vi.fn(),
}));

import { useWaterSourceStore } from '@/stores/waterSourceStore';

describe('waterSourceStore 二次访问缓存优化', () => {
  beforeEach(() => {
    idbMocks.dbCount.mockReset();
    idbMocks.dbGetAll.mockReset();
    idbMocks.dbPutBatch.mockReset();
    idbMocks.dbPut.mockReset();
    idbMocks.dbClear.mockReset();
  });

  it('首次 initDB 执行全量读取（dbCount + 写入）', async () => {
    idbMocks.dbCount.mockResolvedValue(0);
    idbMocks.dbPutBatch.mockResolvedValue(undefined);
    idbMocks.dbPut.mockResolvedValue(undefined);

    await useWaterSourceStore.getState().initDB();

    expect(idbMocks.dbCount).toHaveBeenCalledTimes(1);
    // 首次加载默认城市会写入 water_sources + cities
    expect(idbMocks.dbPutBatch).toHaveBeenCalled();
    expect(useWaterSourceStore.getState().loaded).toBe(true);
    expect(useWaterSourceStore.getState().sources.length).toBeGreaterThan(0);
  });

  it('已加载完成后再次 initDB 短路，不再重复读取', async () => {
    // 模拟已加载状态
    useWaterSourceStore.setState({ loaded: true, sources: [{ id: 'x', cityName: '石家庄市', level: 'municipal', name: '岗南水库', type: '地表水', county: '平山县', status: '在用' }], cityMetas: [] });

    idbMocks.dbCount.mockResolvedValue(0);
    idbMocks.dbGetAll.mockResolvedValue([]);

    await useWaterSourceStore.getState().initDB();

    // 短路：不再执行 dbCount 读取
    expect(idbMocks.dbCount).not.toHaveBeenCalled();
    expect(idbMocks.dbGetAll).not.toHaveBeenCalled();
  });

  it('sources 为空时不短路（数据异常时允许重新加载）', async () => {
    useWaterSourceStore.setState({ loaded: true, sources: [] });
    idbMocks.dbCount.mockResolvedValue(0);

    await useWaterSourceStore.getState().initDB();

    // 数据为空，仍会执行读取路径
    expect(idbMocks.dbCount).toHaveBeenCalled();
  });
});
