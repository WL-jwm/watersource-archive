/* ===== S11.2: 合并策略执行器 =====
 * 三种策略：skip（跳过）/ overwrite（覆盖）/ rename（重命名）
 * 生成 MergePlan 供预览和执行
 */

import type { WaterSourceRecord } from '@/stores/waterSourceStore';
import type { ConflictItem, ConflictReport } from './conflictDetector';

// ===== 类型定义 =====

export type MergeStrategy = 'skip' | 'overwrite' | 'rename';

export interface MergeAction {
  /** 导入数据索引 */
  importIndex: number;
  /** 行号 */
  rowNum: number;
  /** 操作类型 */
  action: 'add' | 'update' | 'skip';
  /** 操作后的记录（add/update 时有值） */
  record?: WaterSourceRecord;
  /** 跳过原因 */
  skipReason?: string;
  /** 原始名称（rename 时记录） */
  originalName?: string;
}

export interface MergePlan {
  /** 新增记录数 */
  addCount: number;
  /** 更新记录数 */
  updateCount: number;
  /** 跳过记录数 */
  skipCount: number;
  /** 操作明细 */
  actions: MergeAction[];
  /** 使用的策略 */
  strategy: MergeStrategy;
}

// ===== 主函数 =====

/**
 * 生成合并计划
 *
 * @param importRecords 导入的记录（部分字段）
 * @param conflictReport 冲突检测报告
 * @param strategy 合并策略
 * @param genId ID 生成函数
 */
export function createMergePlan(
  importRecords: Partial<WaterSourceRecord>[],
  conflictReport: ConflictReport,
  strategy: MergeStrategy,
  genId: (cityName: string, level: string, name: string) => string,
): MergePlan {
  const actions: MergeAction[] = [];
  const conflictMap = new Map(
    conflictReport.conflicts.map((c) => [c.importIndex, c]),
  );

  // 用于 rename 策略时检测重名
  const usedNames = new Set<string>();

  for (let i = 0; i < importRecords.length; i++) {
    const rec = importRecords[i];
    const rowNum = i + 2;
    const conflict = conflictMap.get(i);

    if (!conflict) {
      // 无冲突 → 新增
      const record = buildRecord(rec, genId);
      if (record) {
        actions.push({
          importIndex: i,
          rowNum,
          action: 'add',
          record,
        });
        usedNames.add(`${record.name}|${record.cityName}`);
      } else {
        actions.push({
          importIndex: i,
          rowNum,
          action: 'skip',
          skipReason: '缺少必填字段',
        });
      }
      continue;
    }

    // 有冲突 → 按策略处理
    switch (strategy) {
      case 'skip':
        actions.push({
          importIndex: i,
          rowNum,
          action: 'skip',
          skipReason: `与已有记录"${conflict.existingRecord.name}"冲突（${getConflictLabel(conflict.type)}）`,
        });
        break;

      case 'overwrite': {
        // 用导入数据覆盖已有记录，保留原有 ID
        const record = buildRecord(rec, genId, conflict.existingRecord.id);
        if (record) {
          actions.push({
            importIndex: i,
            rowNum,
            action: 'update',
            record,
          });
        } else {
          actions.push({
            importIndex: i,
            rowNum,
            action: 'skip',
            skipReason: '缺少必填字段',
          });
        }
        break;
      }

      case 'rename': {
        // 自动重命名：追加 _2, _3...
        const originalName = rec.name || '';
        let suffix = 2;
        let newName = originalName;
        const cityKey = rec.cityName || '';

        while (
          usedNames.has(`${newName}|${cityKey}`) ||
          isNameExists(newName, cityKey, conflictReport.conflicts)
        ) {
          newName = `${originalName}_${suffix}`;
          suffix++;
        }

        const renamedRec = { ...rec, name: newName };
        const record = buildRecord(renamedRec, genId);
        if (record) {
          actions.push({
            importIndex: i,
            rowNum,
            action: 'add',
            record,
            originalName,
          });
          usedNames.add(`${record.name}|${record.cityName}`);
        } else {
          actions.push({
            importIndex: i,
            rowNum,
            action: 'skip',
            skipReason: '缺少必填字段',
          });
        }
        break;
      }
    }
  }

  return {
    addCount: actions.filter((a) => a.action === 'add').length,
    updateCount: actions.filter((a) => a.action === 'update').length,
    skipCount: actions.filter((a) => a.action === 'skip').length,
    actions,
    strategy,
  };
}

/**
 * 从 Partial<WaterSourceRecord> 构建完整记录
 */
function buildRecord(
  rec: Partial<WaterSourceRecord>,
  genId: (cityName: string, level: string, name: string) => string,
  existingId?: string,
): WaterSourceRecord | null {
  if (!rec.name || !rec.cityName || !rec.level || !rec.type) {
    return null;
  }

  const id = existingId || rec.id || genId(rec.cityName, rec.level, rec.name);

  return {
    id,
    cityName: rec.cityName,
    level: rec.level,
    name: rec.name,
    type: rec.type,
    subType: rec.subType,
    county: rec.county || '未知',
    status: rec.status || '在用',
    remark: rec.remark,
    population: rec.population,
    river: rec.river,
    lng: rec.lng,
    lat: rec.lat,
    dataVersion: 1,
  };
}

/**
 * 检查名称是否在冲突列表的已有记录中存在
 */
function isNameExists(
  name: string,
  city: string,
  conflicts: ConflictItem[],
): boolean {
  return conflicts.some((c) => {
    const existing = c.existingRecord;
    return existing.name === name && existing.cityName === city;
  });
}

/**
 * 获取冲突类型中文标签
 */
function getConflictLabel(type: string): string {
  const labels: Record<string, string> = {
    id: 'ID匹配',
    name_city: '名称+城市匹配',
    name_only: '仅名称匹配',
  };
  return labels[type] || type;
}

/**
 * 策略中文标签
 */
export function getStrategyLabel(strategy: MergeStrategy): string {
  const labels: Record<MergeStrategy, string> = {
    skip: '跳过冲突',
    overwrite: '覆盖原数据',
    rename: '自动重命名',
  };
  return labels[strategy];
}

/**
 * 策略描述
 */
export function getStrategyDescription(strategy: MergeStrategy): string {
  const descs: Record<MergeStrategy, string> = {
    skip: '保留原有数据，跳过冲突的导入行',
    overwrite: '用导入数据替换已有记录（保留原 ID）',
    rename: '冲突行自动追加 _2/_3 后缀作为新记录导入',
  };
  return descs[strategy];
}
