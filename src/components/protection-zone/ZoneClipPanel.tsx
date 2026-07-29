/**
 * T7: 行政区划裁剪面板（从 ProtectionZoneCalc 拆分）
 */

import { useToast } from '@/hooks/useToast';
import React, { useState } from 'react';
import { clipBatchZones, summarizeClipResults, type SourceClipResult } from '@/lib/zoneClipEngine';
import { generateSourceZoneVertices } from '@/lib/zoneCoordGenerator';
import type { ZoneCalcRecord } from '@/stores/waterSourceStore';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';

interface ZoneClipPanelProps {
  zoneResults: ZoneCalcRecord[];
  sources: WaterSourceRecord[];
}

const ZoneClipPanel: React.FC<ZoneClipPanelProps> = ({ zoneResults, sources }) => {
  const toast = useToast();
  const [clipLoading, setClipLoading] = useState(false);
  const [clipResults, setClipResults] = useState<SourceClipResult[] | null>(null);

  if (zoneResults.length === 0) return null;

  const prepareGisExport = () => {
    return zoneResults
      .map((zr) => {
        const source = sources.find((s) => s.name === zr.sourceName);
        const lng = source?.lng;
        const lat = source?.lat;
        if (lng == null || lat == null) return null;
        return generateSourceZoneVertices(zr.sourceId, zr.sourceName, lng, lat, zr.zones);
      })
      .filter(Boolean) as ReturnType<typeof generateSourceZoneVertices>[];
  };

  return (
    <div className="rounded-lg p-4 bg-white border border-indigo-200 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <h3 className="text-sm font-semibold text-indigo-700">行政区划裁剪</h3>
        </div>
        <button
          onClick={async () => {
            setClipLoading(true);
            try {
              const items = prepareGisExport();
              if (items.length === 0) {
                toast.warning('无已保存的计算结果');
                return;
              }
              const getCityName = (name: string) => {
                const s = sources.find((src) => src.name === name);
                return s?.cityName || '未知';
              };
              const results = await clipBatchZones(items, getCityName);
              setClipResults(results);
            } catch (e) {
              console.error('裁剪计算失败:', e);
              toast.error('裁剪计算失败: ' + (e as Error).message);
            } finally {
              setClipLoading(false);
            }
          }}
          disabled={clipLoading}
          className="text-xs px-3 py-1.5 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:bg-indigo-300 transition-colors"
        >
          {clipLoading ? '计算中...' : '执行裁剪'}
        </button>
      </div>
      <p className="text-[10px] text-gray-500">
        将保护区理论范围与行政区划边界求交集，计算实际管控面积（扣除超出行政边界的部分）
      </p>

      {clipResults && clipResults.length > 0 && (() => {
        const summary = summarizeClipResults(clipResults);
        return (
          <div className="space-y-3">
            {/* 汇总卡片 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-indigo-50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-indigo-600">{summary.totalSources}</div>
                <div className="text-[9px] text-indigo-400">水源地总数</div>
              </div>
              <div className="bg-red-50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-red-600">{summary.clippedSources}</div>
                <div className="text-[9px] text-red-400">被裁剪数量</div>
              </div>
              <div className="bg-amber-50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-amber-600">{summary.totalOriginalArea.toFixed(2)}</div>
                <div className="text-[9px] text-amber-400">理论面积 km²</div>
              </div>
              <div className="bg-green-50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-green-600">{summary.totalClippedArea.toFixed(2)}</div>
                <div className="text-[9px] text-green-400">实际面积 km²</div>
              </div>
            </div>
            {summary.reductionPct > 0.01 && (
              <div className="text-xs text-center text-gray-500">
                裁剪缩减 {summary.totalReduction.toFixed(2)} km²（{summary.reductionPct}%）
              </div>
            )}

            {/* 明细表 */}
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-indigo-100">
                    <th className="border border-indigo-200 px-2 py-1 text-left">水源地</th>
                    <th className="border border-indigo-200 px-2 py-1 text-left">城市</th>
                    <th className="border border-indigo-200 px-2 py-1">级别</th>
                    <th className="border border-indigo-200 px-2 py-1 text-right">理论 km²</th>
                    <th className="border border-indigo-200 px-2 py-1 text-right">实际 km²</th>
                    <th className="border border-indigo-200 px-2 py-1 text-right">裁剪比例</th>
                    <th className="border border-indigo-200 px-2 py-1">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {clipResults.flatMap((cr) =>
                    cr.zones.map((z, i) => (
                      <tr key={`${cr.sourceName}-${i}`} className={z.isClipped ? 'bg-red-50' : ''}>
                        <td className="border border-gray-200 px-2 py-1 text-left max-w-[120px] truncate">{cr.sourceName}</td>
                        <td className="border border-gray-200 px-2 py-1 text-left">{cr.cityName}</td>
                        <td className="border border-gray-200 px-2 py-1 text-center">{z.level}</td>
                        <td className="border border-gray-200 px-2 py-1 text-right">{z.originalArea.toFixed(4)}</td>
                        <td className="border border-gray-200 px-2 py-1 text-right">{z.clippedArea.toFixed(4)}</td>
                        <td className="border border-gray-200 px-2 py-1 text-right">
                          {z.clipRatio < 1 ? `${(z.clipRatio * 100).toFixed(1)}%` : '-'}
                        </td>
                        <td className="border border-gray-200 px-2 py-1 text-center">
                          {z.isClipped ? <span className="text-red-500">被裁剪</span> : <span className="text-green-500">完整</span>}
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default ZoneClipPanel;
