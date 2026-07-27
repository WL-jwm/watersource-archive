/**
 * T7: 敏感性分析面板（从 ProtectionZoneCalc 拆分）
 */

import React, { useState } from 'react';
import { analyzeSensitivity, toChartData, type SensitivityResult } from '@/lib/sensitivityEngine';
import type { CalcResult } from '@/lib/zoneCalcEngine';

interface SensitivityPanelProps {
  results: CalcResult[];
}

const SensitivityPanel: React.FC<SensitivityPanelProps> = ({ results }) => {
  const [sensitivityResult, setSensitivityResult] = useState<SensitivityResult | null>(null);

  if (results.length === 0 || results[results.length - 1].params.sourceType !== '地下水') {
    return null;
  }

  return (
    <div className="rounded-lg p-4 bg-white border border-amber-200 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
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
                <div className={`text-xs font-bold ${
                  curve.sensitivityLevel === '高' ? 'text-red-600'
                    : curve.sensitivityLevel === '中' ? 'text-amber-600' : 'text-green-600'
                }`}>
                  {curve.paramKey}
                </div>
                <div className="text-[9px] text-gray-500">{curve.paramName}</div>
                <div className={`text-[9px] font-medium mt-0.5 ${
                  curve.sensitivityLevel === '高' ? 'text-red-500'
                    : curve.sensitivityLevel === '中' ? 'text-amber-500' : 'text-green-500'
                }`}>
                  {curve.sensitivityLevel}敏感度
                </div>
              </div>
            ))}
          </div>

          {/* 敏感度曲线图表 */}
          {sensitivityResult.curves.slice(0, 2).map((curve, ci) => {
            const chartData = toChartData(curve);
            const maxArea = Math.max(...chartData.map((d) => d.area2), 0.001);
            return (
              <div key={ci} className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-medium text-gray-700">
                    {curve.paramName}（{curve.paramKey}）对二级保护区面积影响
                  </span>
                  <span className="text-gray-400">基准值: {curve.baseValue} {curve.unit}</span>
                </div>
                <div className="flex items-end gap-px h-20 bg-gray-50 rounded p-1">
                  {chartData.map((d, di) => (
                    <div key={di} className="flex-1 flex flex-col items-center justify-end h-full group relative">
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
                  <span>{curve.range[1]} {curve.unit}</span>
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
  );
};

export default SensitivityPanel;
