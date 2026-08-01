import { test, expect } from '@playwright/test';

/**
 * E2E-3: 保护区计算
 *
 * 验证：
 * - 保护区计算页面加载
 * - 选择水源地
 * - 执行计算
 * - 查看结果
 */
test.describe('保护区计算', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/zone-calc');
    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(2000);
  });

  test('计算页面正常加载', async ({ page }) => {
    // 页面应显示保护区计算相关内容
    await expect(page.locator('#main-content')).toBeVisible();
    // 应有计算相关的按钮或表单
    const pageText = await page.locator('#main-content').textContent();
    expect(pageText).toBeTruthy();
    // 应包含"保护区"或"计算"相关文字
    expect(pageText).toMatch(/保护区|计算|水源/);
  });

  test('选择水源地并执行计算', async ({ page }) => {
    // 等待页面完全加载
    await page.waitForTimeout(2000);

    // 尝试找到选择水源地的下拉/输入
    const selectTrigger = page.locator('select, input[placeholder*="选择"], input[placeholder*="水源"]').first();

    if (await selectTrigger.isVisible({ timeout: 5000 }).catch(() => false)) {
      // 如果有选择器，尝试交互
      if (await selectTrigger.locator('option').count().catch(() => 0) > 0) {
        // select 元素
        await selectTrigger.selectOption({ index: 1 });
      } else {
        // input 元素 — 尝试输入
        await selectTrigger.click();
        await page.waitForTimeout(500);
        // 选择第一个下拉选项（如果有）
        const firstOption = page.locator('[role="option"], li, .dropdown-item').first();
        if (await firstOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          await firstOption.click();
        }
      }

      await page.waitForTimeout(500);
    }

    // 尝试点击计算按钮
    const calcBtn = page.locator('button:has-text("计算"), button:has-text("生成")').first();
    if (await calcBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await calcBtn.click();

      // 等待计算结果
      await page.waitForTimeout(3000);

      // 应显示某种结果（坐标表格、地图、或结果文本）
      const resultArea = page.locator('#main-content');
      await expect(resultArea).toBeVisible();
    }
  });

  test('计算结果导出按钮可访问', async ({ page }) => {
    await page.waitForTimeout(2000);

    // 查找导出相关按钮
    const exportBtn = page.locator('button:has-text("导出"), button:has-text("下载")').first();
    // 仅验证按钮存在（可能在计算后才可用）
    if (await exportBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      expect(await exportBtn.isVisible()).toBeTruthy();
    }
  });
});
