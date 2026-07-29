/**
 * N7: PreciseCalcPanel 拆分 — 地下水参数表单
 */

import React from 'react';

interface GroundwaterParamsProps {
  K: string; setK: (v: string) => void;
  M: string; setM: (v: string) => void;
  T: string; setT: (v: string) => void;
  S: string; setS: (v: string) => void;
  I: string; setI: (v: string) => void;
  ne: string; setNe: (v: string) => void;
}

const fields = [
  { key: 'K', label: '渗透系数 K (m/d)', placeholder: '如 15' },
  { key: 'M', label: '含水层厚度 M (m)', placeholder: '如 30' },
  { key: 'T', label: '导水系数 T (m²/d)', placeholder: '如 450（可由K×M算得）' },
  { key: 'S', label: '储水系数 S（给水度）', placeholder: '如 0.15' },
  { key: 'I', label: '水力坡度 I', placeholder: '如 0.002' },
  { key: 'ne', label: '有效孔隙度 n', placeholder: '如 0.25' },
] as const;

const GroundwaterParams: React.FC<GroundwaterParamsProps> = (props) => {
  const setters: Record<string, (v: string) => void> = {
    K: props.setK, M: props.setM, T: props.setT, S: props.setS, I: props.setI, ne: props.setNe,
  };
  const values: Record<string, string> = {
    K: props.K, M: props.M, T: props.T, S: props.S, I: props.I, ne: props.ne,
  };

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-gray-600 border-b pb-1">
        水文地质参数（解析法需要）
      </div>
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
    </div>
  );
};

export default GroundwaterParams;
