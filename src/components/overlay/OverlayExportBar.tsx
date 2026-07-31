/**
 * S5.3+S5.4: 多水源地叠加分析 — 导出工具栏
 *
 * 支持 Excel 多 Sheet 导出、GeoJSON 导出
 */

import React from 'react';
import type { OverlayResult } from '@/lib/multiSourceOverlayEngine';
import { useToast } from '@/hooks/useToast';

interface OverlayExportBarProps {
  result: OverlayResult;
  onDelete?: () => void;
}

const OverlayExportBar: React.FC<OverlayExportBarProps> = ({ result, onDelete }) => {
  const toast = useToast();

  const handleExportExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      // Sheet 1: 各级别汇总
      const summaryData = result.levels.map((lv) => ({
        级别: lv.level,
        合并面积_km2: parseFloat(lv.unionArea.toFixed(4)),
        独立面积之和_km2: parseFloat(lv.sumArea.toFixed(4)),
        重叠面积_km2: parseFloat(lv.overlapArea.toFixed(4)),
        重叠比例_百分比: parseFloat((lv.overlapRatio * 100).toFixed(2)),
        水源地数量: lv.sourceGeometries.length,
      }));
      const ws1 = XLSX.utils.json_to_sheet(summaryData);
      ws1['!cols'] = [
        { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 12 },
      ];
      XLSX.utils.book_append_sheet(wb, ws1, '级别汇总');

      // Sheet 2: 两两重叠
      const overlapData = result.overlaps.map((o) => ({
        水源地A: o.sourceAName,
        水源地B: o.sourceBName,
        级别: o.level,
        重叠面积_km2: parseFloat(o.overlapArea.toFixed(4)),
        重叠比例_百分比: parseFloat((o.overlapRatio * 100).toFixed(2)),
        是否重叠: o.overlapArea > 0 ? '是' : '否',
      }));
      const ws2 = XLSX.utils.json_to_sheet(overlapData);
      ws2['!cols'] = [
        { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 10 },
      ];
      XLSX.utils.book_append_sheet(wb, ws2, '两两重叠');

      // Sheet 3: 警告信息
      const warningData = result.warnings.length > 0
        ? result.warnings.map((w, i) => ({ 序号: i + 1, 警告内容: w }))
        : [{ 序号: 1, 警告内容: '无警告' }];
      const ws3 = XLSX.utils.json_to_sheet(warningData);
      ws3['!cols'] = [{ wch: 8 }, { wch: 80 }];
      XLSX.utils.book_append_sheet(wb, ws3, '警告信息');

      const fileName = `${result.analysisName || '多水源地叠加分析'}_${new Date(result.createdAt).toLocaleDateString('zh-CN').replace(/\//g, '')}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('Excel 导出成功');
    } catch {
      toast.error('Excel 导出失败');
    }
  };

  const handleExportGeoJSON = () => {
    try {
      const features: GeoJSON.Feature[] = [];

      // 收集所有水源地保护区
      result.levels.forEach((lv) => {
        lv.sourceGeometries.forEach((sg) => {
          const feature = sg.geometry as GeoJSON.Feature;
          features.push({
            ...feature,
            properties: {
              ...feature.properties,
              sourceName: sg.sourceName,
              level: lv.level,
              area: sg.area,
              type: 'protection-zone',
            },
          });
        });

        // 合并区域
        const unionFC = lv.unionGeometry as GeoJSON.FeatureCollection;
        if (unionFC.features) {
          unionFC.features.forEach((f) => {
            features.push({
              ...f,
              properties: {
                ...f.properties,
                level: lv.level,
                unionArea: lv.unionArea,
                type: 'union-area',
              },
            });
          });
        }
      });

      // 重叠区域
      result.overlaps
        .filter((o) => o.overlapArea > 0 && o.intersectionGeometry)
        .forEach((o) => {
          const feature = o.intersectionGeometry as GeoJSON.Feature;
          features.push({
            ...feature,
            properties: {
              ...feature.properties,
              sourceA: o.sourceAName,
              sourceB: o.sourceBName,
              level: o.level,
              overlapArea: o.overlapArea,
              overlapRatio: o.overlapRatio,
              type: 'overlap-area',
            },
          });
        });

      const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features,
      };

      const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${result.analysisName || 'overlay'}_${new Date(result.createdAt).toISOString().slice(0, 10)}.geojson`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('GeoJSON 导出成功');
    } catch {
      toast.error('GeoJSON 导出失败');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExportExcel}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-600 bg-green-50 hover:bg-green-100 border border-green-200 rounded-md transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        导出 Excel
      </button>
      <button
        onClick={handleExportGeoJSON}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 12h8M8 16h5" />
        </svg>
        导出 GeoJSON
      </button>
      {onDelete && (
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors ml-auto"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          删除分析
        </button>
      )}
    </div>
  );
};

export default OverlayExportBar;
