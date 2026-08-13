/**
 * 实际保护区边界 避让分析引擎
 *
 * 基于真实保护区边界多边形（zone-boundaries / KMZ）做项目避让判断，
 * 区别于计算圈层的"圆形近似"——这里使用 turf 多边形几何精确判断项目点
 * 与保护区边界的包含/相交/距离关系，并叠加审计标记（已取消/已调整）。
 *
 * 设计：核心判断为纯函数（便于测试），数据加载独立封装。
 */

import * as turf from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import { auditZoneStatusWithRules, type ZoneAuditRule, type ZoneAuditStatus } from '@/data/zoneAuditMeta';
import type { ZoneBoundary } from '@/hooks/useActualZoneLayer';

/** 单个边界要素的避让检查结果 */
export interface BoundaryAvoidanceCheck {
  /** 保护区名称 */
  name: string;
  /** 所在城市 */
  city: string;
  /** 级别 */
  level: string;
  /** 审计状态 */
  auditStatus: ZoneAuditStatus | 'normal';
  /** 项目点是否在多边形内部 */
  isInside: boolean;
  /** 项目（含扩展半径）是否与多边形相交/涉及 */
  isInvolved: boolean;
  /** 项目点距多边形边界距离(m)：内部为负（深入距离），外部为正 */
  edgeDistanceM: number;
  /** 距边界绝对距离(m) */
  absDistanceM: number;
  /** 多边形面积(km²) */
  areaKm2: number | null;
}

/** 避让分析结果 */
export interface AvoidanceAnalysis {
  /** 输入的项目 */
  project: { name: string; lng: number; lat: number; bufferRadiusM: number };
  /** 全部检查（含未涉及） */
  checks: BoundaryAvoidanceCheck[];
  /** 涉及（需避让）的保护区 */
  involved: BoundaryAvoidanceCheck[];
  /** 距项目最近的保护区 */
  nearest: BoundaryAvoidanceCheck | null;
  /** 是否有涉及 */
  hasInvolved: boolean;
}

/** 项目避让判定阈值（m）：距边界小于该值视为"临近" */
export const NEAR_THRESHOLD_M = 100;

/** 闭合环：[lng,lat][] → turf Polygon */
function toPolygon(boundary: ZoneBoundary): Feature<Polygon> {
  const ring = [...boundary.ring.map(([lng, lat]) => [lng, lat] as [number, number])];
  // 确保闭合
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
  return turf.polygon([ring]);
}

/**
 * 判断单个项目点与单个保护区边界要素的避让关系（纯函数）。
 * @param boundary 边界要素
 * @param city 所在城市（用于审计规则匹配）
 * @param lng 项目经度
 * @param lat 项目纬度
 * @param bufferRadiusM 项目扩展半径（m），默认 0
 * @param auditRules 审计规则集
 */
export function checkPointAgainstBoundary(
  boundary: ZoneBoundary,
  city: string,
  lng: number,
  lat: number,
  bufferRadiusM = 0,
  auditRules: ZoneAuditRule[] = [],
): BoundaryAvoidanceCheck {
  const point = turf.point([lng, lat]);
  const poly = toPolygon(boundary);
  // pointToPolygonDistance：点在多边形内部为负值，外部为正（单位米）
  const dist = turf.pointToPolygonDistance(point, poly, { units: 'meters' });
  const isInside = turf.booleanPointInPolygon(point, poly);
  // 涉及：点在内，或点到边界的距离在项目扩展半径缓冲内
  const isInvolved = isInside || dist <= bufferRadiusM;
  let areaKm2: number | null = null;
  try {
    areaKm2 = Number((turf.area(poly) / 1e6).toFixed(3));
  } catch {
    areaKm2 = null;
  }
  const audit = auditZoneStatusWithRules(auditRules, city, boundary.name);
  return {
    name: boundary.name,
    city,
    level: boundary.level,
    auditStatus: audit ?? 'normal',
    isInside,
    isInvolved,
    edgeDistanceM: Math.round(dist),
    absDistanceM: Math.round(Math.abs(dist)),
    areaKm2,
  };
}

/** 全城边界数据（加载结果） */
export interface CityBoundaryBundle {
  city: string;
  boundaries: ZoneBoundary[];
}

const cache = new Map<string, ZoneBoundary[]>();

/** 加载指定城市边界（缓存，复用跨调用） */
export async function loadCityBoundaries(city: string): Promise<ZoneBoundary[]> {
  const hit = cache.get(city);
  if (hit) return hit;
  try {
    const res = await fetch(`/zone-boundaries/${encodeURIComponent(city)}.json`);
    if (!res.ok) return [];
    const data = (await res.json()) as ZoneBoundary[];
    cache.set(city, data);
    return data;
  } catch {
    return [];
  }
}

/** 全部城市列表（与数据文件一致） */
export const ALL_BOUNDARY_CITIES = [
  '石家庄市',
  '唐山市',
  '秦皇岛市',
  '邯郸市',
  '邢台市',
  '保定市',
  '张家口市',
  '承德市',
  '沧州市',
  '廊坊市',
  '衡水市',
  '辛集市',
  '定州市',
];

/**
 * 加载全部（或指定）城市的边界数据。
 * @param city 指定城市；传 'all' 或省略则加载全省
 */
export async function loadZoneBoundaries(city: string = 'all'): Promise<CityBoundaryBundle[]> {
  const cities = city === 'all' ? ALL_BOUNDARY_CITIES : [city];
  const bundles: CityBoundaryBundle[] = [];
  for (const c of cities) {
    const boundaries = await loadCityBoundaries(c);
    if (boundaries.length > 0) bundles.push({ city: c, boundaries });
  }
  return bundles;
}

/**
 * 对项目执行全量边界避让分析（数据加载 + 判断）。
 * @param projectName 项目名称
 * @param lng 经度
 * @param lat 纬度
 * @param bufferRadiusM 项目扩展半径(m)
 * @param auditRules 审计规则集
 * @param city 限定城市（'all' 全省）
 */
export async function runBoundaryAvoidance(
  projectName: string,
  lng: number,
  lat: number,
  bufferRadiusM = 0,
  auditRules: ZoneAuditRule[] = [],
  city: string = 'all',
): Promise<AvoidanceAnalysis> {
  const bundles = await loadZoneBoundaries(city);
  const checks: BoundaryAvoidanceCheck[] = [];
  for (const b of bundles) {
    for (const boundary of b.boundaries) {
      checks.push(checkPointAgainstBoundary(boundary, b.city, lng, lat, bufferRadiusM, auditRules));
    }
  }
  // 已取消保护区不参与避让判定（视为无效），但保留在检查列表中标注
  const effective = checks.filter((c) => c.auditStatus !== 'cancelled');
  const involved = effective
    .filter((c) => c.isInvolved)
    .sort((a, b) => a.absDistanceM - b.absDistanceM);
  // 最近保护区：按绝对距离升序取第一个有效项
  const nearest = [...effective].sort((a, b) => a.absDistanceM - b.absDistanceM)[0] ?? null;

  return {
    project: { name: projectName, lng, lat, bufferRadiusM },
    checks,
    involved,
    nearest,
    hasInvolved: involved.length > 0,
  };
}
