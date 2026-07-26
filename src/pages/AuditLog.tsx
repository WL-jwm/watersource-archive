/**
 * P2: H3 审计日志页面
 *
 * 展示操作审计日志，支持筛选/搜索/导出
 */

import { useState, useMemo } from 'react';
import {
  queryAuditLogs,
  getAuditStats,
  exportAuditLogs,
  clearAuditLogs,
  formatChangeSummary,
  type AuditAction,
} from '@/lib/auditTrail';
import { saveAs } from 'file-saver';

const actionLabels: Record<string, string> = {
  create: '新增',
  update: '修改',
  delete: '删除',
  import: '导入',
  export: '导出',
  calculate: '计算',
  reset: '重置',
  batch_calculate: '批量计算',
  batch_report: '批量报告',
};

const actionColors: Record<string, string> = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  import: 'bg-purple-100 text-purple-700',
  export: 'bg-indigo-100 text-indigo-700',
  calculate: 'bg-amber-100 text-amber-700',
  reset: 'bg-gray-100 text-gray-700',
  batch_calculate: 'bg-amber-100 text-amber-700',
  batch_report: 'bg-teal-100 text-teal-700',
};

const sourceLabels: Record<string, string> = {
  user: '用户',
  system: '系统',
  import: '导入',
  batch: '批量',
};

export default function AuditLogPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [filterAction, setFilterAction] = useState<AuditAction | ''>('');
  const [keyword, setKeyword] = useState('');
  const [showStats, setShowStats] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const stats = useMemo(() => getAuditStats(), [refreshKey]);

  const result = useMemo(() => {
    return queryAuditLogs({
      action: filterAction || undefined,
      keyword: keyword || undefined,
      limit: 100,
    });
  }, [refreshKey, filterAction, keyword]);

  const handleExport = () => {
    const json = exportAuditLogs();
    const blob = new Blob([json], { type: 'application/json' });
    saveAs(blob, `审计日志_${new Date().toISOString().slice(0, 10)}.json`);
  };

  const handleClear = () => {
    if (confirm('确定清空全部审计日志？此操作不可恢复。')) {
      clearAuditLogs();
      setRefreshKey((k) => k + 1);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">数据审计日志</h1>
          <p className="text-sm mt-1 text-gray-500">
            共 {stats.total} 条记录，最近24小时 {stats.recentActivity} 条
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowStats(!showStats)}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            {showStats ? '收起统计' : '统计'}
          </button>
          <button
            onClick={handleExport}
            disabled={stats.total === 0}
            className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-50"
          >
            导出
          </button>
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            刷新
          </button>
          <button
            onClick={handleClear}
            disabled={stats.total === 0}
            className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            清空
          </button>
        </div>
      </div>

      {/* 统计面板 */}
      {showStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-xs text-gray-500">总记录数</div>
            <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-xs text-gray-500">按操作类型</div>
            <div className="text-xs space-y-0.5 mt-1">
              {Object.entries(stats.byAction).map(([action, count]) => (
                <div key={action} className="flex items-center justify-between">
                  <span>{actionLabels[action] || action}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-xs text-gray-500">按实体类型</div>
            <div className="text-xs space-y-0.5 mt-1">
              {Object.entries(stats.byEntityType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span>{type === 'water_source' ? '水源地' : type === 'zone_result' ? '保护区' : type}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-xs text-gray-500">按来源</div>
            <div className="text-xs space-y-0.5 mt-1">
              {Object.entries(stats.bySource).map(([src, count]) => (
                <div key={src} className="flex items-center justify-between">
                  <span>{sourceLabels[src] || src}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 筛选栏 */}
      <div className="flex items-center gap-2">
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value as AuditAction | '')}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5"
        >
          <option value="">全部操作</option>
          <option value="create">新增</option>
          <option value="update">修改</option>
          <option value="delete">删除</option>
          <option value="import">导入</option>
          <option value="calculate">计算</option>
          <option value="reset">重置</option>
        </select>
        <input
          type="text"
          placeholder="搜索关键词..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5"
        />
        <span className="text-xs text-gray-400">{result.total} 条匹配</span>
      </div>

      {/* 日志列表 */}
      {result.entries.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">暂无审计日志记录</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {result.entries.map((entry) => (
            <div
              key={entry.id}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden"
            >
              <div
                className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              >
                {/* 操作类型标签 */}
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${actionColors[entry.action] || 'bg-gray-100 text-gray-600'}`}
                >
                  {actionLabels[entry.action] || entry.action}
                </span>
                {/* 描述 */}
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-gray-700 truncate">
                    {formatChangeSummary(entry)}
                  </span>
                </div>
                {/* 来源 */}
                <span className="text-[10px] text-gray-400 flex-shrink-0">
                  {sourceLabels[entry.source] || entry.source}
                </span>
                {/* 时间 */}
                <span className="text-[10px] text-gray-400 flex-shrink-0">
                  {new Date(entry.timestamp).toLocaleString('zh-CN', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
                {/* 展开按钮 */}
                <span className="text-gray-300 text-xs flex-shrink-0">
                  {expandedId === entry.id ? '▲' : '▼'}
                </span>
              </div>
              {/* 展开详情 */}
              {expandedId === entry.id && (
                <div className="px-3 py-2 border-t border-gray-100 bg-gray-50 space-y-2">
                  {entry.changedFields && entry.changedFields.length > 0 && (
                    <div>
                      <span className="text-[10px] text-gray-500 font-medium">变更字段: </span>
                      <span className="text-[10px] text-gray-700">{entry.changedFields.join(', ')}</span>
                    </div>
                  )}
                  {entry.before && (
                    <div>
                      <div className="text-[10px] text-gray-500 font-medium mb-0.5">变更前:</div>
                      <pre className="text-[10px] text-gray-600 bg-white border border-gray-100 rounded p-2 max-h-32 overflow-auto">
                        {entry.before}
                      </pre>
                    </div>
                  )}
                  {entry.after && (
                    <div>
                      <div className="text-[10px] text-gray-500 font-medium mb-0.5">变更后:</div>
                      <pre className="text-[10px] text-gray-600 bg-white border border-gray-100 rounded p-2 max-h-32 overflow-auto">
                        {entry.after}
                      </pre>
                    </div>
                  )}
                  {entry.sessionId && (
                    <div className="text-[10px] text-gray-400">会话: {entry.sessionId}</div>
                  )}
                </div>
              )}
            </div>
          ))}
          {result.hasMore && (
            <div className="text-center py-2 text-xs text-gray-400">
              还有更多记录未显示（共 {result.total} 条）
            </div>
          )}
        </div>
      )}
    </div>
  );
}
