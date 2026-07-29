/**
 * N1: 拐点坐标表打印组件
 *
 * 功能：
 * 1. 展示所有水源地各级保护区的拐点坐标表
 * 2. 支持三种坐标格式切换（小数度/度分秒/高斯-克吕格）
 * 3. 打印优化（A4 横向、表头重复、分页控制）
 * 4. 打印预览（新窗口渲染后调用打印）
 *
 * 使用 @media print CSS 控制打印布局
 */

import { useToast } from '@/hooks/useToast';
import React, { useState, useMemo } from 'react';
import type { ZoneCalcRecord, WaterSourceRecord } from '@/stores/waterSourceStore';
import { generateSourceZoneVertices } from '@/lib/zoneCoordGenerator';
import {
  formatCoord,
  getCoordHeaders,
  autoCentralMeridian,
  COORD_FORMAT_OPTIONS,
  type CoordFormat,
} from '@/lib/coordTransform';

interface VertexPrintTableProps {
  zoneResults: ZoneCalcRecord[];
  sources: WaterSourceRecord[];
}

// 单条拐点记录
interface VertexRow {
  sourceName: string;
  level: string;
  vertexId: string;
  azimuth: number;
  lng: number;
  lat: number;
}

const VertexPrintTable: React.FC<VertexPrintTableProps> = ({ zoneResults, sources }) => {
  const [format, setFormat] = useState<CoordFormat>('decimal');
  const [previewOpen, setPreviewOpen] = useState(false);

  // 构建拐点数据
  const rows = useMemo<VertexRow[]>(() => {
    const result: VertexRow[] = [];
    for (const zr of zoneResults) {
      const source = sources.find((s) => s.name === zr.sourceName);
      const lng = source?.lng;
      const lat = source?.lat;
      if (lng == null || lat == null) continue;

      const sourceVertices = generateSourceZoneVertices(
        zr.sourceId,
        zr.sourceName,
        lng,
        lat,
        zr.zones,
      );
      for (const zone of sourceVertices.zones) {
        if (!zone.vertices || zone.vertices.length === 0) continue;
        for (const v of zone.vertices) {
          result.push({
            sourceName: zr.sourceName,
            level: zone.level,
            vertexId: v.id,
            azimuth: v.azimuth,
            lng: v.lng,
            lat: v.lat,
          });
        }
      }
    }
    return result;
  }, [zoneResults, sources]);

  // 按水源地+级别分组
  const grouped = useMemo(() => {
    const groups: Record<string, VertexRow[]> = {};
    for (const r of rows) {
      const key = `${r.sourceName}__${r.level}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }
    return Object.entries(groups);
  }, [rows]);

  const headers = getCoordHeaders(format);

  // 打印预览
  const toast = useToast();
  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=1123,height=794');
    if (!printWindow) {
      toast.warning('请允许弹出窗口以进行打印预览');
      return;
    }

    const cm = rows[0] ? autoCentralMeridian(rows[0].lng) : 114;

    const tableHTML = grouped
      .map(([key, groupRows]) => {
        const [sourceName, level] = key.split('__');
        const levelColor = level === '一级' ? '#dc2626' : level === '二级' ? '#ea580c' : '#ca8a04';
        return `
        <table class="vertex-table">
          <thead>
            <tr class="group-header">
              <td colspan="5" style="border-left: 4px solid ${levelColor};">
                <strong>${sourceName}</strong> — ${level}保护区（${groupRows.length}个拐点）
              </td>
            </tr>
            <tr class="col-header">
              <th style="width: 60px;">序号</th>
              <th style="width: 70px;">方位角</th>
              <th>${headers.lngHeader}</th>
              <th>${headers.latHeader}</th>
              <th style="width: 80px;">备注</th>
            </tr>
          </thead>
          <tbody>
            ${groupRows
              .map(
                (r, i) => `
              <tr>
                <td class="center">${i + 1}</td>
                <td class="center">${r.azimuth.toFixed(1)}°</td>
                <td>${formatCoord(r.lng, r.lat, format, cm).lng}</td>
                <td>${formatCoord(r.lng, r.lat, format, cm).lat}</td>
                <td class="center">${r.vertexId}</td>
              </tr>`,
              )
              .join('')}
          </tbody>
        </table>`;
      })
      .join('');

    printWindow.document.write(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>保护区拐点坐标表</title>
<style>
  @page { size: A4 landscape; margin: 15mm 12mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "SimSun", "宋体", serif; font-size: 10pt; color: #333; }
  .print-header {
    text-align: center; margin-bottom: 12px; padding-bottom: 8px;
    border-bottom: 2px solid #333;
  }
  .print-header h1 { font-size: 16pt; font-weight: bold; }
  .print-header .subtitle { font-size: 9pt; color: #666; margin-top: 4px; }
  .print-footer {
    margin-top: 12px; padding-top: 6px; border-top: 1px solid #ccc;
    text-align: center; font-size: 8pt; color: #999;
  }
  .vertex-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  .vertex-table td, .vertex-table th {
    border: 1px solid #999; padding: 3px 6px; font-size: 9pt;
  }
  .group-header td {
    background: #f5f5f5; font-size: 10pt; padding: 4px 8px;
  }
  .col-header th {
    background: #e8e8e8; font-weight: bold; text-align: center;
  }
  .center { text-align: center; }
  .vertex-table tr { page-break-inside: avoid; }
  .vertex-table thead { display: table-header-group; }
  .vertex-table { page-break-after: auto; }
  @media print {
    .no-print { display: none; }
  }
</style>
</head>
<body>
  <div class="print-header">
    <h1>饮用水水源保护区拐点坐标表</h1>
    <div class="subtitle">
      坐标格式：${COORD_FORMAT_OPTIONS.find((o) => o.value === format)?.label || ''}
      ${format === 'gk' ? `（CGCS2000，3°带，中央子午线 ${cm}°）` : '（WGS84/CGCS2000）'}
      | 生成日期：${new Date().toLocaleDateString('zh-CN')}
      | 水源地数：${new Set(rows.map((r) => r.sourceName)).size}
      | 拐点总数：${rows.length}
    </div>
  </div>
  ${tableHTML}
  <div class="print-footer">
    本表依据 HJ 338-2018《饮用水水源保护区划分技术规范》生成 | 河北省水源地保护区档案管理平台
  </div>
  <div class="no-print" style="text-align:center; margin-top:20px;">
    <button onclick="window.print()" style="padding:8px 24px; font-size:12pt; cursor:pointer;">打印</button>
  </div>
</body>
</html>`);
    printWindow.document.close();
    setPreviewOpen(false);
  };

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg p-4 bg-white border border-gray-200 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a1 1 0 001-1v-4a1 1 0 00-1-1H9a1 1 0 00-1 1v4a1 1 0 001 1zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          <h3 className="text-sm font-semibold">拐点坐标表</h3>
          <span className="text-[10px] text-gray-400">
            {new Set(rows.map((r) => r.sourceName)).size}个水源地 · {rows.length}个拐点
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* 坐标格式切换 */}
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as CoordFormat)}
            className="text-xs border border-gray-200 rounded px-2 py-1"
          >
            {COORD_FORMAT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}（{o.description}）
              </option>
            ))}
          </select>
          <button
            onClick={handlePrint}
            className="text-xs px-3 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a1 1 0 001-1v-4a1 1 0 00-1-1H9a1 1 0 00-1 1v4a1 1 0 001 1zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            打印坐标表
          </button>
        </div>
      </div>

      {/* 预览表格 */}
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        {grouped.map(([key, groupRows]) => {
          const [sourceName, level] = key.split('__');
          const levelColor =
            level === '一级' ? 'border-red-400' : level === '二级' ? 'border-orange-400' : 'border-yellow-400';
          const cm = autoCentralMeridian(groupRows[0].lng);
          return (
            <table key={key} className="w-full text-[10px] border-collapse mb-3">
              <thead>
                <tr className={`bg-gray-50 border-l-4 ${levelColor}`}>
                  <th colSpan={5} className="px-3 py-1.5 text-left font-medium text-xs">
                    {sourceName} — {level}保护区（{groupRows.length}个拐点）
                  </th>
                </tr>
                <tr className="bg-gray-100">
                  <th className="border border-gray-200 px-2 py-1 text-center w-12">序号</th>
                  <th className="border border-gray-200 px-2 py-1 text-center w-16">方位角</th>
                  <th className="border border-gray-200 px-2 py-1 text-left">{headers.lngHeader}</th>
                  <th className="border border-gray-200 px-2 py-1 text-left">{headers.latHeader}</th>
                  <th className="border border-gray-200 px-2 py-1 text-center w-16">编号</th>
                </tr>
              </thead>
              <tbody>
                {groupRows.map((r, i) => {
                  const formatted = formatCoord(r.lng, r.lat, format, cm);
                  return (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="border border-gray-200 px-2 py-0.5 text-center">{i + 1}</td>
                      <td className="border border-gray-200 px-2 py-0.5 text-center">{r.azimuth.toFixed(1)}°</td>
                      <td className="border border-gray-200 px-2 py-0.5 font-mono">{formatted.lng}</td>
                      <td className="border border-gray-200 px-2 py-0.5 font-mono">{formatted.lat}</td>
                      <td className="border border-gray-200 px-2 py-0.5 text-center text-gray-400">{r.vertexId}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          );
        })}
      </div>

      {format === 'gk' && (
        <div className="text-[10px] text-amber-600 bg-amber-50 rounded p-2">
          提示：高斯-克吕格投影使用 CGCS2000 椭球参数，3°带。河北省中央子午线为 114°/117°/120°，
          系统根据水源地经度自动选择。如需手动指定，请在打印预览中确认。
        </div>
      )}
    </div>
  );
};

export default VertexPrintTable;
