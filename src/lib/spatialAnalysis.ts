/**
 * 空间分析工具
 *
 * 功能：
 * 1. Haversine公式计算两点间距离（米）
 * 2. 判断点是否在保护区范围内（点到圆心距离 vs 保护区半径）
 * 3. 批量检查建设项目与所有保护区的关系
 * 4. 计算项目到最近保护区边界的距离
 */

import type { ZoneCalcRecord } from '@/stores/waterSourceStore';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';

// ===== 数据类型 =====

export interface ProjectInput {
  /** 项目名称 */
  name: string;
  /** 项目中心经度 */
  lng: number;
  /** 项目中心纬度 */
  lat: number;
  /** 项目占地半径（米），点状项目可设为0 */
  radiusM: number;
}

export interface ZoneCheckResult {
  /** 水源地名称 */
  sourceName: string;
  /** 水源地ID */
  sourceId: string;
  /** 城市名 */
  cityName: string;
  /** 保护区级别 */
  level: string;
  /** 保护区半径(m) */
  zoneRadiusM: number;
  /** 保护区面积(km²) */
  zoneAreaKm2: number;
  /** 水源地中心经度 */
  sourceLng: number;
  /** 水源地中心纬度 */
  sourceLat: number;
  /** 项目中心到水源地中心的距离(m) */
  centerDistanceM: number;
  /** 项目边界到保护区边界的最短距离(m)，负值=项目在保护区内 */
  edgeDistanceM: number;
  /** 项目是否涉及该保护区 */
  isInvolved: boolean;
  /** 项目中心是否在保护区内 */
  isCenterInside: boolean;
}

export interface AnalysisResult {
  /** 是否涉及任一保护区 */
  hasInvolved: boolean;
  /** 涉及的保护区的检查结果列表 */
  involvedZones: ZoneCheckResult[];
  /** 最近的保护区结果（不论是否涉及） */
  nearestZone: ZoneCheckResult | null;
  /** 最近保护区边界的距离(m) */
  nearestEdgeDistanceM: number;
}

// ===== Haversine距离 =====

const EARTH_RADIUS_M = 6371000;

/**
 * Haversine公式计算两点间距离
 * @returns 距离（米）
 */
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

// ===== 空间判断 =====

/**
 * 检查单个项目与所有保护区的关系
 */
export function checkProjectAgainstZones(
  project: ProjectInput,
  zoneResults: ZoneCalcRecord[],
  sources: WaterSourceRecord[],
): AnalysisResult {
  // 建立 sourceId → 水源地信息 映射
  const sourceMap = new Map<string, WaterSourceRecord>();
  for (const s of sources) {
    sourceMap.set(s.id, s);
  }
  const sourceNameMap = new Map<string, WaterSourceRecord>();
  for (const s of sources) {
    if (!sourceNameMap.has(s.name)) sourceNameMap.set(s.name, s);
  }

  const allChecks: ZoneCheckResult[] = [];

  for (const zr of zoneResults) {
    const src = sourceMap.get(zr.sourceId) || sourceNameMap.get(zr.sourceName);
    if (!src || src.lng == null || src.lat == null) continue;

    for (const zone of zr.zones) {
      if (!zone.radius) continue; // 仅处理有半径的保护区

      const centerDist = haversineDistance(project.lat, project.lng, src.lat, src.lng);
      const edgeDist = centerDist - zone.radius - project.radiusM;
      const isCenterInside = centerDist < zone.radius;
      const isInvolved = edgeDist < 0;

      allChecks.push({
        sourceName: zr.sourceName,
        sourceId: zr.sourceId,
        cityName: src.cityName,
        level: zone.level,
        zoneRadiusM: zone.radius,
        zoneAreaKm2: zone.area,
        sourceLng: src.lng,
        sourceLat: src.lat,
        centerDistanceM: Math.round(centerDist),
        edgeDistanceM: Math.round(edgeDist),
        isInvolved,
        isCenterInside,
      });
    }
  }

  // 按距离排序
  allChecks.sort((a, b) => b.edgeDistanceM - a.edgeDistanceM); // 涉及的排前面（负值）

  const involvedZones = allChecks.filter((z) => z.isInvolved);
  const nearestZone = allChecks.length > 0 ? allChecks[0] : null;
  const nearestEdgeDistanceM = nearestZone ? nearestZone.edgeDistanceM : Infinity;

  return {
    hasInvolved: involvedZones.length > 0,
    involvedZones,
    nearestZone,
    nearestEdgeDistanceM,
  };
}

// ===== B2: 批量项目环评分析 =====

/** 项目类型 */
export type ProjectType = 'point' | 'linear' | 'area';

/** 批量项目输入 */
export interface BatchProjectInput {
  /** 项目名称 */
  name: string;
  /** 项目类型 */
  type: ProjectType;
  /** 坐标点列表（点状1个，线型≥2个，面型≥3个） */
  points: Array<{ lng: number; lat: number }>;
  /** 点状项目的占地半径 m */
  radiusM?: number;
}

/** 批量分析单项结果 */
export interface BatchProjectResult {
  /** 项目名称 */
  projectName: string;
  /** 项目类型 */
  projectType: ProjectType;
  /** 是否涉及任一保护区 */
  hasInvolved: boolean;
  /** 涉及级别（最高） */
  highestLevel: '不涉及' | '准保护区' | '二级' | '一级';
  /** 涉及的保护区列表 */
  involvedZones: ZoneCheckResult[];
  /** 最近保护区距离 m */
  nearestDistanceM: number;
  /** 环评结论 */
  conclusion: string;
  /** 法规依据 */
  legalBasis: string;
}

/** 批量分析汇总结果 */
export interface BatchAnalysisResult {
  /** 总项目数 */
  totalProjects: number;
  /** 涉及项目数 */
  involvedCount: number;
  /** 不涉及项目数 */
  notInvolvedCount: number;
  /** 涉及一级保护区的项目数 */
  primaryInvolvedCount: number;
  /** 涉及二级保护区的项目数 */
  secondaryInvolvedCount: number;
  /** 逐项目结果 */
  results: BatchProjectResult[];
  /** 涉及清单汇总表 */
  summaryTable: Array<{
    projectName: string;
    projectType: string;
    highestLevel: string;
    involvedSources: string;
    nearestDistance: string;
    conclusion: string;
  }>;
}

/**
 * 分析线型工程与保护区的关系
 * 线型工程：逐段（相邻两点）检查是否穿越保护区
 */
function analyzeLinearProject(
  points: Array<{ lng: number; lat: number }>,
  zoneResults: ZoneCalcRecord[],
  sources: WaterSourceRecord[],
): { involved: ZoneCheckResult[]; nearestDist: number } {
  const involved: ZoneCheckResult[] = [];
  let nearestDist = Infinity;

  // 逐段检查
  for (let i = 0; i < points.length - 1; i++) {
    const segStart = points[i];
    const segEnd = points[i + 1];

    // 沿线段采样（每100m一个点）
    const segLen = haversineDistance(segStart.lat, segStart.lng, segEnd.lat, segEnd.lng);
    const sampleCount = Math.max(2, Math.ceil(segLen / 100));

    for (let s = 0; s <= sampleCount; s++) {
      const t = s / sampleCount;
      const sampleLng = segStart.lng + (segEnd.lng - segStart.lng) * t;
      const sampleLat = segStart.lat + (segEnd.lat - segStart.lat) * t;

      // 检查该采样点与所有保护区的关系
      const pointResult = checkProjectAgainstZones(
        { name: 'segment', lng: sampleLng, lat: sampleLat, radiusM: 0 },
        zoneResults,
        sources,
      );

      if (pointResult.nearestEdgeDistanceM < nearestDist) {
        nearestDist = pointResult.nearestEdgeDistanceM;
      }

      for (const iz of pointResult.involvedZones) {
        // 去重（同一水源地同一级别只记一次）
        const exists = involved.find((v) => v.sourceId === iz.sourceId && v.level === iz.level);
        if (!exists) {
          involved.push(iz);
        }
      }
    }
  }

  return { involved, nearestDist };
}

/**
 * 分析面型工程与保护区的关系
 * 面型工程：检查多边形顶点+中心点是否在保护区内
 */
function analyzeAreaProject(
  points: Array<{ lng: number; lat: number }>,
  zoneResults: ZoneCalcRecord[],
  sources: WaterSourceRecord[],
): { involved: ZoneCheckResult[]; nearestDist: number } {
  const involved: ZoneCheckResult[] = [];
  let nearestDist = Infinity;

  // 检查所有顶点
  for (const pt of points) {
    const pointResult = checkProjectAgainstZones(
      { name: 'vertex', lng: pt.lng, lat: pt.lat, radiusM: 0 },
      zoneResults,
      sources,
    );

    if (pointResult.nearestEdgeDistanceM < nearestDist) {
      nearestDist = pointResult.nearestEdgeDistanceM;
    }

    for (const iz of pointResult.involvedZones) {
      const exists = involved.find((v) => v.sourceId === iz.sourceId && v.level === iz.level);
      if (!exists) {
        involved.push(iz);
      }
    }
  }

  // 检查质心
  const centerLng = points.reduce((s, p) => s + p.lng, 0) / points.length;
  const centerLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const centerResult = checkProjectAgainstZones(
    { name: 'center', lng: centerLng, lat: centerLat, radiusM: 0 },
    zoneResults,
    sources,
  );

  if (centerResult.nearestEdgeDistanceM < nearestDist) {
    nearestDist = centerResult.nearestEdgeDistanceM;
  }

  for (const iz of centerResult.involvedZones) {
    const exists = involved.find((v) => v.sourceId === iz.sourceId && v.level === iz.level);
    if (!exists) {
      involved.push(iz);
    }
  }

  return { involved, nearestDist };
}

/**
 * 生成环评结论和法规依据
 */
function generateEIAConclusion(
  hasInvolved: boolean,
  highestLevel: string,
  involvedSources: string[],
): { conclusion: string; legalBasis: string } {
  if (!hasInvolved) {
    return {
      conclusion: '不涉及饮用水水源保护区',
      legalBasis: '项目选址不在已划定的饮用水水源保护区范围内，符合《水污染防治法》相关规定。',
    };
  }

  if (highestLevel === '一级') {
    return {
      conclusion: '涉及一级保护区，禁止新建、改建、扩建与供水设施和保护水源无关的建设项目',
      legalBasis:
        '《中华人民共和国水污染防治法》第八十一条：禁止在饮用水水源一级保护区内新建、改建、扩建与供水设施和保护水源无关的建设项目。',
    };
  }

  if (highestLevel === '二级') {
    return {
      conclusion: '涉及二级保护区，不得新建、改建、扩建排放污染物的建设项目',
      legalBasis:
        '《中华人民共和国水污染防治法》第八十一条：在饮用水水源二级保护区内，禁止新建、改建、扩建排放污染物的建设项目；已建成的排放污染物的建设项目，由县级以上人民政府责令拆除或者关闭。',
    };
  }

  if (highestLevel === '准保护区') {
    return {
      conclusion: '涉及准保护区，应采取措施防止污染饮用水水体',
      legalBasis:
        '《中华人民共和国水污染防治法》第八十一条：禁止在饮用水水源准保护区内新建、扩建对水体污染严重的建设项目；改建建设项目，不得增加排污量。',
    };
  }

  return {
    conclusion: '待评估',
    legalBasis: '',
  };
}

/**
 * 批量项目环评分析
 */
export function analyzeBatchProjects(
  projects: BatchProjectInput[],
  zoneResults: ZoneCalcRecord[],
  sources: WaterSourceRecord[],
): BatchAnalysisResult {
  const results: BatchProjectResult[] = projects.map((project) => {
    let involved: ZoneCheckResult[] = [];
    let nearestDist = Infinity;

    if (project.type === 'point' && project.points.length > 0) {
      const pt = project.points[0];
      const r = checkProjectAgainstZones(
        { name: project.name, lng: pt.lng, lat: pt.lat, radiusM: project.radiusM || 0 },
        zoneResults,
        sources,
      );
      involved = r.involvedZones;
      nearestDist = r.nearestEdgeDistanceM;
    } else if (project.type === 'linear' && project.points.length >= 2) {
      const r = analyzeLinearProject(project.points, zoneResults, sources);
      involved = r.involved;
      nearestDist = r.nearestDist;
    } else if (project.type === 'area' && project.points.length >= 3) {
      const r = analyzeAreaProject(project.points, zoneResults, sources);
      involved = r.involved;
      nearestDist = r.nearestDist;
    }

    // 确定最高涉及级别
    let highestLevel: '不涉及' | '准保护区' | '二级' | '一级' = '不涉及';
    if (involved.some((z) => z.level === '一级')) {
      highestLevel = '一级';
    } else if (involved.some((z) => z.level === '二级')) {
      highestLevel = '二级';
    } else if (involved.some((z) => z.level === '准保护区')) {
      highestLevel = '准保护区';
    }

    const involvedSourceNames = [...new Set(involved.map((z) => z.sourceName))];
    const { conclusion, legalBasis } = generateEIAConclusion(
      involved.length > 0,
      highestLevel,
      involvedSourceNames,
    );

    return {
      projectName: project.name,
      projectType: project.type,
      hasInvolved: involved.length > 0,
      highestLevel,
      involvedZones: involved,
      nearestDistanceM: Math.round(nearestDist),
      conclusion,
      legalBasis,
    };
  });

  // 统计
  const involvedCount = results.filter((r) => r.hasInvolved).length;
  const primaryInvolvedCount = results.filter((r) => r.highestLevel === '一级').length;
  const secondaryInvolvedCount = results.filter((r) => r.highestLevel === '二级').length;

  // 汇总表
  const typeLabels: Record<ProjectType, string> = {
    point: '点状',
    linear: '线型',
    area: '面型',
  };

  const summaryTable = results.map((r) => ({
    projectName: r.projectName,
    projectType: typeLabels[r.projectType],
    highestLevel: r.highestLevel,
    involvedSources:
      r.involvedZones.length > 0
        ? [...new Set(r.involvedZones.map((z) => z.sourceName))].join('、')
        : '—',
    nearestDistance: r.nearestDistanceM === Infinity ? '—' : `${r.nearestDistanceM}m`,
    conclusion: r.conclusion,
  }));

  return {
    totalProjects: projects.length,
    involvedCount,
    notInvolvedCount: projects.length - involvedCount,
    primaryInvolvedCount,
    secondaryInvolvedCount,
    results,
    summaryTable,
  };
}
