/* ===== 行政区划 Store ===== */
import { create } from 'zustand';
import type { CustomDivision, DivisionSelection } from '@/types/division';

const CUSTOM_KEY = 'watersource-archive-custom-divisions';

function loadCustom(): CustomDivision[] {
  try {
    const data = localStorage.getItem(CUSTOM_KEY);
    if (data) return JSON.parse(data);
  } catch {
    /* ignore */
  }
  return [];
}

function saveCustom(items: CustomDivision[]) {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

interface DivisionState {
  // 选中的行政区划
  selection: DivisionSelection;

  // 用户自定义补充的行政区划
  customDivisions: CustomDivision[];

  // 是否显示行政区划面板
  panelOpen: boolean;

  // Actions
  selectCity: (code: string, name: string) => void;
  selectDistrict: (code: string, name: string) => void;
  selectTownship: (code: string, name: string) => void;
  clearSelection: () => void;

  addCustomDivision: (item: Omit<CustomDivision, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateCustomDivision: (id: string, updates: Partial<CustomDivision>) => void;
  deleteCustomDivision: (id: string) => void;

  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;

  // 导出/导入
  exportCustom: () => string;
  importCustom: (json: string) => void;

  // 获取完整路径
  getFullPath: () => string;
}

export const useDivisionStore = create<DivisionState>((set, get) => ({
  selection: {
    cityCode: null,
    cityName: null,
    districtCode: null,
    districtName: null,
    townshipCode: null,
    townshipName: null,
  },
  customDivisions: loadCustom(),
  panelOpen: false,

  selectCity: (code, name) =>
    set((s) => ({
      selection: {
        ...s.selection,
        cityCode: code,
        cityName: name,
        districtCode: null,
        districtName: null,
        townshipCode: null,
        townshipName: null,
      },
    })),

  selectDistrict: (code, name) =>
    set((s) => ({
      selection: {
        ...s.selection,
        districtCode: code,
        districtName: name,
        townshipCode: null,
        townshipName: null,
      },
    })),

  selectTownship: (code, name) =>
    set((s) => ({
      selection: { ...s.selection, townshipCode: code, townshipName: name },
    })),

  clearSelection: () =>
    set({
      selection: {
        cityCode: null,
        cityName: null,
        districtCode: null,
        districtName: null,
        townshipCode: null,
        townshipName: null,
      },
    }),

  addCustomDivision: (item) => {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    const now = new Date().toISOString();
    const newItem: CustomDivision = { ...item, id, createdAt: now, updatedAt: now };
    set((s) => {
      const items = [...s.customDivisions, newItem];
      saveCustom(items);
      return { customDivisions: items };
    });
    return id;
  },

  updateCustomDivision: (id, updates) => {
    set((s) => {
      const items = s.customDivisions.map((d) =>
        d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d,
      );
      saveCustom(items);
      return { customDivisions: items };
    });
  },

  deleteCustomDivision: (id) => {
    set((s) => {
      const items = s.customDivisions.filter((d) => d.id !== id);
      saveCustom(items);
      return { customDivisions: items };
    });
  },

  setPanelOpen: (open) => set({ panelOpen: open }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),

  exportCustom: () => {
    return JSON.stringify(get().customDivisions, null, 2);
  },

  importCustom: (json) => {
    try {
      const data = JSON.parse(json) as CustomDivision[];
      if (Array.isArray(data)) {
        set((s) => {
          const existingIds = new Set(s.customDivisions.map((d) => d.id));
          const newItems = data.filter((d) => !existingIds.has(d.id));
          const items = [...s.customDivisions, ...newItems];
          saveCustom(items);
          return { customDivisions: items };
        });
      }
    } catch {
      console.error('Failed to import custom divisions');
    }
  },

  getFullPath: () => {
    const { selection } = get();
    const parts = [selection.cityName, selection.districtName, selection.townshipName].filter(
      Boolean,
    );
    return parts.join(' / ');
  },
}));
