/**
 * 撤销/重做工具栏 + 历史面板
 *
 * 嵌入 Layout 顶部导航栏：
 * [← 撤销] [→ 重做] | 历史 (N)
 *
 * 点击历史按钮展开侧滑面板，展示操作时间线
 */

import React, { useState } from 'react';
import { useUndoRedo, formatRelativeTime } from '@/hooks/useUndoRedo';
import {
  getCommandSourceLabel,
  getCommandSourceColor,
  type UndoCommand,
} from '@/lib/undoManager';

const UndoRedoToolbar: React.FC = () => {
  const {
    canUndo,
    canRedo,
    undoCount,
    redoCount,
    undoHistory,
    redoHistory,
    undo,
    redo,
    clear,
    undoUntil,
    redoUntil,
    lastUndo,
    isExecuting,
  } = useUndoRedo();

  const [showHistory, setShowHistory] = useState(false);

  const totalOps = undoCount + redoCount;

  return (
    <>
      <div className="flex items-center gap-1">
        {/* 撤销按钮 */}
        <button
          onClick={() => undo()}
          disabled={!canUndo || isExecuting}
          title={lastUndo ? `撤销: ${lastUndo.label}` : '无可撤销操作'}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            canUndo && !isExecuting
              ? 'text-gray-600 hover:bg-gray-100'
              : 'text-gray-300 cursor-not-allowed'
          }`}
        >
          <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
            />
          </svg>
          <span className="ml-0.5">撤销</span>
        </button>

        {/* 重做按钮 */}
        <button
          onClick={() => redo()}
          disabled={!canRedo || isExecuting}
          title="重做"
          className={`text-xs px-2 py-1 rounded transition-colors ${
            canRedo && !isExecuting
              ? 'text-gray-600 hover:bg-gray-100'
              : 'text-gray-300 cursor-not-allowed'
          }`}
        >
          <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6"
            />
          </svg>
          <span className="ml-0.5">重做</span>
        </button>

        {/* 历史按钮 */}
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            totalOps > 0
              ? 'text-blue-600 hover:bg-blue-50'
              : 'text-gray-300 cursor-not-allowed'
          }`}
          disabled={totalOps === 0}
          title="操作历史"
        >
          历史
          {totalOps > 0 && (
            <span className="ml-1 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
              {undoCount}
            </span>
          )}
        </button>

        {/* 执行中指示 */}
        {isExecuting && (
          <span className="text-[10px] text-blue-500 animate-pulse">执行中...</span>
        )}
      </div>

      {/* 历史面板（侧滑抽屉） */}
      {showHistory && (
        <HistoryPanel
          undoHistory={undoHistory}
          redoHistory={redoHistory}
          onClose={() => setShowHistory(false)}
          onUndoUntil={async (id) => {
            await undoUntil(id);
          }}
          onRedoUntil={async (id) => {
            await redoUntil(id);
          }}
          onClear={() => {
            clear();
            setShowHistory(false);
          }}
        />
      )}
    </>
  );
};

// ===== 历史面板 =====

interface HistoryPanelProps {
  undoHistory: UndoCommand[];
  redoHistory: UndoCommand[];
  onClose: () => void;
  onUndoUntil: (id: string) => Promise<void>;
  onRedoUntil: (id: string) => Promise<void>;
  onClear: () => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({
  undoHistory,
  redoHistory,
  onClose,
  onUndoUntil,
  onRedoUntil,
  onClear,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* 面板 */}
      <div className="relative w-96 max-w-[90vw] bg-white shadow-xl h-full flex flex-col">
        {/* 头部 */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-800">操作历史</h3>
          <div className="flex items-center gap-2">
            {undoHistory.length > 0 && (
              <button
                onClick={onClear}
                className="text-xs px-2 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50"
              >
                全部清除
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
              ×
            </button>
          </div>
        </div>

        {/* 操作列表 */}
        <div className="flex-1 overflow-y-auto">
          {undoHistory.length === 0 && redoHistory.length === 0 && (
            <div className="text-center text-gray-400 py-12 text-sm">暂无操作历史</div>
          )}

          {/* 可撤销操作（最新在前，倒序展示） */}
          {undoHistory.length > 0 && (
            <div className="p-2">
              <div className="text-[10px] text-gray-400 font-semibold px-2 py-1 sticky top-0 bg-white">
                可撤销 ({undoHistory.length})
              </div>
              {undoHistory.map((cmd, idx) => (
                <HistoryItem
                  key={cmd.id}
                  cmd={cmd}
                  isLatest={idx === 0}
                  onClick={() => onUndoUntil(cmd.id)}
                  actionLabel="撤销到此"
                />
              ))}
            </div>
          )}

          {/* 分隔线 */}
          {undoHistory.length > 0 && redoHistory.length > 0 && (
            <div className="border-t border-dashed border-gray-200 mx-4" />
          )}

          {/* 可重做操作 */}
          {redoHistory.length > 0 && (
            <div className="p-2">
              <div className="text-[10px] text-gray-400 font-semibold px-2 py-1 sticky top-0 bg-white">
                可重做 ({redoHistory.length})
              </div>
              {redoHistory.map((cmd) => (
                <HistoryItem
                  key={cmd.id}
                  cmd={cmd}
                  isLatest={false}
                  isRedo
                  onClick={() => onRedoUntil(cmd.id)}
                  actionLabel="重做到此"
                />
              ))}
            </div>
          )}
        </div>

        {/* 底部快捷键提示 */}
        <div className="px-4 py-2 border-t border-gray-100 text-[10px] text-gray-400 flex items-center gap-3">
          <span>
            <kbd className="px-1 py-0.5 bg-gray-100 rounded text-gray-500">Ctrl+Z</kbd> 撤销
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-gray-100 rounded text-gray-500">Ctrl+Y</kbd> 重做
          </span>
        </div>
      </div>
    </div>
  );
};

// ===== 历史条目 =====

interface HistoryItemProps {
  cmd: UndoCommand;
  isLatest: boolean;
  isRedo?: boolean;
  onClick: () => void;
  actionLabel: string;
}

const HistoryItem: React.FC<HistoryItemProps> = ({ cmd, isLatest, isRedo, onClick, actionLabel }) => {
  return (
    <div
      className={`group flex items-start gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer ${
        isLatest ? 'bg-blue-50' : ''
      } ${isRedo ? 'opacity-50' : ''}`}
      onClick={onClick}
      title={actionLabel}
    >
      {/* 来源标签 */}
      <span
        className={`text-[9px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${getCommandSourceColor(
          cmd.source,
        )}`}
      >
        {getCommandSourceLabel(cmd.source)}
      </span>

      {/* 操作描述 */}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-700 truncate">{cmd.label}</div>
        <div className="text-[10px] text-gray-400">{formatRelativeTime(cmd.timestamp)}</div>
      </div>

      {/* 悬浮操作提示 */}
      <span className="text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
        {actionLabel}
      </span>
    </div>
  );
};

export default UndoRedoToolbar;
