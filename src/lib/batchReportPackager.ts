/**
 * E2: 批量报告生成增强
 *
 * 功能：
 * 1. 按城市分组生成 Word/PDF 报告
 * 2. 打包为 ZIP 下载（避免浏览器多文件下载混乱）
 * 3. 生成总汇总报告
 * 4. 支持模板/章节配置
 * 5. 进度回调（双维度：城市进度 + 文件类型进度）
 */

// F3: JSZip 改为动态导入
import { saveAs } from 'file-saver';
import {
  Packer,
  Document,
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
import type { ZoneCalcRecord, WaterSourceRecord } from '@/stores/waterSourceStore';
import { generateZoneReport, type ReportConfig, type ReportChapter } from './zoneReportGenerator';
import { generatePdfReport } from './reportPdfExporter';

// ===== 类型定义 =====

export type BatchFormat = 'word' | 'pdf' | 'both';

export interface BatchReportOptions extends ReportConfig {
  /** 输出格式 */
  format?: BatchFormat;
  /** 是否打包为ZIP */
  zipOutput?: boolean;
  /** 是否包含总汇总报告 */
  includeSummary?: boolean;
  /** 指定城市列表（空=全部） */
  cityNames?: string[];
  /** 进度回调 */
  onProgress?: (progress: BatchProgress) => void;
}

export interface BatchProgress {
  /** 当前步骤 */
  currentStep: number;
  /** 总步骤数 */
  totalSteps: number;
  /** 当前城市名 */
  cityName: string;
  /** 当前操作描述 */
  action: string;
  /** 百分比 0-100 */
  percent: number;
}

// ===== 核心函数 =====

/**
 * 按城市分组计算结果
 */
export function groupByCity(
  results: ZoneCalcRecord[],
  sources: WaterSourceRecord[],
): Map<string, ZoneCalcRecord[]> {
  const sourceMap = new Map<string, WaterSourceRecord>();
  const sourceNameMap = new Map<string, WaterSourceRecord>();
  for (const s of sources) {
    sourceMap.set(s.id, s);
    if (!sourceNameMap.has(s.name)) sourceNameMap.set(s.name, s);
  }

  const cityGroups = new Map<string, ZoneCalcRecord[]>();
  for (const r of results) {
    const src = sourceMap.get(r.sourceId) || sourceNameMap.get(r.sourceName);
    const city = src?.cityName || '未知';
    if (!cityGroups.has(city)) cityGroups.set(city, []);
    cityGroups.get(city)!.push(r);
  }

  // 按城市名排序
  return new Map(
    Array.from(cityGroups.entries()).sort((a, b) => a[0].localeCompare(b[0], 'zh')),
  );
}

/**
 * 生成总汇总报告（Word格式）
 */
async function generateSummaryReport(
  results: ZoneCalcRecord[],
  sources: WaterSourceRecord[],
  cityGroups: Map<string, ZoneCalcRecord[]>,
): Promise<Blob> {
  const sourceMap = new Map<string, WaterSourceRecord>();
  const sourceNameMap = new Map<string, WaterSourceRecord>();
  for (const s of sources) {
    sourceMap.set(s.id, s);
    if (!sourceNameMap.has(s.name)) sourceNameMap.set(s.name, s);
  }

  const children: (Paragraph | Table)[] = [];

  // 标题
  children.push(
    new Paragraph({
      children: [new TextRun({ text: '河北省饮用水水源保护区划分汇总报告', bold: true, size: 44, font: 'SimHei' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
  );
  children.push(
    new Paragraph({
      children: [new TextRun({ text: `生成日期：${new Date().toLocaleDateString('zh-CN')}`, size: 28, font: 'SimSun', color: '666666' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
  );

  // 概述
  children.push(
    new Paragraph({
      children: [new TextRun({ text: '一、概述', bold: true, size: 32, font: 'SimHei' })],
      spacing: { before: 300, after: 200 },
    }),
  );
  const gwCount = results.filter((r) => r.params.sourceType === '地下水').length;
  const swCount = results.filter((r) => r.params.sourceType === '地表水').length;
  children.push(
    new Paragraph({
      children: [new TextRun({ text: `本报告汇总河北省${results.length}个集中式饮用水水源地保护区划分结果，其中地下水水源地${gwCount}个，地表水水源地${swCount}个，涉及${cityGroups.size}个地级市。`, size: 21, font: 'SimSun' })],
      spacing: { after: 80, line: 360 },
    }),
  );

  // 各市统计表
  children.push(
    new Paragraph({
      children: [new TextRun({ text: '二、各市保护区面积统计', bold: true, size: 32, font: 'SimHei' })],
      spacing: { before: 300, after: 200 },
    }),
  );

  const thinBorder = {
    top: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
    left: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
    right: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
  };

  const headers = ['城市', '水源地数量', '一级面积(km²)', '二级面积(km²)', '准保护区(km²)', '合计(km²)'];
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h) =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18, font: 'SimHei' })], alignment: AlignmentType.CENTER })],
        shading: { type: ShadingType.CLEAR, fill: 'F0F0F0' },
        borders: thinBorder,
        verticalAlign: VerticalAlign.CENTER,
      }),
    ),
  });

  let totalPrimary = 0, totalSecondary = 0, totalQuasi = 0, totalCount = 0;
  const dataRows: TableRow[] = [];

  for (const [city, cityResults] of cityGroups) {
    let primary = 0, secondary = 0, quasi = 0;
    for (const r of cityResults) {
      const z1 = r.zones.find((z) => z.level === '一级');
      const z2 = r.zones.find((z) => z.level === '二级');
      const zq = r.zones.find((z) => z.level === '准保护区');
      if (z1) primary += z1.area;
      if (z2) secondary += z2.area;
      if (zq) quasi += zq.area;
    }
    totalPrimary += primary;
    totalSecondary += secondary;
    totalQuasi += quasi;
    totalCount += cityResults.length;

    const cells = [city, String(cityResults.length), primary.toFixed(2), secondary.toFixed(2), quasi.toFixed(2), (primary + secondary + quasi).toFixed(2)];
    dataRows.push(
      new TableRow({
        children: cells.map((c, i) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: c, size: 18, font: 'SimSun' })], alignment: i > 0 ? AlignmentType.CENTER : undefined })],
            borders: thinBorder,
            verticalAlign: VerticalAlign.CENTER,
          }),
        ),
      }),
    );
  }

  // 合计行
  dataRows.push(
    new TableRow({
      children: ['合  计', String(totalCount), totalPrimary.toFixed(2), totalSecondary.toFixed(2), totalQuasi.toFixed(2), (totalPrimary + totalSecondary + totalQuasi).toFixed(2)].map((c, i) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: c, bold: true, size: 18, font: 'SimHei' })], alignment: i > 0 ? AlignmentType.CENTER : undefined })],
          shading: { type: ShadingType.CLEAR, fill: 'F0F0F0' },
          borders: thinBorder,
          verticalAlign: VerticalAlign.CENTER,
        }),
      ),
    }),
  );

  children.push(
    new Table({
      rows: [headerRow, ...dataRows],
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
    }),
  );

  // 计算方法统计
  children.push(
    new Paragraph({
      children: [new TextRun({ text: '三、计算方法统计', bold: true, size: 32, font: 'SimHei' })],
      spacing: { before: 300, after: 200 },
    }),
  );
  const empiricalCount = results.filter((r) => r.zones.some((z) => z.method === '经验值法')).length;
  const analyticalCount = results.filter((r) => r.zones.some((z) => z.method === '解析法')).length;
  const methodText = `经验值法：${empiricalCount}个（${((empiricalCount / results.length) * 100).toFixed(1)}%）；解析法：${analyticalCount}个（${((analyticalCount / results.length) * 100).toFixed(1)}%）。`;
  children.push(
    new Paragraph({
      children: [new TextRun({ text: methodText, size: 21, font: 'SimSun' })],
      spacing: { after: 80, line: 360 },
    }),
  );

  // 分城市清单
  children.push(
    new Paragraph({
      children: [new TextRun({ text: '四、分城市水源地清单', bold: true, size: 32, font: 'SimHei' })],
      spacing: { before: 300, after: 200 },
    }),
  );

  for (const [city, cityResults] of cityGroups) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `${city}（${cityResults.length}个）`, bold: true, size: 24, font: 'SimHei' })],
        spacing: { before: 150, after: 80 },
      }),
    );
    const names = cityResults.map((r, i) => `${i + 1}. ${r.sourceName}（${r.params.sourceType}）`).join('；');
    children.push(
      new Paragraph({
        children: [new TextRun({ text: names, size: 21, font: 'SimSun' })],
        spacing: { after: 80, line: 360 },
      }),
    );
  }

  const doc = new Document({
    sections: [{ properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } }, children }],
  });
  return await Packer.toBlob(doc);
}

/**
 * 生成 PDF Blob（通过 reportPdfExporter 的 jsPDF）
 */
async function generatePdfBlob(
  results: ZoneCalcRecord[],
  sources: WaterSourceRecord[],
  config: ReportConfig,
): Promise<Blob> {
  // 使用动态导入避免循环依赖
  const { jsPDF } = await import('jspdf');

  const { cityNames = [] } = config;
  const sourceMap = new Map<string, WaterSourceRecord>();
  const sourceNameMap = new Map<string, WaterSourceRecord>();
  for (const s of sources) {
    sourceMap.set(s.id, s);
    if (!sourceNameMap.has(s.name)) sourceNameMap.set(s.name, s);
  }

  let filtered = results;
  if (cityNames.length > 0) {
    const citySet = new Set(cityNames);
    filtered = results.filter((r) => {
      const src = sourceMap.get(r.sourceId) || sourceNameMap.get(r.sourceName);
      return src && citySet.has(src.cityName);
    });
  }

  if (filtered.length === 0) return new Blob([], { type: 'application/pdf' });

  const cityLabel = cityNames.length > 0 ? cityNames.join('、') : '河北省';
  const reportTitle = config.title || `${cityLabel}饮用水水源保护区划分技术报告`;

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(reportTitle, 15, 30);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${new Date().toLocaleDateString('zh-CN')}`, 15, 40);
  doc.text('Standard: HJ 338-2018', 15, 45);

  // 简化表格
  doc.addPage();
  doc.setFontSize(14);
  doc.text('Protection Zone Summary', 15, 20);
  doc.setFontSize(8);

  let y = 30;
  filtered.forEach((r, i) => {
    const z1 = r.zones.find((z) => z.level === '一级');
    const z2 = r.zones.find((z) => z.level === '二级');
    doc.text(`${i + 1}. ${r.sourceName} - 一级:${z1?.area?.toFixed(2) || '-'} 二级:${z2?.area?.toFixed(2) || '-'}`, 15, y);
    y += 5;
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
  });

  return doc.output('blob');
}

/**
 * E2: 批量报告生成主函数
 *
 * 按城市分组生成 Word/PDF 报告，可选打包为 ZIP
 */
export async function generateBatchReportsV2(
  results: ZoneCalcRecord[],
  sources: WaterSourceRecord[],
  options: BatchReportOptions = {},
): Promise<void> {
  const {
    format = 'word',
    zipOutput = true,
    includeSummary = true,
    onProgress,
  } = options;

  // 按城市分组
  const cityGroups = groupByCity(results, sources);

  // 筛选指定城市
  let targetCities = Array.from(cityGroups.keys());
  if (options.cityNames && options.cityNames.length > 0) {
    const citySet = new Set(options.cityNames);
    targetCities = targetCities.filter((c) => citySet.has(c));
  }

  if (targetCities.length === 0) {
    alert('没有匹配的城市数据');
    return;
  }

  // 计算总步骤数
  const stepsPerCity = format === 'both' ? 2 : 1;
  const totalSteps = targetCities.length * stepsPerCity + (includeSummary ? 1 : 0);
  let currentStep = 0;

  const reportProgress = (cityName: string, action: string) => {
    currentStep++;
    onProgress?.({
      currentStep,
      totalSteps,
      cityName,
      action,
      percent: Math.round((currentStep / totalSteps) * 100),
    });
  };

  if (!zipOutput) {
    // 非ZIP模式：逐个下载
    for (const city of targetCities) {
      const cityResults = cityGroups.get(city)!;
      if (format === 'word' || format === 'both') {
        reportProgress(city, '生成Word报告');
        await generateZoneReport(cityResults, sources, {
          ...options,
          cityNames: [city],
          title: `${city}饮用水水源保护区划分技术报告`,
        });
      }
      if (format === 'pdf' || format === 'both') {
        reportProgress(city, '生成PDF报告');
        await generatePdfReport(cityResults, sources, {
          ...options,
          cityNames: [city],
          title: `${city}饮用水水源保护区划分技术报告`,
        });
      }
      // 间隔避免下载冲突
      await new Promise((r) => setTimeout(r, 200));
    }
    if (includeSummary) {
      reportProgress('全省', '生成汇总报告');
      const summaryBlob = await generateSummaryReport(results, sources, cityGroups);
      const dateStr = new Date().toISOString().slice(0, 10);
      saveAs(summaryBlob, `河北省水源地保护区划分汇总报告_${dateStr}.docx`);
    }
    return;
  }

  // ZIP 模式：生成所有文件打包
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const dateStr = new Date().toISOString().slice(0, 10);
  const folderName = `水源地保护区报告_${dateStr}`;
  const folder = zip.folder(folderName)!;

  for (const city of targetCities) {
    const cityResults = cityGroups.get(city)!;
    const safeCityName = city.replace(/[\\/:*?"<>|]/g, '_');

    if (format === 'word' || format === 'both') {
      reportProgress(city, '生成Word报告');
      // 生成 Word Blob
      const wordBlob = await generateWordBlob(cityResults, sources, {
        ...options,
        cityNames: [city],
        title: `${city}饮用水水源保护区划分技术报告`,
      });
      folder.file(`${safeCityName}_保护区划分报告.docx`, wordBlob);
    }

    if (format === 'pdf' || format === 'both') {
      reportProgress(city, '生成PDF报告');
      const pdfBlob = await generatePdfBlob(cityResults, sources, {
        ...options,
        cityNames: [city],
        title: `${city}饮用水水源保护区划分技术报告`,
      });
      folder.file(`${safeCityName}_保护区划分报告.pdf`, pdfBlob);
    }
  }

  // 汇总报告
  if (includeSummary) {
    reportProgress('全省', '生成汇总报告');
    const summaryBlob = await generateSummaryReport(results, sources, cityGroups);
    folder.file(`汇总报告.docx`, summaryBlob);
  }

  // 生成 ZIP 并下载
  onProgress?.({
    currentStep: totalSteps,
    totalSteps,
    cityName: '',
    action: '打包ZIP文件',
    percent: 100,
  });

  const zipBlob = await zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (meta) => {
      onProgress?.({
        currentStep: totalSteps,
        totalSteps,
        cityName: '',
        action: `压缩中 ${meta.percent.toFixed(0)}%`,
        percent: 100,
      });
    },
  );

  saveAs(zipBlob, `${folderName}.zip`);
}

/**
 * 生成 Word Blob（不触发下载）
 */
async function generateWordBlob(
  results: ZoneCalcRecord[],
  sources: WaterSourceRecord[],
  config: ReportConfig,
): Promise<Blob> {
  // 调用 generateZoneReport 的 returnBlob 模式
  return await generateZoneReport(results, sources, config, true) as unknown as Blob;
}
