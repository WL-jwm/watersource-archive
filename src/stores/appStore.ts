import { create } from 'zustand';
import type { AppState, WaterSourceReport, TabId } from '@/types';
import { undoManager } from '@/lib/undoManager';
import {
  recordAddReport as invAddReport,
  recordUpdateReport as invUpdateReport,
  recordDeleteReport as invDeleteReport,
} from '@/lib/inverseOps';

const STORAGE_KEY = 'watersource-archive-data';

function loadFromStorage(): WaterSourceReport[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) return JSON.parse(data);
  } catch {
    // ignore
  }
  return [];
}

function saveToStorage(reports: WaterSourceReport[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  } catch {
    // ignore
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  reports: loadFromStorage(),
  selectedReportId: null,
  selectedSourceId: null,
  activeTab: 'basic',
  searchQuery: '',
  sidebarCollapsed: false,

  addReport: (report: WaterSourceReport) => {
    set((state) => {
      const reports = [...state.reports, report];
      saveToStorage(reports);
      return { reports };
    });
    // D2: 撤销栈记录
    if (!undoManager.isExecuting()) {
      invAddReport(report, (fn) => set(fn as (s: { reports: WaterSourceReport[] }) => { reports: WaterSourceReport[] }), saveToStorage);
    }
  },

  updateReport: (id: string, updates: Partial<WaterSourceReport>) => {
    const current = get().reports.find((r) => r.id === id);
    set((state) => {
      const reports = state.reports.map((r) =>
        r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r,
      );
      saveToStorage(reports);
      return { reports };
    });
    // D2: 撤销栈记录
    if (current && !undoManager.isExecuting()) {
      const updated = { ...current, ...updates, updatedAt: new Date().toISOString() };
      invUpdateReport(current, updated, (fn) => set(fn as (s: { reports: WaterSourceReport[] }) => { reports: WaterSourceReport[] }), saveToStorage);
    }
  },

  deleteReport: (id: string) => {
    const current = get().reports.find((r) => r.id === id);
    set((state) => {
      const reports = state.reports.filter((r) => r.id !== id);
      saveToStorage(reports);
      return {
        reports,
        selectedReportId: state.selectedReportId === id ? null : state.selectedReportId,
        selectedSourceId: null,
        activeTab: 'basic',
      };
    });
    // D2: 撤销栈记录
    if (current && !undoManager.isExecuting()) {
      invDeleteReport(current, (fn) => set(fn as (s: { reports: WaterSourceReport[] }) => { reports: WaterSourceReport[] }), saveToStorage);
    }
  },

  // 进入报告（不清空 source/tab）
  setSelectedReportId: (id) => set({ selectedReportId: id }),

  // 进入水源地详情
  setSelectedSourceId: (id) => set({ selectedSourceId: id, activeTab: 'basic' }),

  setActiveTab: (tab: TabId) => set({ activeTab: tab }),
  setSearchQuery: (query: string) => set({ searchQuery: query }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  exportData: () => {
    const { reports } = get();
    return JSON.stringify(reports, null, 2);
  },

  importData: (json: string) => {
    try {
      const data = JSON.parse(json) as WaterSourceReport[];
      if (Array.isArray(data)) {
        set((state) => {
          const existingIds = new Set(state.reports.map((r) => r.id));
          const newReports = data.filter((r) => !existingIds.has(r.id));
          const reports = [...state.reports, ...newReports];
          saveToStorage(reports);
          return { reports };
        });
      }
    } catch {
      console.error('Failed to import data');
    }
  },
}));
