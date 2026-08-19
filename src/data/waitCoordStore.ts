/**
 * 待核实水源地坐标 Store（localStorage 持久化）
 *
 * 用于在线管理「待补坐标」水源地：用户可填写精确井位坐标、备注，标记已核实，
 * 已核实记录持久化到 localStorage，供后续补全接入地图图层。
 */

import { create } from 'zustand';

const STORAGE_KEY = 'watersource-wait-coords';

export interface WaitCoordRecord {
  /** 水源地名称（唯一键） */
  name: string;
  /** 精确经度（核实后） */
  lng?: number | null;
  /** 精确纬度（核实后） */
  lat?: number | null;
  /** 备注（来源/说明） */
  note?: string;
  /** 是否已核实 */
  verified: boolean;
  /** 核实更新时间 */
  updatedAt?: string;
}

export type WaitCoordMap = Record<string, WaitCoordRecord>;

function load(): WaitCoordMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WaitCoordMap;
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // ignore 损坏数据
  }
  return {};
}

function persist(map: WaitCoordMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore 存储失败
  }
}

interface WaitCoordState {
  /** 已核实记录（key=水源地名称） */
  records: WaitCoordMap;
  /** 保存/更新某水源地的核实坐标 */
  setCoord: (name: string, data: { lng?: number | null; lat?: number | null; note?: string; verified?: boolean }) => void;
  /** 清除某水源地的核实记录 */
  clearCoord: (name: string) => void;
  /** 全部清除 */
  resetAll: () => void;
}

export const useWaitCoordStore = create<WaitCoordState>((set) => ({
  records: load(),
  setCoord: (name, data) =>
    set((state) => {
      const prev = state.records[name] ?? {};
      const next: WaitCoordMap = {
        ...state.records,
        [name]: {
          ...prev,
          ...data,
          name,
          updatedAt: new Date().toISOString(),
        },
      };
      persist(next);
      return { records: next };
    }),
  clearCoord: (name) =>
    set((state) => {
      const next = { ...state.records };
      delete next[name];
      persist(next);
      return { records: next };
    }),
  resetAll: () => {
    persist({});
    return { records: {} };
  },
}));
