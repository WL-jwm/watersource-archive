/* ===== S12.3: 保护区分级风险矩阵引擎测试 ===== */
import { describe, it, expect } from 'vitest';
import {
  gradeZoneRisk,
  buildRiskMatrix,
  riskLevelLabel,
  riskLevelColor,
  EDGE_WARNING_M,
  type ZoneRiskInput,
} from '@/lib/riskMatrixEngine';

function makeRiskInput(overrides: Partial<ZoneRiskInput> = {}): ZoneRiskInput {
  return {
    sourceName: '岗南水库',
    sourceId: 's1',
    zoneLevel: '二级',
    isOverlap: false,
    overlapAreaM2: 0,
    edgeDistanceM: 5000,
    ...overrides,
  };
}

describe('riskMatrixEngine', () => {
  // ===== gradeZoneRisk =====
  describe('gradeZoneRisk', () => {
    it('涉及一级保护区重叠 → 红线', () => {
      const result = gradeZoneRisk(makeRiskInput({ zoneLevel: '一级', isOverlap: true }));
      expect(result.risk).toBe('red');
      expect(result.reason).toContain('一级保护区');
    });

    it('涉及二级保护区重叠 → 红线', () => {
      const result = gradeZoneRisk(makeRiskInput({ zoneLevel: '二级', isOverlap: true }));
      expect(result.risk).toBe('red');
    });

    it('涉及准保护区重叠 → 黄线', () => {
      const result = gradeZoneRisk(makeRiskInput({ zoneLevel: '准保护区', isOverlap: true }));
      expect(result.risk).toBe('yellow');
    });

    it('紧邻（边界距离在警戒范围内）→ 黄线', () => {
      const result = gradeZoneRisk(makeRiskInput({
        zoneLevel: '二级',
        isOverlap: false,
        edgeDistanceM: EDGE_WARNING_M - 50,
      }));
      expect(result.risk).toBe('yellow');
    });

    it('边界距离在安全距离内 → 黄线', () => {
      const result = gradeZoneRisk(makeRiskInput({
        isOverlap: false,
        edgeDistanceM: 300, // 大于200 小于500
      }));
      expect(result.risk).toBe('yellow');
    });

    it('距离安全 → 绿线', () => {
      const result = gradeZoneRisk(makeRiskInput({ edgeDistanceM: 1000 }));
      expect(result.risk).toBe('green');
    });

    it('恰好等于警戒距离 → 黄线（< 判断）', () => {
      const result = gradeZoneRisk(makeRiskInput({ edgeDistanceM: EDGE_WARNING_M }));
      expect(result.risk).toBe('yellow'); // 等于200 不 <200，但 <500 故黄线
    });
  });

  // ===== buildRiskMatrix =====
  describe('buildRiskMatrix', () => {
    const REF = { lng: 114.0, lat: 38.0 };

    function makeZones() {
      return [
        {
          sourceName: '岗南水库', sourceId: 's1', level: '一级',
          centerLng: REF.lng, centerLat: REF.lat, radiusM: 500,
        },
        {
          sourceName: '黄壁庄水库', sourceId: 's2', level: '二级',
          centerLng: 114.5, centerLat: 38.2, radiusM: 300,
        },
        {
          sourceName: '西大洋水库', sourceId: 's3', level: '准保护区',
          centerLng: 115.0, centerLat: 38.5, radiusM: 200,
        },
      ];
    }

    it('项目位于一级保护区内 → 红线且禁止建设', () => {
      const result = buildRiskMatrix({
        projectName: '测试项目',
        project: { type: 'point', lng: REF.lng, lat: REF.lat },
        zones: makeZones(),
        refLng: REF.lng,
        refLat: REF.lat,
      });

      expect(result.overallRisk).toBe('red');
      expect(result.banned).toBe(true);
      expect(result.hasOverlap).toBe(true);
      expect(result.requiresGroundwaterAssessment).toBe(true);
      expect(result.zones[0].risk).toBe('red');
    });

    it('项目远离所有保护区 → 绿线', () => {
      const result = buildRiskMatrix({
        projectName: '远距项目',
        project: { type: 'point', lng: 116.0, lat: 39.0 },
        zones: makeZones(),
        refLng: 116.0,
        refLat: 39.0,
      });

      expect(result.overallRisk).toBe('green');
      expect(result.banned).toBe(false);
      expect(result.hasOverlap).toBe(false);
    });

    it('总体风险取最高级别', () => {
      const result = buildRiskMatrix({
        projectName: '混合项目',
        project: { type: 'point', lng: REF.lng, lat: REF.lat },
        zones: makeZones(),
        refLng: REF.lng,
        refLat: REF.lat,
      });
      // 有一级红线，其余可能是黄线，总体为红
      expect(result.overallRisk).toBe('red');
    });

    it('红线结论包含禁止建设表述', () => {
      const result = buildRiskMatrix({
        projectName: '红线项目',
        project: { type: 'point', lng: REF.lng, lat: REF.lat },
        zones: makeZones(),
        refLng: REF.lng,
        refLat: REF.lat,
      });
      expect(result.conclusion).toContain('禁止');
      expect(result.conclusion).toContain('选址');
    });

    it('红线措施包含防渗与监测', () => {
      const result = buildRiskMatrix({
        projectName: '红线项目',
        project: { type: 'point', lng: REF.lng, lat: REF.lat },
        zones: makeZones(),
        refLng: REF.lng,
        refLat: REF.lat,
      });
      expect(result.measures).toContain('采取严格的防渗措施，防止污染地下水');
      expect(result.measures.some((m) => m.includes('监测'))).toBe(true);
    });

    it('绿色结论为安全推进', () => {
      const result = buildRiskMatrix({
        projectName: '绿色项目',
        project: { type: 'point', lng: 116.0, lat: 39.0 },
        zones: makeZones(),
        refLng: 116.0,
        refLat: 39.0,
      });
      expect(result.conclusion).toContain('安全');
    });

    it('结果包含逐保护区详情', () => {
      const result = buildRiskMatrix({
        projectName: '测试',
        project: { type: 'point', lng: REF.lng, lat: REF.lat },
        zones: makeZones(),
        refLng: REF.lng,
        refLat: REF.lat,
      });
      expect(result.zones).toHaveLength(3);
      expect(result.zones[0].sourceName).toBe('岗南水库');
      expect(result.zones[0].isOverlap).toBe(true);
    });
  });

  // ===== 格式化 =====
  describe('格式函数', () => {
    it('riskLevelLabel 中文', () => {
      expect(riskLevelLabel('red')).toBe('红线');
      expect(riskLevelLabel('yellow')).toBe('黄线');
      expect(riskLevelLabel('green')).toBe('绿线');
    });

    it('riskLevelColor 返回样式类', () => {
      expect(riskLevelColor('red')).toContain('red');
      expect(riskLevelColor('yellow')).toContain('amber');
      expect(riskLevelColor('green')).toContain('green');
    });
  });
});
