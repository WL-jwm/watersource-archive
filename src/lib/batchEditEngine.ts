/* ===== S11.9: 批量编辑引擎 =====
 * BatchEditPlan + applyBatchEdit（分批 dbPutBatch）
 */

import type { WaterSourceRecord } from '@/stores/waterSourceStore';

// ===== 类型定义 =====

export type BatchFieldType = 'text' | 'number' | 'select' | 'tags';

export interface BatchFieldOption {
  field: keyof WaterSourceRecord;
  label: string;
  type: BatchFieldType;
  options?: string[];
}

export interface BatchEditPlan {
  /** 选中的记录 ID 列表 */
  ids: string[];
  /** 要更新的字段和值 */
  updates: Partial<WaterSourceRecord>;
  /** 影响记录数 */
  affectedCount: number;
}

// ===== 可批量编辑的字段 =====

export const BATCH_EDITABLE_FIELDS: BatchFieldOption[] = [
  { field: 'cityName', label: '城市', type: 'text' },
  { field: 'level', label: '级别', type: 'select', options: ['municipal', 'county', 'township'] },
  { field: 'type', label: '水源类型', type: 'select', options: ['地表水', '地下水'] },
  { field: 'county', label: '县区', type: 'text' },
  { field: 'status', label: '状态', type: 'select', options: ['在用', '备用', '取消', '规划', '在建'] },
  { field: 'population', label: '服务人口', type: 'number' },
  { field: 'river', label: '河流', type: 'text' },
  { field: 'remark', label: '备注', type: 'text' },
];

// ===== 构建计划 =====

export function createBatchEditPlan(
  ids: string[],
  updates: Partial<WaterSourceRecord>,
): BatchEditPlan {
  return {
    ids,
    updates,
    affectedCount: ids.length,
  };
}

// ===== 执行 =====

/**
 * 应用批量编辑到记录列表
 * 返回更新后的记录列表（调用方负责写入 IDB）
 */
export function applyBatchEdit(
  records: WaterSourceRecord[],
  plan: BatchEditPlan,
): WaterSourceRecord[] {
  const idSet = new Set(plan.ids);
  return records.map((r) => {
    if (!idSet.has(r.id)) return r;
    return { ...r, ...plan.updates };
  });
}

/**
 * 格式化级别值
 */
export function formatLevelValue(value: string): string {
  if (value === 'municipal') return '市级';
  if (value === 'county') return '县级';
  if (value === 'township') return '乡镇级';
  return value;
}
