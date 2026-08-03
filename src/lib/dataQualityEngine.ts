/* ===== S11.3: 数据质量评分引擎 =====
 * 按 15 个字段加权评分（必填 60% + 选填 30% + 坐标 10%）
 * 支持单条评分 + 批量统计 + 分组分析
 */

import type { WaterSourceRecord } from '@/stores/waterSourceStore';

// ===== 类型定义 =====

export interface FieldScore {
  field: string;
  label: string;
  filled: boolean;
  weight: number;
  score: number; // 0 或 weight
}

export interface ScoreReport {
  /** 总分 0-100 */
  total: number;
  /** 各字段得分明细 */
  fields: FieldScore[];
  /** 缺失字段列表 */
  missingFields: string[];
  /** 评级 */
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface QualityStats {
  /** 总记录数 */
  total: number;
  /** 平均分 */
  average: number;
  /** 最高分 */
  max: number;
  /** 最低分 */
  min: number;
  /** 分数分布 */
  distribution: {
    range: string;
    count: number;
    percentage: number;
  }[];
  /** 低分 Top10 */
  lowScoreTop10: { id: string; name: string; cityName: string; score: number; missingFields: string[] }[];
  /** 按城市分组 */
  byCity: { cityName: string; count: number; average: number }[];
  /** 按级别分组 */
  byLevel: { level: string; count: number; average: number }[];
}

// ===== 字段权重配置 =====

/** 必填字段（权重 60%，每个 15%） */
const REQUIRED_FIELDS: { field: keyof WaterSourceRecord; label: string; weight: number }[] = [
  { field: 'name', label: '水源地名称', weight: 15 },
  { field: 'cityName', label: '城市', weight: 15 },
  { field: 'level', label: '级别', weight: 15 },
  { field: 'type', label: '水源类型', weight: 15 },
];

/** 选填字段（权重 30%，每个约 4.3%） */
const OPTIONAL_FIELDS: { field: keyof WaterSourceRecord; label: string; weight: number }[] = [
  { field: 'subType', label: '细分类型', weight: 5 },
  { field: 'county', label: '县区', weight: 5 },
  { field: 'status', label: '状态', weight: 5 },
  { field: 'population', label: '服务人口', weight: 5 },
  { field: 'river', label: '河流', weight: 5 },
  { field: 'remark', label: '备注', weight: 5 },
];

/** 坐标字段（权重 10%，每个 5%） */
const COORD_FIELDS: { field: keyof WaterSourceRecord; label: string; weight: number }[] = [
  { field: 'lng', label: '经度', weight: 5 },
  { field: 'lat', label: '纬度', weight: 5 },
];

/** 全部字段配置 */
const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS, ...COORD_FIELDS];

// ===== 评分函数 =====

/**
 * 判断字段是否有值
 */
function isFieldFilled(record: WaterSourceRecord, field: keyof WaterSourceRecord): boolean {
  const val = record[field];
  if (val === undefined || val === null) return false;
  if (typeof val === 'string' && val.trim() === '') return false;
  if (typeof val === 'number' && (isNaN(val) || val === 0)) return false;
  return true;
}

/**
 * 单条记录完整度评分
 */
export function scoreCompleteness(record: WaterSourceRecord): ScoreReport {
  const fields: FieldScore[] = [];
  const missingFields: string[] = [];
  let total = 0;

  for (const config of ALL_FIELDS) {
    const filled = isFieldFilled(record, config.field);
    const score = filled ? config.weight : 0;
    fields.push({
      field: config.field,
      label: config.label,
      filled,
      weight: config.weight,
      score,
    });
    total += score;
    if (!filled) {
      missingFields.push(config.label);
    }
  }

  // 确保总分在 0-100
  total = Math.min(100, Math.max(0, total));

  return {
    total,
    fields,
    missingFields,
    grade: getGrade(total),
  };
}

/**
 * 批量评分 + 统计
 */
export function scoreAll(sources: WaterSourceRecord[]): QualityStats {
  if (sources.length === 0) {
    return {
      total: 0,
      average: 0,
      max: 0,
      min: 0,
      distribution: [],
      lowScoreTop10: [],
      byCity: [],
      byLevel: [],
    };
  }

  const reports = sources.map((s) => ({ record: s, report: scoreCompleteness(s) }));
  const scores = reports.map((r) => r.report.total);

  const average = scores.reduce((a, b) => a + b, 0) / scores.length;
  const max = Math.max(...scores);
  const min = Math.min(...scores);

  // 分数分布
  const ranges = [
    { range: '90-100', min: 90, max: 100 },
    { range: '80-89', min: 80, max: 89 },
    { range: '70-79', min: 70, max: 79 },
    { range: '60-69', min: 60, max: 69 },
    { range: '0-59', min: 0, max: 59 },
  ];
  const distribution = ranges.map((r) => {
    const count = scores.filter((s) => s >= r.min && s <= r.max).length;
    return {
      range: r.range,
      count,
      percentage: Math.round((count / sources.length) * 100),
    };
  });

  // 低分 Top10
  const lowScoreTop10 = [...reports]
    .sort((a, b) => a.report.total - b.report.total)
    .slice(0, 10)
    .map((r) => ({
      id: r.record.id,
      name: r.record.name,
      cityName: r.record.cityName,
      score: r.report.total,
      missingFields: r.report.missingFields,
    }));

  // 按城市分组
  const cityMap = new Map<string, number[]>();
  for (const r of reports) {
    const city = r.record.cityName;
    if (!cityMap.has(city)) cityMap.set(city, []);
    cityMap.get(city)!.push(r.report.total);
  }
  const byCity = Array.from(cityMap.entries())
    .map(([cityName, cityScores]) => ({
      cityName,
      count: cityScores.length,
      average: Math.round(cityScores.reduce((a, b) => a + b, 0) / cityScores.length),
    }))
    .sort((a, b) => a.average - b.average);

  // 按级别分组
  const levelMap = new Map<string, number[]>();
  const levelLabels: Record<string, string> = { municipal: '市级', county: '县级', township: '乡镇级' };
  for (const r of reports) {
    const level = levelLabels[r.record.level] || r.record.level;
    if (!levelMap.has(level)) levelMap.set(level, []);
    levelMap.get(level)!.push(r.report.total);
  }
  const byLevel = Array.from(levelMap.entries())
    .map(([level, levelScores]) => ({
      level,
      count: levelScores.length,
      average: Math.round(levelScores.reduce((a, b) => a + b, 0) / levelScores.length),
    }))
    .sort((a, b) => a.average - b.average);

  return {
    total: sources.length,
    average: Math.round(average),
    max,
    min,
    distribution,
    lowScoreTop10,
    byCity,
    byLevel,
  };
}

/**
 * 根据分数获取评级
 */
function getGrade(score: number): ScoreReport['grade'] {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * 评级颜色
 */
export function getGradeColor(grade: ScoreReport['grade']): string {
  switch (grade) {
    case 'A': return 'text-green-600 bg-green-50';
    case 'B': return 'text-blue-600 bg-blue-50';
    case 'C': return 'text-amber-600 bg-amber-50';
    case 'D': return 'text-orange-600 bg-orange-50';
    case 'F': return 'text-red-600 bg-red-50';
  }
}

/**
 * 分数颜色
 */
export function getScoreColor(score: number): string {
  if (score >= 90) return 'text-green-600';
  if (score >= 80) return 'text-blue-600';
  if (score >= 70) return 'text-amber-600';
  if (score >= 60) return 'text-orange-600';
  return 'text-red-600';
}
