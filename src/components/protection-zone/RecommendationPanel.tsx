/**
 * N7: PreciseCalcPanel 拆分 — 智能推荐信息面板
 *
 * 展示推荐参数范围，支持填入中间值或上限（保守方案）
 */

import React from 'react';
import type { RecommendedParams } from './calcRecommendations';

interface RecommendationPanelProps {
  recommendation: RecommendedParams;
  sourceLabel: string;
  sourceType: '地下水' | '地表水';
  swType: '河流型' | '湖库型';
  onApplyMid: () => void;
  onApplyConservative: () => void;
  onClose: () => void;
}

/** 从范围字符串提取中间值或上限 */
function extractValue(range: string | undefined, mode: 'mid' | 'upper'): string {
  if (!range) return '';
  const parts = range.split('~');
  if (parts.length === 2) {
    const low = parseFloat(parts[0]?.trim());
    const high = parseFloat(parts[1]?.trim());
    if (mode === 'mid' && !isNaN(low) && !isNaN(high)) {
      return ((low + high) / 2).toFixed(4).replace(/\.?0+$/, '');
    }
    return parts[1]?.trim() || parts[0]?.trim() || '';
  }
  return parts[0]?.trim() || '';
}

function ParamCard({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null;
  return (
    <div className="bg-white rounded px-2 py-1 border border-emerald-100">
      <div className="text-gray-400">{label}</div>
      <div className="font-medium text-gray-700">{value}</div>
    </div>
  );
}

const RecommendationPanel: React.FC<RecommendationPanelProps> = ({
  recommendation,
  sourceLabel,
  sourceType,
  swType,
  onApplyMid,
  onApplyConservative,
  onClose,
}) => {
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-emerald-800">参数推荐</span>
          <span className="text-[10px] text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">
            {sourceLabel}
          </span>
        </div>
        <button onClick={onClose} className="text-[10px] text-gray-400 hover:text-gray-600">
          关闭
        </button>
      </div>
      <p className="text-[10px] text-gray-600 leading-relaxed">{recommendation.description}</p>

      {sourceType === '地下水' && (
        <div className="grid grid-cols-3 gap-1.5 text-[10px]">
          <ParamCard label="K (m/d)" value={recommendation.K} />
          <ParamCard label="M (m)" value={recommendation.M} />
          <ParamCard label="S" value={recommendation.S} />
          <ParamCard label="I" value={recommendation.I} />
          <ParamCard label="n" value={recommendation.ne} />
        </div>
      )}

      {sourceType === '地表水' && swType === '河流型' && (
        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
          <ParamCard label="流量 (m³/s)" value={recommendation.riverFlow} />
          <ParamCard label="河宽 (m)" value={recommendation.riverWidth} />
          <ParamCard label="水深 (m)" value={recommendation.riverDepth} />
          <ParamCard label="比降 (‰)" value={recommendation.riverSlope} />
        </div>
      )}

      {sourceType === '地表水' && swType === '湖库型' && recommendation.lakeArea && (
        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
          <ParamCard label="面积 (km²)" value={recommendation.lakeArea} />
          <ParamCard label="库容 (亿m³)" value={recommendation.lakeCapacity} />
          <ParamCard label="最大水深 (m)" value={recommendation.maxDepth} />
          <ParamCard label="取水口" value={recommendation.intakeType} />
        </div>
      )}

      <div className="text-[9px] text-gray-400 italic">依据：{recommendation.basis}</div>
      <div className="flex items-center gap-2">
        <button
          onClick={onApplyMid}
          className="text-[10px] px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 font-medium"
        >
          填入中间值
        </button>
        <button
          onClick={onApplyConservative}
          className="text-[10px] px-3 py-1.5 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-100 font-medium"
        >
          填入上限（保守）
        </button>
        <button onClick={onClose} className="text-[10px] px-2 py-1.5 text-gray-500 hover:text-gray-700">
          取消
        </button>
      </div>
    </div>
  );
};

export default RecommendationPanel;
export { extractValue };
