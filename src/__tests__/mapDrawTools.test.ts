import { describe, it, expect } from 'vitest';
import {
  haversineDistance,
  polylineDistance,
  polygonArea,
  formatDistance,
  formatArea,
} from '@/lib/mapDrawTools';
import L from 'leaflet';

// ===== 距离计算测试 =====

describe('haversineDistance', () => {
  it('T01-相同点距离为0', () => {
    expect(haversineDistance(38.5, 115.5, 38.5, 115.5)).toBe(0);
  });

  it('T02-石家庄到北京约280km', () => {
    const dist = haversineDistance(38.0428, 114.5149, 39.9042, 116.4074);
    expect(dist).toBeGreaterThan(250000);
    expect(dist).toBeLessThan(320000);
  });

  it('T03-小距离精度', () => {
    // 约111米（0.001度纬度）
    const dist = haversineDistance(38.0, 115.0, 38.001, 115.0);
    expect(dist).toBeGreaterThan(100);
    expect(dist).toBeLessThan(120);
  });
});

describe('polylineDistance', () => {
  it('T04-单点距离为0', () => {
    const points = [L.latLng(38.0, 115.0)];
    expect(polylineDistance(points)).toBe(0);
  });

  it('T05-两点距离等于haversine', () => {
    const p1 = L.latLng(38.0, 115.0);
    const p2 = L.latLng(38.001, 115.0);
    const direct = haversineDistance(38.0, 115.0, 38.001, 115.0);
    expect(polylineDistance([p1, p2])).toBeCloseTo(direct, 5);
  });

  it('T06-三点累计距离', () => {
    const p1 = L.latLng(38.0, 115.0);
    const p2 = L.latLng(38.001, 115.0);
    const p3 = L.latLng(38.001, 115.001);
    const dist = polylineDistance([p1, p2, p3]);
    const seg1 = haversineDistance(38.0, 115.0, 38.001, 115.0);
    const seg2 = haversineDistance(38.001, 115.0, 38.001, 115.001);
    expect(dist).toBeCloseTo(seg1 + seg2, 5);
  });
});

// ===== 面积计算测试 =====

describe('polygonArea', () => {
  it('T07-少于三点面积为0', () => {
    expect(polygonArea([L.latLng(38.0, 115.0)])).toBe(0);
    expect(polygonArea([L.latLng(38.0, 115.0), L.latLng(38.001, 115.0)])).toBe(0);
  });

  it('T08-正方形面积约1km²', () => {
    // 0.01度纬度 ≈ 1111m, 0.01度经度 ≈ 1111*cos(38) ≈ 876m
    // 面积 ≈ 1111 * 876 ≈ 973,236 m² ≈ 0.973 km²
    const points = [
      L.latLng(38.0, 115.0),
      L.latLng(38.01, 115.0),
      L.latLng(38.01, 115.01),
      L.latLng(38.0, 115.01),
    ];
    const area = polygonArea(points);
    expect(area).toBeGreaterThan(900000);
    expect(area).toBeLessThan(1100000);
  });

  it('T09-三角形面积大于0', () => {
    const points = [
      L.latLng(38.0, 115.0),
      L.latLng(38.01, 115.0),
      L.latLng(38.0, 115.01),
    ];
    const area = polygonArea(points);
    expect(area).toBeGreaterThan(400000);
    expect(area).toBeLessThan(600000);
  });
});

// ===== 格式化测试 =====

describe('formatDistance', () => {
  it('T10-米级距离', () => {
    expect(formatDistance(150)).toBe('150.0 m');
  });

  it('T11-千米级距离', () => {
    expect(formatDistance(1500)).toBe('1.500 km');
  });

  it('T12-零距离', () => {
    expect(formatDistance(0)).toBe('0.0 m');
  });
});

describe('formatArea', () => {
  it('T13-平方米级面积', () => {
    expect(formatArea(500)).toBe('500.0 m²');
  });

  it('T14-平方千米级面积', () => {
    expect(formatArea(2000000)).toBe('2.0000 km²');
  });

  it('T15-零面积', () => {
    expect(formatArea(0)).toBe('0.0 m²');
  });
});
