/* ===== S13.2: 空间分析历史对比引擎 =====
 * 对比两个历史 SpatialAnalysisRecord，输出差异分析结果，
 * 用于风险变化追踪、距离变化监测等环评辅助场景。
 * 纯函数设计，便于单测和 UI 集成。
 */

import type { SpatialAnalysisRecord } from '@/stores/spatialAnalysisStore';

// ===== 对比结果类型 =====

export type ChangeDirection = 'improved' | 'worsened' | 'unchanged' | 'new' | 'removed';

export interface FieldDiff<T = string> {
  field: string;
  label: string;
  oldValue: T | null;
  newValue: T | null;
  direction: ChangeDirection;
  /** 是否显著变化（需标注） */
  significant: boolean;
}

export interface RiskLevelDiff {
  /** 旧风险等级 */
  oldRisk: string | null;
  /** 新风险等级 */
  newRisk: string | null;
  /** 变化方向 */
  direction: ChangeDirection;
}

export interface SpatialAnalysisDiff {
  /** 旧记录 */
  oldRecord: SpatialAnalysisRecord | null;
  /** 新记录 */
  newRecord: SpatialAnalysisRecord;
  /** 总体变化方向 */
  overallDirection: ChangeDirection;
  /** 风险等级变化 */
  riskDiff: RiskLevelDiff;
  /** 字段差异列表 */
  fieldDiffs: FieldDiff[];
  /** 变化数量 */
  changeCount: number;
  /** 对比结论 */
  conclusion: string;
}

// ===== 工具函数 =====

function riskWeight(level: string | null | undefined): number {
  if (level === 'red') return 3;
  if (level === 'yellow') return 2;
  if (level === 'green') return 1;
  return 0;
}

function compareRisks(oldRisk: string | null | undefined, newRisk: string | null | undefined): RiskLevelDiff {
  const oldW = riskWeight(oldRisk);
  const newW = riskWeight(newRisk);
  let direction: ChangeDirection;
  if (oldRisk === newRisk || (!oldRisk && !newRisk)) {
    direction = 'unchanged';
  } else if (oldRisk === null || oldRisk === undefined) {
    direction = 'new';
  } else if (newW > oldW) {
    direction = 'worsened';
  } else if (newW < oldW) {
    direction = 'improved';
  } else {
    direction = 'removed';
  }
  return {
    oldRisk: oldRisk ?? null,
    newRisk: newRisk ?? null,
    direction,
  };
}

function fmtM(m: number | null | undefined): string {
  if (m === null || m === undefined) return '—';
  return m >= 1000 ? `${(m / 1000).toFixed(2)}km` : `${Math.round(m)}m`;
}

// ===== 核心对比函数 =====

/**
 * 对比两条空间分析记录
 * @param oldRecord 旧记录（可为 null，表示首次分析）
 * @param newRecord 新记录（必填）
 */
export function compareSpatialAnalyses(
  oldRecord: SpatialAnalysisRecord | null,
  newRecord: SpatialAnalysisRecord,
): SpatialAnalysisDiff {
  const fieldDiffs: FieldDiff[] = [];

  // 风险等级对比
  const riskDiff = compareRisks(oldRecord?.riskLevel, newRecord.riskLevel);

  // 保护区内外变化
  if (oldRecord?.insideAnyZone !== undefined || newRecord.insideAnyZone !== undefined) {
    const old = oldRecord?.insideAnyZone ?? null;
    const newVal = newRecord.insideAnyZone ?? null;
    if (old !== newVal) {
      fieldDiffs.push({
        field: 'insideAnyZone',
        label: '保护区内',
        oldValue: old === null ? null : old ? '是' : '否',
        newValue: newVal === null ? null : newVal ? '是' : '否',
        direction: newVal === true && old === false ? 'worsened' : 'improved',
        significant: true,
      });
    }
  }

  // 最近水源地距离变化
  if (oldRecord?.nearestDistanceM !== undefined || newRecord.nearestDistanceM !== undefined) {
    const old = oldRecord?.nearestDistanceM ?? null;
    const newVal = newRecord.nearestDistanceM ?? null;
    if (old !== newVal) {
      fieldDiffs.push({
        field: 'nearestDistanceM',
        label: '最近水源地距离',
        oldValue: old === null ? null : fmtM(old),
        newValue: newVal === null ? null : fmtM(newVal),
        direction: newVal !== null && old !== null && newVal < old ? 'worsened' : 'improved',
        significant: true,
      });
    }
  }

  // 水源地名称变化
  if (oldRecord?.nearestSourceName !== newRecord.nearestSourceName) {
    fieldDiffs.push({
      field: 'nearestSourceName',
      label: '最近水源地',
      oldValue: oldRecord?.nearestSourceName ?? null,
      newValue: newRecord.nearestSourceName ?? null,
      direction: newRecord.nearestSourceName ? 'new' : 'removed',
      significant: false,
    });
  }

  // 敏感目标数量变化
  if (oldRecord?.sensitiveCount !== undefined || newRecord.sensitiveCount !== undefined) {
    const old = oldRecord?.sensitiveCount ?? null;
    const newVal = newRecord.sensitiveCount ?? null;
    if (old !== newVal) {
      fieldDiffs.push({
        field: 'sensitiveCount',
        label: '敏感目标数',
        oldValue: old === null ? null : String(old),
        newValue: newVal === null ? null : String(newVal),
        direction: newVal !== null && old !== null && newVal > old ? 'worsened' : 'improved',
        significant: true,
      });
    }
  }

  // 上游状态变化
  if (oldRecord?.upstreamOfAny !== undefined || newRecord.upstreamOfAny !== undefined) {
    const old = oldRecord?.upstreamOfAny ?? null;
    const newVal = newRecord.upstreamOfAny ?? null;
    if (old !== newVal) {
      fieldDiffs.push({
        field: 'upstreamOfAny',
        label: '位于上游',
        oldValue: old === null ? null : old ? '是' : '否',
        newValue: newVal === null ? null : newVal ? '是' : '否',
        direction: newVal === true && old === false ? 'worsened' : 'improved',
        significant: true,
      });
    }
  }

  // 项目名称变化
  if (oldRecord?.projectName !== newRecord.projectName) {
    const old = oldRecord?.projectName ?? null;
    const newVal = newRecord.projectName ?? null;
    fieldDiffs.push({
      field: 'projectName',
      label: '项目名称',
      oldValue: old,
      newValue: newVal,
      direction: newVal ? 'new' : 'removed',
      significant: false,
    });
  }

  // 总体方向
  let overallDirection: ChangeDirection;
  if (!oldRecord) {
    // 无旧记录时视为首次分析，无变化方向
    overallDirection = 'unchanged';
  } else {
    const worsened = fieldDiffs.some((d) => d.direction === 'worsened');
    const improved = fieldDiffs.some((d) => d.direction === 'improved');
    if (worsened && !improved) {
      overallDirection = 'worsened';
    } else if (improved && !worsened) {
      overallDirection = 'improved';
    } else if (riskDiff.direction === 'worsened') {
      overallDirection = 'worsened';
    } else if (riskDiff.direction === 'improved') {
      overallDirection = 'improved';
    } else {
      overallDirection = 'unchanged';
    }
  }

  // 结论
  const parts: string[] = [];
  if (riskDiff.direction === 'worsened') {
    parts.push(`风险从${riskLabel(riskDiff.oldRisk)}升至${riskLabel(riskDiff.newRisk)}`);
  } else if (riskDiff.direction === 'improved') {
    parts.push(`风险从${riskLabel(riskDiff.oldRisk)}降至${riskLabel(riskDiff.newRisk)}`);
  }
  const worsenedFields = fieldDiffs.filter((d) => d.direction === 'worsened');
  const improvedFields = fieldDiffs.filter((d) => d.direction === 'improved');
  if (worsenedFields.length > 0) {
    parts.push(`${worsenedFields.length} 项指标恶化`);
  }
  if (improvedFields.length > 0) {
    parts.push(`${improvedFields.length} 项指标改善`);
  }
  const conclusion = parts.length > 0
    ? parts.join('；') + '。'
    : '两次分析结果基本一致，未发现显著变化。';

  return {
    oldRecord,
    newRecord,
    overallDirection,
    riskDiff,
    fieldDiffs,
    changeCount: fieldDiffs.length,
    conclusion,
  };
}

function riskLabel(level: string | null | undefined): string {
  if (level === 'red') return '红线';
  if (level === 'yellow') return '黄线';
  if (level === 'green') return '绿线';
  return '未知';
}

/**
 * 对比结果 → 可读的对比摘要文本
 */
export function diffToSummary(diff: SpatialAnalysisDiff): string {
  const lines: string[] = [];
  const oldName = diff.oldRecord?.name ?? '无';
  const newName = diff.newRecord.name;
  lines.push(`从「${oldName}」到「${newName}」`);
  lines.push(`风险变化：${riskLabel(diff.riskDiff.oldRisk)} → ${riskLabel(diff.riskDiff.newRisk)}（${diffLabel(diff.riskDiff.direction)}）`);
  lines.push(`变化项数：${diff.changeCount} 项`);
  lines.push(`总体判断：${diffLabel(diff.overallDirection)}`);
  lines.push(`结论：${diff.conclusion}`);
  return lines.join('\n');
}

function diffLabel(d: ChangeDirection): string {
  switch (d) {
    case 'improved': return '改善';
    case 'worsened': return '恶化';
    case 'unchanged': return '无变化';
    case 'new': return '新增';
    case 'removed': return '消失';
  }
}