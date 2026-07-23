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
