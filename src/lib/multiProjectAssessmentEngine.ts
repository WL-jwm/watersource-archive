/* ===== S12.10: 多项目批量综合评估引擎 =====
 * 对多个建设项目批量执行完整 S12 综合空间评估：
 * 每个项目分别做 风险矩阵 + 敏感目标筛查 + 汇水/上游判断 + 邻近检索，
 * 输出逐项目结果、批量汇总统计与排序，用于环评筛选。
 */

import { buildRiskMatrix, riskLevelLabel, type RiskLevel, type RiskMatrixResult } from './riskMatrixEngine';
import { screenSensitiveTargets, type SensitiveScreeningResult, type SensitiveTarget } from './sensitiveScreeningEngine';
import { analyzeUpstreamBatch, type UpstreamAnalysisBatchResult, type WaterSource } from './upstreamAnalysisEngine';
import { querySpatialProximity, type SpatialProximityResponse, type ProximitySource } from './spatialProximityEngine';

// ===== 输入类型 =====

/** 待评估项目 */
export interface AssessedProjectInput {
  id: string;
  name: string;
  lng: number;
  lat: number;
  /** 项目占地半径（米），点状默认 0 */
  radiusM?: number;
  /** 项目类型/行业（可选） */
  type?: string;
}

/** 参与评估的水源地保护区 */
export interface AssessZoneInput {
  sourceId: string;
  sourceName: string;
  level: string;
  centerLng: number;
  centerLat: number;
  radiusM: number;
}

/** 参与评估的敏感目标 */
export interface AssessSensitiveInput extends SensitiveTarget {}

/** 参与评估的水源地（汇水判断用） */
export interface AssessWaterSource extends WaterSource {}

export interface MultiProjectAssessmentInput {
  projects: AssessedProjectInput[];
  /** 保护区列表 */
  zones: AssessZoneInput[];
  /** 敏感目标（可选） */
  sensitiveTargets?: AssessSensitiveInput[];
  /** 敏感筛查半径（米，默认 5000） */
  sensitiveRadiusM?: number;
  /** 邻近检索半径（米，默认 10000） */
  searchRadiusM?: number;
  /** 水源地（汇水判断用，可选） */
  waterSources?: AssessWaterSource[];
}

// ===== 单项结果 =====

export interface ProjectAssessmentResult {
  projectId: string;
  projectName: string;
  projectType: string;
  /** 总体风险等级 */
  overallRisk: RiskLevel;
  /** 风险等级中文 */
  riskLabel: string;
  /** 是否与任一保护区重叠 */
  hasOverlap: boolean;
  /** 是否触发禁止建设 */
  banned: boolean;
  /** 是否需地下水专项评价 */
  requiresGroundwaterAssessment: boolean;
  /** 是否位于任一水源地上游 */
  upstreamOfAny: boolean;
  /** 上游水源地数量 */
  upstreamCount: number;
  /** 周边敏感目标数量 */
  sensitiveCount: number;
  /** 最近水源地距离（米） */
  nearestDistanceM: number;
  /** 最近水源地名称 */
  nearestSourceName: string;
  /** 环评结论 */
  conclusion: string;
  /** 明细数据（风险矩阵） */
  riskMatrix: RiskMatrixResult;
  /** 明细数据（敏感筛查） */
  sensitive: SensitiveScreeningResult | null;
  /** 明细数据（汇水） */
  upstream: UpstreamAnalysisBatchResult | null;
  /** 明细数据（邻近） */
  proximity: SpatialProximityResponse;
  /** 综合得分（数值越小越需优先关注，用于排序） */
  score: number;
}

// ===== 批量结果 =====

export interface MultiProjectAssessmentResult {
  totalProjects: number;
  /** 按风险分级计数 */
  riskCounts: Record<RiskLevel, number>;
  /** 重叠保护区项目数 */
  overlapCount: number;
  /** 禁止建设项目数 */
  bannedCount: number;
  /** 需专项评价项目数 */
  groundwaterAssessmentCount: number;
  /** 位于上游项目数 */
  upstreamCount: number;
  /** 涉及敏感目标项目数 */
  sensitiveInvolvedCount: number;
  /** 逐项目结果（按 score 降序，即越危险越靠前） */
  results: ProjectAssessmentResult[];
  /** 汇总表（供表格/导出） */
  summaryTable: Array<{
    projectName: string;
    projectType: string;
    risk: string;
    overlap: string;
    banned: string;
    upstream: string;
    sensitive: string;
    nearest: string;
    conclusion: string;
  }>;
}

// ===== 综合打分 =====

const RISK_WEIGHT: Record<RiskLevel, number> = { red: 100, yellow: 40, green: 0 };

/**
 * 计算项目综合风险得分（数值越大越危险）
 */
export function computeProjectScore(
  risk: RiskLevel,
  opts: {
    banned?: boolean;
    requiresGroundwaterAssessment?: boolean;
    upstreamOfAny?: boolean;
    sensitiveCount?: number;
  } = {},
): number {
  let score = RISK_WEIGHT[risk];
  if (opts.banned) score += 60;
  if (opts.requiresGroundwaterAssessment) score += 25;
  if (opts.upstreamOfAny) score += 15;
  if (opts.sensitiveCount && opts.sensitiveCount > 0) score += 10;
  return score;
}

// ===== 核心评估 =====

/**
 * 对单个项目执行完整综合评估
 */
export function assessSingleProject(
  project: AssessedProjectInput,
  input: Omit<MultiProjectAssessmentInput, 'projects'>,
): ProjectAssessmentResult {
  const radiusM = project.radiusM ?? 0;
  const searchRadiusM = input.searchRadiusM ?? 10000;
  const sensitiveRadiusM = input.sensitiveRadiusM ?? 5000;

  // 1. 风险矩阵
  const riskMatrix = buildRiskMatrix({
    projectName: project.name,
    project: { type: 'circle', lng: project.lng, lat: project.lat, radiusM },
    zones: input.zones.map((z) => ({
      sourceName: z.sourceName,
      sourceId: z.sourceId,
      level: z.level,
      centerLng: z.centerLng,
      centerLat: z.centerLat,
      radiusM: z.radiusM,
    })),
    refLng: project.lng,
    refLat: project.lat,
  });

  // 2. 敏感目标筛查
  const sensitive =
    input.sensitiveTargets && input.sensitiveTargets.length > 0
      ? screenSensitiveTargets(project.lng, project.lat, input.sensitiveTargets, sensitiveRadiusM)
      : null;

  // 3. 汇水/上游判断
  const upstream =
    input.waterSources && input.waterSources.length > 0
      ? analyzeUpstreamBatch({
          projectLng: project.lng,
          projectLat: project.lat,
          sources: input.waterSources,
        })
      : null;

  // 4. 邻近检索
  const proximity = querySpatialProximity(
    project.lng,
    project.lat,
    input.zones.map<ProximitySource>((z) => ({
      id: z.sourceId,
      name: z.sourceName,
      cityName: '',
      lng: z.centerLng,
      lat: z.centerLat,
      level: z.level,
      zoneRadiusM: z.radiusM,
    })),
    { searchRadiusM },
  );

  const nearest = proximity.nearest;
  const nearestDistanceM = nearest ? nearest.distanceM : Infinity;
  const nearestSourceName = nearest ? nearest.name : '—';

  const upstreamCount = upstream ? upstream.upstreamSources.length : 0;
  const sensitiveCount = sensitive ? sensitive.totalCount : 0;

  const score = computeProjectScore(riskMatrix.overallRisk, {
    banned: riskMatrix.banned,
    requiresGroundwaterAssessment: riskMatrix.requiresGroundwaterAssessment,
    upstreamOfAny: upstream ? upstream.upstreamOfAny : false,
    sensitiveCount,
  });

  // 综合结论
  const conclusion = riskMatrix.conclusion;

  return {
    projectId: project.id,
    projectName: project.name,
    projectType: project.type ?? '—',
    overallRisk: riskMatrix.overallRisk,
    riskLabel: riskLevelLabel(riskMatrix.overallRisk),
    hasOverlap: riskMatrix.hasOverlap,
    banned: riskMatrix.banned,
    requiresGroundwaterAssessment: riskMatrix.requiresGroundwaterAssessment,
    upstreamOfAny: upstream ? upstream.upstreamOfAny : false,
    upstreamCount,
    sensitiveCount,
    nearestDistanceM,
    nearestSourceName,
    conclusion,
    riskMatrix,
    sensitive,
    upstream,
    proximity,
    score,
  };
}

/**
 * 批量执行多项目综合评估
 */
export function assessProjectsBatch(
  input: MultiProjectAssessmentInput,
): MultiProjectAssessmentResult {
  const { projects } = input;
  const rest: Omit<MultiProjectAssessmentInput, 'projects'> = {
    zones: input.zones,
    sensitiveTargets: input.sensitiveTargets,
    sensitiveRadiusM: input.sensitiveRadiusM,
    searchRadiusM: input.searchRadiusM,
    waterSources: input.waterSources,
  };

  const results = projects.map((p) => assessSingleProject(p, rest));

  // 按 score 降序（越危险越靠前）
  const sorted = [...results].sort((a, b) => b.score - a.score);

  const riskCounts: Record<RiskLevel, number> = { red: 0, yellow: 0, green: 0 };
  let overlapCount = 0;
  let bannedCount = 0;
  let groundwaterAssessmentCount = 0;
  let upstreamCount = 0;
  let sensitiveInvolvedCount = 0;

  for (const r of results) {
    riskCounts[r.overallRisk]++;
    if (r.hasOverlap) overlapCount++;
    if (r.banned) bannedCount++;
    if (r.requiresGroundwaterAssessment) groundwaterAssessmentCount++;
    if (r.upstreamOfAny) upstreamCount++;
    if (r.sensitiveCount > 0) sensitiveInvolvedCount++;
  }

  const summaryTable = sorted.map((r) => ({
    projectName: r.projectName,
    projectType: r.projectType,
    risk: r.riskLabel,
    overlap: r.hasOverlap ? '是' : '否',
    banned: r.banned ? '是' : '否',
    upstream: r.upstreamOfAny ? `是(${r.upstreamCount})` : '否',
    sensitive: r.sensitiveCount > 0 ? String(r.sensitiveCount) : '0',
    nearest: r.nearestSourceName === '—' ? '—' : `${r.nearestSourceName}(${Math.round(r.nearestDistanceM)}m)`,
    conclusion: r.conclusion,
  }));

  return {
    totalProjects: projects.length,
    riskCounts,
    overlapCount,
    bannedCount,
    groundwaterAssessmentCount,
    upstreamCount,
    sensitiveInvolvedCount,
    results: sorted,
    summaryTable,
  };
}

// ===== 辅助：导出 CSV =====

/**
 * 批量评估汇总表转 CSV 文本
 */
export function assessmentToCsv(result: MultiProjectAssessmentResult): string {
  const header = ['项目', '类型', '风险', '重叠', '禁止', '上游', '敏感数', '最近水源地', '结论'];
  const lines = [header.join(',')];
  for (const r of result.results) {
    lines.push(
      [
        r.projectName,
        r.projectType,
        r.riskLabel,
        r.hasOverlap ? '是' : '否',
        r.banned ? '是' : '否',
        r.upstreamOfAny ? '是' : '否',
        String(r.sensitiveCount),
        r.nearestSourceName,
        `"${r.conclusion.replace(/"/g, '""')}"`,
      ].join(','),
    );
  }
  return lines.join('\n');
}
