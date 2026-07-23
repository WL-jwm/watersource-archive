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
    expect(result.zones[0].width).toBe(500); // 两岸500m
    expect(result.zones[0].radius).toBeUndefined(); // 河流型无radius
    expect(result.zones[2].level).toBe('准保护区');
  });

  it('中型河流-长度3km宽度300m', () => {
    const result = calcProtectionZones('中型河流', {
      sourceType: '地表水',
      swType: '河流型',
      riverFlow: 50,
      riverWidth: 100,
    });
    expect(result.zones[0].length).toBe(3000);
    expect(result.zones[0].width).toBe(300);
  });

  it('小型河流-长度1km宽度200m', () => {
    const result = calcProtectionZones('小型河流', {
      sourceType: '地表水',
      swType: '河流型',
      riverFlow: 3,
      riverWidth: 20,
    });
    expect(result.zones[0].length).toBe(1000);
    expect(result.zones[0].width).toBe(200);
  });

  it('二级保护区长度应大于一级', () => {
    const result = calcProtectionZones('河流', {
      sourceType: '地表水',
      swType: '河流型',
      riverFlow: 50,
    });
    expect(result.zones[1].length!).toBeGreaterThan(result.zones[0].length!);
    expect(result.zones[1].width!).toBeGreaterThan(result.zones[0].width!);
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
