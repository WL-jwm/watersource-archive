/* ===== S12.8: 空间分析综合报告引擎 =====
 * 将 S12 各引擎（邻近/风险矩阵/敏感筛查/汇水/密度/关系矩阵/综合查询）的结果
 * 汇总为一份结构化、可导出的空间分析综合报告。
 * 设计为纯函数构建章节数据（便于单测），docx 渲染单独提供。
 */

import { riskLevelLabel, type RiskMatrixResult } from './riskMatrixEngine';
import { categoryLabel, type SensitiveScreeningResult } from './sensitiveScreeningEngine';
import type { UpstreamAnalysisBatchResult } from './upstreamAnalysisEngine';
import type { SpatialProximityResponse } from './spatialProximityEngine';
import type { SpatialQueryResult } from './spatialQueryEngine';
import type { RelationMatrixResult } from './spatialRelationMatrixEngine';
import type { DensityGridResult, Cluster, DistributionStats } from './spatialDensityEngine';

// ===== 报告输入 =====

export interface SpatialReportInput {
  /** 报告标题（默认自动生成） */
  title?: string;
  /** 分析对象（项目/查询点） */
  projectName?: string;
  /** 分析点坐标 */
  point?: { lng: number; lat: number };
  /** S12.9 综合空间查询结果 */
  query?: SpatialQueryResult;
  /** S12.3 风险矩阵结果 */
  riskMatrix?: RiskMatrixResult;
  /** S12.5 敏感目标筛查结果 */
  sensitive?: SensitiveScreeningResult;
  /** S12.7 汇水/上游分析结果 */
  upstream?: UpstreamAnalysisBatchResult;
  /** S12.1 邻近检索结果 */
  proximity?: SpatialProximityResponse;
  /** S12.4 密度分析（网格+聚类+统计） */
  density?: { grid: DensityGridResult; clusters: Cluster[]; stats: DistributionStats };
  /** S12.6 空间关系矩阵 */
  relationMatrix?: RelationMatrixResult;
  /** 创建时间戳 */
  createdAt?: number;
}

// ===== 报告章节 =====

export interface ReportTable {
  headers: string[];
  rows: string[][];
}

export interface ReportSection {
  /** 章节标题 */
  heading: string;
  /** 段落文本 */
  paragraphs: string[];
  /** 表格（可选） */
  table?: ReportTable;
}

export interface SpatialReport {
  title: string;
  projectName: string;
  createdAt: number;
  sections: ReportSection[];
  /** 总体结论 */
  conclusion: string;
}

// ===== 工具：格式化 =====

function fmt(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !isFinite(value)) return '—';
  return value.toFixed(digits);
}

function fmtDist(m: number | null | undefined): string {
  if (m === null || m === undefined || !isFinite(m)) return '—';
  if (m >= 1000) return `${fmt(m / 1000, 2)} km`;
  return `${Math.round(m)} m`;
}

// ===== 章节构建（纯函数） =====

/**
 * 构建综合报告全部章节（纯函数，供单测）
 */
export function buildSpatialReportSections(input: SpatialReportInput): ReportSection[] {
  const sections: ReportSection[] = [];

  // ---- 一、分析概述 ----
  const overviewParagraphs: string[] = [];
  if (input.projectName) overviewParagraphs.push(`本次空间分析对象：【${input.projectName}】。`);
  if (input.point) {
    overviewParagraphs.push(
      `分析点坐标：经度 ${fmt(input.point.lng, 6)}°，纬度 ${fmt(input.point.lat, 6)}°。`,
    );
  }
  const enabled: string[] = [];
  if (input.proximity) enabled.push('邻近检索');
  if (input.riskMatrix) enabled.push('风险矩阵评估');
  if (input.sensitive) enabled.push('敏感目标筛查');
  if (input.upstream) enabled.push('汇水/上游判断');
  if (input.density) enabled.push('空间密度聚类');
  if (input.relationMatrix) enabled.push('空间关系矩阵');
  if (input.query) enabled.push('综合空间查询');
  overviewParagraphs.push(
    `本报告集成 ${enabled.length} 项空间分析能力：${enabled.join('、')}。`,
  );
  sections.push({
    heading: '一、分析概述',
    paragraphs: overviewParagraphs,
  });

  // ---- 二、综合空间查询结论 ----
  if (input.query) {
    const q = input.query;
    sections.push({
      heading: '二、综合空间查询结论',
      paragraphs: [
        `总体风险等级：${q.riskLabel}。`,
        q.nearestSummary + '。',
        q.insideAnyZone
          ? '查询点位于保护区内，需重点评估。'
          : '查询点位于保护区外。',
        q.sensitiveScreening
          ? `周边 ${fmt(q.sensitiveScreening.radiusM, 0)} 米内敏感目标 ${q.sensitiveScreening.totalCount} 个。`
          : '未启用敏感目标筛查。',
        `综合结论：${q.summary}`,
      ],
      table: {
        headers: ['指标', '值'],
        rows: [
          ['风险等级', q.riskLabel],
          ['是否位于保护区内', q.insideAnyZone ? '是' : '否'],
          ['最近水源地', q.nearestSummary],
        ],
      },
    });
  }

  // ---- 三、邻近检索结果 ----
  if (input.proximity) {
    const p = input.proximity;
    const rows = (p.withinRadius ?? []).map((n) => [
      n.name,
      n.bearingLabel,
      fmtDist(n.distanceM),
      n.level ?? '—',
    ]);
    sections.push({
      heading: '三、邻近水源地检索',
      paragraphs: [
        `共命中 ${p.withinRadius?.length ?? 0} 个水源地（按距离升序）。`,
        p.insideAnyZone
          ? '分析点位于保护区内。'
          : '分析点未落入任何保护区。',
      ],
      table: {
        headers: ['水源地', '方位', '距离', '级别'],
        rows,
      },
    });
  }

  // ---- 四、风险矩阵评估 ----
  if (input.riskMatrix) {
    const r = input.riskMatrix;
    const rows = r.zones.map((z) => [
      z.sourceName,
      z.zoneLevel,
      fmtDist(z.edgeDistanceM),
      z.isOverlap ? '是' : '否',
      riskLevelLabel(z.risk),
      z.reason,
    ]);
    sections.push({
      heading: '四、风险矩阵评估',
      paragraphs: [
        `总体风险等级：${riskLevelLabel(r.overallRisk)}。`,
        r.hasOverlap ? '与部分保护区存在重叠。' : '未与保护区重叠。',
        r.banned ? '该项目涉及禁止建设情形。' : '未触发禁止建设。',
        r.requiresGroundwaterAssessment
          ? '需开展地下水环境影响专项评价。'
          : '暂不要求专项评价。',
        `环评结论：${r.conclusion}`,
      ],
      table: {
        headers: ['水源地', '级别', '边界距离', '重叠', '风险', '原因'],
        rows,
      },
    });
  }

  // ---- 五、敏感目标筛查 ----
  if (input.sensitive) {
    const s = input.sensitive;
    const catRows = Object.entries(s.categoryCounts)
      .filter(([, c]) => c > 0)
      .map(([cat, c]) => [categoryLabel(cat as never), String(c)]);
    sections.push({
      heading: '五、敏感目标筛查',
      paragraphs: [
        `筛查半径 ${fmtDist(s.radiusM)}，共识别敏感目标 ${s.totalCount} 个。`,
        s.nearest
          ? `最近敏感目标【${s.nearest.name}】距离 ${fmtDist(s.nearest.distanceM)}，位于${s.nearest.bearingLabel}方向（${s.nearest.categoryLabel}）。`
          : '半径内无敏感目标。',
      ],
      table: {
        headers: ['类别', '数量'],
        rows: catRows,
      },
    });
  }

  // ---- 六、汇水/上游判断 ----
  if (input.upstream) {
    const u = input.upstream;
    const rows = u.results.map((r) => [
      r.sourceName,
      r.projectBearingLabel,
      r.relation,
      r.isUpstream ? '是' : '否',
      r.confidence >= 0.8 ? '高' : r.confidence >= 0.5 ? '中' : '低',
      r.reason,
    ]);
    sections.push({
      heading: '六、汇水/上游关系判断',
      paragraphs: [
        u.upstreamOfAny
          ? `项目可能位于 ${u.upstreamSources.length} 个水源地的上游汇水区。`
          : '项目推断位于水源地下游或侧向。',
      ],
      table: {
        headers: ['水源地', '项目方位', '关系', '上游', '置信度', '判断依据'],
        rows,
      },
    });
  }

  // ---- 七、空间密度与聚类 ----
  if (input.density) {
    const { grid, clusters, stats } = input.density;
    const clusterRows = clusters.map((c, i) => [
      `聚类${i + 1}`,
      fmt(c.centerLng, 4),
      fmt(c.centerLat, 4),
      String(c.sourceCount),
      fmtDist(c.radiusM),
    ]);
    sections.push({
      heading: '七、空间密度与聚类分析',
      paragraphs: [
        `研究区共 ${grid.totalSources} 个水源地，密度网格 ${grid.cells.length} 个，最大格内计数 ${grid.maxCount}。`,
        `最近邻指数 R = ${fmt(stats.nearestNeighborIndex, 3)}（${distributionLabelOf(stats.nearestNeighborIndex)}）。`,
        `识别 ${clusters.length} 个水源地富集聚类。`,
      ],
      table: {
        headers: ['聚类', '中心经度', '中心纬度', '水源数', '半径'],
        rows: clusterRows,
      },
    });
  }

  // ---- 八、空间关系矩阵 ----
  if (input.relationMatrix) {
    const rm = input.relationMatrix;
    const rows = rm.significantCells.map((c) => [
      c.projectName,
      c.sourceName,
      fmtDist(c.distanceM),
      c.bearingLabel,
      c.isInZone ? '内' : '外',
      fmtDist(c.zoneEdgeDistanceM),
      riskLevelLabel(c.risk),
    ]);
    sections.push({
      heading: '八、空间关系矩阵',
      paragraphs: [
        `涉及 ${rm.projects.length} 个项目、${rm.sources.length} 个水源地，共 ${rm.cells.length} 组关联，其中显著关联 ${rm.significantCells.length} 组。`,
      ],
      table: {
        headers: ['项目', '水源地', '中心距', '方位', '区内', '边界距', '风险'],
        rows,
      },
    });
  }

  return sections;
}

// ===== 综合结论 =====

/**
 * 汇总综合报告结论（纯函数）
 */
export function buildSpatialReportConclusion(input: SpatialReportInput): string {
  const parts: string[] = [];

  if (input.query) {
    parts.push(`查询点风险等级：${input.query.riskLabel}`);
    if (input.query.insideAnyZone) parts.push('且位于保护区内，需重点评估');
  } else if (input.riskMatrix) {
    parts.push(`风险等级：${riskLevelLabel(input.riskMatrix.overallRisk)}`);
  }

  if (input.sensitive && input.sensitive.totalCount > 0) {
    parts.push(`周边 ${input.sensitive.totalCount} 个敏感目标`);
  }

  if (input.upstream && input.upstream.upstreamOfAny) {
    parts.push(`可能位于 ${input.upstream.upstreamSources.length} 个水源地上游`);
  }

  const conclusion =
    parts.length > 0
      ? parts.join('；') + '。建议结合项目类型与环评导则进一步核定。'
      : '未提供足够分析数据，暂无法给出综合结论。';

  return conclusion;
}

/**
 * 构建完整空间分析报告对象（纯函数，供单测）
 */
export function buildSpatialReport(input: SpatialReportInput): SpatialReport {
  const title = input.title ?? '水源地空间分析综合报告';
  const projectName = input.projectName ?? '未命名分析';
  const createdAt = input.createdAt ?? Date.now();

  const sections = buildSpatialReportSections(input);
  const conclusion = buildSpatialReportConclusion(input);

  return { title, projectName, createdAt, sections, conclusion };
}

// ===== 密度统计辅助（供报告引擎内部使用） =====

/** 最近邻指数 → 分布描述（避免循环依赖，独立实现） */
function distributionLabelOf(index: number): string {
  if (index < 0.7) return '聚集分布';
  if (index < 1.3) return '随机分布';
  return '均匀分布';
}
