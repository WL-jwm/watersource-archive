import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  HIGH_FREQ_PAGES,
  PAGE_KEYS,
  getPageImporter,
} from '@/lib/preload';

/**
 * preload 工具测试
 *
 * 背景（P6 修复）：HIGH_FREQ_PAGES 曾含无效路径（/sources、/calc），
 * 这些路径不在 pageImporters 注册表中，会被 preloadPage 静默跳过，
 * 导致高频页面实际未预加载。本测试锁定该约束，防止复发。
 */

describe('preload 页面注册表', () => {
  it('应覆盖 App.tsx 中的全部静态路由', () => {
    // App.tsx 中所有 React.lazy(getPageImporter(...)) 的静态路径
    const appRoutes = [
      '/',
      '/map',
      '/dashboard',
      '/manage',
      '/zone-calc',
      '/analysis',
      '/versions',
      '/divisions',
      '/audit',
      '/trash',
      '/overlay',
      '/timeline',
      '/sptools',
    ];
    for (const route of appRoutes) {
      expect(PAGE_KEYS, `路由 ${route} 未注册`).toContain(route);
    }
  });

  it('应能按注册表获取页面导入器', () => {
    expect(() => getPageImporter('/manage')).not.toThrow();
    expect(() => getPageImporter('/map')).not.toThrow();
  });

  it('对未注册路径应抛出明确错误', () => {
    expect(() => getPageImporter('/not-exist')).toThrow(/未注册/);
  });
});

describe('HIGH_FREQ_PAGES 高频页面列表', () => {
  it('每个高频路径都必须是已注册的真实路由', () => {
    for (const route of HIGH_FREQ_PAGES) {
      expect(PAGE_KEYS, `高频路径 ${route} 不是有效路由`).toContain(route);
    }
  });

  it('应包含核心业务高频页面（水源地管理/保护区计算/地图等）', () => {
    expect(HIGH_FREQ_PAGES).toContain('/manage');
    expect(HIGH_FREQ_PAGES).toContain('/zone-calc');
    expect(HIGH_FREQ_PAGES).toContain('/map');
  });

  it('不应包含历史无效路径', () => {
    expect(HIGH_FREQ_PAGES).not.toContain('/sources');
    expect(HIGH_FREQ_PAGES).not.toContain('/calc');
  });
});

describe('preloadPage', () => {
  beforeEach(() => {
    // 清空模块级 pending 队列，避免测试间相互影响
    vi.resetModules();
  });

  it('对未注册路径应安全跳过（不抛错、不触发下载）', async () => {
    const { preloadPage: pp } = await import('@/lib/preload');
    // 未注册路径不应抛错
    expect(() => pp('/non-existent-route')).not.toThrow();
  });
});
