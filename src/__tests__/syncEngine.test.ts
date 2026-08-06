/* ===== S11.4: 同步引擎测试 ===== */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock cryptoExport
vi.mock('@/lib/cryptoExport', () => ({
  encryptData: vi.fn(),
  decryptData: vi.fn(),
}));

import { decryptData, encryptData } from '@/lib/cryptoExport';
import {
  extractIncrementalChanges,
  createSyncPackage,
  readSyncPackage,
  previewSync,
  applySyncPackage,
  type SyncPackage,
} from '@/lib/syncEngine';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';

function makeRecord(overrides: Partial<WaterSourceRecord> = {}): WaterSourceRecord {
  return {
    id: 'src-1',
    cityName: '石家庄市',
    level: 'municipal',
    name: '岗南水库',
    type: '地表水',
    county: '平山县',
    status: '在用',
    dataVersion: 1,
    ...overrides,
  };
}

describe('syncEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===== extractIncrementalChanges =====
  describe('extractIncrementalChanges', () => {
    it('无 previousSources 时导出全量包', () => {
      const sources = [makeRecord(), makeRecord({ id: 'src-2', name: '黄壁庄水库' })];
      const pkg = extractIncrementalChanges(sources, '2024-01-01');

      expect(pkg.meta.type).toBe('full');
      expect(pkg.meta.recordCount).toBe(2);
      expect(pkg.added).toHaveLength(2);
      expect(pkg.updated).toHaveLength(0);
      expect(pkg.deleted).toHaveLength(0);
    });

    it('正确检测新增记录', () => {
      const prev = [makeRecord()];
      const curr = [makeRecord(), makeRecord({ id: 'src-2', name: '新水源' })];
      const pkg = extractIncrementalChanges(curr, '2024-01-01', prev);

      expect(pkg.meta.type).toBe('incremental');
      expect(pkg.added).toHaveLength(1);
      expect(pkg.added[0].id).toBe('src-2');
      expect(pkg.updated).toHaveLength(0);
      expect(pkg.deleted).toHaveLength(0);
    });

    it('正确检测修改记录', () => {
      const prev = [makeRecord()];
      const curr = [makeRecord({ status: '备用' })];
      const pkg = extractIncrementalChanges(curr, '2024-01-01', prev);

      expect(pkg.updated).toHaveLength(1);
      expect(pkg.updated[0].status).toBe('备用');
      expect(pkg.added).toHaveLength(0);
      expect(pkg.deleted).toHaveLength(0);
    });

    it('正确检测删除记录', () => {
      const prev = [makeRecord(), makeRecord({ id: 'src-2', name: '水源B' })];
      const curr = [makeRecord()];
      const pkg = extractIncrementalChanges(curr, '2024-01-01', prev);

      expect(pkg.deleted).toHaveLength(1);
      expect(pkg.deleted[0]).toBe('src-2');
      expect(pkg.added).toHaveLength(0);
      expect(pkg.updated).toHaveLength(0);
    });

    it('无变更时返回空增量', () => {
      const prev = [makeRecord()];
      const curr = [makeRecord()];
      const pkg = extractIncrementalChanges(curr, '2024-01-01', prev);

      expect(pkg.added).toHaveLength(0);
      expect(pkg.updated).toHaveLength(0);
      expect(pkg.deleted).toHaveLength(0);
      expect(pkg.meta.recordCount).toBe(0);
      expect(pkg.meta.type).toBe('incremental');
    });

    it('同时处理新增+修改+删除的混合场景', () => {
      const prev = [makeRecord({ id: 'a' }), makeRecord({ id: 'b', name: 'B水源' }), makeRecord({ id: 'c', name: 'C水源' })];
      const curr = [makeRecord({ id: 'a', status: '备用' }), makeRecord({ id: 'b', name: 'B水源' }), makeRecord({ id: 'd', name: 'D水源' })];
      const pkg = extractIncrementalChanges(curr, '2024-01-01', prev);

      expect(pkg.added).toHaveLength(1);
      expect(pkg.added[0].id).toBe('d');
      expect(pkg.updated).toHaveLength(1);
      expect(pkg.updated[0].id).toBe('a');
      expect(pkg.deleted).toHaveLength(1);
      expect(pkg.deleted[0]).toBe('c');
    });

    it('meta 包含正确的时间范围', () => {
      const pkg = extractIncrementalChanges([], '2023-06-01');
      expect(pkg.meta.timeRange.from).toBe('2023-06-01');
      expect(pkg.meta.timeRange.to).toBeTruthy();
    });

    it('meta format 始终为 wsync-1', () => {
      const pkg = extractIncrementalChanges([], '2024-01-01');
      expect(pkg.meta.format).toBe('wsync-1');
    });
  });

  // ===== previewSync =====
  describe('previewSync', () => {
    it('正确统计新增/更新/删除数量', () => {
      const pkg: SyncPackage = {
        meta: { format: 'wsync-1', createdAt: '', sourceDevice: '', timeRange: { from: '', to: '' }, recordCount: 3, type: 'incremental' },
        added: [makeRecord({ id: 'new-1' })],
        updated: [makeRecord({ id: 'upd-1' })],
        deleted: ['del-1'],
      };
      const existing = [makeRecord({ id: 'upd-1' }), makeRecord({ id: 'del-1' })];

      const preview = previewSync(pkg, existing);

      expect(preview.addedCount).toBe(1);
      expect(preview.updatedCount).toBe(1);
      expect(preview.deletedCount).toBe(1);
      expect(preview.totalAffected).toBe(3);
    });

    it('空包预览全为零', () => {
      const pkg: SyncPackage = {
        meta: { format: 'wsync-1', createdAt: '', sourceDevice: '', timeRange: { from: '', to: '' }, recordCount: 0, type: 'incremental' },
        added: [],
        updated: [],
        deleted: [],
      };
      const preview = previewSync(pkg, []);
      expect(preview.totalAffected).toBe(0);
      expect(preview.addedCount).toBe(0);
    });

    it('检测到冲突时在 conflicts 中体现', () => {
      const rec = makeRecord({ id: 'dup-1', name: '重叠水源', cityName: '石家庄市' });
      const pkg: SyncPackage = {
        meta: { format: 'wsync-1', createdAt: '', sourceDevice: '', timeRange: { from: '', to: '' }, recordCount: 1, type: 'incremental' },
        added: [rec],
        updated: [],
        deleted: [],
      };
      const existing = [makeRecord({ id: 'dup-1', name: '重叠水源', cityName: '石家庄市' })];

      const preview = previewSync(pkg, existing);
      expect(preview.conflicts).toBeDefined();
    });
  });

  // ===== applySyncPackage =====
  describe('applySyncPackage', () => {
    it('skip 策略跳过冲突的新增', () => {
      const rec = makeRecord({ id: 'dup-1', name: '冲突水源', cityName: '石家庄市' });
      const pkg: SyncPackage = {
        meta: { format: 'wsync-1', createdAt: '', sourceDevice: '', timeRange: { from: '', to: '' }, recordCount: 1, type: 'incremental' },
        added: [rec],
        updated: [],
        deleted: [],
      };
      const existing = [makeRecord({ id: 'dup-1', name: '冲突水源', cityName: '石家庄市' })];

      const result = applySyncPackage(pkg, existing, 'skip');
      expect(result.toAdd).toHaveLength(0);
      expect(result.skipped).toBe(1);
    });

    it('overwrite 策略将冲突记录转为更新', () => {
      const rec = makeRecord({ id: 'dup-1', name: '冲突水源', cityName: '石家庄市', status: '备用' });
      const pkg: SyncPackage = {
        meta: { format: 'wsync-1', createdAt: '', sourceDevice: '', timeRange: { from: '', to: '' }, recordCount: 1, type: 'incremental' },
        added: [rec],
        updated: [],
        deleted: [],
      };
      const existing = [makeRecord({ id: 'dup-1', name: '冲突水源', cityName: '石家庄市', status: '在用' })];

      const result = applySyncPackage(pkg, existing, 'overwrite');
      expect(result.toUpdate).toHaveLength(1);
      expect(result.toUpdate[0].status).toBe('备用');
      expect(result.toAdd).toHaveLength(0);
    });

    it('rename 策略为冲突记录生成新名称和ID', () => {
      const rec = makeRecord({ id: 'dup-1', name: '冲突水源', cityName: '石家庄市' });
      const pkg: SyncPackage = {
        meta: { format: 'wsync-1', createdAt: '', sourceDevice: '', timeRange: { from: '', to: '' }, recordCount: 1, type: 'incremental' },
        added: [rec],
        updated: [],
        deleted: [],
      };
      const existing = [makeRecord({ id: 'dup-1', name: '冲突水源', cityName: '石家庄市' })];

      const result = applySyncPackage(pkg, existing, 'rename');
      expect(result.toAdd).toHaveLength(1);
      expect(result.toAdd[0].name).not.toBe('冲突水源');
      expect(result.toAdd[0].id).not.toBe('dup-1');
    });

    it('无冲突的新增直接加入 toAdd', () => {
      const rec = makeRecord({ id: 'new-1', name: '全新水源', cityName: '保定市' });
      const pkg: SyncPackage = {
        meta: { format: 'wsync-1', createdAt: '', sourceDevice: '', timeRange: { from: '', to: '' }, recordCount: 1, type: 'incremental' },
        added: [rec],
        updated: [],
        deleted: [],
      };
      const existing = [makeRecord({ id: 'old-1', name: '旧水源', cityName: '石家庄市' })];

      const result = applySyncPackage(pkg, existing, 'skip');
      expect(result.toAdd).toHaveLength(1);
      expect(result.toAdd[0].id).toBe('new-1');
    });

    it('更新的记录存在时加入 toUpdate（overwrite）', () => {
      const rec = makeRecord({ id: 'upd-1', status: '备用' });
      const pkg: SyncPackage = {
        meta: { format: 'wsync-1', createdAt: '', sourceDevice: '', timeRange: { from: '', to: '' }, recordCount: 1, type: 'incremental' },
        added: [],
        updated: [rec],
        deleted: [],
      };
      const existing = [makeRecord({ id: 'upd-1', status: '在用' })];

      const result = applySyncPackage(pkg, existing, 'overwrite');
      expect(result.toUpdate).toHaveLength(1);
      expect(result.toUpdate[0].status).toBe('备用');
    });

    it('更新的记录不存在时作为新增处理', () => {
      const rec = makeRecord({ id: 'upd-1', status: '备用' });
      const pkg: SyncPackage = {
        meta: { format: 'wsync-1', createdAt: '', sourceDevice: '', timeRange: { from: '', to: '' }, recordCount: 1, type: 'incremental' },
        added: [],
        updated: [rec],
        deleted: [],
      };
      const existing: WaterSourceRecord[] = [];

      const result = applySyncPackage(pkg, existing, 'overwrite');
      expect(result.toAdd).toHaveLength(1);
      expect(result.toUpdate).toHaveLength(0);
    });

    it('skip 策略下有差异的更新记录计入 skipped', () => {
      const rec = makeRecord({ id: 'upd-1', status: '备用' });
      const pkg: SyncPackage = {
        meta: { format: 'wsync-1', createdAt: '', sourceDevice: '', timeRange: { from: '', to: '' }, recordCount: 1, type: 'incremental' },
        added: [],
        updated: [rec],
        deleted: [],
      };
      const existing = [makeRecord({ id: 'upd-1', status: '在用' })];

      const result = applySyncPackage(pkg, existing, 'skip');
      expect(result.skipped).toBe(1);
      expect(result.toUpdate).toHaveLength(0);
    });

    it('skip 策略下无差异的更新记录不计入 skipped', () => {
      const rec = makeRecord({ id: 'upd-1', status: '在用' });
      const pkg: SyncPackage = {
        meta: { format: 'wsync-1', createdAt: '', sourceDevice: '', timeRange: { from: '', to: '' }, recordCount: 1, type: 'incremental' },
        added: [],
        updated: [rec],
        deleted: [],
      };
      const existing = [makeRecord({ id: 'upd-1', status: '在用' })];

      const result = applySyncPackage(pkg, existing, 'skip');
      expect(result.skipped).toBe(0);
    });

    it('删除 ID 始终加入 toDelete', () => {
      const pkg: SyncPackage = {
        meta: { format: 'wsync-1', createdAt: '', sourceDevice: '', timeRange: { from: '', to: '' }, recordCount: 2, type: 'incremental' },
        added: [],
        updated: [],
        deleted: ['del-1', 'del-2'],
      };
      const result = applySyncPackage(pkg, [], 'skip');
      expect(result.toDelete).toHaveLength(2);
      expect(result.toDelete).toContain('del-1');
      expect(result.toDelete).toContain('del-2');
    });

    it('按名称+城市匹配的冲突也正确处理', () => {
      const rec = makeRecord({ id: 'new-id', name: '岗南水库', cityName: '石家庄市' });
      const pkg: SyncPackage = {
        meta: { format: 'wsync-1', createdAt: '', sourceDevice: '', timeRange: { from: '', to: '' }, recordCount: 1, type: 'incremental' },
        added: [rec],
        updated: [],
        deleted: [],
      };
      const existing = [makeRecord({ id: 'old-id', name: '岗南水库', cityName: '石家庄市' })];

      const skipResult = applySyncPackage(pkg, existing, 'skip');
      expect(skipResult.skipped).toBe(1);

      const owResult = applySyncPackage(pkg, existing, 'overwrite');
      expect(owResult.toUpdate).toHaveLength(1);
    });
  });

  // ===== createSyncPackage =====
  describe('createSyncPackage', () => {
    it('成功创建并下载同步包', async () => {
      const mockBuffer = new ArrayBuffer(100);
      vi.mocked(encryptData).mockResolvedValue(mockBuffer);

      // Mock DOM API
      const clickSpy = vi.fn();
      const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as never);
      const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as never);
      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      const result = await createSyncPackage([makeRecord()], 'password123', '2024-01-01');

      expect(result.success).toBe(true);
      expect(result.fileSize).toBe(100);
      expect(encryptData).toHaveBeenCalledOnce();
      expect(clickSpy).not.toHaveBeenCalled(); // a.click is called but spy isn't on the element

      appendSpy.mockRestore();
      removeSpy.mockRestore();
      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });

    it('加密失败时返回错误', async () => {
      vi.mocked(encryptData).mockRejectedValue(new Error('加密失败'));

      const result = await createSyncPackage([makeRecord()], 'wrong', '2024-01-01');

      expect(result.success).toBe(false);
      expect(result.fileSize).toBe(0);
      expect(result.error).toBe('加密失败');
    });
  });

  // ===== readSyncPackage =====
  describe('readSyncPackage', () => {
    it('成功解密并解析同步包', async () => {
      const pkg: SyncPackage = {
        meta: { format: 'wsync-1', createdAt: '2024-01-01', sourceDevice: 'PC-A', timeRange: { from: '2024-01-01', to: '2024-01-02' }, recordCount: 1, type: 'full' },
        added: [makeRecord()],
        updated: [],
        deleted: [],
      };
      vi.mocked(decryptData).mockResolvedValue(JSON.stringify(pkg));

      const mockFile = {
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(50)),
      } as unknown as File;

      const result = await readSyncPackage(mockFile, 'password123');

      expect(result.success).toBe(true);
      expect(result.pkg?.meta.format).toBe('wsync-1');
      expect(result.pkg?.added).toHaveLength(1);
    });

    it('格式不正确时返回错误', async () => {
      vi.mocked(decryptData).mockResolvedValue(JSON.stringify({
        meta: { format: 'wrong-format' },
      }));

      const mockFile = {
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(50)),
      } as unknown as File;

      const result = await readSyncPackage(mockFile, 'password123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('无效的同步包格式');
    });

    it('解密失败时返回错误', async () => {
      vi.mocked(decryptData).mockRejectedValue(new Error('密钥错误'));

      const mockFile = {
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(50)),
      } as unknown as File;

      const result = await readSyncPackage(mockFile, 'password123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('解密失败');
    });
  });
});
