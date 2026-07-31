/**
 * S5: 多水源地保护区叠加计算引擎
 *
 * 功能：
 * 1. 从多个水源地的 ZoneCalcRecord 构建几何多边形
 * 2. 按级别执行 turf.union() 合并所有多边形
 * 3. 按 pair 执行 turf.intersect() 检测两两重叠
 * 4. 计算统计指标（叠加面积/重叠面积/重叠比例）
 *
 * 依赖：@turf/turf, zoneCoordGenerator
 */

import * as turf from '@turf/turf';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import { generateCircleVertices, generateRiverVertices, generateLakeVertices } from './zoneCoordGenerator';
import type { ZoneResult } from './zoneCalcEngine';
import type { WaterSourceRecord, ZoneCalcRecord } from '@/stores/waterSourceStore';

// ===== 类型定义 =====

export type ZoneLevel = '一级' | '二级' | '准保护区';

export interface OverlayRequest {
  sourceIds: string[];
  levels: ZoneLevel[];
  useClippedGeometry: boolean;
  analysisName: string;
}

export interface SourceGeometry {
  sourceId: string;
  sourceName: string;
  cityName: string;
  zones: {
    level: ZoneLevel;
    polygon: Feature<Polygon>;
    area: number;
  }[];
}

export interface OverlayLevelResult {
  level: ZoneLevel;
  unionArea: number;
  sumArea: number;
  overlapArea: number;
  overlapRatio: number;
  unionGeometry: GeoJSON.FeatureCollection;
  sourceGeometries: {
    sourceId: string;
    sourceName: string;
    area: number;
    geometry: GeoJSON.Feature;
  }[];
}

export interface PairwiseOverlap {
  sourceAId: string;
  sourceAName: string;
  sourceBId: string;
  sourceBName: string;
  level: ZoneLevel;
  overlapArea: number;
  overlapRatio: number;
  intersectionGeometry: GeoJSON.Feature | null;
}

export interface OverlaySummary {
  primaryUnionArea: number;
  secondaryUnionArea: number;
  tertiaryUnionArea: number;
  totalOverlapPairs: number;
  hasOverlapPairs: number;
  maxOverlapArea: number;
  cities: string[];
}

export interface OverlayResult {
  id: string;
  analysisName: string;
  createdAt: string;
  sourceCount: number;
  levels: OverlayLevelResult[];
  overlaps: PairwiseOverlap[];
  summary: OverlaySummary;
  warnings: string[];
}

// ===== 常量 =====

/** 微小重叠面积过滤阈值（km²），小于此值的重叠对被过滤 */
const OVERLAY_FILTER_THRESHOLD = 0.0001;

// ===== 核心函数 =====

/**
 * 从 ZoneResult 构建 Turf Polygon
 */
function buildPolygonFromZone(
  zone: ZoneResult,
  centerLng: number,
  centerLat: number,
): Feature<Polygon> | null {
  let vertices: Array<[number, number]> = [];

  if (zone.riverExt) {
    // 河流型保护区
    const verts = generateRiverVertices(
      centerLng, centerLat,
      zone.riverExt.upstreamLength,
      zone.riverExt.downstreamLength,
      zone.riverExt.bankWidth,
    );
    vertices = verts.map(v => [v.lng, v.lat]);
  } else if (zone.lakeExt) {
    // 湖库型保护区
    const verts = generateLakeVertices(
      centerLng, centerLat,
      zone.radius || 0,
      zone.lakeExt.intakeType,
    );
    vertices = verts.map(v => [v.lng, v.lat]);
  } else if (zone.radius && Number.isFinite(zone.radius) && zone.radius > 0) {
    // 圆形保护区（地下水）
    const verts = generateCircleVertices(centerLng, centerLat, zone.radius, 24);
    vertices = verts.map(v => [v.lng, v.lat]);
  } else if (zone.length && zone.width) {
    // 兼容旧版河流型矩形保护区
    const verts = generateRiverVertices(
      centerLng, centerLat,
      zone.length * 0.83,
      zone.length * 0.17,
      zone.width,
    );
    vertices = verts.map(v => [v.lng, v.lat]);
  } else {
    return null;
  }

  if (vertices.length < 3) return null;

  // 闭合 ring
  const ring = [...vertices, vertices[0]];
  try {
    return turf.polygon([ring]);
  } catch {
    return null;
  }
}

/**
 * 安全构建几何（带异常处理和有效性检查）
 */
function safeBuildGeometry(
  zone: ZoneResult,
  centerLng: number,
  centerLat: number,
): { polygon: Feature<Polygon> | null; warning?: string } {
  // 面积有效性检查
  if (!Number.isFinite(zone.area) || zone.area <= 0) {
    return { polygon: null, warning: `面积无效(${zone.area})` };
  }

  // 半径有效性检查（如果有 radius 字段）
  if (zone.radius !== undefined) {
    if (!Number.isFinite(zone.radius) || zone.radius <= 0) {
      return { polygon: null, warning: `半径异常(${zone.radius})` };
    }
  }

  const polygon = buildPolygonFromZone(zone, centerLng, centerLat);
  if (!polygon) {
    return { polygon: null, warning: '无法生成几何' };
  }

  return { polygon };
}

/**
 * 安全执行 turf.union
 */
function safeUnion(
  polygons: Feature<Polygon>[],
): { result: Feature<Polygon | MultiPolygon> | null; fallback: boolean } {
  if (polygons.length === 0) return { result: null, fallback: false };
  if (polygons.length === 1) return { result: polygons[0], fallback: false };

  try {
    let acc: Feature<Polygon | MultiPolygon> = polygons[0];
    for (let i = 1; i < polygons.length; i++) {
      const fc = {
        type: 'FeatureCollection' as const,
        features: [acc as unknown as GeoJSON.Feature, polygons[i] as unknown as GeoJSON.Feature],
      };
      const u = turf.union(fc as unknown as Parameters<typeof turf.union>[0]);
      if (u) acc = u as Feature<Polygon | MultiPolygon>;
    }
    return { result: acc, fallback: false };
  } catch {
    return { result: null, fallback: true };
  }
}

/**
 * 安全执行 turf.intersect
 */
function safeIntersect(
  polyA: Feature<Polygon>,
  polyB: Feature<Polygon>,
): Feature<Polygon | MultiPolygon> | null {
  try {
    const fc = {
      type: 'FeatureCollection' as const,
      features: [polyA as unknown as GeoJSON.Feature, polyB as unknown as GeoJSON.Feature],
    };
    return turf.intersect(fc as unknown as Parameters<typeof turf.intersect>[0]) as Feature<Polygon | MultiPolygon> | null;
  } catch {
    return null;
  }
}

/**
 * 为多个水源地构建几何
 */
export function buildSourceGeometries(
  sources: WaterSourceRecord[],
  zoneResults: ZoneCalcRecord[],
  levels: ZoneLevel[],
): { geometries: SourceGeometry[]; warnings: string[] } {
  const warnings: string[] = [];
  const geometries: SourceGeometry[] = [];

  // 去重 sourceIds
  const seenIds = new Set<string>();

  for (const source of sources) {
    // 坐标检查
    if (source.lng == null || source.lat == null) {
      warnings.push(`水源地${source.name}无坐标数据，已跳过`);
      continue;
    }

    // 去重检查
    if (seenIds.has(source.id)) {
      warnings.push(`检测到重复水源地${source.name}(${source.id})，已去重`);
      continue;
    }
    seenIds.add(source.id);

    // 查找对应的计算结果
    const record = zoneResults.find(r => r.sourceId === source.id);
    if (!record) {
      warnings.push(`水源地${source.name}无已保存的计算结果，已跳过`);
      continue;
    }

    // zones 为空检查
    if (!record.zones || record.zones.length === 0) {
      warnings.push(`水源地${source.name}无保护区级别数据，已跳过`);
      continue;
    }

    const zones: SourceGeometry['zones'] = [];

    for (const level of levels) {
      const zone = record.zones.find(z => z.level === level);
      if (!zone) {
        warnings.push(`水源地${source.name}无${level}保护区数据`);
        continue;
      }

      // level 不在枚举内
      if (!['一级', '二级', '准保护区'].includes(zone.level)) {
        continue;
      }

      const { polygon, warning } = safeBuildGeometry(zone, source.lng, source.lat);
      if (!polygon) {
        if (warning) warnings.push(`水源地${source.name}${level}保护区${warning}，已跳过`);
        continue;
      }

      // 半径偏大警告
      if (zone.radius && zone.radius >= 50000) {
        warnings.push(`水源地${source.name}${level}保护区半径异常偏大(${zone.radius}m)，请检查数据`);
      }

      // area 与 radius 不一致检查
      if (zone.radius && Number.isFinite(zone.area) && zone.area > 0) {
        const expectedArea = (Math.PI * zone.radius * zone.radius) / 1e6;
        if (Math.abs(zone.area - expectedArea) > 0.01) {
          warnings.push(
            `水源地${source.name}${level}保护区面积(${zone.area})与半径(${zone.radius}m)计算值(${expectedArea.toFixed(4)})不一致，以几何计算为准`,
          );
        }
      }

      const turfArea = turf.area(polygon) / 1e6;
      zones.push({
        level: zone.level as ZoneLevel,
        polygon,
        area: parseFloat(turfArea.toFixed(4)),
      });
    }

    if (zones.length > 0) {
      geometries.push({
        sourceId: source.id,
        sourceName: source.name,
        cityName: source.cityName,
        zones,
      });
    }
  }

  return { geometries, warnings };
}

/**
 * 两两重叠检测（N 个水源地 → C(N,2) 对）
 */
export function detectPairwiseOverlaps(
  geometries: SourceGeometry[],
  levels: ZoneLevel[],
): PairwiseOverlap[] {
  const overlaps: PairwiseOverlap[] = [];

  for (let i = 0; i < geometries.length; i++) {
    for (let j = i + 1; j < geometries.length; j++) {
      const ga = geometries[i];
      const gb = geometries[j];

      for (const level of levels) {
        const zoneA = ga.zones.find(z => z.level === level);
        const zoneB = gb.zones.find(z => z.level === level);
        if (!zoneA || !zoneB) continue;

        const intersect = safeIntersect(zoneA.polygon, zoneB.polygon);
        let overlapArea = 0;
        let intersectionGeometry: GeoJSON.Feature | null = null;

        if (intersect) {
          overlapArea = turf.area(intersect) / 1e6;
          if (overlapArea >= OVERLAY_FILTER_THRESHOLD) {
            intersectionGeometry = intersect as GeoJSON.Feature;
          } else {
            overlapArea = 0;
          }
        }

        if (overlapArea > 0) {
          const minArea = Math.min(zoneA.area, zoneB.area);
          const overlapRatio = minArea > 0 ? overlapArea / minArea : 0;

          overlaps.push({
            sourceAId: ga.sourceId,
            sourceAName: ga.sourceName,
            sourceBId: gb.sourceId,
            sourceBName: gb.sourceName,
            level,
            overlapArea: parseFloat(overlapArea.toFixed(4)),
            overlapRatio: parseFloat(overlapRatio.toFixed(4)),
            intersectionGeometry,
          });
        }
      }
    }
  }

  // 按面积降序排列
  overlaps.sort((a, b) => b.overlapArea - a.overlapArea);

  return overlaps;
}

/**
 * 叠加面积统计
 */
export function summarizeOverlay(
  levelResults: OverlayLevelResult[],
  overlaps: PairwiseOverlap[],
  geometries: SourceGeometry[],
): OverlaySummary {
  const findLevel = (level: ZoneLevel) =>
    levelResults.find(l => l.level === level);

  const primary = findLevel('一级');
  const secondary = findLevel('二级');
  const tertiary = findLevel('准保护区');

  const cities = [...new Set(geometries.map(g => g.cityName).filter(c => c))];

  const maxOverlapArea = overlaps.length > 0
    ? Math.max(...overlaps.map(o => o.overlapArea))
    : 0;

  return {
    primaryUnionArea: primary?.unionArea ?? 0,
    secondaryUnionArea: secondary?.unionArea ?? 0,
    tertiaryUnionArea: tertiary?.unionArea ?? 0,
    totalOverlapPairs: overlaps.length,
    hasOverlapPairs: overlaps.filter(o => o.overlapArea > 0).length,
    maxOverlapArea: parseFloat(maxOverlapArea.toFixed(4)),
    cities,
  };
}

/**
 * 执行多水源地保护区叠加分析（主入口）
 */
export function runOverlayAnalysis(
  sources: WaterSourceRecord[],
  zoneResults: ZoneCalcRecord[],
  request: OverlayRequest,
): OverlayResult {
  const warnings: string[] = [];

  // 输入校验
  if (!request.sourceIds || request.sourceIds.length === 0) {
    throw new Error('至少选择 2 个水源地进行叠加分析');
  }

  if (request.sourceIds.length === 1) {
    warnings.push('仅 1 个水源地，无叠加分析');
  }

  if (!request.levels || request.levels.length === 0) {
    return {
      id: `overlay-${Date.now()}`,
      analysisName: request.analysisName,
      createdAt: new Date().toISOString(),
      sourceCount: 0,
      levels: [],
      overlaps: [],
      summary: {
        primaryUnionArea: 0,
        secondaryUnionArea: 0,
        tertiaryUnionArea: 0,
        totalOverlapPairs: 0,
        hasOverlapPairs: 0,
        maxOverlapArea: 0,
        cities: [],
      },
      warnings: ['未选择任何保护区级别'],
    };
  }

  // 过滤选中的水源地
  const selectedSources = sources.filter(s => request.sourceIds.includes(s.id));

  // 构建几何
  const { geometries, warnings: buildWarnings } = buildSourceGeometries(
    selectedSources,
    zoneResults,
    request.levels,
  );
  warnings.push(...buildWarnings);

  if (geometries.length === 0) {
    return {
      id: `overlay-${Date.now()}`,
      analysisName: request.analysisName,
      createdAt: new Date().toISOString(),
      sourceCount: 0,
      levels: [],
      overlaps: [],
      summary: {
        primaryUnionArea: 0,
        secondaryUnionArea: 0,
        tertiaryUnionArea: 0,
        totalOverlapPairs: 0,
        hasOverlapPairs: 0,
        maxOverlapArea: 0,
        cities: [],
      },
      warnings: [...warnings, '所有水源地都被跳过，无有效数据'],
    };
  }

  // 按级别叠加
  const levelResults: OverlayLevelResult[] = [];

  for (const level of request.levels) {
    const levelPolygons: Feature<Polygon>[] = [];
    const sourceGeoms: OverlayLevelResult['sourceGeometries'] = [];

    for (const geom of geometries) {
      const zone = geom.zones.find(z => z.level === level);
      if (!zone) continue;
      levelPolygons.push(zone.polygon);
      sourceGeoms.push({
        sourceId: geom.sourceId,
        sourceName: geom.sourceName,
        area: zone.area,
        geometry: zone.polygon as GeoJSON.Feature,
      });
    }

    if (levelPolygons.length === 0) {
      levelResults.push({
        level,
        unionArea: 0,
        sumArea: 0,
        overlapArea: 0,
        overlapRatio: 0,
        unionGeometry: { type: 'FeatureCollection', features: [] },
        sourceGeometries: [],
      });
      continue;
    }

    // 计算 sumArea
    const sumArea = levelPolygons.reduce((sum, p) => sum + turf.area(p) / 1e6, 0);

    // 执行 union
    const { result: unionResult, fallback } = safeUnion(levelPolygons);

    let unionArea: number;
    let unionGeometry: GeoJSON.FeatureCollection;

    if (unionResult && !fallback) {
      unionArea = turf.area(unionResult) / 1e6;
      unionGeometry = {
        type: 'FeatureCollection',
        features: [unionResult as GeoJSON.Feature],
      };
    } else {
      // 回退为简单相加
      unionArea = sumArea;
      unionGeometry = {
        type: 'FeatureCollection',
        features: levelPolygons.map(p => p as GeoJSON.Feature),
      };
      warnings.push(`${level}保护区union计算失败，回退为简单相加`);
    }

    const overlapArea = sumArea - unionArea;
    const overlapRatio = sumArea > 0 ? overlapArea / sumArea : 0;

    levelResults.push({
      level,
      unionArea: parseFloat(unionArea.toFixed(4)),
      sumArea: parseFloat(sumArea.toFixed(4)),
      overlapArea: parseFloat(Math.max(0, overlapArea).toFixed(4)),
      overlapRatio: parseFloat(overlapRatio.toFixed(4)),
      unionGeometry,
      sourceGeometries: sourceGeoms,
    });
  }

  // 两两重叠检测
  const overlaps = detectPairwiseOverlaps(geometries, request.levels);

  // 统计汇总
  const summary = summarizeOverlay(levelResults, overlaps, geometries);

  return {
    id: `overlay-${Date.now()}`,
    analysisName: request.analysisName,
    createdAt: new Date().toISOString(),
    sourceCount: geometries.length,
    levels: levelResults,
    overlaps,
    summary,
    warnings,
  };
}
