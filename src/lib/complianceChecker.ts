/**
 * B3: 保护区合规性检查引擎
 *
 * 依据：HJ 338-2018《饮用水水源保护区划分技术规范》
 *
 * 检查项：
 * 1. 面积合理性 — 同类型水源地面积偏离均值超过200%预警
 * 2. 半径合规性 — 一级保护区半径不小于规范下限值
 * 3. 拐点完整性 — 拐点数≥16，闭合误差<1m
 * 4. 坐标精度 — 经纬度小数点后6位
 * 5. 重叠检测 — 同区域多个水源地保护区是否重叠
 * 6. 编码合规 — 水源地编码符合环办函〔2012〕519号格式
 */

import type { ZoneCalcRecord } from '@/stores/waterSourceStore';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';
import type { ZoneResult } from './zoneCalcEngine';

// ===== 类型定义 =====

export type CheckSeverity = 'error' | 'warning' | 'info' | 'pass';

export interface CheckItem {
  /** 检查项编号 */
  id: string;
  /** 检查项名称 */
  name: string;
  /** 严重级别 */
  severity: CheckSeverity;
  /** 检查结果描述 */
  message: string;
  /** 规范依据 */
  standard: string;
  /** 整改建议 */
  suggestion?: string;
}

export interface ComplianceReport {
  /** 检查时间 */
  checkedAt: string;
  /** 检查的水源地数量 */
  totalCount: number;
  /** 通过数 */
  passCount: number;
  /** 警告数 */
  warningCount: number;
  /** 错误数 */
  errorCount: number;
  /** 信息数 */
  infoCount: number;
  /** 总体结论 */
  conclusion: '合格' | '基本合格' | '需整改';
  /** 逐个水源地的检查结果 */
  items: Array<{
    sourceId: string;
    sourceName: string;
    checks: CheckItem[];
  }>;
}

// ===== 规范常量 =====

/** 地下水一级保护区半径下限值（经验值法）m */
const GW_PRIMARY_RADIUS_MIN: Record<string, number> = {
  孔隙水: 30,
  裂隙水: 50,
  岩溶水: 100,
};

/** 地表水一级保护区半径下限值 m */
const SW_PRIMARY_RADIUS_MIN = {
  河流型: { upstream: 1000, downstream: 100 },
  湖库型: 300,
};

/** 拐点最少数量 */
const MIN_VERTEX_COUNT = 16;

/** 拐点闭合误差容许值 m */
const MAX_CLOSURE_ERROR = 1.0;

/** 坐标最少小数位数 */
const MIN_COORD_DECIMALS = 6;

/** 面积偏离倍数阈值 */
const AREA_DEVIATION_FACTOR = 2.0;

// ===== 辅助函数 =====

/** 计算两点间距离（米，Haversine） */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** 检查坐标精度 */
function checkCoordPrecision(lng: number, lat: number): boolean {
  const lngStr = lng.toString();
  const latStr = lat.toString();
  const lngDecimals = lngStr.includes('.') ? lngStr.split('.')[1].length : 0;
  const latDecimals = latStr.includes('.') ? latStr.split('.')[1].length : 0;
  return lngDecimals >= MIN_COORD_DECIMALS && latDecimals >= MIN_COORD_DECIMALS;
}

/** 计算圆形拐点闭合误差（首尾点距离） */
function calcClosureError(vertices: Array<{ lng: number; lat: number }>): number {
  if (vertices.length < 2) return 0;
  return haversineDistance(
    vertices[0].lat,
    vertices[0].lng,
    vertices[vertices.length - 1].lat,
    vertices[vertices.length - 1].lng,
  );
}

/** 检查编码格式 SD+行政区划(6位)+类型(1位)+级别(1位)+序号(3位) */
function checkCodeFormat(code: string): boolean {
  // 格式：SD130100111001 或 SD130100-1-1-001
  const cleanCode = code.replace(/[-\s]/g, '');
  return /^SD\d{6}[12][123]\d{3}$/.test(cleanCode);
}

// ===== 检查函数 =====

/** 1. 面积合理性检查 */
function checkAreaReasonability(records: ZoneCalcRecord[], record: ZoneCalcRecord): CheckItem {
  const sameType = records.filter(
    (r) =>
      r.params.sourceType === record.params.sourceType &&
      r.params.gwType === record.params.gwType &&
      r.params.swType === record.params.swType,
  );

  if (sameType.length < 2) {
    return {
      id: 'area',
      name: '面积合理性',
      severity: 'pass',
      message: '同类型水源地数量不足，无法进行面积偏离分析',
      standard: 'HJ 338-2018 附录A',
    };
  }

  const areas = sameType
    .map((r) => r.zones.find((z) => z.level === '一级')?.area || 0)
    .filter((a) => a > 0);
  if (areas.length === 0) {
    return {
      id: 'area',
      name: '面积合理性',
      severity: 'info',
      message: '无有效面积数据',
      standard: 'HJ 338-2018 附录A',
    };
  }

  const mean = areas.reduce((s, a) => s + a, 0) / areas.length;
  const myArea = record.zones.find((z) => z.level === '一级')?.area || 0;

  if (myArea === 0) {
    return {
      id: 'area',
      name: '面积合理性',
      severity: 'warning',
      message: '一级保护区面积为0，请检查计算参数',
      standard: 'HJ 338-2018 附录A',
      suggestion: '重新计算保护区，确保面积不为0',
    };
  }

  const deviation = myArea / mean;
  if (deviation > AREA_DEVIATION_FACTOR || deviation < 1 / AREA_DEVIATION_FACTOR) {
    return {
      id: 'area',
      name: '面积合理性',
      severity: 'warning',
      message: `一级保护区面积${myArea}km²，同类型均值${mean.toFixed(2)}km²，偏离${(deviation * 100).toFixed(0)}%`,
      standard: 'HJ 338-2018 附录A',
      suggestion: '面积偏离较大，请核实水文地质参数或检查水源地类型是否正确',
    };
  }

  return {
    id: 'area',
    name: '面积合理性',
    severity: 'pass',
    message: `一级保护区面积${myArea}km²，同类型均值${mean.toFixed(2)}km²，偏离${((deviation - 1) * 100).toFixed(0)}%`,
    standard: 'HJ 338-2018 附录A',
  };
}

/** 2. 半径合规性检查 */
function checkRadiusCompliance(record: ZoneCalcRecord): CheckItem {
  const z1 = record.zones.find((z) => z.level === '一级');
  if (!z1) {
    return {
      id: 'radius',
      name: '半径合规性',
      severity: 'error',
      message: '缺少一级保护区计算结果',
      standard: 'HJ 338-2018',
      suggestion: '补充一级保护区计算',
    };
  }

  if (record.params.sourceType === '地下水') {
    const gwType = record.params.gwType || '孔隙水';
    const minRadius = GW_PRIMARY_RADIUS_MIN[gwType] || 30;
    const actualRadius = z1.radius || 0;

    if (actualRadius < minRadius) {
      return {
        id: 'radius',
        name: '半径合规性',
        severity: 'error',
        message: `地下水${gwType}一级保护区半径${actualRadius}m < 规范下限${minRadius}m`,
        standard: 'HJ 338-2018 第6.1节',
        suggestion: `半径不应小于${minRadius}m，请检查水文地质参数或改用经验值法`,
      };
    }
    return {
      id: 'radius',
      name: '半径合规性',
      severity: 'pass',
      message: `地下水${gwType}一级保护区半径${actualRadius}m ≥ 规范下限${minRadius}m`,
      standard: 'HJ 338-2018 第6.1节',
    };
  }

  // 地表水
  if (record.params.swType === '河流型') {
    const upstream = z1.riverExt?.upstreamLength || z1.length || 0;
    const downstream = z1.riverExt?.downstreamLength || 0;
    const minUp = SW_PRIMARY_RADIUS_MIN.河流型.upstream;
    const minDown = SW_PRIMARY_RADIUS_MIN.河流型.downstream;

    if (upstream < minUp || downstream < minDown) {
      return {
        id: 'radius',
        name: '半径合规性',
        severity: 'error',
        message: `河流型一级保护区上游${upstream}m/下游${downstream}m，规范下限上游${minUp}m/下游${minDown}m`,
        standard: 'HJ 338-2018 第5.2.1节',
        suggestion: '上游长度不应小于1000m，下游不应小于100m',
      };
    }
    return {
      id: 'radius',
      name: '半径合规性',
      severity: 'pass',
      message: `河流型一级保护区上游${upstream}m/下游${downstream}m，符合规范下限`,
      standard: 'HJ 338-2018 第5.2.1节',
    };
  }

  // 湖库型
  if (record.params.swType === '湖库型') {
    const minRadius = SW_PRIMARY_RADIUS_MIN.湖库型;
    const actualRadius = z1.radius || 0;

    if (actualRadius < minRadius) {
      return {
        id: 'radius',
        name: '半径合规性',
        severity: 'error',
        message: `湖库型一级保护区半径${actualRadius}m < 规范下限${minRadius}m`,
        standard: 'HJ 338-2018 第5.3.1节',
        suggestion: '湖库型一级保护区半径不应小于300m',
      };
    }
    return {
      id: 'radius',
      name: '半径合规性',
      severity: 'pass',
      message: `湖库型一级保护区半径${actualRadius}m ≥ 规范下限${minRadius}m`,
      standard: 'HJ 338-2018 第5.3.1节',
    };
  }

  return {
    id: 'radius',
    name: '半径合规性',
    severity: 'pass',
    message: '半径合规',
    standard: 'HJ 338-2018',
  };
}

/** 3. 拐点完整性检查 */
function checkVertexIntegrity(
  record: ZoneCalcRecord,
  verticesData?: Array<{
    sourceId: string;
    zones: Array<{ level: string; vertices: Array<{ lng: number; lat: number }> }>;
  }>,
): CheckItem {
  // 如果没有拐点数据，跳过
  if (!verticesData) {
    return {
      id: 'vertex',
      name: '拐点完整性',
      severity: 'info',
      message: '未提供拐点数据，跳过检查',
      standard: 'HJ 338-2018 附录B',
    };
  }

  const sourceVertices = verticesData.find((v) => v.sourceId === record.sourceId);
  if (!sourceVertices) {
    return {
      id: 'vertex',
      name: '拐点完整性',
      severity: 'info',
      message: '未找到该水源地的拐点数据',
      standard: 'HJ 338-2018 附录B',
    };
  }

  const z1Vertices = sourceVertices.zones.find((z) => z.level === '一级')?.vertices;
  if (!z1Vertices || z1Vertices.length === 0) {
    return {
      id: 'vertex',
      name: '拐点完整性',
      severity: 'warning',
      message: '一级保护区无拐点数据',
      standard: 'HJ 338-2018 附录B',
      suggestion: '生成拐点坐标后再检查',
    };
  }

  const issues: string[] = [];

  // 拐点数量
  if (z1Vertices.length < MIN_VERTEX_COUNT) {
    issues.push(`拐点数${z1Vertices.length} < ${MIN_VERTEX_COUNT}`);
  }

  // 闭合误差
  const closureError = calcClosureError(z1Vertices);
  if (closureError > MAX_CLOSURE_ERROR) {
    issues.push(`闭合误差${closureError.toFixed(2)}m > ${MAX_CLOSURE_ERROR}m`);
  }

  if (issues.length > 0) {
    return {
      id: 'vertex',
      name: '拐点完整性',
      severity: 'error',
      message: issues.join('；'),
      standard: 'HJ 338-2018 附录B',
      suggestion: '增加拐点数量至16个以上，检查坐标计算精度',
    };
  }

  return {
    id: 'vertex',
    name: '拐点完整性',
    severity: 'pass',
    message: `拐点${z1Vertices.length}个，闭合误差${closureError.toFixed(3)}m`,
    standard: 'HJ 338-2018 附录B',
  };
}

/** 4. 坐标精度检查 */
function checkCoordinatePrecision(
  record: ZoneCalcRecord,
  source?: WaterSourceRecord,
  verticesData?: Array<{
    sourceId: string;
    zones: Array<{ level: string; vertices: Array<{ lng: number; lat: number }> }>;
  }>,
): CheckItem {
  const issues: string[] = [];

  // 检查水源地中心坐标
  if (source?.lng && source?.lat) {
    if (!checkCoordPrecision(source.lng, source.lat)) {
      issues.push('水源地中心坐标精度不足');
    }
  }

  // 检查拐点坐标
  if (verticesData) {
    const sv = verticesData.find((v) => v.sourceId === record.sourceId);
    if (sv) {
      const z1v = sv.zones.find((z) => z.level === '一级')?.vertices || [];
      const imprecise = z1v.filter((v) => !checkCoordPrecision(v.lng, v.lat));
      if (imprecise.length > 0) {
        issues.push(`${imprecise.length}个拐点坐标精度不足`);
      }
    }
  }

  if (issues.length > 0) {
    return {
      id: 'coord',
      name: '坐标精度',
      severity: 'warning',
      message: issues.join('；'),
      standard: 'GB/T 17798',
      suggestion: '坐标应保留小数点后6位（约0.1m精度）',
    };
  }

  return {
    id: 'coord',
    name: '坐标精度',
    severity: 'pass',
    message: '坐标精度符合要求（6位小数）',
    standard: 'GB/T 17798',
  };
}

/** 5. 重叠检测 */
function checkOverlap(
  record: ZoneCalcRecord,
  allRecords: ZoneCalcRecord[],
  sources: WaterSourceRecord[],
): CheckItem {
  const source = sources.find((s) => s.id === record.sourceId || s.name === record.sourceName);
  if (!source?.lng || !source?.lat) {
    return {
      id: 'overlap',
      name: '重叠检测',
      severity: 'info',
      message: '缺少坐标信息，跳过重叠检测',
      standard: 'HJ 338-2018 第4.3节',
    };
  }

  const z1 = record.zones.find((z) => z.level === '一级');
  const myRadius = z1?.radius || 0;
  if (myRadius === 0) {
    return {
      id: 'overlap',
      name: '重叠检测',
      severity: 'info',
      message: '保护区为非圆形（河流型/湖库型），跳过圆形重叠检测',
      standard: 'HJ 338-2018 第4.3节',
    };
  }

  const overlaps: string[] = [];
  for (const other of allRecords) {
    if (other.sourceId === record.sourceId || other.sourceName === record.sourceName) continue;

    const otherSource = sources.find((s) => s.id === other.sourceId || s.name === other.sourceName);
    if (!otherSource?.lng || !otherSource?.lat) continue;

    const otherZ1 = other.zones.find((z) => z.level === '一级');
    const otherRadius = otherZ1?.radius || 0;
    if (otherRadius === 0) continue;

    const dist = haversineDistance(source.lat, source.lng, otherSource.lat, otherSource.lng);
    if (dist < myRadius + otherRadius) {
      overlaps.push(`${other.sourceName}(间距${dist.toFixed(0)}m)`);
    }
  }

  if (overlaps.length > 0) {
    return {
      id: 'overlap',
      name: '重叠检测',
      severity: 'warning',
      message: `与${overlaps.length}个水源地一级保护区存在重叠：${overlaps.slice(0, 3).join('、')}${overlaps.length > 3 ? '等' : ''}`,
      standard: 'HJ 338-2018 第4.3节',
      suggestion: '重叠区域应协调划定边界，避免管理交叉',
    };
  }

  return {
    id: 'overlap',
    name: '重叠检测',
    severity: 'pass',
    message: '未发现与其他水源地一级保护区重叠',
    standard: 'HJ 338-2018 第4.3节',
  };
}

/** 6. 编码合规检查 */
function checkCodeCompliance(source?: WaterSourceRecord): CheckItem {
  if (!source) {
    return {
      id: 'code',
      name: '编码合规',
      severity: 'info',
      message: '缺少水源地信息',
      standard: '环办函〔2012〕519号',
    };
  }

  // 检查是否有编码（当前系统中用 id 作为标识，检查 id 格式）
  const code = source.id;
  // 系统中的 id 格式为 cityName_level_name，不是标准编码
  // 检查是否有 remark 字段包含编码
  const hasStandardCode = source.remark && checkCodeFormat(source.remark);

  if (hasStandardCode) {
    return {
      id: 'code',
      name: '编码合规',
      severity: 'pass',
      message: `编码${source.remark}符合环办函〔2012〕519号格式`,
      standard: '环办函〔2012〕519号',
    };
  }

  return {
    id: 'code',
    name: '编码合规',
    severity: 'warning',
    message: '未发现标准水源地编码（SD+行政区划码+类型+级别+序号）',
    standard: '环办函〔2012〕519号',
    suggestion: '建议按SD130100-1-1-001格式补编码',
  };
}

// ===== 主函数 =====

export interface ComplianceCheckOptions {
  /** 拐点数据（可选，来自 generateSourceZoneVertices） */
  verticesData?: Array<{
    sourceId: string;
    zones: Array<{ level: string; vertices: Array<{ lng: number; lat: number }> }>;
  }>;
}

/**
 * 执行合规性检查
 * @param records 保护区计算结果列表
 * @param sources 水源地记录列表
 * @param options 可选参数
 */
export function runComplianceCheck(
  records: ZoneCalcRecord[],
  sources: WaterSourceRecord[],
  options: ComplianceCheckOptions = {},
): ComplianceReport {
  const items = records.map((record) => {
    const source = sources.find((s) => s.id === record.sourceId || s.name === record.sourceName);

    const checks: CheckItem[] = [
      checkAreaReasonability(records, record),
      checkRadiusCompliance(record),
      checkVertexIntegrity(record, options.verticesData),
      checkCoordinatePrecision(record, source, options.verticesData),
      checkOverlap(record, records, sources),
      checkCodeCompliance(source),
    ];

    return {
      sourceId: record.sourceId,
      sourceName: record.sourceName,
      checks,
    };
  });

  // 统计
  let passCount = 0;
  let warningCount = 0;
  let errorCount = 0;
  let infoCount = 0;

  for (const item of items) {
    for (const check of item.checks) {
      switch (check.severity) {
        case 'pass':
          passCount++;
          break;
        case 'warning':
          warningCount++;
          break;
        case 'error':
          errorCount++;
          break;
        case 'info':
          infoCount++;
          break;
      }
    }
  }

  const conclusion: '合格' | '基本合格' | '需整改' =
    errorCount > 0 ? '需整改' : warningCount > items.length ? '基本合格' : '合格';

  return {
    checkedAt: new Date().toISOString(),
    totalCount: records.length,
    passCount,
    warningCount,
    errorCount,
    infoCount,
    conclusion,
    items,
  };
}
