/** 方案对比面板 */

import React, { useState, useMemo } from 'react';
import type { CalcResult, ZoneResult } from '@/lib/zoneCalcEngine';

function ComparePanel({ results }: { results: CalcResult[] }) {
  const [selectedResults, setSelectedResults] = useState<[number, number]>([-1, -1]);
  const [compareName, setCompareName] = useState('');

  // 按名称分组
  const groupedResults = useMemo(() => {
    const groups: Record<string, CalcResult[]> = {};
    results.forEach((r, idx) => {
      if (!groups[r.sourceName]) groups[r.sourceName] = [];
      groups[r.sourceName].push({ ...r, _idx: idx } as CalcResult & { _idx: number });
    });
    return groups;
  }, [results]);

  // 有多次计算的水源地
  const multiCalcSources = useMemo(() => {
    return Object.entries(groupedResults)
      .filter(([, list]) => list.length >= 2)
      .sort((a, b) => b[1].length - a[1].length);
  }, [groupedResults]);

  // 对比数据
  const comparison = useMemo(() => {
    if (selectedResults[0] < 0 || selectedResults[1] < 0) return null;
    const r1 = results[selectedResults[0]];
    const r2 = results[selectedResults[1]];
    if (!r1 || !r2) return null;

    const zones: Array<{
      level: string;
      area1: number;
      area2: number;
      diff: number;
      diffPct: number;
      method1: string;
      method2: string;
      r1: ZoneResult;
      r2: ZoneResult;
    }> = [];

    const levels = ['一级', '二级', '准保护区'];
    for (const lv of levels) {
      const z1 = r1.zones.find((z) => z.level === lv);
      const z2 = r2.zones.find((z) => z.level === lv);
      if (z1 || z2) {
        const a1 = z1?.area || 0;
        const a2 = z2?.area || 0;
        zones.push({
          level: lv,
          area1: a1,
          area2: a2,
          diff: a2 - a1,
          diffPct: a1 > 0 ? ((a2 - a1) / a1) * 100 : a2 > 0 ? 100 : 0,
          method1: z1?.method || '-',
          method2: z2?.method || '-',
          r1: z1!,
          r2: z2!,
        });
      }
    }

    return { r1, r2, zones };
  }, [selectedResults, results]);

  if (results.length < 2) {
    return (
      <div className="rounded-lg p-6 bg-white border border-gray-200 text-center">
        <div className="text-gray-400 mb-2">暂无足够数据进行对比</div>
        <p className="text-[10px] text-gray-400">请先在快速计算或精确计算中生成至少2个计算结果</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg p-4 bg-white border border-gray-200 space-y-3">
      <h3 className="text-sm font-semibold">方案对比</h3>
      <p className="text-xs text-gray-500">选择两次计算结果，并排对比保护区划分方案的差异</p>

      {/* 快速选择：同名水源地的多次计算 */}
      {multiCalcSources.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-600">同名水源地多次计算（快速选择）</div>
          {multiCalcSources.slice(0, 5).map(([name, list]) => (
            <div key={name} className="flex items-center gap-2 text-xs">
              <span className="text-gray-500 truncate w-48">{name}</span>
              <span className="text-[10px] text-gray-400">{list.length}次计算</span>
              <div className="flex gap-1 ml-auto">
                <select
                  className="text-[10px] border border-gray-200 rounded px-1 py-0.5"
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    setSelectedResults((prev) => [v, prev[1]]);
                    setCompareName(name);
                  }}
                >
                  <option value="-1">方案A</option>
                  {list.map((r, i) => (
                    <option key={i} value={(r as any)._idx}>
                      {r.params.gwType || r.params.swType || ''} ·{' '}
                      {new Date(r.calculatedAt).toLocaleString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </option>
                  ))}
                </select>
                <span className="text-gray-300">vs</span>
                <select
                  className="text-[10px] border border-gray-200 rounded px-1 py-0.5"
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    setSelectedResults((prev) => [prev[0], v]);
                    setCompareName(name);
                  }}
                >
                  <option value="-1">方案B</option>
                  {list.map((r, i) => (
                    <option key={i} value={(r as any)._idx}>
                      {r.params.gwType || r.params.swType || ''} ·{' '}
                      {new Date(r.calculatedAt).toLocaleString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 自由选择：从全部结果中选择任意两个 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-blue-700">方案 A</label>
          <select
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
            value={selectedResults[0]}
            onChange={(e) => setSelectedResults((prev) => [parseInt(e.target.value), prev[1]])}
          >
            <option value={-1}>-- 选择计算结果 --</option>
            {results.map((r, i) => (
              <option key={i} value={i}>
                #{i + 1} {r.sourceName} ({r.params.gwType || r.params.swType || r.params.sourceType}
                )
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-orange-700">方案 B</label>
          <select
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
            value={selectedResults[1]}
            onChange={(e) => setSelectedResults((prev) => [prev[0], parseInt(e.target.value)])}
          >
            <option value={-1}>-- 选择计算结果 --</option>
            {results.map((r, i) => (
              <option key={i} value={i}>
                #{i + 1} {r.sourceName} ({r.params.gwType || r.params.swType || r.params.sourceType}
                )
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 对比结果 */}
      {comparison && (
        <div className="space-y-3">
          {/* 方案信息头 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg p-2.5 bg-blue-50 border border-blue-200 space-y-1">
              <div className="text-xs font-semibold text-blue-800">方案 A</div>
              <div className="text-[11px] font-medium">{comparison.r1.sourceName}</div>
              <div className="text-[10px] text-blue-600">
                {comparison.r1.params.sourceType === '地下水'
                  ? `${comparison.r1.params.gwType || ''} ${comparison.r1.params.permeability ? `K=${comparison.r1.params.permeability}m/d` : ''} ${comparison.r1.params.aquiferThickness ? `M=${comparison.r1.params.aquiferThickness}m` : ''} ${comparison.r1.params.transmissivity ? `T=${comparison.r1.params.transmissivity}m²/d` : ''}`
                  : `${comparison.r1.params.swType || ''} ${comparison.r1.params.riverFlow ? `Q=${comparison.r1.params.riverFlow}m³/s` : ''}`}
              </div>
            </div>
            <div className="rounded-lg p-2.5 bg-orange-50 border border-orange-200 space-y-1">
              <div className="text-xs font-semibold text-orange-800">方案 B</div>
              <div className="text-[11px] font-medium">{comparison.r2.sourceName}</div>
              <div className="text-[10px] text-orange-600">
                {comparison.r2.params.sourceType === '地下水'
                  ? `${comparison.r2.params.gwType || ''} ${comparison.r2.params.permeability ? `K=${comparison.r2.params.permeability}m/d` : ''} ${comparison.r2.params.aquiferThickness ? `M=${comparison.r2.params.aquiferThickness}m` : ''} ${comparison.r2.params.transmissivity ? `T=${comparison.r2.params.transmissivity}m²/d` : ''}`
                  : `${comparison.r2.params.swType || ''} ${comparison.r2.params.riverFlow ? `Q=${comparison.r2.params.riverFlow}m³/s` : ''}`}
              </div>
            </div>
          </div>

          {/* 面积对比表 */}
          <div className="rounded-lg overflow-hidden border border-gray-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">级别</th>
                  <th className="px-3 py-2 text-center font-semibold text-blue-600">方案A (km²)</th>
                  <th className="px-3 py-2 text-center font-semibold text-orange-600">
                    方案B (km²)
                  </th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-500">差异 (km²)</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-500">差异 (%)</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-500">方法对比</th>
                </tr>
              </thead>
              <tbody>
                {comparison.zones.map((z) => (
                  <tr key={z.level} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <span
                        className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          z.level === '一级'
                            ? 'bg-red-500 text-white'
                            : z.level === '二级'
                              ? 'bg-orange-500 text-white'
                              : 'bg-yellow-500 text-white'
                        }`}
                      >
                        {z.level}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center font-medium text-blue-700">
                      {z.area1.toFixed(4)}
                    </td>
                    <td className="px-3 py-2 text-center font-medium text-orange-700">
                      {z.area2.toFixed(4)}
                    </td>
                    <td
                      className={`px-3 py-2 text-center font-medium ${
                        z.diff > 0
                          ? 'text-green-600'
                          : z.diff < 0
                            ? 'text-red-600'
                            : 'text-gray-500'
                      }`}
                    >
                      {z.diff > 0 ? '+' : ''}
                      {z.diff.toFixed(4)}
                    </td>
                    <td
                      className={`px-3 py-2 text-center ${
                        Math.abs(z.diffPct) > 50 ? 'text-red-600 font-bold' : 'text-gray-600'
                      }`}
                    >
                      {z.area1 > 0 ? `${z.diffPct > 0 ? '+' : ''}${z.diffPct.toFixed(1)}%` : '-'}
                    </td>
                    <td className="px-3 py-2 text-center text-[10px] text-gray-500">
                      {z.method1} vs {z.method2}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 可视化对比：面积条形图 */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-600">面积对比可视化</div>
            {comparison.zones.map((z) => {
              const maxArea = Math.max(z.area1, z.area2, 0.01);
              return (
                <div key={z.level} className="space-y-1">
                  <div className="flex items-center gap-2 text-[10px]">
                    <span
                      className={`font-bold w-10 ${
                        z.level === '一级'
                          ? 'text-red-600'
                          : z.level === '二级'
                            ? 'text-orange-600'
                            : 'text-yellow-600'
                      }`}
                    >
                      {z.level}
                    </span>
                    <span className="text-blue-600 w-16 text-right">{z.area1.toFixed(2)}</span>
                    <div className="flex-1 flex flex-col gap-0.5">
                      <div className="h-3 bg-gray-100 rounded overflow-hidden">
                        <div
                          className="h-full bg-blue-400 rounded"
                          style={{ width: `${(z.area1 / maxArea) * 100}%` }}
                        />
                      </div>
                      <div className="h-3 bg-gray-100 rounded overflow-hidden">
                        <div
                          className="h-full bg-orange-400 rounded"
                          style={{ width: `${(z.area2 / maxArea) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-orange-600 w-16">{z.area2.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 公式对比 */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-gray-600">公式对比</div>
            {comparison.zones.map((z) => (
              <div
                key={z.level}
                className={`rounded-lg p-2 border ${
                  z.level === '一级'
                    ? 'border-red-200'
                    : z.level === '二级'
                      ? 'border-orange-200'
                      : 'border-yellow-200'
                }`}
              >
                <div
                  className={`text-[10px] font-bold mb-1 ${
                    z.level === '一级'
                      ? 'text-red-600'
                      : z.level === '二级'
                        ? 'text-orange-600'
                        : 'text-yellow-600'
                  }`}
                >
                  {z.level}保护区
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                  <div className="bg-blue-50/50 rounded p-1.5">
                    <div className="text-gray-400 mb-0.5">方案A</div>
                    <pre className="whitespace-pre-wrap text-[9px] text-gray-700">
                      {z.r1?.formula || '未计算'}
                    </pre>
                    {z.r1?.keyParams && (
                      <div className="text-gray-500 mt-1">参数: {z.r1.keyParams}</div>
                    )}
                  </div>
                  <div className="bg-orange-50/50 rounded p-1.5">
                    <div className="text-gray-400 mb-0.5">方案B</div>
                    <pre className="whitespace-pre-wrap text-[9px] text-gray-700">
                      {z.r2?.formula || '未计算'}
                    </pre>
                    {z.r2?.keyParams && (
                      <div className="text-gray-500 mt-1">参数: {z.r2.keyParams}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 方法差异分析 */}
          <div className="rounded-lg p-3 bg-purple-50 border border-purple-200">
            <div className="text-xs font-semibold text-purple-800 mb-2">差异分析</div>
            <div className="text-[10px] text-gray-600 space-y-1">
              {comparison.zones.some((z) => z.method1 !== z.method2) && (
                <p>
                  <strong>方法差异：</strong>
                  {comparison.zones
                    .filter((z) => z.method1 !== z.method2)
                    .map((z) => `${z.level}保护区（${z.method1} vs ${z.method2}）`)
                    .join('；')}
                </p>
              )}
              {comparison.zones.some((z) => Math.abs(z.diffPct) > 100) && (
                <p className="text-red-600">
                  <strong>显著差异：</strong>
                  {comparison.zones
                    .filter((z) => Math.abs(z.diffPct) > 100)
                    .map((z) => `${z.level}保护区差异${Math.abs(z.diffPct).toFixed(0)}%`)
                    .join('；')}
                  ，建议核查参数合理性。
                </p>
              )}
              {comparison.zones.every(
                (z) => z.method1 === z.method2 && Math.abs(z.diffPct) <= 20,
              ) && (
                <p className="text-green-600">
                  两方案计算结果接近（差异均 &lt; 20%），结果可信度较高。
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {!comparison && multiCalcSources.length === 0 && (
        <div className="text-center py-4">
          <p className="text-xs text-gray-400">从上方下拉框中选择两个方案进行对比</p>
          <p className="text-[10px] text-gray-300 mt-1">
            提示：对同一水源地用不同参数分别计算后，可在此对比结果
          </p>
        </div>
      )}
    </div>
  );
};

// ===== 主页面 =====

export default ComparePanel;
