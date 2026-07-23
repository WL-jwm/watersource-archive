/**
 * 保护区划分技术报告 Word 生成器
 *
 * 依据 HJ 338-2018《饮用水水源保护区划分技术规范》
 * 报告结构：
 *   第一章 概述
 *   第二章 水源地概况
 *   第三章 保护区划分结果（逐个水源地，含拐点坐标表）
 *   第四章 汇总统计
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  TableLayoutType,
  VerticalAlign,
  ShadingType,
} from 'docx';
import { saveAs } from 'file-saver';
import type { ZoneCalcRecord } from '@/stores/waterSourceStore';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';
import { generateBatchVertices, type SourceZoneVertices } from './zoneCoordGenerator';

// ===== 报告章节枚举 =====
export type ReportChapter =
  | 'cover' // 封面
  | 'overview' // 第一章 概述
  | 'sourceList' // 第二章 水源地概况
  | 'calcDetail' // 第三章 保护区划分结果
  | 'vertices' // 拐点坐标表（第三章子节）
  | 'sensitivity' // 敏感性分析（第三章子节）
  | 'summary' // 第四章 汇总统计
  | 'compliance'; // 第五章 合规性检查（可选）

export type ReportTemplate = 'simple' | 'standard' | 'detailed';

// ===== 报告选项 =====

export interface ReportOptions {
  /** 指定城市筛选，空=全部 */
  cityNames?: string[];
  /** 是否包含拐点坐标表 */
  includeVertices?: boolean;
  /** 每圈拐点数量 */
  vertexCount?: number;
  /** 报告标题（默认自动生成） */
  title?: string;
}

// ===== 报告配置（B1增强） =====

export interface ReportConfig extends ReportOptions {
  /** 选中的章节 */
  chapters?: ReportChapter[];
  /** 模板 */
  template?: ReportTemplate;
  /** 报告编号 */
  reportNumber?: string;
  /** 编制单位 */
  compileUnit?: string;
  /** 委托单位 */
  entrustUnit?: string;
  /** 审核人 */
  reviewer?: string;
  /** 编制人 */
  compiler?: string;
  /** 嵌入的图件数据URL列表 */
  imageUrls?: string[];
}

/** 模板预设章节 */
const TEMPLATE_CHAPTERS: Record<ReportTemplate, ReportChapter[]> = {
  simple: ['cover', 'overview', 'sourceList', 'calcDetail', 'summary'],
  standard: ['cover', 'overview', 'sourceList', 'calcDetail', 'vertices', 'summary'],
  detailed: [
    'cover',
    'overview',
    'sourceList',
    'calcDetail',
    'vertices',
    'sensitivity',
    'summary',
    'compliance',
  ],
};

/** 生成报告编号 HJ-YYYY-NNN-CCCCCC */
export function generateReportNumber(year: number, seq: number, cityCode?: string): string {
  const seqStr = String(seq).padStart(3, '0');
  return `HJ-${year}-${seqStr}${cityCode ? `-${cityCode}` : ''}`;
}

// ===== 辅助：创建段落 =====

function title(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 44, font: 'SimHei' })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
  });
}

function subtitle(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 28, font: 'SimSun', color: '666666' })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
  });
}

function heading1(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 32, font: 'SimHei' })],
    spacing: { before: 300, after: 200 },
  });
}

function heading2(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 28, font: 'SimHei' })],
    spacing: { before: 200, after: 100 },
  });
}

function heading3(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 24, font: 'SimHei' })],
    spacing: { before: 150, after: 80 },
  });
}

function bodyText(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 21, font: 'SimSun' })],
    spacing: { after: 80, line: 360 },
  });
}

function bodyTextBold(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 21, font: 'SimSun' })],
    spacing: { after: 80, line: 360 },
  });
}

function emptyLine(): Paragraph {
  return new Paragraph({ children: [], spacing: { after: 100 } });
}

// ===== 辅助：创建表格 =====

const thinBorder = {
  top: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
  left: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
  right: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
};

function headerCell(text: string, width?: number): TableCell {
  const opts: any = {
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, size: 18, font: 'SimHei' })],
        alignment: AlignmentType.CENTER,
      }),
    ],
    shading: { type: ShadingType.CLEAR, fill: 'F0F0F0' },
    borders: thinBorder,
    verticalAlign: VerticalAlign.CENTER,
  };
  if (width) opts.width = { size: width, type: WidthType.DXA };
  return new TableCell(opts);
}

function dataCell(
  text: string | number,
  width?: number,
  align?: (typeof AlignmentType)[keyof typeof AlignmentType],
): TableCell {
  const opts: any = {
    children: [
      new Paragraph({
        children: [new TextRun({ text: String(text), size: 18, font: 'SimSun' })],
        alignment: align || AlignmentType.LEFT,
      }),
    ],
    borders: thinBorder,
    verticalAlign: VerticalAlign.CENTER,
  };
  if (width) opts.width = { size: width, type: WidthType.DXA };
  return new TableCell(opts);
}

function makeTable(headers: string[], rows: string[][], colWidths?: number[]): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => headerCell(h, colWidths?.[i])),
  });
  const dataRows = rows.map(
    (row) =>
      new TableRow({
        children: row.map((cell, i) =>
          dataCell(cell, colWidths?.[i], i > 0 ? AlignmentType.CENTER : undefined),
        ),
      }),
  );
  return new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
  });
}

// ===== 核心：生成报告 =====

/**
 * P3-18: 批量按城市生成独立Word报告
 * 每个城市生成一个独立的.docx文件，进度通过回调函数汇报
 */
export async function generateBatchReports(
  results: ZoneCalcRecord[],
  sources: WaterSourceRecord[],
  options: ReportOptions & {
    onProgress?: (current: number, total: number, cityName: string) => void;
  } = {},
): Promise<void> {
  const { onProgress, ...reportOpts } = options;
  const sourceMap = new Map<string, WaterSourceRecord>();
  const sourceNameMap = new Map<string, WaterSourceRecord>();
  for (const s of sources) {
    sourceMap.set(s.id, s);
    if (!sourceNameMap.has(s.name)) sourceNameMap.set(s.name, s);
  }

  // 按城市分组
  const cityGroups = new Map<string, ZoneCalcRecord[]>();
  for (const r of results) {
    const src = sourceMap.get(r.sourceId) || sourceNameMap.get(r.sourceName);
    const city = src?.cityName || '未知';
    if (!cityGroups.has(city)) cityGroups.set(city, []);
    cityGroups.get(city)!.push(r);
  }

  const cities = Array.from(cityGroups.keys()).sort((a, b) => a.localeCompare(b, 'zh'));
  const total = cities.length;

  // 逐城市生成报告
  for (let i = 0; i < total; i++) {
    const city = cities[i];
    onProgress?.(i + 1, total, city);
    await generateZoneReport(cityGroups.get(city)!, sources, {
      ...reportOpts,
      cityNames: [city],
      title: `${city}饮用水水源保护区划分技术报告`,
    });
    // 短暂延迟避免浏览器下载队列卡死
    if (i < total - 1) await new Promise((r) => setTimeout(r, 300));
  }
}

export async function generateZoneReport(
  results: ZoneCalcRecord[],
  sources: WaterSourceRecord[],
  options: ReportOptions | ReportConfig = {},
): Promise<void> {
  const { cityNames = [], includeVertices = true, vertexCount = 24 } = options;
  // B1: 章节配置
  const config = options as ReportConfig;
  const template = config.template || 'standard';
  const chapters = config.chapters || TEMPLATE_CHAPTERS[template] || TEMPLATE_CHAPTERS.standard;
  const hasChapter = (ch: ReportChapter) => chapters.includes(ch);
  const effectiveIncludeVertices = includeVertices && hasChapter('vertices');

  // 建立映射
  const sourceMap = new Map<string, WaterSourceRecord>();
  const sourceNameMap = new Map<string, WaterSourceRecord>();
  for (const s of sources) {
    sourceMap.set(s.id, s);
    if (!sourceNameMap.has(s.name)) sourceNameMap.set(s.name, s);
  }

  // 筛选
  let filtered = results;
  if (cityNames.length > 0) {
    const citySet = new Set(cityNames);
    filtered = results.filter((r) => {
      const src = sourceMap.get(r.sourceId) || sourceNameMap.get(r.sourceName);
      return src && citySet.has(src.cityName);
    });
  }

  if (filtered.length === 0) {
    alert('没有可生成报告的计算结果');
    return;
  }

  // 生成拐点坐标数据
  let vertexData: Map<string, SourceZoneVertices> | null = null;
  if (effectiveIncludeVertices) {
    const batchItems = filtered
      .map((r) => {
        const src = sourceMap.get(r.sourceId) || sourceNameMap.get(r.sourceName);
        if (!src || src.lng == null || src.lat == null) return null;
        return {
          sourceId: r.sourceId,
          sourceName: r.sourceName,
          lng: src.lng,
          lat: src.lat,
          zones: r.zones,
        };
      })
      .filter(Boolean) as any[];
    const vertexList = generateBatchVertices(batchItems, vertexCount);
    vertexData = new Map(vertexList.map((v) => [v.sourceId, v]));
  }

  const cityLabel = cityNames.length > 0 ? cityNames.join('、') : '河北省';
  const reportTitle = options.title || `${cityLabel}饮用水水源保护区划分技术报告`;

  // ===== 组装文档 =====
  const children: (Paragraph | Table)[] = [];

  // 封面
  if (hasChapter('cover')) {
    children.push(emptyLine());
    children.push(emptyLine());
    children.push(emptyLine());
    children.push(emptyLine());
    // B1: 报告编号
    if (config.reportNumber) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `报告编号：${config.reportNumber}`,
              size: 21,
              font: 'SimSun',
            }),
          ],
          alignment: AlignmentType.RIGHT,
          spacing: { after: 200 },
        }),
      );
    }
    children.push(title(reportTitle));
    children.push(
      subtitle(
        `（共${filtered.length}个水源地，${effectiveIncludeVertices ? '含拐点坐标' : '不含拐点坐标'}）`,
      ),
    );
    children.push(subtitle(`生成日期：${new Date().toLocaleDateString('zh-CN')}`));
    children.push(emptyLine());
    children.push(emptyLine());
    children.push(bodyText('依据：HJ 338-2018《饮用水水源保护区划分技术规范》'));
    // B1: 元数据
    if (config.compileUnit || config.entrustUnit || config.compiler || config.reviewer) {
      children.push(emptyLine());
      if (config.entrustUnit) children.push(bodyText(`委托单位：${config.entrustUnit}`));
      if (config.compileUnit) children.push(bodyText(`编制单位：${config.compileUnit}`));
      if (config.compiler) children.push(bodyText(`编制人：${config.compiler}`));
      if (config.reviewer) children.push(bodyText(`审核人：${config.reviewer}`));
    }
    children.push(emptyLine());

    // 分页
    children.push(new Paragraph({ children: [], pageBreakBefore: true }));
  }

  // 统计计算方法（供 overview 和 summary 使用）
  const empiricalCount = filtered.filter((r) =>
    r.zones.some((z) => z.method === '经验值法'),
  ).length;
  const analyticalCount = filtered.filter((r) => r.zones.some((z) => z.method === '解析法')).length;

  // 第一章 概述
  if (hasChapter('overview')) {
    children.push(heading1('第一章 概述'));

    children.push(heading2('1.1 划分依据'));
    children.push(bodyText('本次饮用水水源保护区划分依据以下技术规范和标准：'));
    children.push(bodyText('（1）HJ 338-2018《饮用水水源保护区划分技术规范》'));
    children.push(bodyText('（2）《中华人民共和国水污染防治法》（2017年修正）'));
    children.push(bodyText('（3）《河北省集中式饮用水水源地保护区划分方案》'));
    children.push(emptyLine());

    children.push(heading2('1.2 划分范围'));
    children.push(
      bodyText(
        `本次划分范围涵盖${cityLabel}共${filtered.length}个集中式饮用水水源地。其中地下水水源地${filtered.filter((r) => r.params.sourceType === '地下水').length}个，地表水水源地${filtered.filter((r) => r.params.sourceType === '地表水').length}个。`,
      ),
    );
    children.push(emptyLine());

    // 计算方法统计
    children.push(heading2('1.3 划分方法'));
    children.push(bodyText(`本次保护区划分采用以下方法：`));
    if (empiricalCount > 0) {
      children.push(
        bodyText(
          `（1）经验值法：适用于${empiricalCount}个水源地。根据地下水类型（孔隙水/裂隙水/岩溶水）或地表水类型（河流型/湖库型）查表取典型半径值。`,
        ),
      );
    }
    if (analyticalCount > 0) {
      children.push(
        bodyText(
          `（2）解析法（Cooper-Jacob）：适用于${analyticalCount}个水源地。基于Cooper-Jacob近似解，通过导水系数T和储水系数S计算给定运移时间t内污染物运移距离。一级保护区取t=60天，二级保护区取t=25年。`,
        ),
      );
    }
    children.push(emptyLine());

    // 分页
    children.push(new Paragraph({ children: [], pageBreakBefore: true }));
  } // end overview

  // 第二章 水源地概况
  if (hasChapter('sourceList')) {
    children.push(heading1('第二章 水源地概况'));
    children.push(bodyText('本次划分涉及的饮用水水源地清单如下：'));
    children.push(emptyLine());

    const sourceListHeaders = [
      '序号',
      '水源地名称',
      '城市',
      '县区',
      '级别',
      '水源类型',
      '细分类型',
      '状态',
    ];
    const sourceListRows = filtered.map((r, i) => {
      const src = sourceMap.get(r.sourceId) || sourceNameMap.get(r.sourceName);
      return [
        String(i + 1),
        r.sourceName,
        src?.cityName || '',
        src?.county || '',
        src?.level === 'municipal' ? '市级' : src?.level === 'county' ? '县级' : '乡镇级',
        r.params.sourceType,
        r.params.gwType || r.params.swType || '',
        src?.status || '在用',
      ];
    });
    children.push(
      makeTable(sourceListHeaders, sourceListRows, [800, 3500, 1000, 1200, 800, 800, 1000, 800]),
    );
    children.push(emptyLine());

    // 分页
    children.push(new Paragraph({ children: [], pageBreakBefore: true }));
  } // end sourceList

  // 第三章 保护区划分结果
  if (hasChapter('calcDetail')) {
    children.push(heading1('第三章 保护区划分结果'));
    children.push(emptyLine());

    for (let i = 0; i < filtered.length; i++) {
      const r = filtered[i];
      const src = sourceMap.get(r.sourceId) || sourceNameMap.get(r.sourceName);

      children.push(heading2(`3.${i + 1} ${r.sourceName}`));
      children.push(
        bodyText(
          `所在城市：${src?.cityName || '未知'}  |  县区：${src?.county || '未知'}  |  级别：${src?.level === 'municipal' ? '市级' : src?.level === 'county' ? '县级' : '乡镇级'}  |  水源类型：${r.params.sourceType}${r.params.gwType ? `（${r.params.gwType}）` : r.params.swType ? `（${r.params.swType}）` : ''}`,
        ),
      );

      if (src?.lng != null && src?.lat != null) {
        children.push(bodyText(`中心坐标：东经${src.lng.toFixed(6)}°，北纬${src.lat.toFixed(6)}°`));
      }

      // 警告信息
      if (r.warnings.length > 0) {
        for (const w of r.warnings) {
          children.push(bodyText(`注意：${w}`));
        }
      }

      // 逐级保护区
      for (const zone of r.zones) {
        children.push(heading3(`${zone.level}保护区`));
        children.push(bodyText(`面积：${zone.area} km²`));
        if (zone.radius) {
          children.push(bodyText(`半径：${zone.radius} m`));
        }
        if (zone.length && zone.width) {
          children.push(bodyText(`长度：${zone.length} m  |  宽度：${zone.width} m`));
        }
        children.push(bodyText(`计算方法：${zone.method}`));
        children.push(bodyText(`边界描述：${zone.boundaryDescription}`));
        children.push(emptyLine());

        // 拐点坐标表
        if (effectiveIncludeVertices && vertexData) {
          const sv = vertexData.get(r.sourceId);
          if (sv) {
            const zv = sv.zones.find((z) => z.level === zone.level);
            if (zv && zv.vertices.length > 0) {
              children.push(bodyTextBold(`${zone.level}保护区拐点坐标表：`));
              const vertHeaders = ['拐点编号', '东经(°)', '北纬(°)', '方位角(°)'];
              const vertRows = zv.vertices.map((v) => [
                v.id,
                v.lng.toFixed(6),
                v.lat.toFixed(6),
                String(v.azimuth),
              ]);
              children.push(makeTable(vertHeaders, vertRows, [1200, 2500, 2500, 1500]));
              children.push(emptyLine());
            }
          }
        }
      }

      children.push(emptyLine());

      // 每5个水源地分页
      if ((i + 1) % 5 === 0 && i < filtered.length - 1) {
        children.push(new Paragraph({ children: [], pageBreakBefore: true }));
      }
    }

    // 分页
    children.push(new Paragraph({ children: [], pageBreakBefore: true }));
  } // end calcDetail

  // 第四章 汇总统计
  if (hasChapter('summary')) {
    children.push(heading1('第四章 汇总统计'));
    children.push(emptyLine());

    children.push(heading2('4.1 各市保护区面积统计'));
    const cityAreaMap = new Map<
      string,
      { primary: number; secondary: number; quasi: number; count: number }
    >();
    for (const r of filtered) {
      const src = sourceMap.get(r.sourceId) || sourceNameMap.get(r.sourceName);
      const city = src?.cityName || '未知';
      if (!cityAreaMap.has(city))
        cityAreaMap.set(city, { primary: 0, secondary: 0, quasi: 0, count: 0 });
      const entry = cityAreaMap.get(city)!;
      entry.count++;
      const z1 = r.zones.find((z) => z.level === '一级');
      const z2 = r.zones.find((z) => z.level === '二级');
      const zq = r.zones.find((z) => z.level === '准保护区');
      if (z1) entry.primary += z1.area;
      if (z2) entry.secondary += z2.area;
      if (zq) entry.quasi += zq.area;
    }

    const cityAreaHeaders = [
      '城市',
      '水源地数量',
      '一级面积(km²)',
      '二级面积(km²)',
      '准保护区(km²)',
      '合计面积(km²)',
    ];
    const cityAreaRows = Array.from(cityAreaMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'zh'))
      .map(([city, data]) => [
        city,
        String(data.count),
        data.primary.toFixed(2),
        data.secondary.toFixed(2),
        data.quasi.toFixed(2),
        (data.primary + data.secondary + data.quasi).toFixed(2),
      ]);

    // 合计行
    const totalPrimary = Array.from(cityAreaMap.values()).reduce((s, d) => s + d.primary, 0);
    const totalSecondary = Array.from(cityAreaMap.values()).reduce((s, d) => s + d.secondary, 0);
    const totalQuasi = Array.from(cityAreaMap.values()).reduce((s, d) => s + d.quasi, 0);
    cityAreaRows.push([
      '合  计',
      String(filtered.length),
      totalPrimary.toFixed(2),
      totalSecondary.toFixed(2),
      totalQuasi.toFixed(2),
      (totalPrimary + totalSecondary + totalQuasi).toFixed(2),
    ]);

    children.push(makeTable(cityAreaHeaders, cityAreaRows, [1400, 1100, 1600, 1600, 1600, 1600]));
    children.push(emptyLine());

    children.push(heading2('4.2 计算方法统计'));
    const methodHeaders = ['计算方法', '水源地数量', '占比'];
    const methodRows = [
      [
        '经验值法',
        String(empiricalCount),
        `${((empiricalCount / filtered.length) * 100).toFixed(1)}%`,
      ],
      [
        '解析法',
        String(analyticalCount),
        `${((analyticalCount / filtered.length) * 100).toFixed(1)}%`,
      ],
      ['合  计', String(filtered.length), '100%'],
    ];
    children.push(makeTable(methodHeaders, methodRows, [2000, 1500, 1500]));
    children.push(emptyLine());
  } // end summary

  // ===== 生成文件 =====
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const dateStr = new Date().toISOString().slice(0, 10);
  saveAs(blob, `${cityLabel}水源地保护区划分报告_${dateStr}.docx`);
}
