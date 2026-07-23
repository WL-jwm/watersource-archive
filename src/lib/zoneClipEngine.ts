/**
 * P4-3: 保护区行政区划裁剪模块
 *
 * 功能：将计算的保护区（理论圆形/矩形）与行政区划边界求交集，
 * 输出实际管控面积（扣除超出行政区划的部分）。
 *
 * 依赖：@turf/turf（地理空间计算库）
 * 数据：hebeiAdminBoundaries.json（河北省11个地级市边界）
 */

import * as turf from '@turf/turf';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import type { SourceZoneVertices, ZoneVertex } from './zoneCoordGenerator';

// ===== 类型定义 =====

export interface ClipResult {
  /** 水源地名称 */
  sourceName: string;
  /** 水源地所在城市 */
  cityName: string;
  /** 保护区级别 */
  level: string;
  /** 原始理论面积（km²） */
  originalArea: number;
  /** 裁剪后实际面积（km²） */
  clippedArea: number;
  /** 裁剪比例（0~1） */
  clipRatio: number;
  /** 裁剪后GeoJSON坐标 */
  clippedCoordinates: number[][][];
  /** 是否被裁剪 */
  isClipped: boolean;
}

export interface SourceClipResult {
  sourceName: string;
  sourceId: string;
  cityName: string;
  zones: ClipResult[];
}

// ===== 核心算法 =====

/**
 * 将拐点坐标转为Turf Polygon
 */
function verticesToTurfPolygon(vertices: ZoneVertex[]): Feature<Polygon> {
  const ring = vertices.map((v) => [v.lng, v.lat]);
  // 闭合
  ring.push([vertices[0].lng, vertices[0].lat]);
  return turf.polygon([ring]);
}

/**
 * 加载河北省行政区划边界数据
 * 注意：使用动态import避免在非裁剪场景下加载73KB数据
 */
let adminBoundariesCache: Feature<MultiPolygon>[] | null = null;

export async function loadAdminBoundaries(): Promise<Feature<MultiPolygon>[]> {
  if (adminBoundariesCache) return adminBoundariesCache as Feature<MultiPolygon>[];

  const resp = await fetch('./data/hebeiAdminBoundaries.json');
  if (!resp.ok) {
    // fallback: 尝试从public目录加载
    const resp2 = await fetch('/data/hebeiAdminBoundaries.json');
    if (resp2.ok) return resp2.json();
    throw new Error('行政区划数据加载失败');
  }
  if (!resp.ok) throw new Error('行政区划数据加载失败');
  const geojson = await resp.json();

  adminBoundariesCache = (geojson.features as unknown[]).map((f: any) => {
    // 统一为MultiPolygon格式
    if (f.geometry.type === 'Polygon') {
      return turf.feature(turf.multiPolygon([f.geometry.coordinates]).geometry, f.properties);
    }
    return f;
  });

  return adminBoundariesCache;
}

/**
 * 根据城市名称查找对应的行政区划边界
 */
export function findCityBoundary(
  boundaries: Feature<MultiPolygon>[],
  cityName: string,
): Feature<MultiPolygon> | null {
  // 模糊匹配：去除"市"后缀
  const target = cityName.replace(/[市区县]$/, '');
  return (
    boundaries.find((b: Feature<MultiPolygon>) => {
      const name = ((b.properties as Record<string, unknown>)?.name as string) || '';
      return (
        name === cityName || name === `${cityName}市` || name.replace(/[市区县]$/, '') === target
      );
    }) || null
  );
}

/**
 * 根据经纬度判断所属城市（point-in-polygon）
 */
export function findCityByPoint(
  boundaries: Feature<MultiPolygon>[],
  lng: number,
  lat: number,
): string {
  const point = turf.point([lng, lat]);
  for (const boundary of boundaries) {
    if (turf.booleanPointInPolygon(point, boundary)) {
      return ((boundary.properties as Record<string, unknown>)?.name as string) || '未知';
    }
  }
  return '未知';
}

/**
 * 裁剪单个保护区
 * @param polygon 保护区的Turf Polygon
 * @param boundary 行政区划边界
 * @param originalArea 原始理论面积
 * @param level 保护区级别
 */
function clipZone(
  polygon: Feature<Polygon>,
  boundary: Feature<MultiPolygon>,
  originalArea: number,
  level: string,
): Omit<ClipResult, 'sourceName' | 'cityName'> {
  const polyGeom = polygon.geometry as Polygon;
  try {
    // 边界转为Polygon（如果MultiPolygon取最大面）
    let boundaryPoly: Feature<Polygon> | Feature<MultiPolygon>;
    if (boundary.geometry.type === 'MultiPolygon') {
      // 取面积最大的polygon
      const polys = boundary.geometry.coordinates;
      let maxArea = 0;
      let maxCoords = polys[0];
      for (const coords of polys) {
        const a = turf.area(turf.polygon(coords));
        if (a > maxArea) {
          maxArea = a;
          maxCoords = coords;
        }
      }
      boundaryPoly = turf.polygon(maxCoords);
    } else {
      boundaryPoly = turf.polygon(boundary.geometry.coordinates[0]);
    }

    // 求交集
    const intersection = turf.intersect(polygon as any, boundaryPoly as any);

    if (intersection) {
      // 统一为Polygon计算面积
      const clippedAreaSqm = turf.area(intersection);
      const clippedAreaKm2 = clippedAreaSqm / 1e6;

      // 提取坐标
      let clippedCoords: number[][][] = [];
      if (intersection.geometry.type === 'Polygon') {
        clippedCoords = [intersection.geometry.coordinates[0] as unknown as number[][]];
      } else if (intersection.geometry.type === 'MultiPolygon') {
        // 取最大面
        const coords = intersection.geometry.coordinates as unknown as number[][][];
        const maxPoly = coords.reduce((a: number[][], b: number[][]) =>
          turf.area(turf.polygon(b as any)) > turf.area(turf.polygon(a as any)) ? b : a,
        );
        clippedCoords = [maxPoly[0]] as unknown as number[][][];
      } else {
        clippedCoords = polyGeom.coordinates as unknown as number[][][];
      }

      const clipRatio = originalArea > 0 ? clippedAreaKm2 / originalArea : 1;

      return {
        originalArea,
        clippedArea: Math.round(clippedAreaKm2 * 10000) / 10000,
        clipRatio: Math.round(clipRatio * 10000) / 10000,
        clippedCoordinates: clippedCoords,
        level,
        isClipped: clipRatio < 0.99,
      };
    }

    // 无交集（理论上不应发生，因为水源地在该城市）
    return {
      originalArea,
      clippedArea: 0,
      clipRatio: 0,
      clippedCoordinates: polyGeom.coordinates as unknown as number[][][],
      level,
      isClipped: true,
    };
  } catch {
    // Turf.js intersect可能因拓扑错误失败，回退到原始面积
    return {
      originalArea,
      clippedArea: originalArea,
      clipRatio: 1,
      clippedCoordinates: polyGeom.coordinates as unknown as number[][][],
      level,
      isClipped: false,
    };
  }
}

/**
 * 裁剪单个水源地的所有保护区
 */
export function clipSourceZones(
  source: SourceZoneVertices,
  cityName: string,
  boundary: Feature<MultiPolygon>,
): SourceClipResult {
  const zones: ClipResult[] = source.zones.map((zone) => {
    if (zone.vertices.length < 3) {
      return {
        sourceName: source.sourceName,
        cityName,
        level: zone.level,
        originalArea: zone.area,
        clippedArea: zone.area,
        clipRatio: 1,
        clippedCoordinates: [],
        isClipped: false,
      };
    }

    const polygon = verticesToTurfPolygon(zone.vertices);
    const clipRes = clipZone(polygon, boundary, zone.area, zone.level);
    return {
      ...clipRes,
      sourceName: source.sourceName,
      cityName,
    };
  });

  return {
    sourceName: source.sourceName,
    sourceId: source.sourceId,
    cityName,
    zones,
  };
}

/**
 * 批量裁剪多个水源地
 */
export async function clipBatchZones(
  sources: SourceZoneVertices[],
  getCityName: (sourceName: string) => string,
): Promise<SourceClipResult[]> {
  const boundaries = await loadAdminBoundaries();
  const results: SourceClipResult[] = [];

  for (const source of sources) {
    const cityName = getCityName(source.sourceName);
    const boundary = findCityBoundary(boundaries, cityName);
    if (boundary) {
      results.push(clipSourceZones(source, cityName, boundary));
    } else {
      // 未找到对应城市边界，保留原始面积
      results.push({
        sourceName: source.sourceName,
        sourceId: source.sourceId,
        cityName,
        zones: source.zones.map((zone) => ({
          sourceName: source.sourceName,
          cityName,
          level: zone.level,
          originalArea: zone.area,
          clippedArea: zone.area,
          clipRatio: 1,
          clippedCoordinates: [],
          isClipped: false,
        })),
      });
    }
  }

  return results;
}

// ===== 统计函数 =====

/**
 * 统计裁剪结果的汇总信息
 */
export function summarizeClipResults(results: SourceClipResult[]): {
  totalSources: number;
  clippedSources: number;
  totalOriginalArea: number;
  totalClippedArea: number;
  totalReduction: number;
  reductionPct: number;
  byCity: Array<{ city: string; original: number; clipped: number; reduction: number }>;
} {
  let totalOriginal = 0;
  let totalClipped = 0;
  const cityMap: Record<string, { original: number; clipped: number }> = {};
  let clippedSources = 0;

  for (const r of results) {
    const sourceClipped = r.zones.some((z) => z.isClipped);
    if (sourceClipped) clippedSources++;

    for (const z of r.zones) {
      totalOriginal += z.originalArea;
      totalClipped += z.clippedArea;

      if (!cityMap[r.cityName]) cityMap[r.cityName] = { original: 0, clipped: 0 };
      cityMap[r.cityName].original += z.originalArea;
      cityMap[r.cityName].clipped += z.clippedArea;
    }
  }

  return {
    totalSources: results.length,
    clippedSources,
    totalOriginalArea: Math.round(totalOriginal * 100) / 100,
    totalClippedArea: Math.round(totalClipped * 100) / 100,
    totalReduction: Math.round((totalOriginal - totalClipped) * 100) / 100,
    reductionPct:
      totalOriginal > 0 ? Math.round((1 - totalClipped / totalOriginal) * 10000) / 100 : 0,
    byCity: Object.entries(cityMap).map(([city, data]) => ({
      city,
      original: Math.round(data.original * 100) / 100,
      clipped: Math.round(data.clipped * 100) / 100,
      reduction: Math.round((data.original - data.clipped) * 100) / 100,
    })),
  };
}
