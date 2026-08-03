/* ===== S11.10: 导出模板引擎 =====
 * 用户可自定义导出模板：选择字段、列顺序、列名、筛选条件
 * 模板定义存储于 IDB app_meta（key: 'export_templates'）
 * 导出为 .xlsx 文件（含数据 sheet + 说明 sheet）
 */

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { dbGet, dbPut } from './idb';
import { levelToChinese } from './importTemplate';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';

// ===== 类型定义 =====

export interface ExportColumn {
  /** WaterSourceRecord 字段名 */
  field: keyof WaterSourceRecord | string;
  /** 导出列名 */
  label: string;
  /** 是否包含 */
  included: boolean;
  /** 列宽 */
  width: number;
  /** 格式化函数名称（内置） */
  formatter?: 'levelToChinese' | 'none';
}

export interface ExportFilter {
  field: keyof WaterSourceRecord;
  operator: 'eq' | 'neq' | 'contains' | 'in' | 'notNull';
  value?: string | string[];
}

export interface ExportTemplate {
  id: string;
  name: string;
  description?: string;
  columns: ExportColumn[];
  filters: ExportFilter[];
  includeCustomFields: boolean;
  createdAt: string;
  updatedAt: string;
}

// ===== 预设模板 =====

export const DEFAULT_EXPORT_COLUMNS: ExportColumn[] = [
  { field: 'name', label: '水源地名称', included: true, width: 22 },
  { field: 'cityName', label: '城市', included: true, width: 12 },
  { field: 'level', label: '级别', included: true, width: 10, formatter: 'levelToChinese' },
  { field: 'type', label: '水源类型', included: true, width: 10 },
  { field: 'subType', label: '子类型', included: false, width: 10 },
  { field: 'county', label: '县区', included: true, width: 12 },
  { field: 'status', label: '状态', included: true, width: 10 },
  { field: 'population', label: '服务人口', included: false, width: 12 },
  { field: 'river', label: '河流', included: false, width: 15 },
  { field: 'lng', label: '经度', included: false, width: 12 },
  { field: 'lat', label: '纬度', included: false, width: 12 },
  { field: 'remark', label: '备注', included: false, width: 20 },
  { field: 'tags', label: '标签', included: false, width: 15 },
];

// ===== 存储 =====

const STORAGE_KEY = 'export_templates';

async function loadTemplates(): Promise<ExportTemplate[]> {
  const result = await dbGet<{ key: string; value: ExportTemplate[] }>('app_meta', STORAGE_KEY);
  return result?.value || [];
}

async function saveTemplates(templates: ExportTemplate[]): Promise<void> {
  await dbPut('app_meta', { key: STORAGE_KEY, value: templates });
}

// ===== CRUD =====

export async function getAllExportTemplates(): Promise<ExportTemplate[]> {
  return loadTemplates();
}

export async function createExportTemplate(
  name: string,
  columns: ExportColumn[],
  filters: ExportFilter[] = [],
  includeCustomFields = false,
  description?: string,
): Promise<ExportTemplate> {
  const templates = await loadTemplates();
  const now = new Date().toISOString();

  const template: ExportTemplate = {
    id: `et_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim(),
    description,
    columns,
    filters,
    includeCustomFields,
    createdAt: now,
    updatedAt: now,
  };

  templates.push(template);
  await saveTemplates(templates);
  return template;
}

export async function updateExportTemplate(
  id: string,
  updates: Partial<Omit<ExportTemplate, 'id' | 'createdAt'>>,
): Promise<void> {
  const templates = await loadTemplates();
  const idx = templates.findIndex((t) => t.id === id);
  if (idx >= 0) {
    templates[idx] = {
      ...templates[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await saveTemplates(templates);
  }
}

export async function deleteExportTemplate(id: string): Promise<void> {
  const templates = await loadTemplates();
  const filtered = templates.filter((t) => t.id !== id);
  await saveTemplates(filtered);
}

// ===== 筛选 =====

/**
 * 应用筛选条件到数据源
 */
export function applyFilters(
  sources: WaterSourceRecord[],
  filters: ExportFilter[],
): WaterSourceRecord[] {
  if (filters.length === 0) return sources;

  return sources.filter((s) => {
    return filters.every((f) => {
      const value = s[f.field as keyof WaterSourceRecord];
      const strValue = value !== undefined ? String(value) : '';

      switch (f.operator) {
        case 'eq':
          return strValue === f.value;
        case 'neq':
          return strValue !== f.value;
        case 'contains':
          return strValue.includes(String(f.value || ''));
        case 'in':
          return f.value ? (Array.isArray(f.value) ? f.value.includes(strValue) : false) : true;
        case 'notNull':
          return value !== undefined && value !== null && value !== '';
        default:
          return true;
      }
    });
  });
}

// ===== 格式化 =====

function formatCellValue(
  value: unknown,
  formatter?: 'levelToChinese' | 'none',
): string | number {
  if (value === undefined || value === null) return '';
  if (formatter === 'levelToChinese' && typeof value === 'string') {
    return levelToChinese(value);
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  return value as string | number;
}

// ===== 导出 =====

export interface ExportOptions {
  template: ExportTemplate;
  sources: WaterSourceRecord[];
  customFieldDefs?: { key: string; name: string }[];
}

/**
 * 执行导出：生成 .xlsx 文件并下载
 */
export function executeExport(options: ExportOptions): { rowCount: number; fileSize: number } {
  const { template, sources, customFieldDefs } = options;

  // 1. 筛选数据
  const filtered = applyFilters(sources, template.filters);

  // 2. 构建列定义
  const includedColumns = template.columns.filter((c) => c.included);

  // 3. 构建表头
  const headers = includedColumns.map((c) => c.label);

  // 4. 添加自定义字段列
  if (template.includeCustomFields && customFieldDefs) {
    for (const cf of customFieldDefs) {
      headers.push(cf.name);
    }
  }

  // 5. 构建数据行
  const rows: (string | number)[][] = [headers];

  for (const source of filtered) {
    const row: (string | number)[] = includedColumns.map((col) => {
      const rawValue = source[col.field as keyof WaterSourceRecord];
      return formatCellValue(rawValue, col.formatter);
    });

    // 自定义字段值
    if (template.includeCustomFields && customFieldDefs) {
      const customFields = (source as unknown as Record<string, unknown>).customFields as
        | Record<string, string | number>
        | undefined;
      for (const cf of customFieldDefs) {
        row.push(customFields?.[cf.key] ?? '');
      }
    }

    rows.push(row);
  }

  // 6. 创建 workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // 列宽
  const colWidths = includedColumns.map((c) => ({ wch: c.width }));
  if (template.includeCustomFields && customFieldDefs) {
    customFieldDefs.forEach(() => colWidths.push({ wch: 15 }));
  }
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, '水源地数据');

  // 7. 说明 sheet
  const metaRows: string[][] = [
    ['导出模板', template.name],
    ['导出时间', new Date().toLocaleString('zh-CN')],
    ['数据条数', `${filtered.length} 条`],
    ['筛选条件', template.filters.length > 0 ? `${template.filters.length} 个条件` : '无'],
    ['包含自定义字段', template.includeCustomFields ? '是' : '否'],
    [],
    ['列说明'],
    ...includedColumns.map((c, i) => [`列${i + 1}`, c.label, `字段: ${c.field}`]),
  ];

  if (template.includeCustomFields && customFieldDefs) {
    metaRows.push([], ['自定义字段列']);
    customFieldDefs.forEach((cf, i) => [`自定义列${i + 1}`, cf.name]);
  }

  const metaWs = XLSX.utils.aoa_to_sheet(metaRows);
  metaWs['!cols'] = [{ wch: 15 }, { wch: 25 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, metaWs, '导出说明');

  // 8. 生成并下载
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  const safeName = template.name.replace(/[^\w\u4e00-\u9fa5]/g, '_');
  saveAs(blob, `水源地导出_${safeName}_${dateStr}.xlsx`);

  return { rowCount: filtered.length, fileSize: buffer.byteLength };
}

// ===== 预设模板工厂 =====

export function createPresetTemplate(
  preset: 'full' | 'basic' | 'contact',
): { name: string; columns: ExportColumn[]; filters: ExportFilter[]; includeCustomFields: boolean; description: string } {
  switch (preset) {
    case 'full':
      return {
        name: '完整导出',
        description: '包含所有标准字段',
        columns: DEFAULT_EXPORT_COLUMNS.map((c) => ({ ...c, included: true })),
        filters: [],
        includeCustomFields: true,
      };
    case 'basic':
      return {
        name: '基础信息',
        description: '仅包含名称、城市、级别、类型、状态',
        columns: DEFAULT_EXPORT_COLUMNS.map((c) => ({
          ...c,
          included: ['name', 'cityName', 'level', 'type', 'county', 'status'].includes(c.field as string),
        })),
        filters: [],
        includeCustomFields: false,
      };
    case 'contact':
      return {
        name: '联络清单',
        description: '在用状态水源地的基础信息',
        columns: DEFAULT_EXPORT_COLUMNS.map((c) => ({
          ...c,
          included: ['name', 'cityName', 'county', 'level', 'type', 'population'].includes(c.field as string),
        })),
        filters: [{ field: 'status', operator: 'eq', value: '在用' }],
        includeCustomFields: false,
      };
    default:
      return {
        name: '默认模板',
        columns: DEFAULT_EXPORT_COLUMNS,
        filters: [],
        includeCustomFields: false,
        description: '',
      };
  }
}
