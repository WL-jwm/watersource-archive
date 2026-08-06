import { describe, it, expect } from 'vitest';
import {
  computeProjectScore,
  assessSingleProject,
  assessProjectsBatch,
  assessmentToCsv,
  type MultiProjectAssessmentInput,
} from '../lib/multiProjectAssessmentEngine';
import type { SensitiveTarget } from '../lib/sensitiveScreeningEngine';
import type { WaterSource, FlowDirection } from '../lib/upstreamAnalysisEngine';

describe('multiProjectAssessmentEngine (S12.10)', () => {
  const zones = [
    {
      sourceId: 'z1',
      sourceName: '岗南水库',
      level: '一级',
      centerLng: 114.0,
      centerLat: 38.0,
      radiusM: 2000,
    },
  ];

  const sensitiveTargets: SensitiveTarget[] = [
    { id: 't1', name: '学校', lng: 114.05, lat: 38.05, category: 'school' },
    { id: 't2', name: '医院', lng: 114.5, lat: 38.1, category: 'hospital' },
  ];

  const waterSources: WaterSource[] = [
    {
      id: 'w1',
      name: '岗南水库',
      lng: 114.0,
      lat: 38.0,
      flowDirection: 'N' as FlowDirection,
    },
  ];

  const input: MultiProjectAssessmentInput = {
    projects: [
      { id: 'p1', name: '项目A(区内)', lng: 114.0, lat: 38.0, radiusM: 100, type: '工业' },
      { id: 'p2', name: '项目B(区外)', lng: 114.5, lat: 38.1, type: '住宅' },
      { id: 'p3', name: '项目C(上游)', lng: 113.9, lat: 37.9, type: '化工' },
    ],
    zones,
    sensitiveTargets,
    waterSources,
  };

  describe('computeProjectScore', () => {
    it('红线权重最高', () => {
      expect(computeProjectScore('red')).toBeGreaterThan(computeProjectScore('yellow'));
      expect(computeProjectScore('yellow')).toBeGreaterThan(computeProjectScore('green'));
    });

    it('禁止建设应显著加分', () => {
      const base = computeProjectScore('yellow');
      const banned = computeProjectScore('yellow', { banned: true });
      expect(banned).toBeGreaterThan(base);
    });

    it('上游与敏感目标应加分', () => {
      const base = computeProjectScore('green');
      const up = computeProjectScore('green', { upstreamOfAny: true, sensitiveCount: 2 });
      expect(up).toBeGreaterThan(base);
    });
  });

  describe('assessSingleProject', () => {
    it('区内项目应判定重叠且高得分', () => {
      const r = assessSingleProject(input.projects[0], {
        zones,
        sensitiveTargets,
        waterSources,
      });
      expect(r.hasOverlap).toBe(true);
      expect(r.overallRisk).toBe('red');
      expect(r.banned).toBe(true);
      expect(r.score).toBeGreaterThan(100);
      expect(r.nearestSourceName).toBe('岗南水库');
    });

    it('区外项目不重叠但可识别敏感目标', () => {
      const r = assessSingleProject(input.projects[1], {
        zones,
        sensitiveTargets,
        waterSources,
      });
      expect(r.hasOverlap).toBe(false);
      expect(r.sensitiveCount).toBeGreaterThan(0);
    });
  });

  describe('assessProjectsBatch', () => {
    it('应按风险排序，危险项目在前', () => {
      const result = assessProjectsBatch(input);
      expect(result.totalProjects).toBe(3);
      expect(result.riskCounts.red).toBe(1);
      expect(result.results.length).toBe(3);
      // 区内项目得分更高，应排在最前
      expect(result.results[0].projectName).toBe('项目A(区内)');
      expect(result.summaryTable.length).toBe(3);
    });

    it('统计字段正确', () => {
      const result = assessProjectsBatch(input);
      expect(result.overlapCount).toBe(1);
      expect(result.bannedCount).toBe(1);
      expect(result.groundwaterAssessmentCount).toBe(1);
      expect(result.upstreamCount).toBeGreaterThan(0);
      expect(result.sensitiveInvolvedCount).toBeGreaterThan(0);
    });
  });

  describe('assessmentToCsv', () => {
    it('应生成包含表头的CSV', () => {
      const result = assessProjectsBatch(input);
      const csv = assessmentToCsv(result);
      expect(csv).toContain('项目');
      expect(csv).toContain('风险');
      expect(csv).toContain('项目A(区内)');
    });
  });
});
