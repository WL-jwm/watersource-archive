/**
 * A3: 水质趋势分析引擎
 *
 * 功能：
 * 1. 多期水质数据趋势分析（线性回归）
 * 2. 超标频次/超标率统计
 * 3. 水质等级变化检测（劣化预警）
 * 4. 趋势报告数据生成
 *
 * 依据：GB/T 14848-2017《地下水质量标准》
 */

// ===== 类型定义 =====

/** 单期水质监测数据 */
export interface WaterQualityPeriod {
  /** 监测日期 ISO */
  date: string;
  /** 监测期次标识（如"2024年枯水期"） */
  label: string;
  /** 各指标监测值 mg/L */
  indicators: Record<string, number>;
}

/** 水源地多期水质数据 */
export interface WaterQualityHistory {
  /** 水源地ID */
  sourceId: string;
  /** 水源地名称 */
  sourceName: string;
  /** 多期监测数据（按时间排序） */
  periods: WaterQualityPeriod[];
}

/** 单指标趋势分析结果 */
export interface IndicatorTrend {
  /** 指标名称 */
  indicator: string;
  /** 标准限值 mg/L（III类） */
  standardLimit: number;
  /** 各期监测值 */
  values: Array<{ date: string; label: string; value: number }>;
  /** 线性回归斜率 */
  slope: number;
  /** 线性回归截距 */
  intercept: number;
  /** R² 拟合优度 */
  rSquared: number;
  /** 趋势方向 */
  trend: '上升' | '下降' | '稳定';
  /** 超标次数 */
  exceedCount: number;
  /** 超标率 % */
  exceedRate: number;
  /** 最大值 */
  maxValue: number;
  /** 最小值 */
  minValue: number;
  /** 平均值 */
  meanValue: number;
  /** 是否持续超标 */
  isPersistentExceedance: boolean;
  /** 评价等级变化 */
  gradeChange: string;
}

/** 水质趋势分析报告 */
export interface WaterQualityTrendReport {
  /** 水源地名称 */
  sourceName: string;
  /** 监测期数 */
  periodCount: number;
  /** 监测时间范围 */
  dateRange: string;
  /** 各指标趋势分析 */
  indicators: IndicatorTrend[];
  /** 劣化指标列表 */
  degradedIndicators: string[];
  /** 持续超标指标列表 */
  persistentExceedanceIndicators: string[];
  /** 总体评价 */
  overallAssessment: string;
  /** 预警信息 */
  warnings: string[];
}

// ===== GB/T 14848-2017 地下水质量标准（III类） =====

export const GW_STANDARD_III: Record<string, number> = {
  pH: 6.5, // 特殊处理：6.5~8.5
  氨氮: 0.5,
  硝酸盐氮: 20,
  亚硝酸盐氮: 0.02,
  总硬度: 450,
  溶解性总固体: 1000,
  硫酸盐: 250,
  氯化物: 250,
  高锰酸盐指数: 3.0,
  氟化物: 1.0,
  铁: 0.3,
  锰: 0.1,
  铜: 1.0,
  锌: 1.0,
  挥发酚: 0.002,
  氰化物: 0.05,
  汞: 0.001,
  砷: 0.01,
  镉: 0.005,
  铬六价: 0.05,
  铅: 0.01,
  硒: 0.01,
  总大肠菌群: 3.0,
};

/** 水质等级判定 */
function getGrade(value: number, indicator: string): string {
  const limit = GW_STANDARD_III[indicator];
  if (!limit) return '未知';
  if (indicator === 'pH') {
    if (value >= 6.5 && value <= 8.5) return 'III类';
    if (value >= 5.5 && value <= 9.5) return 'IV类';
    return 'V类';
  }
  if (value <= limit) return 'III类及以上';
  if (value <= limit * 1.5) return 'IV类';
  return 'V类';
}

// ===== 线性回归 =====

function linearRegression(
  xs: number[],
  ys: number[],
): { slope: number; intercept: number; rSquared: number } {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] || 0, rSquared: 0 };

  const sumX = xs.reduce((s, x) => s + x, 0);
  const sumY = ys.reduce((s, y) => s + y, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);

  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-15) return { slope: 0, intercept: sumY / n, rSquared: 0 };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // R²
  const meanY = sumY / n;
  const ssTot = ys.reduce((s, y) => s + (y - meanY) ** 2, 0);
  const ssRes = ys.reduce((s, y, i) => s + (y - (slope * xs[i] + intercept)) ** 2, 0);
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { slope, intercept, rSquared };
}

// ===== 主函数 =====

/**
 * 水质趋势分析
 */
export function analyzeTrend(history: WaterQualityHistory): WaterQualityTrendReport {
  const { sourceName, periods } = history;

  if (periods.length < 2) {
    return {
      sourceName,
      periodCount: periods.length,
      dateRange: periods.length === 1 ? periods[0].label : '无数据',
      indicators: [],
      degradedIndicators: [],
      persistentExceedanceIndicators: [],
      overallAssessment: '监测期数不足（需≥2期），无法进行趋势分析',
      warnings: ['至少需要2期监测数据才能进行趋势分析'],
    };
  }

  // 收集所有指标名
  const allIndicators = new Set<string>();
  periods.forEach((p) => {
    Object.keys(p.indicators).forEach((k) => allIndicators.add(k));
  });

  // 时间序列（用索引作为X轴）
  const xs = periods.map((_, i) => i);

  const indicatorResults: IndicatorTrend[] = [];
  const degraded: string[] = [];
  const persistent: string[] = [];
  const warnings: string[] = [];

  for (const indicator of allIndicators) {
    const standardLimit = GW_STANDARD_III[indicator] || 0;

    // 收集该指标各期数据
    const dataPoints: Array<{ date: string; label: string; value: number }> = [];
    for (const p of periods) {
      if (p.indicators[indicator] != null) {
        dataPoints.push({
          date: p.date,
          label: p.label,
          value: p.indicators[indicator],
        });
      }
    }

    if (dataPoints.length < 2) continue;

    const ys = dataPoints.map((d) => d.value);
    const { slope, intercept, rSquared } = linearRegression(
      dataPoints.map((_, i) => i),
      ys,
    );

    // 趋势判定
    let trend: '上升' | '下降' | '稳定' = '稳定';
    if (slope > 0 && rSquared > 0.3) trend = '上升';
    else if (slope < 0 && rSquared > 0.3) trend = '下降';

    // 超标统计
    const exceedCount = standardLimit > 0 ? ys.filter((v) => v > standardLimit).length : 0;
    const exceedRate = Math.round((exceedCount / ys.length) * 100);

    // 持续超标：连续2期以上超标
    const isPersistentExceedance = exceedCount >= 2 && exceedRate >= 50;
    if (isPersistentExceedance) persistent.push(indicator);

    // 劣化检测：趋势上升且最新值超过标准
    const latestValue = ys[ys.length - 1];
    const firstValue = ys[0];
    if (trend === '上升' && standardLimit > 0 && latestValue > standardLimit) {
      degraded.push(indicator);
    }

    // 等级变化
    const firstGrade = getGrade(firstValue, indicator);
    const lastGrade = getGrade(latestValue, indicator);
    const gradeChange =
      firstGrade === lastGrade ? `${firstGrade}（无变化）` : `${firstGrade} → ${lastGrade}`;

    indicatorResults.push({
      indicator,
      standardLimit,
      values: dataPoints,
      slope: Math.round(slope * 10000) / 10000,
      intercept: Math.round(intercept * 10000) / 10000,
      rSquared: Math.round(rSquared * 1000) / 1000,
      trend,
      exceedCount,
      exceedRate,
      maxValue: Math.max(...ys),
      minValue: Math.min(...ys),
      meanValue: Math.round((ys.reduce((s, v) => s + v, 0) / ys.length) * 10000) / 10000,
      isPersistentExceedance,
      gradeChange,
    });
  }

  // 总体评价
  let overallAssessment: string;
  if (degraded.length === 0 && persistent.length === 0) {
    overallAssessment = '水质整体稳定，未发现劣化趋势或持续超标指标';
  } else if (degraded.length > 0) {
    overallAssessment = `发现${degraded.length}个指标呈劣化趋势：${degraded.join('、')}，建议加强监测并排查污染源`;
    warnings.push(`劣化预警：${degraded.join('、')}浓度呈上升趋势且已超标`);
  } else {
    overallAssessment = `${persistent.length}个指标持续超标：${persistent.join('、')}，建议排查污染源`;
    warnings.push(`持续超标：${persistent.join('、')}多期监测值超过III类标准`);
  }

  // 按超标率排序
  indicatorResults.sort((a, b) => b.exceedRate - a.exceedRate);

  return {
    sourceName,
    periodCount: periods.length,
    dateRange: `${periods[0].label} ~ ${periods[periods.length - 1].label}`,
    indicators: indicatorResults,
    degradedIndicators: degraded,
    persistentExceedanceIndicators: persistent,
    overallAssessment,
    warnings,
  };
}
