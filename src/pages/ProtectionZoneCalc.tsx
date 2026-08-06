/** 保护区划分计算页面
 *
 * 功能：
 * 1. 单个/批量水源地保护区计算
 * 2. 经验值法 + 解析法（Cooper-Jacob）
 * 3. 计算结果展示（参数/公式/面积/边界描述）
 * 4. 结果持久化到IDB
 * 5. 从水源地列表快速导入
 */

import { useConfirm } from '@/hooks/useConfirm';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { type ZoneCalcRecord, useWaterSourceStore } from '@/stores/waterSourceStore';
import type { CalcResult } from '@/lib/zoneCalcEngine';

import type { ReportConfig } from '@/lib/zoneReportGenerator';
const ReportConfigModal = React.lazy(() => import('@/components/ReportConfigModal'));
const BatchReportModal = React.lazy(() => import('@/components/BatchReportModal'));
import EAConclusionPanel from '@/components/protection-zone/EAConclusionPanel';
import WellFieldCalc from '@/components/WellFieldCalc';
import CompliancePanel from '@/components/CompliancePanel';
import QuickCalcPanel from '@/components/protection-zone/QuickCalcPanel';
import PreciseCalcPanel from '@/components/protection-zone/PreciseCalcPanel';
import ResultCard from '@/components/protection-zone/ResultCard';
import ComparePanel from '@/components/protection-zone/ComparePanel';
import ZoneSchemeCompare from '@/components/protection-zone/ZoneSchemeCompare';
import SensitivityPanel from '@/components/protection-zone/SensitivityPanel';
import ZoneClipPanel from '@/components/protection-zone/ZoneClipPanel';
import GisExportMenu from '@/components/protection-zone/GisExportMenu';
import VertexPrintTable from '@/components/protection-zone/VertexPrintTable';
import MapFigureExport from '@/components/protection-zone/MapFigureExport';


function ProtectionZoneCalc() {
  const { loaded, sources, zoneResults, saveZoneResult, loadZoneResults } =
    useWaterSourceStore();
  const confirm = useConfirm();
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
  // B1: 报告配置弹窗
  const [reportConfigOpen, setReportConfigOpen] = useState(false);
  // E2: 批量报告弹窗
  const [batchReportOpen, setBatchReportOpen] = useState(false);

  // B1: 报告生成处理
  const handleGenerateReport = async (config: ReportConfig, format: 'word' | 'pdf' | 'both') => {
    const opts = { ...config, cityNames: config.cityNames };
    if (format === 'word' || format === 'both') {
      const { generateZoneReport } = await import('@/lib/zoneReportGenerator');
      await generateZoneReport(zoneResults, sources, opts);
    }
    if (format === 'pdf' || format === 'both') {
      const { generatePdfReport } = await import('@/lib/reportPdfExporter');
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
      }).catch((err) => console.error('[ProtectionZoneCalc] 加载历史计算结果失败:', err));
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
        <div className="space-y-4">
          <ComparePanel results={results} />
          <ZoneSchemeCompare />
        </div>
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
                  onClick={async () => {
                    if (await confirm({ message: `确定清空全部${zoneResults.length}条保存的计算结果？`, danger: true })) {
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
                    onClick={async () => {
                      const { exportZoneExcel } = await import('@/lib/zoneExcelExporter');
                      exportZoneExcel(zoneResults, sources, { includeVertices: true });
                    }}
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
                  <GisExportMenu zoneResults={zoneResults} sources={sources} />
                                    <button
                    onClick={() => setBatchReportOpen(true)}
                    disabled={batchExporting}
                    className="text-xs px-2 py-1 rounded border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                  >
                    批量报告生成
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

      {/* N1: 拐点坐标表（打印优化） */}
      {zoneResults.length > 0 && <VertexPrintTable zoneResults={zoneResults} sources={sources} />}

      {/* N3: 保护区图件自动生成 */}
      {zoneResults.length > 0 && <MapFigureExport zoneResults={zoneResults} sources={sources} />}

      {/* T7: 参数敏感性分析面板（已拆分为子组件） */}
      <SensitivityPanel results={results} />

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

      {/* P1: 环评结论自动判定 */}
      {zoneResults.length > 0 && (
        <EAConclusionPanel zoneResults={zoneResults} />
      )}

      {/* T7: 行政区划裁剪面板（已拆分为子组件） */}
      <ZoneClipPanel zoneResults={zoneResults} sources={sources} />

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
      {/* B1: 报告配置弹窗（懒加载，减少首屏体积） */}
      <React.Suspense fallback={null}>
        <ReportConfigModal
          open={reportConfigOpen}
          onClose={() => setReportConfigOpen(false)}
          onGenerate={handleGenerateReport}
        />
      </React.Suspense>
      {/* E2: 批量报告生成弹窗（懒加载） */}
      <React.Suspense fallback={null}>
        <BatchReportModal
          open={batchReportOpen}
          onClose={() => setBatchReportOpen(false)}
          results={zoneResults}
          sources={sources}
        />
      </React.Suspense>
    </div>
  );
};

export default ProtectionZoneCalc;
