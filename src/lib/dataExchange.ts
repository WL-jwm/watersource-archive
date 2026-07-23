/**
 * E3: 数据交换增强
 *
 * 功能：
 * 1. Excel 导入水源地数据（支持模板格式）
 * 2. CSV 导入/导出
 * 3. 导入数据验证与错误报告
 * 4. Excel 模板下载
 * 5. 字段映射与类型转换
 */

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';

// ===== 类型定义 =====

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: ImportError[];
  records: Partial<WaterSourceRecord>[];
}

export interface ImportError {
  row: number;
  field?: string;
  message: string;
  value?: string;
}

export type ImportFormat = 'json' | 'excel' | 'csv';

// ===== 字段映射 =====

/** Excel 列名 → 水源地字段映射 */
const FIELD_MAP: Record<string, keyof WaterSourceRecord> = {
  '水源地名称': 'name',
  '名称': 'name',
  '城市': 'cityName',
  '地级市': 'cityName',
  '级别': 'level',
  '水源类型': 'type',
  '类型': 'type',
  '细分类型': 'subType',
  '县区': 'county',
  '县': 'county',
  '状态': 'status',
  '服务人口': 'population',
  '河流': 'river',
  '所在河流': 'river',
  '经度': 'lng',
  '东经': 'lng',
  '纬度': 'lat',
  '北纬': 'lat',
  'id': 'id',
  'ID': 'id',
  '编号': 'id',
};

/** 必填字段 */
const REQUIRED_FIELDS: (keyof WaterSourceRecord)[] = ['name', 'cityName', 'type'];

/** 字段验证规则 */
function validateField(
  field: keyof WaterSourceRecord,
  value: unknown,
): { valid: boolean; normalized: unknown; error?: string } {
  switch (field) {
    case 'name':
    case 'cityName':
    case 'river':
      return typeof value === 'string' && value.trim()
        ? { valid: true, normalized: value.trim() }
        : { valid: false, normalized: '', error: '不能为空' };

    case 'level':
      const levelMap: Record<string, string> = {
        '市级': 'municipal',
        'municipal': 'municipal',
        '县级': 'county',
        'county': 'county',
        '乡镇级': 'township',
        'township': 'township',
      };
      const level = String(value || '').trim();
      return levelMap[level]
        ? { valid: true, normalized: levelMap[level] }
        : { valid: false, normalized: '', error: `无效级别"${level}"，应为市级/县级/乡镇级` };

    case 'type':
      const type = String(value || '').trim();
      return type === '地下水' || type === '地表水'
        ? { valid: true, normalized: type }
        : { valid: false, normalized: '', error: `无效类型"${type}"，应为地下水/地表水` };

    case 'subType':
      return { valid: true, normalized: String(value || '').trim() };

    case 'county':
      return { valid: true, normalized: String(value || '').trim() };

    case 'status':
      const s = String(value || '').trim() || '在用';
      return { valid: true, normalized: s };

    case 'population':
      const pop = Number(value);
      return isNaN(pop) || pop < 0
        ? { valid: false, normalized: 0, error: `无效人口数"${value}"` }
        : { valid: true, normalized: Math.round(pop) };

    case 'lng':
      const lng = Number(value);
      return isNaN(lng) || lng < 70 || lng > 140
        ? { valid: false, normalized: 0, error: `无效经度"${value}"，应在70-140之间` }
        : { valid: true, normalized: lng };

    case 'lat':
      const lat = Number(value);
      return isNaN(lat) || lat < 35 || lat > 45
        ? { valid: false, normalized: 0, error: `无效纬度"${value}"，应在35-45之间` }
        : { valid: true, normalized: lat };

    default:
      return { valid: true, normalized: value };
  }
}

// ===== Excel 导入 =====

/**
 * 从 Excel ArrayBuffer 解析水源地数据
 */
export function parseExcelToRecords(buffer: ArrayBuffer): ImportResult {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { success: false, imported: 0, skipped: 0, errors: [{ row: 0, message: 'Excel文件无工作表' }], records: [] };
  }

  const sheet = workbook.Sheets[sheetName];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  return validateAndConvert(rows);
}

/**
 * 从 CSV 文本解析水源地数据
 */
export function parseCsvToRecords(csvText: string): ImportResult {
  const workbook = XLSX.read(csvText, { type: 'string' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { success: false, imported: 0, skipped: 0, errors: [{ row: 0, message: 'CSV文件无数据' }], records: [] };
  }

  const sheet = workbook.Sheets[sheetName];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  return validateAndConvert(rows);
}

/**
 * 验证并转换行数据为 WaterSourceRecord
 */
export function validateAndConvert(rows: Record<string, unknown>[]): ImportResult {
  const errors: ImportError[] = [];
  const records: Partial<WaterSourceRecord>[] = [];
  let imported = 0;
  let skipped = 0;

  rows.forEach((row, index) => {
    const rowNum = index + 2; // Excel行号从2开始（1是表头）
    const record: Partial<WaterSourceRecord> = {};
    let hasError = false;

    // 字段映射
    for (const [excelCol, value] of Object.entries(row)) {
      const field = FIELD_MAP[excelCol.trim()];
      if (!field) continue;

      const { valid, normalized, error } = validateField(field, value);
      if (!valid) {
        errors.push({ row: rowNum, field: excelCol, message: error!, value: String(value) });
        hasError = true;
      }
      (record as Record<string, unknown>)[field] = normalized;
    }

    // 检查必填字段
    for (const req of REQUIRED_FIELDS) {
      if (record[req] == null || record[req] === '') {
        errors.push({ row: rowNum, field: req, message: `必填字段"${req}"缺失` });
        hasError = true;
      }
    }

    if (hasError) {
      skipped++;
    } else {
      record.dataVersion = 1;
      records.push(record);
      imported++;
    }
  });

  return {
    success: imported > 0,
    imported,
    skipped,
    errors,
    records,
  };
}

// ===== 导出功能 =====

/**
 * 导出水源地数据为 Excel
 */
export function exportToExcel(sources: WaterSourceRecord[], options?: { includeAll?: boolean }): void {
  const data = sources.map((s, i) => ({
    '序号': i + 1,
    'id': s.id,
    '水源地名称': s.name,
    '城市': s.cityName,
    '级别': s.level === 'municipal' ? '市级' : s.level === 'county' ? '县级' : '乡镇级',
    '水源类型': s.type,
    '细分类型': s.subType,
    '县区': s.county,
    '状态': s.status,
    '服务人口': s.population,
    '河流': s.river || '',
    '经度': s.lng,
    '纬度': s.lat,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [
    { wch: 6 }, { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 8 },
    { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 10 },
    { wch: 15 }, { wch: 12 }, { wch: 12 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '水源地清单');

  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const dateStr = new Date().toISOString().slice(0, 10);
  saveAs(blob, `河北省水源地清单_${dateStr}.xlsx`);
}

/**
 * 导出为 CSV
 */
export function exportToCsv(sources: WaterSourceRecord[]): void {
  const headers = ['水源地名称', '城市', '级别', '水源类型', '细分类型', '县区', '状态', '服务人口', '河流', '经度', '纬度'];
  const rows = sources.map((s) => [
    s.name,
    s.cityName,
    s.level === 'municipal' ? '市级' : s.level === 'county' ? '县级' : '乡镇级',
    s.type,
    s.subType,
    s.county,
    s.status,
    String(s.population),
    s.river || '',
    String(s.lng),
    String(s.lat),
  ]);

  // BOM + CSV
  const csv = '\uFEFF' + [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const dateStr = new Date().toISOString().slice(0, 10);
  saveAs(blob, `河北省水源地清单_${dateStr}.csv`);
}

/**
 * 下载导入模板
 */
export function downloadTemplate(): void {
  const templateData = [
    {
      '水源地名称': '示例水库',
      '城市': '石家庄市',
      '级别': '市级',
      '水源类型': '地表水',
      '细分类型': '湖库型',
      '县区': '平山县',
      '状态': '在用',
      '服务人口': 500000,
      '河流': '滹沱河',
      '经度': 114.21,
      '纬度': 38.27,
    },
  ];

  const ws = XLSX.utils.json_to_sheet(templateData);
  ws['!cols'] = [
    { wch: 20 }, { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 10 },
    { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 15 }, { wch: 10 }, { wch: 10 },
  ];

  // 添加说明行（在数据下方）
  const notes = [
    ['', ''],
    ['', '说明：'],
    ['', '1. 水源地名称、城市、水源类型为必填项'],
    ['', '2. 级别可选：市级、县级、乡镇级'],
    ['', '3. 水源类型可选：地下水、地表水'],
    ['', '4. 细分类型：地下水填孔隙水/裂隙水/岩溶水；地表水填河流型/湖库型'],
    ['', '5. 经度范围70-140，纬度范围35-45（河北省范围）'],
    ['', '6. 请删除示例数据后填入实际数据'],
  ];
  XLSX.utils.sheet_add_aoa(ws, notes, { origin: -1 });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '导入模板');

  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, '水源地数据导入模板.xlsx');
}

/**
 * 读取文件为 ArrayBuffer
 */
export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 读取文件为文本
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}
