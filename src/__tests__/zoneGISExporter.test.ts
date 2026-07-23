import { describe, it, expect } from 'vitest';
import { toGeoJSON, toBatchGeoJSON, toWKT } from '@/lib/zoneGISExporter';
import type { SourceZoneVertices } from '@/lib/zoneCoordGenerator';
import type { ZoneVertex } from '@/lib/zoneCoordGenerator';

// 构造测试用顶点（以114.5, 38.0为中心的小正方形）
function makeVertices(): ZoneVertex[] {
  return [
    { id: 'v', lng: 114.495, lat: 37.995, azimuth: 0 },
    { id: 'v', lng: 114.505, lat: 37.995, azimuth: 0 },
    { id: 'v', lng: 114.505, lat: 38.005, azimuth: 0 },
    { id: 'v', lng: 114.495, lat: 38.005, azimuth: 0 },
  ];
}

const mockSource: SourceZoneVertices = {
  sourceId: 'test-001',
  sourceName: '测试水源地',
  centerLng: 114.5,
  centerLat: 38.0,
  zones: [
    {
      level: '一级',
      method: '经验值法',
      formula: 'r=300m',
      radius: 300,
      area: 0.2827,
      centerLng: 114.5,
      centerLat: 38.0,
      vertices: makeVertices(),
      boundaryDescription: '测试一级保护区',
      keyParams: '半径=300m',
      standard: 'HJ 338-2018',
    },
    {
      level: '二级',
      method: '经验值法',
      formula: 'r=500m',
      radius: 500,
      area: 0.7854,
      centerLng: 114.5,
      centerLat: 38.0,
      vertices: [
        { id: 'v', lng: 114.49, lat: 37.99, azimuth: 0 },
        { id: 'v', lng: 114.51, lat: 37.99, azimuth: 0 },
        { id: 'v', lng: 114.51, lat: 38.01, azimuth: 0 },
        { id: 'v', lng: 114.49, lat: 38.01, azimuth: 0 },
      ],
      boundaryDescription: '测试二级保护区',
      keyParams: '半径=500m',
      standard: 'HJ 338-2018',
    },
  ],
};

describe('zoneGISExporter', () => {
  describe('toGeoJSON', () => {
    it('应生成有效的GeoJSON FeatureCollection', () => {
      const geojson = toGeoJSON(mockSource);
      expect(geojson.type).toBe('FeatureCollection');
      expect(geojson.features.length).toBe(2);
    });

    it('每个Feature应为Polygon类型', () => {
      const geojson = toGeoJSON(mockSource);
      for (const feature of geojson.features) {
        expect(feature.type).toBe('Feature');
        expect(feature.geometry.type).toBe('Polygon');
      }
    });

    it('Polygon坐标环应闭合（首尾相同）', () => {
      const geojson = toGeoJSON(mockSource);
      for (const feature of geojson.features) {
        const ring = feature.geometry.coordinates[0];
        expect(ring[0][0]).toBe(ring[ring.length - 1][0]);
        expect(ring[0][1]).toBe(ring[ring.length - 1][1]);
      }
    });

    it('属性应包含水源地名称和保护区级别', () => {
      const geojson = toGeoJSON(mockSource);
      const f0 = geojson.features[0];
      expect(f0.properties.name).toBe('测试水源地');
      expect(f0.properties.level).toBe('一级');
      expect(f0.properties.method).toBe('经验值法');
      expect(f0.properties.area_km2).toBeGreaterThan(0);
    });

    it('属性应包含中心坐标', () => {
      const geojson = toGeoJSON(mockSource);
      const f0 = geojson.features[0];
      expect(f0.properties.centerLng).toBe(114.5);
      expect(f0.properties.centerLat).toBe(38.0);
    });

    it('坐标应为[lng, lat]格式', () => {
      const geojson = toGeoJSON(mockSource);
      const ring = geojson.features[0].geometry.coordinates[0];
      // 114.5附近是经度，38.0附近是纬度
      expect(ring[0][0]).toBeCloseTo(114.495, 3); // lng
      expect(ring[0][1]).toBeCloseTo(37.995, 3); // lat
    });
  });

  describe('toBatchGeoJSON', () => {
    it('应合并多个水源地的Feature', () => {
      const sources = [
        mockSource,
        { ...mockSource, sourceId: 'test-002', sourceName: '第二个水源地' },
      ];
      const geojson = toBatchGeoJSON(sources);
      expect(geojson.features.length).toBe(4); // 2 sources × 2 zones
    });

    it('空数组应返回空FeatureCollection', () => {
      const geojson = toBatchGeoJSON([]);
      expect(geojson.type).toBe('FeatureCollection');
      expect(geojson.features.length).toBe(0);
    });
  });

  describe('toWKT', () => {
    it('应生成WKT POLYGON格式', () => {
      const wkt = toWKT(makeVertices());
      expect(wkt).toMatch(/^POLYGON\(\(/);
      expect(wkt).toMatch(/\)\)$/);
    });

    it('WKT应包含所有顶点坐标', () => {
      const vertices = makeVertices();
      const wkt = toWKT(vertices);
      for (const v of vertices) {
        expect(wkt).toContain(String(v.lng));
        expect(wkt).toContain(String(v.lat));
      }
    });

    it('WKT应闭合（首尾坐标相同）', () => {
      const vertices = makeVertices();
      const wkt = toWKT(vertices);
      // 提取第一个和最后一个坐标点
      const coordsStr = wkt.replace(/^POLYGON\(\(/, '').replace(/\)\)$/, '');
      const coords = coordsStr.split(', ');
      expect(coords[0]).toBe(coords[coords.length - 1]);
    });

    it('少于3个顶点应返回空字符串', () => {
      expect(toWKT([])).toBe('');
      expect(toWKT([{ id: 'v', lng: 1, lat: 2, azimuth: 0 }])).toBe('');
    });
  });
});
