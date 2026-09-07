/**
 * P8.14: src/utils/coordTransform 测试
 *
 * 覆盖：
 * 1. wgs2gcj 已知点转换（河北省典型点，参考开源算法交叉验证）
 * 2. gcj2wgs / gcj2wgsExact 与 wgs2gcj 往返一致性
 * 3. gcj2wgsExact 迭代精化误差明显小于一阶 gcj2wgs
 * 4. 河北点位 GCJ↔WGS 偏移量级 ~500m（与检测结论一致）
 * 5. outOfChina 边界（境外坐标不转换）
 * 6. 点位对象转换函数
 */

import { describe, expect, it } from 'vitest';
import {
  wgs2gcj,
  gcj2wgs,
  gcj2wgsExact,
  wgs2gcjPoint,
  gcj2wgsPoint,
} from '@/utils/coordTransform';

/** 两点欧氏距离（度） */
function dist(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** 河北典型点位（覆盖石家庄/保定/张家口/邯郸，WGS-84） */
const HEBEI_POINTS: Array<[number, number]> = [
  [114.51486, 38.04228], // 石家庄
  [115.46336, 38.88182], // 保定
  [114.88552, 40.76846], // 张家口
  [114.49068, 36.62555], // 邯郸
  [117.02036, 36.77827], // 德州边界附近
  [119.82442, 39.44101], // 秦皇岛
];

describe('P8.14 utils/coordTransform 火星坐标转换', () => {
  describe('wgs2gcj', () => {
    it('T01-河北点转换后产生 ~500m 级总位移（与检测结论一致）', () => {
      for (const [lng, lat] of HEBEI_POINTS) {
        const [glng, glat] = wgs2gcj(lng, lat);
        // GCJ 总位移量级：河北地区约 300-700m（0.003°~0.007°），分量不均
        const d = dist([glng, glat], [lng, lat]);
        expect(d).toBeGreaterThan(0.003);
        expect(d).toBeLessThan(0.01);
      }
    });

    it('T02-已知点验证：石家庄 WGS(114.51486,38.04228) 转换结果精确匹配', () => {
      // 实测输出：gcj(114.520834, 38.042899)，经度偏移 550m、纬度偏移 69m
      const [glng, glat] = wgs2gcj(114.51486, 38.04228);
      expect(glng).toBeCloseTo(114.520834, 5);
      expect(glat).toBeCloseTo(38.042899, 5);
    });
  });

  describe('gcj2wgs / gcj2wgsExact 往返一致性', () => {
    it('T03-gcj2wgs(wgs2gcj(p)) 一阶误差 < 10m（0.0001°）', () => {
      for (const [lng, lat] of HEBEI_POINTS) {
        const [glng, glat] = wgs2gcj(lng, lat);
        const [wlng, wlat] = gcj2wgs(glng, glat);
        expect(dist([wlng, wlat], [lng, lat])).toBeLessThan(0.0001);
      }
    });

    it('T04-gcj2wgsExact 迭代精化误差 < 0.5m（0.000005°）', () => {
      for (const [lng, lat] of HEBEI_POINTS) {
        const [glng, glat] = wgs2gcj(lng, lat);
        const [wlng, wlat] = gcj2wgsExact(glng, glat);
        expect(dist([wlng, wlat], [lng, lat])).toBeLessThan(0.000005);
      }
    });

    it('T05-精化版精度显著优于一阶（至少提升一个量级）', () => {
      for (const [lng, lat] of HEBEI_POINTS) {
        const [glng, glat] = wgs2gcj(lng, lat);
        const [w1lng, w1lat] = gcj2wgs(glng, glat);
        const [w2lng, w2lat] = gcj2wgsExact(glng, glat);
        const err1 = dist([w1lng, w1lat], [lng, lat]);
        const err2 = dist([w2lng, w2lat], [lng, lat]);
        expect(err2).toBeLessThan(err1 * 0.1); // 至少提升一个量级
      }
    });
  });

  describe('outOfChina 边界', () => {
    it('T06-境外坐标原样返回', () => {
      // 纽约
      expect(wgs2gcj(-74.006, 40.7128)).toEqual([-74.006, 40.7128]);
      // 东京（超经度范围）
      expect(wgs2gcj(139.6917, 35.6895)).toEqual([139.6917, 35.6895]);
      // 悉尼（南半球低纬）
      expect(gcj2wgs(151.2093, -33.8688)).toEqual([151.2093, -33.8688]);
      expect(gcj2wgsExact(151.2093, -33.8688)).toEqual([151.2093, -33.8688]);
    });

    it('T07-中国范围内坐标参与转换', () => {
      const [glng, glat] = wgs2gcj(114.51486, 38.04228);
      expect(glng).not.toBe(114.51486);
      expect(glat).not.toBe(38.04228);
    });
  });

  describe('点位对象转换', () => {
    it('T08-wgs2gcjPoint 返回新对象不修改入参', () => {
      const p = { lng: 114.51486, lat: 38.04228 };
      const q = wgs2gcjPoint(p);
      expect(p).toEqual({ lng: 114.51486, lat: 38.04228 });
      expect(q.lng).toBeCloseTo(114.520834, 5);
      expect(q.lat).toBeCloseTo(38.042899, 5);
    });

    it('T09-gcj2wgsPoint 往返还原', () => {
      const p = { lng: 114.51486, lat: 38.04228 };
      const q = wgs2gcjPoint(p);
      const r = gcj2wgsPoint(q);
      expect(dist([r.lng, r.lat], [p.lng, p.lat])).toBeLessThan(0.0001);
    });
  });
});
