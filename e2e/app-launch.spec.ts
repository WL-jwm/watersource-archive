import { test, expect } from '@playwright/test';

/**
 * E2E-1: 应用启动与导航
 *
 * 验证：
 * - 应用成功加载
 * - 侧边栏导航可见
 * - 页面间导航正常工作
 * - 跳过链接可访问
 */
test.describe('应用启动与导航', () => {
  test('应用成功加载并显示侧边栏', async ({ page }) => {
    await page.goto('/');

    // 等待应用加载完成（排除 loading fallback）
    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });

    // 侧边栏应有 aria-label
    await expect(page.locator('aside[aria-label]')).toBeVisible();

    // 跳过链接应存在（a11y）
    const skipLink = page.locator('a[href="#main-content"]').first();
    await expect(skipLink).toBeAttached();

    // 主内容区域应存在
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('导航到各页面', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });

    // 导航到水源地管理
    await page.goto('/#/manage');
    await expect(page.locator('#main-content')).toBeVisible();
    // 应看到管理页面的标题或内容
    await expect(page.locator('text=水源地').first()).toBeVisible({ timeout: 10_000 });

    // 导航到仪表盘
    await page.goto('/#/dashboard');
    await expect(page.locator('#main-content')).toBeVisible();

    // 导航到保护区计算
    await page.goto('/#/zone-calc');
    await expect(page.locator('#main-content')).toBeVisible();

    // 导航到叠加分析
    await page.goto('/#/overlay');
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('未知路由重定向到首页', async ({ page }) => {
    await page.goto('/#/nonexistent-page');
    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
    // 应回到首页
    await expect(page).toHaveURL(/.*\/#\/$/);
  });

  test('页面级 ErrorBoundary 不影响侧边栏', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });

    // 侧边栏在任何页面都应可见
    await page.goto('/#/dashboard');
    await expect(page.locator('aside')).toBeVisible();
  });
});
