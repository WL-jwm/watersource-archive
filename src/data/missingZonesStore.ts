/**
 * 缺失保护区清单 Store（"已补充"标记，localStorage 持久化）
 *
 * 管理"官方新增/调整但 KMZ 缺失"的保护区清单的处理状态，
 * 支持逐项标记"已补充"，供界面进度统计与提醒。数据本体来自 zoneAuditMeta.MISSING_ZONES。
 */

import { create } from 'zustand';

const STORAGE_KEY = 'watersource-missing-zones-marked';

function loadMarked(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

function persist(marked: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(marked));
  } catch {
    // ignore
  }
}

interface MissingZonesState {
  /** 已标记为"已补充"的缺失项 name 集合 */
  marked: string[];
  /** 切换指定缺失项的补充状态 */
  toggleMarked: (name: string) => void;
  /** 清空全部已补充标记 */
  reset: () => void;
}

export const useMissingZonesStore = create<MissingZonesState>((set) => ({
  marked: loadMarked(),
  toggleMarked: (name) =>
    set((state) => {
      const marked = state.marked.includes(name)
        ? state.marked.filter((n) => n !== name)
        : [...state.marked, name];
      persist(marked);
      return { marked };
    }),
  reset: () => {
    persist([]);
    set({ marked: [] });
  },
}));
