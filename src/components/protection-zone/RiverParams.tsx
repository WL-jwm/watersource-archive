/**
 * N7: PreciseCalcPanel 拆分 — 河流参数表单
 */

import React from 'react';

interface RiverParamsProps {
  riverFlow: string; setRiverFlow: (v: string) => void;
  riverWidth: string; setRiverWidth: (v: string) => void;
  riverDepth: string; setRiverDepth: (v: string) => void;
  riverSlope: string; setRiverSlope: (v: string) => void;
  isTidal: boolean; setIsTidal: (v: boolean) => void;
  tidalUpstreamDistance: string; setTidalUpstreamDistance: (v: string) => void;
  hasTributary: boolean; setHasTributary: (v: boolean) => void;
}

const fields = [
  { key: 'riverFlow', label: '平均流量 (m³/s)', placeholder: '如 50' },
  { key: 'riverWidth', label: '平均河宽 (m)', placeholder: '如 100' },
  { key: 'riverDepth', label: '平均水深 (m)', placeholder: '如 3' },
  { key: 'riverSlope', label: '河床纵比降 (‰)', placeholder: '如 0.5' },
] as const;

const RiverParams: React.FC<RiverParamsProps> = (props) => {
  const setters: Record<string, (v: string) => void> = {
    riverFlow: props.setRiverFlow,
    riverWidth: props.setRiverWidth,
    riverDepth: props.setRiverDepth,
    riverSlope: props.setRiverSlope,
  };
  const values: Record<string, string> = {
    riverFlow: props.riverFlow,
    riverWidth: props.riverWidth,
    riverDepth: props.riverDepth,
    riverSlope: props.riverSlope,
  };

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-gray-600 border-b pb-1">河流参数</div>
      {fields.map((f) => (
        <div key={f.key}>
          <label className="text-[10px] text-gray-500">{f.label}</label>
          <input
            type="number"
            step="any"
            placeholder={f.placeholder}
            value={values[f.key]}
            onChange={(e) => setters[f.key](e.target.value)}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
          />
        </div>
      ))}
      {/* 潮汐 + 支流 */}
      <div className="flex items-center gap-2 pt-1">
        <label className="flex items-center gap-1 text-[10px] text-gray-600">
          <input
            type="checkbox"
            checked={props.isTidal}
            onChange={(e) => props.setIsTidal(e.target.checked)}
            className="w-3 h-3"
          />
          潮汐河段
        </label>
        <label className="flex items-center gap-1 text-[10px] text-gray-600">
          <input
            type="checkbox"
            checked={props.hasTributary}
            onChange={(e) => props.setHasTributary(e.target.checked)}
            className="w-3 h-3"
          />
          有支流汇入
        </label>
      </div>
      {props.isTidal && (
        <div>
          <label className="text-[10px] text-gray-500">潮汐上溯距离 (m)</label>
          <input
            type="number"
            step="any"
            placeholder="如 500"
            value={props.tidalUpstreamDistance}
            onChange={(e) => props.setTidalUpstreamDistance(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
          />
        </div>
      )}
    </div>
  );
};

export default RiverParams;
