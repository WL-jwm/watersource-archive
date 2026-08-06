import { describe, expect, it } from 'vitest';
import {
  buildSpatialReport,
  buildSpatialReportSections,
  buildSpatialReportConclusion,
  type SpatialReportInput,
} from '../lib/spatialAnalysisReportEngine';
import type { RiskMatrixResult } from '../lib/riskMatrixEngine';

describe('spatialAnalysisReportEngine (S12.8)', () => {
  const riskMatrix: RiskMatrixResult = {
    projectName: '测试项目',
    overallRisk: 'red',
    zones: [
      {
        sourceName: '岗南水库',
        sourceId: 's1',
        zoneLevel: '一级',
        isOverlap: true,
        overlapAreaM2: 1200,
        edgeDistanceM: -50,
        risk: 'red',
        reason: '涉及一级保护区重叠',
      },
    ],
    hasOverlap: true,
    banned: true,
    requiresGroundwaterAssessment: true,
    conclusion: '建议重新选址',
    measures: ['禁止建设'],
  };

  const baseInput: SpatialReportInput = {
    projectName: '测试项目',
    point: { lng: 114.5, lat: 38.1 },
    riskMatrix,
  };

  describe('buildSpatialReportSections', () => {
    it('应生成分析概述章节', () => {
      const sections = buildSpatialReportSections(baseInput);
      expect(sections.length).toBeGreaterThan(0);
      expect(sections[0].heading).toBe('一、分析概述');
      expect(sections[0].paragraphs.some((p) => p.includes('测试项目'))).toBe(true);
    });

    it('应生成风险矩阵章节并包含红线结论', () => {
      const sections = buildSpatialReportSections(baseInput);
      const risk = sections.find((s) => s.heading.includes('风险矩阵'));
      expect(risk).toBeDefined();
      expect(risk!.paragraphs.some((p) => p.includes('红线'))).toBe(true);
      expect(risk!.paragraphs.some((p) => p.includes('禁止建设'))).toBe(true);
      expect(risk!.table).toBeDefined();
      expect(risk!.table!.rows.length).toBe(1);
      expect(risk!.table!.rows[0][0]).toBe('岗南水库');
    });
  });

  describe('buildSpatialReportConclusion', () => {
    it('无数据时返回提示结论', () => {
      const c = buildSpatialReportConclusion({});
      expect(c).toContain('未提供');
    });

    it('有风险矩阵时包含风险等级', () => {
      const c = buildSpatialReportConclusion({ riskMatrix });
      expect(c).toContain('红线');
    });
  });

  describe('buildSpatialReport', () => {
    it('应生成完整报告对象', () => {
      const report = buildSpatialReport(baseInput);
      expect(report.title).toBe('水源地空间分析综合报告');
      expect(report.projectName).toBe('测试项目');
      expect(report.sections.length).toBeGreaterThan(0);
      expect(report.conclusion.length).toBeGreaterThan(0);
    });

    it('应使用自定义标题', () => {
      const report = buildSpatialReport({ ...baseInput, title: '自定义报告' });
      expect(report.title).toBe('自定义报告');
    });
  });
});
