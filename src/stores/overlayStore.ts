/**
 * S5: 多水源地叠加分析 Store
 *
 * 管理叠加分析结果的 CRUD 和持久化（IndexedDB）
 */

import { create } from 'zustand';
import { dbClear, dbDelete, dbGetAll, dbPut } from '@/lib/idb';
import {
  runOverlayAnalysis,
  type OverlayResult,
  type OverlayRequest,
} from '@/lib/multiSourceOverlayEngine';
import type { WaterSourceRecord, ZoneCalcRecord } from './waterSourceStore';

interface OverlayState {
  analyses: OverlayResult[];
  currentAnalysisId: string | null;
  calculating: boolean;
  loaded: boolean;

  runOverlay: (
    request: OverlayRequest,
    sources: WaterSourceRecord[],
    zoneResults: ZoneCalcRecord[],
  ) => Promise<OverlayResult>;
  deleteAnalysis: (id: string) => Promise<void>;
  clearAnalyses: () => Promise<void>;
  setCurrentAnalysis: (id: string) => void;
  loadAnalyses: () => Promise<void>;
}

export const useOverlayStore = create<OverlayState>((set, get) => ({
  analyses: [],
  currentAnalysisId: null,
  calculating: false,
  loaded: false,

  runOverlay: async (request, sources, zoneResults) => {
    // 并发保护：如果正在计算，返回进行中的结果
    if (get().calculating) {
      throw new Error('正在执行叠加分析，请稍候');
    }

    set({ calculating: true });

    try {
      const result = runOverlayAnalysis(sources, zoneResults, request);

      // 持久化到 IDB
      try {
        await dbPut('overlay_analyses', result);
      } catch (err) {
        console.warn('Failed to persist overlay analysis:', err);
      }

      set((state) => ({
        analyses: [...state.analyses, result],
        currentAnalysisId: result.id,
        calculating: false,
      }));

      return result;
    } catch (err) {
      set({ calculating: false });
      throw err;
    }
  },

  deleteAnalysis: async (id) => {
    try {
      await dbDelete('overlay_analyses', id);
    } catch (err) {
      console.warn('Failed to delete overlay analysis from IDB:', err);
    }

    set((state) => ({
      analyses: state.analyses.filter((a) => a.id !== id),
      currentAnalysisId: state.currentAnalysisId === id ? null : state.currentAnalysisId,
    }));
  },

  clearAnalyses: async () => {
    try {
      await dbClear('overlay_analyses');
    } catch (err) {
      console.warn('Failed to clear overlay analyses from IDB:', err);
    }

    set({
      analyses: [],
      currentAnalysisId: null,
    });
  },

  setCurrentAnalysis: (id) => {
    const exists = get().analyses.some((a) => a.id === id);
    set({ currentAnalysisId: exists ? id : null });
  },

  loadAnalyses: async () => {
    try {
      const analyses = await dbGetAll<OverlayResult>('overlay_analyses');
      set({
        analyses: analyses.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
        loaded: true,
      });
    } catch (err) {
      console.warn('Failed to load overlay analyses from IDB:', err);
      set({ loaded: true });
    }
  },
}));
