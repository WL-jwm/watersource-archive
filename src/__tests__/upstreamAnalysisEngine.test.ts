/* ===== S12.7: 汇水上游关系分析引擎测试 ===== */
import { describe, expect, it } from 'vitest';
import {
  isUpstreamDirection,
  bearingToCompassLabel,
  analyzeUpstreamRelation,
  analyzeUpstreamBatch,
  buildUpstreamConclusion,
  flowDirectionLabel,
  type WaterSource,
} from '@/lib/upstreamAnalysisEngine';

function makeSource(overrides: Partial<WaterSource> = {}): WaterSource {
  return {
    id: 's1',
    name: '岗南水库',
    lng: 114.0,
    lat: 38.0,
    flowDirection: 'N', // 自南向北
    ...overrides,
  };
}

describe('upstreamAnalysisEngine', () => {
  // ===== isUpstreamDirection =====
  describe('isUpstreamDirection', () => {
    it('流向 N（自南向北），正南侧项目为上游', () => {
      // 项目在正南(180°) = 上游来水方向
      const r = isUpstreamDirection(180, 'N');
      expect(r.isUpstream).toBe(true);
      expect(r.angleDiffDeg).toBeCloseTo(0, 5);
    });

    it('流向 N，正北侧项目为下游', () => {
      const r = isUpstreamDirection(0, 'N');
      expect(r.isUpstream).toBe(false);
      expect(r.angleDiffDeg).toBeCloseTo(180, 5);
    });

    it('流向 S（自北向南），正北侧项目为上游', () => {
      const r = isUpstreamDirection(0, 'S');
      expect(r.isUpstream).toBe(true);
    });

    it('流向 E（自西向东），正西侧项目为上游', () => {
      const r = isUpstreamDirection(270, 'E');
      expect(r.isUpstream).toBe(true);
    });

    it('流向 NE，西南侧项目为上游', () => {
      const r = isUpstreamDirection(225, 'NE');
      expect(r.isUpstream).toBe(true);
    });

    it('垂直方向（90°差）视为非上游', () => {
      const r = isUpstreamDirection(90, 'N'); // 正东，与来水南(180)差90
      expect(r.isUpstream).toBe(false);
    });
  });

  // ===== bearingToCompassLabel =====
  describe('bearingToCompassLabel', () => {
    it('方位转八方位', () => {
      expect(bearingToCompassLabel(0)).toBe('北');
      expect(bearingToCompassLabel(45)).toBe('东北');
      expect(bearingToCompassLabel(90)).toBe('东');
      expect(bearingToCompassLabel(180)).toBe('南');
      expect(bearingToCompassLabel(270)).toBe('西');
    });
  });

  // ===== analyzeUpstreamRelation =====
  describe('analyzeUpstreamRelation', () => {
    it('判断项目位于上游（南侧 + 流向N）', () => {
      // 水源地在 (114,38)，项目在正南(114,37.9)
      const result = analyzeUpstreamRelation(114.0, 37.9, makeSource());
      expect(result.isUpstream).toBe(true);
      expect(result.relation).toBe('上游');
      expect(result.sourceName).toBe('岗南水库');
    });

    it('判断项目位于下游（北侧 + 流向N）', () => {
      const result = analyzeUpstreamRelation(114.0, 38.1, makeSource());
      expect(result.isUpstream).toBe(false);
      expect(result.relation).toBe('下游/侧向');
    });

    it('置信度在0-1之间', () => {
      const result = analyzeUpstreamRelation(114.0, 37.9, makeSource());
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('包含判断原因', () => {
      const result = analyzeUpstreamRelation(114.0, 37.9, makeSource());
      expect(result.reason).toContain('自南向北');
    });
  });

  // ===== analyzeUpstreamBatch =====
  describe('analyzeUpstreamBatch', () => {
    it('批量判断多个水源地', () => {
      const result = analyzeUpstreamBatch({
        projectLng: 114.0,
        projectLat: 37.9,
        sources: [
          makeSource({ id: 's1', flowDirection: 'N' }),
          makeSource({ id: 's2', lng: 115.0, lat: 38.5, flowDirection: 'S' }),
        ],
      });
      expect(result.results).toHaveLength(2);
      expect(result.upstreamOfAny).toBe(true);
      // s1 上游（南侧+流向N）
      expect(result.upstreamSources.some((r) => r.sourceId === 's1')).toBe(true);
    });

    it('全部非上游时 upstreamOfAny 为 false', () => {
      const result = analyzeUpstreamBatch({
        projectLng: 114.0,
        projectLat: 38.2, // 北侧
        sources: [makeSource({ flowDirection: 'N' })], // 下游
      });
      expect(result.upstreamOfAny).toBe(false);
      expect(result.upstreamSources).toHaveLength(0);
    });
  });

  // ===== buildUpstreamConclusion =====
  describe('buildUpstreamConclusion', () => {
    it('无上游时给出低影响结论', () => {
      const batch = analyzeUpstreamBatch({
        projectLng: 114.0,
        projectLat: 38.2,
        sources: [makeSource({ flowDirection: 'N' })],
      });
      const text = buildUpstreamConclusion(batch);
      expect(text).toContain('下游');
    });

    it('高置信度上游给出风险提示', () => {
      const batch = analyzeUpstreamBatch({
        projectLng: 114.0,
        projectLat: 37.9,
        sources: [makeSource({ flowDirection: 'N' })],
      });
      const text = buildUpstreamConclusion(batch);
      expect(text).toContain('上游');
      expect(text).toContain('风险');
    });
  });

  // ===== flowDirectionLabel =====
  describe('flowDirectionLabel', () => {
    it('流向中文', () => {
      expect(flowDirectionLabel('N')).toBe('自南向北');
      expect(flowDirectionLabel('S')).toBe('自北向南');
      expect(flowDirectionLabel('NE')).toBe('自西南向东北');
    });
  });
});
