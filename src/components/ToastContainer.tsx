/**
 * ToastContainer — 全局 Toast 通知渲染组件
 *
 * 固定在右上角，支持 success/error/warning/info 四级样式，
 * 自动堆叠、手动关闭、进入/退出动画。
 */

import React from 'react';
import { useToastStore, type ToastType } from '@/stores/toastStore';

const ICON_MAP: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  warning: '!',
  info: 'i',
};

const STYLE_MAP: Record<ToastType, string> = {
  success: 'bg-green-50 border-green-400 text-green-800',
  error: 'bg-red-50 border-red-400 text-red-800',
  warning: 'bg-amber-50 border-amber-400 text-amber-800',
  info: 'bg-blue-50 border-blue-400 text-blue-800',
};

const ICON_BG_MAP: Record<ToastType, string> = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
};

const ToastContainer: React.FC = () => {
  const toasts = useToastStore((s) => s.toasts);
  const dismissToast = useToastStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 min-w-[280px] max-w-[420px] px-4 py-3 rounded-lg shadow-lg border-l-4 ${STYLE_MAP[t.type]} animate-slideIn`}
          role="alert"
        >
          <span
            className={`flex-shrink-0 w-5 h-5 rounded-full ${ICON_BG_MAP[t.type]} text-white text-xs font-bold flex items-center justify-center`}
          >
            {ICON_MAP[t.type]}
          </span>
          <p className="flex-1 text-sm leading-relaxed break-words">{t.message}</p>
          <button
            onClick={() => dismissToast(t.id)}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="关闭"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
