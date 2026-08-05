/* ===== S12.9: 地图空间查询面板 =====
 * 显示地图点击位置的综合空间分析结果（邻近检索+风险+敏感目标）
 */
import React from 'react';
import {
  querySpatialContext,
  type SpatialQueryResult,
} from '@/lib/spatialQueryEngine';
import { riskLevelColor } from '@/lib/riskMatrixEngine';
import type { QuerySource } from '@/lib/spatialQueryEngine';
import type { SensitiveTarget } from '@/lib/sensitiveScreeningEngine';

interface SpatialQueryPanelProps {
  /** 查询点 */
  lng: number;
  lat: number;
  /** 水源地数据 */
  sources: QuerySource[];
  /** 敏感目标 */
  sensitiveTargets?: SensitiveTarget[];
  onClose: () => void;
}

const SpatialQueryPanel: React.FC<SpatialQueryPanelProps> = ({
  lng,
  lat,
  sources,
  sensitiveTargets,
  onClose,
}) => {
  const result: SpatialQueryResult = querySpatialContext({
    lng,
    lat,
    sources,
    sensitiveTargets,
  });

  const riskClasses: Record<string, string> = {
    red: 'bg-red-600',
    yellow: 'bg-amber-500',
    green: 'bg-green-600',
  };

  return (
    <div className="absolute bottom-4 right-4 w-80 max-h-[70vh] overflow-y-auto bg-white rounded-lg shadow-xl border z-[1000]">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <h3 className="text-sm font-semibold text-gray-800">空间查询结果</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
      </div>

      <div className="p-4 space-y-4">
        {/* 坐标 */}
        <div>
          <div className="text-xs text-gray-500 mb-1">查询点坐标</div>
          <div className="text-sm text-gray-700 font-medium">
            经度 {result.point.lng.toFixed(6)}，纬度 {result.point.lat.toFixed(6)}
          </div>
        </div>

        {/* 风险等级 */}
        <div>
          <div className="text-xs text-gray-500 mb-1">风险等级</div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs border ${riskLevelColor(result.overallRisk)}`}>
              {result.riskLabel}
            </span>
            {result.insideAnyZone && (
              <span className="text-xs text-red-600">位于保护区内</span>
            )}
          </div>
        </div>

        {/* 最近水源地 */}
        <div>
          <div className="text-xs text-gray-500 mb-1">最近水源地</div>
          <div className="text-sm text-gray-700">{result.nearestSummary || '附近无水源地'}</div>
        </div>

        {/* 周边水源地 */}
        <div>
          <div className="text-xs text-gray-500 mb-1">
            周边水源地（{result.proximity.withinRadius.length} 个）
          </div>
          {result.proximity.withinRadius.length === 0 ? (
            <div className="text-sm text-gray-400">无</div>
          ) : (
            <div className="space-y-1">
              {result.proximity.withinRadius.slice(0, 5).map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{s.name}</span>
                  <span className="text-gray-400 text-xs">
                    {Math.round(s.distanceM)}m · {s.bearingLabel}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 敏感目标 */}
        {result.sensitiveScreening && (
          <div>
            <div className="text-xs text-gray-500 mb-1">
              敏感目标（{result.sensitiveScreening.totalCount} 个）
            </div>
            {result.sensitiveScreening.totalCount === 0 ? (
              <div className="text-sm text-gray-400">无</div>
            ) : (
              <div className="space-y-1">
                {result.sensitiveScreening.targets.slice(0, 5).map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{t.name}（{t.categoryLabel}）</span>
                    <span className="text-gray-400 text-xs">{Math.round(t.distanceM)}m</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 综合结论 */}
        <div className="bg-gray-50 rounded p-3">
          <div className="text-xs text-gray-500 mb-1">综合结论</div>
          <div className="text-sm text-gray-700 leading-relaxed">{result.summary}</div>
        </div>

        {/* 风险指示条 */}
        <div className="flex gap-1">
          {(['red', 'yellow', 'green'] as const).map((level) => (
            <div key={level} className={`flex-1 h-1.5 rounded ${riskClasses[level]} ${result.overallRisk === level ? '' : 'opacity-20'}`} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SpatialQueryPanel;
