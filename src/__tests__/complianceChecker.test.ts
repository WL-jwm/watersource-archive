/**
 * B3: 保护区合规性检查测试
 */

import { describe, it, expect } from 'vitest';
import { runComplianceCheck } from '@/lib/complianceChecker';
import type { ZoneCalcRecord, WaterSourceRecord } from '@/stores/waterSourceStore';
import type { ZoneResult } from '@/lib/zoneCalcEngine';

// 辅助：创建ZoneResult
function makeZone(level: string, radius?: number, area?: number): ZoneResult {
  return {
    level: level as '一级' | '二级' | '准保护区',
    method: '经验值法',
    formula: 'test',
    radius,
    area: area || (radius ? Math.round(((Math.PI * radius * radius) / 1e6) * 100) / 100 : 1.0),
    boundaryDescription: 'test',
    keyParams: 'test',
    standard: 'HJ 338-2018',
  };
}

// 辅助：创建ZoneCalcRecord
function makeRecord(
  id: string,
  name: string,
  sourceType: '地下水' | '地表水',
  gwType?: string,
  swType?: string,
  z1Radius?: number,
): ZoneCalcRecord {
  return {
    id: `calc_${id}`,
    sourceId: id,
    sourceName: name,
    params: {
      sourceType,
      gwType: gwType as any,
      swType: swType as any,
    } as any,
    zones: [
      makeZone('一级', z1Radius),
      makeZone('二级', (z1Radius || 50) * 3),
      makeZone('准保护区', (z1Radius || 50) * 4),
    ],
    calculatedAt: new Date().toISOString(),
    warnings: [],
  };
}

// 辅助：创建WaterSourceRecord
function makeSource(id: string, name: string, lng?: number, lat?: number): WaterSourceRecord {
  return {
    id,
    cityName: '石家庄市',
    level: 'municipal',
    name,
    type: '地下水',
    county: '测试县',
    status: 'active',
    lng,
    lat,
  };
}

describe('runComplianceCheck', () => {
  it('B3-01 基本检查应返回完整报告', () => {
    const records = [makeRecord('s1', '水源地A', '地下水', '孔隙水', undefined, 50)];
    const sources = [makeSource('s1', '水源地A', 114.5, 38.0)];
    const report = runComplianceCheck(records, sources);
    expect(report.totalCount).toBe(1);
    expect(report.items).toHaveLength(1);
    expect(report.items[0].checks).toHaveLength(6);
  });

  it('B3-02 地下水孔隙水半径30m应合格', () => {
    const records = [makeRecord('s1', '水源地A', '地下水', '孔隙水', undefined, 30)];
    const sources = [makeSource('s1', '水源地A', 114.5, 38.0)];
    const report = runComplianceCheck(records, sources);
    const radiusCheck = report.items[0].checks.find((c) => c.id === 'radius')!;
    expect(radiusCheck.severity).toBe('pass');
  });

  it('B3-03 地下水孔隙水半径20m应不合规', () => {
    const records = [makeRecord('s1', '水源地A', '地下水', '孔隙水', undefined, 20)];
    const sources = [makeSource('s1', '水源地A', 114.5, 38.0)];
    const report = runComplianceCheck(records, sources);
    const radiusCheck = report.items[0].checks.find((c) => c.id === 'radius')!;
    expect(radiusCheck.severity).toBe('error');
    expect(radiusCheck.message).toContain('30');
  });

  it('B3-04 岩溶水半径80m应不合规（下限100m）', () => {
    const records = [makeRecord('s1', '水源地A', '地下水', '岩溶水', undefined, 80)];
    const sources = [makeSource('s1', '水源地A', 114.5, 38.0)];
    const report = runComplianceCheck(records, sources);
    const radiusCheck = report.items[0].checks.find((c) => c.id === 'radius')!;
    expect(radiusCheck.severity).toBe('error');
    expect(radiusCheck.message).toContain('100');
  });

  it('B3-05 面积偏离200%应预警', () => {
    const records = [
      makeRecord('s1', '水源地A', '地下水', '孔隙水', undefined, 50),
      makeRecord('s2', '水源地B', '地下水', '孔隙水', undefined, 50),
      makeRecord('s3', '水源地C', '地下水', '孔隙水', undefined, 500), // 偏离很大
    ];
    const sources = [
      makeSource('s1', '水源地A', 114.5, 38.0),
      makeSource('s2', '水源地B', 114.6, 38.1),
      makeSource('s3', '水源地C', 114.7, 38.2),
    ];
    const report = runComplianceCheck(records, sources);
    const areaCheck = report.items[2].checks.find((c) => c.id === 'area')!;
    expect(areaCheck.severity).toBe('warning');
  });

  it('B3-06 两个近距水源地应检测到重叠', () => {
    const records = [
      makeRecord('s1', '水源地A', '地下水', '孔隙水', undefined, 500),
      makeRecord('s2', '水源地B', '地下水', '孔隙水', undefined, 500),
    ];
    const sources = [
      makeSource('s1', '水源地A', 114.5, 38.0),
      makeSource('s2', '水源地B', 114.502, 38.001), // 约200m间距
    ];
    const report = runComplianceCheck(records, sources);
    const overlapCheck = report.items[0].checks.find((c) => c.id === 'overlap')!;
    expect(overlapCheck.severity).toBe('warning');
    expect(overlapCheck.message).toContain('重叠');
  });

  it('B3-07 两个远距水源地应无重叠', () => {
    const records = [
      makeRecord('s1', '水源地A', '地下水', '孔隙水', undefined, 100),
      makeRecord('s2', '水源地B', '地下水', '孔隙水', undefined, 100),
    ];
    const sources = [
      makeSource('s1', '水源地A', 114.5, 38.0),
      makeSource('s2', '水源地B', 114.8, 38.3), // 约35km间距
    ];
    const report = runComplianceCheck(records, sources);
    const overlapCheck = report.items[0].checks.find((c) => c.id === 'overlap')!;
    expect(overlapCheck.severity).toBe('pass');
  });

  it('B3-08 拐点数据检查-数量不足应报错', () => {
    const records = [makeRecord('s1', '水源地A', '地下水', '孔隙水', undefined, 50)];
    const sources = [makeSource('s1', '水源地A', 114.5, 38.0)];
    const verticesData = [
      {
        sourceId: 's1',
        zones: [
          {
            level: '一级',
            vertices: Array.from({ length: 8 }, (_, i) => ({
              lng: 114.5 + i * 0.001,
              lat: 38.0 + i * 0.001,
            })),
          },
        ],
      },
    ];
    const report = runComplianceCheck(records, sources, { verticesData });
    const vertexCheck = report.items[0].checks.find((c) => c.id === 'vertex')!;
    expect(vertexCheck.severity).toBe('error');
    expect(vertexCheck.message).toContain('8');
  });

  it('B3-09 拐点数据检查-数量充足应合格', () => {
    const records = [makeRecord('s1', '水源地A', '地下水', '孔隙水', undefined, 50)];
    const sources = [makeSource('s1', '水源地A', 114.5, 38.0)];
    // 24个点，首尾相同（闭合误差=0）
    const verticesData = [
      {
        sourceId: 's1',
        zones: [
          {
            level: '一级',
            vertices: Array.from({ length: 25 }, (_, i) => {
              const angle = (2 * Math.PI * i) / 24;
              return {
                lng: Math.round((114.5 + 0.005 * Math.sin(angle)) * 1e6) / 1e6,
                lat: Math.round((38.0 + 0.005 * Math.cos(angle)) * 1e6) / 1e6,
              };
            }),
          },
        ],
      },
    ];
    const report = runComplianceCheck(records, sources, { verticesData });
    const vertexCheck = report.items[0].checks.find((c) => c.id === 'vertex')!;
    expect(vertexCheck.severity).toBe('pass');
  });

  it('B3-10 结论判定-有error应为需整改', () => {
    const records = [makeRecord('s1', '水源地A', '地下水', '孔隙水', undefined, 10)]; // 半径太小
    const sources = [makeSource('s1', '水源地A', 114.5, 38.0)];
    const report = runComplianceCheck(records, sources);
    expect(report.conclusion).toBe('需整改');
    expect(report.errorCount).toBeGreaterThan(0);
  });

  it('B3-11 结论判定-全pass应为合格', () => {
    const records = [makeRecord('s1', '水源地A', '地下水', '孔隙水', undefined, 50)];
    const sources = [makeSource('s1', '水源地A', 114.5, 38.0)];
    const report = runComplianceCheck(records, sources);
    expect(report.errorCount).toBe(0);
  });

  it('B3-12 河流型上游500m应不合规（下限1000m）', () => {
    const records: ZoneCalcRecord[] = [
      {
        id: 'calc_s1',
        sourceId: 's1',
        sourceName: '河流水源地',
        params: { sourceType: '地表水', swType: '河流型' } as any,
        zones: [
          {
            level: '一级',
            method: '经验值法',
            formula: 'test',
            length: 500,
            width: 50,
            area: 0.055,
            boundaryDescription: 'test',
            keyParams: 'test',
            standard: 'HJ 338-2018',
            riverExt: { upstreamLength: 500, downstreamLength: 100, bankWidth: 50 },
          },
        ],
        calculatedAt: new Date().toISOString(),
        warnings: [],
      },
    ];
    const sources = [makeSource('s1', '河流水源地', 114.5, 38.0)];
    const report = runComplianceCheck(records, sources);
    const radiusCheck = report.items[0].checks.find((c) => c.id === 'radius')!;
    expect(radiusCheck.severity).toBe('error');
  });
});
