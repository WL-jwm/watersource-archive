/**
 * P3-20: 空间分析模块单元测试
 * 覆盖: Haversine距离 + 保护区涉及判断
 */
import { describe, it, expect } from 'vitest';
import { haversineDistance, checkProjectAgainstZones } from '@/lib/spatialAnalysis';
import { WaterSourceRecord, ZoneCalcRecord } from '@/stores/waterSourceStore';

// ===== Haversine距离（返回米）=====
describe('haversineDistance', () => {
  it('同一点距离为0', () => {
    expect(haversineDistance(38.0, 115.0, 38.0, 115.0)).toBe(0);
  });

  it('北京到上海距离约1068km', () => {
    const bj = { lat: 39.9042, lng: 116.4074 };
    const sh = { lat: 31.2304, lng: 121.4737 };
    const dist = haversineDistance(bj.lat, bj.lng, sh.lat, sh.lng);
    expect(dist).toBeGreaterThan(1000000); // >1000km = >1000000m
    expect(dist).toBeLessThan(1200000); // <1200km
  });

  it('石家庄到保定约120km', () => {
    const sjz = { lat: 38.042, lng: 114.514 };
    const bd = { lat: 38.873, lng: 115.464 };
    const dist = haversineDistance(sjz.lat, sjz.lng, bd.lat, bd.lng);
    expect(dist).toBeGreaterThan(100000); // >100km
    expect(dist).toBeLessThan(150000); // <150km
  });

  it('1度纬度约111km', () => {
    const dist = haversineDistance(38.0, 115.0, 39.0, 115.0);
    expect(dist).toBeGreaterThan(110000);
    expect(dist).toBeLessThan(112000);
  });

  it('距离应对称', () => {
    const d1 = haversineDistance(38.0, 115.0, 40.0, 118.0);
    const d2 = haversineDistance(40.0, 118.0, 38.0, 115.0);
    expect(d1).toBeCloseTo(d2, 2);
  });
});

// ===== 保护区涉及判断 =====
describe('checkProjectAgainstZones', () => {
  // 模拟水源地数据
  const mockSource: WaterSourceRecord = {
    id: 'ws_001',
    cityName: '石家庄市',
    county: '长安区',
    level: 'municipal',
    name: '测试水源地A',
    type: '地下水',
    subType: '孔隙水',
    status: '在用',
    remark: '',
    lng: 115.0,
    lat: 38.0,
  };

  const mockZoneRecord: ZoneCalcRecord = {
    id: 'zr_001',
    sourceId: 'ws_001',
    sourceName: '测试水源地A',
    params: { sourceType: '地下水', gwType: '孔隙水' },
    zones: [
      {
        level: '一级',
        method: '经验值法',
        formula: 'R=300m',
        radius: 300,
        area: 0.28,
        boundaryDescription: '一级保护区半径300m',
        keyParams: 'R=300',
        standard: 'HJ 338-2018',
      },
      {
        level: '二级',
        method: '经验值法',
        formula: 'R=1000m',
        radius: 1000,
        area: 3.14,
        boundaryDescription: '二级保护区半径1000m',
        keyParams: 'R=1000',
        standard: 'HJ 338-2018',
      },
    ],
    calculatedAt: '2025-01-01',
    warnings: [],
  };

  it('项目在一级保护区内应报告涉及', () => {
    const result = checkProjectAgainstZones(
      { name: '测试项目', lat: 38.0, lng: 115.0, radiusM: 0 },
      [mockZoneRecord],
      [mockSource],
    );
    expect(result.hasInvolved).toBe(true);
    expect(result.involvedZones.length).toBeGreaterThan(0);
  });

  it('项目在保护区外应报告不涉及', () => {
    const result = checkProjectAgainstZones(
      { name: '远处项目', lat: 36.0, lng: 113.0, radiusM: 0 }, // 距离约200+km
      [mockZoneRecord],
      [mockSource],
    );
    expect(result.hasInvolved).toBe(false);
    expect(result.involvedZones).toHaveLength(0);
  });

  it('结果结构完整', () => {
    const result = checkProjectAgainstZones(
      { name: '项目', lat: 38.0, lng: 115.0, radiusM: 0 },
      [mockZoneRecord],
      [mockSource],
    );
    expect(result.hasInvolved).toBeDefined();
    expect(result.involvedZones).toBeInstanceOf(Array);
    expect(result.nearestZone).toBeDefined();
    expect(result.nearestEdgeDistanceM).toBeDefined();
  });
});
