/**
 * Toast 通知系统测试
 *
 * 覆盖：
 * 1. toastStore — showToast/dismissToast/clearToasts/showConfirm/resolveConfirm
 * 2. useToast Hook — success/error/warning/info 四级
 * 3. useConfirm Hook — Promise 化确认
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useToastStore, useToastStore as _store } from '@/stores/toastStore';
import { useToast } from '@/hooks/useToast';
import { useConfirm } from '@/hooks/useConfirm';

describe('toastStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useToastStore.setState({
      toasts: [],
      confirm: { open: false, message: '', resolve: null },
    });
  });

  describe('showToast', () => {
    it('T01-添加默认info类型toast', () => {
      const id = useToastStore.getState().showToast('测试消息');
      expect(id).toMatch(/^toast-\d+-\d+$/);
      const state = useToastStore.getState();
      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0].type).toBe('info');
      expect(state.toasts[0].message).toBe('测试消息');
    });

    it('T02-添加success类型toast', () => {
      useToastStore.getState().showToast('成功', { type: 'success' });
      expect(useToastStore.getState().toasts[0].type).toBe('success');
    });

    it('T03-添加error类型toast', () => {
      useToastStore.getState().showToast('失败', { type: 'error' });
      expect(useToastStore.getState().toasts[0].type).toBe('error');
    });

    it('T04-添加warning类型toast', () => {
      useToastStore.getState().showToast('警告', { type: 'warning' });
      expect(useToastStore.getState().toasts[0].type).toBe('warning');
    });

    it('T05-自定义duration', () => {
      useToastStore.getState().showToast('自定义', { duration: 10000 });
      expect(useToastStore.getState().toasts[0].duration).toBe(10000);
    });

    it('T06-duration=0不自动关闭', () => {
      vi.useFakeTimers();
      useToastStore.getState().showToast('持久', { duration: 0 });
      vi.advanceTimersByTime(10000);
      expect(useToastStore.getState().toasts).toHaveLength(1);
      vi.useRealTimers();
    });

    it('T07-自动过期消失', () => {
      vi.useFakeTimers();
      useToastStore.getState().showToast('短期', { duration: 100 });
      expect(useToastStore.getState().toasts).toHaveLength(1);
      vi.advanceTimersByTime(200);
      expect(useToastStore.getState().toasts).toHaveLength(0);
      vi.useRealTimers();
    });

    it('T08-默认duration按类型分配', () => {
      useToastStore.getState().showToast('s', { type: 'success' });
      useToastStore.getState().showToast('e', { type: 'error' });
      useToastStore.getState().showToast('w', { type: 'warning' });
      useToastStore.getState().showToast('i', { type: 'info' });
      const toasts = useToastStore.getState().toasts;
      expect(toasts[0].duration).toBe(3000); // success
      expect(toasts[1].duration).toBe(5000); // error
      expect(toasts[2].duration).toBe(4000); // warning
      expect(toasts[3].duration).toBe(3000); // info
    });
  });

  describe('dismissToast', () => {
    it('T09-按ID移除单个toast', () => {
      const id1 = useToastStore.getState().showToast('消息1', { duration: 0 });
      const id2 = useToastStore.getState().showToast('消息2', { duration: 0 });
      expect(useToastStore.getState().toasts).toHaveLength(2);
      useToastStore.getState().dismissToast(id1);
      expect(useToastStore.getState().toasts).toHaveLength(1);
      expect(useToastStore.getState().toasts[0].id).toBe(id2);
    });

    it('T10-移除不存在的ID无副作用', () => {
      useToastStore.getState().showToast('消息', { duration: 0 });
      useToastStore.getState().dismissToast('nonexistent');
      expect(useToastStore.getState().toasts).toHaveLength(1);
    });
  });

  describe('clearToasts', () => {
    it('T11-清空所有toast', () => {
      useToastStore.getState().showToast('a', { duration: 0 });
      useToastStore.getState().showToast('b', { duration: 0 });
      useToastStore.getState().showToast('c', { duration: 0 });
      useToastStore.getState().clearToasts();
      expect(useToastStore.getState().toasts).toHaveLength(0);
    });
  });

  describe('showConfirm / resolveConfirm', () => {
    it('T12-确认弹窗返回true', async () => {
      const promise = useToastStore.getState().showConfirm({ message: '确定？' });
      const state = useToastStore.getState();
      expect(state.confirm.open).toBe(true);
      expect(state.confirm.message).toBe('确定？');
      useToastStore.getState().resolveConfirm(true);
      const result = await promise;
      expect(result).toBe(true);
      expect(useToastStore.getState().confirm.open).toBe(false);
    });

    it('T13-确认弹窗返回false', async () => {
      const promise = useToastStore.getState().showConfirm('取消测试');
      useToastStore.getState().resolveConfirm(false);
      const result = await promise;
      expect(result).toBe(false);
    });

    it('T14-支持danger模式', () => {
      useToastStore.getState().showConfirm({ message: '危险操作', danger: true });
      expect(useToastStore.getState().confirm.danger).toBe(true);
    });

    it('T15-支持自定义按钮文案', () => {
      useToastStore.getState().showConfirm({
        message: '测试',
        confirmText: '是的',
        cancelText: '不要',
      });
      const state = useToastStore.getState();
      expect(state.confirm.confirmText).toBe('是的');
      expect(state.confirm.cancelText).toBe('不要');
    });

    it('T16-支持标题', () => {
      useToastStore.getState().showConfirm({ title: '警告', message: '内容' });
      expect(useToastStore.getState().confirm.title).toBe('警告');
    });

    it('T17-字符串简写模式', () => {
      useToastStore.getState().showConfirm('简写消息');
      expect(useToastStore.getState().confirm.message).toBe('简写消息');
    });
  });
});

describe('useToast Hook', () => {
  beforeEach(() => {
    useToastStore.setState({
      toasts: [],
      confirm: { open: false, message: '', resolve: null },
    });
  });

  it('T18-success方法添加success类型toast', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.success('成功消息');
    });
    expect(useToastStore.getState().toasts[0].type).toBe('success');
    expect(useToastStore.getState().toasts[0].message).toBe('成功消息');
  });

  it('T19-error方法添加error类型toast', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.error('错误消息');
    });
    expect(useToastStore.getState().toasts[0].type).toBe('error');
  });

  it('T20-warning方法添加warning类型toast', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.warning('警告消息');
    });
    expect(useToastStore.getState().toasts[0].type).toBe('warning');
  });

  it('T21-info方法添加info类型toast', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.info('信息消息');
    });
    expect(useToastStore.getState().toasts[0].type).toBe('info');
  });

  it('T22-支持自定义duration', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.success('消息', 8000);
    });
    expect(useToastStore.getState().toasts[0].duration).toBe(8000);
  });
});

describe('useConfirm Hook', () => {
  beforeEach(() => {
    useToastStore.setState({
      toasts: [],
      confirm: { open: false, message: '', resolve: null },
    });
  });

  it('T23-返回Promise并在resolve后返回结果', async () => {
    const { result } = renderHook(() => useConfirm());
    let resolved: boolean | undefined;
    act(() => {
      result.current({ message: '测试' }).then((r) => { resolved = r; });
    });
    expect(useToastStore.getState().confirm.open).toBe(true);
    act(() => {
      useToastStore.getState().resolveConfirm(true);
    });
    await vi.waitFor(() => expect(resolved).toBe(true));
  });

  it('T24-支持字符串简写', async () => {
    const { result } = renderHook(() => useConfirm());
    let resolved: boolean | undefined;
    act(() => {
      result.current('简写').then((r) => { resolved = r; });
    });
    expect(useToastStore.getState().confirm.message).toBe('简写');
    act(() => {
      useToastStore.getState().resolveConfirm(false);
    });
    await vi.waitFor(() => expect(resolved).toBe(false));
  });
});
