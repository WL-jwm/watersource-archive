/* ===== S12.5: 敏感目标空间筛查引擎 =====
 * 在项目周边缓冲区内筛查敏感目标（学校、医院、居民区、地表水体等），
 * 输出清单，用于环评现状调查
 */

import { haversineDistance } from './spatialAnalysis';
import { bearingDegrees, bearingLabel } from './spatialProximityEngine';

// ===== 类型定义 =====

export type SensitiveCategory =
  | 'school'
  | 'hospital'
  | 'residential'
  | 'surface_water'
  | 'drinking_well'
  | 'farmland'
  | 'wetland'
  | 'other';

export interface SensitiveTarget {
  id: string;
  name: string;
  lng: number;
  lat: number;
  category: SensitiveCategory;
  /** 数量或规模描述 */
  scale?: string;
  /** 备注 */
  remark?: string;
}

export type ScreenedTarget = SensitiveTarget & {
  distanceM: number;
  bearingDeg: number;
  bearingLabel: string;
  categoryLabel: string;
};

export interface SensitiveScreeningResult {
  /** 目标坐标 */
  center: { lng: number; lat: number };
  /** 筛查半径（米） */
  radiusM: number;
  /** 缓冲区内敏感目标（按距离升序） */
  targets: ScreenedTarget[];
  /** 分类统计 */
  categoryCounts: Record<SensitiveCategory, number>;
  /** 缓冲区内目标总数 */
  totalCount: number;
  /** 最近敏感目标 */
  nearest: ScreenedTarget | null;
  /** 最近距离 */
  nearestDistanceM: number | null;
}

// ===== 分类标签 =====

export const SENSITIVE_CATEGORY_LABELS: Record<SensitiveCategory, string> = {
  school: '学校',
  hospital: '医院',
  residential: '居民区',
  surface_water: '地表水体',
  drinking_well: '饮用水井',
  farmland: '农田',
  wetland: '湿地',
  other: '其他',
};

export const SENSITIVE_CATEGORY_COLORS: Record<SensitiveCategory, string> = {
  school: 'bg-blue-100 text-blue-700',
  hospital: 'bg-red-100 text-red-700',
  residential: 'bg-amber-100 text-amber-700',
  surface_water: 'bg-cyan-100 text-cyan-700',
  drinking_well: 'bg-green-100 text-green-700',
  farmland: 'bg-lime-100 text-lime-700',
  wetland: 'bg-teal-100 text-teal-700',
  other: 'bg-gray-100 text-gray-600',
};

export function categoryLabel(category: SensitiveCategory): string {
  return SENSITIVE_CATEGORY_LABELS[category] || category;
}

// ===== 核心筛查 =====

/**
 * 在缓冲区内筛查敏感目标
 */
export function screenSensitiveTargets(
  lng: number,
  lat: number,
  targets: SensitiveTarget[],
  radiusM = 5000,
): SensitiveScreeningResult {
  const screened = targets
    .map((t) => {
      const distanceM = haversineDistance(lat, lng, t.lat, t.lng);
      const bearing = bearingDegrees(lat, lng, t.lat, t.lng);
      return {
        ...t,
        distanceM,
        bearingDeg: bearing,
        bearingLabel: bearingLabel(bearing),
        categoryLabel: categoryLabel(t.category),
      };
    })
    .filter((t) => t.distanceM <= radiusM)
    .sort((a, b) => a.distanceM - b.distanceM);

  const categoryCounts: Record<SensitiveCategory, number> = {
    school: 0, hospital: 0, residential: 0, surface_water: 0,
    drinking_well: 0, farmland: 0, wetland: 0, other: 0,
  };
  for (const t of screened) {
    categoryCounts[t.category]++;
  }

  const nearest = screened.length > 0 ? screened[0] : null;

  return {
    center: { lng, lat },
    radiusM,
    targets: screened,
    categoryCounts,
    totalCount: screened.length,
    nearest,
    nearestDistanceM: nearest ? nearest.distanceM : null,
  };
}

// ===== 批量筛查 =====

export interface BatchScreeningInput {
  /** 多个筛查点 */
  points: Array<{ lng: number; lat: number; label?: string }>;
  targets: SensitiveTarget[];
  radiusM?: number;
}

export interface BatchScreeningResult {
  items: Array<{
    point: { lng: number; lat: number; label?: string };
    screening: SensitiveScreeningResult;
  }>;
  /** 全部命中目标（去重） */
  allAffectedTargets: SensitiveTarget[];
  /** 涉及目标总数（去重） */
  affectedTargetCount: number;
}

/**
 * 批量筛查多个点位
 */
export function batchScreenSensitiveTargets(
  input: BatchScreeningInput,
): BatchScreeningResult {
  const radiusM = input.radiusM ?? 5000;
  const items = input.points.map((p) => ({
    point: p,
    screening: screenSensitiveTargets(p.lng, p.lat, input.targets, radiusM),
  }));

  // 去重收集受影响目标
  const seen = new Set<string>();
  const allAffected: SensitiveTarget[] = [];
  for (const item of items) {
    for (const t of item.screening.targets) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        allAffected.push(t);
      }
    }
  }

  return {
    items,
    allAffectedTargets: allAffected,
    affectedTargetCount: allAffected.length,
  };
}

// ===== 建议生成 =====

/**
 * 根据筛查结果生成现状调查建议
 */
export function buildScreeningAdvice(result: SensitiveScreeningResult): string[] {
  const advice: string[] = [];

  if (result.totalCount === 0) {
    advice.push(`项目周边 ${result.radiusM} 米范围内未筛查到敏感目标`);
    return advice;
  }

  advice.push(`项目周边 ${result.radiusM} 米范围内筛查到 ${result.totalCount} 个敏感目标`);

  const schools = result.categoryCounts.school;
  const hospitals = result.categoryCounts.hospital;
  const water = result.categoryCounts.surface_water + result.categoryCounts.drinking_well;

  if (schools > 0) advice.push(`涉及 ${schools} 个学校，环评中需关注环境噪声与空气影响`);
  if (hospitals > 0) advice.push(`涉及 ${hospitals} 家医院，需关注环境影响对敏感人群的暴露`);
  if (water > 0) advice.push(`涉及 ${water} 处地表水体/饮用水井，需开展地表水与地下水影响分析`);
  if (result.nearest) {
    advice.push(`最近敏感目标为"${result.nearest.name}"，距离 ${Math.round(result.nearest.distanceM)} 米（${result.nearest.bearingLabel}方向）`);
  }

  return advice;
}
