/* ===== S12.9: 综合空间查询引擎测试 ===== */
import { describe, it, expect } from 'vitest';
import {
  querySpatialContext,
  isQueryPointSafe,
  type SpatialQueryInput,
} from '@/lib/spatialQueryEngine';
import type { SensitiveTarget } from '@/lib/sensitiveScreeningEngine';

const REF = { lng: 114.0, lat: 38.0 };

function makeSources() {
  return [
    { id: 's1', name: '岗南水库', cityName: '石家庄市', lng: REF.lng, lat: REF.lat, level: '一级', zoneRadiusM: 500 },
    { id: 's2', name: '黄壁庄水库', cityName: '石家庄市', lng: 114.5, lat: 38.2, level: '二级', zoneRadiusM: 300 },
  ];
}

function makeSensitiveTargets(): SensitiveTarget[] {
  return [
    { id: 't1', name: '实验小学', lng: 114.0, lat: 38.0, category: 'school' },
    { id: 't2', name: '远处学校', lng: 115.0, lat: 39.0, category: 'school' },
  ];
}

describe('spatialQueryEngine', () => {
  // ===== querySpatialContext =====
  describe('querySpatialContext', () => {
    it('返回邻近检索与风险等级', () => {
      const result = querySpatialContext({
        lng: REF.lng,
        lat: REF.lat,
        sources: makeSources(),
      });
      expect(result.proximity.nearest?.id).toBe('s1');
      expect(result.insideAnyZone).toBe(true);
      expect(result.overallRisk).toBe('red'); // 一级保护区重叠
      expect(result.riskLabel).toBe('红线');
    });

    it('远离保护区为安全', () => {
      const result = querySpatialContext({
        lng: 116.0,
        lat: 39.0,
        sources: makeSources(),
      });
      expect(result.insideAnyZone).toBe(false);
      expect(result.overallRisk).toBe('green');
    });

    it('最近水源地摘要包含名称与距离', () => {
      const result = querySpatialContext({
        lng: REF.lng,
        lat: REF.lat,
        sources: makeSources(),
      });
      expect(result.nearestSummary).toContain('岗南水库');
      expect(result.nearestSummary).toContain('米');
    });

    it('敏感目标筛查结果', () => {
      const result = querySpatialContext({
        lng: REF.lng,
        lat: REF.lat,
        sources: makeSources(),
        sensitiveTargets: makeSensitiveTargets(),
        sensitiveRadiusM: 5000,
      });
      expect(result.sensitiveScreening).not.toBeNull();
      expect(result.sensitiveScreening!.totalCount).toBe(1); // 远处学校被过滤
    });

    it('未提供敏感目标时 screening 为 null', () => {
      const result = querySpatialContext({
        lng: REF.lng,
        lat: REF.lat,
        sources: makeSources(),
      });
      expect(result.sensitiveScreening).toBeNull();
    });

    it('生成综合结论', () => {
      const result = querySpatialContext({
        lng: REF.lng,
        lat: REF.lat,
        sources: makeSources(),
      });
      expect(result.summary).toContain('红线');
      expect(result.summary).toContain('最近水源地');
    });
  });

  // ===== isQueryPointSafe =====
  describe('isQueryPointSafe', () => {
    it('红线且在内 → 不安全', () => {
      const result = querySpatialContext({
        lng: REF.lng,
        lat: REF.lat,
        sources: makeSources(),
      });
      expect(isQueryPointSafe(result)).toBe(false);
    });

    it('绿色且不在内 → 安全', () => {
      const result = querySpatialContext({
        lng: 116.0,
        lat: 39.0,
        sources: makeSources(),
      });
      expect(isQueryPointSafe(result)).toBe(true);
    });
  });

  // ===== 参数校验 =====
  describe('参数校验', () => {
    it('空数据源返回空结果', () => {
      const result = querySpatialContext({
        lng: REF.lng,
        lat: REF.lat,
        sources: [],
      });
      expect(result.proximity.nearest).toBeNull();
      expect(result.insideAnyZone).toBe(false);
    });
  });
});
