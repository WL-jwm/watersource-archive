/**
 * H1: 智能参数推荐 V2
 *
 * 基于 HJ 338-2018 规范和河北省水文地质经验数据
 * 根据水源地类型、规模、地质条件智能推荐计算参数
 *
 * 功能：
 * 1. 根据水源地基本信息推荐全部计算参数
 * 2. 参数合理性范围校验
 * 3. 参数来源标注（规范/经验/实测）
 * 4. 敏感性提示（哪些参数对结果影响最大）
 */

import type { CalcParams } from './zoneCalcEngine';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';

// ===== 类型定义 =====

export type ParamSource = '规范' | '经验' | '实测' | '推断' | '计算';
export type ParamSensitivity = 'high' | 'medium' | 'low';

export interface ParamRecommendation {
  /** 参数名 */
  field: keyof CalcParams;
  /** 中文名 */
  label: string;
  /** 推荐值 */
  value: number | string | boolean;
  /** 单位 */
  unit?: string;
  /** 参数来源 */
  source: ParamSource;
  /** 来源说明 */
  sourceDetail: string;
  /** 敏感性 */
  sensitivity: ParamSensitivity;
  /** 合理范围 */
  range?: { min: number; max: number; unit: string };
  /** 备注 */
  remark?: string;
}

export interface ParamRecommendationResult {
  /** 推荐参数列表 */
  params: ParamRecommendation[];
  /** 完整 CalcParams */
  calcParams: CalcParams;
  /** 推荐方法（经验值法/解析法） */
  recommendedMethod: '经验值法' | '解析法';
  /** 方法说明 */
  methodReason: string;
  /** 警告信息 */
  warnings: string[];
  /** 置信度 */
  confidence: number;
}

// ===== 河北省经验参数库 =====

/** 河北省地下水经验参数（按地市分） */
const HB_GW_PARAMS: Record<string, { K: [number, number]; T: [number, number]; n: number; I: number }> = {
  '石家庄市': { K: [5, 50], T: [100, 500], n: 0.15, I: 0.002 },
  '唐山市': { K: [3, 30], T: [50, 300], n: 0.12, I: 0.0015 },
  '保定市': { K: [5, 40], T: [80, 400], n: 0.14, I: 0.002 },
  '廊坊市': { K: [2, 20], T: [30, 200], n: 0.10, I: 0.001 },
  '沧州市': { K: [1, 15], T: [20, 150], n: 0.08, I: 0.0008 },
  '衡水市': { K: [2, 18], T: [25, 180], n: 0.09, I: 0.001 },
  '邢台市': { K: [3, 25], T: [40, 250], n: 0.11, I: 0.0012 },
  '邯郸市': { K: [4, 35], T: [60, 350], n: 0.13, I: 0.0015 },
  '张家口市': { K: [1, 10], T: [15, 100], n: 0.06, I: 0.003 },
  '承德市': { K: [1, 8], T: [10, 80], n: 0.05, I: 0.003 },
  '秦皇岛市': { K: [2, 15], T: [20, 120], n: 0.08, I: 0.002 },
  '默认': { K: [3, 30], T: [50, 300], n: 0.12, I: 0.002 },
};

/** 河北省主要河流参数 */
const HB_RIVER_PARAMS: Record<string, { flow: number; width: number; depth: number; slope: number }> = {
  '滹沱河': { flow: 30, width: 80, depth: 1.5, slope: 0.5 },
  '滏阳河': { flow: 15, width: 50, depth: 1.2, slope: 0.3 },
  '漳河': { flow: 25, width: 60, depth: 1.3, slope: 0.4 },
  '拒马河': { flow: 20, width: 55, depth: 1.2, slope: 0.6 },
  '唐河': { flow: 12, width: 40, depth: 1.0, slope: 0.5 },
  '沙河': { flow: 10, width: 35, depth: 0.8, slope: 0.7 },
  '默认': { flow: 15, width: 50, depth: 1.0, slope: 0.5 },
};

// ===== 主函数 =====

/**
 * H1: 智能参数推荐 V2
 *
 * 根据水源地信息自动推荐计算参数
 */
export function recommendParams(source: WaterSourceRecord): ParamRecommendationResult {
  const params: ParamRecommendation[] = [];
  const warnings: string[] = [];
  const calcParams: CalcParams = {
    sourceType: source.type as '地下水' | '地表水',
  };

  let recommendedMethod: '经验值法' | '解析法' = '经验值法';
  let methodReason = '水源地基础信息不足以支撑解析法计算，推荐使用经验值法。';
  let confidence = 70;

  // 获取城市经验参数
  const cityParams = HB_GW_PARAMS[source.cityName] || HB_GW_PARAMS['默认'];

  if (source.type === '地下水') {
    // ---- 地下水水源地 ----
    recommendedMethod = '解析法';
    methodReason = '地下水水源地有解析法计算公式（HJ 338-2018 附录A），需水文地质参数。';
    confidence = 75;

    // 地下水类型
    let gwType: '孔隙水' | '裂隙水' | '岩溶水' = '孔隙水';
    if (source.subType?.includes('岩溶')) gwType = '岩溶水';
    else if (source.subType?.includes('裂隙')) gwType = '裂隙水';
    calcParams.gwType = gwType;

    params.push({
      field: 'gwType',
      label: '地下水类型',
      value: gwType,
      source: '推断',
      sourceDetail: `根据水源地细分类型"${source.subType}"推断`,
      sensitivity: 'high',
    });

    // 渗透系数 K
    const K_mid = (cityParams.K[0] + cityParams.K[1]) / 2;
    calcParams.permeability = K_mid;
    params.push({
      field: 'permeability',
      label: '渗透系数 K',
      value: K_mid,
      unit: 'm/d',
      source: '经验',
      sourceDetail: `河北省${source.cityName}经验值范围 ${cityParams.K[0]}~${cityParams.K[1]} m/d`,
      sensitivity: 'high',
      range: { min: cityParams.K[0], max: cityParams.K[1], unit: 'm/d' },
      remark: '对一级保护区半径影响显著，建议使用实测值',
    });

    // 含水层厚度
    const defaultThickness = gwType === '岩溶水' ? 50 : gwType === '裂隙水' ? 30 : 20;
    calcParams.aquiferThickness = defaultThickness;
    params.push({
      field: 'aquiferThickness',
      label: '含水层厚度 M',
      value: defaultThickness,
      unit: 'm',
      source: '经验',
      sourceDetail: `${gwType}含水层典型厚度`,
      sensitivity: 'medium',
      range: { min: 5, max: 100, unit: 'm' },
    });

    // 导水系数 T = K * M
    const T = K_mid * defaultThickness;
    calcParams.transmissivity = T;
    params.push({
      field: 'transmissivity',
      label: '导水系数 T',
      value: T,
      unit: 'm²/d',
      source: '计算',
      sourceDetail: `T = K × M = ${K_mid} × ${defaultThickness}`,
      sensitivity: 'high',
    });

    // 水力坡度
    calcParams.hydraulicGradient = cityParams.I;
    params.push({
      field: 'hydraulicGradient',
      label: '水力坡度 I',
      value: cityParams.I,
      source: '经验',
      sourceDetail: `河北省${source.cityName}区域水力坡度经验值`,
      sensitivity: 'medium',
      range: { min: 0.0005, max: 0.005, unit: '' },
    });

    // 有效孔隙度
    calcParams.effectivePorosity = cityParams.n;
    params.push({
      field: 'effectivePorosity',
      label: '有效孔隙度 ne',
      value: cityParams.n,
      source: '经验',
      sourceDetail: `${gwType}含水层典型有效孔隙度`,
      sensitivity: 'medium',
      range: { min: 0.05, max: 0.25, unit: '' },
    });

    // 日取水量
    if (source.population && source.population > 0) {
      const yieldEst = Math.round((source.population * 0.12) * 1000) / 1000; // 人均120L/d
      calcParams.dailyYield = yieldEst;
      params.push({
        field: 'dailyYield',
        label: '日取水量 Q',
        value: yieldEst,
        unit: 'm³/d',
        source: '推断',
        sourceDetail: `按服务人口${source.population}人 × 人均120L/d估算`,
        sensitivity: 'high',
        remark: '建议使用实际取水许可量',
      });
    }

    // 岩溶水特殊提示
    if (gwType === '岩溶水') {
      warnings.push('岩溶含水层非均质性强，解析法计算结果仅供参考，建议结合水文地质勘察数据');
      confidence -= 10;
    }
  } else if (source.type === '地表水') {
    // ---- 地表水水源地 ----
    let swType: '河流型' | '湖库型' = '河流型';
    if (source.subType?.includes('湖') || source.subType?.includes('库') || source.name.includes('水库') || source.name.includes('湖')) {
      swType = '湖库型';
    }
    calcParams.swType = swType;

    params.push({
      field: 'swType',
      label: '地表水类型',
      value: swType,
      source: '推断',
      sourceDetail: `根据水源地名称和细分类型推断`,
      sensitivity: 'high',
    });

    if (swType === '河流型') {
      recommendedMethod = '经验值法';
      methodReason = '河流型水源地推荐使用经验值法（HJ 338-2018 表2），无需复杂水文参数。';
      confidence = 85;

      // 河流参数
      const riverParams = source.river ? (HB_RIVER_PARAMS[source.river] || HB_RIVER_PARAMS['默认']) : HB_RIVER_PARAMS['默认'];

      if (source.river) {
        calcParams.riverFlow = riverParams.flow;
        params.push({
          field: 'riverFlow',
          label: '河流多年平均流量',
          value: riverParams.flow,
          unit: 'm³/s',
          source: '经验',
          sourceDetail: `${source.river}多年平均流量经验值`,
          sensitivity: 'low',
        });

        calcParams.riverWidth = riverParams.width;
        calcParams.riverDepth = riverParams.depth;
        calcParams.riverSlope = riverParams.slope;
      }

      // 潮汐判断
      const isCoastal = ['唐山市', '沧州市', '秦皇岛市'].includes(source.cityName);
      calcParams.isTidal = isCoastal;
      if (isCoastal) {
        calcParams.tidalUpstreamDistance = 5000;
        warnings.push(`${source.cityName}沿海地区，需考虑潮汐影响`);
        params.push({
          field: 'isTidal',
          label: '潮汐影响',
          value: true,
          source: '推断',
          sourceDetail: `${source.cityName}为沿海城市，河流可能受潮汐影响`,
          sensitivity: 'high',
        });
      }
    } else {
      // 湖库型
      // 根据服务人口推断水库规模
      let reservoirSize: '大型' | '中型' | '小型' = '中型';
      if (source.population && source.population > 500000) reservoirSize = '大型';
      else if (source.population && source.population < 50000) reservoirSize = '小型';
      calcParams.reservoirSize = reservoirSize;

      params.push({
        field: 'reservoirSize',
        label: '水库规模',
        value: reservoirSize,
        source: '推断',
        sourceDetail: `根据服务人口${source.population || '未知'}推断`,
        sensitivity: 'medium',
      });

      // 取水口类型
      calcParams.intakeType = '湖心';
      params.push({
        field: 'intakeType',
        label: '取水口类型',
        value: '湖心',
        source: '经验',
        sourceDetail: '大中型水库默认湖心取水',
        sensitivity: 'medium',
      });
    }
  }

  // 通用警告
  if (!source.population || source.population === 0) {
    warnings.push('缺少服务人口数据，取水量为估算值，建议补充实际数据');
    confidence -= 5;
  }

  if (source.lng === 0 || source.lat === 0) {
    warnings.push('缺少准确坐标信息，无法进行行政区划裁剪分析');
    confidence -= 10;
  }

  return {
    params,
    calcParams,
    recommendedMethod,
    methodReason,
    warnings,
    confidence: Math.max(40, Math.min(95, confidence)),
  };
}

// ===== 参数验证 =====

export interface ParamValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 验证参数合理性
 */
export function validateParams(params: CalcParams): ParamValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (params.sourceType === '地下水') {
    if (params.permeability != null) {
      if (params.permeability <= 0) errors.push('渗透系数必须大于0');
      if (params.permeability > 100) warnings.push('渗透系数>100m/d偏大，请确认是否为岩溶强发育区');
      if (params.permeability < 0.01) warnings.push('渗透系数<0.01m/d偏小，请确认是否为弱透水层');
    }
    if (params.aquiferThickness != null && params.aquiferThickness <= 0) {
      errors.push('含水层厚度必须大于0');
    }
    if (params.hydraulicGradient != null) {
      if (params.hydraulicGradient <= 0) errors.push('水力坡度必须大于0');
      if (params.hydraulicGradient > 0.01) warnings.push('水力坡度>0.01偏大');
    }
    if (params.dailyYield != null && params.dailyYield <= 0) {
      errors.push('日取水量必须大于0');
    }
  }

  if (params.sourceType === '地表水' && params.swType === '河流型') {
    if (params.riverFlow != null && params.riverFlow <= 0) {
      errors.push('河流流量必须大于0');
    }
    if (params.isTidal && !params.tidalUpstreamDistance) {
      warnings.push('潮汐河段未设置潮汐上溯距离');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
