/**
 * Task 3 — 新增連線面板 開啟 + 表單可輸入
 *
 * 注意：antares2 的「新增連線」不是 Reka Dialog，而是 settingbar 中段 mdiPlus
 * 觸發 selectWorkspace('NEW') → 在 #main-content 內 inline 掛
 * WorkspaceAddConnectionPanel.vue。
 *
 * 驗收：
 *   1. 點擊 settingbar 中段 + → connection panel 掛載（.connection-panel-wrapper）。
 *   2. 預設渲染 General tab + 連線名稱輸入框可輸入。
 *
 * 前置：pnpm vite:dev 跑在 http://localhost:5173。
 */
import { expect, test } from '@playwright/test';

import { shot } from './_helpers/screenshot';
import { clickAddConnection } from './_helpers/settings-bar';
import { installTauriShim } from './_helpers/tauri-shim';

test.describe('Task 3 — 新增連線面板', () => {
   test.beforeEach(async ({ page }) => {
      await installTauriShim(page);
      await page.goto('/');
      await expect(page.locator('#wrapper')).toBeVisible({ timeout: 10_000 });
      await page.waitForLoadState('networkidle');
   });

   test('opens connection panel, form renders, name input accepts input', async ({ page }) => {
      // ── Step 1: 開啟連線面板 ──
      const panel = await clickAddConnection(page);
      await shot(page, 'task3-step1-panel-mounted');

      // ── Step 2: 驗收 — 至少 General tab 渲染 ──
      const tabs = panel.locator('[role=tab]');
      await expect(tabs.first()).toBeVisible();
      const tabCount = await tabs.count();
      expect(tabCount, 'expected at least the General tab').toBeGreaterThanOrEqual(1);

      // ── Step 3: 表單填寫前 ──
      const firstInput = panel.locator('input[type=text]').first();
      await expect(firstInput).toBeVisible();

      // ── Step 4: 填入連線名稱 + 驗收 ──
      await firstInput.fill('e2e-smoke-connection');
      await expect(firstInput).toHaveValue('e2e-smoke-connection');
      await shot(page, 'task3-step2-name-filled');
   });
});
