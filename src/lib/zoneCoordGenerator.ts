/**
 * 保护区拐点坐标生成器
 *
 * 功能：
 * 1. 根据水源地中心坐标和保护区半径，生成圆形保护区边界拐点经纬度
 * 2. 根据河流型保护区的length/width，生成矩形保护区拐点经纬度
 * 3. 输出格式支持：JSON / Excel行数据 / KML坐标串
 *
 * 坐标转换原理：
 * - 1° 纬度 ≈ 110540 m
 * - 1° 经度 ≈ 111320 × cos(lat) m
 */

import type { ZoneResult } from './zoneCalcEngine';

// ===== 数据类型 =====

export interface ZoneVertex {
  /** 拐点编号 */
  id: string;
  /** 经度（东经） */
  lng: number;
  /** 纬度（北纬） */
  lat: number;
  /** 方位角（度，从正北顺时针） */
  azimuth: number;
}

export interface ZoneWithVertices extends ZoneResult {
  vertices: ZoneVertex[];
  centerLng: number;
  centerLat: number;
}

export interface SourceZoneVertices {
  sourceName: string;
  sourceId: string;
  centerLng: number;
  centerLat: number;
  zones: ZoneWithVertices[];
}

// ===== 常量 =====

/** 每圈拐点数量（每15°一个点，共24个） */
const DEFAULT_VERTEX_COUNT = 24;
/** 拐点角度间隔（度） */
const VERTEX_INTERVAL = 360 / DEFAULT_VERTEX_COUNT;

// ===== 核心算法 =====

/**
 * 米 → 经度偏移量
 * @param meters 米
 * @param lat 纬度（弧度或度）
 */
function metersToLngDelta(meters: number, latRad: number): number {
  return meters / (111320 * Math.cos(latRad));
}

/**
 * 米 → 纬度偏移量
 */
function metersToLatDelta(meters: number): number {
  return meters / 110540;
}

/**
 * 生成圆形保护区拐点
 * @param centerLng 中心经度
 * @param centerLat 中心纬度
 * @param radiusM 半径（米）
 * @param vertexCount 拐点数量，默认24
 */
export function generateCircleVertices(
  centerLng: number,
  centerLat: number,
  radiusM: number,
  vertexCount: number = DEFAULT_VERTEX_COUNT,
): ZoneVertex[] {
  const latRad = (centerLat * Math.PI) / 180;
  const interval = 360 / vertexCount;
  const vertices: ZoneVertex[] = [];

  for (let i = 0; i < vertexCount; i++) {
    const azimuth = i * interval; // 从正北(0°)开始，顺时针
    const rad = (azimuth * Math.PI) / 180;
    // 方位角0°=正北，90°=正东
    const dlng = metersToLngDelta(radiusM, latRad) * Math.sin(rad);
    const dlat = metersToLatDelta(radiusM) * Math.cos(rad);

    vertices.push({
      id: `J${i + 1}`,
      lng: Math.round((centerLng + dlng) * 1e6) / 1e6,
      lat: Math.round((centerLat + dlat) * 1e6) / 1e6,
      azimuth: Math.round(azimuth * 100) / 100,
    });
  }

  return vertices;
}

/**
 * 生成河流型矩形保护区拐点
 * @param centerLng 取水口经度
 * @param centerLat 取水口纬度
 * @param upstreamM 上游长度（从取水口起算）
 * @param downstreamM 下游长度（从取水口起算）
 * @param bankWidthM 两岸单侧宽度（m）
 * @param riverAzimuth 河流流向方位角（度，默认90°=自西向东）
 */
export function generateRiverVertices(
  centerLng: number,
  centerLat: number,
  upstreamM: number,
  downstreamM: number,
  bankWidthM: number,
  riverAzimuth: number = 90,
): ZoneVertex[] {
  const latRad = (centerLat * Math.PI) / 180;
  const rad = (riverAzimuth * Math.PI) / 180;

  // 河流方向单位向量（方位角：0°=北，90°=东）
  const dx_river = Math.sin(rad);
  const dy_river = Math.cos(rad);
  // 垂直方向单位向量（右手法则）
  const dx_cross = Math.cos(rad);
  const dy_cross = -Math.sin(rad);

  const halfWidthM = bankWidthM; // bankWidth已是单侧宽度

  // 8个拐点：上游左岸、上游右岸、下游右岸、下游左岸 + 上游中点、下游中点、左岸中点、右岸中点
  const points: Array<{ dx_m: number; dy_m: number; label: string }> = [
    // 1. 上游左岸
    {
      dx_m: -upstreamM * dx_river - halfWidthM * dx_cross,
      dy_m: -upstreamM * dy_river - halfWidthM * dy_cross,
      label: '上游左岸',
    },
    // 2. 上游右岸
    {
      dx_m: -upstreamM * dx_river + halfWidthM * dx_cross,
      dy_m: -upstreamM * dy_river + halfWidthM * dy_cross,
      label: '上游右岸',
    },
    // 3. 下游右岸
    {
      dx_m: downstreamM * dx_river + halfWidthM * dx_cross,
      dy_m: downstreamM * dy_river + halfWidthM * dy_cross,
      label: '下游右岸',
    },
    // 4. 下游左岸
    {
      dx_m: downstreamM * dx_river - halfWidthM * dx_cross,
      dy_m: downstreamM * dy_river - halfWidthM * dy_cross,
      label: '下游左岸',
    },
    // 5. 上游中点（河道中心线）
    { dx_m: -upstreamM * dx_river, dy_m: -upstreamM * dy_river, label: '上游中点' },
    // 6. 下游中点（河道中心线）
    { dx_m: downstreamM * dx_river, dy_m: downstreamM * dy_river, label: '下游中点' },
    // 7. 取水口左岸
    { dx_m: -halfWidthM * dx_cross, dy_m: -halfWidthM * dy_cross, label: '取水口左岸' },
    // 8. 取水口右岸
    { dx_m: halfWidthM * dx_cross, dy_m: halfWidthM * dy_cross, label: '取水口右岸' },
  ];

  return points.map((p, i) => ({
    id: `J${i + 1}`,
    lng: Math.round((centerLng + metersToLngDelta(p.dx_m, latRad)) * 1e6) / 1e6,
    lat: Math.round((centerLat + metersToLatDelta(p.dy_m)) * 1e6) / 1e6,
    azimuth: Math.round(((i * 45 + 360) % 360) * 100) / 100,
  }));
}

/**
 * 生成湖库型保护区拐点
 * @param centerLng 取水口经度
 * @param centerLat 取水口纬度
 * @param radiusM 保护区半径 m
 * @param intakeType 取水口类型
 * @param vertexCount 拐点数量
 */
export function generateLakeVertices(
  centerLng: number,
  centerLat: number,
  radiusM: number,
  intakeType: '岸边' | '湖心' | '分层取水' = '湖心',
  vertexCount: number = DEFAULT_VERTEX_COUNT,
): ZoneVertex[] {
  if (intakeType === '岸边') {
    // 半圆：角度范围 90°~270°（水域侧，假设水域在取水口南侧/东侧）
    const latRad = (centerLat * Math.PI) / 180;
    const halfCount = Math.floor(vertexCount / 2);
    const interval = 360 / vertexCount;
    const vertices: ZoneVertex[] = [];

    for (let i = 0; i <= halfCount; i++) {
      const azimuth = 90 + i * interval; // 90°~270°
      const rad = (azimuth * Math.PI) / 180;
      const dlng = metersToLngDelta(radiusM, latRad) * Math.sin(rad);
      const dlat = metersToLatDelta(radiusM) * Math.cos(rad);
      vertices.push({
        id: `J${i + 1}`,
        lng: Math.round((centerLng + dlng) * 1e6) / 1e6,
        lat: Math.round((centerLat + dlat) * 1e6) / 1e6,
        azimuth: Math.round(azimuth * 100) / 100,
      });
    }
    return vertices;
  }

  // 湖心 / 分层取水 → 全圆
  return generateCircleVertices(centerLng, centerLat, radiusM, vertexCount);
}

// ===== 组合接口 =====

/**
 * 为单个水源地的所有保护区生成拐点坐标
 */
export function generateSourceZoneVertices(
  sourceId: string,
  sourceName: string,
  centerLng: number,
  centerLat: number,
  zones: ZoneResult[],
  vertexCount: number = DEFAULT_VERTEX_COUNT,
): SourceZoneVertices {
  const zonesWithVertices: ZoneWithVertices[] = zones.map((zone) => {
    let vertices: ZoneVertex[] = [];

    if (zone.riverExt) {
      // 河流型保护区（使用上/下游独立长度）
      vertices = generateRiverVertices(
        centerLng,
        centerLat,
        zone.riverExt.upstreamLength,
        zone.riverExt.downstreamLength,
        zone.riverExt.bankWidth,
      );
    } else if (zone.lakeExt) {
      // 湖库型保护区（根据取水口类型）
      vertices = generateLakeVertices(
        centerLng,
        centerLat,
        zone.radius || 0,
        zone.lakeExt.intakeType,
        vertexCount,
      );
    } else if (zone.radius) {
      // 圆形保护区（地下水）
      vertices = generateCircleVertices(centerLng, centerLat, zone.radius, vertexCount);
    } else if (zone.length && zone.width) {
      // 兼容旧版河流型矩形保护区（无 riverExt 时回退）
      vertices = generateRiverVertices(
        centerLng,
        centerLat,
        zone.length * 0.83,
        zone.length * 0.17,
        zone.width,
      );
    }

    return {
      ...zone,
      vertices,
      centerLng,
      centerLat,
    };
  });

  return {
    sourceName,
    sourceId,
    centerLng,
    centerLat,
    zones: zonesWithVertices,
  };
}

/**
 * 批量生成多个水源地的保护区拐点
 */
export function generateBatchVertices(
  items: Array<{
    sourceId: string;
    sourceName: string;
    lng: number;
    lat: number;
    zones: ZoneResult[];
  }>,
  vertexCount?: number,
): SourceZoneVertices[] {
  return items
    .filter((item) => item.lng != null && item.lat != null)
    .map((item) =>
      generateSourceZoneVertices(
        item.sourceId,
        item.sourceName,
        item.lng,
        item.lat,
        item.zones,
        vertexCount,
      ),
    );
}

// ===== 导出辅助 =====

/**
 * 生成KML坐标串（用于Google Earth导入）
 * 格式：lng,lat,altitude 按顺时针排列，首尾闭合
 */
export function toKMLCoordinates(vertices: ZoneVertex[]): string {
  if (vertices.length === 0) return '';
  const coords = vertices.map((v) => `${v.lng},${v.lat},0`);
  coords.push(coords[0]); // 闭合
  return coords.join(' ');
}

/**
 * 生成Leaflet LatLng数组（用于L.polygon绘制）
 */
export function toLeafletLatLngs(vertices: ZoneVertex[]): Array<[number, number]> {
  return vertices.map((v) => [v.lat, v.lng]);
}

/**
 * 生成Excel导出行数据
 */
export function toExcelRows(sourceVertices: SourceZoneVertices[]): Array<{
  sourceName: string;
  city: string;
  level: string;
  method: string;
  vertexId: string;
  lng: number;
  lat: number;
  azimuth: number;
  radiusM?: number;
  areaKm2: number;
}> {
  const rows: Array<{
    sourceName: string;
    city: string;
    level: string;
    method: string;
    vertexId: string;
    lng: number;
    lat: number;
    azimuth: number;
    radiusM?: number;
    areaKm2: number;
  }> = [];

  for (const sv of sourceVertices) {
    for (const zone of sv.zones) {
      for (const v of zone.vertices) {
        rows.push({
          sourceName: sv.sourceName,
          city: '', // 需要从外部关联
          level: zone.level,
          method: zone.method,
          vertexId: v.id,
          lng: v.lng,
          lat: v.lat,
          azimuth: v.azimuth,
          radiusM: zone.radius,
          areaKm2: zone.area,
        });
      }
    }
  }

  return rows;
}
