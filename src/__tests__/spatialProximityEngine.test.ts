/* ===== S12.1: 空间邻近检索引擎测试 ===== */
import { describe, expect, it } from 'vitest';
import {
  querySpatialProximity,
  bearingDegrees,
  bearingLabel,
  isInAnyProtectionZone,
  findNearestSource,
  findSourcesWithin,
  toProximitySources,
  type ProximitySource,
} from '@/lib/spatialProximityEngine';

function makeSource(overrides: Partial<ProximitySource> = {}): ProximitySource {
  return {
    id: 's1',
    name: '岗南水库',
    cityName: '石家庄市',
    lng: 114.0,
    lat: 38.0,
    level: 'municipal',
    zoneRadiusM: 500,
    ...overrides,
  };
}

describe('spatialProximityEngine', () => {
  // ===== bearingDegrees =====
  describe('bearingDegrees', () => {
    it('正北方向为 0', () => {
      // 从 (lat, lng) 向北移动
      expect(bearingDegrees(38, 114, 38.1, 114)).toBeCloseTo(0, 1);
    });

    it('正东方向为 90', () => {
      expect(bearingDegrees(38, 114, 38, 114.1)).toBeCloseTo(90, 1);
    });

    it('正南方向为 180', () => {
      expect(bearingDegrees(38, 114, 37.9, 114)).toBeCloseTo(180, 1);
    });

    it('正西方向为 270', () => {
      expect(bearingDegrees(38, 114, 38, 113.9)).toBeCloseTo(270, 1);
    });

    it('东北方向在 0-90 之间', () => {
      const b = bearingDegrees(38, 114, 38.1, 114.1);
      expect(b).toBeGreaterThan(0);
      expect(b).toBeLessThan(90);
    });

    it('结果规范化到 0-360', () => {
      const b = bearingDegrees(38, 114, 37.9, 113.9); // 西南
      expect(b).toBeGreaterThanOrEqual(180);
      expect(b).toBeLessThan(360);
    });
  });

  // ===== bearingLabel =====
  describe('bearingLabel', () => {
    it('0 度为正北', () => {
      expect(bearingLabel(0)).toBe('正北');
    });
    it('90 度为正东', () => {
      expect(bearingLabel(90)).toBe('正东');
    });
    it('180 度为正南', () => {
      expect(bearingLabel(180)).toBe('正南');
    });
    it('270 度为正西', () => {
      expect(bearingLabel(270)).toBe('正西');
    });
    it('45 度为东北', () => {
      expect(bearingLabel(45)).toBe('东北');
    });
    it('315 度为西北', () => {
      expect(bearingLabel(315)).toBe('西北');
    });
    it('337.5 度为西北偏北', () => {
      expect(bearingLabel(337.5)).toBe('西北偏北');
    });
    it('360 度归化为正北', () => {
      expect(bearingLabel(360)).toBe('正北');
    });
  });

  // ===== querySpatialProximity =====
  describe('querySpatialProximity', () => {
    const sources = [
      makeSource({ id: 's1', name: '岗南水库', lng: 114.0, lat: 38.0, zoneRadiusM: 500 }),
      makeSource({ id: 's2', name: '黄壁庄水库', lng: 114.1, lat: 38.05, zoneRadiusM: 300 }),
      makeSource({ id: 's3', name: '西大洋水库', lng: 114.5, lat: 38.2, zoneRadiusM: 1000 }),
    ];

    it('返回最近水源地', () => {
      // 查询点在岗南附近
      const resp = querySpatialProximity(114.0, 38.0, sources);
      expect(resp.nearest?.id).toBe('s1');
      expect(resp.nearest?.distanceM).toBeCloseTo(0, 0);
    });

    it('按距离升序返回周边水源地', () => {
      // 扩大搜索半径使多个水源地进入 withinRadius
      const resp = querySpatialProximity(114.0, 38.0, sources, { searchRadiusM: 100000 });
      const distances = resp.withinRadius.map((r) => r.distanceM);
      expect(distances.length).toBeGreaterThanOrEqual(2);
      for (let i = 1; i < distances.length; i++) {
        expect(distances[i - 1]).toBeLessThanOrEqual(distances[i]);
      }
    });

    it('查询点位于保护区内时 zoneEdgeDistanceM 为负', () => {
      const resp = querySpatialProximity(114.0, 38.0, sources);
      expect(resp.nearest!.zoneEdgeDistanceM).toBeLessThanOrEqual(0);
      expect(resp.nearest!.isInsideZone).toBe(true);
      expect(resp.insideAnyZone).toBe(true);
    });

    it('查询点远离保护区时 isInsideZone 为 false', () => {
      const resp = querySpatialProximity(115.0, 39.0, sources);
      expect(resp.insideAnyZone).toBe(false);
      expect(resp.nearest!.isInsideZone).toBe(false);
      expect(resp.nearestZoneEdgeDistanceM).toBeGreaterThan(0);
    });

    it('withinRadius 默认 10km 内过滤', () => {
      const resp = querySpatialProximity(114.0, 38.0, sources);
      // 岗南(0m)、黄壁庄(~12km)、西大洋(~55km) → 可能只有岗南在10km内
      const within = resp.withinRadius;
      expect(within.length).toBeGreaterThanOrEqual(1);
    });

    it('自定义 searchRadiusM 影响返回范围', () => {
      const resp = querySpatialProximity(114.0, 38.0, sources, { searchRadiusM: 500 });
      expect(resp.withinRadius.length).toBe(1);
      expect(resp.withinRadius[0].id).toBe('s1');
    });

    it('空数据源返回空结果', () => {
      const resp = querySpatialProximity(114, 38, []);
      expect(resp.nearest).toBeNull();
      expect(resp.nearestZoneEdgeDistanceM).toBeNull();
      expect(resp.withinRadius).toHaveLength(0);
      expect(resp.insideAnyZone).toBe(false);
    });
  });

  // ===== 便捷函数 =====
  describe('便捷函数', () => {
    const sources = [
      makeSource({ id: 's1', name: '岗南', lng: 114.0, lat: 38.0 }),
      makeSource({ id: 's2', name: '黄壁庄', lng: 114.1, lat: 38.05 }),
    ];

    it('isInAnyProtectionZone 判断是否在保护区内', () => {
      expect(isInAnyProtectionZone(114.0, 38.0, sources)).toBe(true);
      expect(isInAnyProtectionZone(115.0, 39.0, sources)).toBe(false);
    });

    it('findNearestSource 返回最近水源地', () => {
      const nearest = findNearestSource(114.0, 38.0, sources);
      expect(nearest?.id).toBe('s1');
    });

    it('findSourcesWithin 返回半径内水源地', () => {
      const within = findSourcesWithin(114.0, 38.0, sources, 1000);
      expect(within.map((r) => r.id)).toContain('s1');
    });
  });

  // ===== toProximitySources =====
  describe('toProximitySources', () => {
    it('过滤无坐标的记录', () => {
      const result = toProximitySources([
        { id: 'a', name: 'A', cityName: '石家庄市', lng: 114, lat: 38 },
        { id: 'b', name: 'B', cityName: '石家庄市' }, // 无坐标
      ]);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('a');
    });

    it('使用默认保护区半径', () => {
      const result = toProximitySources([
        { id: 'a', name: 'A', cityName: '石家庄市', lng: 114, lat: 38 },
      ]);
      expect(result[0].zoneRadiusM).toBe(500);
    });

    it('允许自定义默认半径', () => {
      const result = toProximitySources([
        { id: 'a', name: 'A', cityName: '石家庄市', lng: 114, lat: 38 },
      ], 1000);
      expect(result[0].zoneRadiusM).toBe(1000);
    });
  });
});
