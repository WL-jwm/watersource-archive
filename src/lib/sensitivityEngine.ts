/**
 * P4-7: 参数敏感性分析引擎
 *
 * 功能：计算关键参数（K、S、T、M、I、n等）对保护区面积的影响曲线，
 * 输出每个参数的变化范围和对应的面积变化，用于生成敏感性分析图表。
 *
 * 原理：固定其他参数不变，在参数合理范围内均匀采样（默认20个点），
 * 分别计算保护区面积，观察面积对该参数的敏感程度。
 */

import type { CalcParams, ZoneResult } from './zoneCalcEngine';
import { calcProtectionZones } from './zoneCalcEngine';

// ===== 类型定义 =====

export interface SensitivityPoint {
  /** 参数值 */
  paramValue: number;
  /** 一级保护区面积 km² */
  area1: number;
  /** 二级保护区面积 km² */
  area2: number;
}

export interface SensitivityCurve {
  /** 参数名称 */
  paramName: string;
  /** 参数符号 */
  paramKey: string;
  /** 参数单位 */
  unit: string;
  /** 基准值（用户输入值） */
  baseValue: number;
  /** 采样范围 [min, max] */
  range: [number, number];
  /** 采样点数组 */
  points: SensitivityPoint[];
  /** 敏感度指标：面积变化率 / 参数变化率 */
  sensitivity: number;
  /** 敏感度等级：高/中/低 */
  sensitivityLevel: '高' | '中' | '低';
}

export interface SensitivityResult {
  /** 水源地名称 */
  sourceName: string;
  /** 计算方法 */
  method: '经验值法' | '解析法';
  /** 各参数的敏感性曲线 */
  curves: SensitivityCurve[];
}

// ===== 参数定义 =====

/** 地下水解析法可做敏感性分析的参数 */
const SENSITIVITY_PARAMS: Array<{
  key: keyof CalcParams;
  name: string;
  symbol: string;
  unit: string;
  /** 默认采样范围（相对于基准值的倍数） */
  rangeFactor: [number, number];
  /** 采样点数 */
  sampleCount: number;
  /** 适用方法 */
  method: '解析法' | '经验值法' | 'both';
  /** 适用类型 */
  types: string[];
}> = [
  {
    key: 'permeability',
    name: '渗透系数',
    symbol: 'K',
    unit: 'm/d',
    rangeFactor: [0.1, 10],
    sampleCount: 20,
    method: '解析法',
    types: ['孔隙水', '裂隙水'],
  },
  {
    key: 'aquiferThickness',
    name: '含水层厚度',
    symbol: 'M',
    unit: 'm',
    rangeFactor: [0.2, 5],
    sampleCount: 20,
    method: '解析法',
    types: ['孔隙水', '裂隙水'],
  },
  {
    key: 'storativity',
    name: '储水系数',
    symbol: 'S',
    unit: '无量纲',
    rangeFactor: [0.1, 10],
    sampleCount: 20,
    method: '解析法',
    types: ['孔隙水', '裂隙水'],
  },
  {
    key: 'hydraulicGradient',
    name: '水力坡度',
    symbol: 'I',
    unit: '无量纲',
    rangeFactor: [0.2, 5],
    sampleCount: 20,
    method: '解析法',
    types: ['孔隙水', '裂隙水'],
  },
  {
    key: 'effectivePorosity',
    name: '有效孔隙度',
    symbol: 'n',
    unit: '无量纲',
    rangeFactor: [0.5, 2],
    sampleCount: 20,
    method: '解析法',
    types: ['孔隙水', '裂隙水'],
  },
];

// ===== 核心算法 =====

/**
 * 生成参数采样值序列（对数均匀分布）
 * 对数分布更适合水文地质参数（跨越多个数量级）
 */
function logSpace(
  baseValue: number,
  minFactor: number,
  maxFactor: number,
  count: number,
): number[] {
  const logMin = Math.log10(baseValue * minFactor);
  const logMax = Math.log10(baseValue * maxFactor);
  const step = (logMax - logMin) / (count - 1);
  return Array.from({ length: count }, (_, i) => {
    const val = Math.pow(10, logMin + step * i);
    return Math.round(val * 1e6) / 1e6;
  });
}

/**
 * 计算单个参数的敏感性曲线
 */
function computeSingleParamCurve(
  params: CalcParams,
  paramDef: (typeof SENSITIVITY_PARAMS)[0],
  method: '经验值法' | '解析法',
): SensitivityCurve | null {
  const baseValue = params[paramDef.key] as number;
  if (!baseValue || baseValue <= 0) return null;

  // 检查是否适用
  if (!paramDef.types.includes(params.gwType || '')) return null;
  if (paramDef.method !== method && paramDef.method !== 'both') return null;

  const [minFactor, maxFactor] = paramDef.rangeFactor;
  const sampleValues = logSpace(baseValue, minFactor, maxFactor, paramDef.sampleCount);

  const points: SensitivityPoint[] = [];

  // 先计算基准面积
  const baseCalc = calcProtectionZones('_', params);
  const baseArea1 = baseCalc.zones.find((z) => z.level === '一级')?.area || 0;
  const baseArea2 = baseCalc.zones.find((z) => z.level === '二级')?.area || 0;

  for (const val of sampleValues) {
    const modifiedParams = { ...params, [paramDef.key]: val };
    const calc = calcProtectionZones('_', modifiedParams);
    const zones = calc.zones;

    points.push({
      paramValue: val,
      area1: zones.find((z) => z.level === '一级')?.area || 0,
      area2: zones.find((z) => z.level === '二级')?.area || 0,
    });
  }

  // 计算敏感度指标（基于二级保护区面积变化）
  const firstArea = points[0].area2;
  const lastArea = points[points.length - 1].area2;
  const areaChange = lastArea - firstArea;
  const paramChange = sampleValues[sampleValues.length - 1] - sampleValues[0];
  const sensitivity =
    baseArea2 > 0 ? Math.abs(areaChange / baseArea2) / Math.abs(paramChange / baseValue) : 0;

  const sensitivityLevel = sensitivity > 1 ? '高' : sensitivity > 0.3 ? '中' : '低';

  return {
    paramName: paramDef.name,
    paramKey: paramDef.symbol,
    unit: paramDef.unit,
    baseValue,
    range: [sampleValues[0], sampleValues[sampleValues.length - 1]],
    points,
    sensitivity: Math.round(sensitivity * 100) / 100,
    sensitivityLevel,
  };
}

/**
 * 执行完整的参数敏感性分析
 */
export function analyzeSensitivity(
  sourceName: string,
  params: CalcParams,
  method: '经验值法' | '解析法' = '解析法',
): SensitivityResult {
  // 仅支持地下水
  if (params.sourceType !== '地下水') {
    return { sourceName, method, curves: [] };
  }

  const curves: SensitivityCurve[] = [];

  for (const paramDef of SENSITIVITY_PARAMS) {
    const curve = computeSingleParamCurve(params, paramDef, method);
    if (curve) curves.push(curve);
  }

  // 按敏感度排序（高→低）
  curves.sort((a, b) => b.sensitivity - a.sensitivity);

  return { sourceName, method, curves };
}

/**
 * 格式化敏感性分析为文本描述（可用于报告）
 */
export function formatSensitivityText(result: SensitivityResult): string {
  if (result.curves.length === 0) {
    return '当前参数配置不支持敏感性分析（需为地下水型且填入水文地质参数）。';
  }

  const lines: string[] = [
    `参数敏感性分析（${result.method}）`,
    `水源地：${result.sourceName}`,
    '',
  ];

  for (const curve of result.curves) {
    const basePoint = curve.points.find((p) => p.paramValue === curve.baseValue);
    const baseArea = basePoint?.area2 || 0;
    const minPoint = curve.points[0];
    const maxPoint = curve.points[curve.points.length - 1];
    const maxArea = Math.max(minPoint.area2, maxPoint.area2);
    const minArea = Math.min(minPoint.area2, maxPoint.area2);
    const areaRange = maxArea - minArea;
    const pctChange = baseArea > 0 ? ((areaRange / baseArea) * 100).toFixed(1) : '0';

    lines.push(
      `【${curve.paramName}（${curve.paramKey}）】敏感度：${curve.sensitivityLevel}`,
      `  基准值：${curve.baseValue} ${curve.unit}`,
      `  采样范围：${curve.range[0]} ~ ${curve.range[1]} ${curve.unit}`,
      `  基准二级保护区面积：${baseArea.toFixed(4)} km²`,
      `  参数变化范围内面积波动：${minArea.toFixed(4)} ~ ${maxArea.toFixed(4)} km²（变化幅度${pctChange}%）`,
      '',
    );
  }

  return lines.join('\n');
}

/**
 * 生成敏感性分析图表数据（用于recharts）
 */
export function toChartData(curve: SensitivityCurve): Array<{
  paramValue: number;
  area1: number;
  area2: number;
  label: string;
}> {
  return curve.points.map((p) => ({
    paramValue: p.paramValue,
    area1: p.area1,
    area2: p.area2,
    label: `${curve.paramKey}=${p.paramValue}`,
  }));
}
