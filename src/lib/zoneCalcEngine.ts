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

  // ---- 地表水参数 ----
  /** 河流平均流量 m³/s */
  riverFlow?: number;
  /** 河流平均宽度 m */
  riverWidth?: number;
  /** 湖库水面面积 km² */
  lakeArea?: number;
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

/** 河流型一级保护区经验值 — HJ 338-2018 */
const RIVER_PRIMARY: Record<string, { length: number; width: number }> = {
  大型: { length: 5000, width: 500 }, // 大型河流：长度不小于取水口上游5km，宽度不小于500m
  中型: { length: 3000, width: 300 }, // 中型河流：长度不小于3km，宽度不小于300m
  小型: { length: 1000, width: 200 }, // 小型河流：长度不小于1km，宽度不小于200m
};

/** 湖库型一级保护区 — HJ 338-2018 */
const LAKE_PRIMARY: Record<string, { radiusM: number; description: string }> = {
  小型: { radiusM: 1000, description: '取水口半径1000m范围内的水域和陆域' },
  中型: { radiusM: 2000, description: '取水口半径2000m范围内的水域和陆域' },
  大型: { radiusM: 3000, description: '取水口半径3000m范围内的水域和陆域' },
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

/** 地表水经验值法（河流型） */
function calcRiverEmpirical(params: CalcParams): ZoneResult[] {
  const zones: ZoneResult[] = [];
  const flow = params.riverFlow || 0;
  const width = params.riverWidth || 0;

  // 判断河流规模
  let scale: string;
  if (flow >= 100 || width >= 200) {
    scale = '大型';
  } else if (flow >= 10 || width >= 50) {
    scale = '中型';
  } else {
    scale = '小型';
  }

  const primary = RIVER_PRIMARY[scale] || RIVER_PRIMARY['中型'];
  const primaryArea = (primary.length * primary.width) / 1e6;

  zones.push({
    level: '一级',
    method: '经验值法',
    formula: `河流${scale}：取水口上游${primary.length}m，下游${Math.round(primary.length * 0.2)}m，两岸宽度${primary.width}m`,
    length: primary.length,
    width: primary.width,
    area: Math.round(primaryArea * 100) / 100,
    boundaryDescription: `一级保护区长度为取水口上游不小于${primary.length}m、下游不小于${Math.round(primary.length * 0.2)}m范围内的河道水域及两岸陆域，宽度为沿岸不少于${primary.width}m。`,
    keyParams: `河流规模=${scale}, 流量=${flow}m³/s, 河宽=${width}m`,
    standard: 'HJ 338-2018 第5.2节',
  });

  // 二级保护区（经验值：一级外侧扩展）
  const secondaryLength = primary.length * 3;
  const secondaryWidth = primary.width * 2;
  const secondaryArea = (secondaryLength * secondaryWidth) / 1e6;

  zones.push({
    level: '二级',
    method: '经验值法',
    formula: `二级保护区：取水口上游${secondaryLength}m，两岸宽度${secondaryWidth}m`,
    length: secondaryLength,
    width: secondaryWidth,
    area: Math.round(secondaryArea * 100) / 100,
    boundaryDescription: `二级保护区从一级保护区边界向上游延伸至不小于${secondaryLength}m，两岸宽度不小于${secondaryWidth}m。`,
    keyParams: `上游=${secondaryLength}m, 两岸宽度=${secondaryWidth}m`,
    standard: 'HJ 338-2018 第5.2节',
  });

  // P3-2: 准保护区 — 河流型准保护区为二级保护区外侧至汇水区边界
  const quasiLength = secondaryLength * 2; // 二级保护区上游长度的2倍
  const quasiWidth = secondaryWidth * 1.5; // 二级保护区宽度的1.5倍
  const quasiArea = (quasiLength * quasiWidth) / 1e6 - (secondaryLength * secondaryWidth) / 1e6;

  zones.push({
    level: '准保护区',
    method: '经验值法',
    formula: `准保护区：二级外侧至汇水区边界，上游延伸至${quasiLength}m，两岸宽度${quasiWidth}m`,
    length: quasiLength,
    width: quasiWidth,
    area: Math.round(Math.max(quasiArea, 0) * 100) / 100,
    boundaryDescription: `准保护区为二级保护区外侧至该河流取水河段汇水区域边界。上游延伸至不小于${quasiLength}m，两岸宽度不小于${quasiWidth}m。实际划定应以流域汇水分析为准。`,
    keyParams: `上游=${quasiLength}m, 两岸宽度=${quasiWidth}m`,
    standard: 'HJ 338-2018 第5.2节',
  });

  return zones;
}

/** 地表水经验值法（湖库型） */
function calcLakeEmpirical(params: CalcParams): ZoneResult[] {
  const zones: ZoneResult[] = [];
  const area = params.lakeArea || 0;
  const yield_ = params.dailyYield || 0;

  // 判断湖库规模
  let scale: string;
  if (area >= 50) {
    scale = '大型';
  } else if (area >= 5) {
    scale = '中型';
  } else {
    scale = '小型';
  }
  if (params.reservoirSize) scale = params.reservoirSize;

  const primary = LAKE_PRIMARY[scale] || LAKE_PRIMARY['小型'];
  const primaryArea = (Math.PI * primary.radiusM * primary.radiusM) / 1e6;

  zones.push({
    level: '一级',
    method: '经验值法',
    formula: `湖库${scale}：取水口半径${primary.radiusM}m`,
    radius: primary.radiusM,
    area: Math.round(primaryArea * 100) / 100,
    boundaryDescription: primary.description,
    keyParams: `湖库规模=${scale}, 面积=${area}km², 取水口半径=${primary.radiusM}m`,
    standard: 'HJ 338-2018 第5.3节',
  });

  // 二级保护区：整个水域 + 陆域一定范围
  // 小型：整个水域面积，大中型：一级外侧至分水岭
  const secondaryArea = scale === '小型' ? area : Math.max(area, primaryArea * 2);

  zones.push({
    level: '二级',
    method: '经验值法',
    formula:
      scale === '小型'
        ? '小型水库：整个汇水区域'
        : `二级保护区面积不小于一级保护区面积，约${Math.round(secondaryArea)}km²`,
    area: Math.round(secondaryArea * 100) / 100,
    boundaryDescription:
      scale === '小型'
        ? '小型湖库：将整个水面划为一级保护区，整个汇水区域划为二级保护区。'
        : `二级保护区为一级保护区外的水域及沿岸一定范围的陆域，面积不小于${Math.round(secondaryArea)}km²。`,
    keyParams: `湖库规模=${scale}, 水域面积=${area}km²`,
    standard: 'HJ 338-2018 第5.3节',
  });

  // P3-2: 准保护区 — 湖库型准保护区为二级保护区外侧至分水岭/汇水区边界
  const quasiArea =
    scale === '小型'
      ? Math.max(area * 0.5, secondaryArea * 0.3) // 小型：汇水区外扩
      : Math.max(secondaryArea * 1.5, area); // 大中型：一级外侧至分水岭

  zones.push({
    level: '准保护区',
    method: '经验值法',
    formula:
      scale === '小型'
        ? `准保护区：汇水区外侧，估算面积约${Math.round(quasiArea)}km²`
        : `准保护区：二级外侧至分水岭，估算面积约${Math.round(quasiArea)}km²`,
    area: Math.round(quasiArea * 100) / 100,
    boundaryDescription:
      scale === '小型'
        ? '小型湖库准保护区为二级保护区外侧至分水岭的区域。'
        : `大中型湖库准保护区为二级保护区外侧至流域分水岭边界，面积不小于${Math.round(quasiArea)}km²。实际划定应基于流域汇水分析。`,
    keyParams: `湖库规模=${scale}`,
    standard: 'HJ 338-2018 第5.3节',
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
      return { sourceType: '地表水', swType: '湖库型', reservoirSize: '中型' };
    }
    return { sourceType: '地表水', swType: '河流型' };
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
