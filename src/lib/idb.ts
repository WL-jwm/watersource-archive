/**
 * IndexedDB 轻量封装
 *
 * 不依赖 idb 库，基于原生 IndexedDB API 封装，
 * 提供 Promise 化的 CRUD 操作，专为水源地数据管理设计。
 *
 * 数据库结构：
 * - water_sources: 存储所有水源地记录（级别/类型/县区/城市/坐标等）
 * - cities: 存储城市元数据（面积/代码等）
 * - app_meta: 存储应用级元数据（初始化版本号等）
 */

const DB_NAME = 'watersource-archive';
const DB_VERSION = 2;

let dbInstance: IDBDatabase | null = null;

/** 获取/创建数据库连接 */
export async function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 水源地表
      if (!db.objectStoreNames.contains('water_sources')) {
        const store = db.createObjectStore('water_sources', { keyPath: 'id' });
        store.createIndex('cityName', 'cityName', { unique: false });
        store.createIndex('level', 'level', { unique: false });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('county', 'county', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('cityLevel', ['cityName', 'level'], { unique: false });
      }

      // 城市元数据表
      if (!db.objectStoreNames.contains('cities')) {
        const cityStore = db.createObjectStore('cities', { keyPath: 'cityName' });
      }

      // 应用元数据表
      if (!db.objectStoreNames.contains('app_meta')) {
        db.createObjectStore('app_meta', { keyPath: 'key' });
      }

      // 保护区计算结果表
      if (!db.objectStoreNames.contains('zone_results')) {
        const zoneStore = db.createObjectStore('zone_results', { keyPath: 'id' });
        zoneStore.createIndex('sourceId', 'sourceId', { unique: false });
        zoneStore.createIndex('sourceName', 'sourceName', { unique: false });
        zoneStore.createIndex('calculatedAt', 'calculatedAt', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

// ===== 通用操作 =====

/** 获取一个 ObjectStore 的读写事务 */
async function getStore<T>(
  storeName: string,
  mode: 'readonly' | 'readwrite' = 'readonly',
): Promise<IDBObjectStore> {
  const db = await getDB();
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

/** 通用 getAll */
export async function dbGetAll<T>(storeName: string): Promise<T[]> {
  const store = await getStore<T>(storeName);
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** 通用 get by key */
export async function dbGet<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const store = await getStore<T>(storeName);
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** 通用 put (insert or update) */
export async function dbPut<T>(storeName: string, value: T): Promise<void> {
  const store = await getStore<T>(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put(value);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** 通用 put batch（分批处理，每批100条） */
export async function dbPutBatch<T>(storeName: string, values: T[]): Promise<void> {
  const BATCH_SIZE = 100;
  for (let i = 0; i < values.length; i += BATCH_SIZE) {
    const batch = values.slice(i, i + BATCH_SIZE);
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      for (const v of batch) {
        store.put(v);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

/** 通用 delete */
export async function dbDelete(storeName: string, key: IDBValidKey): Promise<void> {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** 通用 clear */
export async function dbClear(storeName: string): Promise<void> {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** 按 index 查询 */
export async function dbGetByIndex<T>(
  storeName: string,
  indexName: string,
  value: IDBValidKey,
): Promise<T[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const req = index.getAll(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** 获取记录数 */
export async function dbCount(storeName: string): Promise<number> {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** 关闭数据库连接 */
export function closeDB(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
