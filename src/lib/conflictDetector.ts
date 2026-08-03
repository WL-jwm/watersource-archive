/* ===== S11.2: 冲突检测引擎 =====
 * 检测导入数据与现有数据的冲突
 * 支持多维度匹配：ID / 名称+城市 / 名称
 */

import type { WaterSourceRecord } from '@/stores/waterSourceStore';

// ===== 类型定义 =====

export type ConflictType = 'id' | 'name_city' | 'name_only' | 'none';

export interface ConflictItem {
  /** 导入数据的索引 */
  importIndex: number;
  /** 行号（从2开始） */
  rowNum: number;
  /** 冲突类型 */
  type: ConflictType;
  /** 冲突的已有记录 */
  existingRecord: WaterSourceRecord;
  /** 冲突字段 diff */
  fieldDiffs: FieldDiff[];
}

export interface FieldDiff {
  field: string;
  importValue: unknown;
  existingValue: unknown;
}

export interface ConflictReport {
  /** 冲突总数 */
  conflictCount: number;
  /** 无冲突的新记录数 */
  newCount: number;
  /** 冲突明细 */
  conflicts: ConflictItem[];
  /** 按冲突类型分组 */
  byType: Record<ConflictType, number>;
}

// ===== 主函数 =====

/**
 * 检测导入数据与现有数据的冲突
 *
 * 匹配策略（优先级从高到低）：
 * 1. ID 匹配 — 导入数据的 id 与已有记录的 id 相同
 * 2. 名称+城市匹配 — 名称和城市都相同（最常见的重复）
 * 3. 仅名称匹配 — 仅名称相同但城市不同（可能是不同水源地同名）
 */
export function detectConflicts(
  importRecords: Partial<WaterSourceRecord>[],
  existingRecords: WaterSourceRecord[],
): ConflictReport {
  const existingById = new Map(existingRecords.map((r) => [r.id, r]));
  const existingByNameCity = new Map(
    existingRecords.map((r) => [`${r.name}|${r.cityName}`, r]),
  );
  const existingByName = new Map(existingRecords.map((r) => [r.name, r]));

  const conflicts: ConflictItem[] = [];
  let newCount = 0;

  for (let i = 0; i < importRecords.length; i++) {
    const rec = importRecords[i];
    const rowNum = i + 2;

    let conflictType: ConflictType = 'none';
    let existing: WaterSourceRecord | undefined;

    // Phase 1: ID 匹配
    if (rec.id) {
      existing = existingById.get(rec.id);
      if (existing) {
        conflictType = 'id';
      }
    }

    // Phase 2: 名称+城市匹配
    if (conflictType === 'none' && rec.name && rec.cityName) {
      existing = existingByNameCity.get(`${rec.name}|${rec.cityName}`);
      if (existing) {
        conflictType = 'name_city';
      }
    }

    // Phase 3: 仅名称匹配（仅当城市不同时才算冲突）
    if (conflictType === 'none' && rec.name) {
      existing = existingByName.get(rec.name);
      if (existing && rec.cityName && existing.cityName !== rec.cityName) {
        // 同名不同城市，不算冲突（不同地方的同名水源地）
        conflictType = 'none';
        existing = undefined;
      } else if (existing && !rec.cityName) {
        // 没有提供城市信息，按名称匹配
        conflictType = 'name_only';
      }
    }

    if (conflictType !== 'none' && existing) {
      const fieldDiffs = computeFieldDiffs(rec, existing);
      conflicts.push({
        importIndex: i,
        rowNum,
        type: conflictType,
        existingRecord: existing,
        fieldDiffs,
      });
    } else {
      newCount++;
    }
  }

  // 按类型分组统计
  const byType: Record<ConflictType, number> = {
    id: conflicts.filter((c) => c.type === 'id').length,
    name_city: conflicts.filter((c) => c.type === 'name_city').length,
    name_only: conflicts.filter((c) => c.type === 'name_only').length,
    none: 0,
  };

  return {
    conflictCount: conflicts.length,
    newCount,
    conflicts,
    byType,
  };
}

/**
 * 计算两个记录之间的字段差异
 */
function computeFieldDiffs(
  importRec: Partial<WaterSourceRecord>,
  existingRec: WaterSourceRecord,
): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  const fieldsToCompare: (keyof WaterSourceRecord)[] = [
    'name', 'cityName', 'level', 'type', 'subType',
    'county', 'status', 'population', 'river', 'lng', 'lat', 'remark',
  ];

  for (const field of fieldsToCompare) {
    const importVal = importRec[field];
    const existingVal = existingRec[field];

    // 双方都有值且不同
    if (importVal !== undefined && importVal !== null && String(importVal) !== '') {
      if (String(importVal) !== String(existingVal ?? '')) {
        diffs.push({
          field: String(field),
          importValue: importVal,
          existingValue: existingVal,
        });
      }
    }
  }

  return diffs;
}

/**
 * 获取冲突类型中文标签
 */
export function getConflictTypeLabel(type: ConflictType): string {
  const labels: Record<ConflictType, string> = {
    id: 'ID匹配',
    name_city: '名称+城市匹配',
    name_only: '仅名称匹配',
    none: '无冲突',
  };
  return labels[type];
}

/**
 * 获取冲突类型颜色
 */
export function getConflictTypeColor(type: ConflictType): string {
  const colors: Record<ConflictType, string> = {
    id: 'text-red-600 bg-red-50',
    name_city: 'text-orange-600 bg-orange-50',
    name_only: 'text-yellow-600 bg-yellow-50',
    none: 'text-green-600 bg-green-50',
  };
  return colors[type];
}
