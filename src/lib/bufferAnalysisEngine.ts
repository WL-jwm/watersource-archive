/**
 * P4-6: 保护区边界缓冲分析
 *
 * 功能：分析已划定的保护区边界与潜在敏感目标之间的距离关系。
 * 敏感目标类型：学校、医院、居民区、工业企业、污水处理厂等
 *
 * 实现方式：
 * 1. 在地图上提供敏感目标标注功能（手动添加）
 * 2. 计算每个敏感目标到最近保护区边界的距离
 * 3. 根据距离进行分级预警（0-500m高危 / 500-1000m关注 / >1000m安全）
 */

import type { SourceZoneVertices, ZoneVertex } from './zoneCoordGenerator';

// ===== 类型定义 =====

export interface SensitiveTarget {
  /** 唯一ID */
  id: string;
  /** 目标名称 */
  name: string;
  /** 类型 */
  type: '学校' | '医院' | '居民区' | '工业企业' | '污水处理厂' | '垃圾填埋场' | '加油站' | '其他';
  /** 经度 */
  lng: number;
  /** 纬度 */
  lat: number;
  /** 备注 */
  remark?: string;
}

export interface BufferAnalysisResult {
  target: SensitiveTarget;
  /** 到最近保护区边界的距离（米） */
  distanceToBoundary: number;
  /** 距离最近的保护区名称 */
  nearestZone: string;
  /** 最近的保护区级别 */
  nearestZoneLevel: string;
  /** 预警等级 */
  alertLevel: '高危' | '关注' | '安全';
  /** 是否在保护区内 */
  insideZone: boolean;
}

export interface BufferAnalysisSummary {
  results: BufferAnalysisResult[];
  /** 高危数量 */
  highRiskCount: number;
  /** 关注数量 */
  watchCount: number;
  /** 安全数量 */
  safeCount: number;
  /** 区内数量 */
  insideCount: number;
}

// ===== 距离计算 =====

/** Haversine公式计算两点间距离（米） */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // 地球半径（米）
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * 计算点到圆形保护区边界距离
 * 正值=在保护区外，负值=在保护区内
 */
function distanceToCircleZone(
  targetLng: number,
  targetLat: number,
  centerLng: number,
  centerLat: number,
  radiusM: number,
): number {
  const distToCenter = haversineDistance(targetLat, targetLng, centerLat, centerLng);
  return distToCenter - radiusM;
}

/**
 * 计算点到多边形边界最短距离
 * 正值=在保护区外，负值=在保护区内
 */
function distanceToPolygonZone(
  targetLng: number,
  targetLat: number,
  vertices: ZoneVertex[],
  centerLng: number,
  centerLat: number,
): number {
  if (vertices.length < 3) return 0;

  // 点到多边形每条边的最短距离
  let minDist = Infinity;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    const dist = distanceToSegment(
      targetLng,
      targetLat,
      vertices[i].lng,
      vertices[i].lat,
      vertices[j].lng,
      vertices[j].lat,
    );
    minDist = Math.min(minDist, dist);
  }

  // 判断是否在多边形内（射线法）
  const inside = pointInPolygon(targetLng, targetLat, vertices);
  return inside ? -minDist : minDist;
}

/** 点到线段最短距离 */
function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  // 将经纬度近似为平面坐标计算
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return haversineDistance(py, px, ay, ax);

  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projLng = ax + t * dx;
  const projLat = ay + t * dy;
  return haversineDistance(py, px, projLat, projLng);
}

/** 射线法判断点是否在多边形内 */
function pointInPolygon(lng: number, lat: number, vertices: ZoneVertex[]): boolean {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].lng,
      yi = vertices[i].lat;
    const xj = vertices[j].lng,
      yj = vertices[j].lat;
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// ===== 分析函数 =====

/**
 * 对单个敏感目标进行缓冲分析
 */
function analyzeTarget(
  target: SensitiveTarget,
  sources: SourceZoneVertices[],
): BufferAnalysisResult {
  let minDistance = Infinity;
  let nearestZone = '无';
  let nearestZoneLevel = '-';

  for (const source of sources) {
    for (const zone of source.zones) {
      let dist: number;

      if (zone.radius) {
        // 圆形保护区
        dist = distanceToCircleZone(
          target.lng,
          target.lat,
          source.centerLng,
          source.centerLat,
          zone.radius,
        );
      } else if (zone.vertices.length >= 3) {
        // 多边形保护区
        dist = distanceToPolygonZone(
          target.lng,
          target.lat,
          zone.vertices,
          source.centerLng,
          source.centerLat,
        );
      } else {
        continue;
      }

      const absDist = Math.abs(dist);
      if (absDist < Math.abs(minDistance)) {
        minDistance = dist; // 保留正负号用于判断内部/外部
        nearestZone = source.sourceName;
        nearestZoneLevel = zone.level;
      }
    }
  }

  if (minDistance === Infinity) {
    return {
      target,
      distanceToBoundary: -1,
      nearestZone: '无保护区',
      nearestZoneLevel: '-',
      alertLevel: '安全',
      insideZone: false,
    };
  }

  const insideZone = minDistance < 0; // 负距离表示在内部
  const absDistance = Math.abs(minDistance);

  let alertLevel: '高危' | '关注' | '安全';
  if (insideZone) {
    alertLevel = '高危';
  } else if (absDistance < 500) {
    alertLevel = '高危';
  } else if (absDistance < 1000) {
    alertLevel = '关注';
  } else {
    alertLevel = '安全';
  }

  return {
    target,
    distanceToBoundary: Math.round(absDistance),
    nearestZone,
    nearestZoneLevel,
    alertLevel,
    insideZone,
  };
}

/**
 * 批量缓冲分析
 */
export function analyzeBuffer(
  targets: SensitiveTarget[],
  sources: SourceZoneVertices[],
): BufferAnalysisSummary {
  const results = targets.map((t) => analyzeTarget(t, sources));

  return {
    results,
    highRiskCount: results.filter((r) => r.alertLevel === '高危').length,
    watchCount: results.filter((r) => r.alertLevel === '关注').length,
    safeCount: results.filter((r) => r.alertLevel === '安全').length,
    insideCount: results.filter((r) => r.insideZone).length,
  };
}

/**
 * 预设敏感目标模板
 */
export const SENSITIVE_TARGET_TEMPLATES: Array<{
  type: SensitiveTarget['type'];
  examples: string[];
}> = [
  { type: '学校', examples: ['XX小学', 'XX中学', 'XX幼儿园'] },
  { type: '医院', examples: ['XX医院', 'XX卫生院', 'XX诊所'] },
  { type: '居民区', examples: ['XX小区', 'XX村', 'XX社区'] },
  { type: '工业企业', examples: ['XX工厂', 'XX化工', 'XX制造'] },
  { type: '污水处理厂', examples: ['XX污水处理厂'] },
  { type: '垃圾填埋场', examples: ['XX垃圾填埋场'] },
  { type: '加油站', examples: ['XX加油站'] },
];
