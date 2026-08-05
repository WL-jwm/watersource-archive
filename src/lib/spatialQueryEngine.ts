/* ===== S12.9: 综合空间查询引擎 =====
 * 给定地图坐标 → 综合调用邻近检索、风险矩阵、敏感目标筛查，
 * 输出单一的综合空间评估结果。供地图点击即时查询使用。
 */

import { querySpatialProximity, toProximitySources, type SpatialProximityResponse } from './spatialProximityEngine';
import { buildRiskMatrix, riskLevelLabel, type RiskLevel } from './riskMatrixEngine';
import { screenSensitiveTargets, type SensitiveScreeningResult, type SensitiveTarget } from './sensitiveScreeningEngine';

// ===== 类型定义 =====

export interface QuerySource {
  id: string;
  name: string;
  cityName: string;
  lng: number;
  lat: number;
  level: string;
  /** 水源类型 */
  type?: string;
  /** 保护区半径（米） */
  zoneRadiusM: number;
}

export interface SpatialQueryInput {
  /** 查询点经度 */
  lng: number;
  /** 查询点纬度 */
  lat: number;
  /** 水源地列表 */
  sources: QuerySource[];
  /** 敏感目标（可选） */
  sensitiveTargets?: SensitiveTarget[];
  /** 敏感目标筛查半径（米） */
  sensitiveRadiusM?: number;
  /** 邻近检索半径（米） */
  searchRadiusM?: number;
}

export interface SpatialQueryResult {
  /** 查询点 */
  point: { lng: number; lat: number };
  /** 邻近检索结果 */
  proximity: SpatialProximityResponse;
  /** 总体风险等级 */
  overallRisk: RiskLevel;
  /** 风险等级中文 */
  riskLabel: string;
  /** 是否在任一保护区内 */
  insideAnyZone: boolean;
  /** 最近水源地名称与距离 */
  nearestSummary: string;
  /** 敏感目标筛查结果 */
  sensitiveScreening: SensitiveScreeningResult | null;
  /** 综合结论 */
  summary: string;
}

/**
 * 执行综合空间查询
 */
export function querySpatialContext(input: SpatialQueryInput): SpatialQueryResult {
  const { lng, lat, sources } = input;
  const searchRadiusM = input.searchRadiusM ?? 10000;
  const sensitiveRadiusM = input.sensitiveRadiusM ?? 5000;

  // 1. 邻近检索
  const proximity = querySpatialProximity(
    lng,
    lat,
    toProximitySources(
      sources.map((s) => ({
        id: s.id, name: s.name, cityName: s.cityName,
        lng: s.lng, lat: s.lat, level: s.level, type: s.type,
      })),
    ),
    { searchRadiusM },
  );

  // 2. 风险矩阵（把查询点当作项目点，圆半径默认100m）
  const riskMatrix = buildRiskMatrix({
    projectName: '查询点',
    project: { type: 'circle', lng, lat, radiusM: 100 },
    zones: sources.map((s) => ({
      sourceName: s.name,
      sourceId: s.id,
      level: s.level,
      centerLng: s.lng,
      centerLat: s.lat,
      radiusM: s.zoneRadiusM,
    })),
    refLng: lng,
    refLat: lat,
  });

  // 3. 敏感目标筛查
  const sensitiveScreening = input.sensitiveTargets && input.sensitiveTargets.length > 0
    ? screenSensitiveTargets(lng, lat, input.sensitiveTargets, sensitiveRadiusM)
    : null;

  // 4. 综合结论
  const nearest = proximity.nearest;
  const nearestSummary = nearest
    ? `最近水源地【${nearest.name}】距离约 ${Math.round(nearest.distanceM)} 米，${nearest.bearingLabel}方向`
    : '附近无水源地';

  const riskLabel = riskLevelLabel(riskMatrix.overallRisk);

  const sensitiveText = sensitiveScreening
    ? `周边 ${sensitiveRadiusM} 米内有 ${sensitiveScreening.totalCount} 个敏感目标`
    : '未启用敏感目标筛查';

  const summary = [
    `查询点风险等级：${riskLabel}。`,
    nearestSummary + '。',
    sensitiveText + '。',
  ].join('');

  return {
    point: { lng, lat },
    proximity,
    overallRisk: riskMatrix.overallRisk,
    riskLabel,
    insideAnyZone: proximity.insideAnyZone,
    nearestSummary,
    sensitiveScreening,
    summary,
  };
}

/**
 * 查询点是否安全（绿线且不在保护区内）
 */
export function isQueryPointSafe(result: SpatialQueryResult): boolean {
  return result.overallRisk === 'green' && !result.insideAnyZone;
}
