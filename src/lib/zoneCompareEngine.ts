/**
 * C2: 保护区方案对比引擎
 *
 * 功能：
 * 1. 两个计算方案的面积/半径/拐点对比表
 * 2. 面积变化计算（变化量/变化率）
 * 3. 自动生成调整原因说明
 */

import type { ZoneCalcRecord } from '@/stores/waterSourceStore';
import type { ZoneResult } from './zoneCalcEngine';

// ===== 类型定义 =====

export interface ZoneComparisonItem {
  /** 保护区级别 */
  level: '一级' | '二级' | '准保护区';
  /** 方案A面积 km² */
  areaA: number;
  /** 方案B面积 km² */
  areaB: number;
  /** 面积变化量 km² */
  areaChange: number;
  /** 面积变化率 % */
  areaChangeRate: number;
  /** 方案A半径 m */
  radiusA?: number;
  /** 方案B半径 m */
  radiusB?: number;
  /** 半径变化量 m */
  radiusChange?: number;
  /** 变化方向 */
  direction: '增大' | '减小' | '不变';
  /** 调整说明 */
  adjustmentText: string;
}

export interface ZoneComparisonResult {
  /** 水源地名称 */
  sourceName: string;
  /** 方案A计算时间 */
  schemeALabel: string;
  /** 方案B计算时间 */
  schemeBLabel: string;
  /** 方案A计算方法 */
  methodA: string;
  /** 方案B计算方法 */
  methodB: string;
  /** 逐级对比 */
  items: ZoneComparisonItem[];
  /** 参数变化对比 */
  paramChanges: Array<{
    param: string;
    valueA: string;
    valueB: string;
    changed: boolean;
  }>;
  /** 总体调整说明 */
  overallAdjustment: string;
  /** 是否有重大变化（面积变化>20%） */
  hasSignificantChange: boolean;
}

// ===== 辅助函数 =====

function getZone(zones: ZoneResult[], level: string): ZoneResult | undefined {
  return zones.find((z) => z.level === level);
}

function formatChangeRate(rate: number): string {
  const sign = rate > 0 ? '+' : '';
  return `${sign}${rate.toFixed(1)}%`;
}

// ===== 主函数 =====

/**
 * 对比两个保护区计算方案
 */
export function compareZoneSchemes(
  schemeA: ZoneCalcRecord,
  schemeB: ZoneCalcRecord,
  labelA?: string,
  labelB?: string,
): ZoneComparisonResult {
  const levels: Array<'一级' | '二级' | '准保护区'> = ['一级', '二级', '准保护区'];

  const items: ZoneComparisonItem[] = levels.map((level) => {
    const zA = getZone(schemeA.zones, level);
    const zB = getZone(schemeB.zones, level);

    const areaA = zA?.area || 0;
    const areaB = zB?.area || 0;
    const areaChange = Math.round((areaB - areaA) * 100) / 100;
    const areaChangeRate = areaA > 0 ? Math.round(((areaB - areaA) / areaA) * 1000) / 10 : 0;

    const radiusA = zA?.radius;
    const radiusB = zB?.radius;
    const radiusChange = radiusA != null && radiusB != null ? radiusB - radiusA : undefined;

    const direction: '增大' | '减小' | '不变' =
      areaChange > 0.01 ? '增大' : areaChange < -0.01 ? '减小' : '不变';

    // 调整说明
    let adjustmentText = '';
    if (direction === '不变') {
      adjustmentText = `${level}保护区面积无变化`;
    } else {
      const parts: string[] = [
        `${level}保护区面积${areaA}→${areaB}km²（${formatChangeRate(areaChangeRate)}）`,
      ];
      if (radiusChange != null && radiusChange !== 0) {
        parts.push(`半径${radiusA}→${radiusB}m（${radiusChange > 0 ? '+' : ''}${radiusChange}m）`);
      }
      adjustmentText = parts.join('，');
    }

    return {
      level,
      areaA,
      areaB,
      areaChange,
      areaChangeRate,
      radiusA,
      radiusB,
      radiusChange,
      direction,
      adjustmentText,
    };
  });

  // 参数变化对比
  const paramKeys = [
    { key: 'transmissivity', label: '导水系数T(m²/d)' },
    { key: 'storativity', label: '储水系数S' },
    { key: 'permeability', label: '渗透系数K(m/d)' },
    { key: 'aquiferThickness', label: '含水层厚度M(m)' },
    { key: 'hydraulicGradient', label: '水力坡度I' },
    { key: 'effectivePorosity', label: '有效孔隙度ne' },
    { key: 'riverFlow', label: '河流流量(m³/s)' },
    { key: 'riverWidth', label: '河宽(m)' },
    { key: 'lakeArea', label: '湖库面积(km²)' },
    { key: 'lakeCapacity', label: '总库容(亿m³)' },
  ];

  const paramChanges = paramKeys
    .map(({ key, label }) => {
      const valA = (schemeA.params as any)[key];
      const valB = (schemeB.params as any)[key];
      const strA = valA != null ? String(valA) : '—';
      const strB = valB != null ? String(valB) : '—';
      return {
        param: label,
        valueA: strA,
        valueB: strB,
        changed: strA !== strB,
      };
    })
    .filter((p) => p.changed);

  // 总体调整说明
  const changedLevels = items.filter((i) => i.direction !== '不变');
  const hasSignificantChange = items.some((i) => Math.abs(i.areaChangeRate) > 20);

  let overallAdjustment: string;
  if (changedLevels.length === 0) {
    overallAdjustment = '两方案计算结果一致，保护区面积无变化';
  } else {
    const increased = changedLevels.filter((i) => i.direction === '增大');
    const decreased = changedLevels.filter((i) => i.direction === '减小');
    const parts: string[] = [];
    if (increased.length > 0) {
      parts.push(`${increased.map((i) => i.level).join('、')}保护区面积增大`);
    }
    if (decreased.length > 0) {
      parts.push(`${decreased.map((i) => i.level).join('、')}保护区面积减小`);
    }
    if (paramChanges.length > 0) {
      parts.push(`参数变化：${paramChanges.map((p) => p.param).join('、')}`);
    }
    overallAdjustment = parts.join('；');
  }

  return {
    sourceName: schemeB.sourceName,
    schemeALabel: labelA || `方案A(${schemeA.calculatedAt.slice(0, 10)})`,
    schemeBLabel: labelB || `方案B(${schemeB.calculatedAt.slice(0, 10)})`,
    methodA: schemeA.zones[0]?.method || '未知',
    methodB: schemeB.zones[0]?.method || '未知',
    items,
    paramChanges,
    overallAdjustment,
    hasSignificantChange,
  };
}
