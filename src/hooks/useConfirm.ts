/**
 * useConfirm — Promise 化确认弹窗 Hook
 *
 * 替代 window.confirm()，返回 async 函数：
 *   const confirm = useConfirm();
 *   if (!await confirm({ message: '确定删除？', danger: true })) return;
 *
 * 也支持简写：if (!await confirm('确定删除？')) return;
 */

import { useCallback } from 'react';
import { type ConfirmOptions, useToastStore } from '@/stores/toastStore';

export function useConfirm() {
  const showConfirm = useToastStore((s) => s.showConfirm);

  return useCallback(
    (options: ConfirmOptions | string) => showConfirm(options),
    [showConfirm]
  );
}

export default useConfirm;
