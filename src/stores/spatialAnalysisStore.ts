/**
 * S13.1: 空间分析结果持久化 Store
 *
 * 将 S12 各引擎的空间分析结果持久化到 IndexedDB，
 * 支持历史记录管理、加载、删除，为 S13.2 历史对比提供数据基础。
 */

import { create } from 'zustand';
import { dbGetAll, dbPut, dbDelete, dbClear } from '@/lib/idb';
import type { SpatialReportInput } from '@/lib/spatialAnalysisReportEngine';

// ===== 记录类型 =====

export interface SpatialAnalysisRecord {
  id: string;
  /** 分析名称 */
  name: string;
  /** 创建时间 ISO 字符串 */
  createdAt: string;
  /** 分析类型 */
  analysisType: 'query' | 'batch' | 'comprehensive';
  /** 项目坐标 */
  projectPoint: { lng: number; lat: number };
  /** 项目名称（可选） */
  projectName?: string;
  /** 参与分析的水源地数 */
  sourceCount: number;
  /** 风险等级摘要 */
  riskLevel?: string;
  /** 是否位于保护区内 */
  insideAnyZone?: boolean;
  /** 最近水源地距离（米） */
  nearestDistanceM?: number;
  /** 最近水源地名称 */
  nearestSourceName?: string;
  /** 敏感目标数量 */
  sensitiveCount?: number;
  /** 是否位于上游 */
  upstreamOfAny?: boolean;
  /** 批量评估项目数（batch 类型） */
  batchProjectCount?: number;
  /** 完整输入数据（用于报告回放） */
  reportInput?: SpatialReportInput;
  /** 标签 */
  tags?: string[];
  /** 描述 */
  description?: string;
}

// ===== Store 接口 =====

interface SpatialAnalysisState {
  analyses: SpatialAnalysisRecord[];
  currentAnalysisId: string | null;
  loaded: boolean;

  /** 保存一条分析记录 */
  saveAnalysis: (record: SpatialAnalysisRecord) => Promise<void>;
  /** 删除一条记录 */
  deleteAnalysis: (id: string) => Promise<void>;
  /** 清空所有记录 */
  clearAnalyses: () => Promise<void>;
  /** 设置当前分析 */
  setCurrentAnalysis: (id: string | null) => void;
  /** 从 IDB 加载历史记录 */
  loadAnalyses: () => Promise<void>;
  /** 获取当前分析记录 */
  getCurrentAnalysis: () => SpatialAnalysisRecord | undefined;
}

export const useSpatialAnalysisStore = create<SpatialAnalysisState>((set, get) => ({
  analyses: [],
  currentAnalysisId: null,
  loaded: false,

  saveAnalysis: async (record) => {
    try {
      await dbPut('spatial_analyses', record);
    } catch (err) {
      console.warn('Failed to persist spatial analysis:', err);
    }

    set((state) => ({
      analyses: [record, ...state.analyses],
      currentAnalysisId: record.id,
    }));
  },

  deleteAnalysis: async (id) => {
    try {
      await dbDelete('spatial_analyses', id);
    } catch (err) {
      console.warn('Failed to delete spatial analysis from IDB:', err);
    }

    set((state) => ({
      analyses: state.analyses.filter((a) => a.id !== id),
      currentAnalysisId: state.currentAnalysisId === id ? null : state.currentAnalysisId,
    }));
  },

  clearAnalyses: async () => {
    try {
      await dbClear('spatial_analyses');
    } catch (err) {
      console.warn('Failed to clear spatial analyses from IDB:', err);
    }

    set({ analyses: [], currentAnalysisId: null });
  },

  setCurrentAnalysis: (id) => {
    const exists = id ? get().analyses.some((a) => a.id === id) : false;
    set({ currentAnalysisId: exists ? id : null });
  },

  loadAnalyses: async () => {
    try {
      const analyses = await dbGetAll<SpatialAnalysisRecord>('spatial_analyses');
      set({
        analyses: analyses.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
        loaded: true,
      });
    } catch (err) {
      console.warn('Failed to load spatial analyses from IDB:', err);
      set({ loaded: true });
    }
  },

  getCurrentAnalysis: () => {
    const { analyses, currentAnalysisId } = get();
    return analyses.find((a) => a.id === currentAnalysisId);
  },
}));