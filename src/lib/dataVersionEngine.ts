/* ===== 数据版本管理引擎 =====
 * 支持版本快照、变更记录、版本对比、回滚
 * 基于 IndexedDB 存储
 */

import { getDB, dbGetAll, dbPut, dbDelete, dbClear } from './idb';

// ===== 类型定义 =====

/** 版本快照 */
export interface DataVersion {
  id: string;
  name: string;
  /** 版本类型 */
  type: 'auto' | 'manual';
  /** 创建时间 */
  createdAt: string;
  /** 版本描述 */
  description: string;
  /** 当时的数据快照（全量 WaterSourceRecord JSON） */
  snapshot: string;
  /** 水源地数量 */
  sourceCount: number;
  /** 标签 */
  tags?: string[];
}

/** 变更记录 */
export interface ChangeLog {
  id: string;
  /** 所属版本ID */
  versionId: string;
  /** 变更时间 */
  timestamp: string;
  /** 变更类型 */
  action: 'add' | 'update' | 'delete';
  /** 记录ID */
  recordId: string;
  /** 记录名称 */
  recordName: string;
  /** 变更说明 */
  description: string;
  /** 字段级 diff */
  diff?: FieldDiff[];
}

/** 字段级差异 */
export interface FieldDiff {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

/** 版本对比结果 */
export interface VersionDiff {
  /** 新增的记录 */
  added: { id: string; name: string; data: Record<string, unknown> }[];
  /** 删除的记录 */
  removed: { id: string; name: string; data: Record<string, unknown> }[];
  /** 修改的记录 */
  modified: { id: string; name: string; changes: FieldDiff[] }[];
  /** 无变化的记录数 */
  unchanged: number;
}

/** 版本摘要（列表用，不含快照） */
export interface VersionSummary {
  id: string;
  name: string;
  type: 'auto' | 'manual';
  createdAt: string;
  description: string;
  sourceCount: number;
  tags?: string[];
}

// ===== 常量 =====

const VERSIONS_STORE = 'data_versions';
const CHANGELOG_STORE = 'data_changelog';
const DB_VERSION = 3;
const MAX_AUTO_VERSIONS = 20; // 最多保留20个自动快照

// ===== 数据库初始化 =====

/** 确保版本管理相关 store 存在 */
export async function ensureVersionStores(): Promise<void> {
  const db = await getDB();
  // 如果 store 已存在则跳过
  if (db.objectStoreNames.contains(VERSIONS_STORE)) return;

  // 需要升级版本
  db.close();
  // 重新打开触发 onupgradeneeded
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('watersource-archive', DB_VERSION);
    request.onupgradeneeded = (event) => {
      const d = (event.target as IDBOpenDBRequest).result;
      if (!d.objectStoreNames.contains(VERSIONS_STORE)) {
        const store = d.createObjectStore(VERSIONS_STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }
      if (!d.objectStoreNames.contains(CHANGELOG_STORE)) {
        const logStore = d.createObjectStore(CHANGELOG_STORE, { keyPath: 'id' });
        logStore.createIndex('versionId', 'versionId', { unique: false });
        logStore.createIndex('timestamp', 'timestamp', { unique: false });
        logStore.createIndex('action', 'action', { unique: false });
      }
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

// ===== 版本快照操作 =====

/** 生成唯一ID */
function genId(): string {
  return `v${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 创建版本快照 */
export async function createSnapshot(
  sources: Record<string, unknown>[],
  options: {
    name?: string;
    type?: 'auto' | 'manual';
    description?: string;
    tags?: string[];
  } = {},
): Promise<DataVersion> {
  await ensureVersionStores();

  const version: DataVersion = {
    id: genId(),
    name: options.name || `版本 ${new Date().toLocaleString('zh-CN')}`,
    type: options.type || 'auto',
    createdAt: new Date().toISOString(),
    description: options.description || '',
    snapshot: JSON.stringify(sources),
    sourceCount: sources.length,
    tags: options.tags,
  };

  await dbPut(VERSIONS_STORE, version);

  // 自动清理旧版本
  if (version.type === 'auto') {
    await pruneAutoVersions();
  }

  return version;
}

/** 获取所有版本摘要 */
export async function listVersions(): Promise<VersionSummary[]> {
  await ensureVersionStores();
  const versions = await dbGetAll<DataVersion>(VERSIONS_STORE);
  return versions
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(({ snapshot, ...rest }) => rest);
}

/** 获取单个版本（含快照） */
export async function getVersion(id: string): Promise<DataVersion | undefined> {
  await ensureVersionStores();
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VERSIONS_STORE, 'readonly');
    const store = tx.objectStore(VERSIONS_STORE);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** 删除版本 */
export async function deleteVersion(id: string): Promise<void> {
  await ensureVersionStores();
  await dbDelete(VERSIONS_STORE, id);
  // 同时删除关联的变更记录
  const logs = await getChangeLogs(id);
  for (const log of logs) {
    await dbDelete(CHANGELOG_STORE, log.id);
  }
}

/** 清理旧自动版本（保留最近 MAX_AUTO_VERSIONS 个） */
async function pruneAutoVersions(): Promise<void> {
  const versions = await dbGetAll<DataVersion>(VERSIONS_STORE);
  const autoVersions = versions
    .filter((v) => v.type === 'auto')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (autoVersions.length <= MAX_AUTO_VERSIONS) return;

  const toDelete = autoVersions.slice(MAX_AUTO_VERSIONS);
  for (const v of toDelete) {
    await dbDelete(VERSIONS_STORE, v.id);
    const logs = await getChangeLogs(v.id);
    for (const log of logs) {
      await dbDelete(CHANGELOG_STORE, log.id);
    }
  }
}

// ===== 变更记录 =====

/** 记录一条变更 */
export async function recordChange(log: Omit<ChangeLog, 'id'>): Promise<ChangeLog> {
  await ensureVersionStores();
  const record: ChangeLog = {
    ...log,
    id: `cl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };
  await dbPut(CHANGELOG_STORE, record);
  return record;
}

/** 批量记录变更 */
export async function recordChanges(logs: Omit<ChangeLog, 'id'>[]): Promise<ChangeLog[]> {
  await ensureVersionStores();
  const records = logs.map((log) => ({
    ...log,
    id: `cl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  }));
  for (const r of records) {
    await dbPut(CHANGELOG_STORE, r);
  }
  return records;
}

/** 获取指定版本的变更记录 */
export async function getChangeLogs(versionId: string): Promise<ChangeLog[]> {
  await ensureVersionStores();
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHANGELOG_STORE, 'readonly');
    const store = tx.objectStore(CHANGELOG_STORE);
    const index = store.index('versionId');
    const req = index.getAll(versionId);
    req.onsuccess = () =>
      resolve(req.result.sort((a, b) => a.timestamp.localeCompare(b.timestamp)));
    req.onerror = () => reject(req.error);
  });
}

/** 获取所有变更记录（按时间倒序） */
export async function getAllChangeLogs(limit = 200): Promise<ChangeLog[]> {
  await ensureVersionStores();
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHANGELOG_STORE, 'readonly');
    const store = tx.objectStore(CHANGELOG_STORE);
    const index = store.index('timestamp');
    const req = index.getAll();
    req.onsuccess = () => {
      const all = req.result as ChangeLog[];
      resolve(all.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit));
    };
    req.onerror = () => reject(req.error);
  });
}

// ===== 版本对比 =====

/** 计算两个版本之间的差异 */
export function diffVersions(
  oldData: Record<string, unknown>[],
  newData: Record<string, unknown>[],
): VersionDiff {
  const oldMap = new Map(oldData.map((d) => [(d as Record<string, string>).id || '', d]));
  const newMap = new Map(newData.map((d) => [(d as Record<string, string>).id || '', d]));

  const added: VersionDiff['added'] = [];
  const removed: VersionDiff['removed'] = [];
  const modified: VersionDiff['modified'] = [];
  let unchanged = 0;

  // 检查新增和修改
  for (const [id, newItem] of newMap) {
    const oldItem = oldMap.get(id);
    if (!oldItem) {
      added.push({
        id,
        name: (newItem as Record<string, string>).name || id,
        data: newItem as Record<string, unknown>,
      });
    } else {
      const changes = computeFieldDiff(oldItem, newItem);
      if (changes.length > 0) {
        modified.push({
          id,
          name: (newItem as Record<string, string>).name || id,
          changes,
        });
      } else {
        unchanged++;
      }
    }
  }

  // 检查删除
  for (const [id, oldItem] of oldMap) {
    if (!newMap.has(id)) {
      removed.push({
        id,
        name: (oldItem as Record<string, string>).name || id,
        data: oldItem as Record<string, unknown>,
      });
    }
  }

  return { added, removed, modified, unchanged };
}

/** 计算两个对象的字段级差异 */
function computeFieldDiff(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
): FieldDiff[] {
  const changes: FieldDiff[] = [];
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

  for (const key of allKeys) {
    // 忽略内部字段
    if (key === 'id' || key === 'dataVersion') continue;
    const oldVal = oldObj[key];
    const newVal = newObj[key];

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({ field: key, oldValue: oldVal, newValue: newVal });
    }
  }

  return changes;
}

// ===== 回滚 =====

/** 从版本快照恢复数据 */
export function extractSnapshot(version: DataVersion): Record<string, unknown>[] {
  try {
    return JSON.parse(version.snapshot);
  } catch {
    return [];
  }
}

/** 回滚到指定版本（返回回滚后的数据） */
export async function rollbackToVersion(
  versionId: string,
): Promise<{ data: Record<string, unknown>[]; version: DataVersion } | null> {
  const version = await getVersion(versionId);
  if (!version) return null;

  const data = extractSnapshot(version);
  return { data, version };
}

// ===== 工具函数 =====

/** 格式化版本时间 */
export function formatVersionTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 格式化变更类型 */
export function formatAction(action: string): string {
  const map: Record<string, string> = {
    add: '新增',
    update: '修改',
    delete: '删除',
  };
  return map[action] || action;
}
