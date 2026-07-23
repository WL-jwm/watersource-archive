/**
 * C2: 保护区方案对比测试
 */

import { describe, it, expect } from 'vitest';
import { compareZoneSchemes } from '@/lib/zoneCompareEngine';
import type { ZoneCalcRecord } from '@/stores/waterSourceStore';

function makeRecord(name: string, r1: number, r2: number, T?: number, S?: number): ZoneCalcRecord {
  return {
    id: `calc_${name}_${Date.now()}`,
    sourceId: 's1',
    sourceName: name,
    params: {
      sourceType: '地下水',
      gwType: '孔隙水',
      transmissivity: T,
      storativity: S,
    } as any,
    zones: [
      {
        level: '一级',
        method: '解析法',
        formula: 'test',
        radius: r1,
        area: Math.round(((Math.PI * r1 * r1) / 1e6) * 100) / 100,
        boundaryDescription: 'test',
        keyParams: 'test',
        standard: 'HJ 338-2018',
      },
      {
        level: '二级',
        method: '解析法',
        formula: 'test',
        radius: r2,
        area: Math.round(((Math.PI * r2 * r2) / 1e6) * 100) / 100,
        boundaryDescription: 'test',
        keyParams: 'test',
        standard: 'HJ 338-2018',
      },
      {
        level: '准保护区',
        method: '解析法',
        formula: 'test',
        radius: Math.round(r2 * 1.5),
        area: Math.round(((Math.PI * (r2 * 1.5) ** 2) / 1e6) * 100) / 100,
        boundaryDescription: 'test',
        keyParams: 'test',
        standard: 'HJ 338-2018',
      },
    ],
    calculatedAt: '2024-01-01T00:00:00.000Z',
    warnings: [],
  };
}

describe('compareZoneSchemes', () => {
  it('C2-01 基本对比应返回完整结果', () => {
    const a = makeRecord('水源地A', 100, 300);
    const b = makeRecord('水源地A', 150, 450);
    const result = compareZoneSchemes(a, b);
    expect(result.items).toHaveLength(3);
    expect(result.sourceName).toBe('水源地A');
  });

  it('C2-02 面积增大应正确检测', () => {
    const a = makeRecord('水源地', 100, 300);
    const b = makeRecord('水源地', 150, 450);
    const result = compareZoneSchemes(a, b);
    const z1 = result.items.find((i) => i.level === '一级')!;
    expect(z1.direction).toBe('增大');
    expect(z1.areaChange).toBeGreaterThan(0);
    expect(z1.areaChangeRate).toBeGreaterThan(0);
  });

  it('C2-03 面积减小应正确检测', () => {
    const a = makeRecord('水源地', 150, 450);
    const b = makeRecord('水源地', 100, 300);
    const result = compareZoneSchemes(a, b);
    const z1 = result.items.find((i) => i.level === '一级')!;
    expect(z1.direction).toBe('减小');
    expect(z1.areaChange).toBeLessThan(0);
  });

  it('C2-04 面积不变应正确检测', () => {
    const a = makeRecord('水源地', 100, 300);
    const b = makeRecord('水源地', 100, 300);
    const result = compareZoneSchemes(a, b);
    const z1 = result.items.find((i) => i.level === '一级')!;
    expect(z1.direction).toBe('不变');
    expect(z1.areaChange).toBe(0);
  });

  it('C2-05 半径变化应正确计算', () => {
    const a = makeRecord('水源地', 100, 300);
    const b = makeRecord('水源地', 150, 450);
    const result = compareZoneSchemes(a, b);
    const z1 = result.items.find((i) => i.level === '一级')!;
    expect(z1.radiusA).toBe(100);
    expect(z1.radiusB).toBe(150);
    expect(z1.radiusChange).toBe(50);
  });

  it('C2-06 参数变化应正确识别', () => {
    const a = makeRecord('水源地', 100, 300, 50, 0.0001);
    const b = makeRecord('水源地', 150, 450, 100, 0.0001);
    const result = compareZoneSchemes(a, b);
    expect(result.paramChanges.length).toBeGreaterThan(0);
    const tChange = result.paramChanges.find((p) => p.param.includes('导水系数'));
    expect(tChange).toBeDefined();
    expect(tChange!.valueA).toBe('50');
    expect(tChange!.valueB).toBe('100');
  });

  it('C2-07 重大变化应被标记（面积变化>20%）', () => {
    const a = makeRecord('水源地', 100, 300);
    const b = makeRecord('水源地', 200, 600);
    const result = compareZoneSchemes(a, b);
    expect(result.hasSignificantChange).toBe(true);
  });

  it('C2-08 小幅变化不应标记为重大', () => {
    const a = makeRecord('水源地', 100, 300);
    const b = makeRecord('水源地', 105, 315);
    const result = compareZoneSchemes(a, b);
    expect(result.hasSignificantChange).toBe(false);
  });

  it('C2-09 总体调整说明应包含变化信息', () => {
    const a = makeRecord('水源地', 100, 300);
    const b = makeRecord('水源地', 150, 450);
    const result = compareZoneSchemes(a, b);
    expect(result.overallAdjustment).toContain('增大');
  });

  it('C2-10 方案标签应可自定义', () => {
    const a = makeRecord('水源地', 100, 300);
    const b = makeRecord('水源地', 150, 450);
    const result = compareZoneSchemes(a, b, '旧方案', '新方案');
    expect(result.schemeALabel).toBe('旧方案');
    expect(result.schemeBLabel).toBe('新方案');
  });
});
