/** 快速批量计算面板 */

import React, { useState } from 'react';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';
import { calcProtectionZones, inferDefaultParams, type CalcResult } from '@/lib/zoneCalcEngine';

function QuickCalcPanel({ sources, onBatchResult }: {
  sources: WaterSourceRecord[];
  onBatchResult: (results: CalcResult[], sourceIds?: Map<string, string>) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [gwType, setGwType] = useState<'孔隙水' | '裂隙水' | '岩溶水'>('孔隙水');
  const [calcMethod, setCalcMethod] = useState<'经验值法' | '自动选择'>('自动选择');

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(sources.map((s) => s.id)));
  const clearSelect = () => setSelectedIds(new Set());

  const handleCalcAll = () => {
    if (
      sources.length === 0 ||
      !window.confirm(`确定对全部 ${sources.length} 个地下水水源地进行保护区计算？`)
    )
      return;
    const sourceIdMap = new Map<string, string>();
    const allResults = sources.map((s) => {
      const baseParams = inferDefaultParams(s.type, s.subType);
      if (baseParams.sourceType === '地下水') baseParams.gwType = gwType;
      sourceIdMap.set(s.name, s.id);
      return calcProtectionZones(s.name, baseParams);
    });
    onBatchResult(allResults, sourceIdMap);
  };

  const handleCalc = () => {
    if (selectedIds.size === 0) return;
    const selected = sources.filter((s) => selectedIds.has(s.id));
    const sourceIdMap = new Map<string, string>();
    const results = selected.map((s) => {
      const baseParams = inferDefaultParams(s.type, s.subType);
      if (baseParams.sourceType === '地下水') {
        baseParams.gwType = gwType;
      }
      sourceIdMap.set(s.name, s.id);
      return calcProtectionZones(s.name, baseParams);
    });
    onBatchResult(results, sourceIdMap);
  };

  return (
    <div className="rounded-lg p-4 bg-white border border-gray-200 space-y-3">
      <h3 className="text-sm font-semibold">快速批量计算（经验值法）</h3>
      <p className="text-xs text-gray-500">选择水源地，指定地下水类型，一键计算保护区</p>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={gwType}
          onChange={(e) => setGwType(e.target.value as typeof gwType)}
          className="text-xs border border-gray-200 rounded px-2 py-1.5"
        >
          <option value="孔隙水">孔隙水</option>
          <option value="裂隙水">裂隙水</option>
          <option value="岩溶水">岩溶水</option>
        </select>
        <button
          onClick={selectAll}
          className="text-xs px-2 py-1.5 rounded border border-gray-200 hover:bg-gray-50"
        >
          全选
        </button>
        <button
          onClick={clearSelect}
          className="text-xs px-2 py-1.5 rounded border border-gray-200 hover:bg-gray-50"
        >
          清除
        </button>
        <span className="text-xs text-gray-400">
          已选 {selectedIds.size} / {sources.length} 个
        </span>
        <button
          onClick={handleCalcAll}
          disabled={sources.length === 0}
          className="text-xs px-2 py-1.5 rounded border border-blue-200 text-blue-600 hover:bg-blue-50"
        >
          一键全部计算
        </button>
        <button
          onClick={handleCalc}
          disabled={selectedIds.size === 0}
          className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-30 ml-auto"
        >
          计算 ({selectedIds.size}个)
        </button>
      </div>

      {/* 已选水源地列表 */}
      <div className="max-h-48 overflow-y-auto border border-gray-100 rounded p-2 space-y-0.5">
        {sources.slice(0, 50).map((s) => (
          <label
            key={s.id}
            className="flex items-center gap-2 px-1 py-1 rounded hover:bg-gray-50 cursor-pointer text-xs"
          >
            <input
              type="checkbox"
              checked={selectedIds.has(s.id)}
              onChange={() => toggleSelect(s.id)}
              className="rounded border-gray-300"
            />
            <span className="text-gray-500 w-16 truncate">{s.cityName.replace('市', '')}</span>
            <span className="font-medium text-blue-800 truncate flex-1">{s.name}</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded ${
                s.level === 'municipal'
                  ? 'bg-blue-100 text-blue-700'
                  : s.level === 'county'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700'
              }`}
            >
              {{ municipal: '市级', county: '县级', township: '乡镇级' }[s.level]}
            </span>
          </label>
        ))}
        {sources.length > 50 && (
          <div className="text-xs text-gray-400 text-center py-2">仅显示前50个，更多请使用筛选</div>
        )}
      </div>
    </div>
  );
}

export default QuickCalcPanel;
