/**
 * H2: 环评结论自动判定引擎
 *
 * 基于保护区划分结果、合规性检查、敏感性分析等多维度数据
 * 自动生成环评结论和建议
 *
 * 判定逻辑依据：
 * - HJ 338-2018《饮用水水源保护区划分技术规范》
 * - HJ 2.3-2018《环境影响评价技术导则 地下水环境》
 * - HJ 169-2018《建设项目环境风险评价技术导则》
 */

import type { ZoneCalcRecord, WaterSourceRecord } from '@/stores/waterSourceStore';
import type { ComplianceReport, CheckItem } from './complianceChecker';
import type { SourceClipResult } from './zoneClipEngine';

// ===== 类型定义 =====

export type EAConclusion = '符合' | '基本符合' | '需调整' | '不符合';
export type EASeverity = 'critical' | 'major' | 'minor' | 'info';

export interface EACheckResult {
  /** 检查维度 */
  dimension: string;
  /** 检查项 */
  item: string;
  /** 严重程度 */
  severity: EASeverity;
  /** 判定结果 */
  result: '通过' | '警告' | '不通过';
  /** 详细说明 */
  detail: string;
  /** 建议措施 */
  suggestion?: string;
  /** 相关规范条文 */
  reference?: string;
}

export interface EAFinalConclusion {
  /** 总体结论 */
  conclusion: EAConclusion;
  /** 结论说明 */
  summary: string;
  /** 置信度 0-100 */
  confidence: number;
  /** 各维度检查结果 */
  checks: EACheckResult[];
  /** 关键问题清单 */
  keyIssues: string[];
  /** 建议措施清单 */
  recommendations: string[];
  /** 生成时间 */
  generatedAt: string;
}

// ===== 判定规则 =====

interface DimensionResult {
  dimension: string;
  passed: number;
  warnings: number;
  failed: number;
  checks: EACheckResult[];
}

/**
 * H2: 生成环评结论自动判定
 *
 * @param zoneResults 保护区划分结果
 * @param sources 水源地数据
 * @param compliance 合规性检查报告（可选）
 * @param clipResults 行政区划裁剪结果（可选）
 */
export function generateEAConclusion(
  zoneResults: ZoneCalcRecord[],
  sources: WaterSourceRecord[],
  compliance?: ComplianceReport | null,
  clipResults?: SourceClipResult[] | null,
): EAFinalConclusion {
  const allChecks: EACheckResult[] = [];
  const keyIssues: string[] = [];
  const recommendations: string[] = [];

  // 维度1：保护区完整性
  const zoneIntegrity = checkZoneIntegrity(zoneResults, sources);
  allChecks.push(...zoneIntegrity.checks);

  // 维度2：合规性检查
  if (compliance) {
    const complianceChecks = mapComplianceToEA(compliance);
    allChecks.push(...complianceChecks.checks);
  }

  // 维度3：行政区划完整性
  if (clipResults && clipResults.length > 0) {
    const clipChecks = checkAdministrativeIntegrity(clipResults);
    allChecks.push(...clipChecks.checks);
  }

  // 维度4：面积合理性
  const areaChecks = checkAreaReasonableness(zoneResults, sources);
  allChecks.push(...areaChecks.checks);

  // 维度5：数据完整性
  const dataChecks = checkDataCompleteness(zoneResults, sources);
  allChecks.push(...dataChecks.checks);

  // 收集关键问题和建议
  for (const check of allChecks) {
    if (check.severity === 'critical') {
      keyIssues.push(`[${check.dimension}] ${check.item}: ${check.detail}`);
    }
    if (check.suggestion) {
      recommendations.push(check.suggestion);
    }
  }

  // 综合判定
  const criticalCount = allChecks.filter((c) => c.severity === 'critical').length;
  const majorCount = allChecks.filter((c) => c.severity === 'major').length;
  const minorCount = allChecks.filter((c) => c.severity === 'minor').length;
  const passedCount = allChecks.filter((c) => c.result === '通过').length;

  let conclusion: EAConclusion;
  let summary: string;
  let confidence: number;

  if (criticalCount > 0) {
    conclusion = '不符合';
    summary = `存在${criticalCount}项严重问题，不满足环评技术要求，需重新调整保护区划分方案。`;
    confidence = 95;
  } else if (majorCount >= 3) {
    conclusion = '需调整';
    summary = `存在${majorCount}项主要问题，需对保护区划分方案进行调整完善后重新评估。`;
    confidence = 85;
  } else if (majorCount > 0 || minorCount >= 5) {
    conclusion = '基本符合';
    summary = `存在${majorCount}项主要问题和${minorCount}项次要问题，基本满足环评要求，建议针对性改进。`;
    confidence = 75;
  } else {
    conclusion = '符合';
    summary = `全部${allChecks.length}项检查通过${minorCount > 0 ? `（${minorCount}项次要提醒）` : ''}，满足环评技术要求。`;
    confidence = 90;
  }

  return {
    conclusion,
    summary,
    confidence,
    checks: allChecks,
    keyIssues,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}

// ===== 维度1：保护区完整性 =====

function checkZoneIntegrity(
  results: ZoneCalcRecord[],
  sources: WaterSourceRecord[],
): DimensionResult {
  const checks: EACheckResult[] = [];

  for (const r of results) {
    const source = sources.find((s) => s.id === r.sourceId || s.name === r.sourceName);
    if (!source) continue;

    const z1 = r.zones.find((z) => z.level === '一级');
    const z2 = r.zones.find((z) => z.level === '二级');

    // 检查一级保护区
    if (!z1) {
      checks.push({
        dimension: '保护区完整性',
        item: `${r.sourceName}一级保护区`,
        severity: 'critical',
        result: '不通过',
        detail: '缺少一级保护区划分结果',
        suggestion: `补充${r.sourceName}一级保护区划分`,
        reference: 'HJ 338-2018 第5.1节',
      });
    } else {
      // 检查一级保护区面积
      if (z1.area <= 0) {
        checks.push({
          dimension: '保护区完整性',
          item: `${r.sourceName}一级保护区面积`,
          severity: 'critical',
          result: '不通过',
          detail: '一级保护区面积为0或负值',
          reference: 'HJ 338-2018 第5.1节',
        });
      } else {
        checks.push({
          dimension: '保护区完整性',
          item: `${r.sourceName}一级保护区`,
          severity: 'info',
          result: '通过',
          detail: `一级保护区面积${z1.area.toFixed(3)}km²，方法：${z1.method}`,
        });
      }
    }

    // 检查二级保护区
    if (!z2) {
      checks.push({
        dimension: '保护区完整性',
        item: `${r.sourceName}二级保护区`,
        severity: 'major',
        result: '不通过',
        detail: '缺少二级保护区划分结果',
        suggestion: `补充${r.sourceName}二级保护区划分`,
        reference: 'HJ 338-2018 第5.2节',
      });
    } else if (z2.area <= 0) {
      checks.push({
        dimension: '保护区完整性',
        item: `${r.sourceName}二级保护区面积`,
        severity: 'critical',
        result: '不通过',
        detail: '二级保护区面积为0或负值',
        reference: 'HJ 338-2018 第5.2节',
      });
    }

    // 检查一级面积不大于二级面积
    if (z1 && z2 && z1.area > z2.area) {
      checks.push({
        dimension: '保护区完整性',
        item: `${r.sourceName}保护区面积逻辑`,
        severity: 'major',
        result: '不通过',
        detail: `一级保护区面积(${z1.area.toFixed(3)}km²)大于二级保护区面积(${z2.area.toFixed(3)}km²)`,
        suggestion: '检查计算参数，一级保护区应包含在二级保护区内',
        reference: 'HJ 338-2018 第5.1-5.2节',
      });
    }

    // 检查警告信息
    if (r.warnings && r.warnings.length > 0) {
      checks.push({
        dimension: '保护区完整性',
        item: `${r.sourceName}计算警告`,
        severity: 'minor',
        result: '警告',
        detail: r.warnings.join('；'),
        suggestion: '核查计算参数合理性',
      });
    }
  }

  return summarize('保护区完整性', checks);
}

// ===== 维度2：合规性检查映射 =====

function mapComplianceToEA(compliance: ComplianceReport): DimensionResult {
  const checks: EACheckResult[] = [];

  for (const item of compliance.items) {
    for (const c of item.checks) {
      const severity = mapSeverity(c.severity);
      checks.push({
        dimension: '合规性检查',
        item: `${item.sourceName}-${c.name}`,
        severity,
        result: c.severity === 'pass' ? '通过' : c.severity === 'info' ? '通过' : c.severity === 'warning' ? '警告' : '不通过',
        detail: c.message,
        suggestion: c.suggestion,
        reference: c.standard,
      });
    }
  }

  return summarize('合规性检查', checks);
}

function mapSeverity(s: string): EASeverity {
  switch (s) {
    case 'error': return 'critical';
    case 'warning': return 'major';
    case 'info': return 'minor';
    case 'pass': return 'info';
    default: return 'info';
  }
}

// ===== 维度3：行政区划完整性 =====

function checkAdministrativeIntegrity(clipResults: SourceClipResult[]): DimensionResult {
  const checks: EACheckResult[] = [];

  for (const r of clipResults) {
    for (const z of r.zones) {
      if (z.isClipped && z.clipRatio < 0.5) {
        checks.push({
          dimension: '行政区划完整性',
          item: `${z.sourceName}${z.level}保护区`,
          severity: 'major',
          result: '警告',
          detail: `裁剪后面积仅为原始面积的${(z.clipRatio * 100).toFixed(1)}%，可能存在跨区域管理问题`,
          suggestion: `协调${r.cityName}与相邻行政区，明确${z.level}保护区跨区域管理职责`,
          reference: 'HJ 338-2018 第7.3节',
        });
      } else if (z.isClipped) {
        checks.push({
          dimension: '行政区划完整性',
          item: `${z.sourceName}${z.level}保护区`,
          severity: 'minor',
          result: '警告',
          detail: `保护区跨行政区，裁剪比例${(z.clipRatio * 100).toFixed(1)}%`,
        });
      }
    }
  }

  return summarize('行政区划完整性', checks);
}

// ===== 维度4：面积合理性 =====

function checkAreaReasonableness(
  results: ZoneCalcRecord[],
  sources: WaterSourceRecord[],
): DimensionResult {
  const checks: EACheckResult[] = [];

  for (const r of results) {
    const source = sources.find((s) => s.id === r.sourceId || s.name === r.sourceName);
    if (!source) continue;

    const z1 = r.zones.find((z) => z.level === '一级');
    const z2 = r.zones.find((z) => z.level === '二级');

    // 地表水湖库型：一级面积通常 0.01-1 km²
    if (source.type === '地表水' && source.subType === '湖库型') {
      if (z1 && z1.area > 5) {
        checks.push({
          dimension: '面积合理性',
          item: `${r.sourceName}一级保护区面积`,
          severity: 'major',
          result: '警告',
          detail: `湖库型一级保护区面积${z1.area.toFixed(3)}km²偏大（通常<5km²）`,
          suggestion: '核查取水口位置和划分参数',
          reference: 'HJ 338-2018 表2',
        });
      }
    }

    // 地下水：一级面积通常 0.005-0.5 km²
    if (source.type === '地下水') {
      if (z1 && z1.area > 2) {
        checks.push({
          dimension: '面积合理性',
          item: `${r.sourceName}一级保护区面积`,
          severity: 'major',
          result: '警告',
          detail: `地下水一级保护区面积${z1.area.toFixed(3)}km²偏大（通常<2km²）`,
          suggestion: '核查水文地质参数和影响半径计算',
          reference: 'HJ 338-2018 表1',
        });
      }
    }

    // 二级面积合理性
    if (z2 && z2.area > 50) {
      checks.push({
        dimension: '面积合理性',
        item: `${r.sourceName}二级保护区面积`,
        severity: 'minor',
        result: '警告',
        detail: `二级保护区面积${z2.area.toFixed(3)}km²较大，需确认范围合理性`,
        suggestion: '检查迁移时间参数和含水层参数',
        reference: 'HJ 338-2018 第5.2节',
      });
    }

    // 人口与面积匹配性
    if (source.population && source.population > 0 && z1) {
      const perCapitaArea = (z1.area * 1e6) / source.population; // m²/人
      if (perCapitaArea > 100) {
        checks.push({
          dimension: '面积合理性',
          item: `${r.sourceName}人均一级保护区面积`,
          severity: 'minor',
          result: '警告',
          detail: `人均一级保护区面积${perCapitaArea.toFixed(1)}m²/人偏高`,
          suggestion: '核实服务人口数据和保护区范围',
        });
      }
    }
  }

  return summarize('面积合理性', checks);
}

// ===== 维度5：数据完整性 =====

function checkDataCompleteness(
  results: ZoneCalcRecord[],
  sources: WaterSourceRecord[],
): DimensionResult {
  const checks: EACheckResult[] = [];

  // 检查水源地数据完整性
  for (const s of sources) {
    if (!s.lng || !s.lat || s.lng === 0 || s.lat === 0) {
      checks.push({
        dimension: '数据完整性',
        item: `${s.name}坐标数据`,
        severity: 'major',
        result: '不通过',
        detail: '缺少有效经纬度坐标',
        suggestion: '补充水源地准确坐标信息',
      });
    }
    if (!s.population || s.population === 0) {
      checks.push({
        dimension: '数据完整性',
        item: `${s.name}服务人口`,
        severity: 'minor',
        result: '警告',
        detail: '缺少服务人口数据',
        suggestion: '补充服务人口信息以便面积合理性评估',
      });
    }
  }

  // 检查计算结果完整性
  for (const r of results) {
    if (!r.calculatedAt) {
      checks.push({
        dimension: '数据完整性',
        item: `${r.sourceName}计算时间`,
        severity: 'minor',
        result: '警告',
        detail: '缺少计算时间戳',
      });
    }
    if (!r.params || Object.keys(r.params).length === 0) {
      checks.push({
        dimension: '数据完整性',
        item: `${r.sourceName}计算参数`,
        severity: 'major',
        result: '不通过',
        detail: '缺少计算参数记录',
        suggestion: '补充计算参数以便结果可追溯',
      });
    }
  }

  // 检查覆盖率
  const sourceIds = new Set(sources.map((s) => s.id));
  const resultSourceIds = new Set(results.map((r) => r.sourceId));
  const missing = sources.filter((s) => !resultSourceIds.has(s.id) && !results.some((r) => r.sourceName === s.name));
  if (missing.length > 0) {
    checks.push({
      dimension: '数据完整性',
      item: '计算结果覆盖率',
      severity: 'minor',
      result: '警告',
      detail: `${missing.length}个水源地缺少保护区划分结果：${missing.slice(0, 5).map((s) => s.name).join('、')}${missing.length > 5 ? '等' : ''}`,
      suggestion: '完成全部水源地的保护区划分计算',
    });
  }

  return summarize('数据完整性', checks);
}

// ===== 辅助函数 =====

function summarize(dimension: string, checks: EACheckResult[]): DimensionResult {
  return {
    dimension,
    passed: checks.filter((c) => c.result === '通过').length,
    warnings: checks.filter((c) => c.result === '警告').length,
    failed: checks.filter((c) => c.result === '不通过').length,
    checks,
  };
}

/**
 * 生成结论摘要文本（可用于报告）
 */
export function formatConclusionText(conclusion: EAFinalConclusion): string {
  const lines: string[] = [];

  lines.push(`一、总体结论：${conclusion.conclusion}`);
  lines.push('');
  lines.push(conclusion.summary);
  lines.push(`（置信度：${conclusion.confidence}%）`);
  lines.push('');

  // 按维度汇总
  const dimensions = new Map<string, { passed: number; warnings: number; failed: number }>();
  for (const c of conclusion.checks) {
    if (!dimensions.has(c.dimension)) {
      dimensions.set(c.dimension, { passed: 0, warnings: 0, failed: 0 });
    }
    const d = dimensions.get(c.dimension)!;
    if (c.result === '通过') d.passed++;
    else if (c.result === '警告') d.warnings++;
    else d.failed++;
  }

  lines.push('二、各维度检查结果：');
  for (const [dim, stats] of dimensions) {
    lines.push(`  ${dim}：通过${stats.passed}项，警告${stats.warnings}项，不通过${stats.failed}项`);
  }

  if (conclusion.keyIssues.length > 0) {
    lines.push('');
    lines.push('三、关键问题：');
    conclusion.keyIssues.forEach((issue, i) => {
      lines.push(`  ${i + 1}. ${issue}`);
    });
  }

  if (conclusion.recommendations.length > 0) {
    lines.push('');
    lines.push('四、建议措施：');
    const unique = Array.from(new Set(conclusion.recommendations));
    unique.forEach((rec, i) => {
      lines.push(`  ${i + 1}. ${rec}`);
    });
  }

  return lines.join('\n');
}
