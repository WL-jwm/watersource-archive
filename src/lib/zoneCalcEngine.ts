/**
 * 水源地保护区划分计算引擎
 *
 * 依据：HJ 338-2018《饮用水水源保护区划分技术规范》
 *
 * 功能：
 * 1. 地下水型：经验值法 + 解析法(Theis/Cooper-Jacob)
 * 2. 地表水型：经验值法(河流型/湖库型)
 * 3. 批量计算
 *
 * 核心公式：
 * - 解析法一级保护区：基于Cooper-Jacob公式，计算污染物随地下水流运移60天到达的距离
 *   r = sqrt(2.25 * T * t / (S * 365.25))
 *   其中T=导水系数(m²/d), S=储水系数, t=运移时间(d)
 * - 解析法二级保护区：t=25年(9131.25天)
 */

// ===== 计算参数 =====
export interface CalcParams {
  /** 水源类型：地下水/地表水 */
  sourceType: '地下水' | '地表水';
  /** 地下水类型：孔隙水/裂隙水/岩溶水 */
  gwType?: '孔隙水' | '裂隙水' | '岩溶水';
  /** 地表水类型：河流型/湖库型 */
  swType?: '河流型' | '湖库型';
  /** 湖库型：大/中/小型 */
  reservoirSize?: '大型' | '中型' | '小型';

  // ---- 水文地质参数（解析法需要）----
  /** 含水层厚度 m */
  aquiferThickness?: number;
  /** 渗透系数 m/d */
  permeability?: number;
  /** 导水系数 T = K * M m²/d */
  transmissivity?: number;
  /** 储水系数/给水度（无量纲） */
  storativity?: number;
  /** 水力坡度（无量纲） */
  hydraulicGradient?: number;
  /** 有效孔隙度（无量纲，用于实际流速计算） */
  effectivePorosity?: number;

  // ---- 地表水参数（河流型）----
  /** 河流多年平均流量 m³/s */
  riverFlow?: number;
  /** 河道平均宽度 m */
  riverWidth?: number;
  /** 河道平均水深 m */
  riverDepth?: number;
  /** 河床纵比降 ‰ */
  riverSlope?: number;
  /** 是否受潮汐影响 */
  isTidal?: boolean;
  /** 潮汐上溯距离 m（潮汐河段时启用） */
  tidalUpstreamDistance?: number;
  /** 是否有支流汇入（取水口上游1000m内） */
  hasTributary?: boolean;

  // ---- 地表水参数（湖库型）----
  /** 湖库水面面积 km² */
  lakeArea?: number;
  /** 总库容 亿 m³ */
  lakeCapacity?: number;
  /** 最大水深 m */
  maxDepth?: number;
  /** 平均水深 m */
  meanDepth?: number;
  /** 取水口类型 */
  intakeType?: '岸边' | '湖心' | '分层取水';
  /** 取水层深度 m（分层取水时启用） */
  intakeDepth?: number;

  // ---- 通用参数 ----
  /** 水源地取水量 m³/d */
  dailyYield?: number;
}

// ===== 保护区计算结果 =====
export interface ZoneResult {
  /** 保护区级别 */
  level: '一级' | '二级' | '准保护区';
  /** 计算方法 */
  method: '经验值法' | '解析法';
  /** 计算公式描述 */
  formula: string;
  /** 半径/距离 m（经验值法）*/
  radius?: number;
  /** 长度 m（河流型一级）*/
  length?: number;
  /** 宽度 m（河流型一级）*/
  width?: number;
  /** 面积 km² */
  area: number;
  /** 边界描述 */
  boundaryDescription: string;
  /** 主要参数 */
  keyParams: string;
  /** 规范依据 */
  standard: string;
  /** 河流型保护区扩展信息 */
  riverExt?: RiverZoneExtension;
  /** 湖库型保护区扩展信息 */
  lakeExt?: LakeZoneExtension;
}

/** 河流型保护区扩展信息 */
export interface RiverZoneExtension {
  /** 上游总长度（从取水口起算）m */
  upstreamLength: number;
  /** 下游总长度（从取水口起算）m */
  downstreamLength: number;
  /** 两岸单侧纵深 m */
  bankWidth: number;
  /** 坡度修正信息 */
  slopeAdjustment?: string;
  /** 潮汐修正信息 */
  tidalAdjustment?: string;
}

/** 湖库型保护区扩展信息 */
export interface LakeZoneExtension {
  /** 取水口类型 */
  intakeType: '岸边' | '湖心' | '分层取水';
  /** 水域面积 km² */
  waterArea: number;
  /** 陆域面积 km² */
  landArea: number;
  /** 取水层深度 m（分层取水时） */
  intakeDepth?: number;
}

export interface CalcResult {
  /** 水源地名称 */
  sourceName: string;
  /** 参数 */
  params: CalcParams;
  /** 保护区列表 */
  zones: ZoneResult[];
  /** 计算时间 */
  calculatedAt: string;
  /** 警告信息 */
  warnings: string[];
}

// ===== 经验值法常数表 =====

/** 地下水一级保护区半径经验值 (m) — HJ 338-2018 表2 */
const GW_PRIMARY_RADIUS: Record<string, { min: number; max: number; typical: number }> = {
  孔隙水: { min: 50, max: 300, typical: 100 },
  裂隙水: { min: 100, max: 500, typical: 200 },
  岩溶水: { min: 100, max: 1000, typical: 300 },
};

/** 地下水二级保护区半径经验值 (m) — 参考典型值 */
const GW_SECONDARY_RADIUS: Record<string, { min: number; max: number; typical: number }> = {
  孔隙水: { min: 500, max: 2000, typical: 1000 },
  裂隙水: { min: 500, max: 3000, typical: 1500 },
  岩溶水: { min: 500, max: 5000, typical: 2000 },
};

/** 地下水准保护区扩展系数 — HJ 338-2018 第6.3节
 * 准保护区为二级保护区外至汇水区边界/分水岭的区域
 * 当无法确定汇水区范围时，可按二级保护区外扩一定比例估算 */
const GW_QUASI_FACTOR: Record<
  string,
  { minFactor: number; maxFactor: number; typicalFactor: number; description: string }
> = {
  孔隙水: {
    minFactor: 1.5,
    maxFactor: 3.0,
    typicalFactor: 2.0,
    description: '二级保护区外侧至含水层补给区边界，通常为二级半径的1.5~3倍',
  },
  裂隙水: {
    minFactor: 2.0,
    maxFactor: 4.0,
    typicalFactor: 2.5,
    description: '二级保护区外侧至分水岭/补给径排区边界，通常为二级半径的2~4倍',
  },
  岩溶水: {
    minFactor: 2.0,
    maxFactor: 5.0,
    typicalFactor: 3.0,
    description: '二级保护区外侧至岩溶补给区边界，岩溶含水层补给范围大，通常为二级半径的2~5倍',
  },
};

/** 河流型保护区经验值 — HJ 338-2018 第5.2节
 *  一级保护区：
 *    大型：上游≥5000m，下游≥300m，两岸纵深≥50m（坡度>15°时增至100m）
 *    中型：上游≥3000m，下游≥200m，两岸纵深≥50m
 *    小型：上游≥1000m，下游≥100m，两岸纵深≥50m
 *  二级保护区（从一级边界起独立延伸）：
 *    大型：上游延伸≥10000m，下游≥500m，两岸纵深≥1000m
 *    中型：上游延伸≥5000m，下游≥300m，两岸纵深≥500m
 *    小型：上游延伸≥2000m，下游≥200m，两岸纵深≥200m
 */
const RIVER_PRIMARY: Record<
  string,
  { upstream: number; downstream: number; bankWidth: number; bankWidthSteep: number }
> = {
  大型: { upstream: 5000, downstream: 300, bankWidth: 50, bankWidthSteep: 100 },
  中型: { upstream: 3000, downstream: 200, bankWidth: 50, bankWidthSteep: 100 },
  小型: { upstream: 1000, downstream: 100, bankWidth: 50, bankWidthSteep: 100 },
};

const RIVER_SECONDARY: Record<
  string,
  { upstreamExt: number; downstreamExt: number; bankWidth: number }
> = {
  大型: { upstreamExt: 10000, downstreamExt: 500, bankWidth: 1000 },
  中型: { upstreamExt: 5000, downstreamExt: 300, bankWidth: 500 },
  小型: { upstreamExt: 2000, downstreamExt: 200, bankWidth: 200 },
};

/** 河流型准保护区扩展系数（二级保护区外侧至汇水区边界） */
const RIVER_QUASI_FACTOR: Record<string, { upstreamFactor: number; bankFactor: number }> = {
  大型: { upstreamFactor: 2.0, bankFactor: 1.5 },
  中型: { upstreamFactor: 2.0, bankFactor: 1.5 },
  小型: { upstreamFactor: 2.0, bankFactor: 1.5 },
};

/** 湖库型一级保护区 — HJ 338-2018 第5.3节
 *  小型：取水口半径300m范围水域，陆域外延50m
 *  中型：取水口半径500m范围水域，陆域外延50m
 *  大型：取水口半径1000m范围水域，陆域外延50m
 */
const LAKE_PRIMARY: Record<string, { radiusM: number; landExtM: number; description: string }> = {
  小型: {
    radiusM: 300,
    landExtM: 50,
    description: '取水口半径300m范围内的水域，陆域为水域外延50m',
  },
  中型: {
    radiusM: 500,
    landExtM: 50,
    description: '取水口半径500m范围内的水域，陆域为水域外延50m',
  },
  大型: {
    radiusM: 1000,
    landExtM: 50,
    description: '取水口半径1000m范围内的水域，陆域为水域外延50m',
  },
};

/** 湖库型二级保护区 — HJ 338-2018 第5.3.2节
 *  小型：整个水域 + 陆域外延不小于1000m
 *  中型：一级外不小于1000m水域 + 陆域外延不小于1000m
 *  大型：一级外不小于2000m水域 + 陆域外延不小于2000m
 */
const LAKE_SECONDARY: Record<string, { waterExtM: number; landExtM: number; wholeWater: boolean }> =
  {
    小型: { waterExtM: 0, landExtM: 1000, wholeWater: true },
    中型: { waterExtM: 1000, landExtM: 1000, wholeWater: false },
    大型: { waterExtM: 2000, landExtM: 2000, wholeWater: false },
  };

// ===== 经验值法 =====

/** 地下水经验值法 */
function calcGWEmpirical(params: CalcParams): ZoneResult[] {
  const zones: ZoneResult[] = [];
  const gwType = params.gwType || '孔隙水';
  const warnings: string[] = [];

  // 一级保护区
  const primary = GW_PRIMARY_RADIUS[gwType] || GW_PRIMARY_RADIUS['孔隙水'];
  const primaryR = primary.typical;
  const primaryArea = (Math.PI * primaryR * primaryR) / 1e6; // km²

  zones.push({
    level: '一级',
    method: '经验值法',
    formula: `一级保护区半径取经验值 R=${primaryR}m（${gwType}经验范围${primary.min}~${primary.max}m）`,
    radius: primaryR,
    area: Math.round(primaryArea * 100) / 100,
    boundaryDescription: `以各水源井为中心，半径${primaryR}m的圆形区域。多个水源井时，以最外侧井的外包线外推${primaryR}m划定。`,
    keyParams: `地下水类型=${gwType}, 经验半径=${primaryR}m`,
    standard: 'HJ 338-2018 表2',
  });

  // 二级保护区
  const secondary = GW_SECONDARY_RADIUS[gwType] || GW_SECONDARY_RADIUS['孔隙水'];
  const secondaryR = secondary.typical;
  const secondaryArea = (Math.PI * secondaryR * secondaryR) / 1e6;

  zones.push({
    level: '二级',
    method: '经验值法',
    formula: `二级保护区半径取经验值 R=${secondaryR}m（${gwType}经验范围${secondary.min}~${secondary.max}m）`,
    radius: secondaryR,
    area: Math.round(secondaryArea * 100) / 100,
    boundaryDescription: `以各水源井为中心，半径${secondaryR}m的圆形区域。实际划定时应结合水文地质条件、地下水动力学特征调整。`,
    keyParams: `地下水类型=${gwType}, 经验半径=${secondaryR}m`,
    standard: 'HJ 338-2018 参考值',
  });

  // P3-2: 准保护区
  const quasi = GW_QUASI_FACTOR[gwType] || GW_QUASI_FACTOR['孔隙水'];
  const quasiR = Math.round(secondaryR * quasi.typicalFactor);
  const quasiArea = (Math.PI * quasiR * quasiR) / 1e6 - secondaryArea; // 扣除二级保护区面积（环形）

  zones.push({
    level: '准保护区',
    method: '经验值法',
    formula: `准保护区半径 = 二级半径 × ${quasi.typicalFactor} = ${secondaryR} × ${quasi.typicalFactor} = ${quasiR}m（${gwType}扩展系数${quasi.minFactor}~${quasi.maxFactor}）`,
    radius: quasiR,
    area: Math.round(quasiArea * 100) / 100,
    boundaryDescription: `以水源井为中心，半径${quasiR}m（二级保护区外侧）至汇水区边界/分水岭的区域。${quasi.description}。实际划定应以水文地质勘查确定的汇水区范围为准。`,
    keyParams: `扩展系数=${quasi.typicalFactor}, 二级半径=${secondaryR}m, 准保护区半径=${quasiR}m`,
    standard: 'HJ 338-2018 第6.3节',
  });

  return zones;
}

/** 河流型规模分级参数 */
interface RiverScaleParams {
  meanFlow: number;
  riverWidth: number;
  riverDepth?: number;
}

type RiverScale = '大型' | '中型' | '小型';

/** 河流型规模判断 — HJ 338-2018 第5.2节 + 河北省河流特征 */
function classifyRiverScale(params: RiverScaleParams): { scale: RiverScale; basis: string } {
  const { meanFlow, riverWidth, riverDepth } = params;

  // 分级标准：多年平均流量 + 河道宽度 + 水深综合判断
  const flowScore = meanFlow >= 150 ? 3 : meanFlow >= 15 ? 2 : 1;
  const widthScore = riverWidth >= 200 ? 3 : riverWidth >= 50 ? 2 : 1;
  const depthScore = riverDepth ? (riverDepth >= 5 ? 3 : riverDepth >= 2 ? 2 : 1) : 0;

  // 取最高分（保守原则）
  const maxScore = Math.max(flowScore, widthScore, depthScore || 0);
  const scale: RiverScale = maxScore >= 3 ? '大型' : maxScore === 2 ? '中型' : '小型';

  const indicators: string[] = [
    `流量${meanFlow}m³/s(${flowScore >= 3 ? '大' : flowScore === 2 ? '中' : '小'})`,
    `河宽${riverWidth}m(${widthScore >= 3 ? '大' : widthScore === 2 ? '中' : '小'})`,
  ];
  if (riverDepth)
    indicators.push(
      `水深${riverDepth}m(${depthScore >= 3 ? '大' : depthScore === 2 ? '中' : '小'})`,
    );

  return { scale, basis: indicators.join('，') + ` → ${scale}` };
}

/** 地表水经验值法（河流型）— HJ 338-2018 第5.2节 */
function calcRiverEmpirical(params: CalcParams): ZoneResult[] {
  const zones: ZoneResult[] = [];
  const flow = params.riverFlow || 0;
  const width = params.riverWidth || 0;
  const depth = params.riverDepth || 0;
  const slope = params.riverSlope || 0;
  const isTidal = params.isTidal || false;
  const tidalDist = params.tidalUpstreamDistance || 0;

  // 规模判断
  const { scale, basis } = classifyRiverScale({
    meanFlow: flow,
    riverWidth: width,
    riverDepth: depth || undefined,
  });

  const primary = RIVER_PRIMARY[scale] || RIVER_PRIMARY['中型'];
  const secondary = RIVER_SECONDARY[scale] || RIVER_SECONDARY['中型'];
  const quasiF = RIVER_QUASI_FACTOR[scale] || RIVER_QUASI_FACTOR['中型'];

  // 两岸纵深坡度修正：坡度>15‰时增加纵深
  let bankWidth = primary.bankWidth;
  let slopeAdj: string | undefined;
  if (slope > 15) {
    const adj = Math.round((slope - 15) * 2);
    bankWidth = primary.bankWidthSteep;
    slopeAdj = `坡度${slope}‰>15‰，两岸纵深从${primary.bankWidth}m增至${bankWidth}m`;
  }

  // 潮汐修正：下游距离取规范值与潮汐上溯距离的较大值
  let downstream = primary.downstream;
  let tidalAdj: string | undefined;
  if (isTidal && tidalDist > 0) {
    const origDownstream = downstream;
    downstream = Math.max(downstream, tidalDist);
    tidalAdj = `潮汐河段，下游距离从${origDownstream}m修正为${downstream}m（潮汐上溯${tidalDist}m）`;
  }

  // ===== 一级保护区 =====
  const pUpstream = primary.upstream;
  const pTotalLength = pUpstream + downstream;
  const pArea = (pTotalLength * bankWidth * 2) / 1e6; // 两岸各 bankWidth

  zones.push({
    level: '一级',
    method: '经验值法',
    formula: `河流${scale}：取水口上游${pUpstream}m，下游${downstream}m，两岸纵深各${bankWidth}m`,
    length: pUpstream,
    width: bankWidth,
    area: Math.round(pArea * 100) / 100,
    boundaryDescription: `一级保护区长度为取水口上游不小于${pUpstream}m、下游不小于${downstream}m范围内的河道水域及两岸陆域，两岸纵深各不少于${bankWidth}m。`,
    keyParams: `河流规模=${scale}(${basis}), 流量=${flow}m³/s, 河宽=${width}m${slopeAdj ? ', ' + slopeAdj : ''}${tidalAdj ? ', ' + tidalAdj : ''}`,
    standard: 'HJ 338-2018 第5.2.1节',
    riverExt: {
      upstreamLength: pUpstream,
      downstreamLength: downstream,
      bankWidth,
      slopeAdjustment: slopeAdj,
      tidalAdjustment: tidalAdj,
    },
  });

  // ===== 二级保护区（从一级边界起独立延伸）=====
  const sUpstream = pUpstream + secondary.upstreamExt; // 总上游长度
  const sDownstream = downstream + secondary.downstreamExt; // 总下游长度
  const sBankWidth = secondary.bankWidth;
  const sTotalLength = sUpstream + sDownstream;
  const sArea = (sTotalLength * sBankWidth * 2) / 1e6 - pArea;

  zones.push({
    level: '二级',
    method: '经验值法',
    formula: `二级保护区：从一级边界上游延伸${secondary.upstreamExt}m，下游延伸${secondary.downstreamExt}m，两岸纵深各${sBankWidth}m`,
    length: sUpstream,
    width: sBankWidth,
    area: Math.round(Math.max(sArea, 0) * 100) / 100,
    boundaryDescription: `二级保护区从一级保护区边界向上游延伸不小于${secondary.upstreamExt}m，下游延伸不小于${secondary.downstreamExt}m，两岸纵深各不少于${sBankWidth}m。`,
    keyParams: `上游延伸=${secondary.upstreamExt}m, 下游延伸=${secondary.downstreamExt}m, 两岸纵深=${sBankWidth}m`,
    standard: 'HJ 338-2018 第5.2.2节',
    riverExt: {
      upstreamLength: sUpstream,
      downstreamLength: sDownstream,
      bankWidth: sBankWidth,
    },
  });

  // ===== 准保护区 =====
  const qUpstreamExt = Math.round(secondary.upstreamExt * quasiF.upstreamFactor);
  const qUpstream = sUpstream + qUpstreamExt;
  const qDownstream = sDownstream + Math.round(secondary.downstreamExt * quasiF.upstreamFactor);
  const qBankWidth = Math.round(sBankWidth * quasiF.bankFactor);
  const qTotalLength = qUpstream + qDownstream;
  const qArea = (qTotalLength * qBankWidth * 2) / 1e6 - (sTotalLength * sBankWidth * 2) / 1e6;

  zones.push({
    level: '准保护区',
    method: '经验值法',
    formula: `准保护区：二级外侧至汇水区边界，上游延伸${qUpstreamExt}m，两岸纵深各${qBankWidth}m`,
    length: qUpstream,
    width: qBankWidth,
    area: Math.round(Math.max(qArea, 0) * 100) / 100,
    boundaryDescription: `准保护区为二级保护区外侧至该河流取水河段汇水区域边界。上游延伸不小于${qUpstreamExt}m，两岸纵深各不少于${qBankWidth}m。实际划定应以流域汇水分析为准。`,
    keyParams: `上游延伸=${qUpstreamExt}m, 两岸纵深=${qBankWidth}m`,
    standard: 'HJ 338-2018 第5.2.3节',
    riverExt: {
      upstreamLength: qUpstream,
      downstreamLength: qDownstream,
      bankWidth: qBankWidth,
    },
  });

  return zones;
}

/** 湖库型规模分级参数 */
interface LakeScaleParams {
  surfaceArea: number;
  totalCapacity?: number; // 亿 m³
}

/** 湖库型规模判断 — HJ 338-2018 第5.3节（库容为主要依据） */
function classifyLakeScale(params: LakeScaleParams): {
  scale: '大型' | '中型' | '小型';
  basis: string;
} {
  const { surfaceArea, totalCapacity } = params;

  let capacityScale: '大型' | '中型' | '小型' | null = null;
  let areaScale: '大型' | '中型' | '小型';

  if (totalCapacity != null && totalCapacity > 0) {
    capacityScale = totalCapacity >= 10 ? '大型' : totalCapacity >= 1 ? '中型' : '小型';
  }
  areaScale = surfaceArea >= 50 ? '大型' : surfaceArea >= 5 ? '中型' : '小型';

  // 取较高级别（保守原则）
  const order = { 小型: 1, 中型: 2, 大型: 3 } as const;
  const candidates = [areaScale];
  if (capacityScale) candidates.push(capacityScale);
  const scale = candidates.reduce((a, b) => (order[a] >= order[b] ? a : b));

  const indicators: string[] = [`面积${surfaceArea}km²(${areaScale})`];
  if (capacityScale) indicators.push(`库容${totalCapacity}亿m³(${capacityScale})`);

  return { scale, basis: indicators.join('，') + ` → ${scale}` };
}

/** 地表水经验值法（湖库型）— HJ 338-2018 第5.3节 */
function calcLakeEmpirical(params: CalcParams): ZoneResult[] {
  const zones: ZoneResult[] = [];
  const area = params.lakeArea || 0;
  const capacity = params.lakeCapacity || 0;
  const intakeType = params.intakeType || '湖心';
  const intakeDepth = params.intakeDepth;

  // 规模判断（库容为主，面积为辅）
  let scale: '大型' | '中型' | '小型';
  let basis: string;
  if (params.reservoirSize) {
    scale = params.reservoirSize;
    basis = `手动指定=${scale}`;
  } else {
    const result = classifyLakeScale({ surfaceArea: area, totalCapacity: capacity || undefined });
    scale = result.scale;
    basis = result.basis;
  }

  const primary = LAKE_PRIMARY[scale] || LAKE_PRIMARY['小型'];
  const lakeSecondary = LAKE_SECONDARY[scale] || LAKE_SECONDARY['小型'];

  // ===== 一级保护区 =====
  // 水域面积：岸边取水为半圆，湖心/分层取水为全圆
  const fullCircleArea = (Math.PI * primary.radiusM * primary.radiusM) / 1e6;
  const waterArea = intakeType === '岸边' ? fullCircleArea / 2 : fullCircleArea;
  // 陆域面积：水域外延 primary.landExtM
  const landRadiusM = primary.radiusM + primary.landExtM;
  const fullLandArea = (Math.PI * landRadiusM * landRadiusM) / 1e6;
  const landArea =
    intakeType === '岸边' ? (fullLandArea - fullCircleArea) / 2 : fullLandArea - fullCircleArea;
  const primaryArea = waterArea + landArea;

  let intakeDesc = '';
  if (intakeType === '岸边') {
    intakeDesc = '（岸边取水，保护区为水域侧半圆）';
  } else if (intakeType === '分层取水') {
    intakeDesc = intakeDepth ? `（分层取水，取水层深度${intakeDepth}m）` : '（分层取水）';
  }

  zones.push({
    level: '一级',
    method: '经验值法',
    formula: `湖库${scale}：取水口半径${primary.radiusM}m范围水域${intakeType === '岸边' ? '（半圆）' : ''}，陆域外延${primary.landExtM}m${intakeDesc}`,
    radius: primary.radiusM,
    area: Math.round(primaryArea * 100) / 100,
    boundaryDescription: `${primary.description}${intakeDesc}。`,
    keyParams: `湖库规模=${scale}(${basis}), 取水口类型=${intakeType}, 水域半径=${primary.radiusM}m, 陆域外延=${primary.landExtM}m`,
    standard: 'HJ 338-2018 第5.3.1节',
    lakeExt: {
      intakeType,
      waterArea: Math.round(waterArea * 100) / 100,
      landArea: Math.round(landArea * 100) / 100,
      intakeDepth: intakeType === '分层取水' ? intakeDepth : undefined,
    },
  });

  // ===== 二级保护区 =====
  let secondaryWaterArea: number;
  let secondaryLandArea: number;
  let secondaryDesc: string;

  if (lakeSecondary.wholeWater) {
    // 小型：整个水域 + 陆域外延
    secondaryWaterArea = Math.max(area, primaryArea);
    secondaryLandArea = Math.max(area * 0.5, 1.0); // 陆域估算
    secondaryDesc = `小型湖库：整个水域划为二级保护区，陆域为水域外延不小于${lakeSecondary.landExtM}m`;
  } else {
    // 大中型：一级外延 + 陆域外延
    const secRadiusM = primary.radiusM + lakeSecondary.waterExtM;
    const secFullArea = (Math.PI * secRadiusM * secRadiusM) / 1e6;
    secondaryWaterArea =
      intakeType === '岸边' ? (secFullArea - fullCircleArea) / 2 : secFullArea - fullCircleArea;
    // 陆域：二级水域边界外延
    const secLandRadiusM = secRadiusM + lakeSecondary.landExtM;
    const secFullLandArea = (Math.PI * secLandRadiusM * secLandRadiusM) / 1e6;
    secondaryLandArea =
      intakeType === '岸边' ? (secFullLandArea - secFullArea) / 2 : secFullLandArea - secFullArea;
    secondaryDesc = `二级保护区为一级保护区外不小于${lakeSecondary.waterExtM}m范围水域，陆域外延不小于${lakeSecondary.landExtM}m`;
  }

  const secondaryArea = secondaryWaterArea + secondaryLandArea;

  zones.push({
    level: '二级',
    method: '经验值法',
    formula: secondaryDesc,
    area: Math.round(secondaryArea * 100) / 100,
    boundaryDescription: `${secondaryDesc}。`,
    keyParams: `湖库规模=${scale}, 水域面积=${Math.round(secondaryWaterArea * 100) / 100}km², 陆域面积=${Math.round(secondaryLandArea * 100) / 100}km²`,
    standard: 'HJ 338-2018 第5.3.2节',
    lakeExt: {
      intakeType,
      waterArea: Math.round(secondaryWaterArea * 100) / 100,
      landArea: Math.round(secondaryLandArea * 100) / 100,
    },
  });

  // ===== 准保护区 =====
  const quasiArea = secondaryArea * 1.5;

  zones.push({
    level: '准保护区',
    method: '经验值法',
    formula: `准保护区：二级外侧至分水岭，估算面积约${Math.round(quasiArea)}km²`,
    area: Math.round(quasiArea * 100) / 100,
    boundaryDescription: `湖库${scale}准保护区为二级保护区外侧至流域分水岭/汇水区边界，估算面积约${Math.round(quasiArea)}km²。实际划定应基于流域地形分析。`,
    keyParams: `湖库规模=${scale}`,
    standard: 'HJ 338-2018 第5.3.3节',
  });

  return zones;
}

// ===== 解析法 =====

/**
 * Cooper-Jacob 解析法计算保护区半径
 *
 * 原理：基于Cooper-Jacob近似解，计算给定运移时间t内污染物随地下水流运移的距离。
 *
 * 一级保护区（t=60天）：
 *   R₁ = √(2.25 × T × t₁ / (S × 365.25))
 *   其中 t₁ = 60天
 *
 * 二级保护区（t=25年）：
 *   R₂ = √(2.25 × T × t₂ / (S × 365.25))
 *   其中 t₂ = 25年 = 9131.25天
 *
 * 另一种方法——实际流速法：
 *   v = K × I / n（达西流速除以有效孔隙度）
 *   R = v × t
 */
function calcGWAnalytical(params: CalcParams): ZoneResult[] {
  const zones: ZoneResult[] = [];
  const warnings: string[] = [];

  // 计算导水系数 T = K × M
  const K = params.permeability; // m/d
  const M = params.aquiferThickness; // m
  let T = params.transmissivity; // m²/d

  if (!T && K && M) {
    T = K * M;
  }
  const S = params.storativity; // 无量纲
  const I = params.hydraulicGradient; // 无量纲
  const ne = params.effectivePorosity; // 无量纲

  if (!T || T <= 0) {
    warnings.push('缺少导水系数T（或渗透系数K和含水层厚度M），无法使用解析法');
    return zones;
  }
  if (!S || S <= 0) {
    warnings.push('缺少储水系数S/给水度，无法使用解析法');
    return zones;
  }

  // ---- 方法1：Cooper-Jacob公式 ----
  const t1_days = 60; // 一级保护区：60天
  const t2_days = 25 * 365.25; // 二级保护区：25年

  const R1_cj = Math.sqrt((2.25 * T * t1_days) / S);
  const R2_cj = Math.sqrt((2.25 * T * t2_days) / S);

  // ---- 方法2：实际流速法 ----
  let R1_flow: number | undefined;
  let R2_flow: number | undefined;
  if (I && ne) {
    const v = K ? (K * I) / ne : ((T / (M || 1)) * I) / ne; // 实际渗透流速 m/d
    R1_flow = v * t1_days;
    R2_flow = v * t2_days;
  }

  // 一级保护区 — 采用两种方法取较大值
  const R1 = Math.max(R1_cj, R1_flow || 0);
  const R1_area = (Math.PI * R1 * R1) / 1e6;

  let formula1 = `Cooper-Jacob: R₁ = √(2.25×T×t/S) = √(2.25×${T}×${t1_days}/${S}) = ${R1.toFixed(1)}m`;
  if (R1_flow) {
    formula1 += `\n流速法: R₁ = v×t = (K×I/n)×t = ${R1_flow.toFixed(1)}m`;
    formula1 += `\n取大值: R₁ = ${R1.toFixed(1)}m`;
  }

  zones.push({
    level: '一级',
    method: '解析法',
    formula: formula1,
    radius: Math.round(R1),
    area: Math.round(R1_area * 100) / 100,
    boundaryDescription: `以水源井为中心，半径${Math.round(R1)}m的圆形区域（污染物60天运移距离）。多个水源井时，以最外侧井的外包线外推${Math.round(R1)}m划定。`,
    keyParams: `T=${T}m²/d, S=${S}, K=${K || '未设'}m/d, M=${M || '未设'}m, I=${I || '未设'}, n=${ne || '未设'}`,
    standard: 'HJ 338-2018 第6.2节',
  });

  // 二级保护区
  const R2 = Math.max(R2_cj, R2_flow || 0);
  // 二级保护区面积扣减一级保护区（环形）
  const R2_area = (Math.PI * R2 * R2) / 1e6 - R1_area;

  let formula2 = `Cooper-Jacob: R₂ = √(2.25×T×t/S) = √(2.25×${T}×${t2_days}/${S}) = ${R2.toFixed(1)}m`;
  if (R2_flow) {
    formula2 += `\n流速法: R₂ = v×t = ${R2_flow.toFixed(1)}m`;
    formula2 += `\n取大值: R₂ = ${R2.toFixed(1)}m`;
  }

  zones.push({
    level: '二级',
    method: '解析法',
    formula: formula2,
    radius: Math.round(R2),
    area: Math.round(R2_area * 100) / 100,
    boundaryDescription: `以水源井为中心，半径${Math.round(R2)}m的圆形区域减去一级保护区面积（污染物25年运移距离）。`,
    keyParams: `T=${T}m²/d, S=${S}, t₂=${t2_days.toFixed(1)}d(25年)`,
    standard: 'HJ 338-2018 第6.2节',
  });

  // P3-2: 准保护区 — 解析法
  const gwType = params.gwType || '孔隙水';
  const quasi = GW_QUASI_FACTOR[gwType] || GW_QUASI_FACTOR['孔隙水'];
  const quasiR = Math.round(R2 * quasi.typicalFactor);
  const quasiArea = (Math.PI * quasiR * quasiR) / 1e6 - (Math.PI * R2 * R2) / 1e6;

  zones.push({
    level: '准保护区',
    method: '解析法',
    formula: `准保护区半径 = 二级半径 × ${quasi.typicalFactor} = ${Math.round(R2)} × ${quasi.typicalFactor} = ${quasiR}m`,
    radius: quasiR,
    area: Math.round(quasiArea * 100) / 100,
    boundaryDescription: `以水源井为中心，半径${quasiR}m（二级保护区外侧）至汇水区边界/分水岭的区域。实际划定应以水文地质勘查确定的汇水区范围为准。`,
    keyParams: `扩展系数=${quasi.typicalFactor}, 二级半径=${Math.round(R2)}m`,
    standard: 'HJ 338-2018 第6.3节',
  });

  return zones;
}

// ===== 公共接口 =====

/** 计算单个水源地保护区 */
export function calcProtectionZones(sourceName: string, params: CalcParams): CalcResult {
  const warnings: string[] = [];
  let zones: ZoneResult[] = [];

  if (params.sourceType === '地下水') {
    const gwType = params.gwType || '孔隙水';

    // 如果有水文地质参数，同时用解析法和经验值法
    const hasAnalyticalParams =
      (params.transmissivity && params.transmissivity > 0) ||
      (params.permeability &&
        params.permeability > 0 &&
        params.aquiferThickness &&
        params.aquiferThickness > 0);

    if (hasAnalyticalParams && params.storativity && params.storativity > 0) {
      zones = calcGWAnalytical(params);
      if (zones.length === 0) {
        // 解析法失败，回退经验值法
        zones = calcGWEmpirical(params);
        warnings.push('解析法参数不完整，已回退至经验值法');
      }
    } else {
      zones = calcGWEmpirical(params);
      warnings.push(
        '未提供完整水文地质参数，使用经验值法。若需更精确结果，请补充导水系数(T)和储水系数(S)。',
      );
    }
  } else if (params.sourceType === '地表水') {
    if (params.swType === '河流型') {
      zones = calcRiverEmpirical(params);
    } else {
      zones = calcLakeEmpirical(params);
    }
  }

  return {
    sourceName,
    params,
    zones,
    calculatedAt: new Date().toISOString(),
    warnings,
  };
}

/** 批量计算（为多个水源地计算保护区） */
export function calcBatch(items: Array<{ sourceName: string; params: CalcParams }>): CalcResult[] {
  return items.map((item) => calcProtectionZones(item.sourceName, item.params));
}

/** 根据水源地记录推断默认计算参数 */
export function inferDefaultParams(type: '地表水' | '地下水', subType?: string): CalcParams {
  if (type === '地表水') {
    // 湖库型 vs 河流型
    if (subType?.includes('湖') || subType?.includes('库') || subType?.includes('南水北调')) {
      return {
        sourceType: '地表水',
        swType: '湖库型',
        reservoirSize: '中型',
        intakeType: '湖心',
      };
    }
    return { sourceType: '地表水', swType: '河流型', isTidal: false };
  }

  // 地下水
  if (subType?.includes('岩溶')) {
    return { sourceType: '地下水', gwType: '岩溶水' };
  }
  if (subType?.includes('裂隙')) {
    return { sourceType: '地下水', gwType: '裂隙水' };
  }
  return { sourceType: '地下水', gwType: '孔隙水' };
}
