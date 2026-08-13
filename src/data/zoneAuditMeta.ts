/**
 * 实际保护区边界审计元数据
 *
 * 基于 2021 年第三方 KMZ 数据与河北省人民政府历次批复的差异比对结果，
 * 标记 KMZ 数据中「已被官方取消 / 已调整」的保护区要素，以及官方新增但 KMZ 缺失的清单。
 *
 * 用途：实际边界图层渲染时，对命中规则的要素做样式与弹窗提示，避免将过期保护区当作有效范围。
 *
 * 数据基准：河北省人民政府「冀政字」系列水源保护区批复（截至 2026-08）。
 */

/** 保护区审计状态 */
export type ZoneAuditStatus = 'cancelled' | 'adjusted';

/** 单条审计规则 */
export interface ZoneAuditRule {
  /** 所在城市（对应 public/zone-boundaries/<城市>.json 命名） */
  city: string;
  /** 名称关键词（要素 name 命中任一即匹配） */
  keywords: string[];
  /** 状态：cancelled 已取消 / adjusted 已调整 */
  status: ZoneAuditStatus;
  /** 说明 */
  note: string;
  /** 批复文号/日期 */
  ref: string;
}

/**
 * 已取消 / 已调整保护区规则。
 * 命中规则的城市+名称要素，在边界图层中以特殊样式呈现并提示。
 */
export const ZONE_AUDIT_RULES: ZoneAuditRule[] = [
  // ---- 已取消（KMZ 仍保留，属过期数据）----
  {
    city: '保定市',
    keywords: ['满城'],
    status: 'cancelled',
    note: '保定市满城区县城集中式饮用水水源保护区已取消',
    ref: '省政府批复取消（2025-03）',
  },
  {
    city: '沧州市',
    keywords: ['南大港'],
    status: 'cancelled',
    note: '沧州南大港产业园区集中式饮用水水源保护区已取消',
    ref: '冀政字〔2021〕41号',
  },
  {
    city: '定州市',
    keywords: ['定州经济开发区'],
    status: 'cancelled',
    note: '定州市经济开发区应急备用水源保护区已取消',
    ref: '冀政字〔2022〕41号',
  },

  // ---- 已调整（KMZ 为调整前范围）----
  {
    city: '石家庄市',
    keywords: ['栾城'],
    status: 'adjusted',
    note: '石家庄市栾城区城区集中式饮用水水源保护区已调整',
    ref: '冀政字〔2021〕14号',
  },
  {
    city: '唐山市',
    keywords: ['陡河'],
    status: 'adjusted',
    note: '唐山市陡河水库集中式饮用水水源保护区已调整',
    ref: '冀政字〔2023〕63号',
  },
  {
    city: '秦皇岛市',
    keywords: ['桃林口'],
    status: 'adjusted',
    note: '秦皇岛市桃林口水库集中式饮用水水源保护区已调整',
    ref: '冀政字〔2023〕54号',
  },
  {
    city: '邯郸市',
    keywords: ['羊角铺'],
    status: 'adjusted',
    note: '邯郸羊角铺地下饮用水水源保护区已优化调整',
    ref: '冀政字〔2020〕63号',
  },
  {
    city: '沧州市',
    keywords: ['泊头'],
    status: 'adjusted',
    note: '泊头市集中式饮用水水源保护区已调整',
    ref: '冀政字〔2025〕20号',
  },
  {
    city: '张家口市',
    keywords: ['腰站堡'],
    status: 'adjusted',
    note: '张家口市腰站堡集中式饮用水水源保护区已调整',
    ref: '冀政字〔2023〕44号',
  },
];

/**
 * 判断给定城市+名称的保护区要素是否命中审计规则。
 * @returns 命中则返回状态，否则返回 null
 */
export function auditZoneStatus(city: string, name: string): ZoneAuditStatus | null {
  for (const rule of ZONE_AUDIT_RULES) {
    if (rule.city !== city) continue;
    if (rule.keywords.some((k) => name.includes(k))) return rule.status;
  }
  return null;
}

/** 官方新增/调整但 KMZ 缺失的保护区（KMZ 中无几何数据，供提示与规划参考） */
export interface MissingZone {
  /** 所在城市 */
  city: string;
  /** 保护区名称 */
  name: string;
  /** 批复文号/日期 */
  ref: string;
  /** 说明 */
  note: string;
}

export const MISSING_ZONES: MissingZone[] = [
  { city: '雄安新区', name: '雄安新区14个乡镇集中式水源保护区', ref: '冀政字〔2023〕4号', note: 'KMZ 仅有雄县/容城/安新县城旧数据' },
  { city: '承德市', name: '承德市5个水源保护区', ref: '冀政字〔2023〕8号', note: 'KMZ 缺失' },
  { city: '承德市', name: '兴隆县杨树湾第六水源地', ref: '冀政字〔2025〕批复', note: 'KMZ 缺失' },
  { city: '张家口市', name: '尚义县城区北营子村水源保护区', ref: '冀政字〔2024〕66号', note: 'KMZ 缺失' },
  { city: '石家庄市', name: '主城区应急水源工程（地下水）保护区', ref: '冀政字〔2025〕批复', note: 'KMZ 缺失' },
  { city: '沧州市', name: '东光县城区生活应急水源保护区', ref: '冀政字〔2026〕批复', note: 'KMZ 缺失' },
  { city: '唐山市', name: '邱庄水库水源保护区', ref: '冀政字〔2023〕53号', note: 'KMZ 缺失' },
  { city: '保定市', name: '45个乡镇集中式水源保护区', ref: '冀政字〔2022〕11号', note: 'KMZ 缺失' },
  { city: '张家口市', name: '33个乡镇集中式水源保护区', ref: '冀政字〔2022〕12号', note: 'KMZ 缺失' },
  { city: '辛集市', name: '2个乡镇水源保护区', ref: '冀政字〔2022〕批复', note: 'KMZ 缺失' },
];
