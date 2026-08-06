/**
 * S14.4: 错误日志展示组件
 *
 * 从 IDB error_logs store 读取错误日志并展示，
 * 支持查看最近错误、清空、分类筛选。
 * 可嵌入到任意页面作为错误监控面板。
 */

import React, { useState, useEffect, useCallback } from 'react';
import { dbGetAll, dbDelete, dbClear } from '@/lib/idb';
import type { ErrorLog } from '@/lib/errorReporter';

interface ErrorLogViewerProps {
  /** 最大显示条数 */
  maxItems?: number;
  /** 是否显示为紧凑模式 */
  compact?: boolean;
}

export const ErrorLogViewer: React.FC<ErrorLogViewerProps> = ({ maxItems = 50, compact }) => {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [filter, setFilter] = useState<'all' | 'error' | 'warning'>('all');
  const [loading, setLoading] = useState(true);

  const loadLogs = useCallback(async () => {
    try {
      const all = await dbGetAll<ErrorLog>('error_logs');
      const sorted = all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLogs(sorted.slice(0, maxItems));
    } catch {
      // IDB might not be available
    } finally {
      setLoading(false);
    }
  }, [maxItems]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const filtered = filter === 'all' ? logs : logs.filter((l) => l.level === filter);

  const handleClear = async () => {
    try {
      await dbClear('error_logs');
      setLogs([]);
    } catch (err) {
      console.warn('Failed to clear error logs:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await dbDelete('error_logs', id);
      setLogs((prev) => prev.filter((l) => l.id !== id));
    } catch (err) {
      console.warn('Failed to delete error log:', err);
    }
  };

  if (loading) {
    return <div className="text-sm text-text-tertiary p-4">加载错误日志中...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['all', 'error', 'warning'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 rounded text-xs font-medium ${
                filter === f ? 'bg-accent-500 text-white' : 'bg-surface-tertiary text-text-secondary'
              }`}
            >
              {f === 'all' ? '全部' : f === 'error' ? '错误' : '警告'}
            </button>
          ))}
        </div>
        <button
          onClick={handleClear}
          className="text-xs text-red-500 hover:underline"
        >
          清空
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-sm text-text-tertiary text-center py-8 border border-dashed border-border rounded-lg">
          暂无错误日志
        </div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {filtered.map((log) => (
            <div
              key={log.id}
              className={`rounded-lg p-3 text-sm border ${
                log.level === 'error'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-amber-50 border-amber-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-xs uppercase text-text-primary">
                  {log.name}
                </span>
                <button
                  onClick={() => handleDelete(log.id)}
                  className="text-xs text-text-tertiary hover:text-red-500"
                >
                  ×
                </button>
              </div>
              <div className="text-xs text-text-secondary mt-1">{log.message}</div>
              <div className="text-xs text-text-tertiary mt-1">
                {new Date(log.timestamp).toLocaleString()}
                {log.route && ` · ${log.route}`}
                {log.source && ` · ${log.source}`}
              </div>
              {!compact && log.stack && (
                <details className="mt-1">
                  <summary className="text-xs text-text-tertiary cursor-pointer">堆栈</summary>
                  <pre className="text-xs text-text-tertiary mt-1 whitespace-pre-wrap max-h-[200px] overflow-y-auto bg-white/50 rounded p-2">
                    {log.stack}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * 错误日志摘要组件（简化版，用于嵌入侧边栏或面板）
 */
export const ErrorLogBadge: React.FC = () => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const all = await dbGetAll<ErrorLog>('error_logs');
        const errors = all.filter((l) => l.level === 'error' && 
          new Date(l.timestamp).getTime() > Date.now() - 86400000); // 24h
        setCount(errors.length);
      } catch {
        // ignore
      }
    };
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  if (count === 0) return null;

  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold">
      {count > 99 ? '99+' : count}
    </span>
  );
};