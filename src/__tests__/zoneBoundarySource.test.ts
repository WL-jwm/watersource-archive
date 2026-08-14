/**
 * zoneBoundarySource 离线单机边界数据测试
 *
 * 验证内联数据模块（离线 file:// 单机版的核心）覆盖全部城市、
 * 数据非空且与 zone-boundaries 总环数一致。
 */

import { describe, it, expect } from 'vitest';
import { isOfflineFileMode, ALL_BOUNDARY_CITIES } from '@/data/zoneBoundarySource';
import { ZONE_BOUNDARY_INLINE } from '@/data/zoneBoundaryInlineData';

describe('zoneBoundarySource 离线单机数据', () => {
  it('离线模式默认关闭（http 环境）', () => {
    expect(isOfflineFileMode()).toBe(false);
  });

  it('内联数据覆盖全部城市且非空', () => {
    expect(ALL_BOUNDARY_CITIES.length).toBe(13);
    for (const city of ALL_BOUNDARY_CITIES) {
      expect(ZONE_BOUNDARY_INLINE[city], `${city} 应有内联数据`).toBeDefined();
      expect(ZONE_BOUNDARY_INLINE[city].length).toBeGreaterThan(0);
    }
  });

  it('内联数据总环数与 zone-boundaries 一致（1258）', () => {
    const total = Object.values(ZONE_BOUNDARY_INLINE).reduce((s, a) => s + a.length, 0);
    expect(total).toBe(1258);
  });

  it('内联要素结构合法（name/level/ring）', () => {
    for (const city of ALL_BOUNDARY_CITIES) {
      for (const b of ZONE_BOUNDARY_INLINE[city]) {
        expect(b.name.length).toBeGreaterThan(0);
        expect(b.level.length).toBeGreaterThan(0);
        expect(Array.isArray(b.ring)).toBe(true);
        expect(b.ring.length).toBeGreaterThan(2);
      }
    }
  });
});
