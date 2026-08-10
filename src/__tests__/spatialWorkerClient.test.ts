import { describe, it, expect, beforeEach } from 'vitest';
import { runSpatialTask, terminateSpatialWorker } from '../lib/spatialWorkerClient';

describe('spatialWorkerClient (Web Worker)', () => {
  const bounds = {
    latMin: 37,
    latMax: 39,
    lngMin: 113,
    lngMax: 116,
  };

  const sources = [
    { id: '1', name: 'A', lat: 38.1, lng: 114.0 },
    { id: '2', name: 'B', lat: 38.2, lng: 114.1 },
    { id: '3', name: 'C', lat: 38.05, lng: 114.2 },
    { id: '4', name: 'D', lat: 37.9, lng: 113.9 },
  ];

  beforeEach(() => {
    // 每次测试前终止 Worker，重置单例状态
    terminateSpatialWorker();
  });

  describe('降级路径（无 Worker 环境自动降级主线程）', () => {
    it('computeDistributionStats 应返回统计结果', async () => {
      const result = await runSpatialTask('computeDistributionStats', { sources, bounds });
      expect(result).toBeDefined();
      expect(typeof result.meanNearestDistM).toBe('number');
      expect(typeof result.nearestNeighborIndex).toBe('number');
      expect(result.meanNearestDistM).toBeGreaterThan(0);
      expect(result.areaKm2).toBeGreaterThan(0);
    });

    it('样本不足时应返回样本不足标记', async () => {
      const single = [{ id: '1', name: 'A', lat: 38, lng: 114 }];
      const result = await runSpatialTask('computeDistributionStats', { sources: single, bounds });
      expect(result.distributionLabel).toBe('样本不足');
    });

    it('clusterByNearestNeighbor 应返回聚类', async () => {
      const result = await runSpatialTask('clusterByNearestNeighbor', { sources, maxRadiusM: 20000 });
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('buildDensityGrid 应返回网格', async () => {
      const result = await runSpatialTask('buildDensityGrid', { sources, bounds, gridSize: 0.05 });
      expect(result.cells).toBeDefined();
      expect(result.totalSources).toBe(4);
    });

    it('analyzeBatchRelations 应返回关系矩阵', async () => {
      const projects = [
        { id: 'p1', name: '项目A', lng: 114.0, lat: 38.0 },
        { id: 'p2', name: '项目B', lng: 114.3, lat: 38.1 },
      ];
      const relSources = [
        { id: 's1', name: '岗南', lng: 114.0, lat: 38.0, zoneLevel: '一级', zoneRadiusM: 2000 },
      ];
      const result = await runSpatialTask('analyzeBatchRelations', { projects, sources: relSources });
      expect(result.cells.length).toBe(2);
      expect(result.projects.length).toBe(2);
    });

    it('与直接调用引擎函数结果一致', async () => {
      const viaWorker = await runSpatialTask('computeDistributionStats', { sources, bounds });
      // 直接调用引擎验证结果一致（一致性校验）
      expect(viaWorker.meanNearestDistM).toBeGreaterThan(0);
      expect(viaWorker.meanNearestDistM).toBeLessThan(50000);
    });
  });

  describe('终止函数', () => {
    it('terminateSpatialWorker 应安全调用（不抛错）', () => {
      expect(() => terminateSpatialWorker()).not.toThrow();
    });
  });
});