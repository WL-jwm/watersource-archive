/**
 * missingZonesStore 缺失清单 Store 测试
 *
 * 验证"已补充"标记的持久化与切换逻辑。
 */

import { beforeEach, describe, it, expect } from 'vitest';
import { useMissingZonesStore } from '../data/missingZonesStore';
import { MISSING_ZONES } from '../data/zoneAuditMeta';

const STORAGE_KEY = 'watersource-missing-zones-marked';

describe('missingZonesStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useMissingZonesStore.setState({ marked: [] });
  });

  it('初始无已补充标记', () => {
    expect(useMissingZonesStore.getState().marked).toEqual([]);
  });

  it('toggleMarked 标记并持久化', () => {
    const name = MISSING_ZONES[0].name;
    useMissingZonesStore.getState().toggleMarked(name);
    expect(useMissingZonesStore.getState().marked).toContain(name);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual([name]);
  });

  it('toggleMarked 再次点击取消标记', () => {
    const name = MISSING_ZONES[0].name;
    const store = useMissingZonesStore.getState();
    store.toggleMarked(name);
    store.toggleMarked(name);
    expect(useMissingZonesStore.getState().marked).not.toContain(name);
    expect(useMissingZonesStore.getState().marked).toEqual([]);
  });

  it('reset 清空全部标记并持久化', () => {
    const store = useMissingZonesStore.getState();
    store.toggleMarked(MISSING_ZONES[0].name);
    store.toggleMarked(MISSING_ZONES[1].name);
    expect(useMissingZonesStore.getState().marked.length).toBe(2);
    store.reset();
    expect(useMissingZonesStore.getState().marked).toEqual([]);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual([]);
  });

  it('MISSING_ZONES 清单字段完整且无重复 name', () => {
    expect(MISSING_ZONES.length).toBeGreaterThan(0);
    const names = MISSING_ZONES.map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
    for (const m of MISSING_ZONES) {
      expect(m.city.length).toBeGreaterThan(0);
      expect(m.name.length).toBeGreaterThan(0);
      expect(m.ref.length).toBeGreaterThan(0);
    }
  });
});
