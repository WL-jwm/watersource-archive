/* ===== S11.7: 标签引擎测试 ===== */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock idb 模块
vi.mock('@/lib/idb', () => ({
  dbGet: vi.fn(),
  dbPut: vi.fn(),
  dbDelete: vi.fn(),
  dbGetAll: vi.fn(),
  dbPutBatch: vi.fn(),
  dbGetByIndex: vi.fn(),
  dbCount: vi.fn(),
  dbClear: vi.fn(),
}));

import { dbGet, dbPut } from '@/lib/idb';
import {
  getAllTags,
  createTag,
  updateTag,
  deleteTag,
  batchAddTag,
  batchRemoveTag,
  computeTagStats,
  filterByTags,
  TAG_COLORS,
  TAG_GROUPS,
  type TagDef,
} from '@/lib/tagEngine';
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

function makeTag(overrides: Partial<TagDef> = {}): TagDef {
  return {
    id: 'tag-1',
    name: '重点水源',
    color: '#3b82f6',
    group: '分类',
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('tagEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===== 常量 =====
  describe('常量', () => {
    it('TAG_COLORS 包含10种预设颜色', () => {
      expect(TAG_COLORS).toHaveLength(10);
      expect(TAG_COLORS[0]).toBe('#3b82f6');
    });

    it('TAG_GROUPS 包含5个预设分组', () => {
      expect(TAG_GROUPS).toHaveLength(5);
      expect(TAG_GROUPS).toContain('分类');
      expect(TAG_GROUPS).toContain('自定义');
    });
  });

  // ===== getAllTags =====
  describe('getAllTags', () => {
    it('返回已有的标签列表', async () => {
      const tags = [makeTag(), makeTag({ id: 'tag-2', name: '备用水源' })];
      vi.mocked(dbGet).mockResolvedValue({ key: 'tag_defs', value: tags });

      const result = await getAllTags();
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('重点水源');
    });

    it('无数据时返回空数组', async () => {
      vi.mocked(dbGet).mockResolvedValue(null);

      const result = await getAllTags();
      expect(result).toHaveLength(0);
    });
  });

  // ===== createTag =====
  describe('createTag', () => {
    it('创建新标签并保存', async () => {
      const existing = [makeTag()];
      vi.mocked(dbGet).mockResolvedValue({ key: 'tag_defs', value: existing });
      vi.mocked(dbPut).mockResolvedValue(undefined);

      const tag = await createTag('应急水源', '#ef4444', '状态');

      expect(tag.name).toBe('应急水源');
      expect(tag.color).toBe('#ef4444');
      expect(tag.group).toBe('状态');
      expect(tag.id).toContain('tag_');
      expect(tag.createdAt).toBeTruthy();
      expect(dbPut).toHaveBeenCalledOnce();
    });

    it('标签名前后空格被去除', async () => {
      vi.mocked(dbGet).mockResolvedValue({ key: 'tag_defs', value: [] });
      vi.mocked(dbPut).mockResolvedValue(undefined);

      const tag = await createTag('  重点水源  ', '#3b82f6', '分类');
      expect(tag.name).toBe('重点水源');
    });

    it('空列表中创建第一个标签', async () => {
      vi.mocked(dbGet).mockResolvedValue(null);
      vi.mocked(dbPut).mockResolvedValue(undefined);

      const tag = await createTag('新标签', '#22c55e', '自定义');
      expect(tag.name).toBe('新标签');
      expect(dbPut).toHaveBeenCalledOnce();
    });
  });

  // ===== updateTag =====
  describe('updateTag', () => {
    it('更新标签属性', async () => {
      const tags = [makeTag()];
      vi.mocked(dbGet).mockResolvedValue({ key: 'tag_defs', value: tags });
      vi.mocked(dbPut).mockResolvedValue(undefined);

      await updateTag('tag-1', { name: '更新名称', color: '#22c55e' });

      expect(dbPut).toHaveBeenCalledOnce();
      const savedData = vi.mocked(dbPut).mock.calls[0][1] as { value: TagDef[] };
      expect(savedData.value[0].name).toBe('更新名称');
      expect(savedData.value[0].color).toBe('#22c55e');
    });

    it('更新不存在的标签不报错且不写入', async () => {
      vi.mocked(dbGet).mockResolvedValue({ key: 'tag_defs', value: [] });
      vi.mocked(dbPut).mockResolvedValue(undefined);

      await updateTag('nonexistent', { name: 'test' });
      expect(dbPut).not.toHaveBeenCalled();
    });
  });

  // ===== deleteTag =====
  describe('deleteTag', () => {
    it('从列表中移除指定标签', async () => {
      const tags = [makeTag(), makeTag({ id: 'tag-2', name: '标签B' })];
      vi.mocked(dbGet).mockResolvedValue({ key: 'tag_defs', value: tags });
      vi.mocked(dbPut).mockResolvedValue(undefined);

      await deleteTag('tag-1');

      expect(dbPut).toHaveBeenCalledOnce();
      const savedData = vi.mocked(dbPut).mock.calls[0][1] as { value: TagDef[] };
      expect(savedData.value).toHaveLength(1);
      expect(savedData.value[0].id).toBe('tag-2');
    });

    it('删除不存在的标签不影响其他标签', async () => {
      const tags = [makeTag()];
      vi.mocked(dbGet).mockResolvedValue({ key: 'tag_defs', value: tags });
      vi.mocked(dbPut).mockResolvedValue(undefined);

      await deleteTag('nonexistent');
      const savedData = vi.mocked(dbPut).mock.calls[0][1] as { value: TagDef[] };
      expect(savedData.value).toHaveLength(1);
    });
  });

  // ===== batchAddTag =====
  describe('batchAddTag', () => {
    it('给无标签的记录添加标签', () => {
      const records = [makeRecord(), makeRecord({ id: 'src-2' })];
      const result = batchAddTag(records, 'tag-1');

      expect(result[0].tags).toEqual(['tag-1']);
      expect(result[1].tags).toEqual(['tag-1']);
    });

    it('不重复添加已存在的标签', () => {
      const records = [makeRecord({ tags: ['tag-1'] })];
      const result = batchAddTag(records, 'tag-1');

      expect(result[0].tags).toEqual(['tag-1']);
    });

    it('保留已有的其他标签', () => {
      const records = [makeRecord({ tags: ['tag-a'] })];
      const result = batchAddTag(records, 'tag-b');

      expect(result[0].tags).toEqual(['tag-a', 'tag-b']);
    });

    it('空数组输入返回空数组', () => {
      const result = batchAddTag([], 'tag-1');
      expect(result).toHaveLength(0);
    });
  });

  // ===== batchRemoveTag =====
  describe('batchRemoveTag', () => {
    it('移除指定标签', () => {
      const records = [makeRecord({ tags: ['tag-1', 'tag-2'] })];
      const result = batchRemoveTag(records, 'tag-1');

      expect(result[0].tags).toEqual(['tag-2']);
    });

    it('记录无标签时不受影响', () => {
      const records = [makeRecord()];
      const result = batchRemoveTag(records, 'tag-1');

      expect(result[0].tags).toEqual([]);
    });

    it('移除唯一标签后 tags 为空数组', () => {
      const records = [makeRecord({ tags: ['tag-1'] })];
      const result = batchRemoveTag(records, 'tag-1');

      expect(result[0].tags).toHaveLength(0);
    });
  });

  // ===== computeTagStats =====
  describe('computeTagStats', () => {
    it('正确统计标签使用情况', () => {
      const sources = [
        makeRecord({ id: 's1', tags: ['tag-1'] }),
        makeRecord({ id: 's2', tags: ['tag-1', 'tag-2'] }),
        makeRecord({ id: 's3', tags: ['tag-2'] }),
        makeRecord({ id: 's4' }),
      ];
      const tags = [makeTag(), makeTag({ id: 'tag-2', name: '备用' })];

      const stats = computeTagStats(sources, tags);

      expect(stats.totalTags).toBe(2);
      expect(stats.totalTagged).toBe(3);
      expect(stats.byTag[0].count).toBe(2); // tag-1 used by s1, s2
      expect(stats.byTag[1].count).toBe(2); // tag-2 used by s2, s3
    });

    it('无标签定义时返回零值', () => {
      const sources = [makeRecord({ tags: ['tag-1'] })];
      const stats = computeTagStats(sources, []);

      expect(stats.totalTags).toBe(0);
      expect(stats.totalTagged).toBe(1);
      expect(stats.byTag).toHaveLength(0);
    });

    it('无水源时所有计数为零', () => {
      const tags = [makeTag()];
      const stats = computeTagStats([], tags);

      expect(stats.totalTags).toBe(1);
      expect(stats.totalTagged).toBe(0);
      expect(stats.byTag[0].count).toBe(0);
    });

    it('byTag 包含标签的颜色信息', () => {
      const sources = [makeRecord({ tags: ['tag-1'] })];
      const tags = [makeTag({ color: '#ef4444' })];
      const stats = computeTagStats(sources, tags);

      expect(stats.byTag[0].color).toBe('#ef4444');
      expect(stats.byTag[0].name).toBe('重点水源');
    });
  });

  // ===== filterByTags =====
  describe('filterByTags', () => {
    it('返回匹配任意标签的记录（OR 逻辑）', () => {
      const sources = [
        makeRecord({ id: 's1', tags: ['tag-1'] }),
        makeRecord({ id: 's2', tags: ['tag-2'] }),
        makeRecord({ id: 's3', tags: ['tag-3'] }),
        makeRecord({ id: 's4' }),
      ];

      const result = filterByTags(sources, ['tag-1', 'tag-2']);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('s1');
      expect(result[1].id).toBe('s2');
    });

    it('空标签列表返回全部记录', () => {
      const sources = [makeRecord(), makeRecord({ id: 's2' })];
      const result = filterByTags(sources, []);
      expect(result).toHaveLength(2);
    });

    it('无匹配时返回空数组', () => {
      const sources = [makeRecord({ tags: ['tag-1'] })];
      const result = filterByTags(sources, ['nonexistent']);
      expect(result).toHaveLength(0);
    });

    it('无标签的记录被排除', () => {
      const sources = [
        makeRecord({ id: 's1', tags: ['tag-1'] }),
        makeRecord({ id: 's2' }),
      ];
      const result = filterByTags(sources, ['tag-1']);
      expect(result).toHaveLength(1);
    });
  });
});
