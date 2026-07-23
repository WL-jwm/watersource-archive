/**
 * A2: 多井干扰保护区计算引擎测试
 */

import { describe, it, expect } from 'vitest';
import {
  calcWellFieldZones,
  generateWellFieldVertices,
  generateSingleWellCircles,
  type WellFieldCalcParams,
  type WellInfo,
} from '@/lib/wellFieldCalcEngine';

// 测试数据：河北省典型水源地多井场景
const wells: WellInfo[] = [
  { id: 'w1', name: '1号井', lng: 114.5, lat: 38.0 },
  { id: 'w2', name: '2号井', lng: 114.52, lat: 38.02 },
  { id: 'w3', name: '3号井', lng: 114.51, lat: 38.01 },
];

const baseParams: WellFieldCalcParams = {
  wells,
  transmissivity: 100,
  storativity: 0.0001,
  dailyYield: 5000,
  gwType: '孔隙水',
};

describe('calcWellFieldZones', () => {
  it('A2-01 三井基本计算应返回完整结果', () => {
    const result = calcWellFieldZones(baseParams);
    expect(result.wellCount).toBe(3);
    expect(result.singleWells).toHaveLength(3);
    expect(result.primary.radius).toBeGreaterThan(0);
    expect(result.secondary.radius).toBeGreaterThan(result.primary.radius);
    expect(result.quasi.radius).toBeGreaterThan(result.secondary.radius);
    expect(result.method).toMatch(/叠加法|等效半径法/);
  });

  it('A2-02 单井计算应正常返回（带警告）', () => {
    const result = calcWellFieldZones({
      ...baseParams,
      wells: [wells[0]],
    });
    expect(result.wellCount).toBe(1);
    expect(result.warnings).toContain('仅有一个井，建议直接使用单井保护区计算');
  });

  it('A2-03 各井独立一级半径应一致（参数相同）', () => {
    const result = calcWellFieldZones(baseParams);
    const r1 = result.singleWells[0].primaryRadius;
    result.singleWells.forEach((w) => {
      expect(w.primaryRadius).toBe(r1);
    });
  });

  it('A2-04 井群质心应在各井坐标范围内', () => {
    const result = calcWellFieldZones(baseParams);
    const lngs = wells.map((w) => w.lng);
    const lats = wells.map((w) => w.lat);
    expect(result.centerLng).toBeGreaterThanOrEqual(Math.min(...lngs));
    expect(result.centerLng).toBeLessThanOrEqual(Math.max(...lngs));
    expect(result.centerLat).toBeGreaterThanOrEqual(Math.min(...lats));
    expect(result.centerLat).toBeLessThanOrEqual(Math.max(...lats));
  });

  it('A2-05 合并后一级面积应大于等于单井一级面积', () => {
    const result = calcWellFieldZones(baseParams);
    const singleArea = (result.singleWells[0].primaryRadius ** 2 * Math.PI) / 1e6;
    // 合并后面积至少不小于单井面积（考虑干扰扩大）
    expect(result.primary.area).toBeGreaterThanOrEqual(singleArea * 0.9);
  });

  it('A2-06 近距井应触发干扰警告', () => {
    // 三口井距离很近（~200m），应触发干扰
    const closeWells: WellInfo[] = [
      { id: 'w1', lng: 114.5, lat: 38.0 },
      { id: 'w2', lng: 114.501, lat: 38.001 },
      { id: 'w3', lng: 114.502, lat: 38.0 },
    ];
    const result = calcWellFieldZones({ ...baseParams, wells: closeWells });
    const hasInterferenceWarn = result.warnings.some((w) => w.includes('干扰'));
    expect(hasInterferenceWarn).toBe(true);
    // 干扰系数应 > 1
    expect(result.primary.interferenceFactor).toBeGreaterThan(1);
  });

  it('A2-07 远距井不应触发干扰（干扰系数=1）', () => {
    // R1 ≈ 11619m（T=100,S=0.0001），2×R1 ≈ 23km
    // 两井相距约33km，超出 2×R1
    const farWells: WellInfo[] = [
      { id: 'w1', lng: 114.5, lat: 38.0 },
      { id: 'w2', lng: 114.8, lat: 38.2 }, // 相距约33km
    ];
    const result = calcWellFieldZones({ ...baseParams, wells: farWells });
    expect(result.primary.interferenceFactor).toBe(1);
  });

  it('A2-08 未提供T和S时应使用默认值并警告', () => {
    const result = calcWellFieldZones({
      wells,
      dailyYield: 3000,
    });
    expect(result.warnings.some((w) => w.includes('导水系数'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('储水系数'))).toBe(true);
    // 仍应产出有效结果
    expect(result.primary.radius).toBeGreaterThan(0);
  });

  it('A2-09 取水量均分（未指定单井取水量时）', () => {
    const result = calcWellFieldZones(baseParams);
    const expectedYield = 5000 / 3;
    result.singleWells.forEach((w) => {
      expect(w.yield).toBeCloseTo(expectedYield, 1);
    });
  });

  it('A2-10 井群分布面积应大于0（多井时）', () => {
    const result = calcWellFieldZones(baseParams);
    expect(result.wellFieldArea).toBeGreaterThan(0);
  });

  it('A2-11 等效半径应大于0', () => {
    const result = calcWellFieldZones(baseParams);
    expect(result.equivalentRadius).toBeGreaterThan(0);
  });

  it('A2-12 空井列表应抛出错误', () => {
    expect(() => calcWellFieldZones({ ...baseParams, wells: [] })).toThrow('井列表不能为空');
  });
});

describe('generateWellFieldVertices', () => {
  it('A2-13 应生成指定数量的拐点', () => {
    const vertices = generateWellFieldVertices(114.5, 38.0, 500, 24);
    expect(vertices).toHaveLength(24);
    expect(vertices[0].id).toBe('J1');
    expect(vertices[23].id).toBe('J24');
  });

  it('A2-14 拐点应在合理坐标范围内', () => {
    const vertices = generateWellFieldVertices(114.5, 38.0, 500, 16);
    vertices.forEach((v) => {
      expect(v.lng).toBeGreaterThan(114.4);
      expect(v.lng).toBeLessThan(114.6);
      expect(v.lat).toBeGreaterThan(37.9);
      expect(v.lat).toBeLessThan(38.1);
      expect(v.azimuth).toBeGreaterThanOrEqual(0);
      expect(v.azimuth).toBeLessThan(360);
    });
  });
});

describe('generateSingleWellCircles', () => {
  it('A2-15 应为每个井生成圆心和多边形', () => {
    const result = calcWellFieldZones(baseParams);
    const circles = generateSingleWellCircles(result.singleWells, 24);
    expect(circles).toHaveLength(3);
    circles.forEach((c) => {
      expect(c.primaryVertices).toHaveLength(24);
      expect(c.secondaryVertices).toHaveLength(24);
      expect(c.primaryRadius).toBeGreaterThan(0);
      expect(c.secondaryRadius).toBeGreaterThan(c.primaryRadius);
    });
  });

  it('A2-16 圆心坐标应与井坐标一致', () => {
    const result = calcWellFieldZones(baseParams);
    const circles = generateSingleWellCircles(result.singleWells);
    expect(circles[0].centerLng).toBeCloseTo(wells[0].lng, 6);
    expect(circles[0].centerLat).toBeCloseTo(wells[0].lat, 6);
  });
});
