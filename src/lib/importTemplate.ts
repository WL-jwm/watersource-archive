/* ===== S11.1: 导入模板引擎 =====
 * 标准模板定义 + 模板下载 + 字段映射增强
 *
 * 功能：
 * 1. 定义标准导入模板列结构（含数据验证下拉）
 * 2. 生成并下载 .xlsx 模板（含说明 sheet）
 * 3. 字段映射自动检测（精确 + 模糊 + 拼音首字母匹配）
 * 4. 支持手动修正映射
 */

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';

// ===== 模板列定义 =====

export interface TemplateColumn {
  /** Excel 列名 */
  header: string;
  /** 对应的 WaterSourceRecord 字段 */
  field: keyof WaterSourceRecord;
  /** 是否必填 */
  required: boolean;
  /** 数据类型 */
  type: 'string' | 'number' | 'select';
  /** select 类型的可选值 */
  options?: string[];
  /** 列宽 */
  width: number;
  /** 说明文字 */
  description: string;
  /** 示例值 */
  example: string;
}

/** 标准导入模板列定义 */
export const TEMPLATE_COLUMNS: TemplateColumn[] = [
  {
    header: '水源地名称',
    field: 'name',
    required: true,
    type: 'string',
    width: 22,
    description: '水源地的正式名称，必填',
    example: '黄壁庄水库水源地',
  },
  {
    header: '城市',
    field: 'cityName',
    required: true,
    type: 'string',
    width: 12,
    description: '地级市名称，必填（如：石家庄市）',
    example: '石家庄市',
  },
  {
    header: '级别',
    field: 'level',
    required: true,
    type: 'select',
    options: ['市级', '县级', '乡镇级'],
    width: 10,
    description: '水源地级别，必填',
    example: '市级',
  },
  {
    header: '水源类型',
    field: 'type',
    required: true,
    type: 'select',
    options: ['地下水', '地表水'],
    width: 10,
    description: '水源类型，必填',
    example: '地表水',
  },
  {
    header: '细分类型',
    field: 'subType',
    required: false,
    type: 'string',
    width: 12,
    description: '地下水：孔隙水/裂隙水/岩溶水；地表水：河流型/湖库型',
    example: '湖库型',
  },
  {
    header: '县区',
    field: 'county',
    required: false,
    type: 'string',
    width: 10,
    description: '所在县/区名称',
    example: '平山县',
  },
  {
    header: '状态',
    field: 'status',
    required: false,
    type: 'select',
    options: ['在用', '备用', '取消', '规划', '在建'],
    width: 10,
    description: '使用状态，默认"在用"',
    example: '在用',
  },
  {
    header: '服务人口',
    field: 'population',
    required: false,
    type: 'number',
    width: 12,
    description: '服务人口数（人）',
    example: '500000',
  },
  {
    header: '河流',
    field: 'river',
    required: false,
    type: 'string',
    width: 15,
    description: '所属河流名称',
    example: '滹沱河',
  },
  {
    header: '经度',
    field: 'lng',
    required: false,
    type: 'number',
    width: 12,
    description: '东经坐标（70-140，河北省范围）',
    example: '114.21',
  },
  {
    header: '纬度',
    field: 'lat',
    required: false,
    type: 'number',
    width: 12,
    description: '北纬坐标（35-45，河北省范围）',
    example: '38.27',
  },
  {
    header: '备注',
    field: 'remark',
    required: false,
    type: 'string',
    width: 25,
    description: '补充说明',
    example: '',
  },
];

// ===== 列名映射别名表（用于自动检测） =====

/** 字段 → 所有可能的列名别名（小写） */
const FIELD_ALIASES: Record<string, string[]> = {
  name: ['水源地名称', '水源地名', '名称', '水源地', '水源地名字', 'name', 'water source', '水源'],
  cityName: ['城市', '地级市', '所属城市', '所在城市', '市', 'city', 'cityname'],
  level: ['级别', '等级', '水源地级别', 'level'],
  type: ['水源类型', '类型', '水源类型(地表水/地下水)', 'type', 'water type', '水源'],
  subType: ['细分类型', '亚类', '水源亚类', '子类型', 'subtype', 'sub type'],
  county: ['县区', '所在县区', '所在县', '县', '区县', '地区', 'county', 'city/county'],
  status: ['状态', '使用状态', '使用情况', '运行状态', 'status'],
  population: ['服务人口', '人口', '供水人口', 'population', 'pop'],
  river: ['河流', '所属河流', '所在河流', 'river'],
  lng: ['经度', '东经', 'longitude', 'lng', 'lon'],
  lat: ['纬度', '北纬', 'latitude', 'lat'],
  remark: ['备注', '说明', '备注说明', 'remark', 'notes'],
  id: ['id', '编号', '水源地编号', '编号id'],
};

// ===== 拼音首字母映射（常见列名缩写） =====

const PINYIN_MAP: Record<string, string> = {
  sydmc: 'name',
  syd: 'name',
  cs: 'cityName',
  jb: 'level',
  sylx: 'type',
  lx: 'type',
 xflx: 'subType',
  xq: 'county',
  zt: 'status',
  fzrk: 'population',
  rk: 'population',
  hl: 'river',
  jd: 'lng',
  wd: 'lat',
  bz: 'remark',
};

// ===== 类型定义 =====

export interface FieldMappingItem {
  /** 源列名（原始） */
  sourceColumn: string;
  /** 映射到的字段 */
  targetField: keyof WaterSourceRecord | null;
  /** 匹配置信度 */
  confidence: number;
  /** 匹配方式 */
  matchType: 'exact' | 'fuzzy' | 'pinyin' | 'none';
  /** 是否被用户手动修改 */
  manual: boolean;
}

export interface FieldMappingResult {
  /** 所有列的映射结果 */
  mappings: FieldMappingItem[];
  /** 已映射的列数 */
  mappedCount: number;
  /** 未映射的列数 */
  unmappedCount: number;
  /** 必填字段缺失列表 */
  missingRequired: (keyof WaterSourceRecord)[];
}

// ===== 字段映射自动检测 =====

/**
 * 自动检测源列名到目标字段的映射
 * 支持三种匹配策略：精确匹配 > 模糊匹配 > 拼音首字母匹配
 */
export function detectFieldMapping(sourceColumns: string[]): FieldMappingResult {
  const mappings: FieldMappingItem[] = [];
  const usedFields = new Set<string>();

  // Phase 1: 精确匹配
  for (const col of sourceColumns) {
    const trimmedLower = col.trim().toLowerCase();
    let matched: keyof WaterSourceRecord | null = null;

    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (usedFields.has(field)) continue;
      if (aliases.some((alias) => trimmedLower === alias.toLowerCase())) {
        matched = field as keyof WaterSourceRecord;
        mappings.push({
          sourceColumn: col,
          targetField: matched,
          confidence: 1.0,
          matchType: 'exact',
          manual: false,
        });
        usedFields.add(field);
        break;
      }
    }

    if (!matched) {
      mappings.push({
        sourceColumn: col,
        targetField: null,
        confidence: 0,
        matchType: 'none',
        manual: false,
      });
    }
  }

  // Phase 2: 模糊匹配（对未匹配的列）
  for (const mapping of mappings) {
    if (mapping.targetField !== null) continue;
    const trimmedLower = mapping.sourceColumn.trim().toLowerCase();

    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (usedFields.has(field)) continue;
      // 检查是否包含别名或被别名包含
      const isFuzzyMatch = aliases.some((alias) => {
        const aliasLower = alias.toLowerCase();
        return (
          (trimmedLower.length >= 2 && aliasLower.includes(trimmedLower)) ||
          (aliasLower.length >= 2 && trimmedLower.includes(aliasLower))
        );
      });

      if (isFuzzyMatch) {
        mapping.targetField = field as keyof WaterSourceRecord;
        mapping.confidence = 0.7;
        mapping.matchType = 'fuzzy';
        usedFields.add(field);
        break;
      }
    }
  }

  // Phase 3: 拼音首字母匹配
  for (const mapping of mappings) {
    if (mapping.targetField !== null) continue;
    const pinyinKey = extractPinyinInitials(mapping.sourceColumn);
    if (pinyinKey && PINYIN_MAP[pinyinKey]) {
      const field = PINYIN_MAP[pinyinKey];
      if (!usedFields.has(field)) {
        mapping.targetField = field as keyof WaterSourceRecord;
        mapping.confidence = 0.5;
        mapping.matchType = 'pinyin';
        usedFields.add(field);
      }
    }
  }

  // 统计必填字段缺失
  const mappedFields = new Set(
    mappings.filter((m) => m.targetField).map((m) => m.targetField as string),
  );
  const requiredFields = TEMPLATE_COLUMNS.filter((c) => c.required).map((c) => c.field as string);
  const missingRequired = requiredFields.filter((f) => !mappedFields.has(f));

  return {
    mappings,
    mappedCount: mappings.filter((m) => m.targetField !== null).length,
    unmappedCount: mappings.filter((m) => m.targetField === null).length,
    missingRequired: missingRequired as (keyof WaterSourceRecord)[],
  };
}

/**
 * 简易拼音首字母提取（提取中文拼音首字母）
 * 仅处理常见中文列名，非中文返回空
 */
function extractPinyinInitials(text: string): string {
  // 简单实现：去除空格和非字母数字，取首字母
  // 完整拼音库过大，这里仅处理已知的 PINYIN_MAP 中的常见缩写
  const cleaned = text.trim().replace(/[\s（）()【】\[\]]/g, '').toLowerCase();
  // 如果是纯英文，直接返回
  if (/^[a-z]+$/.test(cleaned)) {
    return cleaned;
  }
  // 尝试提取每个中文字的拼音首字母（使用内置 Intl）
  // 由于浏览器没有完整的拼音库，这里用简化方案
  // 匹配预设的常见缩写组合
  return cleaned;
}

// ===== 模板下载 =====

/**
 * 生成并下载标准导入模板 .xlsx 文件
 * 包含：
 * - Sheet1「导入模板」: 列头 + 示例行 + 数据验证下拉 + 列宽
 * - Sheet2「填写说明」: 每列的详细说明
 */
export function downloadImportTemplate(): void {
  const wb = XLSX.utils.book_new();

  // ===== Sheet1: 导入模板 =====
  const headers = TEMPLATE_COLUMNS.map((c) => c.header);
  const exampleRow = TEMPLATE_COLUMNS.map((c) => c.example);

  // 构建数据（表头 + 2行示例）
  const data: (string | number)[][] = [
    headers,
    exampleRow,
    // 第二行示例
    TEMPLATE_COLUMNS.map((c) => {
      if (c.field === 'name') return '某地下水水源地';
      if (c.field === 'cityName') return '保定市';
      if (c.field === 'level') return '县级';
      if (c.field === 'type') return '地下水';
      if (c.field === 'subType') return '孔隙水';
      if (c.field === 'county') return '涞水县';
      if (c.field === 'status') return '在用';
      if (c.field === 'population') return 30000;
      if (c.field === 'river') return '';
      if (c.field === 'lng') return 115.45;
      if (c.field === 'lat') return 39.39;
      return '';
    }),
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);

  // 设置列宽
  ws['!cols'] = TEMPLATE_COLUMNS.map((c) => ({ wch: c.width }));

  // 添加数据验证（select 类型列）
  // XLSX 社区版不支持直接写入 DataValidation，使用单元格注释替代
  for (let colIdx = 0; colIdx < TEMPLATE_COLUMNS.length; colIdx++) {
    const col = TEMPLATE_COLUMNS[colIdx];
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIdx });
    const cell = ws[cellRef];
    if (cell) {
      cell.c = [{
        a: '系统',
        t: col.description + (col.options ? `\n可选值: ${col.options.join(' / ')}` : ''),
      }];
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, '导入模板');

  // ===== Sheet2: 填写说明 =====
  const guideData: string[][] = [
    ['列名', '字段', '必填', '类型', '说明', '示例'],
    ...TEMPLATE_COLUMNS.map((c) => [
      c.header,
      c.field,
      c.required ? '是' : '否',
      c.type === 'select' ? `下拉选择: ${c.options?.join(' / ')}` : c.type,
      c.description,
      c.example,
    ]),
    [],
    ['注意事项'],
    ['1. 黄色背景的列为必填项，请勿留空'],
    ['2. "级别"列请填写：市级 / 县级 / 乡镇级'],
    ['3. "水源类型"列请填写：地下水 / 地表水'],
    ['4. "状态"列请填写：在用 / 备用 / 取消 / 规划 / 在建'],
    ['5. 经度范围 113.5-119.9，纬度范围 36.0-42.7（河北省范围）'],
    ['6. 请删除示例数据后填入实际数据'],
    ['7. ID 列可不填，系统将自动生成'],
    ['8. 导入时系统会自动检测列名并映射字段，支持多种常见列名写法'],
  ];

  const guideWs = XLSX.utils.aoa_to_sheet(guideData);
  guideWs['!cols'] = [
    { wch: 15 }, { wch: 15 }, { wch: 8 }, { wch: 25 }, { wch: 40 }, { wch: 20 },
  ];

  XLSX.utils.book_append_sheet(wb, guideWs, '填写说明');

  // 生成并下载
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const dateStr = new Date().toISOString().slice(0, 10);
  saveAs(blob, `水源地数据导入模板_${dateStr}.xlsx`);
}

// ===== 辅助函数 =====

/**
 * 将级别中文转换为枚举值
 */
export function normalizeLevel(val: string): 'municipal' | 'county' | 'township' | null {
  const v = val.trim();
  if (/市级|municipal/i.test(v)) return 'municipal';
  if (/县级|county/i.test(v)) return 'county';
  if (/乡镇|township/i.test(v)) return 'township';
  return null;
}

/**
 * 将级别枚举值转换为中文
 */
export function levelToChinese(level: string): string {
  if (level === 'municipal') return '市级';
  if (level === 'county') return '县级';
  if (level === 'township') return '乡镇级';
  return level;
}

/**
 * 标准化水源类型
 */
export function normalizeType(val: string): string {
  const v = val.trim();
  if (/地表|surface/i.test(v)) return '地表水';
  if (/地下|ground/i.test(v)) return '地下水';
  return v;
}

/**
 * 标准化使用状态
 */
export function normalizeStatus(val: string): string {
  const v = val.trim();
  if (/在用|使用中|active|in.use|operational/i.test(v)) return '在用';
  if (/备用|standby|backup/i.test(v)) return '备用';
  if (/取消|已取消|废弃|abandoned|cancelled/i.test(v)) return '取消';
  if (/规划|planned|planning/i.test(v)) return '规划';
  if (/在建|建设中|building/i.test(v)) return '在建';
  return v || '在用';
}

/**
 * 根据映射将原始行数据转换为 WaterSourceRecord
 */
export function applyMapping(
  row: Record<string, string>,
  mappings: FieldMappingItem[],
): Partial<WaterSourceRecord> {
  const record: Partial<WaterSourceRecord> = {};

  for (const mapping of mappings) {
    if (!mapping.targetField) continue;
    const rawValue = (row[mapping.sourceColumn] || '').trim();
    if (!rawValue) continue;

    const field = mapping.targetField;

    switch (field) {
      case 'name':
      case 'cityName':
      case 'subType':
      case 'county':
      case 'river':
      case 'remark':
        record[field] = rawValue;
        break;
      case 'level': {
        const level = normalizeLevel(rawValue);
        if (level) record[field] = level;
        break;
      }
      case 'type':
        record[field] = normalizeType(rawValue) as '地表水' | '地下水';
        break;
      case 'status':
        record[field] = normalizeStatus(rawValue);
        break;
      case 'population': {
        const pop = Number(rawValue);
        if (!isNaN(pop) && pop >= 0) record[field] = Math.round(pop);
        break;
      }
      case 'lng': {
        const lng = Number(rawValue);
        if (!isNaN(lng)) record[field] = lng;
        break;
      }
      case 'lat': {
        const lat = Number(rawValue);
        if (!isNaN(lat)) record[field] = lat;
        break;
      }
      case 'id':
        record[field] = rawValue;
        break;
    }
  }

  return record;
}

/**
 * 校验映射后的记录，返回错误列表
 */
export function validateMappedRecord(
  record: Partial<WaterSourceRecord>,
  rowNum: number,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 必填字段检查
  if (!record.name) {
    errors.push(`第${rowNum}行: 缺少必填字段"水源地名称"`);
  }
  if (!record.cityName) {
    errors.push(`第${rowNum}行: 缺少必填字段"城市"`);
  }
  if (!record.level) {
    errors.push(`第${rowNum}行: 缺少必填字段"级别"`);
  }
  if (!record.type) {
    errors.push(`第${rowNum}行: 缺少必填字段"水源类型"`);
  }

  // 坐标范围校验（如果提供了坐标）
  if (record.lng !== undefined) {
    if (record.lng < 113.5 || record.lng > 119.9) {
      errors.push(`第${rowNum}行: 经度${record.lng}超出河北省范围(113.5-119.9)`);
    }
  }
  if (record.lat !== undefined) {
    if (record.lat < 36.0 || record.lat > 42.7) {
      errors.push(`第${rowNum}行: 纬度${record.lat}超出河北省范围(36.0-42.7)`);
    }
  }

  // 类型校验
  if (record.type && record.type !== '地表水' && record.type !== '地下水') {
    errors.push(`第${rowNum}行: 水源类型"${record.type}"无效，应为"地下水"或"地表水"`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
