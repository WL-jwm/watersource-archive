/**
 * T1: 水质趋势分析面板
 *
 * 集成 waterQualityTrend 引擎，提供：
 * 1. 水源地选择
 * 2. 多期水质监测数据录入（支持手动输入和快速填充示例）
 * 3. 趋势分析结果展示（指标趋势/超标统计/等级变化/预警）
 *
 * 依据：GB/T 14848-2017《地下水质量标准》
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useWaterSourceStore } from '@/stores/waterSourceStore';
import {
  analyzeTrend,
  GW_STANDARD_III,
  type WaterQualityHistory,
  type WaterQualityPeriod,
  type WaterQualityTrendReport,
  type IndicatorTrend,
} from '@/lib/waterQualityTrend';

// ===== 常量 =====

const COMMON_INDICATORS = [
  '氨氮', '硝酸盐氮', '亚硝酸盐氮', '总硬度', '溶解性总固体',
  '硫酸盐', '氯化物', '高锰酸盐指数', '氟化物', '铁', '锰', 'pH',
];

const EXAMPLE_PERIODS: WaterQualityPeriod[] = [
  {
    date: '2023-03-15',
    label: '2023年枯水期',
    indicators: { 氨氮: 0.12, 硝酸盐氮: 8.5, 总硬度: 320, 溶解性总固体: 680, 高锰酸盐指数: 1.2, 氟化物: 0.3 },
  },
  {
    date: '2023-09-20',
    label: '2023年丰水期',
    indicators: { 氨氮: 0.18, 硝酸盐氮: 12.3, 总硬度: 350, 溶解性总固体: 720, 高锰酸盐指数: 1.8, 氟化物: 0.4 },
  },
  {
    date: '2024-03-10',
    label: '2024年枯水期',
    indicators: { 氨氮: 0.25, 硝酸盐氮: 15.6, 总硬度: 380, 溶解性总固体: 780, 高锰酸盐指数: 2.1, 氟化物: 0.5 },
  },
  {
    date: '2024-09-18',
    label: '2024年丰水期',
    indicators: { 氨氮: 0.35, 硝酸盐氮: 18.2, 总硬度: 410, 溶解性总固体: 850, 高锰酸盐指数: 2.6, 氟化物: 0.7 },
  },
];

// ===== 子组件：指标趋势行 =====

const TrendArrow: React.FC<{ trend: '上升' | '下降' | '稳定' }> = ({ trend }) => {
  if (trend === '上升')
    return <span className="text-red-500 font-bold">↑ 上升</span>;
  if (trend === '下降')
    return <span className="text-green-500 font-bold">↓ 下降</span>;
  return <span className="text-gray-500">→ 稳定</span>;
};

const ExceedBadge: React.FC<{ rate: number; count: number; total: number }> = ({ rate, count, total }) => {
  if (rate === 0)
    return <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-700">未超标</span>;
  if (rate >= 50)
    return <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-700">{count}/{total} ({rate}%)</span>;
  return <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-700">{count}/{total} ({rate}%)</span>;
};

// ===== 主组件 =====

const WaterQualityTrendPanel: React.FC = () => {
  const { loaded, sources } = useWaterSourceStore();

  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [periods, setPeriods] = useState<WaterQualityPeriod[]>([]);
  const [report, setReport] = useState<WaterQualityTrendReport | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // 添加监测期表单状态
  const [newPeriodLabel, setNewPeriodLabel] = useState('');
  const [newPeriodDate, setNewPeriodDate] = useState('');
  const [newIndicators, setNewIndicators] = useState<Record<string, string>>({});
  const [selectedIndicator, setSelectedIndicator] = useState(COMMON_INDICATORS[0]);

  // ===== 回调 =====

  const handleAddPeriod = useCallback(() => {
    if (!newPeriodLabel.trim() || !newPeriodDate) {
      alert('请填写监测期次标签和日期');
      return;
    }
    const indicators: Record<string, number> = {};
    for (const [k, v] of Object.entries(newIndicators)) {
      const num = parseFloat(v);
      if (!isNaN(num)) indicators[k] = num;
    }
    if (Object.keys(indicators).length === 0) {
      alert('请至少填写一个指标监测值');
      return;
    }
    setPeriods(prev => [...prev, { date: newPeriodDate, label: newPeriodLabel.trim(), indicators }]);
    setNewPeriodLabel('');
    setNewPeriodDate('');
    setNewIndicators({});
  }, [newPeriodLabel, newPeriodDate, newIndicators]);

  const handleRemovePeriod = useCallback((idx: number) => {
    setPeriods(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const handleLoadExample = useCallback(() => {
    setPeriods(EXAMPLE_PERIODS.map(p => ({ ...p, indicators: { ...p.indicators } })));
    if (sources.length > 0 && !selectedSourceId) {
      setSelectedSourceId(sources[0].id);
    }
  }, [sources, selectedSourceId]);

  const handleAnalyze = useCallback(() => {
    if (periods.length < 2) {
      alert('至少需要2期监测数据');
      return;
    }
    setAnalyzing(true);
    setTimeout(() => {
      const sourceName = sources.find(s => s.id === selectedSourceId)?.name || '未命名水源地';
      const history: WaterQualityHistory = {
        sourceId: selectedSourceId || 'unknown',
        sourceName,
        periods,
      };
      const result = analyzeTrend(history);
      setReport(result);
      setAnalyzing(false);
    }, 50);
  }, [periods, selectedSourceId, sources]);

  const handleAddIndicator = useCallback(() => {
    if (!newIndicators[selectedIndicator] && newIndicators[selectedIndicator] !== '') {
      // 已存在，跳过
      return;
    }
    setNewIndicators(prev => ({ ...prev, [selectedIndicator]: '' }));
  }, [selectedIndicator, newIndicators]);

  const handleClearAll = useCallback(() => {
    setPeriods([]);
    setReport(null);
    setNewIndicators({});
    setNewPeriodLabel('');
    setNewPeriodDate('');
  }, []);

  // ===== 渲染 =====

  if (!loaded) {
    return <div className="p-6 text-center text-gray-500">数据加载中...</div>;
  }

  return (
    <div className="rounded-lg p-4 bg-white border border-gray-200 space-y-4">
      {/* 标题 */}
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
        <div>
          <h3 className="text-sm font-semibold">水质趋势分析</h3>
          <p className="text-[10px] text-gray-500">多期水质监测数据趋势分析 · 超标频次统计 · 劣化预警（GB/T 14848-2017）</p>
        </div>
      </div>

      {/* 水源地选择 + 操作按钮 */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="text-[10px] text-gray-500">选择水源地</label>
          <select
            value={selectedSourceId}
            onChange={e => setSelectedSourceId(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
          >
            <option value="">-- 选择水源地 --</option>
            {sources.map(s => (
              <option key={s.id} value={s.id}>{s.name}（{s.cityName}）</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleLoadExample}
          className="text-xs px-2 py-1.5 rounded border border-blue-200 text-blue-600 hover:bg-blue-50"
        >
          加载示例
        </button>
        <button
          onClick={handleClearAll}
          className="text-xs px-2 py-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50"
        >
          清空
        </button>
      </div>

      {/* 添加监测期 */}
      <div className="rounded-lg p-3 bg-gray-50 border border-gray-200 space-y-2">
        <div className="text-xs font-medium text-gray-600">添加监测期次</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            type="text"
            placeholder="期次标签（如：2024年枯水期）"
            value={newPeriodLabel}
            onChange={e => setNewPeriodLabel(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-1.5"
          />
          <input
            type="date"
            value={newPeriodDate}
            onChange={e => setNewPeriodDate(e.target.value)}
            className="text-xs border border-gray-200 rounded px-2 py-1.5"
          />
          <div className="flex gap-1">
            <select
              value={selectedIndicator}
              onChange={e => setSelectedIndicator(e.target.value)}
              className="text-xs border border-gray-200 rounded px-2 py-1.5 flex-1"
            >
              {COMMON_INDICATORS.map(ind => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
            <button
              onClick={handleAddIndicator}
              className="text-xs px-2 py-1.5 bg-gray-200 rounded hover:bg-gray-300"
            >
              +
            </button>
          </div>
        </div>

        {/* 已选指标输入框 */}
        {Object.keys(newIndicators).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(newIndicators).map(([ind, val]) => (
              <div key={ind} className="flex items-center gap-1">
                <label className="text-[10px] text-gray-500">
                  {ind}
                  {GW_STANDARD_III[ind] && (
                    <span className="text-gray-400 ml-0.5">(III类: {GW_STANDARD_III[ind]})</span>
                  )}
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="mg/L"
                  value={val}
                  onChange={e => setNewIndicators(prev => ({ ...prev, [ind]: e.target.value }))}
                  className="w-20 text-[10px] border border-gray-200 rounded px-1 py-1"
                />
                <button
                  onClick={() => setNewIndicators(prev => {
                    const copy = { ...prev };
                    delete copy[ind];
                    return copy;
                  })}
                  className="text-[10px] text-red-400 hover:text-red-600"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleAddPeriod}
            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            添加此期
          </button>
        </div>
      </div>

      {/* 已录入的监测期次列表 */}
      {periods.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">
              已录入 {periods.length} 期监测数据
            </span>
            <button
              onClick={handleAnalyze}
              disabled={analyzing || periods.length < 2}
              className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-30"
            >
              {analyzing ? '分析中...' : '开始趋势分析'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[10px] border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-2 py-1 text-left">期次</th>
                  <th className="border px-2 py-1 text-left">日期</th>
                  <th className="border px-2 py-1 text-left">指标数</th>
                  <th className="border px-2 py-1 text-left">指标概要</th>
                  <th className="border px-2 py-1">操作</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((p, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="border px-2 py-1 font-medium">{p.label}</td>
                    <td className="border px-2 py-1 text-gray-500">{p.date}</td>
                    <td className="border px-2 py-1 text-center">{Object.keys(p.indicators).length}</td>
                    <td className="border px-2 py-1 text-gray-500">
                      {Object.entries(p.indicators).slice(0, 4).map(([k, v]) => `${k}:${v}`).join('，')}
                      {Object.keys(p.indicators).length > 4 && '...'}
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <button
                        onClick={() => handleRemovePeriod(i)}
                        className="text-red-400 hover:text-red-600 text-[10px]"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 分析结果 */}
      {report && (
        <div className="space-y-4">
          {/* 总体评价 */}
          <div className={`rounded-lg p-4 border-2 ${
            report.degradedIndicators.length > 0
              ? 'border-red-300 bg-red-50'
              : report.persistentExceedanceIndicators.length > 0
                ? 'border-amber-300 bg-amber-50'
                : 'border-green-300 bg-green-50'
          }`}>
            <div className="flex items-start gap-3">
              <span className="text-2xl">
                {report.degradedIndicators.length > 0 ? '⚠️' : report.persistentExceedanceIndicators.length > 0 ? '⚡' : '✅'}
              </span>
              <div className="flex-1">
                <div className="text-sm font-bold text-gray-800">{report.sourceName}</div>
                <div className="text-xs text-gray-600 mt-0.5">
                  {report.periodCount}期监测 · {report.dateRange}
                </div>
                <div className={`text-sm font-medium mt-2 ${
                  report.degradedIndicators.length > 0 ? 'text-red-700'
                    : report.persistentExceedanceIndicators.length > 0 ? 'text-amber-700' : 'text-green-700'
                }`}>
                  {report.overallAssessment}
                </div>
                {report.warnings.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {report.warnings.map((w, i) => (
                      <div key={i} className="text-[10px] text-red-600 flex items-center gap-1">
                        <span>⚠</span>
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 指标趋势汇总表 */}
          <div className="rounded-lg overflow-hidden border border-gray-200">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
              <h4 className="text-xs font-semibold text-gray-700">各指标趋势分析</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-2 py-1.5 text-left font-semibold text-gray-500">指标</th>
                    <th className="px-2 py-1.5 text-center font-semibold text-gray-500">III类标准</th>
                    <th className="px-2 py-1.5 text-center font-semibold text-gray-500">趋势</th>
                    <th className="px-2 py-1.5 text-center font-semibold text-gray-500">R²</th>
                    <th className="px-2 py-1.5 text-center font-semibold text-gray-500">最小值</th>
                    <th className="px-2 py-1.5 text-center font-semibold text-gray-500">最大值</th>
                    <th className="px-2 py-1.5 text-center font-semibold text-gray-500">平均值</th>
                    <th className="px-2 py-1.5 text-center font-semibold text-gray-500">超标率</th>
                    <th className="px-2 py-1.5 text-center font-semibold text-gray-500">等级变化</th>
                  </tr>
                </thead>
                <tbody>
                  {report.indicators.map((ind: IndicatorTrend) => (
                    <tr key={ind.indicator} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-2 py-1.5 font-medium">{ind.indicator}</td>
                      <td className="px-2 py-1.5 text-center text-gray-500">
                        {ind.standardLimit > 0 ? ind.standardLimit : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <TrendArrow trend={ind.trend} />
                      </td>
                      <td className="px-2 py-1.5 text-center text-gray-500">{ind.rSquared}</td>
                      <td className="px-2 py-1.5 text-center">{ind.minValue}</td>
                      <td className="px-2 py-1.5 text-center">{ind.maxValue}</td>
                      <td className="px-2 py-1.5 text-center">{ind.meanValue}</td>
                      <td className="px-2 py-1.5 text-center">
                        <ExceedBadge rate={ind.exceedRate} count={ind.exceedCount} total={ind.values.length} />
                      </td>
                      <td className="px-2 py-1.5 text-center text-gray-500">{ind.gradeChange}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 劣化/持续超标指标详情 */}
          {(report.degradedIndicators.length > 0 || report.persistentExceedanceIndicators.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {report.degradedIndicators.length > 0 && (
                <div className="rounded-lg p-3 bg-red-50 border border-red-200">
                  <h4 className="text-xs font-semibold text-red-700 mb-2">劣化指标（趋势上升且超标）</h4>
                  <div className="space-y-1">
                    {report.indicators
                      .filter(ind => report.degradedIndicators.includes(ind.indicator))
                      .map(ind => (
                        <div key={ind.indicator} className="text-[10px] text-red-600">
                          <strong>{ind.indicator}</strong>：斜率 {ind.slope} {'>'} 0，最新值 {ind.values[ind.values.length - 1]?.value} mg/L，标准 {ind.standardLimit} mg/L
                        </div>
                      ))}
                  </div>
                </div>
              )}
              {report.persistentExceedanceIndicators.length > 0 && (
                <div className="rounded-lg p-3 bg-amber-50 border border-amber-200">
                  <h4 className="text-xs font-semibold text-amber-700 mb-2">持续超标指标</h4>
                  <div className="space-y-1">
                    {report.indicators
                      .filter(ind => report.persistentExceedanceIndicators.includes(ind.indicator))
                      .map(ind => (
                        <div key={ind.indicator} className="text-[10px] text-amber-600">
                          <strong>{ind.indicator}</strong>：超标 {ind.exceedCount}/{ind.values.length} 期（{ind.exceedRate}%），最大值 {ind.maxValue} mg/L
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 各指标趋势可视化（迷你折线图） */}
          <div className="rounded-lg p-3 bg-white border border-gray-200">
            <h4 className="text-xs font-semibold text-gray-700 mb-3">指标浓度变化趋势</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {report.indicators.slice(0, 8).map(ind => {
                const maxVal = Math.max(...ind.values.map(v => v.value), ind.standardLimit || 0, 0.01);
                const points = ind.values.map((v, i) => {
                  const x = (i / (ind.values.length - 1 || 1)) * 100;
                  const y = 100 - (v.value / maxVal) * 90;
                  return `${x},${y}`;
                }).join(' ');
                const limitY = ind.standardLimit > 0 ? 100 - (ind.standardLimit / maxVal) * 90 : -1;
                return (
                  <div key={ind.indicator} className="space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-medium">{ind.indicator}</span>
                      <TrendArrow trend={ind.trend} />
                    </div>
                    <div className="relative h-16 bg-gray-50 rounded border border-gray-100">
                      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {limitY >= 0 && (
                          <line x1="0" y1={limitY} x2="100" y2={limitY} stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2,2" />
                        )}
                        <polyline points={points} fill="none" stroke="#3b82f6" strokeWidth="1.5" />
                        {ind.values.map((v, i) => {
                          const x = (i / (ind.values.length - 1 || 1)) * 100;
                          const y = 100 - (v.value / maxVal) * 90;
                          return <circle key={i} cx={x} cy={y} r="1.5" fill="#3b82f6" />;
                        })}
                      </svg>
                    </div>
                    <div className="flex justify-between text-[9px] text-gray-400">
                      <span>{ind.values[0]?.label}</span>
                      <span>{ind.values[ind.values.length - 1]?.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {periods.length === 0 && !report && (
        <div className="text-center py-6 text-gray-400">
          <p className="text-xs">请添加至少2期水质监测数据进行趋势分析</p>
          <p className="text-[10px] text-gray-300 mt-1">或点击"加载示例"快速体验功能</p>
        </div>
      )}
    </div>
  );
};

export default WaterQualityTrendPanel;
