/* ===== S13.3: 报告模板化引擎 =====
 * 为空间分析报告提供模板选择与章节自定义能力。
 * 复用 zoneReportGenerator 的模板设计模式。
 */

// ===== 章节定义 =====

export type SpatialReportChapter =
  | 'cover'           // 封面
  | 'overview'        // 分析概述
  | 'queryConclusion' // 综合查询结论
  | 'proximity'       // 邻近检索
  | 'riskMatrix'      // 风险矩阵
  | 'sensitive'       // 敏感目标
  | 'upstream'        // 汇水上游
  | 'density'         // 密度聚类
  | 'relationMatrix'  // 关系矩阵
  | 'conclusion';     // 结论与建议

export type SpatialReportTemplate = 'simple' | 'standard' | 'detailed';

export interface ChapterConfig {
  id: SpatialReportChapter;
  label: string;
  description: string;
  /** 默认选中 */
  defaultEnabled: boolean;
}

/** 所有可用章节 */
export const ALL_CHAPTERS: ChapterConfig[] = [
  { id: 'cover', label: '封面', description: '报告标题与基本信息', defaultEnabled: true },
  { id: 'overview', label: '分析概述', description: '分析对象、坐标、启用功能', defaultEnabled: true },
  { id: 'queryConclusion', label: '综合查询结论', description: 'S12.9 综合结果', defaultEnabled: true },
  { id: 'proximity', label: '邻近检索', description: 'S12.1 最近水源地', defaultEnabled: true },
  { id: 'riskMatrix', label: '风险矩阵', description: 'S12.3 风险分级与环评结论', defaultEnabled: true },
  { id: 'sensitive', label: '敏感目标', description: 'S12.5 敏感目标筛查', defaultEnabled: true },
  { id: 'upstream', label: '汇水上游', description: 'S12.7 上游判断', defaultEnabled: false },
  { id: 'density', label: '密度聚类', description: 'S12.4 空间密度', defaultEnabled: false },
  { id: 'relationMatrix', label: '关系矩阵', description: 'S12.6 多项目矩阵', defaultEnabled: false },
  { id: 'conclusion', label: '结论与建议', description: '综合结论', defaultEnabled: true },
];

/** 模板预设章节 */
export const TEMPLATE_CHAPTERS: Record<SpatialReportTemplate, SpatialReportChapter[]> = {
  simple: ['cover', 'overview', 'queryConclusion', 'conclusion'],
  standard: ['cover', 'overview', 'queryConclusion', 'riskMatrix', 'sensitive', 'conclusion'],
  detailed: [
    'cover',
    'overview',
    'queryConclusion',
    'proximity',
    'riskMatrix',
    'sensitive',
    'upstream',
    'density',
    'relationMatrix',
    'conclusion',
  ],
};

export interface TemplateConfig {
  /** 模板名称 */
  template: SpatialReportTemplate;
  /** 自定义章节（覆盖模板预设） */
  chapters?: SpatialReportChapter[];
  /** 报告标题 */
  title?: string;
  /** 是否包含封面 */
  includeCover?: boolean;
}

/**
 * 获取最终生效的章节列表
 */
export function getEffectiveChapters(config: TemplateConfig): SpatialReportChapter[] {
  const chapters = config.chapters ?? TEMPLATE_CHAPTERS[config.template];
  if (config.includeCover === false) {
    return chapters.filter((c) => c !== 'cover');
  }
  return chapters;
}

/**
 * 获取模板名称
 */
export function getTemplateLabel(template: SpatialReportTemplate): string {
  switch (template) {
    case 'simple': return '简洁模板';
    case 'standard': return '标准模板';
    case 'detailed': return '详细模板';
  }
}

/**
 * 获取模板描述
 */
export function getTemplateDescription(template: SpatialReportTemplate): string {
  switch (template) {
    case 'simple': return '仅包含核心结论，适合快速浏览';
    case 'standard': return '包含风险矩阵与敏感目标，适合常规环评辅助';
    case 'detailed': return '包含全部空间分析章节，适合深度评估报告';
  }
}

/**
 * 获取章节中文标签
 */
export function getChapterLabel(chapter: SpatialReportChapter): string {
  const found = ALL_CHAPTERS.find((c) => c.id === chapter);
  return found?.label ?? chapter;
}

/**
 * 获取章节描述
 */
export function getChapterDescription(chapter: SpatialReportChapter): string {
  const found = ALL_CHAPTERS.find((c) => c.id === chapter);
  return found?.description ?? '';
}