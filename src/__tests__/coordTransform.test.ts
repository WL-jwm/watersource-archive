/**
 * S3.1: coordTransform 测试补全
 *
 * 覆盖：
 * 1. decimalToDMS — 小数度→度分秒字符串（经纬度/边界值/负数）
 * 2. decimalToDMSParts — 结构化度分秒
 * 3. decimalToGK — 高斯-克吕格正算（已知点验证/中央子午线/带号）
 * 4. autoCentralMeridian — 自动中央子午线选择
 * 5. formatCoord — 格式化坐标显示（三种格式）
 * 6. getCoordHeaders — 格式表头
 * 7. 边界值与异常输入
 */

import { describe, expect, it } from 'vitest';
import {
  decimalToDMS,
  decimalToDMSParts,
  decimalToGK,
  autoCentralMeridian,
  formatCoord,
  getCoordHeaders,
  COORD_FORMAT_OPTIONS,
  type CoordFormat,
} from '@/lib/coordTransform';

describe('S3.1 coordTransform 测试', () => {

  describe('decimalToDMS', () => {
    it('T01-经度转换正确', () => {
      // 114.523456° → 114°31'24.442"E
      const result = decimalToDMS(114.523456, true);
      expect(result).toBe('114°31\'24.442"E');
    });

    it('T02-纬度转换正确', () => {
      // 38.045678° → 38°2'44.441"N
      const result = decimalToDMS(38.045678, false);
      expect(result).toMatch(/^38°2'44\.\d{3}"N$/);
    });

    it('T03-整数度', () => {
      const result = decimalToDMS(114.0, true);
      expect(result).toBe('114°0\'0.000"E');
    });

    it('T04-零度（赤道/本初子午线）', () => {
      expect(decimalToDMS(0, true)).toBe('0°0\'0.000"E');
      expect(decimalToDMS(0, false)).toBe('0°0\'0.000"N');
    });

    it('T05-负数取绝对值（西经/南纬）', () => {
      // -114.5 → 114°30'0.000"E (取绝对值)
      const result = decimalToDMS(-114.5, true);
      expect(result).toBe('114°30\'0.000"E');
    });

    it('T06-秒值精度3位小数', () => {
      const result = decimalToDMS(114.523456789, true);
      // 秒 = 24.442 (3位小数)
      const secPart = result.match(/(\d+\.\d+)"/);
      expect(secPart).toBeTruthy();
      const sec = parseFloat(secPart![1]);
      expect(sec).toBeCloseTo(24.442, 2);
    });

    it('T07-河北省典型经纬度', () => {
      // 石家庄 114.51486°E, 38.04228°N
      const lng = decimalToDMS(114.51486, true);
      const lat = decimalToDMS(38.04228, false);
      expect(lng).toContain('114°');
      expect(lng).toContain('"E');
      expect(lat).toContain('38°');
      expect(lat).toContain('"N');
    });
  });

  describe('decimalToDMSParts', () => {
    it('T08-返回结构化度分秒', () => {
      const parts = decimalToDMSParts(114.523456);
      expect(parts.d).toBe(114);
      expect(parts.m).toBe(31);
      expect(parts.s).toBeCloseTo(24.442, 2);
    });

    it('T09-整数度分秒为零', () => {
      const parts = decimalToDMSParts(115);
      expect(parts.d).toBe(115);
      expect(parts.m).toBe(0);
      expect(parts.s).toBe(0);
    });

    it('T10-负数取绝对值', () => {
      const parts = decimalToDMSParts(-38.5);
      expect(parts.d).toBe(38);
      expect(parts.m).toBe(30);
      expect(parts.s).toBe(0);
    });
  });

  describe('decimalToGK', () => {
    it('T11-已知点高斯-克吕格正算', () => {
      // 中央子午线 114°，经度 114.5°，纬度 38°
      const result = decimalToGK(114.5, 38.0, 114);
      // X（北坐标）应在 4,200,000m 附近（38°纬度对应子午线弧长）
      expect(result.x).toBeGreaterThan(4000000);
      expect(result.x).toBeLessThan(4500000);
      // Y（东坐标含500km偏移+带号38），约 38555000
      expect(result.y).toBeGreaterThan(38500000);
      expect(result.y).toBeLessThan(38600000);
      // 带号 38
      expect(result.zone).toBe(38);
    });

    it('T12-中央子午线上Y坐标等于500km偏移+带号', () => {
      // 在中央子午线上，经差=0，Y = 带号×1e6 + 500000
      const result = decimalToGK(114.0, 38.0, 114);
      expect(result.y).toBe(38 * 1000000 + 500000);
    });

    it('T13-3°带带号计算正确', () => {
      expect(decimalToGK(114.5, 38.0, 114).zone).toBe(38);
      expect(decimalToGK(117.5, 38.0, 117).zone).toBe(39);
      expect(decimalToGK(120.5, 38.0, 120).zone).toBe(40);
    });

    it('T14-东偏移方向正确', () => {
      // 经度大于中央子午线 → Y > 500km偏移
      const east = decimalToGK(115.0, 38.0, 114);
      // 经度小于中央子午线 → Y < 500km偏移
      const west = decimalToGK(113.0, 38.0, 114);
      // 去掉带号前缀比较
      expect(east.y % 1000000).toBeGreaterThan(500000);
      expect(west.y % 1000000).toBeLessThan(500000);
    });

    it('T15-河北省三个投影带', () => {
      // 河北省跨越 114°/117°/120° 三个3°带
      const cm114 = decimalToGK(114.5, 38.0, 114);
      const cm117 = decimalToGK(117.5, 38.0, 117);
      const cm120 = decimalToGK(120.5, 38.0, 120);
      expect(cm114.zone).toBe(38);
      expect(cm117.zone).toBe(39);
      expect(cm120.zone).toBe(40);
    });

    it('T16-高精度坐标值合理性', () => {
      // 验证坐标在合理范围内（河北省范围）
      const result = decimalToGK(116.0, 39.0, 117);
      // X（北坐标）: 39°纬度约 4,300,000m
      expect(result.x).toBeGreaterThan(4200000);
      expect(result.x).toBeLessThan(4500000);
      // Y（东坐标）: 带号39 + 500km ± 偏移
      const yBase = 39 * 1000000 + 500000;
      expect(Math.abs(result.y - yBase)).toBeLessThan(200000);
    });
  });

  describe('autoCentralMeridian', () => {
    it('T17-114度区域返回114', () => {
      expect(autoCentralMeridian(113.5)).toBe(114);
      expect(autoCentralMeridian(114.0)).toBe(114);
      expect(autoCentralMeridian(114.499)).toBe(114);
    });

    it('T18-117度区域返回117', () => {
      expect(autoCentralMeridian(115.5)).toBe(117);
      expect(autoCentralMeridian(117.0)).toBe(117);
    });

    it('T19-120度区域返回120', () => {
      expect(autoCentralMeridian(119.0)).toBe(120);
      expect(autoCentralMeridian(120.0)).toBe(120);
    });

    it('T20-边界值', () => {
      // 115.5 → round(115.5/3)*3 = round(38.5)*3 = 39*3 = 117
      expect(autoCentralMeridian(115.5)).toBe(117);
      // 114.5 → round(114.5/3)*3 = round(38.17)*3 = 38*3 = 114
      expect(autoCentralMeridian(114.5)).toBe(114);
    });
  });

  describe('formatCoord', () => {
    it('T21-小数度格式', () => {
      const result = formatCoord(114.523456, 38.045678, 'decimal');
      expect(result.lng).toBe('114.523456°');
      expect(result.lat).toBe('38.045678°');
    });

    it('T22-度分秒格式', () => {
      const result = formatCoord(114.523456, 38.045678, 'dms');
      expect(result.lng).toContain('°');
      expect(result.lng).toContain('"E');
      expect(result.lat).toContain('°');
      expect(result.lat).toContain('"N');
    });

    it('T23-高斯克吕格格式', () => {
      const result = formatCoord(114.5, 38.0, 'gk', 114);
      expect(result.lng).toMatch(/^Y=\d+\.\d{3}$/);
      expect(result.lat).toMatch(/^X=\d+\.\d{3}$/);
    });

    it('T24-高斯克吕格自动中央子午线', () => {
      // 不传 centralMeridian，自动选择
      const result = formatCoord(114.5, 38.0, 'gk');
      expect(result.lng).toMatch(/^Y=\d+\.\d{3}$/);
      expect(result.lat).toMatch(/^X=\d+\.\d{3}$/);
    });

    it('T25-负数经度', () => {
      const result = formatCoord(-114.5, -38.0, 'decimal');
      expect(result.lng).toBe('-114.500000°');
      expect(result.lat).toBe('-38.000000°');
    });
  });

  describe('getCoordHeaders', () => {
    it('T26-小数度表头', () => {
      const headers = getCoordHeaders('decimal');
      expect(headers.lngHeader).toBe('东经 (°)');
      expect(headers.latHeader).toBe('北纬 (°)');
    });

    it('T27-度分秒表头', () => {
      const headers = getCoordHeaders('dms');
      expect(headers.lngHeader).toBe('东经 (°′″)');
      expect(headers.latHeader).toBe('北纬 (°′″)');
    });

    it('T28-高斯克吕格表头', () => {
      const headers = getCoordHeaders('gk');
      expect(headers.lngHeader).toBe('Y 坐标 (m)');
      expect(headers.latHeader).toBe('X 坐标 (m)');
    });
  });

  describe('COORD_FORMAT_OPTIONS', () => {
    it('T29-三个格式选项', () => {
      expect(COORD_FORMAT_OPTIONS).toHaveLength(3);
      const values = COORD_FORMAT_OPTIONS.map((o) => o.value);
      expect(values).toEqual(['decimal', 'dms', 'gk']);
    });

    it('T30-每个选项有label和description', () => {
      for (const opt of COORD_FORMAT_OPTIONS) {
        expect(opt.label).toBeTruthy();
        expect(opt.description).toBeTruthy();
      }
    });
  });
});
