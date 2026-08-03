/* ===== S11.8: 回收站引擎 =====
 * 软删除 + 恢复 + 清除 + 过期清理
 * 30 天过期，到期自动清除
 */

import { dbPut, dbGet, dbDelete, dbGetAll } from './idb';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';

// ===== 常量 =====

/** 回收站保留天数 */
const TRASH_RETENTION_DAYS = 30;

/** 一天的毫秒数 */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// ===== 类型定义 =====

export interface TrashItem {
  /** 回收站条目 ID（唯一） */
  id: string;
  /** 原始记录 ID */
  originalId: string;
  /** 被删除的记录 */
  record: WaterSourceRecord;
  /** 删除时间（ISO 字符串） */
  deletedAt: string;
  /** 过期时间（ISO 字符串） */
  expiresAt: string;
  /** 删除来源 */
  deletedBy: string;
}

export interface TrashStats {
  /** 总数 */
  total: number;
  /** 即将过期（7天内） */
  expiringSoon: number;
  /** 已过期 */
  expired: number;
}

// ===== 核心函数 =====

/**
 * 将记录移入回收站
 */
export async function softDelete(
  record: WaterSourceRecord,
  deletedBy: string = 'user',
): Promise<TrashItem> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TRASH_RETENTION_DAYS * ONE_DAY_MS);

  const trashItem: TrashItem = {
    id: `trash_${record.id}_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
    originalId: record.id,
    record,
    deletedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    deletedBy,
  };

  await dbPut('trash', trashItem);
  return trashItem;
}

/**
 * 从回收站恢复记录
 * 返回恢复的 WaterSourceRecord，调用方负责写入 water_sources store
 */
export async function restore(trashId: string): Promise<WaterSourceRecord | null> {
  const item = await dbGet<TrashItem>('trash', trashId);
  if (!item) return null;

  // 从回收站删除
  await dbDelete('trash', trashId);

  // 返回原始记录
  return item.record;
}

/**
 * 彻底删除回收站中的记录（不可恢复）
 */
export async function purge(trashId: string): Promise<void> {
  await dbDelete('trash', trashId);
}

/**
 * 清空回收站（删除全部）
 */
export async function purgeAll(): Promise<number> {
  const items = await dbGetAll<TrashItem>('trash');
  for (const item of items) {
    await dbDelete('trash', item.id);
  }
  return items.length;
}

/**
 * 清理过期记录
 */
export async function purgeExpired(): Promise<number> {
  const items = await dbGetAll<TrashItem>('trash');
  const now = Date.now();
  let purged = 0;

  for (const item of items) {
    if (new Date(item.expiresAt).getTime() < now) {
      await dbDelete('trash', item.id);
      purged++;
    }
  }

  return purged;
}

/**
 * 列出回收站所有记录（按删除时间倒序）
 */
export async function listTrash(): Promise<TrashItem[]> {
  const items = await dbGetAll<TrashItem>('trash');
  return items.sort(
    (a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime(),
  );
}

/**
 * 获取回收站统计信息
 */
export async function getTrashStats(): Promise<TrashStats> {
  const items = await dbGetAll<TrashItem>('trash');
  const now = Date.now();
  const sevenDaysLater = now + 7 * ONE_DAY_MS;

  let expiringSoon = 0;
  let expired = 0;

  for (const item of items) {
    const expiresTime = new Date(item.expiresAt).getTime();
    if (expiresTime < now) {
      expired++;
    } else if (expiresTime < sevenDaysLater) {
      expiringSoon++;
    }
  }

  return {
    total: items.length,
    expiringSoon,
    expired,
  };
}

/**
 * 获取剩余天数
 */
export function getDaysRemaining(expiresAt: string): number {
  const remaining = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(remaining / ONE_DAY_MS));
}

/**
 * 格式化剩余时间
 */
export function formatExpiry(expiresAt: string): string {
  const days = getDaysRemaining(expiresAt);
  if (days <= 0) return '已过期';
  if (days === 1) return '明天过期';
  if (days <= 7) return `${days} 天后过期`;
  return `${days} 天后过期`;
}
