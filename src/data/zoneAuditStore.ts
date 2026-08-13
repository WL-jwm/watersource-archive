/**
 * 保护区审计规则 Store（可编辑，localStorage 持久化）
 *
 * 将审计规则（已取消/已调整）从硬编码改为用户可在平台内编辑维护，
 * 省政府批复持续更新时无需改代码。
 *
 * - 生效规则集持久化到 localStorage（小型配置数据，同步读取便于地图渲染）
 * - 首次使用无本地数据时，以内置默认规则 ZONE_AUDIT_RULES 初始化
 * - 提供 新增 / 编辑 / 删除 / 恢复默认 操作
 */

import { create } from 'zustand';
import { ZONE_AUDIT_RULES, type ZoneAuditRule } from './zoneAuditMeta';

const STORAGE_KEY = 'watersource-zone-audit-rules';

function loadRules(): ZoneAuditRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ZoneAuditRule[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore 损坏数据，回退默认
  }
  return ZONE_AUDIT_RULES;
}

function persist(rules: ZoneAuditRule[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  } catch {
    // ignore 存储失败（如配额），内存态仍生效
  }
}

interface ZoneAuditState {
  /** 当前生效的审计规则集 */
  rules: ZoneAuditRule[];
  /** 是否已使用过本地自定义数据（用于界面提示） */
  isCustomized: boolean;
  /** 新增规则（追加到末尾） */
  addRule: (rule: ZoneAuditRule) => void;
  /** 编辑指定索引的规则 */
  updateRule: (index: number, rule: ZoneAuditRule) => void;
  /** 删除指定索引的规则 */
  deleteRule: (index: number) => void;
  /** 恢复为内置默认规则 */
  resetToDefault: () => void;
}

export const useZoneAuditStore = create<ZoneAuditState>((set) => ({
  rules: loadRules(),
  isCustomized: (() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== null;
    } catch {
      return false;
    }
  })(),
  addRule: (rule) =>
    set((state) => {
      const rules = [...state.rules, rule];
      persist(rules);
      return { rules, isCustomized: true };
    }),
  updateRule: (index, rule) =>
    set((state) => {
      if (index < 0 || index >= state.rules.length) return state;
      const rules = [...state.rules];
      rules[index] = rule;
      persist(rules);
      return { rules, isCustomized: true };
    }),
  deleteRule: (index) =>
    set((state) => {
      if (index < 0 || index >= state.rules.length) return state;
      const rules = state.rules.filter((_, i) => i !== index);
      persist(rules);
      return { rules, isCustomized: true };
    }),
  resetToDefault: () => {
    persist(ZONE_AUDIT_RULES);
    set({ rules: ZONE_AUDIT_RULES, isCustomized: false });
  },
}));
