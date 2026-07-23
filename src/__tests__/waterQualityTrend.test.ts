/**
 * A3: 水质趋势分析测试
 */

import { describe, it, expect } from 'vitest';
import { analyzeTrend, GW_STANDARD_III, type WaterQualityHistory } from '@/lib/waterQualityTrend';

function makeHistory(
  sourceName: string,
  periods: Array<{ label: string; date: string; indicators: Record<string, number> }>,
): WaterQualityHistory {
  return {
    sourceId: 'test',
    sourceName,
    periods,
  };
}

describe('analyzeTrend', () => {
  it('A3-01 基本趋势分析应返回完整报告', () => {
    const history = makeHistory('测试水源地', [
      { label: '2024年枯水期', date: '2024-03-01', indicators: { 氨氮: 0.3, 总硬度: 300 } },
      { label: '2024年丰水期', date: '2024-08-01', indicators: { 氨氮: 0.4, 总硬度: 320 } },
    ]);
    const report = analyzeTrend(history);
    expect(report.sourceName).toBe('测试水源地');
    expect(report.periodCount).toBe(2);
    expect(report.indicators.length).toBe(2);
    expect(report.dateRange).toContain('2024年枯水期');
  });

  it('A3-02 单期数据应返回不足提示', () => {
    const history = makeHistory('单期水源地', [
      { label: '2024年枯水期', date: '2024-03-01', indicators: { 氨氮: 0.3 } },
    ]);
    const report = analyzeTrend(history);
    expect(report.warnings).toContain('至少需要2期监测数据才能进行趋势分析');
    expect(report.indicators).toHaveLength(0);
  });

  it('A3-03 氨氮上升趋势应被检测到', () => {
    const history = makeHistory('劣化水源地', [
      { label: '2023年', date: '2023-03-01', indicators: { 氨氮: 0.2 } },
      { label: '2024年', date: '2024-03-01', indicators: { 氨氮: 0.6 } },
    ]);
    const report = analyzeTrend(history);
    const nh3 = report.indicators.find((i) => i.indicator === '氨氮')!;
    expect(nh3.trend).toBe('上升');
    expect(nh3.slope).toBeGreaterThan(0);
  });

  it('A3-04 持续超标应被检测到', () => {
    const history = makeHistory('超标水源地', [
      { label: '2023年', date: '2023-03-01', indicators: { 氨氮: 0.6 } },
      { label: '2024年', date: '2024-03-01', indicators: { 氨氮: 0.8 } },
    ]);
    const report = analyzeTrend(history);
    expect(report.persistentExceedanceIndicators).toContain('氨氮');
    const nh3 = report.indicators.find((i) => i.indicator === '氨氮')!;
    expect(nh3.exceedCount).toBe(2);
    expect(nh3.exceedRate).toBe(100);
    expect(nh3.isPersistentExceedance).toBe(true);
  });

  it('A3-05 劣化指标应触发预警', () => {
    const history = makeHistory('劣化水源地', [
      { label: '2023年', date: '2023-03-01', indicators: { 氨氮: 0.2 } },
      { label: '2024年', date: '2024-03-01', indicators: { 氨氮: 0.7 } },
    ]);
    const report = analyzeTrend(history);
    expect(report.degradedIndicators).toContain('氨氮');
    expect(report.warnings.some((w) => w.includes('劣化预警'))).toBe(true);
  });

  it('A3-06 稳定水质应有稳定评价', () => {
    const history = makeHistory('稳定水源地', [
      { label: '2023年', date: '2023-03-01', indicators: { 总硬度: 300 } },
      { label: '2024年', date: '2024-03-01', indicators: { 总硬度: 305 } },
    ]);
    const report = analyzeTrend(history);
    expect(report.degradedIndicators).toHaveLength(0);
    expect(report.persistentExceedanceIndicators).toHaveLength(0);
    expect(report.overallAssessment).toContain('稳定');
  });

  it('A3-07 超标率应正确计算', () => {
    const history = makeHistory('超标水源地', [
      { label: '期1', date: '2023-01-01', indicators: { 氨氮: 0.3 } },
      { label: '期2', date: '2023-06-01', indicators: { 氨氮: 0.6 } },
      { label: '期3', date: '2024-01-01', indicators: { 氨氮: 0.4 } },
      { label: '期4', date: '2024-06-01', indicators: { 氨氮: 0.7 } },
    ]);
    const report = analyzeTrend(history);
    const nh3 = report.indicators.find((i) => i.indicator === '氨氮')!;
    expect(nh3.exceedCount).toBe(2);
    expect(nh3.exceedRate).toBe(50);
  });

  it('A3-08 R²拟合优度应合理', () => {
    const history = makeHistory('测试', [
      { label: '期1', date: '2023-01-01', indicators: { 氨氮: 0.1 } },
      { label: '期2', date: '2023-06-01', indicators: { 氨氮: 0.2 } },
      { label: '期3', date: '2024-01-01', indicators: { 氨氮: 0.3 } },
      { label: '期4', date: '2024-06-01', indicators: { 氨氮: 0.4 } },
    ]);
    const report = analyzeTrend(history);
    const nh3 = report.indicators.find((i) => i.indicator === '氨氮')!;
    // 完美线性，R²应接近1
    expect(nh3.rSquared).toBeGreaterThan(0.95);
    expect(nh3.slope).toBeCloseTo(0.1, 4);
  });

  it('A3-09 等级变化应正确判定', () => {
    const history = makeHistory('等级变化', [
      { label: '期1', date: '2023-01-01', indicators: { 氨氮: 0.3 } }, // III类
      { label: '期2', date: '2024-01-01', indicators: { 氨氮: 0.6 } }, // IV类(0.5<0.6<=0.75)
    ]);
    const report = analyzeTrend(history);
    const nh3 = report.indicators.find((i) => i.indicator === '氨氮')!;
    expect(nh3.gradeChange).toContain('III类');
    expect(nh3.gradeChange).toContain('IV类');
  });

  it('A3-10 GB/T 14848标准值应正确', () => {
    expect(GW_STANDARD_III['氨氮']).toBe(0.5);
    expect(GW_STANDARD_III['总硬度']).toBe(450);
    expect(GW_STANDARD_III['氟化物']).toBe(1.0);
  });
});
