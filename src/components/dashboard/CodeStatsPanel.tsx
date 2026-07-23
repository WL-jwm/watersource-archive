import React from 'react';
import { batchGenerateCodes, summarizeCodes } from '@/lib/waterSourceCoder';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';

const CodeStatsPanel: React.FC<{ loaded: boolean; sources: WaterSourceRecord[] }> = ({ loaded, sources }) => {
  if (!loaded) return null;

  const codeMap = batchGenerateCodes(sources);
  const codeStats = summarizeCodes(codeMap);

  return (
    <div className="rounded-lg p-4 md:p-6 bg-white border border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base md:text-lg font-semibold">水源地编码统计</h2>
        <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">
          SD + 行政区划(6) + 类型(1) + 级别(1) + 序号(3)
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <div className="bg-blue-50 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-blue-600">{codeStats.total}</div>
          <div className="text-[9px] text-blue-400">已编码水源地</div>
        </div>
        <div className="bg-green-50 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-green-600">{codeStats.byCity.length}</div>
          <div className="text-[9px] text-green-400">覆盖城市</div>
        </div>
        <div className="bg-amber-50 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-amber-600">
            {codeStats.byType.find((t) => t.type === '地下水')?.count || 0}
          </div>
          <div className="text-[9px] text-amber-400">地下水</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-2 text-center">
          <div className="text-lg font-bold text-purple-600">
            {codeStats.byType.find((t) => t.type === '地表水')?.count || 0}
          </div>
          <div className="text-[9px] text-purple-400">地表水</div>
        </div>
      </div>
      {/* 编码示例 */}
      <div className="text-xs text-gray-500 space-y-1 bg-gray-50 rounded-lg p-3">
        <div className="font-medium text-gray-600">编码示例：</div>
        <code className="text-[10px] bg-white px-2 py-1 rounded border">
          SD130100-1-1-001 → 石家庄市(130100) + 地下水(1) + 市级(1) + 001号
        </code>
        <code className="text-[10px] bg-white px-2 py-1 rounded border ml-2">
          SD130200-2-2-003 → 唐山市(130200) + 地表水(2) + 县级(2) + 003号
        </code>
      </div>
    </div>
  );
};

export default CodeStatsPanel;
