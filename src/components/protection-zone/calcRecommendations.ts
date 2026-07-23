/**
 * 保护区计算参数智能推荐
 *
 * 基于HJ 338-2018和河北省区域水文地质特征的参数推荐表
 * 数据来源：
 * - HJ 338-2018 附录B 各类型含水层水文地质参数经验值范围
 * - 河北省水文地质图集（河北省地质矿产勘查开发局）
 * - 河北省地下水资源评价报告
 * - 各水源地环评报告实测参数统计
 */

import type { WaterSourceRecord } from '@/stores/waterSourceStore';

export interface RecommendedParams {
  K?: string;
  M?: string;
  T?: string;
  S?: string;
  I?: string;
  ne?: string;
  riverFlow?: string;
  riverWidth?: string;
  riverDepth?: string;
  riverSlope?: string;
  lakeArea?: string;
  lakeCapacity?: string;
  maxDepth?: string;
  reservoirSize?: '大型' | '中型' | '小型';
  intakeType?: '岸边' | '湖心' | '分层取水';
  gwType?: '孔隙水' | '裂隙水' | '岩溶水';
  description: string;
  basis: string;
}

export const PARAM_RECOMMENDATIONS: Record<string, Record<string, RecommendedParams>> = {
  地下水: {
    孔隙水: {
      K: '5 ~ 20',
      M: '15 ~ 40',
      T: '',
      S: '0.08 ~ 0.25',
      I: '0.001 ~ 0.005',
      ne: '0.15 ~ 0.30',
      gwType: '孔隙水',
      description:
        '河北省山前冲洪积扇/冲积平原区典型参数。太行山前（石家庄、保定、邢台、邯郸）K偏高(10~30m/d)，中部平原（衡水、沧州）K偏低(2~8m/d)。',
      basis: 'HJ 338-2018 附录B 表B.1 + 河北省水文地质图集',
    },
    裂隙水: {
      K: '0.5 ~ 5',
      M: '10 ~ 30',
      T: '',
      S: '0.01 ~ 0.05',
      I: '0.005 ~ 0.02',
      ne: '0.05 ~ 0.15',
      gwType: '裂隙水',
      description:
        '燕山-太行山基岩裂隙水。承德、张家口山区裂隙发育不均匀，K变化大。一般风化裂隙带K=1~5m/d，构造裂隙带可达5~10m/d。',
      basis: 'HJ 338-2018 附录B 表B.2 + 张承山区水文地质普查',
    },
    岩溶水: {
      K: '20 ~ 200',
      M: '20 ~ 80',
      T: '',
      S: '0.05 ~ 0.20',
      I: '0.002 ~ 0.01',
      ne: '0.10 ~ 0.25',
      gwType: '岩溶水',
      description:
        '碳酸盐岩溶裂隙含水层。河北典型岩溶水水源地（如邢台百泉、邯郸黑龙洞、石家庄威州）K值变化极大，高度非均质，解析法结果仅供参考。建议结合示踪试验或数值模拟验证。',
      basis: 'HJ 338-2018 附录B 表B.3 + 河北省岩溶水资源评价',
    },
  },
  地表水: {
    河流型: {
      riverFlow: '10 ~ 100',
      riverWidth: '50 ~ 300',
      riverDepth: '2 ~ 5',
      riverSlope: '0.3 ~ 1.5',
      description:
        '河北省主要河流型水源地（滹沱河、滏阳河、漳河等）。流量因季节差异大，枯水期流量可能仅为年均值的1/3~1/5。',
      basis: 'HJ 338-2018 第5.2节 + 河北省水文年鉴',
    },
    湖库型: {
      lakeArea: '5 ~ 50',
      lakeCapacity: '1 ~ 20',
      maxDepth: '15 ~ 40',
      reservoirSize: '中型',
      intakeType: '湖心',
      description:
        '河北省主要湖库型水源地（岗南水库17.04亿m³、黄壁庄水库12.1亿m³、朱庄水库4.36亿m³等）。',
      basis: 'HJ 338-2018 第5.3节 + 河北省大中型水库统计',
    },
  },
};

/** 河北省各水文地质区典型参数（更精细化推荐） */
export const REGIONAL_PARAMS: Record<string, Record<string, RecommendedParams>> = {
  石家庄市: {
    孔隙水: {
      K: '10 ~ 30',
      M: '20 ~ 45',
      S: '0.10 ~ 0.22',
      I: '0.002 ~ 0.004',
      ne: '0.20 ~ 0.30',
      description: '太行山前冲洪积扇，含水层颗粒粗、厚度大',
      basis: '石家庄市地下水水源地环评报告统计',
    },
  },
  保定市: {
    孔隙水: {
      K: '8 ~ 25',
      M: '20 ~ 50',
      S: '0.08 ~ 0.20',
      I: '0.002 ~ 0.005',
      ne: '0.18 ~ 0.28',
      description: '山前冲洪积扇，含水层厚，补给条件好',
      basis: '保定市地下水资源评价',
    },
  },
  邢台市: {
    孔隙水: {
      K: '5 ~ 18',
      M: '15 ~ 35',
      S: '0.08 ~ 0.20',
      I: '0.002 ~ 0.006',
      ne: '0.15 ~ 0.25',
      description: '山前~中东部过渡带，由西向东K递减',
      basis: '邢台市地下水水源地调查报告',
    },
  },
  邯郸市: {
    孔隙水: {
      K: '5 ~ 15',
      M: '15 ~ 30',
      S: '0.06 ~ 0.18',
      I: '0.002 ~ 0.005',
      ne: '0.15 ~ 0.25',
      description: '山前冲洪积扇前缘，含水层厚度渐小',
      basis: '邯郸市地下水水源地调查',
    },
  },
  衡水市: {
    孔隙水: {
      K: '2 ~ 8',
      M: '10 ~ 25',
      S: '0.04 ~ 0.12',
      I: '0.001 ~ 0.003',
      ne: '0.12 ~ 0.20',
      description: '中部冲积平原，含水层颗粒细，T偏低',
      basis: '衡水市地下水超采区评价',
    },
  },
  沧州市: {
    孔隙水: {
      K: '1 ~ 6',
      M: '10 ~ 20',
      S: '0.03 ~ 0.10',
      I: '0.0005 ~ 0.002',
      ne: '0.10 ~ 0.18',
      description: '滨海平原，含水层以粉细砂为主',
      basis: '沧州市深层地下水开采评价',
    },
  },
  张家口市: {
    裂隙水: {
      K: '1 ~ 8',
      M: '10 ~ 25',
      S: '0.01 ~ 0.06',
      I: '0.005 ~ 0.015',
      ne: '0.05 ~ 0.12',
      description: '坝上高原及山间盆地，含水层薄',
      basis: '张家口市水源地调查报告',
    },
  },
  承德市: {
    裂隙水: {
      K: '0.5 ~ 5',
      M: '8 ~ 20',
      S: '0.01 ~ 0.05',
      I: '0.005 ~ 0.02',
      ne: '0.05 ~ 0.10',
      description: '燕山山区基岩裂隙，非均质性强',
      basis: '承德市水源地调查报告',
    },
  },
  唐山市: {
    孔隙水: {
      K: '8 ~ 25',
      M: '20 ~ 40',
      S: '0.08 ~ 0.20',
      I: '0.001 ~ 0.004',
      ne: '0.15 ~ 0.25',
      description: '山前冲积扇+滨海过渡带',
      basis: '唐山市地下水资源评价',
    },
  },
  廊坊市: {
    孔隙水: {
      K: '3 ~ 12',
      M: '15 ~ 30',
      S: '0.05 ~ 0.15',
      I: '0.001 ~ 0.003',
      ne: '0.12 ~ 0.22',
      description: '冲积平原区，含水层中等厚度',
      basis: '廊坊市地下水资源调查',
    },
  },
};

/** 根据水源地记录推断推荐参数 */
export function getSmartRecommendation(record?: WaterSourceRecord): RecommendedParams | null {
  if (!record) return null;
  const type = record.type as '地下水' | '地表水';
  const subType = record.subType || (type === '地下水' ? '孔隙水' : '河流型');
  const city = record.cityName;

  // 优先使用区域精细化参数
  const regional = REGIONAL_PARAMS[city]?.[subType];
  const generic = PARAM_RECOMMENDATIONS[type]?.[subType];

  if (regional) {
    return { ...generic, ...regional };
  }
  return generic || null;
}
