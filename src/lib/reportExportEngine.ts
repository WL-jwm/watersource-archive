/* ===== S13.4: 报告导出增强引擎 =====
 * 将 SpatialReport 对象导出为 HTML/PDF/docx 格式。
 * HTML 用于浏览器预览，PDF 用于下载，docx 增强调用现有引擎。
 */

import type { SpatialReport, ReportSection } from './spatialAnalysisReportEngine';

// ===== HTML 导出 =====

/**
 * 将空间分析报告转为 HTML 字符串
 */
export function reportToHtml(report: SpatialReport): string {
  const sectionsHtml = report.sections
    .map((s) => buildSectionHtml(s))
    .join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(report.title)}</title>
<style>
  body { font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif; max-width: 900px; margin: 0 auto; padding: 40px 20px; color: #333; line-height: 1.8; }
  h1 { color: #1a1a2e; border-bottom: 3px solid #3b82f6; padding-bottom: 12px; font-size: 22px; }
  h2 { color: #2563eb; margin-top: 28px; font-size: 17px; border-left: 4px solid #3b82f6; padding-left: 10px; }
  .meta { color: #888; font-size: 13px; margin-bottom: 24px; }
  p { font-size: 14px; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
  th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
  th { background: #f0f4ff; font-weight: 600; }
  .conclusion { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin-top: 24px; }
  .conclusion h3 { color: #92400e; font-size: 15px; margin: 0 0 8px 0; }
  .conclusion p { color: #78350f; }
</style>
</head>
<body>
<h1>${escapeHtml(report.title)}</h1>
<div class="meta">
  <p>分析对象：${escapeHtml(report.projectName)}</p>
  <p>生成时间：${new Date(report.createdAt).toLocaleString('zh-CN')}</p>
  <p>章节数：${report.sections.length}</p>
</div>
${sectionsHtml}
<div class="conclusion">
  <h3>综合结论</h3>
  <p>${escapeHtml(report.conclusion)}</p>
</div>
</body>
</html>`;
}

function buildSectionHtml(section: ReportSection): string {
  const paragraphs = section.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n');
  let tableHtml = '';
  if (section.table && section.table.rows.length > 0) {
    const header = section.table.headers
      .map((h) => `<th>${escapeHtml(h)}</th>`)
      .join('');
    const rows = section.table.rows
      .map(
        (r) =>
          `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`,
      )
      .join('');
    tableHtml = `<table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`;
  }

  return `<h2>${escapeHtml(section.heading)}</h2>\n${paragraphs}\n${tableHtml}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ===== 下载辅助 =====

/**
 * 下载 HTML 报告
 */
export function downloadHtmlReport(report: SpatialReport): void {
  const html = reportToHtml(report);
  const blob = new Blob(['\ufeff' + html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${report.projectName}_空间分析报告.html`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 打开新窗口预览 HTML 报告
 */
export function previewHtmlReport(report: SpatialReport): void {
  const html = reportToHtml(report);
  const win = window.open('', '_blank');
  if (!win) {
    // 弹窗被拦截，改用下载
    downloadHtmlReport(report);
    return;
  }
  win.document.write(html);
  win.document.title = report.title;
}

// ===== PDF 导出（调用 jsPDF） =====

/**
 * 使用 jsPDF 生成 PDF 报告
 * 动态导入 jsPDF 以减小首屏体积
 */
export async function downloadPdfReport(report: SpatialReport): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const MARGIN = 15;
  const PAGE_W = 210;
  const PAGE_H = 297;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  let y = MARGIN;

  // 标题
  doc.setFontSize(18);
  doc.setTextColor(26, 26, 46);
  doc.text(report.title, MARGIN, y);
  y += 10;

  // 元数据
  doc.setFontSize(10);
  doc.setTextColor(136, 136, 136);
  doc.text(`分析对象：${report.projectName}`, MARGIN, y);
  y += 5;
  doc.text(`生成时间：${new Date(report.createdAt).toLocaleString('zh-CN')}`, MARGIN, y);
  y += 8;

  // 章节
  for (const section of report.sections) {
    if (y > PAGE_H - MARGIN - 20) {
      doc.addPage();
      y = MARGIN;
    }

    doc.setFontSize(14);
    doc.setTextColor(37, 99, 235);
    doc.text(section.heading, MARGIN, y);
    y += 7;

    doc.setFontSize(10);
    doc.setTextColor(51, 51, 51);
    for (const p of section.paragraphs) {
      const lines = doc.splitTextToSize(p, CONTENT_W);
      for (const line of lines) {
        if (y > PAGE_H - MARGIN - 10) {
          doc.addPage();
          y = MARGIN;
        }
        doc.text(line, MARGIN, y);
        y += 5;
      }
    }

    // 表格
    if (section.table && section.table.rows.length > 0) {
      const colCount = section.table.headers.length;
      const colWidth = CONTENT_W / colCount;

      if (y + 10 > PAGE_H - MARGIN) {
        doc.addPage();
        y = MARGIN;
      }

      // 表头
      doc.setFillColor(240, 244, 255);
      doc.setFontSize(9);
      doc.setTextColor(50, 50, 50);
      let x = MARGIN;
      for (const h of section.table.headers) {
        doc.rect(x, y - 4, colWidth, 7, 'F');
        doc.text(h, x + 1, y);
        x += colWidth;
      }
      y += 7;

      // 数据行
      doc.setTextColor(51, 51, 51);
      for (const row of section.table.rows) {
        if (y + 6 > PAGE_H - MARGIN) {
          doc.addPage();
          y = MARGIN;
        }
        x = MARGIN;
        for (const cell of row) {
          doc.text(cell.substring(0, Math.floor(colWidth / 2.5)), x + 1, y);
          x += colWidth;
        }
        y += 6;
      }
      y += 3;
    }
  }

  // 结论
  if (y + 20 > PAGE_H - MARGIN) {
    doc.addPage();
    y = MARGIN + 30;
  }
  doc.setFillColor(255, 251, 235);
  doc.rect(MARGIN, y - 8, CONTENT_W, 16, 'F');
  doc.setFontSize(11);
  doc.setTextColor(146, 64, 14);
  doc.text('综合结论', MARGIN + 2, y);
  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(120, 53, 15);
  const conclLines = doc.splitTextToSize(report.conclusion, CONTENT_W - 4);
  for (const line of conclLines) {
    if (y > PAGE_H - MARGIN - 5) {
      doc.addPage();
      y = MARGIN;
    }
    doc.text(line, MARGIN + 2, y);
    y += 5;
  }

  doc.save(`${report.projectName}_空间分析报告.pdf`);
}

// ===== docx 导出增强 =====

/**
 * 使用 docx 生成 Word 报告
 * 复用 spatialAnalysisReportEngine 的 buildSpatialReport 数据
 */
export async function downloadDocxReport(report: SpatialReport): Promise<void> {
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, AlignmentType, ShadingType } = await import('docx');
  const { saveAs } = await import('file-saver');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children: any[] = [];

  // 标题
  children.push(
    new Paragraph({
      text: report.title,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
  );

  // 元数据
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: `分析对象：${report.projectName}`, size: 20, color: '888888' }),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `生成时间：${new Date(report.createdAt).toLocaleString('zh-CN')}`, size: 20, color: '888888' }),
      ],
      spacing: { after: 200 },
    }),
  );

  // 章节
  for (const section of report.sections) {
    children.push(
      new Paragraph({
        text: section.heading,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 100 },
      }),
    );

    for (const p of section.paragraphs) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: p, size: 21 })],
          spacing: { after: 60 },
        }),
      );
    }

    if (section.table && section.table.rows.length > 0) {
      const colCount = section.table.headers.length;
      const colWidths = colCount > 0 ? Array(colCount).fill(100 / colCount) : [];

      const tableRows: import('docx').TableRow[] = [];

      // 表头
      tableRows.push(
        new TableRow({
          tableHeader: true,
          children: section.table.headers.map(
            (h) =>
              new TableCell({
                width: { size: colWidths[section.table!.headers.indexOf(h)] || 10, type: WidthType.PERCENTAGE },
                shading: { type: ShadingType.CLEAR, color: 'F0F4FF' },
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: h, bold: true, size: 18 })],
                    alignment: AlignmentType.CENTER,
                  }),
                ],
              }),
          ),
        }),
      );

      // 数据行
      for (const row of section.table.rows) {
        tableRows.push(
          new TableRow({
            children: row.map(
              (cell) =>
                new TableCell({
                  width: { size: colWidths[row.indexOf(cell)] || 10, type: WidthType.PERCENTAGE },
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: cell, size: 18 })],
                    }),
                  ],
                }),
            ),
          }),
        );
      }

      children.push(
        new Table({
          rows: tableRows,
          width: { size: 100, type: WidthType.PERCENTAGE },
        }),
        new Paragraph({ spacing: { after: 200 } }),
      );
    }
  }

  // 结论
  children.push(
    new Paragraph({
      text: '综合结论',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 100 },
    }),
    new Paragraph({
      children: [new TextRun({ text: report.conclusion, size: 21, bold: true })],
      spacing: { after: 200 },
      shading: { type: ShadingType.CLEAR, color: 'FFFBEB' },
    }),
  );

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
  const safeName = report.projectName.replace(/[<>:"/\\|?*]/g, '_');
  saveAs(blob, `${safeName}_空间分析报告.docx`);
}