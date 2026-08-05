/* ===== S12.1: 空间邻近检索引擎 =====
 * 给定任意坐标 → 检索最近水源地、周边 N km 内水源地清单、
 * 所属/最近保护区、距离 + 方位角（bearing）
 * 用于环评项目选址的快速空间判断
 */

import { haversineDistance } from './spatialAnalysis';

// ===== 类型定义 =====

export interface ProximitySource {
  id: string;
  name: string;
  cityName: string;
  /** 水源地中心经度 */
  lng: number;
  /** 水源地中心纬度 */
  lat: number;
  /** 保护区级别 */
  level: string;
  /** 保护区半径（米） */
  zoneRadiusM: number;
  /** 水源类型 */
  type?: string;
}

export interface ProximityResult {
  id: string;
  name: string;
  cityName: string;
  level: string;
  /** 查询点到水源地中心的距离（米） */
  distanceM: number;
  /** 查询点到水源地中心的方位角（度，0=北，90=东，逆时针到360） */
  bearingDeg: number;
  /** 查询点到保护区边界的最短距离（米），负值=查询点在保护区内 */
  zoneEdgeDistanceM: number;
  /** 查询点是否位于保护区内 */
  isInsideZone: boolean;
  /** 方位中文描述（如 正北/东北偏北/东北…） */
  bearingLabel: string;
}

export interface SpatialProximityResponse {
  /** 查询点坐标 */
  query: { lng: number; lat: number };
  /** 最近的水源地 */
  nearest: ProximityResult | null;
  /** 最近保护区的边界距离（米，负=在保护区内） */
  nearestZoneEdgeDistanceM: number | null;
  /** 位于任何保护区内的标记 */
  insideAnyZone: boolean;
  /** 指定半径内的水源地清单（按距离升序） */
  withinRadius: ProximityResult[];
}

// ===== 方位角 =====

/**
 * 计算从 (lat1,lng1) 到 (lat2,lng2) 的初始方位角（度）
 * 0 = 正北，90 = 正东，180 = 正南，270 = 正西
 */
export function bearingDegrees(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const dLng = toRad(lng2 - lng1);

  const y = Math.sin(dLng) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dLng);

  const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360;
  return bearing;
}

/**
 * 方位角转中文描述（16 方位）
 */
export function bearingLabel(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360;
  const dirs = [
    '正北', '东北偏北', '东北', '东北偏东',
    '正东', '东南偏东', '东南', '东南偏南',
    '正南', '西南偏南', '西南', '西南偏西',
    '正西', '西北偏西', '西北', '西北偏北',
  ];
  const idx = Math.round(normalized / 22.5) % 16;
  return dirs[idx];
}

// ===== 核心检索 =====

export interface ProximityQueryOptions {
  /** 周边检索半径（米），默认 10000 */
  searchRadiusM?: number;
}

/**
 * 执行空间邻近检索
 * @param lng 查询点经度
 * @param lat 查询点纬度
 * @param sources 水源地列表
 */
export function querySpatialProximity(
  lng: number,
  lat: number,
  sources: ProximitySource[],
  options: ProximityQueryOptions = {},
): SpatialProximityResponse {
  const searchRadiusM = options.searchRadiusM ?? 10000;

  const results: ProximityResult[] = sources.map((s) => {
    const distanceM = haversineDistance(lat, lng, s.lat, s.lng);
    const bearing = bearingDegrees(lat, lng, s.lat, s.lng);
    const zoneEdgeDistanceM = distanceM - s.zoneRadiusM;

    return {
      id: s.id,
      name: s.name,
      cityName: s.cityName,
      level: s.level,
      distanceM,
      bearingDeg: bearing,
      zoneEdgeDistanceM,
      isInsideZone: zoneEdgeDistanceM <= 0,
      bearingLabel: bearingLabel(bearing),
    };
  });

  // 按距离升序排序
  results.sort((a, b) => a.distanceM - b.distanceM);

  const nearest = results.length > 0 ? results[0] : null;
  const insideAnyZone = results.some((r) => r.isInsideZone);

  let nearestZoneEdgeDistanceM: number | null = null;
  if (results.length > 0) {
    // 最近保护区边界距离 = 各水源地保护区边界距离的最小值
    nearestZoneEdgeDistanceM = Math.min(...results.map((r) => r.zoneEdgeDistanceM));
  }

  const withinRadius = results.filter((r) => r.distanceM <= searchRadiusM);

  return {
    query: { lng, lat },
    nearest,
    nearestZoneEdgeDistanceM,
    insideAnyZone,
    withinRadius,
  };
}

// ===== 便捷函数 =====

/**
 * 判断点是否位于任一水源地保护区内
 */
export function isInAnyProtectionZone(
  lng: number,
  lat: number,
  sources: ProximitySource[],
): boolean {
  return querySpatialProximity(lng, lat, sources).insideAnyZone;
}

/**
 * 获取最近水源地（不含保护区边界逻辑，仅距离）
 */
export function findNearestSource(
  lng: number,
  lat: number,
  sources: ProximitySource[],
): ProximityResult | null {
  return querySpatialProximity(lng, lat, sources).nearest;
}

/**
 * 检索指定半径内的水源地
 */
export function findSourcesWithin(
  lng: number,
  lat: number,
  sources: ProximitySource[],
  radiusM: number,
): ProximityResult[] {
  return querySpatialProximity(lng, lat, sources, { searchRadiusM: radiusM }).withinRadius;
}

/**
 * 从 WaterSourceRecord 构造 ProximitySource（含默认保护区半径）
 */
export function toProximitySources(
  sources: Array<{
    id: string; name: string; cityName: string; lng?: number; lat?: number;
    level?: string; type?: string;
  }>,
  defaultRadiusM = 500,
): ProximitySource[] {
  return sources
    .filter((s) => s.lng !== undefined && s.lat !== undefined)
    .map((s) => ({
      id: s.id,
      name: s.name,
      cityName: s.cityName,
      lng: s.lng as number,
      lat: s.lat as number,
      level: s.level || 'municipal',
      zoneRadiusM: defaultRadiusM,
      type: s.type,
    }));
}
