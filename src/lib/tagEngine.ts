/* ===== S11.7: 标签引擎 =====
 * 标签定义 + CRUD + 批量打标/移标
 * 存储于 IDB app_meta（key: 'tag_defs'）
 */

import { dbGet, dbPut } from './idb';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';

// ===== 类型定义 =====

export interface TagDef {
  id: string;
  name: string;
  color: string;
  group: string;
  createdAt: string;
}

export interface TagStats {
  totalTags: number;
  totalTagged: number;
  byTag: { tagId: string; name: string; color: string; count: number }[];
}

// ===== 预设颜色 =====

export const TAG_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#6366f1', // indigo
  '#14b8a6', // teal
];

export const TAG_GROUPS = ['分类', '状态', '区域', '优先级', '自定义'];

// ===== 存储 =====

const STORAGE_KEY = 'tag_defs';

async function loadTagDefs(): Promise<TagDef[]> {
  const result = await dbGet<{ key: string; value: TagDef[] }>('app_meta', STORAGE_KEY);
  return result?.value || [];
}

async function saveTagDefs(tags: TagDef[]): Promise<void> {
  await dbPut('app_meta', { key: STORAGE_KEY, value: tags });
}

// ===== CRUD =====

export async function getAllTags(): Promise<TagDef[]> {
  return loadTagDefs();
}

export async function createTag(name: string, color: string, group: string): Promise<TagDef> {
  const tags = await loadTagDefs();
  const tag: TagDef = {
    id: `tag_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim(),
    color,
    group,
    createdAt: new Date().toISOString(),
  };
  tags.push(tag);
  await saveTagDefs(tags);
  return tag;
}

export async function updateTag(id: string, updates: Partial<Omit<TagDef, 'id' | 'createdAt'>>): Promise<void> {
  const tags = await loadTagDefs();
  const idx = tags.findIndex((t) => t.id === id);
  if (idx >= 0) {
    tags[idx] = { ...tags[idx], ...updates };
    await saveTagDefs(tags);
  }
}

export async function deleteTag(id: string): Promise<void> {
  const tags = await loadTagDefs();
  const filtered = tags.filter((t) => t.id !== id);
  await saveTagDefs(filtered);
}

// ===== 批量打标/移标 =====

/**
 * 给多条水源地记录添加标签
 * 返回更新后的记录列表
 */
export function batchAddTag(records: WaterSourceRecord[], tagId: string): WaterSourceRecord[] {
  return records.map((r) => {
    const tags = r.tags || [];
    if (!tags.includes(tagId)) {
      return { ...r, tags: [...tags, tagId] };
    }
    return r;
  });
}

/**
 * 从多条水源地记录移除标签
 */
export function batchRemoveTag(records: WaterSourceRecord[], tagId: string): WaterSourceRecord[] {
  return records.map((r) => {
    const tags = r.tags || [];
    return { ...r, tags: tags.filter((t) => t !== tagId) };
  });
}

/**
 * 统计标签使用情况
 */
export function computeTagStats(sources: WaterSourceRecord[], tags: TagDef[]): TagStats {
  const byTag = tags.map((t) => ({
    tagId: t.id,
    name: t.name,
    color: t.color,
    count: sources.filter((s) => s.tags?.includes(t.id)).length,
  }));

  const totalTagged = sources.filter((s) => s.tags && s.tags.length > 0).length;

  return {
    totalTags: tags.length,
    totalTagged,
    byTag,
  };
}

/**
 * 按标签筛选（OR 逻辑：匹配任意一个标签）
 */
export function filterByTags(sources: WaterSourceRecord[], tagIds: string[]): WaterSourceRecord[] {
  if (tagIds.length === 0) return sources;
  return sources.filter((s) => s.tags?.some((t) => tagIds.includes(t)));
}
