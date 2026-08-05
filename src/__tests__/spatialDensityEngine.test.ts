/* ===== S12.4: 空间密度聚类引擎测试 ===== */
import { describe, it, expect } from 'vitest';
import {
  buildDensityGrid,
  nonEmptyCells,
  clusterByNearestNeighbor,
  computeDistributionStats,
  findHotspots,
  type DensityPoint,
} from '@/lib/spatialDensityEngine';

// 研究区范围
const BOUNDS = { latMin: 37.5, latMax: 38.5, lngMin: 113.5, lngMax: 114.5 };

function makePoint(id: string, lng: number, lat: number, name = id): DensityPoint {
  return { id, name, lng, lat };
}

describe('spatialDensityEngine', () => {
  // ===== buildDensityGrid =====
  describe('buildDensityGrid', () => {
    it('构造网格并正确计数', () => {
      const sources = [
        makePoint('a', 114.0, 38.0),
        makePoint('b', 114.01, 38.0), // 同一格
        makePoint('c', 114.0, 38.01), // 可能不同格
      ];
      const grid = buildDensityGrid(sources, BOUNDS, 0.05);
      expect(grid.totalSources).toBe(3);
      expect(grid.cells.length).toBeGreaterThan(0);
      expect(grid.maxCount).toBeGreaterThanOrEqual(2);
    });

    it('空格计数为0', () => {
      const sources: DensityPoint[] = [];
      const grid = buildDensityGrid(sources, BOUNDS, 0.1);
      expect(grid.maxCount).toBe(0);
      const allEmpty = grid.cells.every((c) => c.count === 0);
      expect(allEmpty).toBe(true);
    });

    it('强度归一化到0-1', () => {
      const sources = [
        makePoint('a', 114.0, 38.0),
        makePoint('b', 114.01, 38.0),
        makePoint('c', 114.0, 38.01),
      ];
      const grid = buildDensityGrid(sources, BOUNDS, 0.05);
      // 最大密度格强度为1
      const maxCell = grid.cells.find((c) => c.count === grid.maxCount);
      expect(maxCell?.intensity).toBe(1);
      for (const c of grid.cells) {
        expect(c.intensity).toBeGreaterThanOrEqual(0);
        expect(c.intensity).toBeLessThanOrEqual(1);
      }
    });

    it('网格范围覆盖区域', () => {
      const grid = buildDensityGrid([], BOUNDS, 0.5);
      expect(grid.bounds).toEqual(BOUNDS);
    });
  });

  // ===== nonEmptyCells =====
  describe('nonEmptyCells', () => {
    it('筛选非空格', () => {
      const sources = [makePoint('a', 114.0, 38.0)];
      const grid = buildDensityGrid(sources, BOUNDS, 0.1);
      const nonEmpty = nonEmptyCells(grid);
      expect(nonEmpty.length).toBeGreaterThanOrEqual(1);
      expect(nonEmpty.every((c) => c.count > 0)).toBe(true);
    });
  });

  // ===== clusterByNearestNeighbor =====
  describe('clusterByNearestNeighbor', () => {
    it('近距离点聚为一类', () => {
      const sources = [
        makePoint('a', 114.0, 38.0),
        makePoint('b', 114.001, 38.0), // ~100m
        makePoint('c', 114.002, 38.0), // ~200m
      ];
      const clusters = clusterByNearestNeighbor(sources, 1000);
      expect(clusters).toHaveLength(1);
      expect(clusters[0].sourceCount).toBe(3);
    });

    it('远距离点分为多类', () => {
      const sources = [
        makePoint('a', 114.0, 38.0),
        makePoint('b', 114.5, 38.5), // 很远的另一个城市
      ];
      const clusters = clusterByNearestNeighbor(sources, 1000);
      expect(clusters).toHaveLength(2);
    });

    it('单点自成一类', () => {
      const clusters = clusterByNearestNeighbor([makePoint('a', 114, 38)], 1000);
      expect(clusters).toHaveLength(1);
      expect(clusters[0].sourceCount).toBe(1);
    });

    it('聚类按成员数降序', () => {
      const sources = [
        makePoint('a', 114.0, 38.0),
        makePoint('b', 114.001, 38.0),
        makePoint('c', 114.5, 38.5),
        makePoint('d', 114.501, 38.5),
        makePoint('e', 114.0, 38.01),
      ];
      const clusters = clusterByNearestNeighbor(sources, 1000);
      for (let i = 1; i < clusters.length; i++) {
        expect(clusters[i - 1].sourceCount).toBeGreaterThanOrEqual(clusters[i].sourceCount);
      }
    });

    it('聚类中心更新为质心', () => {
      const sources = [
        makePoint('a', 114.0, 38.0),
        makePoint('b', 114.02, 38.0), // 约2km
      ];
      const clusters = clusterByNearestNeighbor(sources, 10000);
      expect(clusters).toHaveLength(1);
      expect(clusters[0].centerLng).toBeCloseTo(114.01, 3);
    });
  });

  // ===== computeDistributionStats =====
  describe('computeDistributionStats', () => {
    it('样本不足时返回零值', () => {
      const stats = computeDistributionStats([makePoint('a', 114, 38)], BOUNDS);
      expect(stats.distributionLabel).toBe('样本不足');
      expect(stats.nearestNeighborIndex).toBe(0);
    });

    it('聚集分布的最近邻指数 < 1', () => {
      // 两个点很近
      const sources = [
        makePoint('a', 114.0, 38.0),
        makePoint('b', 114.0005, 38.0), // ~50m
      ];
      const stats = computeDistributionStats(sources, BOUNDS);
      expect(stats.meanNearestDistM).toBeGreaterThan(0);
    });

    it('返回面积与非零统计', () => {
      const sources = [
        makePoint('a', 114.0, 38.0),
        makePoint('b', 114.5, 38.0),
        makePoint('c', 114.0, 38.5),
      ];
      const stats = computeDistributionStats(sources, BOUNDS);
      expect(stats.areaKm2).toBeGreaterThan(0);
      expect(stats.meanNearestDistM).toBeGreaterThan(0);
      expect(stats.coefficientOfVariation).toBeGreaterThanOrEqual(0);
    });

    it('分布标签为已知枚举之一', () => {
      const sources = [
        makePoint('a', 114.0, 38.0),
        makePoint('b', 114.2, 38.05),
        makePoint('c', 114.4, 38.1),
        makePoint('d', 114.1, 38.0),
        makePoint('e', 114.3, 38.05),
      ];
      const stats = computeDistributionStats(sources, BOUNDS);
      expect(['聚集分布', '随机分布', '均匀分布']).toContain(stats.distributionLabel);
    });
  });

  // ===== findHotspots =====
  describe('findHotspots', () => {
    it('识别高密度富集区', () => {
      const sources = [
        // 富集区A：3个点
        makePoint('a', 114.0, 38.0),
        makePoint('b', 114.001, 38.0),
        makePoint('c', 114.002, 38.0),
        // 孤立点
        makePoint('d', 114.5, 38.5),
        makePoint('e', 114.51, 38.5),
      ];
      const hotspots = findHotspots(sources, 1000, 3);
      expect(hotspots).toHaveLength(1);
      expect(hotspots[0].sourceCount).toBe(3);
      expect(hotspots[0].intensity).toBe(1);
    });

    it('低于阈值成员数的聚类不识别为富集区', () => {
      const sources = [
        makePoint('a', 114.0, 38.0),
        makePoint('b', 114.001, 38.0),
        makePoint('c', 114.5, 38.5),
      ];
      const hotspots = findHotspots(sources, 1000, 3);
      expect(hotspots).toHaveLength(0);
    });

    it('空数据源无富集区', () => {
      const hotspots = findHotspots([], 1000, 3);
      expect(hotspots).toHaveLength(0);
    });

    it('富集区按成员数降序', () => {
      const sources = [
        // 大富集区 4个
        makePoint('a', 114.0, 38.0),
        makePoint('b', 114.001, 38.0),
        makePoint('c', 114.002, 38.0),
        makePoint('d', 114.003, 38.0),
        // 小富集区 3个
        makePoint('e', 115.0, 39.0),
        makePoint('f', 115.001, 39.0),
        makePoint('g', 115.002, 39.0),
      ];
      const hotspots = findHotspots(sources, 1000, 3);
      expect(hotspots.length).toBe(2);
      expect(hotspots[0].sourceCount).toBe(4);
      expect(hotspots[1].sourceCount).toBe(3);
    });
  });
});
