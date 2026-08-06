/* ===== S13.5: 空间分析报告批量导出 =====
 * 批量生成多个空间分析报告的 docx/PDF，打包为 ZIP 下载。
 * 复用 batchReportPackager 的 ZIP 打包模式。
 */

import type { SpatialReport } from './spatialAnalysisReportEngine';

export interface BatchSpatialExportOptions {
  /** 报告列表 */
  reports: SpatialReport[];
  /** ZIP 文件名前缀 */
  zipName?: string;
  /** 进度回调 */
  onProgress?: (current: number, total: number) => void;
}

/**
 * 批量导出空间分析报告为 ZIP（docx 格式）
 * 逐个生成后打包下载
 */
export async function batchExportSpatialReports(
  options: BatchSpatialExportOptions,
): Promise<void> {
  const { reports, zipName = '空间分析报告集', onProgress } = options;
  const { default: JSZip } = await import('jszip');
  const { Packer, Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, AlignmentType, ShadingType } = await import('docx');

  const zip = new JSZip();
  const dateStr = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < reports.length; i++) {
    const report = reports[i];
    onProgress?.(i + 1, reports.length);

    // 构建 docx 内容（简化版 - 复用 downloadDocxReport 的逻辑但导出为 Blob）
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
    zip.file(`${safeName}_空间分析报告.docx`, blob);
  }

  // 打包下载
  const { saveAs } = await import('file-saver');
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  saveAs(zipBlob, `${zipName}_${dateStr}.zip`);
}

/**
 * 从历史记录批量导出为 ZIP
 */
export async function batchExportFromRecords(
  reports: SpatialReport[],
  onProgress?: (current: number, total: number) => void,
): Promise<void> {
  if (reports.length === 0) {
    const { toast } = await import('@/stores/toastStore');
    toast.warning('没有可导出的报告');
    return;
  }

  await batchExportSpatialReports({
    reports,
    zipName: `${reports.length}份空间分析报告`,
    onProgress,
  });
}