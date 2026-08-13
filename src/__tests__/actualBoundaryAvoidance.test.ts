/**
 * actualBoundaryAvoidance 真实边界避让引擎测试
 *
 * 验证 turf 多边形几何判断：
 * - 点在多边形内部/外部
 * - 项目半径缓冲的涉及判定
 * - 审计状态（已取消/已调整）匹配
 * - 距离计算与面积计算
 */

import { describe, it, expect } from 'vitest';
import {
  checkPointAgainstBoundary,
  NEAR_THRESHOLD_M,
} from '@/lib/actualBoundaryAvoidance';
import { ZONE_AUDIT_RULES, type ZoneAuditRule } from '@/data/zoneAuditMeta';
import type { ZoneBoundary } from '@/hooks/useActualZoneLayer';

// 一个近似矩形的测试边界：约 115.55~115.65°E, 37.85~37.95°N
const rect: ZoneBoundary = {
  name: '测试县城区集中式饮用水水源地',
  level: '一级保护区',
  ring: [
    [115.55, 37.85],
    [115.65, 37.85],
    [115.65, 37.95],
    [115.55, 37.95],
    [115.55, 37.85],
  ],
};

describe('checkPointAgainstBoundary 多边形避让判断', () => {
  it('点在多边形内部：isInside=true 且 involved', () => {
    const r = checkPointAgainstBoundary(rect, '衡水市', 115.6, 37.9, 0, []);
    expect(r.isInside).toBe(true);
    expect(r.isInvolved).toBe(true);
    expect(r.edgeDistanceM).toBeLessThan(0); // 内部为负（深入距离）
    expect(r.absDistanceM).toBeGreaterThan(0);
  });

  it('点在多边形外且无缓冲：不涉及，距离为正', () => {
    // 东侧约 115.70（距东边界 0.05° ≈ 5566m）
    const r = checkPointAgainstBoundary(rect, '衡水市', 115.7, 37.9, 0, []);
    expect(r.isInside).toBe(false);
    expect(r.isInvolved).toBe(false);
    expect(r.edgeDistanceM).toBeGreaterThan(0);
    // 粗略验证距离量级（0.05° 经度约 5.5km，纬度0）
    expect(r.absDistanceM).toBeGreaterThan(4000);
    expect(r.absDistanceM).toBeLessThan(7000);
  });

  it('项目半径缓冲覆盖到边界：isInvolved=true', () => {
    // 距东边界约 5566m，用 6000m 缓冲应覆盖
    const r = checkPointAgainstBoundary(rect, '衡水市', 115.7, 37.9, 6000, []);
    expect(r.isInside).toBe(false);
    expect(r.isInvolved).toBe(true);
  });

  it('审计状态匹配：满城区命中 cancelled', () => {
    const full: ZoneBoundary = { ...rect, name: '满城区县城集中式饮用水水源地1#' };
    const r = checkPointAgainstBoundary(full, '保定市', 115.6, 37.9, 0, ZONE_AUDIT_RULES);
    expect(r.auditStatus).toBe('cancelled');
  });

  it('审计状态匹配：羊角铺命中 adjusted', () => {
    const sp: ZoneBoundary = { ...rect, name: '羊角铺水源地' };
    const r = checkPointAgainstBoundary(sp, '邯郸市', 115.6, 37.9, 0, ZONE_AUDIT_RULES);
    expect(r.auditStatus).toBe('adjusted');
  });

  it('未命中审计规则返回 normal', () => {
    const r = checkPointAgainstBoundary(rect, '衡水市', 115.6, 37.9, 0, []);
    expect(r.auditStatus).toBe('normal');
  });

  it('面积计算为正', () => {
    const r = checkPointAgainstBoundary(rect, '衡水市', 115.6, 37.9, 0, []);
    expect(r.areaKm2).not.toBeNull();
    expect(r.areaKm2!).toBeGreaterThan(0);
  });

  it('NEAR_THRESHOLD_M 为 100 米', () => {
    expect(NEAR_THRESHOLD_M).toBe(100);
  });

  it('自定义规则集动态匹配', () => {
    const custom: ZoneAuditRule[] = [
      { city: '邢台市', keywords: ['临城'], status: 'cancelled', note: '', ref: '' },
    ];
    const lc: ZoneBoundary = { ...rect, name: '临城县城区水源地' };
    expect(checkPointAgainstBoundary(lc, '邢台市', 115.6, 37.9, 0, custom).auditStatus).toBe(
      'cancelled',
    );
    // 城市不匹配不命中
    expect(checkPointAgainstBoundary(lc, '衡水市', 115.6, 37.9, 0, custom).auditStatus).toBe(
      'normal',
    );
  });
});
