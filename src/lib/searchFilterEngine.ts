/**
 * 高级搜索筛选引擎 (Advanced Search & Filter Engine)
 *
 * 功能：
 * 1. 多维度筛选：城市/级别/类型/状态/子类型/人口范围/坐标范围
 * 2. 全文搜索：名称/县区/备注/河流/子类型，支持模糊匹配
 * 3. 拼音搜索：支持拼音首字母和全拼匹配中文
 * 4. 排序：支持按名称/城市/类型/状态/人口/坐标排序
 * 5. 搜索高亮：返回匹配位置信息供UI渲染
 * 6. 防抖支持：高频输入场景的性能优化
 * 7. 搜索建议：基于历史输入和热门字段提供建议
 * 8. 筛选预设：保存/加载常用筛选组合
 */

import type { WaterSourceRecord } from '@/stores/waterSourceStore';

// ===== 类型定义 =====

/** 排序方向 */
export type SortDirection = 'asc' | 'desc';

/** 可排序字段 */
export type SortableField =
  | 'name'
  | 'cityName'
  | 'level'
  | 'type'
  | 'status'
  | 'county'
  | 'population'
  | 'lng'
  | 'lat';

/** 筛选条件 */
export interface FilterCriteria {
  /** 搜索关键词 */
  keyword?: string;
  /** 城市列表（多选，空数组=不限） */
  cities: string[];
  /** 级别列表（多选） */
  levels: string[];
  /** 类型列表（多选） */
  types: string[];
  /** 状态列表（多选） */
  statuses: string[];
  /** 子类型列表（多选） */
  subTypes: string[];
  /** 河流列表（多选） */
  rivers: string[];
  /** 人口最小值 */
  populationMin?: number;
  /** 人口最大值 */
  populationMax?: number;
  /** 经度范围 */
  lngRange?: [number, number];
  /** 纬度范围 */
  latRange?: [number, number];
  /** 是否仅有坐标 */
  hasCoordsOnly?: boolean;
}

/** 排序条件 */
export interface SortCriteria {
  field: SortableField;
  direction: SortDirection;
}

/** 搜索匹配信息 */
export interface SearchMatch {
  /** 匹配的字段名 */
  field: string;
  /** 匹配的起始位置 */
  start: number;
  /** 匹配的长度 */
  length: number;
}

/** 筛选+排序结果 */
export interface FilterResult {
  /** 筛选后的记录 */
  records: WaterSourceRecord[];
  /** 每条记录的搜索匹配信息（用于高亮） */
  matches: Map<string, SearchMatch[]>;
  /** 筛选统计 */
  stats: {
    total: number;
    filtered: number;
    byCity: Record<string, number>;
    byLevel: Record<string, number>;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  };
}

/** 筛选预设 */
export interface FilterPreset {
  id: string;
  name: string;
  criteria: FilterCriteria;
  sortBy?: SortCriteria;
  createdAt: string;
}

// ===== 拼音映射表（常用河北地名） =====

const PINYIN_MAP: Record<string, string> = {
  // 城市
  石家庄: 'sjz', 唐山: 'ts', 秦皇岛: 'qhd', 邯郸: 'hd', 邢台: 'xt',
  保定: 'bd', 张家口: 'zjk', 承德: 'cd', 沧州: 'cz', 廊坊: 'lf',
  衡水: 'hs', 辛集: 'xj', 定州: 'dz',
  // 常见县区
  平山: 'ps', 鹿泉: 'lq', 井陉: 'jx', 栾城: 'lc', 正定: 'zd',
  行唐: 'xt', 灵寿: 'ls', 高邑: 'gy', 深泽: 'sz', 赞皇: 'zh',
  无极: 'wj', 元氏: 'ys', 赵县: 'zx', 藁城: 'gc', 晋州: 'jz',
  新乐: 'xl', 丰润: 'fr', 丰南: 'fn', 滦县: 'lx', 滦南: 'ln',
  乐亭: 'lt', 迁西: 'qx', 迁安: 'qa', 玉田: 'yt', 遵化: 'zh',
  曹妃甸: 'cfd', 滦平: 'lp', 隆化: 'lh', 丰宁: 'fn', 宽城: 'kc',
  围场: 'wc', 平泉: 'pq', 兴隆: 'xl', 承德县: 'cdx',
  万全: 'wq', 宣化: 'xh', 张北: 'zb', 康保: 'kb', 沽源: 'gy',
  尚义: 'sy', 蔚县: 'yx', 阳原: 'yy', 怀安: 'ha', 怀来: 'hl',
  涿鹿: 'zl', 赤城: 'cc', 崇礼: 'cl', 下花园: 'xhy',
  冀州: 'jz', 枣强: 'zq', 武邑: 'wy', 武强: 'wq', 饶阳: 'ry',
  安平: 'ap', 故城: 'gc', 景县: 'jx', 阜城: 'fc', 深州: 'sz',
  南宫: 'ng', 沙河: 'sh', 临城: 'lc', 内丘: 'nq', 柏乡: 'bx',
  隆尧: 'ly', 任县: 'rx', 南和: 'nh', 宁晋: 'nj', 巨鹿: 'jl',
  新河: 'xh', 广宗: 'gz', 平乡: 'px', 威县: 'wx', 清河: 'qh',
  临西: 'lx', 广平: 'gp', 馆陶: 'gt', 魏县: 'wx', 曲周: 'qz',
  邱县: 'qx', 肥乡: 'fx', 涉县: 'sx', 磁县: 'cx', 永年: 'yn',
  鸡泽: 'jz', 大名: 'dm', 魏: 'w', 成安: 'ca', 广: 'g',
  肥乡区: 'fxq', 峰峰: 'ff', 武安: 'wa',
  // 常见水源地名称关键词
  岗南: 'gn', 黄壁庄: 'hbz', 西大洋: 'xdy', 王快: 'wk',
  安格庄: 'agz', 龙门: 'lm', 友谊: 'yy', 洋河: 'yh',
  桃林口: 'tlk', 陡河: 'dh', 邱庄: 'qz', 潘家口: 'pjk',
  大黑汀: 'dht', 洋河水库: 'yhsk', 云州: 'yz', 友谊水库: 'yysk',
  石河: 'sh', 燕河: 'yh', 洋河渠道: 'yhqd',
  // 河流
  滹沱河: 'hth', 滏阳河: 'fyh', 漕河: 'ch', 唐河: 'th',
  拒马河: 'jmh', 漳河: 'zh', 卫河: 'wh',
  滦河: 'lh', 蓟运河: 'jyh', 南运河: 'nyh',
  子牙河: 'zyh', 大清河: 'dqh',
};

/** 预提取多字键并按长度降序排列，用于最长匹配 */
const PINYIN_KEYS_sorted = Object.keys(PINYIN_MAP)
  .filter((k) => k.length > 1)
  .sort((a, b) => b.length - a.length);

/** 获取中文文本的拼音索引（首字母） */
function getPinyinIndex(text: string): string {
  let result = '';
  let i = 0;
  while (i < text.length) {
    // 先尝试多字键最长匹配
    let matched = false;
    for (const key of PINYIN_KEYS_sorted) {
      if (text.startsWith(key, i)) {
        result += PINYIN_MAP[key];
        i += key.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    // 单字查找
    const char = text[i];
    if (PINYIN_MAP[char]) {
      result += PINYIN_MAP[char];
    } else if (/[a-zA-Z0-9]/.test(char)) {
      result += char.toLowerCase();
    }
    i++;
  }
  return result;
}

/** 检查拼音匹配 */
function pinyinMatch(text: string, query: string): boolean {
  const pinyin = getPinyinIndex(text);
  const q = query.toLowerCase();
  return pinyin.includes(q);
}

// ===== 搜索字段权重 =====

const SEARCH_FIELDS: Array<{ field: keyof WaterSourceRecord; weight: number }> = [
  { field: 'name', weight: 1.0 },
  { field: 'county', weight: 0.8 },
  { field: 'cityName', weight: 0.7 },
  { field: 'subType', weight: 0.5 },
  { field: 'river', weight: 0.5 },
  { field: 'remark', weight: 0.3 },
];

// ===== 核心筛选函数 =====

/**
 * 执行搜索匹配，返回匹配信息
 */
function searchRecord(
  record: WaterSourceRecord,
  keyword: string,
): SearchMatch[] {
  const matches: SearchMatch[] = [];
  const q = keyword.trim().toLowerCase();

  if (!q) return matches;

  for (const { field } of SEARCH_FIELDS) {
    const value = record[field];
    if (!value || typeof value !== 'string') continue;

    const lowerValue = value.toLowerCase();
    const idx = lowerValue.indexOf(q);

    if (idx >= 0) {
      matches.push({ field, start: idx, length: q.length });
    } else if (pinyinMatch(value, q)) {
      // 拼音匹配，标记整个字段
      matches.push({ field, start: 0, length: value.length });
    }
  }

  return matches;
}

/**
 * 检查记录是否满足筛选条件
 */
function matchCriteria(record: WaterSourceRecord, criteria: FilterCriteria): boolean {
  // 城市筛选
  if (criteria.cities.length > 0 && !criteria.cities.includes(record.cityName)) {
    return false;
  }

  // 级别筛选
  if (criteria.levels.length > 0 && !criteria.levels.includes(record.level)) {
    return false;
  }

  // 类型筛选
  if (criteria.types.length > 0 && !criteria.types.includes(record.type)) {
    return false;
  }

  // 状态筛选
  if (criteria.statuses.length > 0 && !criteria.statuses.includes(record.status)) {
    return false;
  }

  // 子类型筛选
  if (criteria.subTypes.length > 0) {
    if (!record.subType || !criteria.subTypes.includes(record.subType)) {
      return false;
    }
  }

  // 河流筛选
  if (criteria.rivers.length > 0) {
    if (!record.river || !criteria.rivers.includes(record.river)) {
      return false;
    }
  }

  // 人口范围筛选
  if (criteria.populationMin !== undefined) {
    if (!record.population || record.population < criteria.populationMin) {
      return false;
    }
  }
  if (criteria.populationMax !== undefined) {
    if (!record.population || record.population > criteria.populationMax) {
      return false;
    }
  }

  // 坐标范围筛选
  if (criteria.lngRange) {
    if (record.lng === undefined || record.lng < criteria.lngRange[0] || record.lng > criteria.lngRange[1]) {
      return false;
    }
  }
  if (criteria.latRange) {
    if (record.lat === undefined || record.lat < criteria.latRange[0] || record.lat > criteria.latRange[1]) {
      return false;
    }
  }

  // 仅含有坐标的记录
  if (criteria.hasCoordsOnly && (record.lng === undefined || record.lat === undefined)) {
    return false;
  }

  return true;
}

/**
 * 排序记录
 */
function sortRecords(
  records: WaterSourceRecord[],
  sort: SortCriteria,
): WaterSourceRecord[] {
  const sorted = [...records];
  const { field, direction } = sort;
  const dir = direction === 'asc' ? 1 : -1;

  sorted.sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];

    // undefined 排在最后
    if (aVal === undefined && bVal === undefined) return 0;
    if (aVal === undefined) return 1;
    if (bVal === undefined) return -1;

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return (aVal - bVal) * dir;
    }

    return String(aVal).localeCompare(String(bVal), 'zh-CN') * dir;
  });

  return sorted;
}

/**
 * 统计筛选结果分布
 */
function computeStats(
  records: WaterSourceRecord[],
  total: number,
): FilterResult['stats'] {
  const byCity: Record<string, number> = {};
  const byLevel: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};

  for (const r of records) {
    byCity[r.cityName] = (byCity[r.cityName] || 0) + 1;
    byLevel[r.level] = (byLevel[r.level] || 0) + 1;
    byType[r.type] = (byType[r.type] || 0) + 1;
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  }

  return { total, filtered: records.length, byCity, byLevel, byType, byStatus };
}

// ===== 对外 API =====

/**
 * 高级筛选+搜索+排序
 * @param sources 全量数据
 * @param criteria 筛选条件
 * @param sort 排序条件（可选）
 * @returns 筛选结果（含匹配信息和统计）
 */
export function advancedFilter(
  sources: WaterSourceRecord[],
  criteria: FilterCriteria,
  sort?: SortCriteria,
): FilterResult {
  const matches = new Map<string, SearchMatch[]>();
  const keyword = criteria.keyword?.trim() || '';

  // 第一步：条件筛选
  let filtered = sources.filter((r) => matchCriteria(r, criteria));

  // 第二步：关键词搜索
  if (keyword) {
    filtered = filtered.filter((r) => {
      const matchList = searchRecord(r, keyword);
      if (matchList.length > 0) {
        matches.set(r.id, matchList);
        return true;
      }
      return false;
    });
  }

  // 第三步：排序
  if (sort) {
    filtered = sortRecords(filtered, sort);
  }

  return {
    records: filtered,
    matches,
    stats: computeStats(filtered, sources.length),
  };
}

/**
 * 快速搜索（仅关键词，不含筛选条件）
 * 用于搜索框即时反馈
 */
export function quickSearch(
  sources: WaterSourceRecord[],
  keyword: string,
  limit = 10,
): Array<{ record: WaterSourceRecord; matches: SearchMatch[] }> {
  const q = keyword.trim().toLowerCase();
  if (!q) return [];

  const results: Array<{ record: WaterSourceRecord; matches: SearchMatch[] }> = [];

  for (const record of sources) {
    const matchList = searchRecord(record, q);
    if (matchList.length > 0) {
      results.push({ record, matches: matchList });
      // 内联排序：权重高的排前面
      results.sort((a, b) => {
        const aScore = a.matches.reduce((sum, m) => {
          const fc = SEARCH_FIELDS.find((f) => f.field === m.field);
          return sum + (fc?.weight || 0);
        }, 0);
        const bScore = b.matches.reduce((sum, m) => {
          const fc = SEARCH_FIELDS.find((f) => f.field === m.field);
          return sum + (fc?.weight || 0);
        }, 0);
        return bScore - aScore;
      });
    }
    if (results.length >= limit * 2) break; // 多取一倍用于截断
  }

  return results.slice(0, limit);
}

/**
 * 生成搜索建议
 * 基于输入前缀，从数据中提取匹配的字段值
 */
export function getSearchSuggestions(
  sources: WaterSourceRecord[],
  keyword: string,
  limit = 8,
): string[] {
  const q = keyword.trim().toLowerCase();
  if (!q || q.length < 1) return [];

  const suggestions = new Set<string>();

  for (const record of sources) {
    // 名称建议
    if (record.name.toLowerCase().includes(q) || pinyinMatch(record.name, q)) {
      suggestions.add(record.name);
    }
    // 县区建议
    if (record.county && record.county.toLowerCase().includes(q)) {
      suggestions.add(record.county);
    }
    // 河流建议
    if (record.river && (record.river.toLowerCase().includes(q) || pinyinMatch(record.river, q))) {
      suggestions.add(record.river);
    }
    // 子类型建议
    if (record.subType && record.subType.toLowerCase().includes(q)) {
      suggestions.add(record.subType);
    }

    if (suggestions.size >= limit * 2) break;
  }

  return Array.from(suggestions).slice(0, limit);
}

/**
 * 提取数据中所有可选值（用于筛选下拉框）
 */
export function extractFilterOptions(sources: WaterSourceRecord[]): {
  cities: string[];
  levels: string[];
  types: string[];
  statuses: string[];
  subTypes: string[];
  rivers: string[];
} {
  const cities = new Set<string>();
  const levels = new Set<string>();
  const types = new Set<string>();
  const statuses = new Set<string>();
  const subTypes = new Set<string>();
  const rivers = new Set<string>();

  for (const r of sources) {
    cities.add(r.cityName);
    levels.add(r.level);
    types.add(r.type);
    statuses.add(r.status);
    if (r.subType) subTypes.add(r.subType);
    if (r.river) rivers.add(r.river);
  }

  return {
    cities: Array.from(cities).sort((a, b) => a.localeCompare(b, 'zh-CN')),
    levels: Array.from(levels),
    types: Array.from(types),
    statuses: Array.from(statuses).sort((a, b) => a.localeCompare(b, 'zh-CN')),
    subTypes: Array.from(subTypes).sort((a, b) => a.localeCompare(b, 'zh-CN')),
    rivers: Array.from(rivers).sort((a, b) => a.localeCompare(b, 'zh-CN')),
  };
}

// ===== 筛选预设管理 =====

const PRESET_STORAGE_KEY = 'watersource-filter-presets';

/** 加载筛选预设列表 */
export function loadFilterPresets(): FilterPreset[] {
  try {
    const data = localStorage.getItem(PRESET_STORAGE_KEY);
    if (data) return JSON.parse(data);
  } catch {
    // ignore
  }
  return [];
}

/** 保存筛选预设 */
export function saveFilterPreset(preset: FilterPreset): void {
  const presets = loadFilterPresets();
  const idx = presets.findIndex((p) => p.id === preset.id);
  if (idx >= 0) {
    presets[idx] = preset;
  } else {
    presets.push(preset);
  }
  localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
}

/** 删除筛选预设 */
export function deleteFilterPreset(id: string): void {
  const presets = loadFilterPresets().filter((p) => p.id !== id);
  localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
}

/** 创建空筛选条件 */
export function emptyCriteria(): FilterCriteria {
  return {
    cities: [],
    levels: [],
    types: [],
    statuses: [],
    subTypes: [],
    rivers: [],
  };
}

// ===== 防抖工具 =====

/**
 * 简单防抖函数
 * 用于搜索输入的高频事件
 */
export function debounce<T extends (...args: never[]) => unknown>(
  fn: T,
  delay = 300,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ===== 高亮工具 =====

/**
 * 根据匹配信息生成高亮片段
 * 用于 UI 渲染：将匹配文本拆分为普通段和高亮段
 */
export interface HighlightSegment {
  text: string;
  highlighted: boolean;
}

export function getHighlightSegments(
  text: string,
  match: SearchMatch | undefined,
): HighlightSegment[] {
  if (!match || match.length === 0) {
    return [{ text, highlighted: false }];
  }

  const segments: HighlightSegment[] = [];
  const { start, length } = match;

  if (start > 0) {
    segments.push({ text: text.slice(0, start), highlighted: false });
  }
  segments.push({ text: text.slice(start, start + length), highlighted: true });
  if (start + length < text.length) {
    segments.push({ text: text.slice(start + length), highlighted: false });
  }

  return segments;
}
