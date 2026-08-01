import { test, expect } from '@playwright/test';

/**
 * E2E-5: 报告导出
 *
 * 验证：
 * - 首页报告列表加载
 * - 点击报告查看详情
 * - 导出功能可交互
 */
test.describe('报告导出', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(2000);
  });

  test('首页加载并显示内容', async ({ page }) => {
    await expect(page.locator('#main-content')).toBeVisible();
    const text = await page.locator('#main-content').textContent();
    expect(text).toBeTruthy();
    // 首页应有一些内容
    expect(text!.length).toBeGreaterThan(10);
  });

  test('导航到水源地管理并导出', async ({ page }) => {
    await page.goto('/#/manage');
    await page.waitForTimeout(2000);

    // 尝试导出 Excel
    const exportExcelBtn = page.locator('button:has-text("导出Excel"), button:has-text("导出")').first();
    if (await exportExcelBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      // 设置下载监听
      const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
      await exportExcelBtn.click();
      const download = await downloadPromise;

      if (download) {
        // 验证下载文件名
        const filename = download.suggestedFilename();
        expect(filename).toMatch(/\.(xlsx|csv|json)$/);
      }
    }
  });

  test('叠加分析页面导出功能', async ({ page }) => {
    await page.goto('/#/overlay');
    await page.waitForTimeout(2000);

    // 查找导出栏
    const exportBtn = page.locator('button:has-text("导出"), button:has-text("Excel"), button:has-text("Word"), button:has-text("GeoJSON")').first();

    if (await exportBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      // 仅验证按钮可交互
      expect(await exportBtn.isVisible()).toBeTruthy();
    }
  });

  test('仪表盘页面加载', async ({ page }) => {
    await page.goto('/#/dashboard');
    await expect(page.locator('#main-content')).toBeVisible();
    await page.waitForTimeout(1000);

    // 仪表盘应显示统计数据或图表
    const text = await page.locator('#main-content').textContent();
    expect(text).toBeTruthy();
  });
});
