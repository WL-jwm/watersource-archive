/**
 * N7: PreciseCalcPanel 拆分 — 湖库参数表单
 */

import React from 'react';

interface LakeParamsProps {
  lakeArea: string; setLakeArea: (v: string) => void;
  lakeCapacity: string; setLakeCapacity: (v: string) => void;
  maxDepth: string; setMaxDepth: (v: string) => void;
  intakeType: '岸边' | '湖心' | '分层取水'; setIntakeType: (v: '岸边' | '湖心' | '分层取水') => void;
  intakeDepth: string; setIntakeDepth: (v: string) => void;
}

const LakeParams: React.FC<LakeParamsProps> = ({
  lakeArea, setLakeArea,
  lakeCapacity, setLakeCapacity,
  maxDepth, setMaxDepth,
  intakeType, setIntakeType,
  intakeDepth, setIntakeDepth,
}) => {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-gray-600 border-b pb-1">湖库参数</div>
      <div>
        <label className="text-[10px] text-gray-500">水面面积 (km²)</label>
        <input
          type="number"
          step="any"
          placeholder="如 10"
          value={lakeArea}
          onChange={(e) => setLakeArea(e.target.value)}
          className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
        />
      </div>
      <div>
        <label className="text-[10px] text-gray-500">总库容 (亿 m³)</label>
        <input
          type="number"
          step="any"
          placeholder="如 5.0"
          value={lakeCapacity}
          onChange={(e) => setLakeCapacity(e.target.value)}
          className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
        />
      </div>
      <div>
        <label className="text-[10px] text-gray-500">最大水深 (m)</label>
        <input
          type="number"
          step="any"
          placeholder="如 30"
          value={maxDepth}
          onChange={(e) => setMaxDepth(e.target.value)}
          className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
        />
      </div>
      <div>
        <label className="text-[10px] text-gray-500">取水口类型</label>
        <select
          value={intakeType}
          onChange={(e) => setIntakeType(e.target.value as '岸边' | '湖心' | '分层取水')}
          className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
        >
          <option value="湖心">湖心取水</option>
          <option value="岸边">岸边取水</option>
          <option value="分层取水">分层取水</option>
        </select>
      </div>
      {intakeType === '分层取水' && (
        <div>
          <label className="text-[10px] text-gray-500">取水层深度 (m)</label>
          <input
            type="number"
            step="any"
            placeholder="如 20"
            value={intakeDepth}
            onChange={(e) => setIntakeDepth(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
          />
        </div>
      )}
    </div>
  );
};

export default LakeParams;
