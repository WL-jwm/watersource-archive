/**
 * 保护区计算结果 Excel 导出器
 *
 * 功能：将IDB中保存的保护区计算结果导出为Excel文件（.xlsx）
 * 多Sheet结构：
 *   Sheet1 - 汇总表：每个水源地一行
 *   Sheet2 - 一级保护区明细
 *   Sheet3 - 二级保护区明细
 *   Sheet4 - 拐点坐标
 */

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import type { ZoneCalcRecord } from '@/stores/waterSourceStore';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';
import { generateBatchVertices, toExcelRows } from './zoneCoordGenerator';

// ===== Excel导出选项 =====

export interface ExcelExportOptions {
  /** 指定城市筛选，空=全部 */
  cityNames?: string[];
  /** 是否包含拐点坐标sheet */
  includeVertices?: boolean;
  /** 每圈拐点数量 */
  vertexCount?: number;
}

// ===== Sheet列定义 =====

const SUMMARY_COLS = [
  { header: '水源地名称', key: 'sourceName', width: 30 },
  { header: '城市', key: 'cityName', width: 12 },
  { header: '县区', key: 'county', width: 14 },
  { header: '级别', key: 'level', width: 10 },
  { header: '水源类型', key: 'sourceType', width: 10 },
  { header: '地下水类型', key: 'gwType', width: 12 },
  { header: '一级面积(km²)', key: 'primaryArea', width: 14 },
  { header: '一级半径(m)', key: 'primaryRadius', width: 14 },
  { header: '二级面积(km²)', key: 'secondaryArea', width: 14 },
  { header: '二级半径(m)', key: 'secondaryRadius', width: 14 },
  { header: '计算方法', key: 'method', width: 10 },
  { header: '计算时间', key: 'calculatedAt', width: 18 },
];

const DETAIL_COLS = [
  { header: '水源地名称', key: 'sourceName', width: 30 },
  { header: '城市', key: 'cityName', width: 12 },
  { header: '保护区级别', key: 'level', width: 12 },
  { header: '面积(km²)', key: 'area', width: 12 },
  { header: '半径/长度(m)', key: 'radiusOrLength', width: 14 },
  { header: '宽度(m)', key: 'width', width: 10 },
  { header: '计算方法', key: 'method', width: 10 },
  { header: '公式', key: 'formula', width: 50 },
  { header: '边界描述', key: 'boundaryDescription', width: 50 },
  { header: '关键参数', key: 'keyParams', width: 40 },
  { header: '规范依据', key: 'standard', width: 20 },
];

const VERTEX_COLS = [
  { header: '水源地名称', key: 'sourceName', width: 30 },
  { header: '城市', key: 'city', width: 12 },
  { header: '保护区级别', key: 'level', width: 12 },
  { header: '计算方法', key: 'method', width: 10 },
  { header: '拐点编号', key: 'vertexId', width: 8 },
  { header: '东经', key: 'lng', width: 16 },
  { header: '北纬', key: 'lat', width: 14 },
  { header: '方位角(°)', key: 'azimuth', width: 10 },
  { header: '半径(m)', key: 'radiusM', width: 12 },
  { header: '面积(km²)', key: 'areaKm2', width: 12 },
];

// ===== 核心：生成Excel =====

export function exportZoneExcel(
  results: ZoneCalcRecord[],
  sources: WaterSourceRecord[],
  options: ExcelExportOptions = {},
): void {
  const { cityNames = [], includeVertices = true, vertexCount = 24 } = options;

  // 建立 sourceId → 水源地信息 的映射
  const sourceMap = new Map<string, WaterSourceRecord>();
  for (const s of sources) {
    sourceMap.set(s.id, s);
    // 也按sourceName建立映射（兼容无sourceId的情况）
  }
  const sourceNameMap = new Map<string, WaterSourceRecord>();
  for (const s of sources) {
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
    alert('没有可导出的计算结果');
    return;
  }

  const wb = XLSX.utils.book_new();

  // ===== Sheet 1: 汇总表 =====
  const summaryRows = filtered.map((r) => {
    const src = sourceMap.get(r.sourceId) || sourceNameMap.get(r.sourceName);
    const z1 = r.zones.find((z) => z.level === '一级');
    const z2 = r.zones.find((z) => z.level === '二级');
    return {
      sourceName: r.sourceName,
      cityName: src?.cityName || '',
      county: src?.county || '',
      level:
        src?.level === 'municipal'
          ? '市级'
          : src?.level === 'county'
            ? '县级'
            : src?.level === 'township'
              ? '乡镇级'
              : '',
      sourceType: r.params.sourceType,
      gwType: r.params.gwType || r.params.swType || '',
      primaryArea: z1?.area ?? '',
      primaryRadius: z1?.radius ?? '',
      secondaryArea: z2?.area ?? '',
      secondaryRadius: z2?.radius ?? '',
      method: z1?.method || '',
      calculatedAt: r.calculatedAt ? new Date(r.calculatedAt).toLocaleString('zh-CN') : '',
    };
  });

  // 计算合计行
  const totalPrimaryArea = summaryRows.reduce((sum, r) => sum + (Number(r.primaryArea) || 0), 0);
  const totalSecondaryArea = summaryRows.reduce(
    (sum, r) => sum + (Number(r.secondaryArea) || 0),
    0,
  );
  summaryRows.push({
    sourceName: '合  计',
    cityName: `${filtered.length}个水源地`,
    county: '',
    level: '',
    sourceType: '' as '地表水' | '地下水',
    gwType: '',
    primaryArea: Math.round(totalPrimaryArea * 100) / 100,
    primaryRadius: '',
    secondaryArea: Math.round(totalSecondaryArea * 100) / 100,
    secondaryRadius: '',
    method: '',
    calculatedAt: '',
  });

  const ws1 = XLSX.utils.json_to_sheet(summaryRows);
  // 设置列宽
  ws1['!cols'] = SUMMARY_COLS.map((c) => ({ wch: c.width }));
  XLSX.utils.book_append_sheet(wb, ws1, '汇总表');

  // ===== Sheet 2: 一级保护区明细 =====
  const primaryRows: Record<string, any>[] = [];
  for (const r of filtered) {
    const src = sourceMap.get(r.sourceId) || sourceNameMap.get(r.sourceName);
    const z1 = r.zones.find((z) => z.level === '一级');
    if (z1) {
      primaryRows.push({
        sourceName: r.sourceName,
        cityName: src?.cityName || '',
        level: z1.level,
        area: z1.area,
        radiusOrLength: z1.radius || z1.length || '',
        width: z1.width || '',
        method: z1.method,
        formula: z1.formula,
        boundaryDescription: z1.boundaryDescription,
        keyParams: z1.keyParams,
        standard: z1.standard,
      });
    }
  }
  const ws2 = XLSX.utils.json_to_sheet(primaryRows);
  ws2['!cols'] = DETAIL_COLS.map((c) => ({ wch: c.width }));
  XLSX.utils.book_append_sheet(wb, ws2, '一级保护区');

  // ===== Sheet 3: 二级保护区明细 =====
  const secondaryRows: Record<string, any>[] = [];
  for (const r of filtered) {
    const src = sourceMap.get(r.sourceId) || sourceNameMap.get(r.sourceName);
    const z2 = r.zones.find((z) => z.level === '二级');
    if (z2) {
      secondaryRows.push({
        sourceName: r.sourceName,
        cityName: src?.cityName || '',
        level: z2.level,
        area: z2.area,
        radiusOrLength: z2.radius || z2.length || '',
        width: z2.width || '',
        method: z2.method,
        formula: z2.formula,
        boundaryDescription: z2.boundaryDescription,
        keyParams: z2.keyParams,
        standard: z2.standard,
      });
    }
  }
  const ws3 = XLSX.utils.json_to_sheet(secondaryRows);
  ws3['!cols'] = DETAIL_COLS.map((c) => ({ wch: c.width }));
  XLSX.utils.book_append_sheet(wb, ws3, '二级保护区');

  // ===== Sheet 4: 拐点坐标 =====
  if (includeVertices) {
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
      .filter(Boolean) as Array<{
      sourceId: string;
      sourceName: string;
      lng: number;
      lat: number;
      zones: any[];
    }>;

    const vertexSource = generateBatchVertices(batchItems, vertexCount);
    const vertexRows = toExcelRows(vertexSource);

    // 补充城市信息
    for (const row of vertexRows) {
      const src = sourceNameMap.get(row.sourceName);
      if (src) row.city = src.cityName;
    }

    const ws4 = XLSX.utils.json_to_sheet(vertexRows);
    ws4['!cols'] = VERTEX_COLS.map((c) => ({ wch: c.width }));
    XLSX.utils.book_append_sheet(wb, ws4, '拐点坐标');
  }

  // 导出文件
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const dateStr = new Date().toISOString().slice(0, 10);
  saveAs(blob, `河北省水源地保护区划分结果_${dateStr}.xlsx`);
}
