/* ===== S12.4: 水源地空间密度与聚类分析引擎 =====
 * 区域密度热力、最近邻聚类、分布均衡度、富集区识别
 */

import { haversineDistance } from './spatialAnalysis';

// ===== 类型定义 =====

export interface DensityPoint {
  id: string;
  name: string;
  lng: number;
  lat: number;
}

export interface DensityCell {
  /** 网格中心 */
  lng: number;
  lat: number;
  /** 网格左下角 */
  lngMin: number;
  latMin: number;
  count: number;
  /** 归一化强度 0-1 */
  intensity: number;
  /** 网格内水源地 ID */
  sourceIds: string[];
}

export interface DensityGridResult {
  gridSize: number; // 度
  cells: DensityCell[];
  maxCount: number;
  /** 区域范围 */
  bounds: { latMin: number; latMax: number; lngMin: number; lngMax: number };
  /** 总水源地数 */
  totalSources: number;
}

export interface Cluster {
  id: string;
  centerLng: number;
  centerLat: number;
  sourceIds: string[];
  sourceCount: number;
  /** 聚类半径（米），最远点到中心的距离 */
  radiusM: number;
}

export interface DistributionStats {
  /** 平均最近邻距离（米） */
  meanNearestDistM: number;
  /** 期望平均最近邻距离（米），随机分布理论值 */
  expectedNearestDistM: number;
  /** 最近邻指数 R：<1 聚集，≈1 随机，>1 均匀 */
  nearestNeighborIndex: number;
  /** 变异系数（密度差异） */
  coefficientOfVariation: number;
  /** 聚集程度描述 */
  distributionLabel: string;
  /** 研究区面积（平方千米） */
  areaKm2: number;
}

// ===== 网格密度 =====

/**
 * 构建空间密度网格
 */
export function buildDensityGrid(
  sources: DensityPoint[],
  bounds: { latMin: number; latMax: number; lngMin: number; lngMax: number },
  gridSize = 0.01, // 度，约1km
): DensityGridResult {
  const cells: DensityCell[] = [];

  for (let lat = bounds.latMin; lat < bounds.latMax; lat += gridSize) {
    for (let lng = bounds.lngMin; lng < bounds.lngMax; lng += gridSize) {
      const cellSources = sources.filter(
        (s) =>
          s.lat >= lat && s.lat < lat + gridSize &&
          s.lng >= lng && s.lng < lng + gridSize,
      );
      cells.push({
        lng: lng + gridSize / 2,
        lat: lat + gridSize / 2,
        lngMin: lng,
        latMin: lat,
        count: cellSources.length,
        intensity: 0, // 稍后归一化
        sourceIds: cellSources.map((s) => s.id),
      });
    }
  }

  const maxCount = Math.max(0, ...cells.map((c) => c.count));

  // 归一化强度
  for (const cell of cells) {
    cell.intensity = maxCount > 0 ? cell.count / maxCount : 0;
  }

  return {
    gridSize,
    cells,
    maxCount,
    bounds,
    totalSources: sources.length,
  };
}

/**
 * 筛选非空格，用于热力图
 */
export function nonEmptyCells(grid: DensityGridResult): DensityCell[] {
  return grid.cells.filter((c) => c.count > 0);
}

// ===== 聚类（贪心最近邻） =====

/**
 * 基于距离阈值的贪心空间聚类
 * 每个点与已有聚类中心距离 <= 阈值则归入，否则新建
 */
export function clusterByNearestNeighbor(
  sources: DensityPoint[],
  maxDistM = 5000,
): Cluster[] {
  const clusters: Cluster[] = [];

  for (const source of sources) {
    let added = false;
    for (const cluster of clusters) {
      const dist = haversineDistance(cluster.centerLat, cluster.centerLng, source.lat, source.lng);
      if (dist <= maxDistM) {
        cluster.sourceIds.push(source.id);
        // 重新计算聚类中心（质心）
        const ids = cluster.sourceIds;
        const members = sources.filter((s) => ids.includes(s.id));
        const avgLng = members.reduce((sum, m) => sum + m.lng, 0) / members.length;
        const avgLat = members.reduce((sum, m) => sum + m.lat, 0) / members.length;
        cluster.centerLng = avgLng;
        cluster.centerLat = avgLat;
        // 重算半径
        cluster.radiusM = Math.max(
          ...members.map((m) => haversineDistance(avgLat, avgLng, m.lat, m.lng)),
        );
        added = true;
        break;
      }
    }

    if (!added) {
      clusters.push({
        id: `cluster_${clusters.length + 1}`,
        centerLng: source.lng,
        centerLat: source.lat,
        sourceIds: [source.id],
        sourceCount: 1,
        radiusM: 0,
      });
    }
  }

  // 更新 sourceCount
  for (const cluster of clusters) {
    cluster.sourceCount = cluster.sourceIds.length;
  }

  // 按成员数降序
  clusters.sort((a, b) => b.sourceCount - a.sourceCount);
  return clusters;
}

// ===== 分布均衡度 =====

/**
 * 计算空间分布统计（最近邻指数、变异系数）
 */
export function computeDistributionStats(
  sources: DensityPoint[],
  bounds: { latMin: number; latMax: number; lngMin: number; lngMax: number },
): DistributionStats {
  const n = sources.length;
  if (n < 2) {
    return {
      meanNearestDistM: 0,
      expectedNearestDistM: 0,
      nearestNeighborIndex: 0,
      coefficientOfVariation: 0,
      distributionLabel: '样本不足',
      areaKm2: 0,
    };
  }

  // 平均最近邻距离
  let totalNearest = 0;
  const nearestDists: number[] = [];
  for (const s of sources) {
    let nearest = Infinity;
    for (const t of sources) {
      if (s.id === t.id) continue;
      const d = haversineDistance(s.lat, s.lng, t.lat, t.lng);
      if (d < nearest) nearest = d;
    }
    nearestDists.push(nearest);
    totalNearest += nearest;
  }
  const meanNearestDistM = totalNearest / n;

  // 研究区面积（km²）
  const latMid = (bounds.latMin + bounds.latMax) / 2;
  const lngSpan = bounds.lngMax - bounds.lngMin;
  const latSpan = bounds.latMax - bounds.latMin;
  const areaKm2 = (lngSpan * 111320 * Math.cos((latMid * Math.PI) / 180)) *
    (latSpan * 110540) / 1_000_000;

  // 期望平均最近邻距离（随机泊松分布）
  const density = areaKm2 > 0 ? n / areaKm2 : 0; // 每km²
  const expectedNearestDistM = density > 0 ? 1 / (2 * Math.sqrt(density)) * 1000 : 0;

  const nearestNeighborIndex = expectedNearestDistM > 0
    ? meanNearestDistM / expectedNearestDistM
    : 0;

  // 变异系数（最近邻距离）
  const mean = meanNearestDistM;
  const variance = nearestDists.reduce((sum, d) => sum + (d - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  const coefficientOfVariation = mean > 0 ? std / mean : 0;

  // 分布描述
  let distributionLabel: string;
  if (nearestNeighborIndex < 0.8) {
    distributionLabel = '聚集分布';
  } else if (nearestNeighborIndex <= 1.2) {
    distributionLabel = '随机分布';
  } else {
    distributionLabel = '均匀分布';
  }

  return {
    meanNearestDistM,
    expectedNearestDistM,
    nearestNeighborIndex,
    coefficientOfVariation,
    distributionLabel,
    areaKm2,
  };
}

// ===== 富集区识别 =====

export interface Hotspot {
  id: string;
  centerLng: number;
  centerLat: number;
  sourceCount: number;
  sourceIds: string[];
  /** 与最高密度聚类相比的相对强度 0-1 */
  intensity: number;
}

/**
 * 识别水源地富集区（基于密度聚类，取成员数超过阈值的聚类）
 */
export function findHotspots(
  sources: DensityPoint[],
  maxDistM = 5000,
  minSources = 3,
): Hotspot[] {
  const clusters = clusterByNearestNeighbor(sources, maxDistM);
  const hotspots = clusters
    .filter((c) => c.sourceCount >= minSources)
    .map((c, i) => ({
      id: `hotspot_${i + 1}`,
      centerLng: c.centerLng,
      centerLat: c.centerLat,
      sourceCount: c.sourceCount,
      sourceIds: c.sourceIds,
      intensity: 0, // 稍后归一化
    }));

  const maxCount = Math.max(0, ...hotspots.map((h) => h.sourceCount));
  for (const h of hotspots) {
    h.intensity = maxCount > 0 ? h.sourceCount / maxCount : 0;
  }

  return hotspots.sort((a, b) => b.sourceCount - a.sourceCount);
}
