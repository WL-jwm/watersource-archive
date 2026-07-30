/**
 * 计算结果卡片
 *
 * S2.4: 支持手动调整保护区半径/面积
 * - 点击半径/面积值进入编辑模式
 * - 修改半径 → 自动重算面积 (π × r² / 1e6 km²)
 * - 修改面积 → 反推半径 (√(面积 × 1e6 / π) m)
 * - 显示"已手动调整"标记
 * - 支持恢复计算值
 */

import React, { useState } from 'react';
import type { CalcResult, ZoneResult } from '@/lib/zoneCalcEngine';

interface AdjustedZone {
  radius?: number;
  area?: number;
}

interface ResultCardProps {
  result: CalcResult;
  index: number;
  onAdjust?: (resultIndex: number, zoneLevel: string, adjustments: AdjustedZone) => void;
}

function ResultCard({ result, index, onAdjust }: ResultCardProps) {
  // S2.4: 手动调整状态 — key: zone.level
  const [adjustments, setAdjustments] = useState<Record<string, AdjustedZone>>({});
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const getDisplayRadius = (zone: ZoneResult): number | undefined => {
    const adj = adjustments[zone.level];
    if (adj?.radius != null) return adj.radius;
    return zone.radius;
  };

  const getDisplayArea = (zone: ZoneResult): number => {
    const adj = adjustments[zone.level];
    if (adj?.area != null) return adj.area;
    return zone.area;
  };

  const isAdjusted = (zone: ZoneResult): boolean => {
    return !!adjustments[zone.level];
  };

  const handleStartEdit = (zone: ZoneResult, field: 'radius' | 'area') => {
    const key = `${zone.level}-${field}`;
    const currentVal = field === 'radius' ? getDisplayRadius(zone) : getDisplayArea(zone);
    setEditValue(currentVal != null ? String(currentVal) : '');
    setEditingField(key);
  };

  const handleCommitEdit = (zone: ZoneResult, field: 'radius' | 'area') => {
    const numVal = parseFloat(editValue);
    if (isNaN(numVal) || numVal < 0) {
      setEditingField(null);
      return;
    }

    let newAdjustments: AdjustedZone = {};
    if (field === 'radius') {
      // 修改半径 → 重算面积 (圆形: A = π × r² / 1e6)
      const newArea = (Math.PI * numVal * numVal) / 1e6;
      newAdjustments = { radius: numVal, area: parseFloat(newArea.toFixed(4)) };
    } else {
      // 修改面积 → 反推半径 (r = √(A × 1e6 / π))
      const newRadius = Math.sqrt((numVal * 1e6) / Math.PI);
      newAdjustments = { area: numVal, radius: parseFloat(newRadius.toFixed(1)) };
    }

    setAdjustments((prev) => ({
      ...prev,
      [zone.level]: newAdjustments,
    }));

    if (onAdjust) {
      onAdjust(index, zone.level, newAdjustments);
    }

    setEditingField(null);
  };

  const handleResetZone = (zone: ZoneResult) => {
    setAdjustments((prev) => {
      const next = { ...prev };
      delete next[zone.level];
      return next;
    });
  };

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
        {result.zones.map((zone) => {
          const displayRadius = getDisplayRadius(zone);
          const displayArea = getDisplayArea(zone);
          const adjusted = isAdjusted(zone);
          const radiusKey = `${zone.level}-radius`;
          const areaKey = `${zone.level}-area`;

          return (
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
                  {adjusted && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-600 font-medium">
                      已手动调整
                    </span>
                  )}
                </div>
                <div className="text-right">
                  {/* S2.4: 面积可编辑 */}
                  {editingField === areaKey ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.0001"
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleCommitEdit(zone, 'area')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCommitEdit(zone, 'area');
                          if (e.key === 'Escape') setEditingField(null);
                        }}
                        className="w-20 text-sm border border-blue-300 rounded px-1 py-0.5 text-right"
                      />
                      <span className="text-xs text-gray-500">km²</span>
                    </div>
                  ) : (
                    <span
                      className={`text-lg font-bold cursor-text rounded px-1 hover:bg-white/60 ${
                        zone.level === '一级'
                          ? 'text-red-700'
                          : zone.level === '二级'
                            ? 'text-orange-700'
                            : 'text-yellow-700'
                      } ${adjusted ? 'text-purple-600' : ''}`}
                      onClick={() => handleStartEdit(zone, 'area')}
                      title="点击编辑面积"
                    >
                      {displayArea}
                    </span>
                  )}
                  <span className="text-xs text-gray-500 ml-0.5">km²</span>
                  {/* S2.4: 半径可编辑 */}
                  {displayRadius != null && (
                    <div className="text-[10px] text-gray-400">
                      {editingField === radiusKey ? (
                        <div className="flex items-center gap-1 justify-end">
                          <span>R =</span>
                          <input
                            type="number"
                            step="1"
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => handleCommitEdit(zone, 'radius')}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCommitEdit(zone, 'radius');
                              if (e.key === 'Escape') setEditingField(null);
                            }}
                            className="w-16 text-[10px] border border-blue-300 rounded px-1 py-0.5 text-right"
                          />
                          <span>m</span>
                        </div>
                      ) : (
                        <span
                          className="cursor-text hover:text-blue-500 hover:underline"
                          onClick={() => handleStartEdit(zone, 'radius')}
                          title="点击编辑半径"
                        >
                          R = {displayRadius}m
                        </span>
                      )}
                    </div>
                  )}
                  {zone.length && zone.width && (
                    <div className="text-[10px] text-gray-400">
                      {zone.length}m × {zone.width}m
                    </div>
                  )}
                  {adjusted && (
                    <button
                      onClick={() => handleResetZone(zone)}
                      className="text-[9px] text-gray-400 hover:text-red-500 mt-0.5"
                    >
                      ↺ 恢复计算值
                    </button>
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
          );
        })}
      </div>
    </div>
  );
}

export default ResultCard;
