/**
 * 数据源 Store (Zustand + IDB)
 *
 * 职责：
 * 1. 管理所有已注册的数据源元数据
 * 2. 持久化数据源配置到 IDB
 * 3. 协调多数据源加载与合并
 * 4. 为 waterSourceStore 提供统一的数据加载入口
 */

import { create } from 'zustand';
import { dbGetAll, dbPut, dbPutBatch, dbDelete, dbClear } from '@/lib/idb';
import {
  type DataSourceMeta,
  type DataSourceType,
  type MergeStrategy,
  type ConflictResolution,
  type DataSourceLoadResult,
  type MergeResult,
  dataSourceRegistry,
  createDataSourceMeta,
  mergeDataSources,
  calculateChecksum,
  getDataSourceTypeLabel,
} from '@/lib/dataSourceRegistry';
import type { WaterSourceRecord } from './waterSourceStore';

// IDB store 名称
const DS_STORE = 'data_sources';

/** 数据源配置持久化记录 */
interface DataSourcePersistRecord {
  id: string;
  data: string; // JSON serialized DataSourceMeta
}

interface DataSourceState {
  /** 所有已注册的数据源 */
  sources: DataSourceMeta[];
  /** 是否已加载 */
  loaded: boolean;
  /** 是否正在加载/合并 */
  merging: boolean;
  /** 上次合并结果 */
  lastMergeResult: MergeResult | null;
  /** 错误信息 */
  error: string | null;

  /** 初始化：从 IDB 加载已保存的数据源配置 */
  init: () => Promise<void>;
  /** 添加数据源 */
  addSource: (params: {
    name: string;
    type: DataSourceType;
    description?: string;
    config?: Record<string, unknown>;
    priority?: number;
    mergeStrategy?: MergeStrategy;
    conflictResolution?: ConflictResolution;
  }) => Promise<string>;
  /** 更新数据源 */
  updateSource: (id: string, updates: Partial<DataSourceMeta>) => Promise<void>;
  /** 删除数据源 */
  removeSource: (id: string) => Promise<void>;
  /** 启用/禁用数据源 */
  toggleSource: (id: string, enabled?: boolean) => Promise<void>;
  /** 调整优先级 */
  setPriority: (id: string, priority: number) => Promise<void>;
  /** 加载单个数据源 */
  loadSource: (id: string) => Promise<DataSourceLoadResult>;
  /** 加载并合并所有启用的数据源 */
  loadAndMergeAll: () => Promise<MergeResult>;
  /** 获取默认数据源（静态内置） */
  getDefaultSource: () => DataSourceMeta | undefined;
  /** 重置为默认配置 */
  resetToDefault: () => Promise<void>;
}

/** 确保数据源 store 在 IDB 中存在 */
async function ensureDSStore(): Promise<void> {
  const db = await (await import('@/lib/idb')).getDB();
  if (!db.objectStoreNames.contains(DS_STORE)) {
    // 需要升级数据库版本
    const VERSION_STORES = 'version_snapshots';
    const CHANGELOG_STORE = 'change_log';
    const newVersion = db.version + 1;
    db.close();
    const request = indexedDB.open('watersource-archive', newVersion);
    request.onupgradeneeded = (event) => {
      const d = (event.target as IDBOpenDBRequest).result;
      if (!d.objectStoreNames.contains(DS_STORE)) {
        d.createObjectStore(DS_STORE, { keyPath: 'id' });
      }
      // 确保其他 store 也存在
      if (!d.objectStoreNames.contains(VERSION_STORES)) {
        d.createObjectStore(VERSION_STORES, { keyPath: 'id' });
      }
      if (!d.objectStoreNames.contains(CHANGELOG_STORE)) {
        d.createObjectStore(CHANGELOG_STORE, { keyPath: 'id' });
      }
    };
    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }
}

/** 持久化数据源到 IDB */
async function persistSource(meta: DataSourceMeta): Promise<void> {
  await ensureDSStore();
  const record: DataSourcePersistRecord = {
    id: meta.id,
    data: JSON.stringify(meta),
  };
  await dbPut(DS_STORE, record);
}

/** 批量持久化 */
async function persistBatch(metas: DataSourceMeta[]): Promise<void> {
  await ensureDSStore();
  const records: DataSourcePersistRecord[] = metas.map((m) => ({
    id: m.id,
    data: JSON.stringify(m),
  }));
  await dbPutBatch(DS_STORE, records);
}

/** 从 IDB 读取所有数据源 */
async function loadPersistedSources(): Promise<DataSourceMeta[]> {
  await ensureDSStore();
  const records = await dbGetAll<DataSourcePersistRecord>(DS_STORE);
  return records
    .map((r) => {
      try {
        return JSON.parse(r.data) as DataSourceMeta;
      } catch {
        return null;
      }
    })
    .filter((m): m is DataSourceMeta => m !== null);
}

/** 创建默认数据源 */
function createDefaultSources(): DataSourceMeta[] {
  return [
    createDataSourceMeta({
      id: 'ds_static_default',
      name: '河北省水源地数据库（内置）',
      type: 'static',
      description:
        '基于河北省生态环境厅公开数据整理的全省水源地名录，包含地市级、县级、乡镇级水源地',
      priority: 10,
      mergeStrategy: 'replace',
      conflictResolution: 'latest-wins',
      config: { module: 'hebeiWaterSources' },
    }),
    createDataSourceMeta({
      id: 'ds_manual_default',
      name: '用户手动录入',
      type: 'manual',
      description: '用户在应用内直接新增或编辑的水源地记录，存储在本地 IndexedDB',
      priority: 5,
      mergeStrategy: 'merge-by-key',
      conflictResolution: 'source-priority',
    }),
  ];
}

export const useDataSourceStore = create<DataSourceState>((set, get) => ({
  sources: [],
  loaded: false,
  merging: false,
  lastMergeResult: null,
  error: null,

  init: async () => {
    try {
      let persisted = await loadPersistedSources();
      if (persisted.length === 0) {
        // 首次初始化：创建默认数据源
        persisted = createDefaultSources();
        await persistBatch(persisted);
      }
      set({ sources: persisted, loaded: true });
    } catch (e) {
      console.error('DataSource store init failed:', e);
      set({ error: String(e), loaded: true });
    }
  },

  addSource: async (params) => {
    const meta = createDataSourceMeta({
      name: params.name,
      type: params.type,
      description: params.description,
      config: params.config,
      priority: params.priority ?? 100,
      mergeStrategy: params.mergeStrategy,
      conflictResolution: params.conflictResolution,
    });
    await persistSource(meta);
    set((state) => ({ sources: [...state.sources, meta] }));
    return meta.id;
  },

  updateSource: async (id, updates) => {
    const { sources } = get();
    const idx = sources.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const updated: DataSourceMeta = {
      ...sources[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await persistSource(updated);
    const newSources = [...sources];
    newSources[idx] = updated;
    set({ sources: newSources });
  },

  removeSource: async (id) => {
    await ensureDSStore();
    await dbDelete(DS_STORE, id);
    set((state) => ({ sources: state.sources.filter((s) => s.id !== id) }));
  },

  toggleSource: async (id, enabled) => {
    const source = get().sources.find((s) => s.id === id);
    if (!source) return;
    await get().updateSource(id, { enabled: enabled ?? !source.enabled });
  },

  setPriority: async (id, priority) => {
    await get().updateSource(id, { priority });
  },

  loadSource: async (id) => {
    const source = get().sources.find((s) => s.id === id);
    if (!source) throw new Error(`数据源 ${id} 不存在`);
    const adapter = dataSourceRegistry.getAdapter(source.type);
    if (!adapter) throw new Error(`数据源类型 ${source.type} 无注册适配器`);

    // 更新状态为加载中
    await get().updateSource(id, { status: 'loading', error: undefined });

    try {
      const result = await adapter.load(source);

      // 计算校验和
      const checksum = calculateChecksum(result.records);

      await get().updateSource(id, {
        status: 'ready',
        lastLoadedAt: new Date().toISOString(),
        recordCount: result.records.length,
        checksum,
        error: undefined,
      });

      return result;
    } catch (e) {
      await get().updateSource(id, { status: 'error', error: String(e) });
      throw e;
    }
  },

  loadAndMergeAll: async () => {
    set({ merging: true, error: null });
    try {
      const { sources } = get();
      const enabledSources = sources.filter((s) => s.enabled && s.status !== 'disabled');

      const loaded: Array<{ meta: DataSourceMeta; records: WaterSourceRecord[] }> = [];

      for (const source of enabledSources) {
        try {
          const result = await get().loadSource(source.id);
          if (result.records.length > 0) {
            loaded.push({ meta: source, records: result.records });
          }
        } catch (e) {
          console.warn(`数据源 "${source.name}" 加载失败:`, e);
        }
      }

      // 使用最高优先级数据源的合并策略
      const primarySource = enabledSources.sort((a, b) => a.priority - b.priority)[0];
      const mergeResult = mergeDataSources(loaded, {
        strategy: primarySource?.mergeStrategy || 'merge-by-key',
        conflictResolution: primarySource?.conflictResolution || 'latest-wins',
        priorityOrder: true,
      });

      set({ lastMergeResult: mergeResult, merging: false });
      return mergeResult;
    } catch (e) {
      set({ merging: false, error: String(e) });
      throw e;
    }
  },

  getDefaultSource: () => {
    return get().sources.find((s) => s.type === 'static');
  },

  resetToDefault: async () => {
    await ensureDSStore();
    await dbClear(DS_STORE);
    const defaults = createDefaultSources();
    await persistBatch(defaults);
    set({ sources: defaults, lastMergeResult: null });
  },
}));

export { getDataSourceTypeLabel };
