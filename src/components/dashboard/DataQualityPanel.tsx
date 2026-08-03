/* ===== S11.3: 数据质量评分面板 =====
 * 仪表盘卡片：总分环形图 + 字段条形图 + 低分列表 + 城市质量表
 */

import React, { useMemo } from 'react';
import type { WaterSourceRecord } from '@/stores/waterSourceStore';
import { scoreAll, getScoreColor } from '@/lib/dataQualityEngine';

interface DataQualityPanelProps {
  sources: WaterSourceRecord[];
}

const DataQualityPanel: React.FC<DataQualityPanelProps> = ({ sources }) => {
  const stats = useMemo(() => scoreAll(sources), [sources]);

  if (sources.length === 0) {
    return (
      <div className="rounded-lg p-4 md:p-6 bg-white border border-gray-200">
        <h3 className="text-base font-bold text-gray-800 mb-2">数据质量评分</h3>
        <p className="text-sm text-gray-400">暂无数据</p>
      </div>
    );
  }

  // 环形图参数
  const circumference = 2 * Math.PI * 45;
  const averageOffset = circumference - (stats.average / 100) * circumference;

  return (
    <div className="rounded-lg p-4 md:p-6 bg-white border border-gray-200 space-y-4">
      <h3 className="text-base font-bold text-gray-800">数据质量评分</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 左：平均分环形图 */}
        <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-lg">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="45" fill="none" stroke="#e5e7eb" strokeWidth="8" />
            <circle
              cx="60"
              cy="60"
              r="45"
              fill="none"
              stroke={stats.average >= 80 ? '#22c55e' : stats.average >= 60 ? '#f59e0b' : '#ef4444'}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={averageOffset}
              transform="rotate(-90 60 60)"
            />
            <text x="60" y="60" textAnchor="middle" dominantBaseline="central" className={`text-2xl font-bold ${getScoreColor(stats.average)}`}>
              {stats.average}
            </text>
            <text x="60" y="78" textAnchor="middle" className="text-xs fill-gray-400">平均分</text>
          </svg>
          <div className="flex gap-4 mt-2 text-xs">
            <span className="text-green-600">最高 {stats.max}</span>
            <span className="text-red-600">最低 {stats.min}</span>
          </div>
        </div>

        {/* 中：分布直方图 */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-xs font-medium text-gray-500 mb-3">分数分布</p>
          <div className="space-y-2">
            {stats.distribution.map((d) => (
              <div key={d.range} className="flex items-center gap-2">
                <span className="w-12 text-xs text-gray-500 text-right shrink-0">{d.range}</span>
                <div className="flex-1 h-4 bg-gray-200 rounded overflow-hidden">
                  <div
                    className={`h-full ${
                      d.range.startsWith('90') ? 'bg-green-400' :
                      d.range.startsWith('80') ? 'bg-blue-400' :
                      d.range.startsWith('70') ? 'bg-amber-400' :
                      d.range.startsWith('60') ? 'bg-orange-400' :
                      'bg-red-400'
                    }`}
                    style={{ width: `${Math.max(d.percentage, 2)}%` }}
                  />
                </div>
                <span className="w-8 text-xs text-gray-600 shrink-0">{d.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 右：按级别分组 */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-xs font-medium text-gray-500 mb-3">按级别平均分</p>
          <div className="space-y-2">
            {stats.byLevel.map((l) => (
              <div key={l.level} className="flex items-center gap-2">
                <span className="w-12 text-xs text-gray-500 shrink-0">{l.level}</span>
                <div className="flex-1 h-4 bg-gray-200 rounded overflow-hidden">
                  <div
                    className={`h-full ${getScoreColor(l.average).replace('text-', 'bg-')}`}
                    style={{ width: `${l.average}%` }}
                  />
                </div>
                <span className={`w-8 text-xs font-bold shrink-0 ${getScoreColor(l.average)}`}>{l.average}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 城市质量热力表 */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">按城市平均分（从低到高）</p>
        <div className="flex flex-wrap gap-2">
          {stats.byCity.map((c) => (
            <div
              key={c.cityName}
              className={`px-3 py-1 rounded-lg text-xs border ${
                c.average >= 90 ? 'bg-green-50 border-green-200 text-green-700' :
                c.average >= 80 ? 'bg-blue-50 border-blue-200 text-blue-700' :
                c.average >= 70 ? 'bg-amber-50 border-amber-200 text-amber-700' :
                c.average >= 60 ? 'bg-orange-50 border-orange-200 text-orange-700' :
                'bg-red-50 border-red-200 text-red-700'
              }`}
              title={`${c.cityName}: ${c.count}条, 平均${c.average}分`}
            >
              {c.cityName}
              <span className="ml-1 font-bold">{c.average}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 低分 Top10 */}
      {stats.lowScoreTop10.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">低分水源地 Top10</p>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-600">名称</th>
                  <th className="px-3 py-2 text-left text-gray-600">城市</th>
                  <th className="px-3 py-2 text-center text-gray-600">分数</th>
                  <th className="px-3 py-2 text-left text-gray-600">缺失字段</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.lowScoreTop10.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-800 font-medium">{item.name}</td>
                    <td className="px-3 py-2 text-gray-600">{item.cityName}</td>
                    <td className={`px-3 py-2 text-center font-bold ${getScoreColor(item.score)}`}>{item.score}</td>
                    <td className="px-3 py-2 text-gray-400 text-xs">
                      {item.missingFields.length > 0 ? item.missingFields.join('、') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataQualityPanel;
