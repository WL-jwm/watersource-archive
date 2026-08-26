/**
 * waitCoordStore 待核实坐标 Store 测试
 *
 * 验证：
 * - setCoord / clearCoord / resetAll 基础增删改
 * - batchImport 批量导入（带坐标自动标记已核实，缺坐标保持原状）
 * - 数据持久化到 localStorage
 */

import { beforeEach, describe, it, expect } from 'vitest';
import { useWaitCoordStore } from '../data/waitCoordStore';

const STORAGE_KEY = 'watersource-wait-coords';

function resetStore() {
  localStorage.clear();
  useWaitCoordStore.setState({ records: {} });
}

describe('waitCoordStore', () => {
  beforeEach(() => resetStore());

  it('setCoord 保存并持久化核实坐标', () => {
    useWaitCoordStore.getState().setCoord('与任丘市石家营水源地', {
      lng: 116.1,
      lat: 38.7,
      note: '测试',
      verified: true,
    });
    const rec = useWaitCoordStore.getState().records['与任丘市石家营水源地'];
    expect(rec).toMatchObject({ lng: 116.1, lat: 38.7, note: '测试', verified: true });
    // 持久化检查
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)['与任丘市石家营水源地'].lng).toBe(116.1);
  });

  it('clearCoord 清除记录', () => {
    const { setCoord, clearCoord } = useWaitCoordStore.getState();
    setCoord('A', { lng: 116, lat: 38, verified: true });
    clearCoord('A');
    expect(useWaitCoordStore.getState().records['A']).toBeUndefined();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)['A']).toBeUndefined();
  });

  it('batchImport 批量导入带坐标记录自动标记已核实', () => {
    const { batchImport } = useWaitCoordStore.getState();
    batchImport([
      { name: '曲阳县城区集中式饮用水水源地', lng: 114.46, lat: 38.87, note: '报告提取' },
      { name: '乐亭县蔡各庄水厂水源地', lng: 118.9, lat: 39.41 },
    ]);
    const recs = useWaitCoordStore.getState().records;
    expect(recs['曲阳县城区集中式饮用水水源地']).toMatchObject({
      lng: 114.46,
      lat: 38.87,
      note: '报告提取',
      verified: true,
    });
    expect(recs['乐亭县蔡各庄水厂水源地']).toMatchObject({ lng: 118.9, lat: 39.41, verified: true });
    // 持久化
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved['曲阳县城区集中式饮用水水源地'].verified).toBe(true);
  });

  it('batchImport 缺坐标记录不强制标记已核实', () => {
    const { batchImport } = useWaitCoordStore.getState();
    batchImport([{ name: '平泉市瀑河饮用水水源', lng: undefined, lat: undefined }]);
    const rec = useWaitCoordStore.getState().records['平泉市瀑河饮用水水源'];
    expect(rec.verified).toBe(false);
    expect(rec.lng).toBeNull();
  });

  it('batchImport 覆盖已存在记录的坐标与备注', () => {
    const { setCoord, batchImport } = useWaitCoordStore.getState();
    setCoord('A', { lng: 116, lat: 38, note: '旧', verified: true });
    batchImport([{ name: 'A', lng: 116.5, lat: 38.5, note: '新' }]);
    expect(useWaitCoordStore.getState().records['A']).toMatchObject({
      lng: 116.5,
      lat: 38.5,
      note: '新',
      verified: true,
    });
  });

  it('resetAll 清空全部记录', () => {
    const { batchImport, resetAll } = useWaitCoordStore.getState();
    batchImport([{ name: 'A', lng: 116, lat: 38 }]);
    expect(Object.keys(useWaitCoordStore.getState().records).length).toBe(1);
    resetAll();
    expect(Object.keys(useWaitCoordStore.getState().records).length).toBe(0);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{}');
  });
});
