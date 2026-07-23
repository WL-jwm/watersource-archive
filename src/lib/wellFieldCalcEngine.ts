/**
 * A2: 多井干扰保护区计算引擎
 *
 * 功能：
 * 1. 多井各自 capture zone 计算（单井 Cooper-Jacob）
 * 2. 井群等效半径法（等效大单井）
 * 3. 几何合并（union）外包络线
 * 4. 干扰系数修正
 *
 * 依据：HJ 338-2018 第6.2节，多井水源地应考虑井群干扰效应
 *
 * 核心原理：
 * - 叠加法：各井独立计算保护区，几何合并后取外包络线
 * - 等效半径法：将井群等效为大单井，Re = sqrt(sum(ri²) / pi + A / pi)
 *   其中 A 为井群分布面积，ri 为各井到质心的距离
 * - 干扰修正：井间距 < 2×R1 时，capture zone 叠加扩大
 */

// ===== 类型定义 =====

/** 单个取水井信息 */
export interface WellInfo {
  /** 井编号 */
  id: string;
  /** 井名称 */
  name?: string;
  /** 经度 */
  lng: number;
  /** 纬度 */
  lat: number;
  /** 该井取水量 m³/d（可选，不填则均分） */
  yield?: number;
}

/** 多井计算参数 */
export interface WellFieldCalcParams {
  /** 取水井列表 */
  wells: WellInfo[];
  /** 含水层厚度 m */
  aquiferThickness?: number;
  /** 渗透系数 m/d */
  permeability?: number;
  /** 导水系数 T = K × M m²/d */
  transmissivity?: number;
  /** 储水系数（无量纲） */
  storativity?: number;
  /** 水力坡度（无量纲） */
  hydraulicGradient?: number;
  /** 有效孔隙度 */
  effectivePorosity?: number;
  /** 水源地总取水量 m³/d */
  dailyYield?: number;
  /** 地下水类型 */
  gwType?: '孔隙水' | '裂隙水' | '岩溶水';
}

/** 单井保护区计算结果 */
export interface SingleWellZone {
  /** 井编号 */
  wellId: string;
  /** 井名称 */
  wellName?: string;
  /** 井坐标 */
  lng: number;
  lat: number;
  /** 一级保护区半径 m */
  primaryRadius: number;
  /** 二级保护区半径 m */
  secondaryRadius: number;
  /** 准保护区半径 m */
  quasiRadius: number;
  /** 计算方法 */
  method: string;
  /** 计算公式 */
  formula: string;
  /** 该井取水量 m³/d */
  yield: number;
}

/** 井群保护区计算结果 */
export interface WellFieldZoneResult {
  /** 计算方法 */
  method: '叠加法' | '等效半径法';
  /** 井群质心经度 */
  centerLng: number;
  /** 井群质心纬度 */
  centerLat: number;
  /** 井数量 */
  wellCount: number;
  /** 井群分布面积 m² */
  wellFieldArea: number;
  /** 等效半径 m */
  equivalentRadius: number;
  /** 一级保护区（合并后） */
  primary: {
    /** 合并后等效半径 m */
    radius: number;
    /** 面积 km² */
    area: number;
    /** 边界描述 */
    description: string;
    /** 干扰修正系数 */
    interferenceFactor: number;
  };
  /** 二级保护区（合并后） */
  secondary: {
    radius: number;
    area: number;
    description: string;
    interferenceFactor: number;
  };
  /** 准保护区 */
  quasi: {
    radius: number;
    area: number;
    description: string;
  };
  /** 各井独立计算结果 */
  singleWells: SingleWellZone[];
  /** 计算警告 */
  warnings: string[];
  /** 计算时间 */
  calculatedAt: string;
}

// ===== 辅助函数 =====

const EARTH_LAT_M = 110540; // 1°纬度 ≈ 110540m
const EARTH_LNG_M = 111320; // 1°经度 ≈ 111320m（赤道）

/** 两点间距离（米，平面近似） */
function distanceMeters(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const dlng = (lng2 - lng1) * EARTH_LNG_M * Math.cos((lat1 * Math.PI) / 180);
  const dlat = (lat2 - lat1) * EARTH_LAT_M;
  return Math.sqrt(dlng * dlng + dlat * dlat);
}

/** 计算井群质心 */
function calcCentroid(wells: WellInfo[]): { lng: number; lat: number } {
  const n = wells.length;
  const sumLng = wells.reduce((s, w) => s + w.lng, 0);
  const sumLat = wells.reduce((s, w) => s + w.lat, 0);
  return { lng: sumLng / n, lat: sumLat / n };
}

/** 计算井群分布面积（凸包面积，简化为外接矩形面积） */
function calcWellFieldArea(wells: WellInfo[]): number {
  if (wells.length < 2) return 0;
  if (wells.length === 2) {
    // 两井：以连线为对角线的矩形面积
    const d = distanceMeters(wells[0].lng, wells[0].lat, wells[1].lng, wells[1].lat);
    return 0; // 两井时面积为0，等效半径直接用井距
  }

  // 多井：计算外接矩形面积
  const lngs = wells.map((w) => w.lng);
  const lats = wells.map((w) => w.lat);
  const dlng =
    (Math.max(...lngs) - Math.min(...lngs)) *
    EARTH_LNG_M *
    Math.cos((wells[0].lat * Math.PI) / 180);
  const dlat = (Math.max(...lats) - Math.min(...lats)) * EARTH_LAT_M;
  return dlng * dlat;
}

// ===== 核心计算 =====

/**
 * 单井 Cooper-Jacob 保护区半径计算
 *
 * 一级保护区：t = 60天，R = sqrt(2.25 * T * t / S)
 * 二级保护区：t = 25年(9131天)，R = sqrt(2.25 * T * t / S)
 *
 * @param T 导水系数 m²/d
 * @param S 储水系数
 * @param Q 该井取水量 m³/d
 * @param Qtotal 总取水量 m³/d
 */
function calcSingleWellRadius(
  T: number,
  S: number,
  Q: number,
  _Qtotal: number,
): { r1: number; r2: number; rq: number; formula: string } {
  // 一级保护区：60天运移距离
  const t1 = 60; // 天
  const R1 = Math.sqrt((2.25 * T * t1) / S);

  // 二级保护区：25年运移距离
  const t2 = 25 * 365.25; // 天
  const R2 = Math.sqrt((2.25 * T * t2) / S);

  // 准保护区：二级 × 1.5
  const Rq = R2 * 1.5;

  const formula = `R₁=√(2.25×${T.toFixed(2)}×${t1}/${S})=${R1.toFixed(1)}m; R₂=√(2.25×${T.toFixed(2)}×${t2.toFixed(0)}/${S})=${R2.toFixed(1)}m`;

  return { r1: Math.round(R1), r2: Math.round(R2), rq: Math.round(Rq), formula };
}

/**
 * 计算多井干扰系数
 *
 * 当井间距 < 2×R1 时，capture zone 叠加，保护区扩大
 * 干扰系数 = 1 + min(0.3, sum(overlap) / (n * pi * R1²))
 *
 * @param wells 井列表
 * @param r1 一级保护区半径
 * @returns 干扰系数（1.0~1.3）
 */
function calcInterferenceFactor(wells: WellInfo[], r1: number): number {
  if (wells.length < 2) return 1.0;

  let overlapArea = 0;
  const r1Area = Math.PI * r1 * r1;

  for (let i = 0; i < wells.length; i++) {
    for (let j = i + 1; j < wells.length; j++) {
      const d = distanceMeters(wells[i].lng, wells[i].lat, wells[j].lng, wells[j].lat);
      // 当井距 < 2×R1 时，capture zone 重叠
      if (d < 2 * r1) {
        // 两圆重叠面积公式
        const r = r1;
        const overlap = 2 * r * r * Math.acos(d / (2 * r)) - (d / 2) * Math.sqrt(4 * r * r - d * d);
        overlapArea += Math.max(0, overlap);
      }
    }
  }

  // 干扰系数：重叠面积占总面积的比例，上限30%
  const totalArea = wells.length * r1Area;
  const ratio = totalArea > 0 ? overlapArea / totalArea : 0;
  const factor = 1 + Math.min(0.3, ratio * 0.5);

  return Math.round(factor * 100) / 100;
}

/**
 * 等效半径法
 *
 * 将井群等效为一个大单井：
 * Re = sqrt(A/pi + sum(ri²)/pi)
 *
 * 其中 A 为井群分布面积，ri 为各井到质心的距离
 */
function calcEquivalentRadius(
  wells: WellInfo[],
  centroid: { lng: number; lat: number },
  wellFieldArea: number,
): number {
  // 各井到质心距离的平方和
  const sumRiSquared = wells.reduce((sum, w) => {
    const d = distanceMeters(w.lng, w.lat, centroid.lng, centroid.lat);
    return sum + d * d;
  }, 0);

  // 等效半径 = sqrt((A + sum(ri²)) / pi)
  const Re = Math.sqrt((wellFieldArea + sumRiSquared) / Math.PI);
  return Math.round(Re);
}

// ===== 主函数 =====

/**
 * 多井干扰保护区计算
 *
 * 同时使用叠加法和等效半径法，取较大值（保守原则）
 */
export function calcWellFieldZones(params: WellFieldCalcParams): WellFieldZoneResult {
  const warnings: string[] = [];
  const wells = params.wells;

  if (!wells || wells.length === 0) {
    throw new Error('井列表不能为空');
  }

  if (wells.length === 1) {
    warnings.push('仅有一个井，建议直接使用单井保护区计算');
  }

  // 导水系数
  let T = params.transmissivity || 0;
  if (T === 0 && params.permeability && params.aquiferThickness) {
    T = params.permeability * params.aquiferThickness;
  }
  if (T === 0) {
    T = 100; // 默认值
    warnings.push('未提供导水系数，使用默认值 T=100 m²/d');
  }

  const S = params.storativity || 0.0001;
  if (!params.storativity) {
    warnings.push('未提供储水系数，使用默认值 S=0.0001');
  }

  const Qtotal = params.dailyYield || 5000;

  // 分配各井取水量
  const wellsAssigned = wells.map((w, i) => ({
    ...w,
    yield: w.yield || Qtotal / wells.length,
    name: w.name || `井${i + 1}`,
  }));

  // 计算各井独立保护区
  const singleWells: SingleWellZone[] = wellsAssigned.map((w) => {
    const { r1, r2, rq, formula } = calcSingleWellRadius(T, S, w.yield, Qtotal);
    return {
      wellId: w.id,
      wellName: w.name,
      lng: w.lng,
      lat: w.lat,
      primaryRadius: r1,
      secondaryRadius: r2,
      quasiRadius: rq,
      method: 'Cooper-Jacob',
      formula,
      yield: w.yield,
    };
  });

  // 井群质心
  const centroid = calcCentroid(wells);

  // 井群分布面积
  const wellFieldArea = calcWellFieldArea(wells);

  // 等效半径
  const Re = calcEquivalentRadius(wells, centroid, wellFieldArea);

  // 平均单井一级半径
  const avgR1 = singleWells.reduce((s, w) => s + w.primaryRadius, 0) / singleWells.length;
  const avgR2 = singleWells.reduce((s, w) => s + w.secondaryRadius, 0) / singleWells.length;
  const avgRq = singleWells.reduce((s, w) => s + w.quasiRadius, 0) / singleWells.length;

  // 干扰系数
  const interferenceR1 = calcInterferenceFactor(wells, avgR1);
  const interferenceR2 = calcInterferenceFactor(wells, avgR2);

  // 方法1：叠加法（平均半径 × 干扰系数）
  const stackR1 = Math.round(avgR1 * interferenceR1);
  const stackR2 = Math.round(avgR2 * interferenceR2);
  const stackRq = Math.round(avgRq * interferenceR1);

  // 方法2：等效半径法
  // 等效半径对应的保护区 = Re + 单井capture zone
  const equivR1 = Math.round(Re + avgR1);
  const equivR2 = Math.round(Re + avgR2);
  const equivRq = Math.round(Re + avgRq);

  // 保守原则：取较大值
  const useStack = stackR1 >= equivR1;
  const method = useStack ? '叠加法' : '等效半径法';

  const finalR1 = Math.max(stackR1, equivR1);
  const finalR2 = Math.max(stackR2, equivR2);
  const finalRq = Math.max(stackRq, equivRq);

  // 面积计算
  const primaryArea = Math.round(((Math.PI * finalR1 * finalR1) / 1e6) * 100) / 100;
  const secondaryArea =
    Math.round(((Math.PI * finalR2 * finalR2 - Math.PI * finalR1 * finalR1) / 1e6) * 100) / 100;
  const quasiArea =
    Math.round(((Math.PI * finalRq * finalRq - Math.PI * finalR2 * finalR2) / 1e6) * 100) / 100;

  // 干扰分析警告
  for (let i = 0; i < wells.length; i++) {
    for (let j = i + 1; j < wells.length; j++) {
      const d = distanceMeters(wells[i].lng, wells[i].lat, wells[j].lng, wells[j].lat);
      if (d < 2 * avgR1) {
        warnings.push(
          `井${i + 1}与井${j + 1}间距${d.toFixed(0)}m < 2×R1(${(2 * avgR1).toFixed(0)}m)，存在干扰`,
        );
      }
    }
  }

  if (wells.length >= 3 && wellFieldArea > 0) {
    warnings.push(`井群分布面积${(wellFieldArea / 1e6).toFixed(2)}km²，等效半径${Re}m`);
  }

  return {
    method,
    centerLng: Math.round(centroid.lng * 1e6) / 1e6,
    centerLat: Math.round(centroid.lat * 1e6) / 1e6,
    wellCount: wells.length,
    wellFieldArea: Math.round(wellFieldArea),
    equivalentRadius: Re,
    primary: {
      radius: finalR1,
      area: primaryArea,
      description: `以井群质心(${centroid.lng.toFixed(6)}, ${centroid.lat.toFixed(6)})为中心，半径${finalR1}m的圆形区域。${useStack ? `叠加法（干扰系数${interferenceR1}）` : `等效半径法（Re=${Re}+R1=${avgR1.toFixed(0)}）`}`,
      interferenceFactor: interferenceR1,
    },
    secondary: {
      radius: finalR2,
      area: secondaryArea,
      description: `以井群质心为中心，半径${finalR2}m的圆形区域减去一级保护区面积。${useStack ? `叠加法（干扰系数${interferenceR2}）` : `等效半径法`}`,
      interferenceFactor: interferenceR2,
    },
    quasi: {
      radius: finalRq,
      area: quasiArea,
      description: `以井群质心为中心，半径${finalRq}m（二级保护区外侧）至汇水区边界的区域。`,
    },
    singleWells,
    warnings,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * 生成井群保护区的外包络线拐点
 *
 * 在井群质心位置生成圆形拐点（使用合并后的半径）
 */
export function generateWellFieldVertices(
  centerLng: number,
  centerLat: number,
  radiusM: number,
  vertexCount: number = 24,
): Array<{ id: string; lng: number; lat: number; azimuth: number }> {
  const latRad = (centerLat * Math.PI) / 180;
  const vertices: Array<{ id: string; lng: number; lat: number; azimuth: number }> = [];

  for (let i = 0; i < vertexCount; i++) {
    const azimuth = (360 / vertexCount) * i;
    const rad = (azimuth * Math.PI) / 180;
    const dlng = radiusM / (EARTH_LNG_M * Math.cos(latRad));
    const dlat = radiusM / EARTH_LAT_M;
    vertices.push({
      id: `J${i + 1}`,
      lng: Math.round((centerLng + dlng * Math.sin(rad)) * 1e6) / 1e6,
      lat: Math.round((centerLat + dlat * Math.cos(rad)) * 1e6) / 1e6,
      azimuth: Math.round(azimuth * 100) / 100,
    });
  }

  return vertices;
}

/**
 * 生成各单井的保护区圆心和多边形（用于地图展示）
 */
export function generateSingleWellCircles(
  singleWells: SingleWellZone[],
  vertexCount: number = 24,
): Array<{
  wellId: string;
  wellName?: string;
  centerLng: number;
  centerLat: number;
  primaryRadius: number;
  secondaryRadius: number;
  primaryVertices: Array<{ lng: number; lat: number }>;
  secondaryVertices: Array<{ lng: number; lat: number }>;
}> {
  return singleWells.map((w) => {
    const latRad = (w.lat * Math.PI) / 180;
    const lngFactor = EARTH_LNG_M * Math.cos(latRad);

    const genCircle = (radius: number) => {
      const verts: Array<{ lng: number; lat: number }> = [];
      for (let i = 0; i < vertexCount; i++) {
        const angle = (2 * Math.PI * i) / vertexCount;
        verts.push({
          lng: w.lng + (radius / lngFactor) * Math.sin(angle),
          lat: w.lat + (radius / EARTH_LAT_M) * Math.cos(angle),
        });
      }
      return verts;
    };

    return {
      wellId: w.wellId,
      wellName: w.wellName,
      centerLng: w.lng,
      centerLat: w.lat,
      primaryRadius: w.primaryRadius,
      secondaryRadius: w.secondaryRadius,
      primaryVertices: genCircle(w.primaryRadius),
      secondaryVertices: genCircle(w.secondaryRadius),
    };
  });
}
