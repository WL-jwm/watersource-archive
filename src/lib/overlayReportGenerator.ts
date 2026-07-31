/**
 * S5.4: 多水源地叠加分析 Word 报告生成器
 *
 * 报告结构：
 *   封面
 *   第一章 分析概述（目的/范围/数据来源）
 *   第二章 各级别叠加分析结果（动态遍历 levels，含明细表）
 *   第三章 两两重叠检测结果（过滤+排序+表格）
 *   第四章 警告信息与分析结论（守恒律校验+自动建议）
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
  BorderStyle,
  TableLayoutType,
  VerticalAlign,
  ShadingType,
} from 'docx';
import { saveAs } from 'file-saver';
import type { OverlayResult, OverlayLevelResult } from './multiSourceOverlayEngine';

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

function bodyText(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 21, font: 'SimSun' })],
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
  const cellOpts: {
    children: Paragraph[];
    shading: { type: typeof ShadingType.CLEAR; fill: string };
    borders: typeof thinBorder;
    verticalAlign: typeof VerticalAlign.CENTER;
    width?: { size: number; type: typeof WidthType.DXA };
  } = {
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
  if (width) cellOpts.width = { size: width, type: WidthType.DXA };
  return new TableCell(cellOpts);
}

function dataCell(
  text: string | number,
  width?: number,
  align?: (typeof AlignmentType)[keyof typeof AlignmentType],
): TableCell {
  const cellOpts: {
    children: Paragraph[];
    borders: typeof thinBorder;
    verticalAlign: typeof VerticalAlign.CENTER;
    width?: { size: number; type: typeof WidthType.DXA };
  } = {
    children: [
      new Paragraph({
        children: [new TextRun({ text: String(text), size: 18, font: 'SimSun' })],
        alignment: align || AlignmentType.LEFT,
      }),
    ],
    borders: thinBorder,
    verticalAlign: VerticalAlign.CENTER,
  };
  if (width) cellOpts.width = { size: width, type: WidthType.DXA };
  return new TableCell(cellOpts);
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

// ===== 核心构建函数 =====

/**
 * 构建报告全部章节内容（纯函数，不含 Document/Packer/saveAs）
 */
function buildOverlayReportChildren(result: OverlayResult): (Paragraph | Table)[] {
  const children: (Paragraph | Table)[] = [];

  // ===== 封面 =====
  children.push(emptyLine());
  children.push(emptyLine());
  children.push(title('多水源地保护区叠加分析报告'));
  children.push(subtitle(result.analysisName));
  children.push(emptyLine());
  children.push(emptyLine());

  const dateStr = new Date(result.createdAt).toLocaleString('zh-CN');
  children.push(
    new Paragraph({
      children: [new TextRun({ text: `分析时间：${dateStr}`, size: 24, font: 'SimSun' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }),
  );
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `涉及水源地：${result.sourceCount} 个`,
          size: 24,
          font: 'SimSun',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }),
  );
  const cityLabel = result.summary.cities.length > 0 ? result.summary.cities.join('、') : '未分类';
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: `涉及城市：${cityLabel}`, size: 24, font: 'SimSun' }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }),
  );
  children.push(emptyLine());
  children.push(emptyLine());
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: '依据：HJ 338-2018《饮用水水源保护区划分技术规范》',
          size: 21,
          font: 'SimSun',
        }),
      ],
      alignment: AlignmentType.CENTER,
    }),
  );
  children.push(new Paragraph({ children: [], pageBreakBefore: true }));

  // ===== 第一章 分析概述 =====
  children.push(heading1('第一章 分析概述'));

  children.push(heading2('1.1 分析目的'));
  children.push(
    bodyText(
      '本报告对多个饮用水水源地保护区进行空间叠加分析，旨在识别跨区域保护区空间重叠情况，评估合并保护范围与独立保护区面积的差异，为区域水源地统筹管理和规划决策提供科学依据。',
    ),
  );
  children.push(emptyLine());

  children.push(heading2('1.2 分析范围'));
  const levelNames = result.levels.map((l) => l.level).join('、');
  children.push(
    bodyText(
      `本次叠加分析共涉及 ${result.sourceCount} 个集中式饮用水水源地，分布在 ${result.summary.cities.length} 个城市（${cityLabel}）。分析保护区级别包括：${levelNames}。`,
    ),
  );
  children.push(emptyLine());

  children.push(heading2('1.3 数据来源'));
  children.push(
    bodyText(
      '保护区边界数据来源于本平台计算生成的保护区划分结果，采用经验值法或解析法（Cooper-Jacob）生成。叠加分析采用 turf.js 空间运算库执行几何合并（Union）和交集（Intersect）计算。',
    ),
  );
  children.push(emptyLine());
  children.push(new Paragraph({ children: [], pageBreakBefore: true }));

  // ===== 第二章 各级别叠加分析结果 =====
  children.push(heading1('第二章 各级别叠加分析结果'));

  if (result.levels.length === 0) {
    children.push(bodyText('本次分析未生成有效级别数据，请检查水源地保护区计算结果。'));
    children.push(emptyLine());
  } else {
    result.levels.forEach((lv: OverlayLevelResult, idx: number) => {
      children.push(heading2(`2.${idx + 1} ${lv.level}保护区`));

      // 文字描述
      children.push(
        bodyText(
          `本次分析中，${lv.level}保护区共有 ${lv.sourceGeometries.length} 个水源地参与叠加。合并后总面积为 ${lv.unionArea.toFixed(4)} km²，各水源地独立面积之和为 ${lv.sumArea.toFixed(4)} km²，重叠面积为 ${lv.overlapArea.toFixed(4)} km²，重叠比例 ${(lv.overlapRatio * 100).toFixed(2)}%。`,
        ),
      );
      children.push(emptyLine());

      // 明细表
      children.push(heading2(`2.${idx + 1}.1 各水源地面积明细`));
      const detailHeaders = ['序号', '水源地名称', '面积（km²）'];
      const detailRows = lv.sourceGeometries.map((sg, i) => [
        String(i + 1),
        sg.sourceName,
        sg.area.toFixed(4),
      ]);
      children.push(makeTable(detailHeaders, detailRows, [1000, 4000, 2000]));
      children.push(emptyLine());

      // 分页（除最后一个级别外）
      if (idx < result.levels.length - 1) {
        children.push(new Paragraph({ children: [], pageBreakBefore: true }));
      }
    });
  }

  children.push(new Paragraph({ children: [], pageBreakBefore: true }));

  // ===== 第三章 两两重叠检测结果 =====
  children.push(heading1('第三章 两两重叠检测结果'));

  children.push(heading2('3.1 检测方法'));
  children.push(
    bodyText(
      `采用 turf.js 空间交集运算对每两个水源地的同级别保护区进行两两检测。本次分析共检测 ${result.summary.totalOverlapPairs} 对水源地组合，其中 ${result.summary.hasOverlapPairs} 对存在空间重叠，最大重叠面积为 ${result.summary.maxOverlapArea.toFixed(4)} km²。`,
    ),
  );
  children.push(
    bodyText(
      '面积守恒校验公式：重叠面积 = 独立面积之和 - 合并面积。若差值小于 0.001 km²，则校验通过。',
    ),
  );
  children.push(emptyLine());

  const overlapPairs = result.overlaps.filter((o) => o.overlapArea > 0);
  const noOverlapPairs = result.overlaps.filter((o) => o.overlapArea === 0);

  if (overlapPairs.length > 0) {
    // 按重叠面积降序排列
    const sorted = [...overlapPairs].sort((a, b) => b.overlapArea - a.overlapArea);

    children.push(heading2('3.2 存在重叠的水源地对'));
    const overlapHeaders = [
      '序号',
      '水源地A',
      '水源地B',
      '级别',
      '重叠面积（km²）',
      '重叠比例',
    ];
    const overlapRows = sorted.map((o, i) => [
      String(i + 1),
      o.sourceAName,
      o.sourceBName,
      o.level,
      o.overlapArea.toFixed(4),
      `${(o.overlapRatio * 100).toFixed(2)}%`,
    ]);
    children.push(makeTable(overlapHeaders, overlapRows, [800, 2000, 2000, 1200, 1500, 1200]));
    children.push(emptyLine());
  } else {
    children.push(heading2('3.2 存在重叠的水源地对'));
    children.push(bodyText('本次分析中，所有水源地保护区均无空间重叠。'));
    children.push(emptyLine());
  }

  if (noOverlapPairs.length > 0) {
    children.push(heading2('3.3 无重叠的水源地对'));
    children.push(
      bodyText(
        `以下 ${noOverlapPairs.length} 对水源地的同级别保护区经检测不存在空间重叠：`,
      ),
    );
    const noOverlapHeaders = ['序号', '水源地A', '水源地B', '级别'];
    const noOverlapRows = noOverlapPairs.map((o, i) => [
      String(i + 1),
      o.sourceAName,
      o.sourceBName,
      o.level,
    ]);
    children.push(makeTable(noOverlapHeaders, noOverlapRows, [800, 2500, 2500, 1200]));
    children.push(emptyLine());
  }

  children.push(new Paragraph({ children: [], pageBreakBefore: true }));

  // ===== 第四章 警告信息与分析结论 =====
  children.push(heading1('第四章 警告信息与分析结论'));

  // 4.1 警告信息
  children.push(heading2('4.1 警告信息'));
  if (result.warnings.length === 0) {
    children.push(bodyText('本次分析过程中未产生任何警告信息，各项数据均通过校验。'));
  } else {
    children.push(
      bodyText(`本次分析过程中共产生 ${result.warnings.length} 条警告信息，详情如下：`),
    );
    children.push(emptyLine());
    result.warnings.forEach((w, i) => {
      children.push(bodyText(`（${i + 1}）${w}`));
    });
  }
  children.push(emptyLine());

  // 4.2 守恒律校验
  children.push(heading2('4.2 面积守恒律校验'));
  children.push(
    bodyText(
      '根据面积守恒律，各水源地独立保护区面积之和减去合并后的总面积应等于重叠面积。校验结果如下：',
    ),
  );
  children.push(emptyLine());

  const checkHeaders = [
    '级别',
    '独立面积之和（km²）',
    '合并面积（km²）',
    '差值（km²）',
    '重叠面积（km²）',
    '校验结果',
  ];
  const checkRows = result.levels.map((lv) => {
    const diff = Math.abs(lv.sumArea - lv.unionArea - lv.overlapArea);
    const passed = diff < 0.001;
    return [
      lv.level,
      lv.sumArea.toFixed(4),
      lv.unionArea.toFixed(4),
      diff.toFixed(6),
      lv.overlapArea.toFixed(4),
      passed ? '通过' : '异常',
    ];
  });
  children.push(makeTable(checkHeaders, checkRows, [1200, 1800, 1500, 1200, 1500, 1000]));
  children.push(emptyLine());

  // 4.3 结论与建议
  children.push(heading2('4.3 结论与建议'));

  const hasOverlap = result.summary.hasOverlapPairs > 0;
  const hasWarnings = result.warnings.length > 0;

  let conclusion = `本次多水源地保护区叠加分析共涉及 ${result.sourceCount} 个水源地，`;
  conclusion += `检测了 ${result.summary.totalOverlapPairs} 对水源地组合，`;
  if (hasOverlap) {
    conclusion += `其中 ${result.summary.hasOverlapPairs} 对存在空间重叠，最大重叠面积 ${result.summary.maxOverlapArea.toFixed(4)} km²。`;
  } else {
    conclusion += '所有水源地保护区之间均不存在空间重叠。';
  }
  children.push(bodyText(conclusion));
  children.push(emptyLine());

  children.push(bodyText('建议：'));
  if (hasOverlap) {
    children.push(
      bodyText(
        '（1）存在重叠区域的水源地应协调跨区域管理，明确重叠区域的管辖权和保护责任；',
      ),
    );
    children.push(
      bodyText(
        '（2）重叠区域内的污染源应作为重点监管对象，由相关行政区联合执法；',
      ),
    );
    children.push(
      bodyText(
        '（3）建议进一步分析重叠区域内的水文地质条件，评估水源地间是否存在水力联系。',
      ),
    );
  } else {
    children.push(
      bodyText('（1）各水源地保护区空间独立，不存在重叠冲突，可分别独立管理；'),
    );
    children.push(
      bodyText('（2）建议定期复测保护区边界，确保空间关系未因开采条件变化而改变。'),
    );
  }
  if (hasWarnings) {
    children.push(
      bodyText(
        `（${hasOverlap ? 4 : 3}）本次分析存在 ${result.warnings.length} 条警告信息，建议复核相关水源地的计算参数和保护区边界。`,
      ),
    );
  }
  children.push(emptyLine());

  return children;
}

// ===== 导出函数 =====

/**
 * 生成多水源地叠加分析 Word 报告并下载
 */
export async function generateOverlayReport(
  result: OverlayResult,
  returnBlob: boolean = false,
): Promise<void | Blob> {
  const children = buildOverlayReportChildren(result);

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
  if (returnBlob) return blob;

  const dateStr = new Date(result.createdAt).toISOString().slice(0, 10);
  const safeName = result.analysisName.replace(/[<>:"/\\|?*]/g, '_');
  saveAs(blob, `${safeName}_叠加分析报告_${dateStr}.docx`);
}

/**
 * 生成报告内容 Blob（不触发下载）
 * 供批量打包使用
 */
export async function generateOverlayReportContent(
  result: OverlayResult,
): Promise<Blob> {
  return (await generateOverlayReport(result, true)) as unknown as Blob;
}
