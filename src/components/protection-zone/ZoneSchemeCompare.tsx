/**
 * T2: 保护区方案对比引擎集成组件
 *
 * 集成 zoneCompareEngine，基于持久化 ZoneCalcRecord 提供：
 * 1. 从历史计算记录中选择两个方案进行对比
 * 2. 逐级面积/半径变化对比表
 * 3. 参数变化对比（高亮变更项）
 * 4. 自动生成调整说明
 * 5. 重大变化预警（面积变化>20%）
 *
 * 与现有 ComparePanel 的区别：
 * - ComparePanel 对比当前会话的 CalcResult（内存）
 * - ZoneSchemeCompare 对比持久化的 ZoneCalcRecord（IDB）
 * - 使用 zoneCompareEngine 生成更丰富的分析（参数变化/调整说明/预警）
 */

import { useToast } from '@/hooks/useToast';
import React, { useState, useMemo, useEffect } from 'react';
import { useWaterSourceStore, type ZoneCalcRecord } from '@/stores/waterSourceStore';
import { compareZoneSchemes, type ZoneComparisonResult } from '@/lib/zoneCompareEngine';

const ZoneSchemeCompare: React.FC = () => {
  const { loaded, zoneResults, loadZoneResults } = useWaterSourceStore();

  const [selectedA, setSelectedA] = useState('');
  const [selectedB, setSelectedB] = useState('');
  const [result, setResult] = useState<ZoneComparisonResult | null>(null);

  // 加载持久化结果
  useEffect(() => {
    if (loaded && zoneResults.length === 0) {
      loadZoneResults();
    }
  }, [loaded]);

  // 按水源地分组
  const groupedBySource = useMemo(() => {
    const groups: Record<string, ZoneCalcRecord[]> = {};
    zoneResults.forEach(r => {
      if (!groups[r.sourceName]) groups[r.sourceName] = [];
      groups[r.sourceName].push(r);
    });
    return groups;
  }, [zoneResults]);

  // 有多次计算的水源地（快速选择）
  const multiCalcSources = useMemo(() => {
    return Object.entries(groupedBySource)
      .filter(([, list]) => list.length >= 2)
      .sort((a, b) => b[1].length - a[1].length);
  }, [groupedBySource]);

  const toast = useToast();

  // S2.5: 导出对比结果为Excel
  const handleExportComparison = async () => {
    if (!result) return;
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    // Sheet1: 逐级面积对比
    const areaData = result.items.map(item => ({
      '保护区级别': item.level,
      '方案A面积(km²)': parseFloat(item.areaA.toFixed(4)),
      '方案B面积(km²)': parseFloat(item.areaB.toFixed(4)),
      '面积变化量(km²)': parseFloat(item.areaChange.toFixed(4)),
      '面积变化率(%)': parseFloat(item.areaChangeRate.toFixed(1)),
      '变化方向': item.direction,
      '半径A(m)': item.radiusA ?? '',
      '半径B(m)': item.radiusB ?? '',
      '半径变化(m)': item.radiusChange ?? '',
      '调整说明': item.adjustmentText,
    }));
    const ws1 = XLSX.utils.json_to_sheet(areaData);
    ws1['!cols'] = [
      { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 },
      { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 50 },
    ];
    XLSX.utils.book_append_sheet(wb, ws1, '逐级面积对比');

    // Sheet2: 参数变化对比
    if (result.paramChanges.length > 0) {
      const paramData = result.paramChanges.map(p => ({
        '参数名称': p.param,
        '方案A': p.valueA,
        '方案B': p.valueB,
        '是否变更': p.changed ? '是' : '否',
      }));
      const ws2 = XLSX.utils.json_to_sheet(paramData);
      ws2['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 30 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(wb, ws2, '参数变化对比');
    }

    // Sheet3: 方案信息与总体说明
    const summaryData = [
      { 项目: '水源地名称', 内容: result.sourceName },
      { 项目: '方案A', 内容: result.schemeALabel },
      { 项目: '方案B', 内容: result.schemeBLabel },
      { 项目: '方案A方法', 内容: result.methodA },
      { 项目: '方案B方法', 内容: result.methodB },
      { 项目: '是否有重大变化', 内容: result.hasSignificantChange ? '是（面积变化>20%）' : '否' },
      { 项目: '总体调整说明', 内容: result.overallAdjustment },
    ];
    const ws3 = XLSX.utils.json_to_sheet(summaryData);
    ws3['!cols'] = [{ wch: 16 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, ws3, '方案信息与总体说明');

    XLSX.writeFile(wb, `保护区方案对比_${result.sourceName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('对比结果已导出为Excel');
  };

  const handleCompare = () => {
    const recordA = zoneResults.find(r => r.id === selectedA);
    const recordB = zoneResults.find(r => r.id === selectedB);
    if (!recordA || !recordB) {
      toast.warning('请选择两个方案');
      return;
    }
    if (recordA.id === recordB.id) {
      toast.warning('请选择不同的方案进行对比');
      return;
    }
    const comparison = compareZoneSchemes(recordA, recordB);
    setResult(comparison);
  };

  // 快速选择同名水源地的前两次计算
  const handleQuickSelect = (sourceName: string) => {
    const list = groupedBySource[sourceName];
    if (list.length >= 2) {
      // 按时间排序，取最早和最晚
      const sorted = [...list].sort((a, b) => a.calculatedAt.localeCompare(b.calculatedAt));
      setSelectedA(sorted[0].id);
      setSelectedB(sorted[sorted.length - 1].id);
    }
  };

  if (!loaded) {
    return <div className="p-6 text-center text-gray-500">数据加载中...</div>;
  }

  if (zoneResults.length < 2) {
    return (
      <div className="rounded-lg p-6 bg-white border border-gray-200 text-center">
        <div className="text-gray-400 mb-2">暂无足够的历史计算记录</div>
        <p className="text-[10px] text-gray-400">请先在"快速计算"或"精确计算"中进行至少2次计算并保存</p>
        <p className="text-[10px] text-gray-400 mt-1">当前已保存 {zoneResults.length} 条计算记录</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg p-4 bg-white border border-gray-200 space-y-4">
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
        <div>
          <h3 className="text-sm font-semibold">历史方案对比</h3>
          <p className="text-[10px] text-gray-500">基于持久化计算记录，对比不同参数/方法下的保护区划分差异</p>
        </div>
      </div>

      {/* 快速选择：同名水源地多次计算 */}
      {multiCalcSources.length > 0 && (
        <div className="rounded-lg p-3 bg-purple-50 border border-purple-100 space-y-2">
          <div className="text-xs font-medium text-purple-700">同名水源地多次计算（点击快速对比）</div>
          <div className="flex flex-wrap gap-2">
            {multiCalcSources.slice(0, 8).map(([name, list]) => (
              <button
                key={name}
                onClick={() => handleQuickSelect(name)}
                className="text-[10px] px-2 py-1 rounded border border-purple-200 text-purple-600 hover:bg-purple-100 bg-white"
              >
                {name}（{list.length}次）
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 方案选择 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-blue-700">方案 A</label>
          <select
            value={selectedA}
            onChange={e => setSelectedA(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
          >
            <option value="">-- 选择计算记录 --</option>
            {zoneResults.map(r => (
              <option key={r.id} value={r.id}>
                {r.sourceName} · {r.calculatedAt.slice(0, 16).replace('T', ' ')} · {r.zones[0]?.method || ''}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-orange-700">方案 B</label>
          <select
            value={selectedB}
            onChange={e => setSelectedB(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
          >
            <option value="">-- 选择计算记录 --</option>
            {zoneResults.map(r => (
              <option key={r.id} value={r.id}>
                {r.sourceName} · {r.calculatedAt.slice(0, 16).replace('T', ' ')} · {r.zones[0]?.method || ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleCompare}
          disabled={!selectedA || !selectedB}
          className="flex-1 text-xs px-3 py-2 rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-30 font-medium"
        >
          执行对比分析
        </button>
        {result && (
          <button
            onClick={handleExportComparison}
            className="text-xs px-3 py-2 rounded border border-green-300 text-green-600 hover:bg-green-50 font-medium whitespace-nowrap"
          >
            导出对比Excel
          </button>
        )}
      </div>

      {/* 对比结果 */}
      {result && (
        <div className="space-y-4">
          {/* 方案信息 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg p-3 bg-blue-50 border border-blue-200">
              <div className="text-xs font-semibold text-blue-800">方案 A</div>
              <div className="text-[11px] font-medium mt-0.5">{result.sourceName}</div>
              <div className="text-[10px] text-blue-600 mt-0.5">{result.schemeALabel}</div>
              <div className="text-[10px] text-blue-500">方法：{result.methodA}</div>
            </div>
            <div className="rounded-lg p-3 bg-orange-50 border border-orange-200">
              <div className="text-xs font-semibold text-orange-800">方案 B</div>
              <div className="text-[11px] font-medium mt-0.5">{result.sourceName}</div>
              <div className="text-[10px] text-orange-600 mt-0.5">{result.schemeBLabel}</div>
              <div className="text-[10px] text-orange-500">方法：{result.methodB}</div>
            </div>
          </div>

          {/* 重大变化预警 */}
          {result.hasSignificantChange && (
            <div className="rounded-lg p-3 bg-red-50 border border-red-200 flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              <div className="text-xs text-red-700">
                <strong>重大变化预警：</strong>部分保护区面积变化超过20%，建议核查参数合理性
              </div>
            </div>
          )}

          {/* 逐级对比表 */}
          <div className="rounded-lg overflow-hidden border border-gray-200">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
              <h4 className="text-xs font-semibold text-gray-700">逐级面积对比</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left font-semibold text-gray-500">级别</th>
                    <th className="px-3 py-2 text-center font-semibold text-blue-600">方案A (km²)</th>
                    <th className="px-3 py-2 text-center font-semibold text-orange-600">方案B (km²)</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-500">变化量</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-500">变化率</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-500">方向</th>
                    {result.items.some(i => i.radiusChange != null) && (
                      <th className="px-3 py-2 text-center font-semibold text-gray-500">半径变化</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {result.items.map(item => (
                    <tr key={item.level} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded text-white ${
                          item.level === '一级' ? 'bg-red-500' : item.level === '二级' ? 'bg-orange-500' : 'bg-yellow-500'
                        }`}>
                          {item.level}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center font-medium text-blue-700">{item.areaA.toFixed(4)}</td>
                      <td className="px-3 py-2 text-center font-medium text-orange-700">{item.areaB.toFixed(4)}</td>
                      <td className={`px-3 py-2 text-center font-medium ${
                        item.areaChange > 0 ? 'text-green-600' : item.areaChange < 0 ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        {item.areaChange > 0 ? '+' : ''}{item.areaChange.toFixed(4)}
                      </td>
                      <td className={`px-3 py-2 text-center ${
                        Math.abs(item.areaChangeRate) > 20 ? 'text-red-600 font-bold' : 'text-gray-600'
                      }`}>
                        {item.areaChangeRate > 0 ? '+' : ''}{item.areaChangeRate.toFixed(1)}%
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          item.direction === '增大' ? 'bg-green-100 text-green-700'
                            : item.direction === '减小' ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {item.direction}
                        </span>
                      </td>
                      {result.items.some(i => i.radiusChange != null) && (
                        <td className="px-3 py-2 text-center text-gray-500">
                          {item.radiusChange != null ? (
                            <span className={item.radiusChange > 0 ? 'text-green-600' : item.radiusChange < 0 ? 'text-red-600' : 'text-gray-400'}>
                              {item.radiusChange > 0 ? '+' : ''}{item.radiusChange}m
                            </span>
                          ) : '—'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 面积对比可视化 */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-600">面积对比可视化</div>
            {result.items.map(item => {
              const maxArea = Math.max(item.areaA, item.areaB, 0.01);
              return (
                <div key={item.level} className="space-y-1">
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className={`font-bold w-12 ${
                      item.level === '一级' ? 'text-red-600' : item.level === '二级' ? 'text-orange-600' : 'text-yellow-600'
                    }`}>{item.level}</span>
                    <span className="text-blue-600 w-16 text-right">{item.areaA.toFixed(2)}</span>
                    <div className="flex-1 flex flex-col gap-0.5">
                      <div className="h-3 bg-gray-100 rounded overflow-hidden">
                        <div className="h-full bg-blue-400 rounded" style={{ width: `${(item.areaA / maxArea) * 100}%` }} />
                      </div>
                      <div className="h-3 bg-gray-100 rounded overflow-hidden">
                        <div className="h-full bg-orange-400 rounded" style={{ width: `${(item.areaB / maxArea) * 100}%` }} />
                      </div>
                    </div>
                    <span className="text-orange-600 w-16">{item.areaB.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 参数变化对比 */}
          {result.paramChanges.length > 0 && (
            <div className="rounded-lg overflow-hidden border border-gray-200">
              <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
                <h4 className="text-xs font-semibold text-amber-700">参数变化对比（仅显示变更项）</h4>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left font-semibold text-gray-500">参数</th>
                    <th className="px-3 py-2 text-center font-semibold text-blue-600">方案A</th>
                    <th className="px-3 py-2 text-center font-semibold text-orange-600">方案B</th>
                  </tr>
                </thead>
                <tbody>
                  {result.paramChanges.map(p => (
                    <tr key={p.param} className="border-t border-gray-100">
                      <td className="px-3 py-1.5 font-medium">{p.param}</td>
                      <td className="px-3 py-1.5 text-center text-blue-700">{p.valueA}</td>
                      <td className="px-3 py-1.5 text-center text-orange-700 font-medium">{p.valueB}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 逐级调整说明 */}
          <div className="rounded-lg p-3 bg-gray-50 border border-gray-200">
            <h4 className="text-xs font-semibold text-gray-700 mb-2">逐级调整说明</h4>
            <div className="space-y-1">
              {result.items.map(item => (
                <div key={item.level} className="text-[10px] text-gray-600 flex items-start gap-2">
                  <span className={`font-bold shrink-0 ${
                    item.direction === '增大' ? 'text-green-600' : item.direction === '减小' ? 'text-red-600' : 'text-gray-400'
                  }`}>
                    {item.level}：
                  </span>
                  <span>{item.adjustmentText}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 总体调整说明 */}
          <div className={`rounded-lg p-3 border-2 ${
            result.hasSignificantChange ? 'border-red-200 bg-red-50' : 'border-purple-200 bg-purple-50'
          }`}>
            <div className="text-xs font-semibold text-gray-700 mb-1">总体调整说明</div>
            <div className={`text-[11px] leading-relaxed ${
              result.hasSignificantChange ? 'text-red-700' : 'text-purple-700'
            }`}>
              {result.overallAdjustment}
            </div>
          </div>
        </div>
      )}

      {!result && zoneResults.length >= 2 && (
        <div className="text-center py-4">
          <p className="text-xs text-gray-400">从上方下拉框选择两个历史计算记录进行对比</p>
        </div>
      )}
    </div>
  );
};

export default ZoneSchemeCompare;
