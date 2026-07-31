/**
 * S5.3: 多水源地叠加分析 — 统计信息卡片
 *
 * 展示叠加分析的汇总统计信息
 */

import React from 'react';
import type { OverlayResult } from '@/lib/multiSourceOverlayEngine';

interface OverlayStatsCardProps {
  result: OverlayResult;
}

interface StatItemProps {
  label: string;
  value: string;
  unit?: string;
  color?: string;
}

const StatItem: React.FC<StatItemProps> = ({ label, value, unit, color }) => (
  <div className="flex flex-col gap-1 p-3 bg-surface-tertiary rounded-md">
    <span className="text-xs text-text-tertiary">{label}</span>
    <div className="flex items-baseline gap-1">
      <span className={`text-lg font-semibold ${color ?? 'text-text-primary'}`}>{value}</span>
      {unit && <span className="text-xs text-text-tertiary">{unit}</span>}
    </div>
  </div>
);

const LEVEL_COLORS: Record<string, string> = {
  一级: 'text-red-600',
  二级: 'text-amber-600',
  准保护区: 'text-green-600',
};

const OverlayStatsCard: React.FC<OverlayStatsCardProps> = ({ result }) => {
  const { summary, levels, sourceCount } = result;

  return (
    <div className="bg-surface rounded-lg border border-surface-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">叠加统计</h3>
        <span className="text-xs text-text-tertiary">
          {sourceCount} 个水源地 · {new Date(result.createdAt).toLocaleString('zh-CN')}
        </span>
      </div>

      {/* 汇总统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatItem
          label="重叠对总数"
          value={String(summary.totalOverlapPairs)}
          color={summary.hasOverlapPairs > 0 ? 'text-red-600' : 'text-text-primary'}
        />
        <StatItem
          label="有重叠的对数"
          value={String(summary.hasOverlapPairs)}
          color={summary.hasOverlapPairs > 0 ? 'text-red-600' : 'text-green-600'}
        />
        <StatItem
          label="最大重叠面积"
          value={summary.maxOverlapArea.toFixed(4)}
          unit="km²"
          color={summary.maxOverlapArea > 1 ? 'text-red-600' : 'text-amber-600'}
        />
        <StatItem
          label="涉及城市"
          value={summary.cities.length > 0 ? summary.cities.join('、') : '—'}
          color="text-text-primary"
        />
      </div>

      {/* 各级别详情 */}
      {levels.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-text-secondary">各级别叠加详情</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="text-left py-1.5 px-2 text-text-tertiary font-medium">级别</th>
                  <th className="text-right py-1.5 px-2 text-text-tertiary font-medium">合并面积(km²)</th>
                  <th className="text-right py-1.5 px-2 text-text-tertiary font-medium">独立面积(km²)</th>
                  <th className="text-right py-1.5 px-2 text-text-tertiary font-medium">重叠面积(km²)</th>
                  <th className="text-right py-1.5 px-2 text-text-tertiary font-medium">重叠比例</th>
                </tr>
              </thead>
              <tbody>
                {levels.map((lv) => (
                  <tr key={lv.level} className="border-b border-surface-border last:border-b-0">
                    <td className={`py-1.5 px-2 font-medium ${LEVEL_COLORS[lv.level] ?? ''}`}>
                      {lv.level}
                    </td>
                    <td className="text-right py-1.5 px-2 text-text-primary">
                      {lv.unionArea.toFixed(4)}
                    </td>
                    <td className="text-right py-1.5 px-2 text-text-secondary">
                      {lv.sumArea.toFixed(4)}
                    </td>
                    <td className={`text-right py-1.5 px-2 ${lv.overlapArea > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {lv.overlapArea.toFixed(4)}
                    </td>
                    <td className={`text-right py-1.5 px-2 ${lv.overlapRatio > 0.1 ? 'text-red-600' : 'text-text-secondary'}`}>
                      {(lv.overlapRatio * 100).toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 警告信息 */}
      {result.warnings.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-amber-600">
            警告信息（{result.warnings.length}）
          </h4>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {result.warnings.map((w, i) => (
              <div key={i} className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                {w}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OverlayStatsCard;
