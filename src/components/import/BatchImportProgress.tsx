/* ===== S11.1: 批量导入进度管理 =====
 * 进度条 + 成功/失败/跳过计数 + 失败行详情 + 暂停/继续/取消
 */

import React, { useState, useCallback, useRef } from 'react';

export interface BatchImportState {
  /** 总数 */
  total: number;
  /** 已处理数 */
  processed: number;
  /** 成功数 */
  succeeded: number;
  /** 失败数 */
  failed: number;
  /** 跳过数 */
  skipped: number;
  /** 是否正在运行 */
  running: boolean;
  /** 是否暂停 */
  paused: boolean;
  /** 失败详情 */
  failures: ImportFailure[];
}

export interface ImportFailure {
  row: number;
  name: string;
  reason: string;
}

interface BatchImportProgressProps {
  state: BatchImportState;
  /** 暂停回调 */
  onPause?: () => void;
  /** 继续回调 */
  onResume?: () => void;
  /** 取消回调 */
  onCancel?: () => void;
  /** 完成回调 */
  onComplete?: () => void;
}

const BatchImportProgress: React.FC<BatchImportProgressProps> = ({
  state,
  onPause,
  onResume,
  onCancel,
  onComplete,
}) => {
  const [showFailures, setShowFailures] = useState(false);

  const percentage = state.total > 0 ? Math.round((state.processed / state.total) * 100) : 0;
  const isComplete = !state.running && state.processed >= state.total;

  // 进度条颜色
  const getProgressColor = (): string => {
    if (state.failed > 0 && state.failed > state.succeeded) return 'bg-red-500';
    if (state.failed > 0) return 'bg-amber-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-4">
      {/* 进度条 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">
            {isComplete ? '导入完成' : state.paused ? '已暂停' : '导入中...'}
          </span>
          <span className="text-gray-500">
            {state.processed} / {state.total} ({percentage}%)
          </span>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${getProgressColor()}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* 统计数字 */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-green-600">{state.succeeded}</div>
          <div className="text-xs text-green-600">成功</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-red-600">{state.failed}</div>
          <div className="text-xs text-red-600">失败</div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-gray-600">{state.skipped}</div>
          <div className="text-xs text-gray-600">跳过</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-blue-600">{state.total - state.processed}</div>
          <div className="text-xs text-blue-600">剩余</div>
        </div>
      </div>

      {/* 失败详情 */}
      {state.failures.length > 0 && (
        <div className="border border-red-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setShowFailures(!showFailures)}
            className="w-full flex items-center justify-between px-4 py-2 bg-red-50 hover:bg-red-100 text-sm"
          >
            <span className="text-red-600 font-medium">
              失败详情 ({state.failures.length} 条)
            </span>
            <span className="text-red-400">{showFailures ? '收起 ▲' : '展开 ▼'}</span>
          </button>
          {showFailures && (
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-1 text-left text-gray-500">行号</th>
                    <th className="px-3 py-1 text-left text-gray-500">名称</th>
                    <th className="px-3 py-1 text-left text-gray-500">原因</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {state.failures.map((f, i) => (
                    <tr key={i} className="hover:bg-red-50">
                      <td className="px-3 py-1 text-gray-600">{f.row}</td>
                      <td className="px-3 py-1 text-gray-800">{f.name || '—'}</td>
                      <td className="px-3 py-1 text-red-500">{f.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex justify-end gap-2">
        {state.running && !state.paused && (
          <button
            onClick={onPause}
            className="px-4 py-2 text-sm text-amber-600 hover:bg-amber-50 rounded border border-amber-200"
          >
            暂停
          </button>
        )}
        {state.running && state.paused && (
          <button
            onClick={onResume}
            className="px-4 py-2 text-sm text-green-600 hover:bg-green-50 rounded border border-green-200"
          >
            继续
          </button>
        )}
        {state.running && (
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded border border-red-200"
          >
            取消导入
          </button>
        )}
        {isComplete && (
          <button
            onClick={onComplete}
            className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded"
          >
            完成
          </button>
        )}
      </div>
    </div>
  );
};

export default BatchImportProgress;
