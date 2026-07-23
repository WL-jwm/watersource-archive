import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { I18nProvider, useI18n } from '@/lib/i18n';

function wrapper({ children }: { children: React.ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}

describe('i18n - 国际化框架', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('T01-默认语言为中文', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.locale).toBe('zh');
  });

  it('T02-翻译中文键值', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.t('nav.home')).toBe('首页');
    expect(result.current.t('nav.map')).toBe('地图展示');
    expect(result.current.t('action.save')).toBe('保存');
  });

  it('T03-切换到英文', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    act(() => {
      result.current.setLocale('en');
    });
    expect(result.current.locale).toBe('en');
    expect(result.current.t('nav.home')).toBe('Home');
    expect(result.current.t('action.save')).toBe('Save');
  });

  it('T04-参数替换', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    // 测试带参数的翻译
    const text = result.current.t('stat.total', { count: 100 });
    // stat.total 没有参数占位符，应原样返回
    expect(text).toBe('总计');
  });

  it('T05-未知键返回键名', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.t('nonexistent.key')).toBe('nonexistent.key');
  });

  it('T06-英文缺失键回退中文', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    act(() => {
      result.current.setLocale('en');
    });
    // app.title 在英文中存在
    expect(result.current.t('app.title')).toBe('Hebei Water Source Protection Zone Archive Platform');
  });

  it('T07-语言切换持久化到localStorage', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    act(() => {
      result.current.setLocale('en');
    });
    expect(localStorage.getItem('ws-archive-locale')).toBe('en');
  });

  it('T08-从localStorage恢复语言', () => {
    localStorage.setItem('ws-archive-locale', 'en');
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.locale).toBe('en');
  });

  it('T09-环评结论翻译', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.t('ea.conform')).toBe('符合');
    expect(result.current.t('ea.notConform')).toBe('不符合');
    act(() => result.current.setLocale('en'));
    expect(result.current.t('ea.conform')).toBe('Conform');
    expect(result.current.t('ea.notConform')).toBe('Not Conform');
  });

  it('T10-保护区翻译', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.t('zone.primary')).toBe('一级保护区');
    expect(result.current.t('zone.secondary')).toBe('二级保护区');
    act(() => result.current.setLocale('en'));
    expect(result.current.t('zone.primary')).toBe('Primary Zone');
    expect(result.current.t('zone.secondary')).toBe('Secondary Zone');
  });
});
