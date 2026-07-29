/**
 * useToast — Toast 通知 Hook
 *
 * 在 React 组件中使用，返回 toast 对象：
 *   const toast = useToast();
 *   toast.success('保存成功');
 *   toast.error('保存失败：' + err.message);
 *   toast.warning('请填写完整信息');
 *   toast.info('正在加载...');
 *
 * 非 React 文件（lib/*.ts）直接 import { toast } from '@/stores/toastStore'
 */

import { useToastStore } from '@/stores/toastStore';

export function useToast() {
  const showToast = useToastStore((s) => s.showToast);

  return {
    success: (msg: string, duration?: number) =>
      showToast(msg, { type: 'success', duration }),
    error: (msg: string, duration?: number) =>
      showToast(msg, { type: 'error', duration }),
    warning: (msg: string, duration?: number) =>
      showToast(msg, { type: 'warning', duration }),
    info: (msg: string, duration?: number) =>
      showToast(msg, { type: 'info', duration }),
  };
}

export default useToast;
