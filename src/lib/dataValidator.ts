/* ===== 数据校验引擎 =====
 * 对导入的水源地数据进行完整性、合规性校验
 * 支持必填字段、类型格式、坐标范围、重复检测
 */

import type { WaterSourceInfo } from '@/types';
import type { ImportWarning } from './dataImportEngine';

// ===== 校验结果 =====

export interface ValidationResult {
  /** 总体是否通过 */
  valid: boolean;
  /** 通过项数 */
  passed: number;
  /** 失败项数 */
  failed: number;
  /** 警告项数 */
  warnings: number;
  /** 详细校验结果 */
  items: ValidationItem[];
  /** 按严重程度汇总 */
  summary: ValidationSummary;
}

export interface ValidationItem {
  /** 水源地名称 */
  name: string;
  /** 行号 */
  row: number;
  /** 校验规则名 */
  rule: string;
  /** 校验描述 */
  description: string;
  /** 严重程度 */
  level: 'error' | 'warning' | 'info';
  /** 是否通过 */
  passed: boolean;
  /** 详细消息 */
  message: string;
  /** 相关字段 */
  field?: string;
  /** 当前值 */
  currentValue?: string;
  /** 期望值/建议值 */
  expectedValue?: string;
}

export interface ValidationSummary {
  total: number;
  errors: number;
  warnings: number;
  passed: number;
  /** 按规则分组的失败数 */
  failedByRule: Record<string, number>;
}

// ===== 校验规则 =====

export interface ValidationRule {
  name: string;
  description: string;
  level: 'error' | 'warning' | 'info';
  validate: (
    item: WaterSourceInfo,
    index: number,
    allItems?: WaterSourceInfo[],
  ) => ValidationItem | null;
}

/** 河北省经纬度范围（含周边） */
const HEBEI_BOUNDS = {
  minLat: 36.0,
  maxLat: 42.7,
  minLng: 113.5,
  maxLng: 119.9,
};

/** 有效的水源类型 */
const VALID_TYPES: ReadonlySet<string> = new Set(['地表水', '地下水']);

/** 有效的使用状态 */
const VALID_STATUSES: ReadonlySet<string> = new Set(['在用', '备用', '取消', '规划']);

// ===== 校验规则定义 =====

const VALIDATION_RULES: ValidationRule[] = [
  // R1: 名称必填
  {
    name: 'name_required',
    description: '水源地名称不能为空',
    level: 'error',
    validate: (item, index) => {
      if (!item.name || item.name.trim() === '') {
        return {
          name: item.name || '',
          row: index + 1,
          rule: 'name_required',
          description: '水源地名称不能为空',
          level: 'error',
          passed: false,
          message: '缺少水源地名称',
          field: 'name',
        };
      }
      return null;
    },
  },

  // R2: 名称长度
  {
    name: 'name_length',
    description: '水源地名称长度应在1-100字符之间',
    level: 'warning',
    validate: (item, index) => {
      if (item.name && item.name.length > 100) {
        return {
          name: item.name,
          row: index + 1,
          rule: 'name_length',
          description: '水源地名称过长',
          level: 'warning',
          passed: false,
          message: `名称长度 ${item.name.length} 字符，建议不超过100字符`,
          field: 'name',
          currentValue: item.name,
        };
      }
      return null;
    },
  },

  // R3: 水源类型有效性
  {
    name: 'type_valid',
    description: '水源类型须为"地表水"或"地下水"',
    level: 'error',
    validate: (item, index) => {
      if (item.type && !VALID_TYPES.has(item.type)) {
        return {
          name: item.name,
          row: index + 1,
          rule: 'type_valid',
          description: '水源类型无效',
          level: 'error',
          passed: false,
          message: `水源类型 "${item.type}" 无效，须为"地表水"或"地下水"`,
          field: 'type',
          currentValue: item.type,
          expectedValue: '地表水 或 地下水',
        };
      }
      return null;
    },
  },

  // R4: 县区必填
  {
    name: 'county_required',
    description: '所在县区不能为空',
    level: 'warning',
    validate: (item, index) => {
      if (!item.county || item.county.trim() === '' || item.county === '未知') {
        return {
          name: item.name,
          row: index + 1,
          rule: 'county_required',
          description: '缺少县区信息',
          level: 'warning',
          passed: false,
          message: '缺少所在县区信息，建议补充',
          field: 'county',
          currentValue: item.county,
        };
      }
      return null;
    },
  },

  // R5: 使用状态有效性
  {
    name: 'status_valid',
    description: '使用状态须为"在用/备用/取消/规划"之一',
    level: 'error',
    validate: (item, index) => {
      if (item.status && !VALID_STATUSES.has(item.status)) {
        return {
          name: item.name,
          row: index + 1,
          rule: 'status_valid',
          description: '使用状态无效',
          level: 'error',
          passed: false,
          message: `使用状态 "${item.status}" 无效，须为"在用/备用/取消/规划"之一`,
          field: 'status',
          currentValue: item.status,
          expectedValue: '在用/备用/取消/规划',
        };
      }
      return null;
    },
  },

  // R6: 名称重复检测（在批量数据中）
  {
    name: 'name_duplicate',
    description: '水源地名称在导入数据中重复',
    level: 'warning',
    validate: (item, index, allItems) => {
      if (!item.name) return null;
      const items = allItems || [];
      const duplicates = items.filter((s, i) => s.name === item.name && i !== index);
      if (duplicates.length > 0) {
        return {
          name: item.name,
          row: index + 1,
          rule: 'name_duplicate',
          description: '水源地名称重复',
          level: 'warning',
          passed: false,
          message: `"${item.name}" 在导入数据中出现 ${duplicates.length + 1} 次`,
          field: 'name',
          currentValue: item.name,
        };
      }
      return null;
    },
  },

  // R7: 子类型过长
  {
    name: 'subtype_length',
    description: '细分类型长度不超过50字符',
    level: 'info',
    validate: (item, index) => {
      if (item.subType && item.subType.length > 50) {
        return {
          name: item.name,
          row: index + 1,
          rule: 'subtype_length',
          description: '细分类型过长',
          level: 'info',
          passed: false,
          message: `细分类型 "${item.subType}" 长度 ${item.subType.length} 字符，建议简化`,
          field: 'subType',
          currentValue: item.subType,
        };
      }
      return null;
    },
  },

  // R8: 备注过长
  {
    name: 'remark_length',
    description: '备注长度不超过500字符',
    level: 'info',
    validate: (item, index) => {
      if (item.remark && item.remark.length > 500) {
        return {
          name: item.name,
          row: index + 1,
          rule: 'remark_length',
          description: '备注过长',
          level: 'info',
          passed: false,
          message: `备注长度 ${item.remark.length} 字符，建议精简`,
          field: 'remark',
          currentValue: item.remark,
        };
      }
      return null;
    },
  },
];

// ===== 主函数 =====

/**
 * 对导入的水源地数据执行全部校验
 */
export function validateWaterSources(data: WaterSourceInfo[]): ValidationResult {
  const items: ValidationItem[] = [];

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    for (const rule of VALIDATION_RULES) {
      const result = rule.validate(item, i, data);
      if (result) {
        items.push(result);
      }
    }
  }

  // 汇总
  const errors = items.filter((i) => i.level === 'error' && !i.passed);
  const warnings = items.filter((i) => i.level === 'warning' && !i.passed);
  const passed = items.filter((i) => i.passed);
  const failedByRule: Record<string, number> = {};

  for (const item of items) {
    if (!item.passed) {
      failedByRule[item.rule] = (failedByRule[item.rule] || 0) + 1;
    }
  }

  return {
    valid: errors.length === 0,
    passed: passed.length,
    failed: errors.length + warnings.length,
    warnings: warnings.length,
    items,
    summary: {
      total: items.length,
      errors: errors.length,
      warnings: warnings.length,
      passed: passed.length,
      failedByRule,
    },
  };
}

/**
 * 快速检查：仅检查必填字段
 */
export function quickValidate(data: WaterSourceInfo[]): {
  valid: boolean;
  missingNames: string[];
  invalidTypes: string[];
  invalidStatuses: string[];
} {
  const missingNames: string[] = [];
  const invalidTypes: string[] = [];
  const invalidStatuses: string[] = [];

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!item.name || item.name.trim() === '') {
      missingNames.push(`行 ${i + 1}`);
    }
    if (item.type && !VALID_TYPES.has(item.type)) {
      invalidTypes.push(item.name || `行 ${i + 1}`);
    }
    if (item.status && !VALID_STATUSES.has(item.status)) {
      invalidStatuses.push(item.name || `行 ${i + 1}`);
    }
  }

  return {
    valid: missingNames.length === 0 && invalidTypes.length === 0 && invalidStatuses.length === 0,
    missingNames,
    invalidTypes,
    invalidStatuses,
  };
}

/**
 * 检查与已有数据是否重复
 */
export function checkDuplicates(
  newData: WaterSourceInfo[],
  existingData: WaterSourceInfo[],
): { duplicate: WaterSourceInfo[]; unique: WaterSourceInfo[] } {
  const existingNames = new Set(existingData.map((d) => d.name));
  const duplicate: WaterSourceInfo[] = [];
  const unique: WaterSourceInfo[] = [];

  for (const item of newData) {
    if (existingNames.has(item.name)) {
      duplicate.push(item);
    } else {
      unique.push(item);
      existingNames.add(item.name);
    }
  }

  return { duplicate, unique };
}
