/**
 * B2: 批量项目环评分析测试
 */

import { describe, it, expect } from 'vitest';
import { analyzeBatchProjects, type BatchProjectInput } from '@/lib/spatialAnalysis';
import type { ZoneCalcRecord, WaterSourceRecord } from '@/stores/waterSourceStore';

function makeZoneResult(
  sourceId: string,
  sourceName: string,
  lng: number,
  lat: number,
  r1: number,
): ZoneCalcRecord {
  return {
    id: `calc_${sourceId}`,
    sourceId,
    sourceName,
    params: { sourceType: '地下水', gwType: '孔隙水' } as any,
    zones: [
      {
        level: '一级',
        method: '经验值法',
        formula: 'test',
        radius: r1,
        area: Math.round(((Math.PI * r1 * r1) / 1e6) * 100) / 100,
        boundaryDescription: 'test',
        keyParams: 'test',
        standard: 'HJ 338-2018',
      },
      {
        level: '二级',
        method: '经验值法',
        formula: 'test',
        radius: r1 * 3,
        area: Math.round(((Math.PI * (r1 * 3) ** 2) / 1e6) * 100) / 100,
        boundaryDescription: 'test',
        keyParams: 'test',
        standard: 'HJ 338-2018',
      },
    ],
    calculatedAt: new Date().toISOString(),
    warnings: [],
  };
}

const sources: WaterSourceRecord[] = [
  {
    id: 's1',
    cityName: '石家庄市',
    level: 'municipal',
    name: '水源地A',
    type: '地下水',
    county: '测试',
    status: 'active',
    lng: 114.5,
    lat: 38.0,
  },
];

const zoneResults: ZoneCalcRecord[] = [makeZoneResult('s1', '水源地A', 114.5, 38.0, 500)];

describe('analyzeBatchProjects', () => {
  it('B2-01 基本批量分析应返回完整结果', () => {
    const projects: BatchProjectInput[] = [
      { name: '项目1', type: 'point', points: [{ lng: 114.51, lat: 38.01 }], radiusM: 100 },
      { name: '项目2', type: 'point', points: [{ lng: 115.0, lat: 39.0 }], radiusM: 100 },
    ];
    const result = analyzeBatchProjects(projects, zoneResults, sources);
    expect(result.totalProjects).toBe(2);
    expect(result.results).toHaveLength(2);
    expect(result.summaryTable).toHaveLength(2);
  });

  it('B2-02 点状项目在保护区外应不涉及', () => {
    const projects: BatchProjectInput[] = [
      { name: '远距项目', type: 'point', points: [{ lng: 116.0, lat: 40.0 }], radiusM: 100 },
    ];
    const result = analyzeBatchProjects(projects, zoneResults, sources);
    expect(result.results[0].hasInvolved).toBe(false);
    expect(result.results[0].highestLevel).toBe('不涉及');
  });

  it('B2-03 点状项目在一级保护区内应涉及一级', () => {
    const projects: BatchProjectInput[] = [
      { name: '近距项目', type: 'point', points: [{ lng: 114.501, lat: 38.001 }], radiusM: 0 },
    ];
    const result = analyzeBatchProjects(projects, zoneResults, sources);
    expect(result.results[0].hasInvolved).toBe(true);
    expect(result.results[0].highestLevel).toBe('一级');
  });

  it('B2-04 涉及一级保护区应有正确法规依据', () => {
    const projects: BatchProjectInput[] = [
      { name: '涉及项目', type: 'point', points: [{ lng: 114.501, lat: 38.001 }], radiusM: 0 },
    ];
    const result = analyzeBatchProjects(projects, zoneResults, sources);
    expect(result.results[0].legalBasis).toContain('水污染防治法');
    expect(result.results[0].legalBasis).toContain('第八十一条');
  });

  it('B2-05 线型工程穿越保护区应检测到涉及', () => {
    // 线型工程从保护区外穿过保护区到另一侧
    const projects: BatchProjectInput[] = [
      {
        name: '公路项目',
        type: 'linear',
        points: [
          { lng: 114.48, lat: 38.0 }, // 保护区外西侧
          { lng: 114.5, lat: 38.0 }, // 水源地中心（保护区内）
          { lng: 114.52, lat: 38.0 }, // 保护区外东侧
        ],
      },
    ];
    const result = analyzeBatchProjects(projects, zoneResults, sources);
    expect(result.results[0].hasInvolved).toBe(true);
  });

  it('B2-06 面型工程与保护区重叠应检测到涉及', () => {
    // 面型工程顶点部分在保护区内
    const projects: BatchProjectInput[] = [
      {
        name: '园区项目',
        type: 'area',
        points: [
          { lng: 114.49, lat: 38.0 },
          { lng: 114.51, lat: 38.0 },
          { lng: 114.51, lat: 38.01 },
          { lng: 114.49, lat: 38.01 },
        ],
      },
    ];
    const result = analyzeBatchProjects(projects, zoneResults, sources);
    expect(result.results[0].hasInvolved).toBe(true);
  });

  it('B2-07 批量统计应正确计数', () => {
    const projects: BatchProjectInput[] = [
      { name: '涉及项目', type: 'point', points: [{ lng: 114.501, lat: 38.001 }], radiusM: 0 },
      { name: '不涉及项目', type: 'point', points: [{ lng: 116.0, lat: 40.0 }], radiusM: 0 },
      { name: '涉及二级', type: 'point', points: [{ lng: 114.515, lat: 38.005 }], radiusM: 0 },
    ];
    const result = analyzeBatchProjects(projects, zoneResults, sources);
    expect(result.involvedCount).toBe(2);
    expect(result.notInvolvedCount).toBe(1);
  });

  it('B2-08 汇总表应包含完整字段', () => {
    const projects: BatchProjectInput[] = [
      { name: '测试项目', type: 'point', points: [{ lng: 114.501, lat: 38.001 }], radiusM: 0 },
    ];
    const result = analyzeBatchProjects(projects, zoneResults, sources);
    const row = result.summaryTable[0];
    expect(row.projectName).toBe('测试项目');
    expect(row.projectType).toBe('点状');
    expect(row.highestLevel).toBe('一级');
    expect(row.conclusion).toContain('一级保护区');
  });

  it('B2-09 不涉及项目的结论应正确', () => {
    const projects: BatchProjectInput[] = [
      { name: '安全项目', type: 'point', points: [{ lng: 116.0, lat: 40.0 }], radiusM: 0 },
    ];
    const result = analyzeBatchProjects(projects, zoneResults, sources);
    expect(result.results[0].conclusion).toContain('不涉及');
    expect(result.results[0].legalBasis).toContain('水污染防治法');
  });

  it('B2-10 空项目列表应返回空结果', () => {
    const result = analyzeBatchProjects([], zoneResults, sources);
    expect(result.totalProjects).toBe(0);
    expect(result.results).toHaveLength(0);
  });
});
