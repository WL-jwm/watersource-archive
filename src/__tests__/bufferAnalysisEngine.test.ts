import { describe, it, expect } from 'vitest';
import { analyzeBuffer, SENSITIVE_TARGET_TEMPLATES } from '@/lib/bufferAnalysisEngine';
import type { SensitiveTarget } from '@/lib/bufferAnalysisEngine';
import type { SourceZoneVertices } from '@/lib/zoneCoordGenerator';

// 测试用保护区数据（以114.5, 38.0为中心，半径500m的圆形保护区）
const mockSource: SourceZoneVertices = {
  sourceId: 'test-001',
  sourceName: '测试水源地',
  centerLng: 114.5,
  centerLat: 38.0,
  zones: [
    {
      level: '一级',
      method: '经验值法',
      formula: '经验值法',
      radius: 300,
      area: 0.2827,
      centerLng: 114.5,
      centerLat: 38.0,
      vertices: [], // 圆形保护区用radius而非vertices
      boundaryDescription: '以取水口为圆心，300m为半径的圆形区域',
      keyParams: '半径=300m',
      standard: 'HJ 338-2018',
    },
    {
      level: '二级',
      method: '经验值法',
      formula: '经验值法',
      radius: 500,
      area: 0.7854,
      centerLng: 116.0,
      centerLat: 39.0,
      vertices: [],
      boundaryDescription: '以取水口为圆心，500m为半径的圆形区域',
      keyParams: '半径=500m',
      standard: 'HJ 338-2018',
    },
  ],
};

describe('bufferAnalysisEngine', () => {
  describe('analyzeBuffer', () => {
    it('应返回所有目标的分析结果', () => {
      const targets: SensitiveTarget[] = [
        { id: 't1', name: '学校', type: '学校', lng: 114.501, lat: 38.0 },
        { id: 't2', name: '医院', type: '医院', lng: 114.52, lat: 38.0 },
      ];
      const result = analyzeBuffer(targets, [mockSource]);
      expect(result.results.length).toBe(2);
    });

    it('保护区内目标应标记为高危', () => {
      // 距中心约100m，在一级保护区内
      const targets: SensitiveTarget[] = [
        { id: 't1', name: '区内学校', type: '学校', lng: 114.501, lat: 38.0 },
      ];
      const result = analyzeBuffer(targets, [mockSource]);
      expect(result.results[0].insideZone).toBe(true);
      expect(result.results[0].alertLevel).toBe('高危');
    });

    it('远离保护区的目标应标记为安全', () => {
      // 距中心约5km，远超保护区
      const targets: SensitiveTarget[] = [
        { id: 't1', name: '远处工厂', type: '工业企业', lng: 114.56, lat: 38.0 },
      ];
      const result = analyzeBuffer(targets, [mockSource]);
      expect(result.results[0].alertLevel).toBe('安全');
      expect(result.results[0].insideZone).toBe(false);
    });

    it('应正确统计预警数量', () => {
      const targets: SensitiveTarget[] = [
        { id: 't1', name: '区内', type: '学校', lng: 114.501, lat: 38.0 }, // 高危
        { id: 't2', name: '近距', type: '医院', lng: 114.504, lat: 38.0 }, // 高危(<500m)
        { id: 't3', name: '中距', type: '居民区', lng: 114.51, lat: 38.0 }, // 关注(500-1000m)
        { id: 't4', name: '远距', type: '工业企业', lng: 114.56, lat: 38.0 }, // 安全(>1000m)
      ];
      const result = analyzeBuffer(targets, [mockSource]);
      expect(result.highRiskCount).toBeGreaterThanOrEqual(2);
      expect(result.safeCount).toBeGreaterThanOrEqual(1);
      expect(result.insideCount).toBeGreaterThanOrEqual(1);
    });

    it('空目标列表应返回零值统计', () => {
      const result = analyzeBuffer([], [mockSource]);
      expect(result.results.length).toBe(0);
      expect(result.highRiskCount).toBe(0);
      expect(result.watchCount).toBe(0);
      expect(result.safeCount).toBe(0);
    });

    it('无保护区时应返回安全', () => {
      const targets: SensitiveTarget[] = [
        { id: 't1', name: '目标', type: '学校', lng: 114.5, lat: 38.0 },
      ];
      const result = analyzeBuffer(targets, []);
      expect(result.results[0].alertLevel).toBe('安全');
      expect(result.results[0].nearestZone).toBe('无保护区');
    });

    it('应返回最近保护区名称', () => {
      const targets: SensitiveTarget[] = [
        { id: 't1', name: '目标', type: '学校', lng: 114.501, lat: 38.0 },
      ];
      const result = analyzeBuffer(targets, [mockSource]);
      expect(result.results[0].nearestZone).toBe('测试水源地');
    });

    it('应返回最近保护区级别', () => {
      const targets: SensitiveTarget[] = [
        { id: 't1', name: '目标', type: '学校', lng: 114.501, lat: 38.0 },
      ];
      const result = analyzeBuffer(targets, [mockSource]);
      expect(['一级', '二级', '准保护区']).toContain(result.results[0].nearestZoneLevel);
    });
  });

  describe('SENSITIVE_TARGET_TEMPLATES', () => {
    it('应包含7种敏感目标类型', () => {
      expect(SENSITIVE_TARGET_TEMPLATES.length).toBe(7);
    });

    it('每种类型应包含示例', () => {
      for (const template of SENSITIVE_TARGET_TEMPLATES) {
        expect(template.examples.length).toBeGreaterThan(0);
      }
    });

    it('应包含学校和医院类型', () => {
      const types = SENSITIVE_TARGET_TEMPLATES.map((t) => t.type);
      expect(types).toContain('学校');
      expect(types).toContain('医院');
      expect(types).toContain('工业企业');
      expect(types).toContain('加油站');
    });
  });
});
