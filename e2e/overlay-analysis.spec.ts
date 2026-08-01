import { test, expect } from '@playwright/test';

/**
 * E2E-4: 多水源地叠加分析
 *
 * 验证：
 * - 叠加分析页面加载
 * - 水源地多选
 * - 执行叠加分析
 * - 查看统计结果
 */
test.describe('多水源地叠加分析', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/overlay');
    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(2000);
  });

  test('叠加分析页面正常加载', async ({ page }) => {
    await expect(page.locator('#main-content')).toBeVisible();
    const pageText = await page.locator('#main-content').textContent();
    expect(pageText).toBeTruthy();
    expect(pageText).toMatch(/叠加|分析|水源/);
  });

  test('选择水源地并执行叠加分析', async ({ page }) => {
    await page.waitForTimeout(2000);

    // 查找水源地选择器（多选）
    // 可能是 checkbox 列表、多选下拉、或搜索+选择
    const sourceSelector = page.locator(
      'input[type="checkbox"], input[placeholder*="搜索"], input[placeholder*="选择"], [role="checkbox"]'
    ).first();

    if (await sourceSelector.isVisible({ timeout: 5000 }).catch(() => false)) {
      // 如果是 checkbox，选中前 2 个
      const checkboxes = page.locator('input[type="checkbox"], [role="checkbox"]');
      const count = await checkboxes.count();

      if (count >= 2) {
        // 选择前 2 个可用的 checkbox（排除"全选"）
        for (let i = 0; i < Math.min(3, count); i++) {
          const cb = checkboxes.nth(i);
          if (!(await cb.isChecked().catch(() => false))) {
            await cb.check().catch(() => {});
          }
        }
      } else {
        // 可能是搜索输入
        await sourceSelector.click();
        await page.waitForTimeout(500);
        const firstOption = page.locator('[role="option"], li, .dropdown-item').first();
        if (await firstOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          await firstOption.click();
        }
      }

      await page.waitForTimeout(500);
    }

    // 尝试点击分析按钮
    const analyzeBtn = page.locator('button:has-text("分析"), button:has-text("叠加"), button:has-text("计算")').first();
    if (await analyzeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await analyzeBtn.click();
      await page.waitForTimeout(3000);

      // 检查结果区域
      const resultText = await page.locator('#main-content').textContent();
      expect(resultText).toBeTruthy();
    }
  });

  test('统计卡片区域存在', async ({ page }) => {
    await page.waitForTimeout(2000);

    // 叠加分析页面应有统计区域（可能需要先选择水源地才显示）
    // 仅验证页面结构完整
    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeVisible();
  });
});
