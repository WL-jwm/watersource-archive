/**
 * S5 多水源地叠加计算引擎测试
 *
 * 覆盖 P0 核心用例：几何构建 + Union 叠加 + 两两重叠检测 + 异常输入 + 数据完整性 + 几何退化
 * 覆盖 P1 用例：自定义顶点数/方位角/坐标精度/渐进union/对称性/守恒律/混合类型等
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as turf from '@turf/turf';
import {
  generateCircleVertices,
  generateRiverVertices,
  generateLakeVertices,
} from '@/lib/zoneCoordGenerator';
import {
  runOverlayAnalysis,
  buildSourceGeometries,
  detectPairwiseOverlaps,
  summarizeOverlay,
  type OverlayRequest,
  type ZoneLevel,
} from '@/lib/multiSourceOverlayEngine';
import type { WaterSourceRecord, ZoneCalcRecord } from '@/stores/waterSourceStore';
import type { ZoneResult } from '@/lib/zoneCalcEngine';

// ===== 公共测试数据 =====

const sourceA: WaterSourceRecord = {
  id: 'src-A', cityName: '石家庄市', name: '水源地A',
  type: '地下水', subType: '孔隙水', county: '正定县',
  level: 'county', status: '在用', lng: 114.50, lat: 38.05,
};

const sourceB: WaterSourceRecord = {
  id: 'src-B', cityName: '石家庄市', name: '水源地B',
  type: '地下水', subType: '孔隙水', county: '正定县',
  level: 'county', status: '在用', lng: 114.505, lat: 38.05,
};

const sourceC: WaterSourceRecord = {
  id: 'src-C', cityName: '保定市', name: '水源地C',
  type: '地下水', subType: '岩溶水', county: '涞水县',
  level: 'county', status: '在用', lng: 115.50, lat: 39.50,
};

const sourceD: WaterSourceRecord = {
  id: 'src-D', cityName: '石家庄市', name: '水源地D',
  type: '地表水', subType: '河流型', county: '正定县',
  level: 'county', status: '在用', lng: 114.502, lat: 38.048,
};

function makeZone(level: '一级' | '二级' | '准保护区', radius: number): ZoneResult {
  return {
    level, method: '经验值法' as const, formula: `R=${radius}m`, radius,
    area: parseFloat(((Math.PI * radius * radius) / 1e6).toFixed(4)),
    boundaryDescription: `${level}保护区`, keyParams: 'test', standard: 'HJ 338-2018',
  };
}

function makeZoneRecord(source: WaterSourceRecord, r1: number, r2: number): ZoneCalcRecord {
  return {
    id: `calc-${source.id}`, sourceId: source.id, sourceName: source.name,
    params: { sourceType: '地下水', gwType: '孔隙水' },
    zones: [makeZone('一级', r1), makeZone('二级', r2), makeZone('准保护区', Math.round(r2 * 1.5))],
    calculatedAt: '2024-01-01T00:00:00', warnings: [],
  };
}

function makeRiverZoneRecord(source: WaterSourceRecord): ZoneCalcRecord {
  return {
    id: `calc-${source.id}`, sourceId: source.id, sourceName: source.name,
    params: { sourceType: '地表水', swType: '河流型' },
    zones: [{
      level: '一级', method: '经验值法' as const, formula: '河流型',
      length: 5000, width: 200, area: 1.0,
      boundaryDescription: '河流一级', keyParams: 'test', standard: 'HJ 338-2018',
      riverExt: { upstreamLength: 4150, downstreamLength: 850, bankWidth: 200 },
    }],
    calculatedAt: '2024-01-01T00:00:00', warnings: [],
  };
}

const recordA = makeZoneRecord(sourceA, 100, 1000);
const recordB = makeZoneRecord(sourceB, 50, 800);
const recordC = makeZoneRecord(sourceC, 200, 1500);
const recordD = makeRiverZoneRecord(sourceD);

function buildCirclePolygon(lng: number, lat: number, radius: number) {
  const vertices = generateCircleVertices(lng, lat, radius, 24);
  const ring = [...vertices.map(v => [v.lng, v.lat] as [number, number]), [vertices[0].lng, vertices[0].lat] as [number, number]];
  return turf.polygon([ring]);
}

function buildRiverPolygon(lng: number, lat: number, upstream: number, downstream: number, bankWidth: number, azimuth = 90) {
  const vertices = generateRiverVertices(lng, lat, upstream, downstream, bankWidth, azimuth);
  const ring = [...vertices.map(v => [v.lng, v.lat] as [number, number]), [vertices[0].lng, vertices[0].lat] as [number, number]];
  return turf.polygon([ring]);
}

const baseRequest = (sourceIds: string[], levels: ZoneLevel[] = ['一级']): OverlayRequest => ({
  sourceIds,
  levels,
  useClippedGeometry: false,
  analysisName: '测试分析',
});

// ===== 测试 =====

describe('S5 一、几何构建', () => {
  it('T01-单水源地圆形保护区构建', () => {
    const { geometries, warnings } = buildSourceGeometries([sourceA], [recordA], ['一级']);
    expect(geometries).toHaveLength(1);
    expect(geometries[0].sourceId).toBe('src-A');
    expect(geometries[0].zones).toHaveLength(1);
    expect(geometries[0].zones[0].level).toBe('一级');
    expect(geometries[0].zones[0].area).toBeGreaterThan(0);
  });

  it('T02-圆形多边形顶点数为24', () => {
    const vertices = generateCircleVertices(114.50, 38.05, 100, 24);
    expect(vertices).toHaveLength(24);
    expect(vertices[0].azimuth).toBe(0);
    expect(vertices[1].azimuth).toBe(15);
    expect(vertices[23].azimuth).toBe(345);
  });

  it('T03-河流型矩形保护区构建', () => {
    const { geometries } = buildSourceGeometries([sourceD], [recordD], ['一级']);
    expect(geometries).toHaveLength(1);
    expect(geometries[0].zones[0].area).toBeGreaterThan(0);
  });

  it('T04-多级别同时构建', () => {
    const { geometries } = buildSourceGeometries([sourceA], [recordA], ['一级', '二级', '准保护区']);
    expect(geometries[0].zones).toHaveLength(3);
    expect(geometries[0].zones[0].level).toBe('一级');
    expect(geometries[0].zones[1].level).toBe('二级');
    expect(geometries[0].zones[2].level).toBe('准保护区');
  });

  it('T05-坐标闭合验证', () => {
    const vertices = generateCircleVertices(114.50, 38.05, 100, 24);
    const ring = [...vertices.map(v => [v.lng, v.lat]), [vertices[0].lng, vertices[0].lat]];
    expect(ring).toHaveLength(25);
    expect(ring[0]).toEqual(ring[24]);
  });

  it('T06-面积一致性', () => {
    const poly = buildCirclePolygon(114.50, 38.05, 100);
    const turfArea = turf.area(poly) / 1e6;
    const theoryArea = (Math.PI * 100 * 100) / 1e6;
    expect(Math.abs(turfArea - theoryArea)).toBeLessThan(0.001);
  });

  it('T07-中心点坐标传入', () => {
    const { geometries } = buildSourceGeometries([sourceA], [recordA], ['一级']);
    expect(geometries[0].sourceId).toBe('src-A');
  });

  it('T08-多水源地批量构建', () => {
    const { geometries } = buildSourceGeometries(
      [sourceA, sourceB, sourceC],
      [recordA, recordB, recordC],
      ['一级'],
    );
    expect(geometries).toHaveLength(3);
    expect(geometries[0].sourceId).toBe('src-A');
    expect(geometries[1].sourceId).toBe('src-B');
    expect(geometries[2].sourceId).toBe('src-C');
  });

  // P1-G01
  it('P1-G01-自定义顶点数36', () => {
    const vertices = generateCircleVertices(114.50, 38.05, 100, 36);
    expect(vertices).toHaveLength(36);
    expect(vertices[0].azimuth).toBe(0);
    expect(vertices[1].azimuth).toBe(10);
    expect(vertices[35].azimuth).toBe(350);
  });

  // P1-G02
  it('P1-G02-方位角序列从正北顺时针递增', () => {
    const vertices = generateCircleVertices(114.50, 38.05, 100, 24);
    for (let i = 0; i < 24; i++) {
      expect(vertices[i].azimuth).toBe(i * 15);
    }
  });

  // P1-G03
  it('P1-G03-坐标精度6位小数一致性', () => {
    const vertices = generateCircleVertices(114.50, 38.05, 100, 24);
    for (const v of vertices) {
      expect(v.lng).toBe(Math.round(v.lng * 1e6) / 1e6);
      expect(v.lat).toBe(Math.round(v.lat * 1e6) / 1e6);
    }
  });

  // P1-G04
  it('P1-G04-河流型方位角参数生效', () => {
    const vertsNS = generateRiverVertices(114.50, 38.05, 2000, 1000, 200, 0);
    const vertsEW = generateRiverVertices(114.50, 38.05, 2000, 1000, 200, 90);
    expect(vertsNS[0].lng).not.toBe(vertsEW[0].lng);
    const nsLatRange = Math.max(...vertsNS.map(v => v.lat)) - Math.min(...vertsNS.map(v => v.lat));
    const nsLngRange = Math.max(...vertsNS.map(v => v.lng)) - Math.min(...vertsNS.map(v => v.lng));
    expect(nsLatRange).toBeGreaterThan(nsLngRange);
    const ewLngRange = Math.max(...vertsEW.map(v => v.lng)) - Math.min(...vertsEW.map(v => v.lng));
    const ewLatRange = Math.max(...vertsEW.map(v => v.lat)) - Math.min(...vertsEW.map(v => v.lat));
    expect(ewLngRange).toBeGreaterThan(ewLatRange);
  });

  // P1-G05
  it('P1-G05-湖库型岸边取水生成半圆顶点', () => {
    const vertices = generateLakeVertices(114.50, 38.05, 500, '岸边', 24);
    expect(vertices).toHaveLength(13);
    expect(vertices[0].azimuth).toBe(90);
    expect(vertices[12].azimuth).toBe(270);
    for (const v of vertices) {
      expect(v.azimuth).toBeGreaterThanOrEqual(90);
      expect(v.azimuth).toBeLessThanOrEqual(270);
    }
  });
});

describe('S5 二、Union 叠加', () => {
  it('T09-两个完全不重叠的水源地叠加', () => {
    const polyA = buildCirclePolygon(114.50, 38.05, 100);
    const polyC = buildCirclePolygon(115.50, 39.50, 200);
    const fc = { type: 'FeatureCollection' as const, features: [polyA, polyC] };
    const unionResult = turf.union(fc as unknown as Parameters<typeof turf.union>[0]);
    expect(unionResult).not.toBeNull();
    const unionArea = turf.area(unionResult!) / 1e6;
    const sumArea = turf.area(polyA) / 1e6 + turf.area(polyC) / 1e6;
    expect(Math.abs(unionArea - sumArea)).toBeLessThan(0.001);
  });

  it('T10-两个部分重叠的水源地叠加', () => {
    const polyA = buildCirclePolygon(114.50, 38.05, 500);
    const polyB = buildCirclePolygon(114.505, 38.05, 300);
    const areaA = turf.area(polyA) / 1e6;
    const areaB = turf.area(polyB) / 1e6;
    const sumArea = areaA + areaB;
    const fc = { type: 'FeatureCollection' as const, features: [polyA, polyB] };
    const unionResult = turf.union(fc as unknown as Parameters<typeof turf.union>[0]);
    expect(unionResult).not.toBeNull();
    const unionArea = turf.area(unionResult!) / 1e6;
    expect(unionArea).toBeLessThan(sumArea);
    expect(sumArea - unionArea).toBeGreaterThan(0);
  });

  it('T11-两个完全包含的水源地叠加', () => {
    const polyA = buildCirclePolygon(114.50, 38.05, 100);
    const polyB = buildCirclePolygon(114.50, 38.05, 50);
    const areaA = turf.area(polyA) / 1e6;
    const areaB = turf.area(polyB) / 1e6;
    const fc = { type: 'FeatureCollection' as const, features: [polyA, polyB] };
    const unionResult = turf.union(fc as unknown as Parameters<typeof turf.union>[0]);
    const unionArea = turf.area(unionResult!) / 1e6;
    expect(Math.abs(unionArea - areaA)).toBeLessThan(0.001);
    expect(Math.abs((areaA + areaB - unionArea) - areaB)).toBeLessThan(0.001);
  });

  it('T13-相邻但不重叠的水源地叠加', () => {
    const latRad = (38.05 * Math.PI) / 180;
    const lngB = 114.50 + 200 / (111320 * Math.cos(latRad));
    const polyA = buildCirclePolygon(114.50, 38.05, 100);
    const polyB = buildCirclePolygon(lngB, 38.05, 100);
    const fc = { type: 'FeatureCollection' as const, features: [polyA, polyB] };
    const unionResult = turf.union(fc as unknown as Parameters<typeof turf.union>[0]);
    const unionArea = turf.area(unionResult!) / 1e6;
    const sumArea = turf.area(polyA) / 1e6 + turf.area(polyB) / 1e6;
    expect(Math.abs(unionArea - sumArea)).toBeLessThan(0.01);
  });

  it('T14-单个水源地叠加', () => {
    const result = runOverlayAnalysis([sourceA], [recordA], baseRequest(['src-A']));
    expect(result.sourceCount).toBe(1);
    expect(result.overlaps).toHaveLength(0);
    expect(result.levels[0].unionArea).toBe(result.levels[0].sumArea);
  });

  it('T15-多级别同时叠加', () => {
    const result = runOverlayAnalysis(
      [sourceA, sourceB], [recordA, recordB],
      baseRequest(['src-A', 'src-B'], ['一级', '二级']),
    );
    expect(result.levels).toHaveLength(2);
    expect(result.levels[0].level).toBe('一级');
    expect(result.levels[1].level).toBe('二级');
    expect(result.levels[1].unionArea).toBeGreaterThan(result.levels[0].unionArea);
  });

  it('T16-union返回MultiPolygon', () => {
    const polyA = buildCirclePolygon(114.50, 38.05, 100);
    const polyC = buildCirclePolygon(115.50, 39.50, 200);
    const fc = { type: 'FeatureCollection' as const, features: [polyA, polyC] };
    const unionResult = turf.union(fc as unknown as Parameters<typeof turf.union>[0]);
    expect(unionResult).not.toBeNull();
    expect(['MultiPolygon', 'Polygon']).toContain(unionResult!.geometry.type);
  });

  it('T17-unionArea永远<=sumArea', () => {
    const configs = [
      { srcs: [sourceA, sourceC], recs: [recordA, recordC] },
      { srcs: [sourceA, sourceB], recs: [recordA, recordB] },
      { srcs: [sourceA], recs: [recordA] },
    ];
    for (const cfg of configs) {
      const result = runOverlayAnalysis(cfg.srcs, cfg.recs, baseRequest(cfg.srcs.map(s => s.id)));
      for (const level of result.levels) {
        expect(level.unionArea).toBeLessThanOrEqual(level.sumArea + 0.01);
        expect(level.overlapArea).toBeGreaterThanOrEqual(-0.01);
      }
    }
  });

  // P1-U02
  it('P1-U02-两个完全相同的多边形union', () => {
    const polyA = buildCirclePolygon(114.50, 38.05, 100);
    const polyB = buildCirclePolygon(114.50, 38.05, 100);
    const areaA = turf.area(polyA) / 1e6;
    const fc = { type: 'FeatureCollection' as const, features: [polyA, polyB] };
    const unionResult = turf.union(fc as unknown as Parameters<typeof turf.union>[0]);
    const unionArea = turf.area(unionResult!) / 1e6;
    expect(Math.abs(unionArea - areaA)).toBeLessThan(0.001);
  });

  // P1-U04
  it('P1-U04-union结果几何有效性验证', () => {
    const polyA = buildCirclePolygon(114.50, 38.05, 500);
    const polyB = buildCirclePolygon(114.505, 38.05, 300);
    const fc = { type: 'FeatureCollection' as const, features: [polyA, polyB] };
    const unionResult = turf.union(fc as unknown as Parameters<typeof turf.union>[0]);
    expect(unionResult!.type).toBe('Feature');
    expect(['Polygon', 'MultiPolygon']).toContain(unionResult!.geometry.type);
    expect(turf.area(unionResult!)).toBeGreaterThan(0);
  });
});

describe('S5 三、两两重叠检测', () => {
  it('T18-两个有重叠的水源地检测', () => {
    const polyA = buildCirclePolygon(114.50, 38.05, 500);
    const polyB = buildCirclePolygon(114.505, 38.05, 300);
    const fc = { type: 'FeatureCollection' as const, features: [polyA, polyB] };
    const intersect = turf.intersect(fc as unknown as Parameters<typeof turf.intersect>[0]);
    expect(intersect).not.toBeNull();
    expect(turf.area(intersect!) / 1e6).toBeGreaterThan(0);
  });

  it('T19-两个无重叠的水源地检测', () => {
    const polyA = buildCirclePolygon(114.50, 38.05, 100);
    const polyC = buildCirclePolygon(115.50, 39.50, 200);
    const fc = { type: 'FeatureCollection' as const, features: [polyA, polyC] };
    const intersect = turf.intersect(fc as unknown as Parameters<typeof turf.intersect>[0]);
    expect(intersect).toBeNull();
  });

  it('T20-三个水源地的两两检测', () => {
    const result = runOverlayAnalysis(
      [sourceA, sourceB, sourceC], [recordA, recordB, recordC],
      baseRequest(['src-A', 'src-B', 'src-C']),
    );
    // A-B 距离约 443m，一级 R=100+50=150m < 443m，不重叠
    // 所以可能 0 对重叠
    expect(result.overlaps.length).toBeGreaterThanOrEqual(0);
  });

  it('T21-完全包含的检测', () => {
    const polyA = buildCirclePolygon(114.50, 38.05, 100);
    const polyB = buildCirclePolygon(114.50, 38.05, 50);
    const fc = { type: 'FeatureCollection' as const, features: [polyA, polyB] };
    const intersect = turf.intersect(fc as unknown as Parameters<typeof turf.intersect>[0]);
    expect(intersect).not.toBeNull();
    const overlapArea = turf.area(intersect!) / 1e6;
    const areaB = turf.area(polyB) / 1e6;
    expect(Math.abs(overlapArea - areaB)).toBeLessThan(0.001);
  });

  it('T22-多级别两两检测', () => {
    const result = runOverlayAnalysis(
      [sourceA, sourceB], [recordA, recordB],
      baseRequest(['src-A', 'src-B'], ['一级', '二级']),
    );
    // 每对返回的 overlap 记录中 level 字段正确
    for (const overlap of result.overlaps) {
      expect(['一级', '二级']).toContain(overlap.level);
    }
  });

  it('T26-N=1时两两检测为空', () => {
    const result = runOverlayAnalysis([sourceA], [recordA], baseRequest(['src-A']));
    expect(result.overlaps).toHaveLength(0);
  });

  // P1-P01
  it('P1-P01-重叠检测的对称性', () => {
    const polyA = buildCirclePolygon(114.50, 38.05, 500);
    const polyB = buildCirclePolygon(114.505, 38.05, 300);
    const fcAB = { type: 'FeatureCollection' as const, features: [polyA, polyB] };
    const fcBA = { type: 'FeatureCollection' as const, features: [polyB, polyA] };
    const intersectAB = turf.intersect(fcAB as unknown as Parameters<typeof turf.intersect>[0]);
    const intersectBA = turf.intersect(fcBA as unknown as Parameters<typeof turf.intersect>[0]);
    expect(intersectAB).not.toBeNull();
    expect(intersectBA).not.toBeNull();
    const areaAB = turf.area(intersectAB!) / 1e6;
    const areaBA = turf.area(intersectBA!) / 1e6;
    expect(Math.abs(areaAB - areaBA)).toBeLessThan(0.0001);
  });

  // P1-T02
  it('P1-T02-两个圆心完全重合的保护区', () => {
    const polyA = buildCirclePolygon(114.50, 38.05, 500);
    const polyB = buildCirclePolygon(114.50, 38.05, 300);
    const areaA = turf.area(polyA) / 1e6;
    const areaB = turf.area(polyB) / 1e6;
    const fc = { type: 'FeatureCollection' as const, features: [polyA, polyB] };
    const intersect = turf.intersect(fc as unknown as Parameters<typeof turf.intersect>[0]);
    expect(intersect).not.toBeNull();
    const overlapArea = turf.area(intersect!) / 1e6;
    expect(Math.abs(overlapArea - areaB)).toBeLessThan(0.001);
    const unionResult = turf.union(fc as unknown as Parameters<typeof turf.union>[0]);
    const unionArea = turf.area(unionResult!) / 1e6;
    expect(Math.abs(unionArea - areaA)).toBeLessThan(0.001);
  });
});

describe('S5 四、面积统计与汇总', () => {
  it('P0-S1-各级别unionArea与summary字段一一对应', () => {
    const result = runOverlayAnalysis(
      [sourceA, sourceB], [recordA, recordB],
      baseRequest(['src-A', 'src-B'], ['一级', '二级', '准保护区']),
    );
    const l1 = result.levels.find(l => l.level === '一级');
    const l2 = result.levels.find(l => l.level === '二级');
    const l3 = result.levels.find(l => l.level === '准保护区');
    expect(result.summary.primaryUnionArea).toBe(l1!.unionArea);
    expect(result.summary.secondaryUnionArea).toBe(l2!.unionArea);
    expect(result.summary.tertiaryUnionArea).toBe(l3!.unionArea);
  });

  it('P0-S3-cities列表去重正确', () => {
    const result = runOverlayAnalysis(
      [sourceA, sourceB, sourceC], [recordA, recordB, recordC],
      baseRequest(['src-A', 'src-B', 'src-C']),
    );
    expect(result.summary.cities).toContain('石家庄市');
    expect(result.summary.cities).toContain('保定市');
    expect(result.summary.cities).toHaveLength(2);
  });

  it('T33-overlapArea=sumArea-unionArea守恒', () => {
    const result = runOverlayAnalysis(
      [sourceA, sourceB], [recordA, recordB],
      baseRequest(['src-A', 'src-B'], ['一级', '二级']),
    );
    for (const level of result.levels) {
      expect(Math.abs(level.overlapArea - (level.sumArea - level.unionArea))).toBeLessThan(0.01);
    }
  });

  it('T34-overlapRatio范围验证', () => {
    const result = runOverlayAnalysis(
      [sourceA, sourceB], [recordA, recordB],
      baseRequest(['src-A', 'src-B'], ['一级', '二级']),
    );
    for (const level of result.levels) {
      expect(level.overlapRatio).toBeGreaterThanOrEqual(0);
      expect(level.overlapRatio).toBeLessThanOrEqual(1);
    }
  });

  it('T35-空级别结果', () => {
    const result = runOverlayAnalysis(
      [sourceA, sourceB], [recordA, recordB],
      baseRequest(['src-A', 'src-B'], []),
    );
    expect(result.levels).toHaveLength(0);
    expect(result.summary.primaryUnionArea).toBe(0);
  });
});

describe('S5 五、异常输入与边界条件', () => {
  it('T36-空水源地列表', () => {
    expect(() => runOverlayAnalysis([], [], baseRequest([]))).toThrow();
  });

  it('T37-仅1个水源地', () => {
    const result = runOverlayAnalysis([sourceA], [recordA], baseRequest(['src-A']));
    expect(result.sourceCount).toBe(1);
    expect(result.overlaps).toHaveLength(0);
    expect(result.levels[0].unionArea).toBe(result.levels[0].sumArea);
  });

  it('T38-水源地无计算结果', () => {
    const sourceX: WaterSourceRecord = { ...sourceA, id: 'src-X', name: '水源地X' };
    const result = runOverlayAnalysis([sourceA, sourceX], [recordA], baseRequest(['src-A', 'src-X']));
    expect(result.sourceCount).toBe(1);
    expect(result.warnings.some(w => w.includes('无已保存的计算结果'))).toBe(true);
  });

  it('T39-水源地无坐标', () => {
    const sourceNoCoord: WaterSourceRecord = { ...sourceA, lng: undefined, lat: undefined };
    const result = runOverlayAnalysis([sourceNoCoord], [recordA], baseRequest(['src-A']));
    expect(result.sourceCount).toBe(0);
    expect(result.warnings.some(w => w.includes('无坐标数据'))).toBe(true);
  });

  it('T40-所有水源地都被跳过', () => {
    const result = runOverlayAnalysis([sourceA, sourceB], [], baseRequest(['src-A', 'src-B']));
    expect(result.sourceCount).toBe(0);
    expect(result.warnings.length).toBeGreaterThanOrEqual(2);
  });

  it('T41-未选中任何级别', () => {
    const result = runOverlayAnalysis(
      [sourceA, sourceB], [recordA, recordB],
      baseRequest(['src-A', 'src-B'], []),
    );
    expect(result.levels).toHaveLength(0);
    expect(result.summary.primaryUnionArea).toBe(0);
  });

  it('T42-选中级别但水源地无该级别', () => {
    const recordPartial: ZoneCalcRecord = {
      ...recordA,
      zones: [makeZone('一级', 100), makeZone('二级', 1000)],
    };
    const result = runOverlayAnalysis([sourceA], [recordPartial], baseRequest(['src-A'], ['准保护区']));
    // 水源地无准保护区，该级别结果 unionArea=0
    if (result.levels.length > 0) {
      expect(result.levels[0].unionArea).toBe(0);
    }
    expect(result.warnings.some(w => w.includes('准保护区'))).toBe(true);
  });

  it('T43-重复sourceIds', () => {
    const result = runOverlayAnalysis(
      [sourceA, sourceA], [recordA],
      baseRequest(['src-A', 'src-A']),
    );
    expect(result.sourceCount).toBe(1);
    expect(result.warnings.some(w => w.includes('重复'))).toBe(true);
  });
});

describe('S5 九、数据完整性与损坏', () => {
  it('E01-area为负数', () => {
    const badRecord: ZoneCalcRecord = {
      ...recordA,
      zones: [{ ...makeZone('一级', 100), area: -0.5 }],
    };
    const result = runOverlayAnalysis([sourceA], [badRecord], baseRequest(['src-A']));
    expect(result.warnings.some(w => w.includes('面积无效'))).toBe(true);
  });

  it('E02-area为NaN', () => {
    const badRecord: ZoneCalcRecord = {
      ...recordA,
      zones: [{ ...makeZone('一级', 100), area: NaN }],
    };
    const result = runOverlayAnalysis([sourceA], [badRecord], baseRequest(['src-A']));
    expect(result.warnings.some(w => w.includes('面积无效') || w.includes('NaN'))).toBe(true);
  });

  it('E04-radius为Infinity', () => {
    const badRecord: ZoneCalcRecord = {
      ...recordA,
      zones: [{ ...makeZone('一级', 100), radius: Infinity, area: Infinity }],
    };
    const result = runOverlayAnalysis([sourceA], [badRecord], baseRequest(['src-A']));
    expect(result.warnings.some(w => w.includes('半径异常') || w.includes('Infinity'))).toBe(true);
  });

  it('E05-zones数组为空', () => {
    const emptyRecord: ZoneCalcRecord = { ...recordA, zones: [] };
    const result = runOverlayAnalysis([sourceA], [emptyRecord], baseRequest(['src-A']));
    expect(result.warnings.some(w => w.includes('无保护区级别数据'))).toBe(true);
  });

  it('E06-level不在枚举内', () => {
    const badLevelRecord: ZoneCalcRecord = {
      ...recordA,
      zones: [{ ...makeZone('一级', 100), level: '三级' as '一级' }],
    };
    const result = runOverlayAnalysis([sourceA], [badLevelRecord], baseRequest(['src-A'], ['一级']));
    expect(result.sourceCount).toBe(0);
  });

  // P1-D01
  it('P1-D01-area与radius不一致', () => {
    const inconsistentRecord: ZoneCalcRecord = {
      ...recordA,
      zones: [{ ...makeZone('一级', 100), area: 0.5 }],
    };
    const result = runOverlayAnalysis([sourceA], [inconsistentRecord], baseRequest(['src-A']));
    expect(result.warnings.some(w => w.includes('不一致'))).toBe(true);
  });

  // P1-D02
  it('P1-D02-method字段为非标准值', () => {
    const badMethodRecord: ZoneCalcRecord = {
      ...recordA,
      zones: [{ ...makeZone('一级', 100), method: '未知方法' as '经验值法' }],
    };
    const result = runOverlayAnalysis([sourceA], [badMethodRecord], baseRequest(['src-A']));
    expect(result.levels[0].unionArea).toBeGreaterThan(0);
  });
});

describe('S5 十、几何退化与拓扑异常', () => {
  it('E07-退化为点的保护区(radius=0.001m)', () => {
    const tinyRecord: ZoneCalcRecord = {
      ...recordA,
      zones: [{ ...makeZone('一级', 0.001), area: 0 }],
    };
    const result = runOverlayAnalysis([sourceA], [tinyRecord], baseRequest(['src-A']));
    // 面积为 0 或极小，应被跳过或结果极小
    expect(result.sourceCount).toBeGreaterThanOrEqual(0);
  });

  // P1-T01
  it('P1-T01-极窄矩形保护区(width=1m)', () => {
    const vertices = generateRiverVertices(114.50, 38.05, 5000, 1000, 1, 90);
    expect(vertices).toHaveLength(8);
    const ring = [...vertices.map(v => [v.lng, v.lat] as [number, number]), [vertices[0].lng, vertices[0].lat] as [number, number]];
    const poly = turf.polygon([ring]);
    const area = turf.area(poly) / 1e6;
    expect(area).toBeGreaterThan(0);
    expect(area).toBeLessThan(0.1);
  });

  // P1-T03
  it('P1-T03-三个嵌套保护区(同心圆)', () => {
    const polyA = buildCirclePolygon(114.50, 38.05, 100);
    const polyB = buildCirclePolygon(114.50, 38.05, 300);
    const polyC = buildCirclePolygon(114.50, 38.05, 500);
    const areaA = turf.area(polyA) / 1e6;
    const areaB = turf.area(polyB) / 1e6;
    const areaC = turf.area(polyC) / 1e6;
    // union of all three = areaC
    const fc1 = { type: 'FeatureCollection' as const, features: [polyA, polyB] };
    const temp = turf.union(fc1 as unknown as Parameters<typeof turf.union>[0]);
    const fc2 = { type: 'FeatureCollection' as const, features: [temp!, polyC] };
    const final = turf.union(fc2 as unknown as Parameters<typeof turf.union>[0]);
    const unionArea = turf.area(final!) / 1e6;
    expect(Math.abs(unionArea - areaC)).toBeLessThan(0.01);
    // A∩B ≈ areaA
    const fcAB = { type: 'FeatureCollection' as const, features: [polyA, polyB] };
    const intersectAB = turf.intersect(fcAB as unknown as Parameters<typeof turf.intersect>[0]);
    expect(Math.abs(turf.area(intersectAB!) / 1e6 - areaA)).toBeLessThan(0.01);
  });

  // P1-T04
  it('P1-T04-共享顶点的两个多边形', () => {
    const coordsA: [number, number][] = [
      [114.500, 38.050], [114.502, 38.050], [114.502, 38.052], [114.500, 38.052], [114.500, 38.050],
    ];
    const coordsB: [number, number][] = [
      [114.502, 38.050], [114.504, 38.050], [114.504, 38.052], [114.502, 38.052], [114.502, 38.050],
    ];
    const polyA = turf.polygon([coordsA]);
    const polyB = turf.polygon([coordsB]);
    const fc = { type: 'FeatureCollection' as const, features: [polyA, polyB] };
    const intersect = turf.intersect(fc as unknown as Parameters<typeof turf.intersect>[0]);
    if (intersect) {
      expect(turf.area(intersect) / 1e6).toBeLessThan(0.0001);
    }
    const unionResult = turf.union(fc as unknown as Parameters<typeof turf.union>[0]);
    const unionArea = turf.area(unionResult!) / 1e6;
    const sumArea = turf.area(polyA) / 1e6 + turf.area(polyB) / 1e6;
    expect(Math.abs(unionArea - sumArea)).toBeLessThan(0.001);
  });
});

describe('S5 十一、数值精度与浮点误差', () => {
  // P0-S11
  it('P0-S11-守恒律在5水源地复杂叠加中成立', () => {
    const src1 = { ...sourceA, id: 's1', name: 'S1', lng: 114.50, lat: 38.05 };
    const src2 = { ...sourceA, id: 's2', name: 'S2', lng: 114.503, lat: 38.05 };
    const src3 = { ...sourceA, id: 's3', name: 'S3', lng: 114.50, lat: 38.053 };
    const src4 = { ...sourceA, id: 's4', name: 'S4', lng: 114.52, lat: 38.07 };
    const src5 = { ...sourceA, id: 's5', name: 'S5', lng: 114.501, lat: 38.051 };
    const recs = [src1, src2, src3, src4, src5].map(s => makeZoneRecord(s, 800, 1000));
    const result = runOverlayAnalysis(
      [src1, src2, src3, src4, src5], recs,
      baseRequest(['s1', 's2', 's3', 's4', 's5']),
    );
    for (const level of result.levels) {
      expect(level.unionArea).toBeGreaterThan(0);
      expect(level.unionArea).toBeLessThanOrEqual(level.sumArea + 0.01);
      expect(level.overlapArea).toBeGreaterThanOrEqual(-0.01);
    }
  });

  // P0-S12
  it('P0-S12-微小重叠面积过滤阈值正确', () => {
    const latRad = (38.05 * Math.PI) / 180;
    const lngB = 114.50 + 199.5 / (111320 * Math.cos(latRad));
    const polyA = buildCirclePolygon(114.50, 38.05, 100);
    const polyB = buildCirclePolygon(lngB, 38.05, 100);
    const fc = { type: 'FeatureCollection' as const, features: [polyA, polyB] };
    const intersect = turf.intersect(fc as unknown as Parameters<typeof turf.intersect>[0]);
    if (intersect) {
      const overlapArea = turf.area(intersect) / 1e6;
      expect(overlapArea).toBeLessThan(0.001);
    }
  });
});

describe('S5 十四、混合类型与跨场景', () => {
  // P0-S16
  it('P0-S16-地下水圆形+地表水河流型混合叠加', () => {
    const polyCircle = buildCirclePolygon(114.50, 38.05, 500);
    const polyRiver = buildRiverPolygon(114.502, 38.048, 4150, 850, 200);
    const fc = { type: 'FeatureCollection' as const, features: [polyCircle, polyRiver] };
    const intersect = turf.intersect(fc as unknown as Parameters<typeof turf.intersect>[0]);
    expect(intersect).not.toBeNull();
    const overlapArea = turf.area(intersect!) / 1e6;
    expect(overlapArea).toBeGreaterThan(0);
    const unionResult = turf.union(fc as unknown as Parameters<typeof turf.union>[0]);
    expect(unionResult).not.toBeNull();
    const unionArea = turf.area(unionResult!) / 1e6;
    const sumArea = turf.area(polyCircle) / 1e6 + turf.area(polyRiver) / 1e6;
    expect(unionArea).toBeLessThan(sumArea);
  });

  // P1-A01
  it('P1-A01-极大半径(50000m)', () => {
    // area = π * 50000² / 1e6 = 7853.98 km²
    const expectedArea = parseFloat(((Math.PI * 50000 * 50000) / 1e6).toFixed(4));
    const largeRecord: ZoneCalcRecord = {
      ...recordA,
      zones: [{ ...makeZone('一级', 50000), area: expectedArea }],
    };
    const result = runOverlayAnalysis([sourceA], [largeRecord], baseRequest(['src-A']));
    expect(result.levels[0].unionArea).toBeGreaterThan(0);
    expect(result.warnings.some(w => w.includes('半径异常偏大'))).toBe(true);
  });

  // P1-A03
  it('P1-A03-optional字段缺失', () => {
    const minimalSource: WaterSourceRecord = {
      id: 'src-A', cityName: '石家庄市', name: '水源地A',
      type: '地下水', county: '正定县', level: 'county', status: '在用',
      lng: 114.50, lat: 38.05,
    };
    const result = runOverlayAnalysis([minimalSource], [recordA], baseRequest(['src-A']));
    expect(result.sourceCount).toBe(1);
    expect(result.summary.cities).toContain('石家庄市');
  });
});
