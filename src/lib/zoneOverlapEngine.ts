/* ===== S12.2: 保护区占用精算引擎 =====
 * 真实多边形几何与保护区面的精确重叠计算：
 * 重叠面积 / 占用比例 / 线性项目穿越长度
 * 采用局部等距圆柱投影将经纬度转为米级平面坐标，再求多边形交集
 */

// ===== 类型定义 =====

export interface GeoPoint {
  lng: number;
  lat: number;
}

/** 局部平面坐标（米） */
interface LocalPoint {
  x: number;
  y: number;
}

export type ProjectGeometry =
  | { type: 'point'; lng: number; lat: number }
  | { type: 'circle'; lng: number; lat: number; radiusM: number }
  | { type: 'polygon'; vertices: GeoPoint[] }
  | { type: 'line'; vertices: GeoPoint[] };

export interface ZoneOverlapResult {
  /** 项目是否与保护区发生重叠 */
  isOverlap: boolean;
  /** 重叠面积（平方米） */
  overlapAreaM2: number;
  /** 重叠面积（平方千米） */
  overlapAreaKm2: number;
  /** 项目面积（平方米，点/线项目为 0） */
  projectAreaM2: number;
  /** 保护区面积（平方米） */
  zoneAreaM2: number;
  /** 重叠面积 / 项目面积 比例 */
  overlapRatioOfProject: number;
  /** 重叠面积 / 保护区面积 比例 */
  overlapRatioOfZone: number;
  /** 线性项目在保护区内穿越长度（米） */
  lineCrossLengthM: number;
  /** 项目是否完全位于保护区内 */
  fullyInsideZone: boolean;
}

// ===== 局部投影 =====

/**
 * 局部等距圆柱投影：以参考点为中心的近似平面坐标（米）
 * 适用于小范围（<100km）精度足够
 */
function toLocalPoint(p: GeoPoint, refLat: number): LocalPoint {
  const latRad = (refLat * Math.PI) / 180;
  const x = p.lng * 111320 * Math.cos(latRad);
  const y = p.lat * 110540;
  return { x, y };
}

function toLocalPolygon(vertices: GeoPoint[], refLat: number): LocalPoint[] {
  return vertices.map((v) => toLocalPoint(v, refLat));
}

// ===== 平面几何基础 =====

/**
 * 鞋带公式计算多边形面积（平方米），顶点按顺序（闭合）
 */
export function shoeLaceArea(vertices: LocalPoint[]): number {
  const n = vertices.length;
  if (n < 3) return 0;

  let sum = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    sum += vertices[i].x * vertices[j].y;
    sum -= vertices[j].x * vertices[i].y;
  }
  return Math.abs(sum) / 2;
}

/**
 * 判断点是否在多边形内（射线法）
 */
export function pointInPolygon(p: LocalPoint, polygon: LocalPoint[]): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > p.y) !== (yj > p.y)) &&
      (p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * 计算两线段交点（若平行或不相交返回 null）
 */
function segmentIntersection(
  p1: LocalPoint, p2: LocalPoint,
  p3: LocalPoint, p4: LocalPoint,
): LocalPoint | null {
  const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  const denom = d1x * d2y - d1y * d2x;

  if (Math.abs(denom) < 1e-12) return null; // 平行

  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return { x: p1.x + t * d1x, y: p1.y + t * d1y };
  }
  return null;
}

/**
 * 计算线段长度
 */
function segmentLength(p1: LocalPoint, p2: LocalPoint): number {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

// ===== Sutherland-Hodgman 多边形裁剪 =====

/**
 * 用凸裁剪多边形（clip）裁剪被裁剪多边形（subject）
 * 返回交集多边形顶点（可能为空）
 */
function clipPolygon(subject: LocalPoint[], clip: LocalPoint[]): LocalPoint[] {
  let output = [...subject];
  const n = clip.length;

  for (let i = 0; i < n; i++) {
    const c1 = clip[i];
    const c2 = clip[(i + 1) % n];

    if (output.length === 0) break;

    const input = output;
    output = [];

    for (let j = 0; j < input.length; j++) {
      const p1 = input[j];
      const p2 = input[(j + 1) % input.length];

      const inside1 = isInsideEdge(p1, c1, c2);
      const inside2 = isInsideEdge(p2, c1, c2);

      if (inside1 && inside2) {
        output.push(p2);
      } else if (inside1 && !inside2) {
        const inter = segmentIntersection(p1, p2, c1, c2);
        if (inter) output.push(inter);
      } else if (!inside1 && inside2) {
        const inter = segmentIntersection(p1, p2, c1, c2);
        if (inter) output.push(inter);
        output.push(p2);
      }
    }
  }

  return output;
}

/**
 * 判断点是否在裁剪边 c1->c2 的"内侧"
 * （裁剪多边形顶点按逆时针，内侧为左侧）
 */
function isInsideEdge(p: LocalPoint, c1: LocalPoint, c2: LocalPoint): boolean {
  // 叉积：c1->c2 与 c1->p
  // 逆时针凸多边形，内侧在边的左侧，即叉积 > 0
  const cross = (c2.x - c1.x) * (p.y - c1.y) - (c2.y - c1.y) * (p.x - c1.x);
  return cross >= -1e-9;
}

// ===== 圆离散 =====

/**
 * 将圆离散为近似正多边形（顶点按逆时针）
 */
function circleToPolygon(center: GeoPoint, radiusM: number, segments = 72): GeoPoint[] {
  const lngPerM = 1 / (111320 * Math.cos((center.lat * Math.PI) / 180));
  const latPerM = 1 / 110540;

  const vertices: GeoPoint[] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * 2 * Math.PI;
    const dx = radiusM * Math.cos(angle);
    const dy = radiusM * Math.sin(angle);
    vertices.push({
      lng: center.lng + dx * lngPerM,
      lat: center.lat + dy * latPerM,
    });
  }
  return vertices;
}

// ===== 核心计算 =====

export interface ZoneOverlapInput {
  /** 项目几何 */
  project: ProjectGeometry;
  /** 保护区多边形（环评常用半径圆离散，也支持任意多边形） */
  zone: {
    sourceName: string;
    sourceId: string;
    /** 保护区中心（用于圆） */
    center?: GeoPoint;
    /** 保护区半径（米），若提供则以圆近似 */
    radiusM?: number;
    /** 保护区任意多边形（若提供则优先使用） */
    zonePolygon?: GeoPoint[];
    /** 保护区级别 */
    level: string;
  };
}

/**
 * 计算项目几何与保护区的精确重叠
 */
export function calculateZoneOverlap(input: ZoneOverlapInput): ZoneOverlapResult {
  const { project, zone } = input;

  // 1. 确定保护区多边形
  let zonePolygonGeo: GeoPoint[];
  if (zone.zonePolygon && zone.zonePolygon.length >= 3) {
    zonePolygonGeo = zone.zonePolygon;
  } else if (zone.center && zone.radiusM) {
    zonePolygonGeo = circleToPolygon(zone.center, zone.radiusM);
  } else {
    throw new Error('保护区必须提供多边形或中心+半径');
  }

  // 参考纬度（取几何平均，用于投影）
  const refLat = zonePolygonGeo.reduce((sum, p) => sum + p.lat, 0) / zonePolygonGeo.length;

  // 2. 转为局部平面坐标
  const zonePoly = toLocalPolygon(zonePolygonGeo, refLat);
  const zoneAreaM2 = shoeLaceArea(zonePoly);

  // 3. 按项目类型计算
  switch (project.type) {
    case 'point': {
      const projPt = toLocalPoint({ lng: project.lng, lat: project.lat }, refLat);
      const isInside = pointInPolygon(projPt, zonePoly);
      return {
        isOverlap: isInside,
        overlapAreaM2: isInside ? 0 : 0,
        overlapAreaKm2: 0,
        projectAreaM2: 0,
        zoneAreaM2,
        overlapRatioOfProject: isInside ? 1 : 0,
        overlapRatioOfZone: 0,
        lineCrossLengthM: 0,
        fullyInsideZone: isInside,
      };
    }

    case 'circle': {
      const circleGeo = circleToPolygon(
        { lng: project.lng, lat: project.lat },
        project.radiusM,
      );
      const circlePoly = toLocalPolygon(circleGeo, refLat);
      const projectAreaM2 = shoeLaceArea(circlePoly);
      return computePolygonOverlap(circlePoly, projectAreaM2, zonePoly, zoneAreaM2);
    }

    case 'polygon': {
      const projectPoly = toLocalPolygon(project.vertices, refLat);
      const projectAreaM2 = shoeLaceArea(projectPoly);
      return computePolygonOverlap(projectPoly, projectAreaM2, zonePoly, zoneAreaM2);
    }

    case 'line': {
      return computeLineOverlap(project.vertices, zonePoly, zoneAreaM2);
    }

    default:
      throw new Error('未知项目几何类型');
  }
}

/**
 * 多边形与多边形重叠
 */
function computePolygonOverlap(
  projectPoly: LocalPoint[],
  projectAreaM2: number,
  zonePoly: LocalPoint[],
  zoneAreaM2: number,
): ZoneOverlapResult {
  const intersect = clipPolygon(projectPoly, zonePoly);
  const overlapAreaM2 = intersect.length >= 3 ? shoeLaceArea(intersect) : 0;

  const overlapRatioOfProject = projectAreaM2 > 0 ? overlapAreaM2 / projectAreaM2 : 0;

  return {
    isOverlap: overlapAreaM2 > 0,
    overlapAreaM2,
    overlapAreaKm2: overlapAreaM2 / 1_000_000,
    projectAreaM2,
    zoneAreaM2,
    overlapRatioOfProject,
    overlapRatioOfZone: zoneAreaM2 > 0 ? overlapAreaM2 / zoneAreaM2 : 0,
    lineCrossLengthM: 0,
    // 项目被保护区覆盖比例接近 1 视为完全位于保护区内
    // （避免射线法对边界顶点判定的歧义）
    fullyInsideZone: projectAreaM2 > 0 && overlapRatioOfProject > 0.995,
  };
}

/**
 * 线性项目与多边形重叠（求穿越长度）
 * 用交点将每段线段切分为若干子段，逐段取中点判内累加
 */
function computeLineOverlap(
  lineGeo: GeoPoint[],
  zonePoly: LocalPoint[],
  zoneAreaM2: number,
): ZoneOverlapResult {
  const refLat = zonePoly.reduce((sum, p) => sum + p.y, 0) / zonePoly.length / 110540;
  const lineLocal = toLocalPolygon(lineGeo, refLat);

  let crossLengthM = 0;
  let fullyInside = true;
  let anyInside = false;

  for (let i = 0; i < lineLocal.length - 1; i++) {
    const a = lineLocal[i];
    const b = lineLocal[i + 1];
    const totalLen = segmentLength(a, b);

    // 收集交点参数 t（0..1）
    const tSet = new Set<number>([0, 1]);
    for (let j = 0; j < zonePoly.length; j++) {
      const c = zonePoly[j];
      const d = zonePoly[(j + 1) % zonePoly.length];
      const inter = segmentIntersection(a, b, c, d);
      if (inter) {
        const distA = segmentLength(a, inter);
        const t = totalLen > 0 ? distA / totalLen : 0;
        tSet.add(Math.max(0, Math.min(1, t)));
      }
    }

    const ts = Array.from(tSet).sort((x, y) => x - y);

    // 相邻 t 区间取中点判内，累加内段长度
    for (let k = 0; k < ts.length - 1; k++) {
      const t1 = ts[k];
      const t2 = ts[k + 1];
      if (t2 - t1 < 1e-9) continue;
      const midT = (t1 + t2) / 2;
      const mid = {
        x: a.x + (b.x - a.x) * midT,
        y: a.y + (b.y - a.y) * midT,
      };
      if (pointInPolygon(mid, zonePoly)) {
        crossLengthM += totalLen * (t2 - t1);
        anyInside = true;
      }
    }
  }

  fullyInside = anyInside && lineLocal.every((p) => pointInPolygon(p, zonePoly));

  return {
    isOverlap: crossLengthM > 0,
    overlapAreaM2: 0,
    overlapAreaKm2: 0,
    projectAreaM2: 0,
    zoneAreaM2,
    overlapRatioOfProject: 0,
    overlapRatioOfZone: 0,
    lineCrossLengthM: crossLengthM,
    fullyInsideZone: fullyInside && crossLengthM > 0,
  };
}

// ===== 批量计算 =====

export interface BatchOverlapInput {
  project: ProjectGeometry;
  zones: Array<{
    sourceName: string;
    sourceId: string;
    center?: GeoPoint;
    radiusM?: number;
    zonePolygon?: GeoPoint[];
    level: string;
  }>;
}

export interface BatchOverlapResult {
  project: ProjectGeometry;
  /** 逐保护区重叠结果 */
  results: (ZoneOverlapResult & { sourceName: string; sourceId: string; level: string })[];
  /** 是否涉及任一保护区 */
  hasOverlap: boolean;
  /** 涉及保护区的最高级别 */
  maxInvolvedLevel: string | null;
}

/**
 * 批量计算项目与多个保护区的重叠
 */
export function calculateBatchZoneOverlap(input: BatchOverlapInput): BatchOverlapResult {
  const results = input.zones.map((zone) => {
    const r = calculateZoneOverlap({ project: input.project, zone });
    return { ...r, sourceName: zone.sourceName, sourceId: zone.sourceId, level: zone.level };
  });

  const involved = results.filter((r) => r.isOverlap);
  const levelRank: Record<string, number> = { '一级': 3, '二级': 2, '准保护区': 1 };
  let maxInvolvedLevel: string | null = null;
  let maxRank = 0;
  for (const r of involved) {
    const rank = levelRank[r.level] ?? 0;
    if (rank > maxRank) {
      maxRank = rank;
      maxInvolvedLevel = r.level;
    }
  }

  return {
    project: input.project,
    results,
    hasOverlap: involved.length > 0,
    maxInvolvedLevel,
  };
}
