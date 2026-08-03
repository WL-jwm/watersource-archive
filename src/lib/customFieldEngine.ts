/* ===== S11.6: 自定义字段引擎 =====
 * 用户可自定义扩展字段（text/number/select/date）
 * 字段定义存储于 IDB app_meta（key: 'custom_field_defs'）
 * 字段值存储在 WaterSourceRecord.customFields: Record<string, string | number>
 */

import { dbGet, dbPut } from './idb';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';

// ===== 类型定义 =====

export type CustomFieldType = 'text' | 'number' | 'select' | 'date';

export interface CustomFieldDef {
  id: string;
  name: string;
  key: string;
  type: CustomFieldType;
  options?: string[];
  required: boolean;
  defaultValue?: string | number;
  description?: string;
  createdAt: string;
  order: number;
}

export interface CustomFieldWithValue {
  def: CustomFieldDef;
  value: string | number | undefined;
}

// ===== 存储 =====

const STORAGE_KEY = 'custom_field_defs';

async function loadDefs(): Promise<CustomFieldDef[]> {
  const result = await dbGet<{ key: string; value: CustomFieldDef[] }>('app_meta', STORAGE_KEY);
  return result?.value || [];
}

async function saveDefs(defs: CustomFieldDef[]): Promise<void> {
  await dbPut('app_meta', { key: STORAGE_KEY, value: defs });
}

// ===== CRUD =====

export async function getAllCustomFields(): Promise<CustomFieldDef[]> {
  const defs = await loadDefs();
  return defs.sort((a, b) => a.order - b.order);
}

export async function createCustomField(
  name: string,
  type: CustomFieldType,
  options?: { options?: string[]; required?: boolean; defaultValue?: string | number; description?: string },
): Promise<CustomFieldDef> {
  const defs = await loadDefs();
  const key = sanitizeKey(name);
  const maxOrder = defs.reduce((max, d) => Math.max(max, d.order), 0);

  const def: CustomFieldDef = {
    id: `cf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim(),
    key,
    type,
    options: type === 'select' ? options?.options || [] : undefined,
    required: options?.required ?? false,
    defaultValue: options?.defaultValue,
    description: options?.description,
    createdAt: new Date().toISOString(),
    order: maxOrder + 1,
  };

  defs.push(def);
  await saveDefs(defs);
  return def;
}

export async function updateCustomField(
  id: string,
  updates: Partial<Omit<CustomFieldDef, 'id' | 'createdAt'>>,
): Promise<void> {
  const defs = await loadDefs();
  const idx = defs.findIndex((d) => d.id === id);
  if (idx >= 0) {
    if (updates.name) {
      defs[idx].key = sanitizeKey(updates.name);
    }
    defs[idx] = { ...defs[idx], ...updates };
    await saveDefs(defs);
  }
}

export async function deleteCustomField(id: string): Promise<void> {
  const defs = await loadDefs();
  const filtered = defs.filter((d) => d.id !== id);
  await saveDefs(filtered);
}

export async function reorderCustomFields(orderedIds: string[]): Promise<void> {
  const defs = await loadDefs();
  const idToOrder = new Map(orderedIds.map((id, idx) => [id, idx + 1]));
  for (const def of defs) {
    const newOrder = idToOrder.get(def.id);
    if (newOrder !== undefined) {
      def.order = newOrder;
    }
  }
  await saveDefs(defs);
}

// ===== 字段值操作 =====

/**
 * 获取单条记录的自定义字段值
 */
export function getCustomFieldValues(
  record: WaterSourceRecord,
  defs: CustomFieldDef[],
): CustomFieldWithValue[] {
  const customFields = (record as unknown as Record<string, unknown>).customFields as
    | Record<string, string | number>
    | undefined;

  return defs.map((def) => ({
    def,
    value: customFields?.[def.key],
  }));
}

/**
 * 设置单条记录的自定义字段值
 */
export function setCustomFieldValue(
  record: WaterSourceRecord,
  fieldKey: string,
  value: string | number | undefined,
): WaterSourceRecord {
  const customFields = { ...((record as unknown as Record<string, unknown>).customFields as Record<string, string | number> | undefined) };

  if (value === undefined || value === '') {
    delete customFields[fieldKey];
  } else {
    customFields[fieldKey] = value;
  }

  return { ...record, customFields } as WaterSourceRecord & { customFields: Record<string, string | number> };
}

/**
 * 批量设置自定义字段值
 */
export function batchSetCustomField(
  records: WaterSourceRecord[],
  fieldKey: string,
  value: string | number | undefined,
): WaterSourceRecord[] {
  return records.map((r) => setCustomFieldValue(r, fieldKey, value));
}

// ===== 校验 =====

export interface ValidationResult {
  valid: boolean;
  errors: { fieldKey: string; fieldName: string; message: string }[];
}

/**
 * 校验记录的自定义字段
 */
export function validateCustomFields(
  record: WaterSourceRecord,
  defs: CustomFieldDef[],
): ValidationResult {
  const errors: { fieldKey: string; fieldName: string; message: string }[] = [];
  const values = getCustomFieldValues(record, defs);

  for (const { def, value } of values) {
    if (def.required && (value === undefined || value === '')) {
      errors.push({
        fieldKey: def.key,
        fieldName: def.name,
        message: `${def.name} 为必填项`,
      });
    }

    if (def.type === 'select' && value !== undefined && value !== '' && def.options) {
      if (!def.options.includes(String(value))) {
        errors.push({
          fieldKey: def.key,
          fieldName: def.name,
          message: `${def.name} 的值不在可选项中`,
        });
      }
    }

    if (def.type === 'number' && value !== undefined && value !== '') {
      const num = Number(value);
      if (isNaN(num)) {
        errors.push({
          fieldKey: def.key,
          fieldName: def.name,
          message: `${def.name} 必须为数字`,
        });
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ===== 辅助 =====

/**
 * 将字段名转换为安全的 key（中文转拼音首字母 + 特殊字符替换）
 */
function sanitizeKey(name: string): string {
  // 简单方案：使用 name 本身作为 key，但去除空格和特殊字符
  // 如果 name 全是中文，使用 cf_ 前缀 + 时间戳后4位保证唯一
  const trimmed = name.trim().replace(/\s+/g, '_');
  // 检查是否包含 ASCII 字母数字
  if (/^[a-zA-Z][a-zA-Z0-9_]*$/.test(trimmed)) {
    return `cf_${trimmed}`;
  }
  return `cf_field_${Date.now().toString(36).slice(-4)}`;
}

/**
 * 统计自定义字段使用情况
 */
export function computeFieldStats(
  sources: WaterSourceRecord[],
  defs: CustomFieldDef[],
): { def: CustomFieldDef; filledCount: number; emptyCount: number; fillRate: number }[] {
  return defs.map((def) => {
    const filled = sources.filter((s) => {
      const cf = (s as unknown as Record<string, unknown>).customFields as Record<string, string | number> | undefined;
      return cf?.[def.key] !== undefined && cf?.[def.key] !== '';
    }).length;
    return {
      def,
      filledCount: filled,
      emptyCount: sources.length - filled,
      fillRate: sources.length > 0 ? filled / sources.length : 0,
    };
  });
}
