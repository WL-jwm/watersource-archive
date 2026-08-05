/* ===== S12.7: 汇水/上游关系分析引擎 =====
 * 简化水文判断：项目是否位于水源地上游集水区。
 * 基于水源地方位 + 水系流向方向（N/S/E/W/NE/NW/SE/SW 八方向）推断。
 * 注意：此为简化模型，不替代真实 DEM 汇水分析。
 */

import { haversineDistance } from './spatialAnalysis';
import { bearingDegrees } from './spatialProximityEngine';

// ===== 类型定义 =====

export type FlowDirection = 'N' | 'S' | 'E' | 'W' | 'NE' | 'NW' | 'SE' | 'SW';

export interface WaterSource {
  id: string;
  name: string;
  lng: number;
  lat: number;
  /** 水系主流向（自上游流向水源地） */
  flowDirection: FlowDirection;
  /** 水源地类型（河流型/水库型） */
  sourceType?: string;
}

export interface UpstreamAnalysisResult {
  sourceId: string;
  sourceName: string;
  /** 项目是否位于水源地上游 */
  isUpstream: boolean;
  /** 项目相对水源地的方位 */
  projectBearingDeg: number;
  /** 项目相对水源地的方位描述 */
  projectBearingLabel: string;
  /** 与主流向的关系描述 */
  relation: string;
  /** 判断依据 */
  reason: string;
  /** 置信度 0-1（简化模型取固定或方位接近度） */
  confidence: number;
}

export interface UpstreamAnalysisBatchResult {
  /** 逐水源地判断 */
  results: UpstreamAnalysisResult[];
  /** 是否位于任一水源地上游 */
  upstreamOfAny: boolean;
  /** 位于上游的水源地 */
  upstreamSources: UpstreamAnalysisResult[];
}

// ===== 方位关系 =====

const FLOW_LABELS: Record<FlowDirection, string> = {
  N: '自南向北',
  S: '自北向南',
  E: '自西向东',
  W: '自东向西',
  NE: '自西南向东北',
  NW: '自东南向西北',
  SE: '自西北向东南',
  SW: '自东北向西南',
};

/**
 * 判断一个方向是否与流向一致（上游方向）
 * 流向表示水从哪个方向来。例如流向 N（自南向北），上游在南侧。
 */
export function isUpstreamDirection(
  projectBearingDeg: number,
  flowDirection: FlowDirection,
): { isUpstream: boolean; angleDiffDeg: number } {
  // 流向方位角（水来自的方向）
  const flowFromAzimuth: Record<FlowDirection, number> = {
    N: 180, // 水自南(180°)来
    S: 0,
    E: 270,
    W: 90,
    NE: 225,
    NW: 135,
    SE: 315,
    SW: 45,
  };

  const fromAzimuth = flowFromAzimuth[flowDirection];
  // 角度差（取最小夹角）
  let diff = Math.abs(projectBearingDeg - fromAzimuth);
  if (diff > 180) diff = 360 - diff;

  // 上游判定：项目方位与"水来自方向"夹角 < 90° 视为上游
  const isUpstream = diff < 90;

  return { isUpstream, angleDiffDeg: diff };
}

/**
 * 方位角转中文方位（八方位）
 */
export function bearingToCompassLabel(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360;
  const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
  const idx = Math.round(normalized / 45) % 8;
  return dirs[idx];
}

// ===== 核心分析 =====

export interface UpstreamAnalysisInput {
  /** 项目坐标 */
  projectLng: number;
  projectLat: number;
  /** 水源地列表 */
  sources: WaterSource[];
}

/**
 * 判断项目是否位于水源地上游
 */
export function analyzeUpstreamRelation(
  projectLng: number,
  projectLat: number,
  source: WaterSource,
): UpstreamAnalysisResult {
  const projectBearing = bearingDegrees(source.lat, source.lng, projectLat, projectLng);

  const { isUpstream, angleDiffDeg } = isUpstreamDirection(projectBearing, source.flowDirection);

  // 置信度：夹角越小越接近正上游
  const confidence = Math.max(0, 1 - angleDiffDeg / 90);

  const compass = bearingToCompassLabel(projectBearing);
  const reason = isUpstream
    ? `项目位于水源地${compass}侧，处于${FLOW_LABELS[source.flowDirection]}的来水方向，可能位于汇水上游`
    : `项目位于水源地${compass}侧，与${FLOW_LABELS[source.flowDirection]}流向不符，推断位于下游或侧向`;

  return {
    sourceId: source.id,
    sourceName: source.name,
    isUpstream,
    projectBearingDeg: projectBearing,
    projectBearingLabel: compass,
    relation: isUpstream ? '上游' : '下游/侧向',
    reason,
    confidence,
  };
}

/**
 * 批量判断项目是否位于多个水源地上游
 */
export function analyzeUpstreamBatch(
  input: UpstreamAnalysisInput,
): UpstreamAnalysisBatchResult {
  const results = input.sources.map((s) =>
    analyzeUpstreamRelation(input.projectLng, input.projectLat, s),
  );

  const upstreamSources = results.filter((r) => r.isUpstream);

  return {
    results,
    upstreamOfAny: upstreamSources.length > 0,
    upstreamSources,
  };
}

// ===== 结论 =====

/**
 * 生成环评水文关系结论
 */
export function buildUpstreamConclusion(result: UpstreamAnalysisBatchResult): string {
  if (result.upstreamSources.length === 0) {
    return '项目推断位于水源地下游或侧向，对水源地上游汇水区影响较小，但仍需结合实测水文资料核实。';
  }

  const names = result.upstreamSources.map((r) => r.sourceName).join('、');
  const maxConfidence = Math.max(...result.upstreamSources.map((r) => r.confidence));

  if (maxConfidence >= 0.8) {
    return `项目可能位于水源地【${names}】的上游汇水区，存在污染物随地表径流进入水源地的风险，建议开展专项水文地质与汇水分析。`;
  }

  return `项目可能位于水源地【${names}】上游方向，建议结合地形与汇水范围进一步核实水文影响。`;
}

export function flowDirectionLabel(dir: FlowDirection): string {
  return FLOW_LABELS[dir];
}
