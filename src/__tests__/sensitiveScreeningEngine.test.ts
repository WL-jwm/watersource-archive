/* ===== S12.5: 敏感目标空间筛查引擎测试 ===== */
import { describe, it, expect } from 'vitest';
import {
  screenSensitiveTargets,
  batchScreenSensitiveTargets,
  buildScreeningAdvice,
  categoryLabel,
  SENSITIVE_CATEGORY_LABELS,
  type SensitiveTarget,
} from '@/lib/sensitiveScreeningEngine';

function makeTarget(overrides: Partial<SensitiveTarget> = {}): SensitiveTarget {
  return {
    id: 't1',
    name: '实验小学',
    lng: 114.0,
    lat: 38.0,
    category: 'school',
    ...overrides,
  };
}

describe('sensitiveScreeningEngine', () => {
  // ===== categoryLabel =====
  describe('categoryLabel', () => {
    it('返回中文分类标签', () => {
      expect(categoryLabel('school')).toBe('学校');
      expect(categoryLabel('hospital')).toBe('医院');
      expect(categoryLabel('surface_water')).toBe('地表水体');
    });

    it('未知分类返回原值', () => {
      expect(categoryLabel('unknown' as never)).toBe('unknown');
    });

    it('SENSITIVE_CATEGORY_LABELS 覆盖8类', () => {
      expect(Object.keys(SENSITIVE_CATEGORY_LABELS)).toHaveLength(8);
    });
  });

  // ===== screenSensitiveTargets =====
  describe('screenSensitiveTargets', () => {
    const targets = [
      makeTarget({ id: 't1', name: '实验小学', lng: 114.0, lat: 38.0, category: 'school' }),
      makeTarget({ id: 't2', name: '市医院', lng: 114.01, lat: 38.0, category: 'hospital' }),
      makeTarget({ id: 't3', name: '远处小学', lng: 114.6, lat: 38.5, category: 'school' }),
    ];

    it('按距离升序返回缓冲区内目标', () => {
      const result = screenSensitiveTargets(114.0, 38.0, targets, 5000);
      expect(result.totalCount).toBe(2); // 远处小学被过滤
      expect(result.targets[0].id).toBe('t1');
      expect(result.targets[1].id).toBe('t2');
    });

    it('计算距离与方位', () => {
      const result = screenSensitiveTargets(114.0, 38.0, targets, 5000);
      expect(result.targets[0].distanceM).toBeCloseTo(0, 0);
      expect(result.targets[0].bearingLabel).toBeTruthy();
    });

    it('nearest 为最近目标', () => {
      const result = screenSensitiveTargets(114.0, 38.0, targets, 5000);
      expect(result.nearest?.id).toBe('t1');
      expect(result.nearestDistanceM).toBeCloseTo(0, 0);
    });

    it('分类统计正确', () => {
      const result = screenSensitiveTargets(114.0, 38.0, targets, 5000);
      expect(result.categoryCounts.school).toBe(1);
      expect(result.categoryCounts.hospital).toBe(1);
      expect(result.categoryCounts.residential).toBe(0);
    });

    it('缓冲区内无目标时返回空', () => {
      const result = screenSensitiveTargets(115.0, 39.0, targets, 500);
      expect(result.totalCount).toBe(0);
      expect(result.nearest).toBeNull();
      expect(result.nearestDistanceM).toBeNull();
    });

    it('radiusM 控制筛查范围', () => {
      const result = screenSensitiveTargets(114.0, 38.0, targets, 100);
      expect(result.totalCount).toBe(1);
    });
  });

  // ===== batchScreenSensitiveTargets =====
  describe('batchScreenSensitiveTargets', () => {
    const targets = [
      makeTarget({ id: 't1', lng: 114.0, lat: 38.0 }),
      makeTarget({ id: 't2', lng: 114.1, lat: 38.1 }),
      makeTarget({ id: 't3', lng: 115.0, lat: 39.0 }),
    ];

    it('批量筛查多个点位', () => {
      const result = batchScreenSensitiveTargets({
        points: [
          { lng: 114.0, lat: 38.0 },
          { lng: 114.1, lat: 38.1 },
        ],
        targets,
        radiusM: 5000,
      });
      expect(result.items).toHaveLength(2);
      expect(result.items[0].screening.totalCount).toBeGreaterThanOrEqual(1);
    });

    it('去重收集受影响目标', () => {
      const result = batchScreenSensitiveTargets({
        points: [
          { lng: 114.0, lat: 38.0 },
          { lng: 114.0, lat: 38.0 },
        ],
        targets,
        radiusM: 5000,
      });
      // t1 被两个点都命中但去重
      expect(result.affectedTargetCount).toBe(1);
      expect(result.allAffectedTargets).toHaveLength(1);
    });

    it('空点位返回空', () => {
      const result = batchScreenSensitiveTargets({
        points: [],
        targets,
        radiusM: 5000,
      });
      expect(result.items).toHaveLength(0);
      expect(result.affectedTargetCount).toBe(0);
    });
  });

  // ===== buildScreeningAdvice =====
  describe('buildScreeningAdvice', () => {
    it('无目标时给出安全建议', () => {
      const result = screenSensitiveTargets(115, 39, [makeTarget({ lng: 114, lat: 38 })], 100);
      const advice = buildScreeningAdvice(result);
      expect(advice[0]).toContain('未筛查到敏感目标');
    });

    it('有目标时给出现状调查建议', () => {
      const result = screenSensitiveTargets(114.0, 38.0, [
        makeTarget({ id: 't1', name: '实验小学', lng: 114.0, lat: 38.0, category: 'school' }),
        makeTarget({ id: 't2', name: '某水井', lng: 114.001, lat: 38.0, category: 'drinking_well' }),
      ], 5000);
      const advice = buildScreeningAdvice(result);
      expect(advice.some((a) => a.includes('学校'))).toBe(true);
      expect(advice.some((a) => a.includes('饮用水井'))).toBe(true);
      expect(advice.some((a) => a.includes('最近敏感目标'))).toBe(true);
    });
  });
});
