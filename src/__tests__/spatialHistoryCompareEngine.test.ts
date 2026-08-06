import { describe, expect, it } from 'vitest';
import {
  compareSpatialAnalyses,
  diffToSummary,
} from '../lib/spatialHistoryCompareEngine';
import type { SpatialAnalysisRecord } from '../stores/spatialAnalysisStore';

describe('spatialHistoryCompareEngine (S13.2)', () => {
  const oldRecord: SpatialAnalysisRecord = {
    id: 'old-1',
    name: '2025年评估',
    createdAt: '2025-01-01T00:00:00Z',
    analysisType: 'comprehensive',
    projectPoint: { lng: 114.5, lat: 38.1 },
    projectName: '某项目',
    sourceCount: 10,
    riskLevel: 'yellow',
    insideAnyZone: false,
    nearestDistanceM: 5000,
    nearestSourceName: '岗南水库',
    sensitiveCount: 2,
    upstreamOfAny: false,
  };

  const newRecord: SpatialAnalysisRecord = {
    id: 'new-1',
    name: '2026年评估',
    createdAt: '2026-01-01T00:00:00Z',
    analysisType: 'comprehensive',
    projectPoint: { lng: 114.5, lat: 38.1 },
    projectName: '某项目',
    sourceCount: 12,
    riskLevel: 'red',
    insideAnyZone: true,
    nearestDistanceM: 500,
    nearestSourceName: '岗南水库',
    sensitiveCount: 5,
    upstreamOfAny: true,
  };

  describe('compareSpatialAnalyses', () => {
    it('应检测风险等级恶化', () => {
      const diff = compareSpatialAnalyses(oldRecord, newRecord);
      expect(diff.riskDiff.direction).toBe('worsened');
      expect(diff.riskDiff.oldRisk).toBe('yellow');
      expect(diff.riskDiff.newRisk).toBe('red');
    });

    it('应检测保护区内外变化', () => {
      const diff = compareSpatialAnalyses(oldRecord, newRecord);
      const inside = diff.fieldDiffs.find((d) => d.field === 'insideAnyZone');
      expect(inside).toBeDefined();
      expect(inside!.direction).toBe('worsened');
      expect(inside!.significant).toBe(true);
    });

    it('应检测距离缩小', () => {
      const diff = compareSpatialAnalyses(oldRecord, newRecord);
      const dist = diff.fieldDiffs.find((d) => d.field === 'nearestDistanceM');
      expect(dist).toBeDefined();
      expect(dist!.direction).toBe('worsened');
    });

    it('应检测敏感目标增加', () => {
      const diff = compareSpatialAnalyses(oldRecord, newRecord);
      const sc = diff.fieldDiffs.find((d) => d.field === 'sensitiveCount');
      expect(sc).toBeDefined();
      expect(sc!.direction).toBe('worsened');
    });

    it('应检测上游状态变化', () => {
      const diff = compareSpatialAnalyses(oldRecord, newRecord);
      const up = diff.fieldDiffs.find((d) => d.field === 'upstreamOfAny');
      expect(up).toBeDefined();
      expect(up!.direction).toBe('worsened');
    });

    it('无变化时应返回unchanged', () => {
      const same: SpatialAnalysisRecord = { ...oldRecord };
      const diff = compareSpatialAnalyses(same, same);
      expect(diff.overallDirection).toBe('unchanged');
      expect(diff.changeCount).toBe(0);
    });

    it('oldRecord为null时视为首次分析', () => {
      const diff = compareSpatialAnalyses(null, newRecord);
      expect(diff.overallDirection).toBe('unchanged');
      expect(diff.riskDiff.oldRisk).toBeNull();
    });

    it('改善时应检测到improved', () => {
      const improvedRecord: SpatialAnalysisRecord = {
        ...oldRecord,
        riskLevel: 'green',
        insideAnyZone: false,
        sensitiveCount: 0,
      };
      const diff = compareSpatialAnalyses(oldRecord, improvedRecord);
      expect(diff.riskDiff.direction).toBe('improved');
      expect(diff.overallDirection).toBe('improved');
    });
  });

  describe('diffToSummary', () => {
    it('应生成可读的对比摘要', () => {
      const diff = compareSpatialAnalyses(oldRecord, newRecord);
      const summary = diffToSummary(diff);
      expect(summary).toContain('2025年评估');
      expect(summary).toContain('2026年评估');
      expect(summary).toContain('恶化');
    });
  });
});