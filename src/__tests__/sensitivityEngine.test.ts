import { describe, it, expect } from 'vitest';
import { analyzeSensitivity, formatSensitivityText, toChartData } from '@/lib/sensitivityEngine';
import type { CalcParams } from '@/lib/zoneCalcEngine';

// 测试用地下水参数（孔隙水，解析法）
const baseParams: CalcParams = {
  sourceType: '地下水',
  gwType: '孔隙水',
  aquiferThickness: 30,
  permeability: 5,
  storativity: 0.001,
  hydraulicGradient: 0.002,
  effectivePorosity: 0.25,
};

describe('sensitivityEngine', () => {
  describe('analyzeSensitivity', () => {
    it('孔隙水解析法应生成敏感性曲线', () => {
      const result = analyzeSensitivity('测试水源地', baseParams, '解析法');
      expect(result.sourceName).toBe('测试水源地');
      expect(result.method).toBe('解析法');
      expect(result.curves.length).toBeGreaterThan(0);
    });

    it('每条曲线应包含20个采样点', () => {
      const result = analyzeSensitivity('测试', baseParams, '解析法');
      for (const curve of result.curves) {
        expect(curve.points.length).toBe(20);
      }
    });

    it('曲线应按敏感度降序排列', () => {
      const result = analyzeSensitivity('测试', baseParams, '解析法');
      for (let i = 1; i < result.curves.length; i++) {
        expect(result.curves[i].sensitivity).toBeLessThanOrEqual(result.curves[i - 1].sensitivity);
      }
    });

    it('敏感度等级应为高/中/低', () => {
      const result = analyzeSensitivity('测试', baseParams, '解析法');
      for (const curve of result.curves) {
        expect(['高', '中', '低']).toContain(curve.sensitivityLevel);
      }
    });

    it('采样范围应以基准值为中心', () => {
      const result = analyzeSensitivity('测试', baseParams, '解析法');
      const kCurve = result.curves.find((c) => c.paramKey === 'K');
      expect(kCurve).toBeDefined();
      expect(kCurve!.baseValue).toBe(5);
      expect(kCurve!.range[0]).toBeLessThan(5);
      expect(kCurve!.range[1]).toBeGreaterThan(5);
    });

    it('每个采样点应返回一级和二级面积', () => {
      const result = analyzeSensitivity('测试', baseParams, '解析法');
      for (const curve of result.curves) {
        for (const point of curve.points) {
          expect(point).toHaveProperty('paramValue');
          expect(point).toHaveProperty('area1');
          expect(point).toHaveProperty('area2');
          expect(point.area1).toBeGreaterThanOrEqual(0);
          expect(point.area2).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('地表水应返回空曲线', () => {
      const swParams: CalcParams = {
        sourceType: '地表水',
        swType: '河流型',
        riverFlow: 10,
        riverWidth: 50,
      };
      const result = analyzeSensitivity('地表水源', swParams, '解析法');
      expect(result.curves.length).toBe(0);
    });
  });

  describe('formatSensitivityText', () => {
    it('应生成包含参数名的文本', () => {
      const result = analyzeSensitivity('测试水源地', baseParams, '解析法');
      const text = formatSensitivityText(result);
      expect(text).toContain('测试水源地');
      expect(text).toContain('解析法');
      expect(text).toContain('渗透系数');
      expect(text).toContain('基准值');
    });

    it('空曲线应返回提示信息', () => {
      const result = { sourceName: '空', method: '解析法' as const, curves: [] };
      const text = formatSensitivityText(result);
      expect(text).toContain('不支持');
    });
  });

  describe('toChartData', () => {
    it('应返回与采样点等长的图表数据', () => {
      const result = analyzeSensitivity('测试', baseParams, '解析法');
      const firstCurve = result.curves[0];
      const chartData = toChartData(firstCurve);
      expect(chartData.length).toBe(firstCurve.points.length);
      expect(chartData[0]).toHaveProperty('paramValue');
      expect(chartData[0]).toHaveProperty('area1');
      expect(chartData[0]).toHaveProperty('area2');
      expect(chartData[0]).toHaveProperty('label');
    });
  });
});
