import { describe, it, expect } from 'vitest';
import {
  generateEAConclusion,
  formatConclusionText,
  type EAFinalConclusion,
} from '@/lib/eaConclusionEngine';
import type { ZoneCalcRecord, WaterSourceRecord } from '@/stores/waterSourceStore';
import type { ComplianceReport } from '@/lib/complianceChecker';
import type { SourceClipResult } from '@/lib/zoneClipEngine';

function makeSource(overrides: Partial<WaterSourceRecord> = {}): WaterSourceRecord {
  return {
    id: 's1',
    cityName: '石家庄市',
    level: 'municipal',
    name: '岗南水库',
    type: '地表水',
    subType: '湖库型',
    county: '平山县',
    status: '在用',
    population: 500000,
    river: '滹沱河',
    lng: 114.21,
    lat: 38.27,
    dataVersion: 1,
    ...overrides,
  };
}

function makeZoneResult(overrides: Partial<ZoneCalcRecord> = {}): ZoneCalcRecord {
  return {
    id: 'zr1',
    sourceId: 's1',
    sourceName: '岗南水库',
    zones: [
      { level: '一级', area: 0.3, radius: 300, method: '经验值法', formula: 'r=300m', boundaryDescription: '', keyParams: '', standard: 'HJ 338-2018' },
      { level: '二级', area: 2.0, radius: 1000, method: '经验值法', formula: 'R=1000m', boundaryDescription: '', keyParams: '', standard: 'HJ 338-2018' },
    ],
    params: { sourceType: '地表水', swType: '湖库型' } as never,
    calculatedAt: '2024-01-15T10:00:00Z',
    warnings: [],
    ...overrides,
  };
}

describe('eaConclusionEngine - 环评结论自动判定', () => {
  describe('generateEAConclusion', () => {
    it('T01-正常数据判定为符合', () => {
      const sources = [makeSource()];
      const results = [makeZoneResult()];
      const conclusion = generateEAConclusion(results, sources);
      expect(conclusion.conclusion).toBe('符合');
      expect(conclusion.confidence).toBeGreaterThan(80);
    });

    it('T02-缺少一级保护区判定为不符合', () => {
      const sources = [makeSource()];
      const results = [makeZoneResult({
        zones: [{ level: '二级', area: 2.0, radius: 1000, method: '经验值法', formula: '', boundaryDescription: '', keyParams: '', standard: 'HJ 338-2018' }],
      })];
      const conclusion = generateEAConclusion(results, sources);
      expect(conclusion.conclusion).toBe('不符合');
      expect(conclusion.keyIssues.some((i) => i.includes('一级保护区'))).toBe(true);
    });

    it('T03-一级面积大于二级判定为需调整', () => {
      const sources = [makeSource()];
      const results = [makeZoneResult({
        zones: [
          { level: '一级', area: 5.0, radius: 300, method: '经验值法', formula: '', boundaryDescription: '', keyParams: '', standard: 'HJ 338-2018' },
          { level: '二级', area: 2.0, radius: 1000, method: '经验值法', formula: '', boundaryDescription: '', keyParams: '', standard: 'HJ 338-2018' },
        ],
      })];
      const conclusion = generateEAConclusion(results, sources);
      expect(conclusion.conclusion).not.toBe('符合');
      expect(conclusion.checks.some((c) => c.detail.includes('大于二级'))).toBe(true);
    });

    it('T04-湖库型面积偏大产生警告', () => {
      const sources = [makeSource({ type: '地表水', subType: '湖库型' })];
      const results = [makeZoneResult({
        zones: [
          { level: '一级', area: 8.0, radius: 300, method: '经验值法', formula: '', boundaryDescription: '', keyParams: '', standard: 'HJ 338-2018' },
          { level: '二级', area: 20.0, radius: 1000, method: '经验值法', formula: '', boundaryDescription: '', keyParams: '', standard: 'HJ 338-2018' },
        ],
      })];
      const conclusion = generateEAConclusion(results, sources);
      expect(conclusion.checks.some((c) => c.detail.includes('偏大'))).toBe(true);
    });

    it('T05-地下水面积偏大产生警告', () => {
      const sources = [makeSource({ type: '地下水', subType: '孔隙水' })];
      const results = [makeZoneResult({
        sourceName: '地下水测试井',
        zones: [
          { level: '一级', area: 3.0, radius: 50, method: '解析法', formula: '', boundaryDescription: '', keyParams: '', standard: 'HJ 338-2018' },
          { level: '二级', area: 10.0, radius: 200, method: '解析法', formula: '', boundaryDescription: '', keyParams: '', standard: 'HJ 338-2018' },
        ],
        params: { sourceType: '地下水' } as never,
      })];
      const conclusion = generateEAConclusion(results, sources);
      expect(conclusion.checks.some((c) => c.detail.includes('偏大'))).toBe(true);
    });

    it('T06-缺少坐标数据判定为需调整', () => {
      const sources = [makeSource({ lng: 0, lat: 0 })];
      const results = [makeZoneResult()];
      const conclusion = generateEAConclusion(results, sources);
      expect(conclusion.checks.some((c) => c.detail.includes('坐标'))).toBe(true);
    });

    it('T07-行政区划裁剪比例低产生警告', () => {
      const sources = [makeSource()];
      const results = [makeZoneResult()];
      const clipResults: SourceClipResult[] = [{
        sourceName: '岗南水库',
        sourceId: 's1',
        cityName: '石家庄市',
        zones: [
          { sourceName: '岗南水库', cityName: '石家庄市', level: '一级', originalArea: 1.0, clippedArea: 0.3, clipRatio: 0.3, clippedCoordinates: [], isClipped: true },
        ],
      }];
      const conclusion = generateEAConclusion(results, sources, null, clipResults);
      expect(conclusion.checks.some((c) => c.detail.includes('跨区域'))).toBe(true);
    });

    it('T08-计算警告被纳入检查', () => {
      const sources = [makeSource()];
      const results = [makeZoneResult({ warnings: ['参数K值超出推荐范围', '影响半径偏大'] })];
      const conclusion = generateEAConclusion(results, sources);
      expect(conclusion.checks.some((c) => c.detail.includes('参数K值'))).toBe(true);
    });

    it('T09-空参数判定为需调整', () => {
      const sources = [makeSource()];
      const results = [makeZoneResult({ params: {} as never })];
      const conclusion = generateEAConclusion(results, sources);
      expect(conclusion.checks.some((c) => c.detail.includes('计算参数'))).toBe(true);
    });

    it('T10-多水源地覆盖率检查', () => {
      const sources = [
        makeSource({ id: 's1', name: '岗南水库' }),
        makeSource({ id: 's2', name: '黄壁庄水库' }),
        makeSource({ id: 's3', name: '西大洋水库' }),
      ];
      const results = [
        makeZoneResult({ sourceId: 's1', sourceName: '岗南水库' }),
        makeZoneResult({ id: 'zr2', sourceId: 's2', sourceName: '黄壁庄水库' }),
      ];
      const conclusion = generateEAConclusion(results, sources);
      expect(conclusion.checks.some((c) => c.detail.includes('西大洋水库'))).toBe(true);
    });

    it('T11-合规性报告整合', () => {
      const sources = [makeSource()];
      const results = [makeZoneResult()];
      const compliance: ComplianceReport = {
        checkedAt: '2024-01-01',
        totalCount: 1,
        passCount: 0,
        warningCount: 1,
        errorCount: 0,
        infoCount: 0,
        conclusion: '基本合格',
        items: [{
          sourceId: 's1',
          sourceName: '岗南水库',
          checks: [{
            id: 'check1',
            name: '半径合规性',
            severity: 'warning',
            message: '一级保护区半径200m低于推荐值300m',
            suggestion: '建议调整半径至300m',
            standard: 'HJ 338-2018 表2',
          }] as any,
        }],
      };
      const conclusion = generateEAConclusion(results, sources, compliance);
      expect(conclusion.checks.some((c) => c.dimension === '合规性检查')).toBe(true);
    });

    it('T12-生成时间戳存在', () => {
      const conclusion = generateEAConclusion([makeZoneResult()], [makeSource()]);
      expect(conclusion.generatedAt).toBeTruthy();
      expect(new Date(conclusion.generatedAt).getTime()).not.toBeNaN();
    });
  });

  describe('formatConclusionText', () => {
    it('T13-格式化结论包含总体结论', () => {
      const conclusion = generateEAConclusion([makeZoneResult()], [makeSource()]);
      const text = formatConclusionText(conclusion);
      expect(text).toContain('总体结论');
      expect(text).toContain('符合');
    });

    it('T14-格式化结论包含各维度', () => {
      const conclusion = generateEAConclusion([makeZoneResult()], [makeSource()]);
      const text = formatConclusionText(conclusion);
      expect(text).toContain('保护区完整性');
      expect(text).toContain('维度');
    });

    it('T15-有关键问题时格式化输出', () => {
      const sources = [makeSource()];
      const results = [makeZoneResult({
        zones: [{ level: '二级', area: 2.0, radius: 1000, method: '经验值法', formula: '', boundaryDescription: '', keyParams: '', standard: 'HJ 338-2018' }],
      })];
      const conclusion = generateEAConclusion(results, sources);
      const text = formatConclusionText(conclusion);
      expect(text).toContain('关键问题');
    });

    it('T16-有建议措施时格式化输出', () => {
      const sources = [makeSource({ lng: 0, lat: 0 })];
      const results = [makeZoneResult()];
      const conclusion = generateEAConclusion(results, sources);
      const text = formatConclusionText(conclusion);
      expect(text).toContain('建议措施');
    });
  });
});
