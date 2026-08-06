import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { I18nProvider, translations, useI18n } from '@/lib/i18n';

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

  // N8: 新增 Layout 键值
  it('T11-Layout侧边栏标题翻译', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.t('layout.sidebarTitle')).toBe('水源地档案管理');
    expect(result.current.t('layout.sidebarSubtitle')).toBe('保护区划分技术报告');
    act(() => result.current.setLocale('en'));
    expect(result.current.t('layout.sidebarTitle')).toBe('Water Source Archive');
    expect(result.current.t('layout.sidebarSubtitle')).toBe('Protection Zone Technical Reports');
  });

  it('T12-统计标签翻译', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.t('layout.statReports')).toBe('报告');
    expect(result.current.t('layout.statSources')).toBe('水源地');
    expect(result.current.t('layout.statWells')).toBe('水井');
    act(() => result.current.setLocale('en'));
    expect(result.current.t('layout.statReports')).toBe('Reports');
    expect(result.current.t('layout.statSources')).toBe('Sources');
    expect(result.current.t('layout.statWells')).toBe('Wells');
  });

  it('T13-导航项翻译', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.t('nav.gis')).toBe('GIS地图');
    expect(result.current.t('nav.dashboardFull')).toBe('统计仪表盘');
    expect(result.current.t('nav.zoneCalcFull')).toBe('保护区划分');
    expect(result.current.t('nav.audit')).toBe('审计日志');
    expect(result.current.t('nav.backup')).toBe('数据备份');
    act(() => result.current.setLocale('en'));
    expect(result.current.t('nav.gis')).toBe('GIS Map');
    expect(result.current.t('nav.dashboardFull')).toBe('Dashboard');
    expect(result.current.t('nav.zoneCalcFull')).toBe('Zone Calculator');
    expect(result.current.t('nav.audit')).toBe('Audit Log');
    expect(result.current.t('nav.backup')).toBe('Backup');
  });

  it('T14-Home页面键值翻译', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.t('home.title')).toBe('河北省饮用水水源地保护区档案管理平台');
    expect(result.current.t('home.quickActions')).toBe('快捷操作');
    act(() => result.current.setLocale('en'));
    expect(result.current.t('home.title')).toBe('Hebei Drinking Water Source Protection Zone Archive Platform');
    expect(result.current.t('home.quickActions')).toBe('Quick Actions');
  });

  it('T15-操作按钮翻译', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.t('action.print')).toBe('打印');
    expect(result.current.t('action.install')).toBe('安装');
    expect(result.current.t('action.close')).toBe('关闭');
    act(() => result.current.setLocale('en'));
    expect(result.current.t('action.print')).toBe('Print');
    expect(result.current.t('action.install')).toBe('Install');
    expect(result.current.t('action.close')).toBe('Close');
  });

  it('T16-PWA安装提示翻译', () => {
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.t('pwa.installHint')).toBe('安装水源地档案应用到桌面，离线使用');
    act(() => result.current.setLocale('en'));
    expect(result.current.t('pwa.installHint')).toBe('Install Water Source Archive app for offline use');
  });

  it('T17-中英双语键值数量一致', () => {
    // 确保所有中文键都有对应的英文翻译
    const zhKeys = Object.keys(translations.zh);
    const enKeys = Object.keys(translations.en);
    expect(enKeys.length).toBe(zhKeys.length);
    for (const key of zhKeys) {
      expect(enKeys).toContain(key);
    }
  });
});

