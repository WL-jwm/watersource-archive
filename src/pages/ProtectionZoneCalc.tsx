/** 保护区划分计算页面
 *
 * 功能：
 * 1. 单个/批量水源地保护区计算
 * 2. 经验值法 + 解析法（Cooper-Jacob）
 * 3. 计算结果展示（参数/公式/面积/边界描述）
 * 4. 结果持久化到IDB
 * 5. 从水源地列表快速导入
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useWaterSourceStore, type ZoneCalcRecord } from '@/stores/waterSourceStore';
import type { CalcResult } from '@/lib/zoneCalcEngine';
import { exportZoneExcel } from '@/lib/zoneExcelExporter';
import {
  exportKML,
  exportWKT,
  exportBatchGeoJSON as exportAllGeoJSON,
} from '@/lib/zoneGISExporter';
import { generateSourceZoneVertices } from '@/lib/zoneCoordGenerator';
import { clipBatchZones, summarizeClipResults, type SourceClipResult } from '@/lib/zoneClipEngine';
import { analyzeSensitivity, toChartData, type SensitivityResult } from '@/lib/sensitivityEngine';
import {
  generateZoneReport,
  generateBatchReports,
  type ReportConfig,
} from '@/lib/zoneReportGenerator';
import { generatePdfReport } from '@/lib/reportPdfExporter';
import ReportConfigModal from '@/components/ReportConfigModal';
import WellFieldCalc from '@/components/WellFieldCalc';
import CompliancePanel from '@/components/CompliancePanel';
import QuickCalcPanel from '@/components/protection-zone/QuickCalcPanel';
import PreciseCalcPanel from '@/components/protection-zone/PreciseCalcPanel';
import ResultCard from '@/components/protection-zone/ResultCard';
import ComparePanel from '@/components/protection-zone/ComparePanel';


function ProtectionZoneCalc() {
  const { loaded, sources, zoneResults, saveZoneResult, loadZoneResults } =
    useWaterSourceStore();
  const [results, setResults] = useState<CalcResult[]>([]);
  const [activeTab, setActiveTab] = useState<'quick' | 'precise' | 'compare'>('quick');
  const [autoSave, setAutoSave] = useState(true);
  // P3-18: 批量导出进度
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    cityName: string;
  } | null>(null);
  const [batchExporting, setBatchExporting] = useState(false);
  const [clipResults, setClipResults] = useState<SourceClipResult[] | null>(null);
  const [clipLoading, setClipLoading] = useState(false);
  const [sensitivityResult, setSensitivityResult] = useState<SensitivityResult | null>(null);
  // B1: 报告配置弹窗
  const [reportConfigOpen, setReportConfigOpen] = useState(false);

  // B1: 报告生成处理
  const handleGenerateReport = async (config: ReportConfig, format: 'word' | 'pdf' | 'both') => {
    const opts = { ...config, cityNames: config.cityNames };
    if (format === 'word' || format === 'both') {
      await generateZoneReport(zoneResults, sources, opts);
    }
    if (format === 'pdf' || format === 'both') {
      await generatePdfReport(zoneResults, sources, opts);
    }
  };

  // P3-12: 从URL参数自动切换到精确计算并切换Tab
  React.useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.split('?')[1] || '');
    if (params.get('source')) {
      setActiveTab('precise');
    }
  }, []);

  // 加载时恢复历史计算结果
  useEffect(() => {
    if (loaded && zoneResults.length === 0) {
      loadZoneResults().then(() => {
        const stored = useWaterSourceStore.getState().zoneResults;
        if (stored.length > 0) {
          setResults(
            stored.map((zr) => ({
              sourceName: zr.sourceName,
              params: zr.params,
              zones: zr.zones,
              calculatedAt: zr.calculatedAt,
              warnings: zr.warnings,
            })),
          );
        }
      });
    } else if (zoneResults.length > 0 && results.length === 0) {
      // zoneResults已加载但results未恢复
      setResults(
        zoneResults.map((zr) => ({
          sourceName: zr.sourceName,
          params: zr.params,
          zones: zr.zones,
          calculatedAt: zr.calculatedAt,
          warnings: zr.warnings,
        })),
      );
    }
  }, [loaded]);

  // 保存计算结果到IDB
  const persistResult = useCallback(
    async (
      result: CalcResult,
      sourceId?: string,
      customParams?: ZoneCalcRecord['customParams'],
    ) => {
      if (!autoSave) return;
      const record: ZoneCalcRecord = {
        id: `${result.sourceName}_${Date.now()}`,
        sourceId: sourceId || result.sourceName,
        sourceName: result.sourceName,
        params: result.params,
        zones: result.zones,
        calculatedAt: result.calculatedAt,
        warnings: result.warnings,
        customParams,
      };
      await saveZoneResult(record);
    },
    [autoSave, saveZoneResult],
  );

  const handleBatchResult = useCallback(
    (newResults: CalcResult[], sourceIds?: Map<string, string>) => {
      setResults((prev) => [...prev, ...newResults]);
      newResults.forEach((r, i) => {
        const sid = sourceIds?.get(r.sourceName);
        persistResult(r, sid);
      });
    },
    [persistResult],
  );

  const handleSingleResult = useCallback(
    (result: CalcResult, customParams?: ZoneCalcRecord['customParams']) => {
      setResults((prev) => [...prev, result]);
      persistResult(result, undefined, customParams);
    },
    [persistResult],
  );

  const clearResults = () => setResults([]);

  // P4-5: 准备GIS导出数据
  const prepareGisExport = useCallback(() => {
    return zoneResults
      .map((zr) => {
        const source = sources.find((s) => s.name === zr.sourceName);
        const lng = source?.lng;
        const lat = source?.lat;
        if (lng == null || lat == null) return null;
        return generateSourceZoneVertices(zr.sourceId, zr.sourceName, lng, lat, zr.zones);
      })
      .filter(Boolean) as ReturnType<typeof generateSourceZoneVertices>[];
  }, [zoneResults, sources]);

  // 仅地下水水源地用于快速计算
  const gwSources = useMemo(() => sources.filter((s) => s.type === '地下水'), [sources]);

  if (!loaded) {
    return <div className="p-6 text-center text-gray-500">数据加载中...</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* 标题 */}
      <div>
        <h1 className="text-xl font-bold">水源地保护区划分</h1>
        <p className="text-xs text-gray-500 mt-1">
          依据 HJ 338-2018《饮用水水源保护区划分技术规范》，支持经验值法和解析法(Cooper-Jacob)
        </p>
      </div>

      {/* Tab切换 - 移动端横向滚动 */}
      <div className="flex overflow-x-auto border-b border-gray-200 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
        <button
          onClick={() => setActiveTab('quick')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'quick'
              ? 'border-blue-500 text-blue-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          快速批量计算
        </button>
        <button
          onClick={() => setActiveTab('precise')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'precise'
              ? 'border-blue-500 text-blue-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          精确计算（解析法）
        </button>
        <button
          onClick={() => setActiveTab('compare')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'compare'
              ? 'border-purple-500 text-purple-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          方案对比
          {results.length >= 2 && (
            <span className="ml-1 text-[10px] bg-purple-100 text-purple-600 px-1 rounded-full">
              {results.length}
            </span>
          )}
        </button>
      </div>

      {/* 计算面板 */}
      {activeTab === 'quick' ? (
        <QuickCalcPanel sources={gwSources} onBatchResult={handleBatchResult} />
      ) : activeTab === 'precise' ? (
        <PreciseCalcPanel onResult={handleSingleResult} />
      ) : (
        <ComparePanel results={results} />
      )}

      {/* 结果汇总 */}
      {results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-sm font-semibold">计算结果（{results.length}个）</div>
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSave}
                  onChange={(e) => setAutoSave(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span>自动保存</span>
              </label>
              {autoSave && (
                <span className="text-[10px] text-green-600">
                  &#10003; 已保存{zoneResults.length}条
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {zoneResults.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm(`确定清空全部${zoneResults.length}条保存的计算结果？`)) {
                      useWaterSourceStore.getState().clearZoneResults();
                      setResults([]);
                    }
                  }}
                  className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50"
                >
                  清空已保存
                </button>
              )}
              <button
                onClick={clearResults}
                className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
              >
                清空显示
              </button>
              {zoneResults.length > 0 && (
                <>
                  <button
                    onClick={() => exportZoneExcel(zoneResults, sources, { includeVertices: true })}
                    className="text-xs px-2 py-1 rounded border border-green-200 text-green-700 hover:bg-green-50"
                  >
                    导出Excel
                  </button>
                  <button
                    onClick={() => setReportConfigOpen(true)}
                    className="text-xs px-2 py-1 rounded border border-blue-200 text-blue-700 hover:bg-blue-50"
                  >
                    导出报告(Word/PDF)
                  </button>
                  {/* P4-5: GIS导出 */}
                  <div className="relative group inline-block">
                    <button className="text-xs px-2 py-1 rounded border border-purple-200 text-purple-700 hover:bg-purple-50 flex items-center gap-1">
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                        />
                      </svg>
                      GIS导出
                      <svg
                        className="w-2.5 h-2.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                    <div className="absolute right-0 top-full mt-1 bg-white border border-purple-200 rounded-lg shadow-lg py-1 w-44 z-30 hidden group-hover:block">
                      <button
                        onClick={() => {
                          const items = prepareGisExport();
                          if (items.length === 0) return alert('无已保存的计算结果');
                          exportAllGeoJSON(items);
                        }}
                        className="w-full text-left text-xs px-3 py-2 hover:bg-purple-50 flex items-center gap-2"
                      >
                        <span className="text-green-500">●</span> GeoJSON（QGIS/ArcGIS通用）
                      </button>
                      <button
                        onClick={() => {
                          const items = prepareGisExport();
                          if (items.length === 0) return alert('无已保存的计算结果');
                          items.forEach((item) => exportKML(item));
                        }}
                        className="w-full text-left text-xs px-3 py-2 hover:bg-purple-50 flex items-center gap-2"
                      >
                        <span className="text-blue-500">●</span> KML（Google Earth）
                      </button>
                      <button
                        onClick={() => {
                          const items = prepareGisExport();
                          if (items.length === 0) return alert('无已保存的计算结果');
                          items.forEach((item) => exportWKT(item));
                        }}
                        className="w-full text-left text-xs px-3 py-2 hover:bg-purple-50 flex items-center gap-2"
                      >
                        <span className="text-amber-500">●</span> WKT（文本图层）
                      </button>
                      <div className="border-t border-purple-100 my-1"></div>
                      <div className="px-3 py-1.5 text-[9px] text-gray-400 leading-tight">
                        导出所有已保存计算结果的保护区坐标
                        <br />
                        坐标系：WGS84（EPSG:4326）
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      if (
                        !confirm(
                          `将按城市分组生成${
                            new Set(
                              zoneResults.map((r) => {
                                const s = sources.find((s) => s.name === r.sourceName);
                                return s?.cityName || '未知';
                              }),
                            ).size
                          }个独立Word报告文件，是否继续？`,
                        )
                      )
                        return;
                      setBatchExporting(true);
                      setBatchProgress({ current: 0, total: 0, cityName: '' });
                      try {
                        await generateBatchReports(zoneResults, sources, {
                          includeVertices: true,
                          onProgress: (current, total, cityName) => {
                            setBatchProgress({ current, total, cityName });
                          },
                        });
                      } finally {
                        setBatchExporting(false);
                        setBatchProgress(null);
                      }
                    }}
                    disabled={batchExporting}
                    className="text-xs px-2 py-1 rounded border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                  >
                    {batchExporting
                      ? `导出中 ${batchProgress ? `${batchProgress.current}/${batchProgress.total}` : ''}`
                      : '批量导出(按城市分报告)'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* P3-18: 批量导出进度条 */}
          {batchExporting && batchProgress && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-2xl p-6 mx-4 max-w-sm w-full">
                <h3 className="text-lg font-bold text-gray-800 mb-3">批量导出Word报告</h3>
                <div className="mb-3">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>正在生成：{batchProgress.cityName}</span>
                    <span>
                      {batchProgress.current}/{batchProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-indigo-500 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400">每个城市生成一个独立Word文件，请勿关闭页面</p>
              </div>
            </div>
          )}

          {/* 汇总表 */}
          <div className="rounded-lg overflow-hidden bg-white border border-gray-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">#</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">水源地</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">类型</th>
                  <th className="px-3 py-2 text-center font-semibold text-red-600">一级(km²)</th>
                  <th className="px-3 py-2 text-center font-semibold text-orange-600">二级(km²)</th>
                  <th className="px-3 py-2 text-center font-semibold text-yellow-600">
                    准保护(km²)
                  </th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-500">上游(m)</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-500">下游(m)</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-500">岸宽(m)</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-500">方法</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => {
                  const z1 = r.zones.find((z) => z.level === '一级');
                  const z2 = r.zones.find((z) => z.level === '二级');
                  const zq = r.zones.find((z) => z.level === '准保护区');
                  return (
                    <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                      <td className="px-3 py-1.5 font-medium">{r.sourceName}</td>
                      <td className="px-3 py-1.5 text-gray-500">
                        {r.params.sourceType === '地下水'
                          ? r.params.gwType || ''
                          : r.params.swType || ''}
                      </td>
                      <td className="px-3 py-1.5 text-center font-medium text-red-700">
                        {z1?.area || '-'}
                      </td>
                      <td className="px-3 py-1.5 text-center font-medium text-orange-700">
                        {z2?.area || '-'}
                      </td>
                      <td className="px-3 py-1.5 text-center font-medium text-yellow-700">
                        {zq?.area || '-'}
                      </td>
                      <td className="px-3 py-1.5 text-center text-gray-500">
                        {z1?.riverExt?.upstreamLength || '-'}
                      </td>
                      <td className="px-3 py-1.5 text-center text-gray-500">
                        {z1?.riverExt?.downstreamLength || '-'}
                      </td>
                      <td className="px-3 py-1.5 text-center text-gray-500">
                        {z1?.riverExt?.bankWidth || '-'}
                      </td>
                      <td className="px-3 py-1.5 text-center text-gray-500">{z1?.method || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 详细结果卡片 */}
          {results.map((r, i) => (
            <ResultCard key={i} result={r} index={i} />
          ))}
        </div>
      )}

      {/* P4-7: 参数敏感性分析面板 */}
      {results.length > 0 && results[results.length - 1].params.sourceType === '地下水' && (
        <div className="rounded-lg p-4 bg-white border border-amber-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-amber-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                />
              </svg>
              <h3 className="text-sm font-semibold text-amber-700">参数敏感性分析</h3>
            </div>
            <button
              onClick={() => {
                const lastResult = results[results.length - 1];
                const result = analyzeSensitivity(
                  lastResult.sourceName,
                  lastResult.params,
                  lastResult.zones[0]?.method || '解析法',
                );
                setSensitivityResult(result);
              }}
              className="text-xs px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
            >
              分析
            </button>
          </div>
          <p className="text-[10px] text-gray-500">
            固定其他参数不变，在合理范围内变化单个参数，观察保护区面积响应（仅支持地下水解析法）
          </p>

          {sensitivityResult && sensitivityResult.curves.length > 0 && (
            <div className="space-y-4">
              {/* 敏感度排名 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {sensitivityResult.curves.map((curve, i) => (
                  <div
                    key={i}
                    className={`rounded-lg p-2 text-center ${
                      curve.sensitivityLevel === '高'
                        ? 'bg-red-50 border border-red-200'
                        : curve.sensitivityLevel === '中'
                          ? 'bg-amber-50 border border-amber-200'
                          : 'bg-green-50 border border-green-200'
                    }`}
                  >
                    <div
                      className={`text-xs font-bold ${
                        curve.sensitivityLevel === '高'
                          ? 'text-red-600'
                          : curve.sensitivityLevel === '中'
                            ? 'text-amber-600'
                            : 'text-green-600'
                      }`}
                    >
                      {curve.paramKey}
                    </div>
                    <div className="text-[9px] text-gray-500">{curve.paramName}</div>
                    <div
                      className={`text-[9px] font-medium mt-0.5 ${
                        curve.sensitivityLevel === '高'
                          ? 'text-red-500'
                          : curve.sensitivityLevel === '中'
                            ? 'text-amber-500'
                            : 'text-green-500'
                      }`}
                    >
                      {curve.sensitivityLevel}敏感度
                    </div>
                  </div>
                ))}
              </div>

              {/* 敏感度曲线图表（用纯CSS+div模拟简易图表） */}
              {sensitivityResult.curves.slice(0, 2).map((curve, ci) => {
                const chartData = toChartData(curve);
                const maxArea = Math.max(...chartData.map((d) => d.area2), 0.001);
                return (
                  <div key={ci} className="space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-medium text-gray-700">
                        {curve.paramName}（{curve.paramKey}）对二级保护区面积影响
                      </span>
                      <span className="text-gray-400">
                        基准值: {curve.baseValue} {curve.unit}
                      </span>
                    </div>
                    <div className="flex items-end gap-px h-20 bg-gray-50 rounded p-1">
                      {chartData.map((d, di) => (
                        <div
                          key={di}
                          className="flex-1 flex flex-col items-center justify-end h-full group relative"
                        >
                          <div
                            className="w-full bg-amber-400 hover:bg-amber-500 rounded-t transition-colors cursor-pointer"
                            style={{ height: `${Math.max((d.area2 / maxArea) * 100, 1)}%` }}
                            title={`${curve.paramKey}=${d.paramValue}\n二级面积: ${d.area2.toFixed(4)} km²`}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between text-[8px] text-gray-400">
                      <span>{curve.range[0]}</span>
                      <span className="text-amber-600 font-medium">{curve.baseValue}</span>
                      <span>
                        {curve.range[1]} {curve.unit}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {sensitivityResult && sensitivityResult.curves.length === 0 && (
            <div className="text-[10px] text-gray-400 text-center py-2">
              当前参数配置不支持敏感性分析（需填入渗透系数K和储水系数S等水文地质参数）
            </div>
          )}
        </div>
      )}

      {/* A2: 多井干扰保护区计算面板 */}
      <div className="rounded-lg p-4 bg-white border border-cyan-200">
        <WellFieldCalc />
      </div>

      {/* B3: 合规性检查面板 */}
      {zoneResults.length > 0 && (
        <div className="rounded-lg p-4 bg-white border border-teal-200">
          <CompliancePanel zoneResults={zoneResults} sources={sources} />
        </div>
      )}

      {/* P4-3: 行政区划裁剪面板 */}
      {zoneResults.length > 0 && (
        <div className="rounded-lg p-4 bg-white border border-indigo-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-indigo-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                />
              </svg>
              <h3 className="text-sm font-semibold text-indigo-700">行政区划裁剪</h3>
            </div>
            <button
              onClick={async () => {
                setClipLoading(true);
                try {
                  const items = prepareGisExport();
                  if (items.length === 0) {
                    alert('无已保存的计算结果');
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
                  alert('裁剪计算失败: ' + (e as Error).message);
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

          {clipResults &&
            clipResults.length > 0 &&
            (() => {
              const summary = summarizeClipResults(clipResults);
              return (
                <div className="space-y-3">
                  {/* 汇总卡片 */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="bg-indigo-50 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-indigo-600">
                        {summary.totalSources}
                      </div>
                      <div className="text-[9px] text-indigo-400">水源地总数</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-red-600">{summary.clippedSources}</div>
                      <div className="text-[9px] text-red-400">被裁剪数量</div>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-amber-600">
                        {summary.totalOriginalArea.toFixed(2)}
                      </div>
                      <div className="text-[9px] text-amber-400">理论面积 km²</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-green-600">
                        {summary.totalClippedArea.toFixed(2)}
                      </div>
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
                          <th className="border border-indigo-200 px-2 py-1 text-right">
                            理论 km²
                          </th>
                          <th className="border border-indigo-200 px-2 py-1 text-right">
                            实际 km²
                          </th>
                          <th className="border border-indigo-200 px-2 py-1 text-right">
                            裁剪比例
                          </th>
                          <th className="border border-indigo-200 px-2 py-1">状态</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clipResults.flatMap((cr) =>
                          cr.zones.map((z, i) => (
                            <tr
                              key={`${cr.sourceName}-${i}`}
                              className={z.isClipped ? 'bg-red-50' : ''}
                            >
                              <td className="border border-gray-200 px-2 py-1 text-left max-w-[120px] truncate">
                                {cr.sourceName}
                              </td>
                              <td className="border border-gray-200 px-2 py-1 text-left">
                                {cr.cityName}
                              </td>
                              <td className="border border-gray-200 px-2 py-1 text-center">
                                {z.level}
                              </td>
                              <td className="border border-gray-200 px-2 py-1 text-right">
                                {z.originalArea.toFixed(4)}
                              </td>
                              <td className="border border-gray-200 px-2 py-1 text-right">
                                {z.clippedArea.toFixed(4)}
                              </td>
                              <td className="border border-gray-200 px-2 py-1 text-right">
                                {z.clipRatio < 1 ? `${(z.clipRatio * 100).toFixed(1)}%` : '-'}
                              </td>
                              <td className="border border-gray-200 px-2 py-1 text-center">
                                {z.isClipped ? (
                                  <span className="text-red-500">被裁剪</span>
                                ) : (
                                  <span className="text-green-500">完整</span>
                                )}
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
      )}

      {/* 参考说明 */}
      <div className="rounded-lg p-4 bg-gray-50 border border-gray-200">
        <h3 className="text-xs font-semibold text-gray-600 mb-2">技术依据</h3>
        <div className="text-[10px] text-gray-500 space-y-1">
          <p>
            <strong>HJ 338-2018</strong>《饮用水水源保护区划分技术规范》
          </p>
          <p>
            <strong>解析法原理：</strong>
            基于Cooper-Jacob近似解，通过导水系数T和储水系数S计算给定运移时间t内地下水污染羽的扩展半径。一级保护区取t=60天（常规病原体灭活时间），二级保护区取t=25年。
          </p>
          <p>
            <strong>经验值法：</strong>
            当缺少详细水文地质参数时，按地下水类型（孔隙水/裂隙水/岩溶水）查表取典型半径值。
          </p>
          <p>
            <strong>适用范围：</strong>
            孔隙水裂隙水适用解析法；岩溶水含水层非均质性强，解析法结果仅供参考，应结合示踪试验或数值模拟验证。
          </p>
        </div>
      </div>
      {/* B1: 报告配置弹窗 */}
      <ReportConfigModal
        open={reportConfigOpen}
        onClose={() => setReportConfigOpen(false)}
        onGenerate={handleGenerateReport}
      />
    </div>
  );
};

export default ProtectionZoneCalc;
