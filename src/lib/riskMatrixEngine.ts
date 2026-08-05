/* ===== S12.3: 保护区分级风险矩阵引擎 =====
 * 将项目与多个保护区的关系汇总为红线/黄线/绿线风险矩阵，
 * 输出环评地下水专项评价建议
 */

import { calculateBatchZoneOverlap, type ProjectGeometry } from './zoneOverlapEngine';
import { querySpatialProximity, toProximitySources } from './spatialProximityEngine';

// ===== 类型定义 =====

export type RiskLevel = 'red' | 'yellow' | 'green';

export interface ZoneRiskItem {
  sourceName: string;
  sourceId: string;
  /** 保护区级别（一级/二级/准保护区） */
  zoneLevel: string;
  /** 是否与项目重叠 */
  isOverlap: boolean;
  /** 重叠面积（平方米） */
  overlapAreaM2: number;
  /** 项目中心到保护区边界的最短距离（米，负=在保护区内） */
  edgeDistanceM: number;
  /** 风险等级 */
  risk: RiskLevel;
  /** 风险原因说明 */
  reason: string;
}

export interface RiskMatrixResult {
  /** 项目名称 */
  projectName: string;
  /** 项目总体风险等级 */
  overallRisk: RiskLevel;
  /** 逐保护区风险评估 */
  zones: ZoneRiskItem[];
  /** 是否涉及任何保护区重叠 */
  hasOverlap: boolean;
  /** 是否禁止建设 */
  banned: boolean;
  /** 是否需要地下水环境影响专项评价 */
  requiresGroundwaterAssessment: boolean;
  /** 环评结论建议 */
  conclusion: string;
  /** 建议采取的管理措施 */
  measures: string[];
}

// ===== 警戒阈值 =====

/** 紧邻警戒距离（米），边界距离小于此值视为高风险紧邻 */
export const EDGE_WARNING_M = 200;
/** 安全距离（米），边界距离大于此值视为绿色 */
export const EDGE_SAFE_M = 500;

// ===== 风险判定 =====

export interface ZoneRiskInput {
  sourceName: string;
  sourceId: string;
  zoneLevel: string;
  isOverlap: boolean;
  overlapAreaM2?: number;
  /** 项目中心到保护区边界距离（米），负=在保护区内 */
  edgeDistanceM: number;
}

/**
 * 单个保护区风险分级
 * 红线：涉及一级保护区重叠，或明显侵入二级保护区
 * 黄线：涉及二级/准保护区重叠，或紧邻（边界距离在警戒范围内）
 * 绿线：不涉及且距离安全
 */
export function gradeZoneRisk(input: ZoneRiskInput): { risk: RiskLevel; reason: string } {
  const { zoneLevel, isOverlap, edgeDistanceM } = input;

  // 涉及一级保护区重叠 → 红线（禁建）
  if (zoneLevel === '一级' && isOverlap) {
    return { risk: 'red', reason: '涉及一级保护区，依法禁止可能污染地下水的建设项目' };
  }

  // 涉及二级保护区重叠 → 红线（需严格管控）或黄线
  if (zoneLevel === '二级' && isOverlap) {
    return {
      risk: 'red',
      reason: '涉及二级保护区，需开展地下水环境影响专项评价并采取防渗措施',
    };
  }

  // 涉及准保护区重叠 → 黄线
  if (isOverlap) {
    return { risk: 'yellow', reason: '涉及准保护区，需开展地下水环境影响评价并落实防护措施' };
  }

  // 紧邻（边界距离小于警戒值）→ 黄线
  if (edgeDistanceM < EDGE_WARNING_M) {
    return {
      risk: 'yellow',
      reason: `距保护区边界仅 ${Math.round(Math.abs(edgeDistanceM))}m，处于紧邻敏感区，需评估影响`,
    };
  }

  // 边界距离在安全距离内 → 黄线（仍需关注）
  if (edgeDistanceM < EDGE_SAFE_M) {
    return {
      risk: 'yellow',
      reason: `距保护区边界 ${Math.round(edgeDistanceM)}m，处于影响缓冲范围`,
    };
  }

  // 距离安全 → 绿线
  return { risk: 'green', reason: `距保护区边界 ${Math.round(edgeDistanceM)}m，距离安全` };
}

// ===== 矩阵构建 =====

export interface RiskMatrixOptions {
  /** 项目名称 */
  projectName: string;
  /** 项目几何 */
  project: ProjectGeometry;
  /** 保护区列表 */
  zones: Array<{
    sourceName: string;
    sourceId: string;
    level: string;
    centerLng: number;
    centerLat: number;
    radiusM: number;
  }>;
  /** 项目参考坐标（用于边界距离计算，取项目中心） */
  refLng: number;
  refLat: number;
}

/**
 * 构建保护区分级风险矩阵
 * 内部组合占用精算 + 邻近检索
 */
export function buildRiskMatrix(options: RiskMatrixOptions): RiskMatrixResult {
  const { projectName, project, zones, refLng, refLat } = options;

  // 1. 占用精算
  const overlapResult = calculateBatchZoneOverlap({
    project,
    zones: zones.map((z) => ({
      sourceName: z.sourceName,
      sourceId: z.sourceId,
      center: { lng: z.centerLng, lat: z.centerLat },
      radiusM: z.radiusM,
      level: z.level,
    })),
  });

  // 2. 邻近检索（边界距离）
  const proximity = querySpatialProximity(
    refLng,
    refLat,
    toProximitySources(
      zones.map((z) => ({
        id: z.sourceId,
        name: z.sourceName,
        cityName: '',
        lng: z.centerLng,
        lat: z.centerLat,
        level: z.level,
      })),
      // 用各自半径
    ),
    { searchRadiusM: 50000 },
  );

  // 用每个保护区自己的半径重算边界距离
  const edgeBySource = new Map<string, number>();
  for (const z of zones) {
    const distM = proximity.withinRadius.find((p) => p.id === z.sourceId);
    // proximity 用默认半径，改用精确 haversine - radius
    edgeBySource.set(z.sourceId, (distM?.distanceM ?? Number.MAX_SAFE_INTEGER) - z.radiusM);
  }

  // 3. 逐保护区分级
  const zoneItems: ZoneRiskItem[] = zones.map((z) => {
    const overlap = overlapResult.results.find((r) => r.sourceId === z.sourceId);
    const isOverlap = overlap?.isOverlap ?? false;
    const edgeDistanceM = edgeBySource.get(z.sourceId) ?? Number.MAX_SAFE_INTEGER;

    const { risk, reason } = gradeZoneRisk({
      sourceName: z.sourceName,
      sourceId: z.sourceId,
      zoneLevel: z.level,
      isOverlap,
      overlapAreaM2: overlap?.overlapAreaM2 ?? 0,
      edgeDistanceM,
    });

    return {
      sourceName: z.sourceName,
      sourceId: z.sourceId,
      zoneLevel: z.level,
      isOverlap,
      overlapAreaM2: overlap?.overlapAreaM2 ?? 0,
      edgeDistanceM,
      risk,
      reason,
    };
  });

  // 4. 总体风险
  const riskRank: Record<RiskLevel, number> = { red: 3, yellow: 2, green: 1 };
  let overallRisk: RiskLevel = 'green';
  for (const item of zoneItems) {
    if (riskRank[item.risk] > riskRank[overallRisk]) {
      overallRisk = item.risk;
    }
  }

  const hasOverlap = zoneItems.some((i) => i.isOverlap);
  const banned = zoneItems.some((i) => i.risk === 'red');
  const requiresGroundwaterAssessment = zoneItems.some((i) => i.risk !== 'green');

  // 5. 环评结论与措施
  const conclusion = buildConclusion(overallRisk, banned);
  const measures = buildMeasures(overallRisk, zoneItems);

  return {
    projectName,
    overallRisk,
    zones: zoneItems,
    hasOverlap,
    banned,
    requiresGroundwaterAssessment,
    conclusion,
    measures,
  };
}

// ===== 结论生成 =====

function buildConclusion(
  overallRisk: RiskLevel,
  banned: boolean,
): string {
  if (banned) {
    return '项目涉及水源地保护区核心区域（一级/二级保护区），依法禁止建设可能污染地下水的项目，建议另行选址。';
  }
  if (overallRisk === 'yellow') {
    return '项目位于水源地保护区影响范围或紧邻敏感区，需开展地下水环境影响专项评价，并落实污染防治与防渗措施。';
  }
  return '项目距离水源地保护区较远，空间关系安全，可正常推进，但仍应遵守地下水保护的一般要求。';
}

function buildMeasures(overallRisk: RiskLevel, zones: ZoneRiskItem[]): string[] {
  const measures: string[] = [];

  if (overallRisk === 'red') {
    measures.push('禁止在保护区内设置排污口或排放废水的生产设施');
    measures.push('采取严格的防渗措施，防止污染地下水');
    measures.push('设置地下水水质监测井，建立长期监测计划');
    measures.push('避让保护区核心区域，优化项目布局');
  } else if (overallRisk === 'yellow') {
    measures.push('开展地下水环境影响专项评价');
    measures.push('评估项目对水源地水质、水量的潜在影响');
    measures.push('制定风险应急预案与监测方案');
  } else {
    measures.push('保持与水源地保护区的安全距离');
    measures.push('遵守地下水环境保护相关法规要求');
  }

  // 叠加涉及保护区提示
  const involved = zones.filter((z) => z.risk !== 'green');
  if (involved.length > 0) {
    measures.push(`涉及 ${involved.length} 个水源地保护区的空间管控要求，需逐一评估`);
  }

  return measures;
}

// ===== 格式化 =====

export function riskLevelLabel(level: RiskLevel): string {
  const labels: Record<RiskLevel, string> = { red: '红线', yellow: '黄线', green: '绿线' };
  return labels[level];
}

export function riskLevelColor(level: RiskLevel): string {
  const colors: Record<RiskLevel, string> = {
    red: 'bg-red-100 text-red-700 border-red-200',
    yellow: 'bg-amber-100 text-amber-700 border-amber-200',
    green: 'bg-green-100 text-green-700 border-green-200',
  };
  return colors[level];
}
