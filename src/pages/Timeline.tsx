/* ===== S11.11: 活动时间线页面 =====
 * 聚合展示数据变更、操作审计、版本快照
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  getTimeline,
  filterTimeline,
  groupByDate,
  computeTimelineStats,
  formatTimelineType,
  formatTimelineTypeColor,
  type TimelineEntry,
  type TimelineEntryType,
  type TimelineFilter,
} from '@/lib/timelineEngine';

const TimelinePage: React.FC = () => {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter] = useState<TimelineFilter>({});
  const [activeTypes, setActiveTypes] = useState<Set<TimelineEntryType>>(new Set());

  const loadTimeline = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTimeline(500);
      setEntries(data);
    } catch {
      setEntries([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  const toggleType = (type: TimelineEntryType) => {
    setActiveTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const currentFilter: TimelineFilter = {
    ...filter,
    types: activeTypes.size > 0 ? Array.from(activeTypes) : undefined,
  };

  const filtered = filterTimeline(entries, currentFilter);
  const grouped = groupByDate(filtered);
  const stats = computeTimelineStats(filtered);

  const typeOptions: { type: TimelineEntryType; label: string }[] = [
    { type: 'change', label: '数据变更' },
    { type: 'audit', label: '操作审计' },
    { type: 'version', label: '版本快照' },
  ];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-800">活动时间线</h1>
        <p className="text-sm text-gray-500 mt-1">聚合展示数据变更、操作审计和版本快照的完整活动记录</p>
      </div>

      {/* 统计概览 */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
          <div className="text-xs text-gray-500">总记录</div>
        </div>
        <div className="bg-white rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.byType.change}</div>
          <div className="text-xs text-gray-500">数据变更</div>
        </div>
        <div className="bg-white rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold text-amber-600">{stats.byType.audit}</div>
          <div className="text-xs text-gray-500">操作审计</div>
        </div>
        <div className="bg-white rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.byType.version}</div>
          <div className="text-xs text-gray-500">版本快照</div>
        </div>
      </div>

      {/* 筛选 */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-gray-500">筛选：</span>
        {typeOptions.map(({ type, label }) => (
          <button
            key={type}
            onClick={() => toggleType(type)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              activeTypes.has(type)
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-blue-300'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={loadTimeline}
          className="text-xs px-3 py-1 text-blue-600 hover:underline ml-auto"
        >
          刷新
        </button>
      </div>

      {/* 时间线 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">加载中...</div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-12 text-gray-400">暂无活动记录</div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ date, entries: dateEntries }) => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-sm font-medium text-gray-700">{date}</span>
                <span className="text-xs text-gray-400">({dateEntries.length} 条)</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <div className="ml-1.5 border-l-2 border-gray-100 pl-4 space-y-3">
                {dateEntries.map(entry => (
                  <div key={entry.id} className="relative">
                    {/* 时间线节点 */}
                    <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white" style={{
                      backgroundColor: entry.type === 'change' ? '#3b82f6' : entry.type === 'audit' ? '#f59e0b' : '#22c55e'
                    }} />
                    <div className="bg-white rounded-lg border p-3 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium text-gray-800 truncate">{entry.title}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${formatTimelineTypeColor(entry.type)}`}>
                              {formatTimelineType(entry.type)}
                            </span>
                          </div>
                          {entry.description && (
                            <p className="text-xs text-gray-500 truncate">{entry.description}</p>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {entry.timestamp.slice(11, 19)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TimelinePage;
