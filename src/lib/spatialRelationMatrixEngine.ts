/* ===== S12.6: 空间关联矩阵引擎 =====
 * 项目 ↔ 水源地 ↔ 保护区三角关联矩阵，
 * 一次性罗列全部关联关系（距离/方位/重叠/风险），支持导出
 */

import { haversineDistance } from './spatialAnalysis';
import { bearingDegrees, bearingLabel } from './spatialProximityEngine';
import { gradeZoneRisk, type RiskLevel } from './riskMatrixEngine';

// ===== 类型定义 =====

export interface RelationProject {
  id: string;
  name: string;
  lng: number;
  lat: number;
  /** 项目类型 */
  type?: string;
}

export interface RelationSource {
  id: string;
  name: string;
  lng: number;
  lat: number;
  /** 水源类型 */
  type?: string;
  /** 保护区级别 */
  zoneLevel: string;
  /** 保护区半径（米） */
  zoneRadiusM: number;
}

export interface RelationCell {
  projectId: string;
  projectName: string;
  sourceId: string;
  sourceName: string;
  sourceZoneLevel: string;
  /** 项目中心到水源地中心距离（米） */
  distanceM: number;
  /** 方位角 */
  bearingDeg: number;
  /** 方位描述 */
  bearingLabel: string;
  /** 项目中心是否位于保护区内 */
  isInZone: boolean;
  /** 到保护区边界距离（米，负=在保护区内） */
  zoneEdgeDistanceM: number;
  /** 风险等级 */
  risk: RiskLevel;
  /** 风险原因 */
  riskReason: string;
}

export interface RelationMatrixResult {
  projects: RelationProject[];
  sources: RelationSource[];
  /** 全量关联单元格 */
  cells: RelationCell[];
  /** 有实际关联（涉及保护区或紧邻）的单元格 */
  significantCells: RelationCell[];
  /** 统计摘要 */
  summary: RelationSummary;
}

export interface RelationSummary {
  /** 总关联数 */
  totalRelations: number;
  /** 涉及保护区（在保护区内）的项目-水源地对 */
  involvedPairs: number;
  /** 红线关联数 */
  redCount: number;
  /** 黄线关联数 */
  yellowCount: number;
  /** 绿线关联数 */
  greenCount: number;
  /** 涉及红线风险的项目数 */
  redProjects: string[];
  /** 受影响水源地数 */
  affectedSources: string[];
}

// ===== 矩阵构建 =====

/**
 * 构建项目与水源地的空间关联矩阵
 */
export function buildRelationMatrix(
  projects: RelationProject[],
  sources: RelationSource[],
): RelationMatrixResult {
  const cells: RelationCell[] = [];

  for (const project of projects) {
    for (const source of sources) {
      const distanceM = haversineDistance(project.lat, project.lng, source.lat, source.lng);
      const bearing = bearingDegrees(project.lat, project.lng, source.lat, source.lng);
      const zoneEdgeDistanceM = distanceM - source.zoneRadiusM;
      const isInZone = zoneEdgeDistanceM <= 0;

      const { risk, reason } = gradeZoneRisk({
        sourceName: source.name,
        sourceId: source.id,
        zoneLevel: source.zoneLevel,
        isOverlap: isInZone,
        overlapAreaM2: 0,
        edgeDistanceM: zoneEdgeDistanceM,
      });

      cells.push({
        projectId: project.id,
        projectName: project.name,
        sourceId: source.id,
        sourceName: source.name,
        sourceZoneLevel: source.zoneLevel,
        distanceM,
        bearingDeg: bearing,
        bearingLabel: bearingLabel(bearing),
        isInZone,
        zoneEdgeDistanceM,
        risk,
        riskReason: reason,
      });
    }
  }

  // 显著关联：风险非绿色
  const significantCells = cells.filter((c) => c.risk !== 'green');

  return {
    projects,
    sources,
    cells,
    significantCells,
    summary: summarizeRelations(cells, projects),
  };
}

// ===== 汇总 =====

export function summarizeRelations(
  cells: RelationCell[],
  projects: RelationProject[],
): RelationSummary {
  const redCount = cells.filter((c) => c.risk === 'red').length;
  const yellowCount = cells.filter((c) => c.risk === 'yellow').length;
  const greenCount = cells.filter((c) => c.risk === 'green').length;
  const involvedPairs = cells.filter((c) => c.isInZone).length;

  const redProjectIds = new Set(
    cells.filter((c) => c.risk === 'red').map((c) => c.projectId),
  );
  const redProjects = projects
    .filter((p) => redProjectIds.has(p.id))
    .map((p) => p.name);

  const affectedSourceIds = new Set(
    cells.filter((c) => c.risk !== 'green').map((c) => c.sourceId),
  );
  const affectedSources = cells
    .filter((c) => affectedSourceIds.has(c.sourceId))
    .map((c) => c.sourceName)
    .filter((v, i, arr) => arr.indexOf(v) === i); // 去重

  return {
    totalRelations: cells.length,
    involvedPairs,
    redCount,
    yellowCount,
    greenCount,
    redProjects,
    affectedSources,
  };
}

// ===== 导出 =====

export interface MatrixExportRow {
  项目名称: string;
  水源地名称: string;
  保护区级别: string;
  距离米: number;
  方位: string;
  是否在保护区内: string;
  边界距离米: number;
  风险等级: string;
  风险原因: string;
}

/**
 * 将关联单元格转为可导出的表格行
 */
export function toMatrixExportRows(cells: RelationCell[]): MatrixExportRow[] {
  return cells.map((c) => ({
    项目名称: c.projectName,
    水源地名称: c.sourceName,
    保护区级别: c.sourceZoneLevel,
    距离米: Math.round(c.distanceM),
    方位: c.bearingLabel,
    是否在保护区内: c.isInZone ? '是' : '否',
    边界距离米: Math.round(c.zoneEdgeDistanceM),
    风险等级: riskLevelText(c.risk),
    风险原因: c.riskReason,
  }));
}

export function riskLevelText(level: RiskLevel): string {
  const map: Record<RiskLevel, string> = { red: '红线', yellow: '黄线', green: '绿线' };
  return map[level];
}

/**
 * 生成矩阵汇总文本（用于报告）
 */
export function buildMatrixSummaryText(result: RelationMatrixResult): string {
  const s = result.summary;
  return [
    `共 ${s.totalRelations} 组项目-水源地关联，涉及 ${s.affectedSources.length} 个水源地。`,
    `其中红线关联 ${s.redCount} 组、黄线关联 ${s.yellowCount} 组、绿线关联 ${s.greenCount} 组。`,
    s.redProjects.length > 0
      ? `涉及红线风险的项目：${s.redProjects.join('、')}。`
      : '无红线风险项目。',
    `涉及保护区的项目-水源地对共 ${s.involvedPairs} 组，需开展地下水环境影响专项评价。`,
  ].join('\n');
}
