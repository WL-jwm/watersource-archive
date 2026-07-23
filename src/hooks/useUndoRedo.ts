/**
 * useUndoRedo — 撤销/重做 React Hook
 *
 * 功能：
 * 1. 订阅 undoManager 状态变化，提供响应式 canUndo/canRedo
 * 2. 绑定键盘快捷键 Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z
 * 3. 提供 undo/redo/clear 方法
 * 4. 输入框/文本域中不拦截快捷键（避免与文本编辑冲突）
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { undoManager, type UndoState, type UndoCommand } from '@/lib/undoManager';
import { formatRelativeTime } from '@/lib/undoManager';

export interface UseUndoRedoReturn {
  /** 是否可撤销 */
  canUndo: boolean;
  /** 是否可重做 */
  canRedo: boolean;
  /** 可撤销操作数 */
  undoCount: number;
  /** 可重做操作数 */
  redoCount: number;
  /** 是否正在执行 undo/redo */
  isExecuting: boolean;
  /** 可撤销操作列表（最新在前） */
  undoHistory: UndoCommand[];
  /** 可重做操作列表（最新在前） */
  redoHistory: UndoCommand[];
  /** 撤销 */
  undo: () => Promise<boolean>;
  /** 重做 */
  redo: () => Promise<boolean>;
  /** 清空所有历史 */
  clear: () => void;
  /** 撤销到指定命令 */
  undoUntil: (commandId: string) => Promise<number>;
  /** 重做到指定命令 */
  redoUntil: (commandId: string) => Promise<number>;
  /** 最近一条可撤销命令 */
  lastUndo: UndoCommand | undefined;
  /** 最近一条可重做命令 */
  lastRedo: UndoCommand | undefined;
}

export function useUndoRedo(): UseUndoRedoReturn {
  const [state, setState] = useState<UndoState>(undoManager.getState());
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;

    // 订阅 undoManager 变化
    const unsubscribe = undoManager.subscribe(() => {
      if (isMounted.current) {
        setState(undoManager.getState());
      }
    });

    // 键盘快捷键
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (!isCtrl) return;

      // 输入框/文本域中不拦截（除非 Ctrl+Shift+Z 且用户显式操作）
      const target = e.target as HTMLElement;
      const isEditing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (isEditing) return;

      // Ctrl+Z（非 Shift）→ 撤销
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoManager.undo();
      }
      // Ctrl+Y 或 Ctrl+Shift+Z → 重做
      else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault();
        undoManager.redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      isMounted.current = false;
      unsubscribe();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const undo = useCallback(() => undoManager.undo(), []);
  const redo = useCallback(() => undoManager.redo(), []);
  const clear = useCallback(() => undoManager.clear(), []);
  const undoUntil = useCallback((id: string) => undoManager.undoUntil(id), []);
  const redoUntil = useCallback((id: string) => undoManager.redoUntil(id), []);

  return {
    canUndo: state.canUndo,
    canRedo: state.canRedo,
    undoCount: state.undoCount,
    redoCount: state.redoCount,
    isExecuting: state.isExecuting,
    undoHistory: state.undoHistory,
    redoHistory: state.redoHistory,
    undo,
    redo,
    clear,
    undoUntil,
    redoUntil,
    lastUndo: state.undoHistory[0],
    lastRedo: state.redoHistory[0],
  };
}

export { formatRelativeTime };
