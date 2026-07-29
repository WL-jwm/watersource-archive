/**
 * toastStore — 全局 Toast 通知 + Confirm 确认弹窗状态管理
 *
 * 设计：
 * 1. Toast 队列：先进先出，自动过期消失，支持 success/error/warning/info 四级
 * 2. Confirm 弹窗：单例模式，Promise 化，支持取消
 * 3. 非 React 文件（lib/*.ts）可直接通过 getState() 调用，无需 Hook
 */

import { create } from 'zustand';

/* ── Toast 类型 ── */

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration: number; // ms, 0 = 不自动关闭
}

interface AddToastOptions {
  type?: ToastType;
  duration?: number;
}

/* ── Confirm 类型 ── */

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean; // 红色确认按钮
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
  resolve: ((value: boolean) => void) | null;
}

/* ── Store 定义 ── */

interface ToastState {
  toasts: ToastItem[];
  confirm: ConfirmState;

  // Toast 方法
  showToast: (message: string, options?: AddToastOptions) => string;
  dismissToast: (id: string) => void;
  clearToasts: () => void;

  // Confirm 方法
  showConfirm: (options: ConfirmOptions | string) => Promise<boolean>;
  resolveConfirm: (result: boolean) => void;
}

let toastIdCounter = 0;

function genId(): string {
  toastIdCounter += 1;
  return `toast-${Date.now()}-${toastIdCounter}`;
}

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 3000,
  error: 5000,
  warning: 4000,
  info: 3000,
};

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  confirm: {
    open: false,
    message: '',
    resolve: null,
  },

  showToast: (message, options = {}) => {
    const type = options.type ?? 'info';
    const duration = options.duration ?? DEFAULT_DURATION[type];
    const id = genId();

    set((state) => ({
      toasts: [...state.toasts, { id, type, message, duration }],
    }));

    if (duration > 0) {
      setTimeout(() => {
        get().dismissToast(id);
      }, duration);
    }

    return id;
  },

  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearToasts: () => set({ toasts: [] }),

  showConfirm: (options) => {
    const opts: ConfirmOptions =
      typeof options === 'string' ? { message: options } : options;

    return new Promise<boolean>((resolve) => {
      set({
        confirm: {
          open: true,
          title: opts.title,
          message: opts.message,
          confirmText: opts.confirmText,
          cancelText: opts.cancelText,
          danger: opts.danger ?? false,
          resolve,
        },
      });
    });
  },

  resolveConfirm: (result) => {
    const { confirm } = get();
    confirm.resolve?.(result);
    set({
      confirm: { open: false, message: '', resolve: null },
    });
  },
}));

/* ── 非 React 便捷导出（供 lib/*.ts 直接调用） ── */

export const toast = {
  success: (msg: string, duration?: number) =>
    useToastStore.getState().showToast(msg, { type: 'success', duration }),
  error: (msg: string, duration?: number) =>
    useToastStore.getState().showToast(msg, { type: 'error', duration }),
  warning: (msg: string, duration?: number) =>
    useToastStore.getState().showToast(msg, { type: 'warning', duration }),
  info: (msg: string, duration?: number) =>
    useToastStore.getState().showToast(msg, { type: 'info', duration }),
};

export const confirmDialog = (options: ConfirmOptions | string): Promise<boolean> =>
  useToastStore.getState().showConfirm(options);
