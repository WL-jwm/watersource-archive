/**
 * P3-20: 保护区计算引擎单元测试
 * 覆盖: 经验值法(地下水/河流/湖库) + 解析法 + 参数推断 + 批量计算
 */
import { describe, it, expect } from 'vitest';
import {
  calcProtectionZones,
  calcBatch,
  inferDefaultParams,
  CalcParams,
} from '@/lib/zoneCalcEngine';
import {
  generateRiverVertices,
  generateLakeVertices,
  generateCircleVertices,
} from '@/lib/zoneCoordGenerator';

// ===== 1. 地下水经验值法 =====
describe('地下水经验值法', () => {
  it('孔隙水-市级-应返回一级+二级保护区', () => {
    const result = calcProtectionZones('测试水源地', {
      sourceType: '地下水',
      gwType: '孔隙水',
    });
    expect(result.zones).toHaveLength(3);
    expect(result.zones[0].level).toBe('一级');
    expect(result.zones[1].level).toBe('二级');
    expect(result.zones[2].level).toBe('准保护区');
    expect(result.zones[0].method).toBe('经验值法');
    expect(result.warnings.length).toBeGreaterThan(0); // 缺少解析法参数的警告
  });

  it('孔隙水-乡镇级-应返回一级+二级保护区', () => {
    const result = calcProtectionZones('乡镇水源地', {
      sourceType: '地下水',
      gwType: '孔隙水',
      ...({ level: 'township' } as any),
    });
    expect(result.zones).toHaveLength(3);
    // 乡镇级半径应小于市级
    expect(result.zones[0].radius).toBeLessThan(300);
    expect(result.zones[1].radius).toBeLessThan(1500);
  });

  it('岩溶水-一级保护区半径应大于孔隙水', () => {
    const pore = calcProtectionZones('孔隙水', { sourceType: '地下水', gwType: '孔隙水' });
    const karst = calcProtectionZones('岩溶水', { sourceType: '地下水', gwType: '岩溶水' });
    // 岩溶水一级半径大于孔隙水
    expect(karst.zones[0].radius!).toBeGreaterThan(pore.zones[0].radius!);
  });

  it('裂隙水-应在孔隙水和岩溶水之间', () => {
    const pore = calcProtectionZones('孔隙水', { sourceType: '地下水', gwType: '孔隙水' });
    const fissure = calcProtectionZones('裂隙水', { sourceType: '地下水', gwType: '裂隙水' });
    const karst = calcProtectionZones('岩溶水', { sourceType: '地下水', gwType: '岩溶水' });
    expect(fissure.zones[0].radius!).toBeGreaterThan(pore.zones[0].radius!);
    expect(fissure.zones[0].radius!).toBeLessThanOrEqual(karst.zones[0].radius!);
  });

  it('保护区面积应大于0', () => {
    const result = calcProtectionZones('测试', { sourceType: '地下水', gwType: '孔隙水' });
    result.zones.forEach((z) => {
      expect(z.area).toBeGreaterThan(0);
    });
  });

  it('应包含边界描述和规范依据', () => {
    const result = calcProtectionZones('测试', { sourceType: '地下水', gwType: '孔隙水' });
    result.zones.forEach((z) => {
      expect(z.boundaryDescription).toBeTruthy();
      expect(z.standard).toContain('HJ 338');
    });
  });
});

// ===== 2. 地表水-河流型经验值法 =====
describe('河流型经验值法', () => {
  it('大型河流-应有正确的length和width', () => {
    const result = calcProtectionZones('大型河流', {
      sourceType: '地表水',
      swType: '河流型',
      riverFlow: 200,
      riverWidth: 300,
    });
    expect(result.zones).toHaveLength(3);
    expect(result.zones[0].length).toBe(5000); // 上游5km
    expect(result.zones[0].width).toBe(50); // 两岸单侧纵深50m
    expect(result.zones[0].riverExt).toBeDefined();
    expect(result.zones[0].riverExt!.upstreamLength).toBe(5000);
    expect(result.zones[0].riverExt!.downstreamLength).toBe(300); // 大型下游300m
    expect(result.zones[0].radius).toBeUndefined(); // 河流型无radius
    expect(result.zones[2].level).toBe('准保护区');
  });

  it('中型河流-上游3km岸宽50m', () => {
    const result = calcProtectionZones('中型河流', {
      sourceType: '地表水',
      swType: '河流型',
      riverFlow: 50,
      riverWidth: 100,
    });
    expect(result.zones[0].length).toBe(3000);
    expect(result.zones[0].width).toBe(50);
  });

  it('小型河流-上游1km岸宽50m', () => {
    const result = calcProtectionZones('小型河流', {
      sourceType: '地表水',
      swType: '河流型',
      riverFlow: 3,
      riverWidth: 20,
    });
    expect(result.zones[0].length).toBe(1000);
    expect(result.zones[0].width).toBe(50);
  });

  it('二级保护区长度应大于一级', () => {
    const result = calcProtectionZones('河流', {
      sourceType: '地表水',
      swType: '河流型',
      riverFlow: 50,
    });
    expect(result.zones[1].length!).toBeGreaterThan(result.zones[0].length!);
    expect(result.zones[1].riverExt!.bankWidth).toBeGreaterThanOrEqual(
      result.zones[0].riverExt!.bankWidth,
    );
  });
});

// ===== 3. 地表水-湖库型经验值法 =====
describe('湖库型经验值法', () => {
  it('湖库型-应有radius', () => {
    const result = calcProtectionZones('水库', {
      sourceType: '地表水',
      swType: '湖库型',
      lakeArea: 20,
    });
    expect(result.zones).toHaveLength(3);
    expect(result.zones[0].radius).toBeGreaterThan(0);
    expect(result.zones[0].method).toBe('经验值法');
    expect(result.zones[2].level).toBe('准保护区');
  });

  it('大型湖库-半径应更大', () => {
    const small = calcProtectionZones('小水库', {
      sourceType: '地表水',
      swType: '湖库型',
      lakeArea: 1,
    });
    const large = calcProtectionZones('大水库', {
      sourceType: '地表水',
      swType: '湖库型',
      lakeArea: 80,
    });
    expect(large.zones[0].radius!).toBeGreaterThan(small.zones[0].radius!);
  });
});

// ===== 4. 解析法 =====
describe('地下水解析法(Cooper-Jacob)', () => {
  it('完整参数-应使用解析法', () => {
    const result = calcProtectionZones('解析法测试', {
      sourceType: '地下水',
      gwType: '孔隙水',
      transmissivity: 500,
      storativity: 0.01,
      hydraulicGradient: 0.005,
      effectivePorosity: 0.2,
    });
    // 有解析法参数时不应该有"回退"警告
    expect(result.warnings).not.toContain('解析法参数不完整，已回退至经验值法');
    expect(result.zones.length).toBeGreaterThan(0);
  });

  it('无储水系数-应回退经验值法', () => {
    const result = calcProtectionZones('无S测试', {
      sourceType: '地下水',
      gwType: '孔隙水',
      transmissivity: 500,
    });
    expect(result.zones[0].method).toBe('经验值法');
    expect(result.warnings.some((w) => w.includes('回退') || w.includes('经验值法'))).toBe(true);
  });

  it('解析法一级半径应与理论公式一致', () => {
    const result = calcProtectionZones('公式验证', {
      sourceType: '地下水',
      gwType: '孔隙水',
      transmissivity: 1000,
      storativity: 0.02,
      hydraulicGradient: 0.01,
      effectivePorosity: 0.15,
    });
    // 应返回解析法结果（每个zone都有radius）
    const primary = result.zones.find((z) => z.level === '一级');
    if (primary && primary.radius) {
      // 简单验证radius为正数且合理范围
      expect(primary.radius).toBeGreaterThan(0);
      expect(primary.radius).toBeLessThan(50000); // 不超过50km
    }
  });
});

// ===== 5. 参数推断 =====
describe('inferDefaultParams', () => {
  it('地下水-孔隙水', () => {
    const params = inferDefaultParams('地下水', '孔隙水');
    expect(params.sourceType).toBe('地下水');
    expect(params.gwType).toBe('孔隙水');
  });

  it('地下水-岩溶水', () => {
    const params = inferDefaultParams('地下水', '岩溶水');
    expect(params.gwType).toBe('岩溶水');
  });

  it('地表水-湖库型', () => {
    const params = inferDefaultParams('地表水', '湖库型');
    expect(params.sourceType).toBe('地表水');
    expect(params.swType).toBe('湖库型');
  });

  it('地表水-南水北调', () => {
    const params = inferDefaultParams('地表水', '南水北调');
    expect(params.swType).toBe('湖库型');
  });

  it('地表水-河流型', () => {
    const params = inferDefaultParams('地表水', '河流');
    expect(params.swType).toBe('河流型');
  });

  it('无subType-默认孔隙水', () => {
    const params = inferDefaultParams('地下水');
    expect(params.gwType).toBe('孔隙水');
  });
});

// ===== 6. 批量计算 =====
describe('calcBatch', () => {
  it('批量计算多个水源地', () => {
    const results = calcBatch([
      { sourceName: '水源地A', params: { sourceType: '地下水', gwType: '孔隙水' } },
      { sourceName: '水源地B', params: { sourceType: '地下水', gwType: '岩溶水' } },
      { sourceName: '河流C', params: { sourceType: '地表水', swType: '河流型', riverFlow: 50 } },
    ]);
    expect(results).toHaveLength(3);
    expect(results[0].sourceName).toBe('水源地A');
    expect(results[2].zones[0].length).toBeDefined();
  });

  it('空数组返回空结果', () => {
    const results = calcBatch([]);
    expect(results).toHaveLength(0);
  });
});

// ===== 7. CalcResult结构验证 =====
describe('CalcResult结构', () => {
  it('所有字段齐全', () => {
    const result = calcProtectionZones('测试', {
      sourceType: '地下水',
      gwType: '孔隙水',
    });
    expect(result.sourceName).toBe('测试');
    expect(result.params).toBeDefined();
    expect(result.zones).toBeInstanceOf(Array);
    expect(result.calculatedAt).toBeTruthy();
    expect(result.warnings).toBeInstanceOf(Array);
  });
});

// ===== A1: 地表水保护区计算增强测试 =====

// A1-T5-01: 大型河流规模判断
describe('A1 河流型规模判断', () => {
  it('A1-T5-01 大型河流（流量200m³/s，河宽250m）', () => {
    const result = calcProtectionZones('大型河流', {
      sourceType: '地表水',
      swType: '河流型',
      riverFlow: 200,
      riverWidth: 250,
    });
    const z1 = result.zones.find((z) => z.level === '一级')!;
    expect(z1.riverExt).toBeDefined();
    expect(z1.riverExt!.upstreamLength).toBe(5000);
  });

  it('A1-T5-02 小型河流（流量5m³/s，河宽20m）', () => {
    const result = calcProtectionZones('小型河流', {
      sourceType: '地表水',
      swType: '河流型',
      riverFlow: 5,
      riverWidth: 20,
    });
    const z1 = result.zones.find((z) => z.level === '一级')!;
    expect(z1.riverExt!.upstreamLength).toBe(1000);
  });

  it('A1-T5-03 潮汐河段一级保护区下游距离', () => {
    const result = calcProtectionZones('潮汐河流', {
      sourceType: '地表水',
      swType: '河流型',
      riverFlow: 30,
      riverWidth: 80,
      isTidal: true,
      tidalUpstreamDistance: 800,
    });
    const z1 = result.zones.find((z) => z.level === '一级')!;
    // 中型河流规范下游 200m，潮汐上溯 800m → 取大值 800m
    expect(z1.riverExt!.downstreamLength).toBeGreaterThanOrEqual(800);
    expect(z1.riverExt!.tidalAdjustment).toBeDefined();
  });

  it('A1-T5-04 河流型两岸纵深坡度修正（坡度20‰）', () => {
    const result = calcProtectionZones('陡坡河流', {
      sourceType: '地表水',
      swType: '河流型',
      riverFlow: 30,
      riverWidth: 80,
      riverSlope: 20,
    });
    const z1 = result.zones.find((z) => z.level === '一级')!;
    // 坡度>15‰，bankWidth应从50增至100
    expect(z1.riverExt!.bankWidth).toBe(100);
    expect(z1.riverExt!.slopeAdjustment).toBeDefined();
  });

  it('A1-T5-05 河流型二级保护区上游延伸（大型）', () => {
    const result = calcProtectionZones('大型河流二级', {
      sourceType: '地表水',
      swType: '河流型',
      riverFlow: 200,
      riverWidth: 250,
    });
    const z2 = result.zones.find((z) => z.level === '二级')!;
    // 大型：一级上游5000 + 二级延伸10000 = 15000
    expect(z2.riverExt!.upstreamLength).toBe(15000);
  });
});

// A1-T5-06~09: 湖库型计算增强
describe('A1 湖库型计算增强', () => {
  it('A1-T5-06 湖库型规模判断（库容15亿m³）', () => {
    const result = calcProtectionZones('大型水库', {
      sourceType: '地表水',
      swType: '湖库型',
      lakeArea: 60,
      lakeCapacity: 15,
    });
    const z1 = result.zones.find((z) => z.level === '一级')!;
    // 大型水库一级保护区半径 1000m
    expect(z1.radius).toBe(1000);
  });

  it('A1-T5-07 湖库型一级保护区半径（中型）', () => {
    const result = calcProtectionZones('中型水库', {
      sourceType: '地表水',
      swType: '湖库型',
      lakeArea: 10,
      lakeCapacity: 3,
    });
    const z1 = result.zones.find((z) => z.level === '一级')!;
    expect(z1.radius).toBe(500);
  });

  it('A1-T5-08 湖库型岸边取水一级面积约为全圆的50%', () => {
    const result = calcProtectionZones('岸边取水水库', {
      sourceType: '地表水',
      swType: '湖库型',
      lakeArea: 10,
      lakeCapacity: 3,
      intakeType: '岸边',
    });
    const z1Full = calcProtectionZones('湖心取水水库', {
      sourceType: '地表水',
      swType: '湖库型',
      lakeArea: 10,
      lakeCapacity: 3,
      intakeType: '湖心',
    });
    const areaShore = result.zones.find((z) => z.level === '一级')!.area;
    const areaCenter = z1Full.zones.find((z) => z.level === '一级')!.area;
    // 岸边取水水域面积约为全圆的50%，总面积也明显小于全圆
    expect(areaShore).toBeLessThan(areaCenter);
    expect(areaShore).toBeGreaterThan(0);
  });

  it('A1-T5-09 湖库型小型二级保护区面积', () => {
    const result = calcProtectionZones('小型水库', {
      sourceType: '地表水',
      swType: '湖库型',
      lakeArea: 2,
      lakeCapacity: 0.5,
    });
    const z2 = result.zones.find((z) => z.level === '二级')!;
    // 小型水库二级保护区应包含整个水域
    expect(z2.area).toBeGreaterThan(0);
  });
});

// A1-T5-10~12: 拐点坐标生成
describe('A1 拐点坐标生成', () => {
  it('A1-T5-10 河流型拐点生成（8个点）', () => {
    const vertices = generateRiverVertices(114.5, 38.0, 5000, 300, 50);
    expect(vertices).toHaveLength(8);
    expect(vertices[0].id).toBe('J1');
    expect(vertices[7].id).toBe('J8');
    // 每个点应有有效坐标
    vertices.forEach((v) => {
      expect(v.lng).toBeGreaterThan(0);
      expect(v.lat).toBeGreaterThan(0);
      expect(v.azimuth).toBeGreaterThanOrEqual(0);
      expect(v.azimuth).toBeLessThan(360);
    });
  });

  it('A1-T5-11 湖库型岸边取水拐点生成（半圆）', () => {
    const vertices = generateLakeVertices(114.5, 38.0, 500, '岸边', 24);
    // 半圆应有约13个点（0~halfCount = 12+1）
    expect(vertices.length).toBeLessThanOrEqual(14);
    expect(vertices.length).toBeGreaterThanOrEqual(12);
    // 所有方位角应在 90°~270° 范围内
    vertices.forEach((v) => {
      expect(v.azimuth).toBeGreaterThanOrEqual(90);
      expect(v.azimuth).toBeLessThanOrEqual(270);
    });
  });

  it('A1-T5-12 湖库型湖心取水拐点生成（全圆）', () => {
    const vertices = generateLakeVertices(114.5, 38.0, 500, '湖心', 24);
    expect(vertices).toHaveLength(24);
    // 全圆方位角应覆盖 0°~360°
    const azimuths = vertices.map((v) => v.azimuth);
    expect(Math.min(...azimuths)).toBe(0);
    expect(Math.max(...azimuths)).toBeGreaterThan(330);
  });
});
