/**
 * B1-T3: PDF 报告导出器
 *
 * 使用 jsPDF 生成简化排版的 PDF 报告
 * 适用于仅需结果表格、不需要复杂排版的场景
 */

// F3: jsPDF 改为动态导入，减小首屏体积
import { saveAs } from 'file-saver';
import type { ZoneCalcRecord, WaterSourceRecord } from '@/stores/waterSourceStore';
import type { ReportConfig } from './zoneReportGenerator';

// ===== 辅助函数 =====

const PAGE_W = 210; // A4 宽度 mm
const PAGE_H = 297; // A4 高度 mm
const MARGIN = 15; // 页边距 mm
const CONTENT_W = PAGE_W - MARGIN * 2; // 内容宽度

/** 自动换行文本 */
function addWrappedText(
  doc: import('jspdf').jsPDF,
  text: string,
  x: number,
  y: number,
  maxW: number,
  fontSize: number = 10,
  lineH: number = 5,
): number {
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(text, maxW);
  let curY = y;
  for (const line of lines) {
    if (curY > PAGE_H - MARGIN) {
      doc.addPage();
      curY = MARGIN;
    }
    doc.text(line, x, curY);
    curY += lineH;
  }
  return curY;
}

/** 绘制表格 */
function addTable(
  doc: import('jspdf').jsPDF,
  headers: string[],
  rows: string[][],
  colWidths: number[],
  y: number,
): number {
  const rowH = 6;
  const headerH = 7;
  let curY = y;

  // 检查是否需要换页
  if (curY + headerH > PAGE_H - MARGIN) {
    doc.addPage();
    curY = MARGIN;
  }

  // 表头
  doc.setFontSize(8);
  doc.setFillColor(240, 240, 240);
  let x = MARGIN;
  for (let i = 0; i < headers.length; i++) {
    doc.rect(x, curY, colWidths[i], headerH, 'F');
    doc.setTextColor(50, 50, 50);
    doc.text(headers[i], x + 1, curY + 5);
    x += colWidths[i];
  }
  curY += headerH;

  // 数据行
  doc.setTextColor(30, 30, 30);
  for (const row of rows) {
    if (curY + rowH > PAGE_H - MARGIN) {
      doc.addPage();
      curY = MARGIN;
    }
    x = MARGIN;
    for (let i = 0; i < row.length; i++) {
      doc.text(row[i], x + 1, curY + 4);
      x += colWidths[i];
    }
    curY += rowH;
  }

  return curY + 3;
}

// ===== 主函数 =====

export async function generatePdfReport(
  results: ZoneCalcRecord[],
  sources: WaterSourceRecord[],
  config: ReportConfig = {},
): Promise<void> {
  const { cityNames = [] } = config;

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

  const cityLabel = cityNames.length > 0 ? cityNames.join('、') : '河北省';
  const reportTitle = config.title || `${cityLabel}饮用水水源保护区划分技术报告`;

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  // 封面
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  addWrappedText(doc, reportTitle, MARGIN, 60, CONTENT_W, 18, 10);

  if (config.reportNumber) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Report No.: ${config.reportNumber}`, MARGIN, 80);
  }

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  addWrappedText(
    doc,
    `Date: ${new Date().toLocaleDateString('zh-CN')}`,
    MARGIN,
    85,
    CONTENT_W,
    10,
    5,
  );
  addWrappedText(doc, `Standard: HJ 338-2018`, MARGIN, 90, CONTENT_W, 10, 5);

  if (config.compileUnit) {
    addWrappedText(doc, `Compiled by: ${config.compileUnit}`, MARGIN, 100, CONTENT_W, 10, 5);
  }
  if (config.entrustUnit) {
    addWrappedText(doc, `Entrusted by: ${config.entrustUnit}`, MARGIN, 105, CONTENT_W, 10, 5);
  }

  // 第二页：水源地清单
  doc.addPage();
  let y = MARGIN;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  y = addWrappedText(doc, 'Water Source List', MARGIN, y, CONTENT_W, 14, 8) + 3;

  const listHeaders = ['#', 'Name', 'City', 'Type', 'SubType', 'Status'];
  const listColW = [10, 60, 30, 25, 30, 25];
  const listRows = filtered.map((r, i) => {
    const src = sourceMap.get(r.sourceId) || sourceNameMap.get(r.sourceName);
    return [
      String(i + 1),
      r.sourceName,
      src?.cityName || '',
      r.params.sourceType,
      r.params.gwType || r.params.swType || '',
      src?.status || 'active',
    ];
  });
  y = addTable(doc, listHeaders, listRows, listColW, y);

  // 第三页：保护区计算结果汇总
  doc.addPage();
  y = MARGIN;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  y = addWrappedText(doc, 'Protection Zone Summary', MARGIN, y, CONTENT_W, 14, 8) + 3;

  const zoneHeaders = [
    '#',
    'Source',
    'Type',
    'Primary(km2)',
    'Secondary(km2)',
    'Quasi(km2)',
    'Method',
  ];
  const zoneColW = [10, 45, 20, 25, 25, 20, 25];
  const zoneRows = filtered.map((r, i) => {
    const z1 = r.zones.find((z) => z.level === '一级');
    const z2 = r.zones.find((z) => z.level === '二级');
    const zq = r.zones.find((z) => z.level === '准保护区');
    return [
      String(i + 1),
      r.sourceName,
      r.params.sourceType === '地下水' ? r.params.gwType || '' : r.params.swType || '',
      z1?.area?.toFixed(2) || '-',
      z2?.area?.toFixed(2) || '-',
      zq?.area?.toFixed(2) || '-',
      z1?.method || '-',
    ];
  });
  y = addTable(doc, zoneHeaders, zoneRows, zoneColW, y);

  // 第四页：各市面积统计
  doc.addPage();
  y = MARGIN;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  y = addWrappedText(doc, 'City Area Statistics', MARGIN, y, CONTENT_W, 14, 8) + 3;

  const cityAreaMap = new Map<
    string,
    { primary: number; secondary: number; quasi: number; count: number }
  >();
  for (const r of filtered) {
    const src = sourceMap.get(r.sourceId) || sourceNameMap.get(r.sourceName);
    const city = src?.cityName || 'Unknown';
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

  const cityHeaders = ['City', 'Count', 'Primary', 'Secondary', 'Quasi', 'Total'];
  const cityColW = [35, 20, 25, 25, 25, 25];
  const cityRows = Array.from(cityAreaMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([city, data]) => [
      city,
      String(data.count),
      data.primary.toFixed(2),
      data.secondary.toFixed(2),
      data.quasi.toFixed(2),
      (data.primary + data.secondary + data.quasi).toFixed(2),
    ]);
  y = addTable(doc, cityHeaders, cityRows, cityColW, y);

  // 保存
  const blob = doc.output('blob');
  const dateStr = new Date().toISOString().slice(0, 10);
  saveAs(blob, `${cityLabel}水源地保护区划分报告_${dateStr}.pdf`);
}
