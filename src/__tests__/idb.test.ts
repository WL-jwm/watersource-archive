import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * idb.ts 测试 — 使用 mock 验证 CRUD 函数行为
 */

const mockObjectStore: any = {
  getAll: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  clear: vi.fn(),
  count: vi.fn(),
  index: vi.fn(() => ({ getAll: vi.fn() })),
  createIndex: vi.fn(),
};

const mockTransaction: any = {
  objectStore: vi.fn(() => mockObjectStore),
  oncomplete: null,
  onerror: null,
  error: null,
};

const mockDB: any = {
  objectStoreNames: { contains: vi.fn(() => true) },
  createObjectStore: vi.fn(() => mockObjectStore),
  close: vi.fn(),
  transaction: vi.fn(() => mockTransaction),
};

const mockOpenRequest: any = {
  onupgradeneeded: null,
  onsuccess: null,
  onerror: null,
  result: mockDB,
  error: null,
};

vi.stubGlobal('indexedDB', {
  open: vi.fn(() => mockOpenRequest),
});

import {
  dbGetAll,
  dbGet,
  dbPut,
  dbPutBatch,
  dbDelete,
  dbClear,
  dbCount,
  dbGetByIndex,
  closeDB,
  getDB,
} from '@/lib/idb';

/** 辅助：创建一个会自动触发 onsuccess 的 mock request */
function makeAutoRequest(result: any) {
  const req: any = {
    onsuccess: null,
    onerror: null,
    result,
    error: null,
  };
  setTimeout(() => {
    if (req.onsuccess) req.onsuccess({ target: req });
  }, 0);
  return req;
}

describe('idb - IndexedDB封装', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // 初始化数据库连接
    const openReq = (indexedDB as any).open('test', 2);
    setTimeout(() => {
      if (openReq.onsuccess) openReq.onsuccess({ target: openReq });
    }, 0);
    await getDB();
  });

  afterEach(() => {
    closeDB();
  });

  it('T01-dbPut存储数据调用store.put', async () => {
    mockObjectStore.put.mockImplementationOnce(() => makeAutoRequest(undefined));
    const data = { id: 'r1', name: 'test' };
    await dbPut('water_sources', data);
    expect(mockObjectStore.put).toHaveBeenCalledWith(data);
  });

  it('T02-dbGetAll获取全部记录', async () => {
    const mockData = [{ id: 'r1' }, { id: 'r2' }];
    mockObjectStore.getAll.mockImplementationOnce(() => makeAutoRequest(mockData));
    const result = await dbGetAll('water_sources');
    expect(result).toEqual(mockData);
  });

  it('T03-dbGet按键获取记录', async () => {
    const mockData = { id: 'r1', name: 'test' };
    mockObjectStore.get.mockImplementationOnce(() => makeAutoRequest(mockData));
    const result = await dbGet('water_sources', 'r1');
    expect(result).toEqual(mockData);
  });

  it('T04-dbDelete删除记录', async () => {
    mockObjectStore.delete.mockImplementationOnce(() => makeAutoRequest(undefined));
    await dbDelete('water_sources', 'r1');
    expect(mockObjectStore.delete).toHaveBeenCalledWith('r1');
  });

  it('T05-dbClear清空存储', async () => {
    mockObjectStore.clear.mockImplementationOnce(() => makeAutoRequest(undefined));
    await dbClear('water_sources');
    expect(mockObjectStore.clear).toHaveBeenCalled();
  });

  it('T06-dbCount获取记录数', async () => {
    mockObjectStore.count.mockImplementationOnce(() => makeAutoRequest(42));
    const result = await dbCount('water_sources');
    expect(result).toBe(42);
  });

  it('T07-dbGetByIndex按索引查询', async () => {
    const mockData = [{ id: 'r1', cityName: '石家庄市' }];
    const mockIndex: any = { getAll: vi.fn(() => makeAutoRequest(mockData)) };
    mockObjectStore.index.mockReturnValueOnce(mockIndex);
    const result = await dbGetByIndex('water_sources', 'cityName', '石家庄市');
    expect(result).toEqual(mockData);
  });

  it('T08-dbPutBatch分批写入大量数据', async () => {
    const data = Array.from({ length: 250 }, (_, i) => ({ id: `r${i}` }));
    // Mock transaction with oncomplete 触发
    mockDB.transaction = vi.fn(() => {
      const tx: any = {
        objectStore: vi.fn(() => ({ put: vi.fn() })),
        oncomplete: null,
        onerror: null,
        error: null,
      };
      setTimeout(() => {
        if (tx.oncomplete) tx.oncomplete({} as Event);
      }, 0);
      return tx;
    });
    await dbPutBatch('water_sources', data);
    // 250 条 / batch_size=100 = 3 次事务
    expect(mockDB.transaction).toHaveBeenCalledTimes(3);
  });

  it('T09-closeDB关闭数据库连接', async () => {
    closeDB();
    expect(mockDB.close).toHaveBeenCalled();
  });
});
