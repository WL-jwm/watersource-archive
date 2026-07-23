import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as turf from '@turf/turf';
import type { Feature, MultiPolygon } from 'geojson';

// Mock turf — 使用 vi.fn 以便在测试中控制返回值
vi.mock('@turf/turf', () => ({
  point: vi.fn((coords: number[]) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: coords } })),
  polygon: vi.fn((ring: number[][]) => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] } })),
  multiPolygon: vi.fn((coords: number[][][][]) => ({ type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: coords } })),
  feature: vi.fn((geom: any, props: any) => ({ type: 'Feature', geometry: geom, properties: props })),
  area: vi.fn(() => 1000000),
  booleanPointInPolygon: vi.fn(() => false),
  intersect: vi.fn(() => null),
}));

import {
  findCityByPoint,
  summarizeClipResults,
  findCityBoundary,
  type SourceClipResult,
} from '@/lib/zoneClipEngine';

// 构造模拟的城市边界
function makeMockBoundaries(): Feature<MultiPolygon>[] {
  return [
    {
      type: 'Feature',
      geometry: { type: 'MultiPolygon', coordinates: [[[[114.0, 38.0], [115.0, 38.0], [115.0, 39.0], [114.0, 39.0], [114.0, 38.0]]]] },
      properties: { name: '石家庄市' },
    },
    {
      type: 'Feature',
      geometry: { type: 'MultiPolygon', coordinates: [[[[118.0, 39.0], [119.0, 39.0], [119.0, 40.0], [118.0, 40.0], [118.0, 39.0]]]] },
      properties: { name: '唐山市' },
    },
  ];
}

describe('zoneClipEngine - 行政区划裁剪', () => {
  describe('findCityBoundary', () => {
    it('T01-精确匹配城市名', () => {
      const boundaries = makeMockBoundaries();
      const result = findCityBoundary(boundaries, '石家庄市');
      expect(result).not.toBeNull();
      expect((result!.properties as Record<string, unknown>).name).toBe('石家庄市');
    });

    it('T02-模糊匹配去市后缀', () => {
      const boundaries = makeMockBoundaries();
      const result = findCityBoundary(boundaries, '石家庄');
      expect(result).not.toBeNull();
    });

    it('T03-不存在城市返回null', () => {
      const boundaries = makeMockBoundaries();
      const result = findCityBoundary(boundaries, '北京市');
      expect(result).toBeNull();
    });
  });

  describe('findCityByPoint', () => {
    it('T04-点在城市内返回城市名', () => {
      const boundaries = makeMockBoundaries();
      vi.mocked(turf.booleanPointInPolygon).mockReturnValueOnce(true);
      const result = findCityByPoint(boundaries, 114.5, 38.5);
      expect(result).toBe('石家庄市');
    });

    it('T05-点不在任何城市返回未知', () => {
      const boundaries = makeMockBoundaries();
      vi.mocked(turf.booleanPointInPolygon).mockReturnValue(false);
      const result = findCityByPoint(boundaries, 100, 35);
      expect(result).toBe('未知');
    });
  });

  describe('summarizeClipResults', () => {
    it('T06-汇总无裁剪结果', () => {
      const results: SourceClipResult[] = [
        {
          sourceName: '岗南水库',
          sourceId: 's1',
          cityName: '石家庄市',
          zones: [
            { sourceName: '岗南水库', cityName: '石家庄市', level: '一级', originalArea: 0.5, clippedArea: 0.5, clipRatio: 1, clippedCoordinates: [], isClipped: false },
            { sourceName: '岗南水库', cityName: '石家庄市', level: '二级', originalArea: 2.0, clippedArea: 2.0, clipRatio: 1, clippedCoordinates: [], isClipped: false },
          ],
        },
      ];
      const summary = summarizeClipResults(results);
      expect(summary.totalSources).toBe(1);
      expect(summary.clippedSources).toBe(0);
      expect(summary.totalOriginalArea).toBe(2.5);
      expect(summary.totalClippedArea).toBe(2.5);
      expect(summary.totalReduction).toBe(0);
      expect(summary.reductionPct).toBe(0);
    });

    it('T07-汇总有裁剪结果', () => {
      const results: SourceClipResult[] = [
        {
          sourceName: '岗南水库',
          sourceId: 's1',
          cityName: '石家庄市',
          zones: [
            { sourceName: '岗南水库', cityName: '石家庄市', level: '一级', originalArea: 1.0, clippedArea: 0.8, clipRatio: 0.8, clippedCoordinates: [], isClipped: true },
            { sourceName: '岗南水库', cityName: '石家庄市', level: '二级', originalArea: 3.0, clippedArea: 2.5, clipRatio: 0.833, clippedCoordinates: [], isClipped: true },
          ],
        },
        {
          sourceName: '陡河水库',
          sourceId: 's2',
          cityName: '唐山市',
          zones: [
            { sourceName: '陡河水库', cityName: '唐山市', level: '一级', originalArea: 0.5, clippedArea: 0.5, clipRatio: 1, clippedCoordinates: [], isClipped: false },
          ],
        },
      ];
      const summary = summarizeClipResults(results);
      expect(summary.totalSources).toBe(2);
      expect(summary.clippedSources).toBe(1);
      expect(summary.totalOriginalArea).toBe(4.5);
      expect(summary.totalClippedArea).toBe(3.8);
      expect(summary.totalReduction).toBe(0.7);
      expect(summary.reductionPct).toBe(15.56);
    });

    it('T08-按城市分组统计', () => {
      const results: SourceClipResult[] = [
        {
          sourceName: '岗南水库',
          sourceId: 's1',
          cityName: '石家庄市',
          zones: [
            { sourceName: '岗南水库', cityName: '石家庄市', level: '一级', originalArea: 1.0, clippedArea: 0.9, clipRatio: 0.9, clippedCoordinates: [], isClipped: true },
          ],
        },
        {
          sourceName: '黄壁庄水库',
          sourceId: 's2',
          cityName: '石家庄市',
          zones: [
            { sourceName: '黄壁庄水库', cityName: '石家庄市', level: '一级', originalArea: 2.0, clippedArea: 1.8, clipRatio: 0.9, clippedCoordinates: [], isClipped: true },
          ],
        },
        {
          sourceName: '陡河水库',
          sourceId: 's3',
          cityName: '唐山市',
          zones: [
            { sourceName: '陡河水库', cityName: '唐山市', level: '一级', originalArea: 1.5, clippedArea: 1.5, clipRatio: 1, clippedCoordinates: [], isClipped: false },
          ],
        },
      ];
      const summary = summarizeClipResults(results);
      expect(summary.byCity).toHaveLength(2);
      const sjz = summary.byCity.find((c) => c.city === '石家庄市')!;
      expect(sjz.original).toBe(3.0);
      expect(sjz.clipped).toBe(2.7);
      expect(sjz.reduction).toBe(0.3);
    });

    it('T09-空结果汇总', () => {
      const summary = summarizeClipResults([]);
      expect(summary.totalSources).toBe(0);
      expect(summary.totalOriginalArea).toBe(0);
      expect(summary.reductionPct).toBe(0);
      expect(summary.byCity).toHaveLength(0);
    });
  });
});
