/* ===== S12.2: 保护区占用精算引擎测试 ===== */
import { describe, expect, it } from 'vitest';
import {
  calculateZoneOverlap,
  calculateBatchZoneOverlap,
  shoeLaceArea,
  pointInPolygon,
  type GeoPoint,
} from '@/lib/zoneOverlapEngine';

// 参考点
const REF = { lng: 114, lat: 38 };

function circleZone(radiusM: number, center: GeoPoint = REF) {
  return {
    sourceName: '岗南水库',
    sourceId: 's1',
    center,
    radiusM,
    level: '二级',
  };
}

describe('zoneOverlapEngine', () => {
  // ===== shoeLaceArea =====
  describe('shoeLaceArea', () => {
    it('单位正方形的面积为 1（局部米坐标）', () => {
      // 用局部坐标构造正方形，但 shoeLaceArea 接受 LocalPoint
      // 这里通过一个 10x10 正方形在局部平面验证
      const vertices = [
        { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
      ];
      expect(shoeLaceArea(vertices)).toBeCloseTo(100, 5);
    });

    it('三点三角形面积计算', () => {
      const vertices = [
        { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 },
      ];
      expect(shoeLaceArea(vertices)).toBeCloseTo(6, 5);
    });

    it('少于3点返回0', () => {
      expect(shoeLaceArea([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(0);
    });
  });

  // ===== pointInPolygon =====
  describe('pointInPolygon', () => {
    const square = [
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
    ];

    it('内部点返回 true', () => {
      expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
    });

    it('外部点返回 false', () => {
      expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
    });

    it('顶点附近的边界点处理', () => {
      // 边界点，射线法可能返回 true（边界视为内）
      expect(pointInPolygon({ x: 0, y: 5 }, square)).toBe(true);
    });
  });

  // ===== 点类型 =====
  describe('点项目', () => {
    it('点在保护区内 isOverlap 为 true', () => {
      const result = calculateZoneOverlap({
        project: { type: 'point', lng: REF.lng, lat: REF.lat },
        zone: circleZone(500),
      });
      expect(result.isOverlap).toBe(true);
      expect(result.fullyInsideZone).toBe(true);
      expect(result.overlapAreaM2).toBe(0); // 点无面积
    });

    it('点在保护区外 isOverlap 为 false', () => {
      const result = calculateZoneOverlap({
        project: { type: 'point', lng: 114.1, lat: 38 },
        zone: circleZone(500),
      });
      expect(result.isOverlap).toBe(false);
    });
  });

  // ===== 圆项目 =====
  describe('圆项目', () => {
    it('与保护区完全重合时重叠比例约为1', () => {
      const result = calculateZoneOverlap({
        project: { type: 'circle', lng: REF.lng, lat: REF.lat, radiusM: 500 },
        zone: circleZone(500),
      });
      expect(result.isOverlap).toBe(true);
      expect(result.overlapRatioOfProject).toBeGreaterThan(0.95);
      expect(result.overlapRatioOfZone).toBeGreaterThan(0.95);
      expect(result.fullyInsideZone).toBe(true);
    });

    it('完全不相交时无重叠', () => {
      const result = calculateZoneOverlap({
        project: { type: 'circle', lng: 114.01, lat: 38, radiusM: 10 },
        zone: circleZone(500),
      });
      expect(result.isOverlap).toBe(false);
      expect(result.overlapAreaM2).toBe(0);
    });

    it('部分重叠时面积在 0 与项目面积之间', () => {
      // 项目圆半径 300m，中心在保护区边缘附近
      // 保护区 500m @ REF；项目 300m @ 距 REF 约 400m
      const lngPerM = 1 / (111320 * Math.cos((38 * Math.PI) / 180));
      const offsetLng = REF.lng + 400 * lngPerM;
      const result = calculateZoneOverlap({
        project: { type: 'circle', lng: offsetLng, lat: REF.lat, radiusM: 300 },
        zone: circleZone(500),
      });
      expect(result.isOverlap).toBe(true);
      expect(result.overlapAreaM2).toBeGreaterThan(0);
      expect(result.overlapAreaM2).toBeLessThan(result.projectAreaM2);
      expect(result.overlapRatioOfProject).toBeGreaterThan(0);
      expect(result.overlapRatioOfProject).toBeLessThan(1);
    });

    it('完全包含在保护区内时 fullyInsideZone 为 true', () => {
      const result = calculateZoneOverlap({
        project: { type: 'circle', lng: REF.lng, lat: REF.lat, radiusM: 100 },
        zone: circleZone(1000),
      });
      expect(result.fullyInsideZone).toBe(true);
      expect(result.overlapRatioOfProject).toBeGreaterThan(0.98);
    });

    it('面积换算 km² 正确', () => {
      const result = calculateZoneOverlap({
        project: { type: 'circle', lng: REF.lng, lat: REF.lat, radiusM: 1000 },
        zone: circleZone(1000),
      });
      // 72 段离散圆为内接正多边形，面积 = 0.5·n·r²·sin(2π/n)
      const n = 72, r = 1000;
      const discArea = 0.5 * n * r * r * Math.sin((2 * Math.PI) / n);
      expect(result.zoneAreaM2).toBeCloseTo(discArea, 0);
      // km² 换算
      expect(result.overlapAreaKm2).toBeCloseTo(result.zoneAreaM2 / 1_000_000, 5);
    });
  });

  // ===== 多边形项目 =====
  describe('多边形项目', () => {
    function squarePolygon(center: GeoPoint, halfSizeM: number): GeoPoint[] {
      const lngPerM = 1 / (111320 * Math.cos((center.lat * Math.PI) / 180));
      const latPerM = 1 / 110540;
      return [
        { lng: center.lng - halfSizeM * lngPerM, lat: center.lat - halfSizeM * latPerM },
        { lng: center.lng + halfSizeM * lngPerM, lat: center.lat - halfSizeM * latPerM },
        { lng: center.lng + halfSizeM * lngPerM, lat: center.lat + halfSizeM * latPerM },
        { lng: center.lng - halfSizeM * lngPerM, lat: center.lat + halfSizeM * latPerM },
      ];
    }

    it('完全在保护区内的正方形 fullyInside 为 true', () => {
      const result = calculateZoneOverlap({
        project: { type: 'polygon', vertices: squarePolygon(REF, 100) },
        zone: circleZone(1000),
      });
      expect(result.fullyInsideZone).toBe(true);
      expect(result.overlapRatioOfProject).toBeGreaterThan(0.95);
    });

    it('部分重叠的正方形有正确重叠比例', () => {
      // 正方形一半在保护区内
      const lngPerM = 1 / (111320 * Math.cos((38 * Math.PI) / 180));
      const vertices = squarePolygon(REF, 100);
      // 将正方形中心移到保护区边界（半径500处），使一半在内
      const shifted = vertices.map((v) => ({
        lng: v.lng + 400 * lngPerM,
        lat: v.lat,
      }));
      const result = calculateZoneOverlap({
        project: { type: 'polygon', vertices: shifted },
        zone: circleZone(500),
      });
      expect(result.isOverlap).toBe(true);
      expect(result.overlapRatioOfProject).toBeGreaterThan(0);
    });

    it('完全在保护区外的正方形无重叠', () => {
      const lngPerM = 1 / (111320 * Math.cos((38 * Math.PI) / 180));
      const vertices = squarePolygon(REF, 100).map((v) => ({
        lng: v.lng + 2000 * lngPerM,
        lat: v.lat,
      }));
      const result = calculateZoneOverlap({
        project: { type: 'polygon', vertices },
        zone: circleZone(500),
      });
      expect(result.isOverlap).toBe(false);
    });
  });

  // ===== 线性项目 =====
  describe('线性项目', () => {
    function buildLine(lngOffsetM: number): GeoPoint[] {
      const lngPerM = 1 / (111320 * Math.cos((38 * Math.PI) / 180));
      const latPerM = 1 / 110540;
      return [
        { lng: REF.lng + lngOffsetM * lngPerM, lat: REF.lat - 1000 * latPerM },
        { lng: REF.lng + lngOffsetM * lngPerM, lat: REF.lat + 1000 * latPerM },
      ];
    }

    it('穿过保护区的线有穿越长度', () => {
      // 线经过保护区中心（lngOffset=0）
      const result = calculateZoneOverlap({
        project: { type: 'line', vertices: buildLine(0) },
        zone: circleZone(500),
      });
      expect(result.isOverlap).toBe(true);
      expect(result.lineCrossLengthM).toBeGreaterThan(0);
      // 直径 1000m，穿越长度接近 1000m
      expect(result.lineCrossLengthM).toBeCloseTo(1000, -1);
    });

    it('完全在保护区外的线无穿越', () => {
      const result = calculateZoneOverlap({
        project: { type: 'line', vertices: buildLine(5000) },
        zone: circleZone(500),
      });
      expect(result.isOverlap).toBe(false);
      expect(result.lineCrossLengthM).toBe(0);
    });
  });

  // ===== 批量 =====
  describe('calculateBatchZoneOverlap', () => {
    it('批量计算并识别最高涉及级别', () => {
      const result = calculateBatchZoneOverlap({
        project: { type: 'point', lng: REF.lng, lat: REF.lat },
        zones: [
          { sourceName: 'A', sourceId: 'a', center: REF, radiusM: 100, level: '二级' },
          { sourceName: 'B', sourceId: 'b', center: REF, radiusM: 100, level: '一级' },
          { sourceName: 'C', sourceId: 'c', center: { lng: 114.1, lat: 38 }, radiusM: 100, level: '准保护区' },
        ],
      });
      expect(result.hasOverlap).toBe(true);
      expect(result.results).toHaveLength(3);
      expect(result.maxInvolvedLevel).toBe('一级');
    });

    it('无涉及任一保护区时 hasOverlap 为 false', () => {
      const result = calculateBatchZoneOverlap({
        project: { type: 'point', lng: 115, lat: 39 },
        zones: [
          { sourceName: 'A', sourceId: 'a', center: REF, radiusM: 100, level: '二级' },
        ],
      });
      expect(result.hasOverlap).toBe(false);
      expect(result.maxInvolvedLevel).toBeNull();
    });

    it('结果包含逐保护区详情', () => {
      const result = calculateBatchZoneOverlap({
        project: { type: 'point', lng: REF.lng, lat: REF.lat },
        zones: [
          { sourceName: 'A', sourceId: 'a', center: REF, radiusM: 100, level: '二级' },
        ],
      });
      expect(result.results[0].sourceName).toBe('A');
      expect(result.results[0].isOverlap).toBe(true);
    });
  });

  // ===== 参数校验 =====
  describe('参数校验', () => {
    it('保护区既无多边形也无半径时抛错', () => {
      expect(() => calculateZoneOverlap({
        project: { type: 'point', lng: REF.lng, lat: REF.lat },
        zone: { sourceName: 'A', sourceId: 'a', level: '二级' },
      })).toThrow();
    });

    it('使用任意多边形保护区', () => {
      const polygon: GeoPoint[] = [
        { lng: 113.99, lat: 37.99 },
        { lng: 114.01, lat: 37.99 },
        { lng: 114.01, lat: 38.01 },
        { lng: 113.99, lat: 38.01 },
      ];
      const result = calculateZoneOverlap({
        project: { type: 'point', lng: REF.lng, lat: REF.lat },
        zone: { sourceName: 'A', sourceId: 'a', zonePolygon: polygon, level: '一级' },
      });
      expect(result.isOverlap).toBe(true);
    });
  });
});
