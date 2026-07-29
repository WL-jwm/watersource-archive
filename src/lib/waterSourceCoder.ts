/**
 * P4-8: 水源地编码规范化
 *
 * 编码规则参考：
 * - HJ/T 415-2008《环境保护编码技术规范》
 * - GB/T 2260《中华人民共和国行政区划代码》
 * - 环办函〔2012〕519号《集中式饮用水水源地编码规则》
 *
 * 编码格式：SD + 行政区划代码(6位) + 水源类型(1位) + 级别(1位) + 序号(3位)
 * 示例：SD130100-1-1-001（石家庄市-地下水-市级-001号）
 */

import type { WaterSourceRecord } from '@/stores/waterSourceStore';

// ===== 河北省行政区划代码 =====

export const CITY_CODES: Record<string, string> = {
  石家庄市: '130100',
  唐山市: '130200',
  秦皇岛市: '130300',
  邯郸市: '130400',
  邢台市: '130500',
  保定市: '130600',
  张家口市: '130700',
  承德市: '130800',
  沧州市: '130900',
  廊坊市: '131000',
  衡水市: '131100',
  雄安新区: '133100',
  辛集市: '130181',
  定州市: '130682',
};

/** 水源类型编码 */
const TYPE_CODES: Record<string, string> = {
  地下水: '1',
  地表水: '2',
};

/** 级别编码 */
const LEVEL_CODES: Record<string, string> = {
  municipal: '1',
  county: '2',
  township: '3',
};

/** 级别中文 */
const LEVEL_NAMES: Record<string, string> = {
  municipal: '市级',
  county: '县级',
  township: '镇级',
};

// ===== 编码类型 =====

export interface StandardCode {
  /** 标准编码 */
  code: string;
  /** 编码分解 */
  parts: {
    prefix: string; // SD
    adminCode: string; // 行政区划代码
    cityName: string; // 城市名
    typeCode: string; // 类型编码
    typeName: string; // 类型名
    levelCode: string; // 级别编码
    levelName: string; // 级别名
    serial: string; // 序号
  };
  /** 原始ID */
  originalId: string;
}

// ===== 编码生成 =====

/**
 * 为单个水源地生成标准编码
 */
export function generateStandardCode(
  record: WaterSourceRecord,
  serialNumber: number,
): StandardCode {
  const adminCode = CITY_CODES[record.cityName] || '139900';
  const typeCode = TYPE_CODES[record.type] || '0';
  const levelCode = LEVEL_CODES[record.level] || '0';
  const serial = String(serialNumber).padStart(3, '0');

  const code = `SD${adminCode}${typeCode}${levelCode}${serial}`;

  return {
    code,
    parts: {
      prefix: 'SD',
      adminCode,
      cityName: record.cityName,
      typeCode,
      typeName: record.type,
      levelCode,
      levelName: LEVEL_NAMES[record.level] || record.level,
      serial,
    },
    originalId: record.id,
  };
}

/**
 * 批量生成标准编码
 * 按城市→级别→类型分组，组内按序号递增
 */
export function batchGenerateCodes(records: WaterSourceRecord[]): Map<string, StandardCode> {
  const codeMap = new Map<string, StandardCode>();

  // 按城市+级别+类型分组计数
  const counters: Record<string, number> = {};

  for (const record of records) {
    const groupKey = `${record.cityName}_${record.level}_${record.type}`;
    counters[groupKey] = (counters[groupKey] || 0) + 1;

    const code = generateStandardCode(record, counters[groupKey]);
    codeMap.set(record.id, code);
  }

  return codeMap;
}

/**
 * 解析标准编码为可读信息
 */
export function parseStandardCode(code: string): StandardCode['parts'] | null {
  if (!code.startsWith('SD') || code.length !== 13) return null;

  const adminCode = code.substring(2, 8);
  const typeCode = code.substring(8, 9);
  const levelCode = code.substring(9, 10);
  const serial = code.substring(10, 13);

  // 反查城市名
  const cityName = Object.entries(CITY_CODES).find(([_, v]) => v === adminCode)?.[0] || '未知';
  const typeName = Object.entries(TYPE_CODES).find(([_, v]) => v === typeCode)?.[0] || '未知';
  const levelKey = Object.entries(LEVEL_CODES).find(([_, v]) => v === levelCode)?.[0] || '';
  const levelName = LEVEL_NAMES[levelKey] || '未知';

  return {
    prefix: 'SD',
    adminCode,
    cityName,
    typeCode,
    typeName,
    levelCode,
    levelName,
    serial,
  };
}

/**
 * 导出编码对照表为Excel行数据
 */
export function toExcelRows(codeMap: Map<string, StandardCode>): Array<{
  code: string;
  name: string;
  cityName: string;
  typeName: string;
  levelName: string;
  county: string;
  status: string;
  adminCode: string;
}> {
  const rows: Array<{
    code: string;
    name: string;
    cityName: string;
    typeName: string;
    levelName: string;
    county: string;
    status: string;
    adminCode: string;
  }> = [];

  // 通过originalId反查name等信息——这里需要record列表辅助
  // 直接从codeMap中提取
  for (const [, code] of codeMap) {
    rows.push({
      code: code.code,
      name: '', // 需要从record中查找
      cityName: code.parts.cityName,
      typeName: code.parts.typeName,
      levelName: code.parts.levelName,
      county: '',
      status: '',
      adminCode: code.parts.adminCode,
    });
  }

  return rows;
}

/**
 * 统计编码信息
 */
export function summarizeCodes(codeMap: Map<string, StandardCode>): {
  total: number;
  byCity: Array<{ city: string; count: number; adminCode: string }>;
  byType: Array<{ type: string; count: number }>;
  byLevel: Array<{ level: string; count: number }>;
  codeCoverage: number;
} {
  let byCity: Record<string, number> = {};
  let byType: Record<string, number> = {};
  let byLevel: Record<string, number> = {};

  for (const [, code] of codeMap) {
    const city = code.parts.cityName;
    const type = code.parts.typeName;
    const level = code.parts.levelName;
    byCity[city] = (byCity[city] || 0) + 1;
    byType[type] = (byType[type] || 0) + 1;
    byLevel[level] = (byLevel[level] || 0) + 1;
  }

  return {
    total: codeMap.size,
    byCity: Object.entries(byCity)
      .map(([city, count]) => ({
        city,
        count,
        adminCode: CITY_CODES[city] || '',
      }))
      .sort((a, b) => b.count - a.count),
    byType: Object.entries(byType).map(([type, count]) => ({ type, count })),
    byLevel: Object.entries(byLevel).map(([level, count]) => ({ level, count })),
    codeCoverage: codeMap.size > 0 ? 100 : 0,
  };
}

// ===== N2: 编码校验与补全 =====

/** 格式化编码为可读形式 SD130100-1-1-001 */
export function formatCodeForDisplay(code: string): string {
  if (!code || code.length !== 13 || !code.startsWith('SD')) return code;
  const admin = code.substring(2, 8);
  const type = code.substring(8, 9);
  const level = code.substring(9, 10);
  const serial = code.substring(10, 13);
  return `SD${admin}-${type}-${level}-${serial}`;
}

/** 编码校验结果 */
export interface CodeValidationResult {
  recordId: string;
  recordName: string;
  cityName: string;
  level: string;
  type: string;
  generatedCode: string;
  displayCode: string;
  issues: string[];
  valid: boolean;
}

/** 校验单条记录的编码生成条件 */
export function validateRecordForCoding(record: WaterSourceRecord): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!record.cityName) {
    issues.push('缺少城市名称');
  } else if (!CITY_CODES[record.cityName]) {
    issues.push(`城市"${record.cityName}"不在河北省行政区划代码表中`);
  }

  if (!record.type) {
    issues.push('缺少水源类型');
  } else if (!TYPE_CODES[record.type]) {
    issues.push(`水源类型"${record.type}"无效（应为"地下水"或"地表水"）`);
  }

  if (!record.level) {
    issues.push('缺少级别');
  } else if (!LEVEL_CODES[record.level]) {
    issues.push(`级别"${record.level}"无效（应为 municipal/county/township）`);
  }

  if (!record.name || !record.name.trim()) {
    issues.push('缺少水源地名称');
  }

  return { valid: issues.length === 0, issues };
}

/** 校验编码字符串格式 */
export function validateCode(code: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!code) {
    errors.push('编码为空');
    return { valid: false, errors };
  }

  if (!code.startsWith('SD')) {
    errors.push('编码应以"SD"开头');
  }

  if (code.length !== 13) {
    errors.push(`编码长度应为13位（当前${code.length}位）`);
  }

  if (code.length >= 8) {
    const adminCode = code.substring(2, 8);
    const cityName = Object.entries(CITY_CODES).find(([_, v]) => v === adminCode)?.[0];
    if (!cityName) {
      errors.push(`行政区划代码"${adminCode}"不在河北省代码表中`);
    }
  }

  if (code.length >= 9) {
    const typeCode = code.substring(8, 9);
    if (!Object.values(TYPE_CODES).includes(typeCode)) {
      errors.push(`水源类型编码"${typeCode}"无效（应为1或2）`);
    }
  }

  if (code.length >= 10) {
    const levelCode = code.substring(9, 10);
    if (!Object.values(LEVEL_CODES).includes(levelCode)) {
      errors.push(`级别编码"${levelCode}"无效（应为1、2或3）`);
    }
  }

  if (code.length >= 13) {
    const serial = code.substring(10, 13);
    if (!/^\d{3}$/.test(serial)) {
      errors.push(`序号"${serial}"应为3位数字`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/** 批量校验所有水源地记录的编码 */
export function batchValidateCodes(records: WaterSourceRecord[]): CodeValidationResult[] {
  const codeMap = batchGenerateCodes(records);
  const results: CodeValidationResult[] = [];

  for (const record of records) {
    const validation = validateRecordForCoding(record);
    const code = codeMap.get(record.id);

    results.push({
      recordId: record.id,
      recordName: record.name || '(未命名)',
      cityName: record.cityName || '(缺失)',
      level: record.level || '(缺失)',
      type: record.type || '(缺失)',
      generatedCode: code?.code || '',
      displayCode: code ? formatCodeForDisplay(code.code) : '(无法生成)',
      issues: validation.issues,
      valid: validation.valid,
    });
  }

  return results;
}

/** 生成表单预览编码（不需要完整记录） */
export function generateCodePreview(
  cityName: string,
  level: string,
  type: string,
  existingRecords: WaterSourceRecord[],
  excludeId?: string,
): string {
  const adminCode = CITY_CODES[cityName];
  const typeCode = TYPE_CODES[type];
  const levelCode = LEVEL_CODES[level];

  if (!adminCode || !typeCode || !levelCode) {
    return '(请补全城市、类型、级别)';
  }

  // 计算同组已有数量+1
  const sameGroup = existingRecords.filter(
    (r) =>
      r.cityName === cityName &&
      r.level === level &&
      r.type === type &&
      r.id !== excludeId,
  );
  const serial = String(sameGroup.length + 1).padStart(3, '0');

  return formatCodeForDisplay(`SD${adminCode}${typeCode}${levelCode}${serial}`);
}

/** 获取编码校验统计摘要 */
export function summarizeValidation(results: CodeValidationResult[]): {
  total: number;
  valid: number;
  invalid: number;
  issueBreakdown: Record<string, number>;
} {
  const issueBreakdown: Record<string, number> = {};
  let valid = 0;

  for (const r of results) {
    if (r.valid) {
      valid++;
    } else {
      for (const issue of r.issues) {
        issueBreakdown[issue] = (issueBreakdown[issue] || 0) + 1;
      }
    }
  }

  return {
    total: results.length,
    valid,
    invalid: results.length - valid,
    issueBreakdown,
  };
}
