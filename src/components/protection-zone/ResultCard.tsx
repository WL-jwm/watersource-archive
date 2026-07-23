/** 计算结果卡片 */

import React from 'react';
import type { CalcResult } from '@/lib/zoneCalcEngine';

function ResultCard({ result, index }: { result: CalcResult; index: number }) {
  return (
  <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
    <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-blue-800">#{index + 1}</span>
        <span className="text-sm font-semibold">{result.sourceName}</span>
        <span className="text-[10px] text-gray-500">
          {result.params.sourceType}
          {result.params.gwType ? ` · ${result.params.gwType}` : ''}
        </span>
      </div>
      <span className="text-[10px] text-gray-400">
        {new Date(result.calculatedAt).toLocaleString('zh-CN')}
      </span>
    </div>

    {result.warnings.length > 0 && (
      <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
        {result.warnings.map((w, i) => (
          <div key={i} className="text-[10px] text-amber-700 flex items-start gap-1">
            <span className="shrink-0">⚠</span>
            {w}
          </div>
        ))}
      </div>
    )}

    <div className="p-4 space-y-3">
      {result.zones.map((zone) => (
        <div
          key={zone.level}
          className={`rounded-lg p-3 border ${
            zone.level === '一级'
              ? 'border-red-200 bg-red-50/50'
              : zone.level === '二级'
                ? 'border-orange-200 bg-orange-50/50'
                : 'border-yellow-200 bg-yellow-50/50'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded ${
                  zone.level === '一级'
                    ? 'bg-red-500 text-white'
                    : zone.level === '二级'
                      ? 'bg-orange-500 text-white'
                      : 'bg-yellow-500 text-white'
                }`}
              >
                {zone.level}保护区
              </span>
              <span className="text-[10px] text-gray-500">{zone.method}</span>
            </div>
            <div className="text-right">
              <span
                className={`text-lg font-bold ${
                  zone.level === '一级'
                    ? 'text-red-700'
                    : zone.level === '二级'
                      ? 'text-orange-700'
                      : 'text-yellow-700'
                }`}
              >
                {zone.area}
              </span>
              <span className="text-xs text-gray-500 ml-0.5">km²</span>
              {zone.radius && <div className="text-[10px] text-gray-400">R = {zone.radius}m</div>}
              {zone.length && zone.width && (
                <div className="text-[10px] text-gray-400">
                  {zone.length}m × {zone.width}m
                </div>
              )}
            </div>
          </div>

          <div className="text-[11px] text-gray-600 space-y-1">
            <div>
              <span className="font-medium text-gray-700">公式：</span>
              <pre className="whitespace-pre-wrap mt-0.5 text-[10px] bg-white/60 rounded p-1.5 border">
                {zone.formula}
              </pre>
            </div>
            <div>
              <span className="font-medium text-gray-700">边界描述：</span>
              <span className="ml-1">{zone.boundaryDescription}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">参数：</span>
              <span className="ml-1">{zone.keyParams}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">依据：</span>
              <span className="ml-1">{zone.standard}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);
}

export default ResultCard;
