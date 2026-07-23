/**
 * 水源地数据 Store（IndexedDB驱动）
 *
 * 职责：
 * 1. 首次启动时，从 hebeiWaterSources.ts 静态数据初始化 IDB
 * 2. 所有水源地读写操作走 IDB（CRUD + 查询）
 * 3. 为 Dashboard/MapView/Home 提供响应式数据
 * 4. 支持水源地增删改
 * 5. 自动记录变更日志和版本快照
 */

import { create } from 'zustand';
import { dbGetAll, dbPutBatch, dbPut, dbDelete, dbCount, dbClear } from '@/lib/idb';
import { ensureVersionStores, recordChange, createSnapshot } from '@/lib/dataVersionEngine';
import { CalcParams, ZoneResult } from '@/lib/zoneCalcEngine';

// ===== IDB 中的水源地记录 =====
export interface WaterSourceRecord {
  id: string;
  cityName: string;
  level: 'municipal' | 'county' | 'township';
  name: string;
  type: '地表水' | '地下水';
  subType?: string;
  county: string;
  status: string;
  remark?: string;
  population?: number;
  river?: string;
  lng?: number;
  lat?: number;
  dataVersion?: number;
}

export interface CityMeta {
  cityName: string;
  cityCode: string;
  area?: number;
}

interface WaterSourceState {
  loaded: boolean;
  initializing: boolean;
  sources: WaterSourceRecord[];
  cityMetas: CityMeta[];
  error: string | null;

  initDB: () => Promise<void>;
  reloadFromDB: () => Promise<void>;

  addSource: (source: Omit<WaterSourceRecord, 'id'>) => Promise<string>;
  updateSource: (id: string, updates: Partial<WaterSourceRecord>) => Promise<void>;
  deleteSource: (id: string) => Promise<void>;

  getByCity: (cityName: string) => WaterSourceRecord[];
  getByCityAndLevel: (cityName: string, level: string) => WaterSourceRecord[];
  getByType: (type: string) => WaterSourceRecord[];
  getByCounty: (county: string) => WaterSourceRecord[];

  getStats: () => {
    totalCities: number;
    totalMunicipal: number;
    totalCounty: number;
    totalTownship: number;
    total: number;
    totalSurface: number;
    totalGround: number;
    surfaceRatio: string;
  };

  exportJSON: () => string;
  importJSON: (json: string, mode: 'merge' | 'replace') => Promise<number>;

  zoneResults: ZoneCalcRecord[];
  saveZoneResult: (result: ZoneCalcRecord) => Promise<void>;
  deleteZoneResult: (id: string) => Promise<void>;
  clearZoneResults: () => Promise<void>;
  loadZoneResults: () => Promise<void>;
  getZoneResultBySourceId: (sourceId: string) => ZoneCalcRecord | undefined;

  resetToStatic: () => Promise<void>;
  rollbackToVersion: (versionId: string) => Promise<number>;
}

export interface ZoneCalcRecord {
  id: string;
  sourceId: string;
  sourceName: string;
  params: CalcParams;
  zones: ZoneResult[];
  calculatedAt: string;
  warnings: string[];
  customParams?: {
    K?: string;
    M?: string;
    T?: string;
    S?: string;
    I?: string;
    ne?: string;
    riverFlow?: string;
    riverWidth?: string;
    riverDepth?: string;
    riverSlope?: string;
    lakeArea?: string;
    lakeCapacity?: string;
    maxDepth?: string;
  };
}

const DATA_VERSION = 1;
let changeCounter = 0;
const AUTO_SNAPSHOT_INTERVAL = 20;

function genId(cityName: string, level: string, name: string): string {
  return `${cityName}_${level}_${name}`.replace(/\s+/g, '_');
}

// P2-1: 动态加载静态数据，避免打包入首屏 chunk
type HebeiWaterSourceEntry = {
  cityName: string;
  cityCode: string;
  municipal: any[];
  county: any[];
  township?: any[];
};

async function loadStaticData(): Promise<{ sources: HebeiWaterSourceEntry[]; geo: any[] }> {
  const [{ hebeiWaterSources }, { waterSourceGeo }] = await Promise.all([
    import('@/data/hebeiWaterSources'),
    import('@/data/waterSourceGeoData'),
  ]);
  return { sources: hebeiWaterSources, geo: waterSourceGeo };
}

function buildRecordsFromStatic(
  data: HebeiWaterSourceEntry[],
  geoData: any[],
): { sources: WaterSourceRecord[]; metas: CityMeta[] } {
  const sources: WaterSourceRecord[] = [];
  const metas: CityMeta[] = [];

  const geoIndex = new Map<string, { lng: number; lat: number }>();
  if (geoData && Array.isArray(geoData)) {
    for (const g of geoData) {
      if (g && g.city && g.name && typeof g.lng === 'number' && typeof g.lat === 'number') {
        geoIndex.set(`${g.city}_${g.name}`, { lng: g.lng, lat: g.lat });
      }
    }
  }

  for (const city of data) {
    metas.push({ cityName: city.cityName, cityCode: city.cityCode });

    const levels: Array<{ level: 'municipal' | 'county' | 'township'; data: Array<any> }> = [
      { level: 'municipal', data: city.municipal },
      { level: 'county', data: city.county },
      { level: 'township', data: city.township || [] },
    ];

    for (const { level, data } of levels) {
      if (!Array.isArray(data)) continue;
      for (const ws of data) {
        if (!ws || !ws.name) continue;
        const id = genId(city.cityName, level, ws.name);
        const geo = geoIndex.get(`${city.cityName}_${ws.name}`);
        sources.push({
          id,
          cityName: city.cityName,
          level,
          name: ws.name,
          type: ws.type || '地下水',
          subType: ws.subType,
          county: ws.county,
          status: ws.status || '在用',
          remark: ws.remark,
          population: ws.population,
          river: ws.river,
          lng: geo?.lng,
          lat: geo?.lat,
          dataVersion: DATA_VERSION,
        });
      }
    }
  }
  return { sources, metas };
}

let versionStoresInitialized = false;
async function ensureVersionInit(): Promise<void> {
  if (versionStoresInitialized) return;
  try {
    await ensureVersionStores();
    versionStoresInitialized = true;
  } catch (e) {
    console.warn('Version stores init failed:', e);
  }
}

async function checkAutoSnapshot(sources: WaterSourceRecord[]): Promise<void> {
  changeCounter++;
  if (changeCounter % AUTO_SNAPSHOT_INTERVAL !== 0) return;
  try {
    await createSnapshot(
      sources.map((s) => ({ ...s })),
      {
        type: 'auto',
        name: `自动快照 #${Math.floor(changeCounter / AUTO_SNAPSHOT_INTERVAL)}`,
        description: `${AUTO_SNAPSHOT_INTERVAL}次变更后的自动备份`,
      },
    );
  } catch (e) {
    console.warn('Auto snapshot failed:', e);
  }
}

export const useWaterSourceStore = create<WaterSourceState>((set, get) => ({
  loaded: false,
  initializing: false,
  sources: [],
  cityMetas: [],
  zoneResults: [],
  error: null,

  initDB: async () => {
    if (get().initializing) return;
    set({ initializing: true, error: null });
    try {
      let count = 0;
      try {
        count = await dbCount('water_sources');
      } catch {
        /* ignore */
      }

      if (count === 0 || count < 500) {
        if (count > 0) {
          await dbClear('water_sources');
          await dbClear('cities');
          await dbClear('app_meta');
        }
        const { sources: staticData, geo } = await loadStaticData();
        const { sources, metas } = buildRecordsFromStatic(staticData, geo);
        await dbPutBatch('water_sources', sources);
        await dbPutBatch('cities', metas);
        await dbPut('app_meta', { key: 'data_version', value: DATA_VERSION });
        set({ sources, cityMetas: metas, loaded: true, initializing: false });
        await ensureVersionInit();
        await createSnapshot(
          sources.map((s) => ({ ...s })),
          {
            type: 'auto',
            name: '初始数据',
            description: `从静态数据初始化，共 ${sources.length} 条记录`,
          },
        );
      } else {
        const sources = await dbGetAll<WaterSourceRecord>('water_sources');
        const metas = await dbGetAll<CityMeta>('cities');
        set({ sources, cityMetas: metas, loaded: true, initializing: false });
      }
      await ensureVersionInit();
    } catch (e) {
      set({ error: (e as Error).message || String(e), initializing: false, loaded: true });
    }
  },

  reloadFromDB: async () => {
    try {
      const sources = await dbGetAll<WaterSourceRecord>('water_sources');
      const metas = await dbGetAll<CityMeta>('cities');
      set({ sources, cityMetas: metas, loaded: true });
    } catch (e) {
      console.error('Failed to reload:', e);
    }
  },

  addSource: async (sourceData) => {
    const id = genId(sourceData.cityName, sourceData.level, sourceData.name);
    const record: WaterSourceRecord = { ...sourceData, id, dataVersion: DATA_VERSION };
    await dbPut('water_sources', record);
    set((s) => {
      const newSources = [...s.sources, record];
      ensureVersionInit().then(() => {
        recordChange({
          versionId: '',
          timestamp: new Date().toISOString(),
          action: 'add',
          recordId: id,
          recordName: sourceData.name,
          description: `新增水源地 "${sourceData.name}"`,
        });
        checkAutoSnapshot(newSources);
      });
      return { sources: newSources };
    });
    return id;
  },

  updateSource: async (id, updates) => {
    const current = get().sources.find((s) => s.id === id);
    if (!current) return;
    const updated = { ...current, ...updates };
    await dbPut('water_sources', updated);
    set((s) => {
      const newSources = s.sources.map((s) => (s.id === id ? updated : s));
      const diffs = Object.entries(updates)
        .filter(([k]) => k !== 'id' && k !== 'dataVersion')
        .map(([k, v]) => ({
          field: k,
          oldValue: (current as unknown as Record<string, unknown>)[k],
          newValue: v,
        }));
      if (diffs.length > 0) {
        ensureVersionInit().then(() => {
          recordChange({
            versionId: '',
            timestamp: new Date().toISOString(),
            action: 'update',
            recordId: id,
            recordName: current.name,
            description: `修改水源地 "${current.name}"：${diffs.map((d) => d.field).join(', ')}`,
            diff: diffs,
          });
          checkAutoSnapshot(newSources);
        });
      }
      return { sources: newSources };
    });
  },

  deleteSource: async (id) => {
    const current = get().sources.find((s) => s.id === id);
    await dbDelete('water_sources', id);
    set((s) => {
      const newSources = s.sources.filter((s) => s.id !== id);
      if (current) {
        ensureVersionInit().then(() => {
          recordChange({
            versionId: '',
            timestamp: new Date().toISOString(),
            action: 'delete',
            recordId: id,
            recordName: current.name,
            description: `删除水源地 "${current.name}"`,
          });
          checkAutoSnapshot(newSources);
        });
      }
      return { sources: newSources };
    });
  },

  getByCity: (cityName) => get().sources.filter((s) => s.cityName === cityName),
  getByCityAndLevel: (cityName, level) =>
    get().sources.filter((s) => s.cityName === cityName && s.level === level),
  getByType: (type) => get().sources.filter((s) => s.type === type),
  getByCounty: (county) => get().sources.filter((s) => s.county === county),

  getStats: () => {
    const { sources } = get();
    const citySet = new Set(sources.map((s) => s.cityName));
    let m = 0,
      c = 0,
      t = 0,
      sf = 0,
      g = 0;
    for (const s of sources) {
      if (s.level === 'municipal') m++;
      else if (s.level === 'county') c++;
      else t++;
      if (s.type === '地表水') sf++;
      else g++;
    }
    const total = m + c + t;
    return {
      totalCities: citySet.size,
      totalMunicipal: m,
      totalCounty: c,
      totalTownship: t,
      total,
      totalSurface: sf,
      totalGround: g,
      surfaceRatio: total > 0 ? ((sf / total) * 100).toFixed(1) + '%' : '0%',
    };
  },

  exportJSON: () => {
    const { sources, cityMetas } = get();
    return JSON.stringify(
      { version: DATA_VERSION, exportedAt: new Date().toISOString(), sources, cityMetas },
      null,
      2,
    );
  },

  importJSON: async (json, mode) => {
    const data = JSON.parse(json);
    const incoming = (data.sources || []) as WaterSourceRecord[];
    if (mode === 'replace') {
      await dbClear('water_sources');
      await dbPutBatch('water_sources', incoming);
      set({ sources: incoming });
      await ensureVersionInit();
      await createSnapshot(
        incoming.map((s) => ({ ...s })),
        {
          type: 'auto',
          name: 'JSON导入（替换）',
          description: `从JSON导入 ${incoming.length} 条记录（替换模式）`,
        },
      );
      return incoming.length;
    }
    const existing = get().sources;
    const existingIds = new Set(existing.map((s) => s.id));
    const newItems = incoming.filter((s) => !existingIds.has(s.id));
    if (newItems.length > 0) await dbPutBatch('water_sources', newItems);
    const updated = incoming.filter((s) => existingIds.has(s.id));
    for (const item of updated) await dbPut('water_sources', item);
    const merged = [...existing.map((e) => updated.find((u) => u.id === e.id) || e), ...newItems];
    set({ sources: merged });
    if (newItems.length > 0 || updated.length > 0) {
      await ensureVersionInit();
      await createSnapshot(
        merged.map((s) => ({ ...s })),
        {
          type: 'auto',
          name: 'JSON导入（合并）',
          description: `新增 ${newItems.length} 条，更新 ${updated.length} 条`,
        },
      );
    }
    return newItems.length;
  },

  saveZoneResult: async (record) => {
    await dbPut('zone_results', record);
    set((s) => ({ zoneResults: [...s.zoneResults.filter((z) => z.id !== record.id), record] }));
  },

  deleteZoneResult: async (id) => {
    await dbDelete('zone_results', id);
    set((s) => ({ zoneResults: s.zoneResults.filter((z) => z.id !== id) }));
  },

  clearZoneResults: async () => {
    await dbClear('zone_results');
    set({ zoneResults: [] });
  },

  loadZoneResults: async () => {
    try {
      const results = await dbGetAll<ZoneCalcRecord>('zone_results');
      set({ zoneResults: results });
    } catch (e) {
      console.error('Failed to load zone results:', e);
    }
  },

  getZoneResultBySourceId: (sourceId) => get().zoneResults.find((z) => z.sourceId === sourceId),

  resetToStatic: async () => {
    await dbClear('water_sources');
    await dbClear('cities');
    await dbClear('app_meta');
    set({ loaded: false, sources: [], cityMetas: [] });
    await get().initDB();
  },

  rollbackToVersion: async (versionId) => {
    const { rollbackToVersion: rollback } = await import('@/lib/dataVersionEngine');
    const result = await rollback(versionId);
    if (!result) throw new Error('版本数据无效');
    const sources = result.data as unknown as WaterSourceRecord[];
    const currentSources = get().sources;
    await createSnapshot(
      currentSources.map((s) => ({ ...s })),
      {
        type: 'auto',
        name: '回滚前备份',
        description: `回滚到 "${result.version.name}" 前的自动备份`,
      },
    );
    await dbClear('water_sources');
    await dbPutBatch('water_sources', sources);
    set({ sources });
    return sources.length;
  },
}));
