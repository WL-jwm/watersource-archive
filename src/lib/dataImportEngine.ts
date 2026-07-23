/* ===== 数据导入引擎 =====
 * 支持解析 .xlsx / .xls / .csv 文件
 * 自动检测列名映射到 WaterSourceInfo 字段
 * 返回结构化数据 + 导入元信息
 */

import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import type { WaterSourceInfo } from '@/types';

// ===== 类型定义 =====

/** 导入结果 */
export interface ImportResult {
  /** 成功解析的数据行 */
  data: WaterSourceInfo[];
  /** 导入元信息 */
  meta: ImportMeta;
  /** 解析过程中的警告 */
  warnings: ImportWarning[];
  /** 原始列名与字段的映射关系 */
  columnMapping: Record<string, keyof WaterSourceInfo>;
}

/** 导入元信息 */
export interface ImportMeta {
  /** 文件总行数（含表头） */
  totalRows: number;
  /** 成功解析行数 */
  parsedRows: number;
  /** 跳过的行数 */
  skippedRows: number;
  /** 检测到的列名 */
  detectedColumns: string[];
  /** 未匹配的列名（未映射到字段） */
  unmappedColumns: string[];
  /** 文件类型 */
  fileType: 'xlsx' | 'csv';
  /** 文件名 */
  fileName: string;
}

/** 导入警告 */
export interface ImportWarning {
  /** 行号（从1开始，含表头） */
  row: number;
  /** 警告级别 */
  level: 'error' | 'warning' | 'info';
  /** 警告消息 */
  message: string;
  /** 相关字段 */
  field?: string;
  /** 原始值 */
  value?: string;
}

/** 列名映射配置 */
export interface ColumnMapping {
  /** 源列名（Excel/CSV中的列名） */
  source: string;
  /** 目标字段名 */
  target: keyof WaterSourceInfo;
  /** 可选：值转换函数 */
  transform?: (value: string) => string;
}

// ===== 默认列名映射表 =====
// 支持中英文多种可能的列名写法

const DEFAULT_COLUMN_MAPPINGS: ColumnMapping[] = [
  // name - 水源地名称
  { source: '水源地名称', target: 'name' },
  { source: '水源地名', target: 'name' },
  { source: '名称', target: 'name' },
  { source: '水源地', target: 'name' },
  { source: 'name', target: 'name' },
  { source: 'water source', target: 'name' },
  { source: '水源地名字', target: 'name' },

  // type - 水源类型
  { source: '水源类型', target: 'type' },
  { source: '类型', target: 'type' },
  { source: '类型(地表水/地下水)', target: 'type' },
  { source: 'type', target: 'type' },
  { source: 'water type', target: 'type' },

  // subType - 细分类型
  { source: '细分类型', target: 'subType' },
  { source: '亚类', target: 'subType' },
  { source: '水源亚类', target: 'subType' },
  { source: 'sub type', target: 'subType' },
  { source: 'subtype', target: 'subType' },

  // county - 所在县区
  { source: '所在县区', target: 'county' },
  { source: '县区', target: 'county' },
  { source: '所在县', target: 'county' },
  { source: '县', target: 'county' },
  { source: '区县', target: 'county' },
  { source: '地区', target: 'county' },
  { source: 'county', target: 'county' },
  { source: 'city/county', target: 'county' },

  // status - 使用状态
  { source: '使用状态', target: 'status' },
  { source: '状态', target: 'status' },
  { source: '使用情况', target: 'status' },
  { source: '运行状态', target: 'status' },
  { source: 'status', target: 'status' },

  // remark - 备注
  { source: '备注', target: 'remark' },
  { source: '说明', target: 'remark' },
  { source: '备注说明', target: 'remark' },
  { source: 'remark', target: 'remark' },
  { source: 'notes', target: 'remark' },

  // river - 所属河流（额外字段，映射到remark）
  { source: '所属河流', target: 'remark' },
  { source: '河流', target: 'remark' },
  { source: 'river', target: 'remark' },
];

// ===== 主函数 =====

/**
 * 从 File 对象解析导入数据
 */
export async function importFromFile(file: File): Promise<ImportResult> {
  const fileName = file.name.toLowerCase();
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return importFromExcel(file);
  } else if (fileName.endsWith('.csv')) {
    return importFromCSV(file);
  } else {
    throw new Error(`不支持的文件格式: ${file.name}，仅支持 .xlsx、.xls、.csv`);
  }
}

/**
 * 从 Excel 文件解析
 */
export async function importFromExcel(file: File): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', codepage: 65001 });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(firstSheet, {
          defval: '',
          raw: false,
        });
        resolve(parseData(jsonData, 'xlsx', file.name));
      } catch (err) {
        reject(new Error(`Excel 解析失败: ${(err as Error).message}`));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 从 CSV 文件解析
 */
export async function importFromCSV(file: File): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target!.result as string;
        const result = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
        }) as unknown as {
          data: Record<string, string>[];
          errors: Array<{ row?: number; message: string }>;
        };
        const errors = result.errors;
        if (errors.length > 0) {
          const warnings: ImportWarning[] = errors.map((err) => ({
            row: (err.row ?? 0) + 2,
            level: 'warning',
            message: `CSV 解析警告: ${err.message}`,
          }));
          // 仍然尝试解析
        }
        resolve(parseData(result.data, 'csv', file.name));
      } catch (err) {
        reject(new Error(`CSV 解析失败: ${(err as Error).message}`));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file, 'UTF-8');
  });
}

// ===== 核心解析逻辑 =====

function parseData(
  rawData: Record<string, string>[],
  fileType: 'xlsx' | 'csv',
  fileName: string,
): ImportResult {
  const warnings: ImportWarning[] = [];
  const result: WaterSourceInfo[] = [];

  if (rawData.length === 0) {
    return {
      data: [],
      meta: {
        totalRows: 0,
        parsedRows: 0,
        skippedRows: 0,
        detectedColumns: [],
        unmappedColumns: [],
        fileType,
        fileName,
      },
      warnings: [{ row: 0, level: 'warning', message: '文件中没有数据' }],
      columnMapping: {},
    };
  }

  // 检测列名
  const detectedColumns = Object.keys(rawData[0]).filter((k) => k.trim() !== '');
  const columnMapping = detectColumnMapping(detectedColumns, warnings);

  // 逐行解析
  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    const rowNum = i + 2; // Excel行号（1-based，含表头）

    // 跳过空行
    if (isRowEmpty(row)) {
      warnings.push({ row: rowNum, level: 'info', message: '空行已跳过' });
      continue;
    }

    const parsed = parseRow(row, columnMapping, rowNum, warnings);
    if (parsed) {
      result.push(parsed);
    }
  }

  const parsedRows = result.length;
  const skippedRows = rawData.length - parsedRows;

  return {
    data: result,
    meta: {
      totalRows: rawData.length + 1,
      parsedRows,
      skippedRows,
      detectedColumns,
      unmappedColumns: detectedColumns.filter((col) => !columnMapping[col]),
      fileType,
      fileName,
    },
    warnings,
    columnMapping,
  };
}

// ===== 列名检测 =====

function detectColumnMapping(
  detectedColumns: string[],
  warnings: ImportWarning[],
): Record<string, keyof WaterSourceInfo> {
  const mapping: Record<string, keyof WaterSourceInfo> = {};

  for (const col of detectedColumns) {
    const trimmed = col.trim().toLowerCase();
    let matched = false;

    for (const rule of DEFAULT_COLUMN_MAPPINGS) {
      if (trimmed === rule.source.toLowerCase()) {
        // 如果已存在映射，检查是否有冲突
        if (mapping[col] && mapping[col] !== rule.target) {
          warnings.push({
            row: 1,
            level: 'warning',
            message: `列 "${col}" 的映射冲突，已映射到 "${mapping[col]}"，跳过 "${rule.target}"`,
          });
          continue;
        }
        mapping[col] = rule.target;
        matched = true;
        break;
      }
    }

    if (!matched) {
      warnings.push({
        row: 1,
        level: 'info',
        message: `未识别的列名: "${col}"，将被忽略`,
      });
    }
  }

  return mapping;
}

// ===== 行解析 =====

function parseRow(
  row: Record<string, string>,
  columnMapping: Record<string, keyof WaterSourceInfo>,
  rowNum: number,
  warnings: ImportWarning[],
): WaterSourceInfo | null {
  // 构建反向映射：字段名 -> 原始值
  const fieldValues: Partial<Record<keyof WaterSourceInfo, string>> = {};

  for (const [col, field] of Object.entries(columnMapping)) {
    const value = (row[col] || '').trim();
    if (value) {
      // 如果同一字段有多个列映射，用第一个非空值
      if (!fieldValues[field]) {
        fieldValues[field] = value;
      }
    }
  }

  // 必填字段检查
  const name = fieldValues.name;
  if (!name) {
    warnings.push({
      row: rowNum,
      level: 'error',
      message: '缺少必填字段: 水源地名称',
      field: 'name',
      value: name,
    });
    return null;
  }

  // type 字段校验
  let type = fieldValues.type || '';
  if (!type) {
    warnings.push({
      row: rowNum,
      level: 'error',
      message: `"${name}" 缺少水源类型，已跳过`,
      field: 'type',
    });
    return null;
  }

  // 标准化 type
  type = normalizeType(type);
  if (type !== '地表水' && type !== '地下水') {
    warnings.push({
      row: rowNum,
      level: 'warning',
      message: `"${name}" 水源类型 "${fieldValues.type}" 无法识别，使用原值`,
      field: 'type',
      value: fieldValues.type,
    });
    // 仍然保留原值，不做强制修正
  }

  // county 字段检查
  const county = fieldValues.county;
  if (!county) {
    warnings.push({
      row: rowNum,
      level: 'warning',
      message: `"${name}" 缺少县区信息`,
      field: 'county',
    });
  }

  // status 字段校验
  let status = fieldValues.status || '';
  if (!status) {
    warnings.push({
      row: rowNum,
      level: 'warning',
      message: `"${name}" 缺少使用状态，默认设为 "在用"`,
      field: 'status',
    });
    status = '在用';
  } else {
    status = normalizeStatus(status);
  }

  // remark 处理：如果有多列映射到 remark，合并
  let remark = fieldValues.remark || '';

  return {
    name: name,
    type: type === '地表水' || type === '地下水' ? type : '地下水',
    subType: fieldValues.subType || undefined,
    county: county || '未知',
    status: status as WaterSourceInfo['status'],
    remark: remark || undefined,
  };
}

// ===== 辅助函数 =====

/** 检查行是否为空 */
function isRowEmpty(row: Record<string, string>): boolean {
  return Object.values(row).every((v) => !v || (typeof v === 'string' && v.trim() === ''));
}

/** 标准化水源类型 */
function normalizeType(val: string): string {
  const v = val.trim();
  if (/地表/i.test(v) || /surface/i.test(v)) return '地表水';
  if (/地下/i.test(v) || /ground/i.test(v)) return '地下水';
  return v;
}

/** 标准化使用状态 */
function normalizeStatus(val: string): string {
  const v = val.trim().toLowerCase();
  if (/在用|使用中|active|in.use|operational/i.test(v)) return '在用';
  if (/备用|standby|backup/i.test(v)) return '备用';
  if (/取消|已取消|废弃|abandoned|cancelled/i.test(v)) return '取消';
  if (/规划|planned|planning/i.test(v)) return '规划';
  if (/在建|建设中|building/i.test(v)) return '规划';
  if (/热备用|hot.standby/i.test(v)) return '备用';
  return val;
}

/** 从文本解析导入（测试用，模拟文件内容） */
export function importFromText(text: string, fileType: 'xlsx' | 'csv' = 'csv'): ImportResult {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  return parseData(result.data, fileType, 'text.csv');
}
