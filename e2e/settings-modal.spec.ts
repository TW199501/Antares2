/**
 * Task 2 — Settings 對話框 開啟 / tab 切換 / 關閉
 *
 * 驗收：
 *   1. 點擊 settingbar 底部齒輪 → ModalSettings 開啟（Reka Dialog 透過 Teleport
 *      把內容放到 body 之下；以 [role=dialog] 為錨點）。
 *   2. 預設 tab 是 General（first()），切到 Themes（nth(1)）後 data-state 變 active。
 *   3. 點 Dialog 標頭內的 X（header 內第一個 button）關閉。
 *
 * 前置：pnpm vite:dev 跑在 http://localhost:5173。
 */
import { expect, test } from '@playwright/test';

import { shot } from './_helpers/screenshot';
import { openSettings } from './_helpers/settings-bar';
import { installTauriShim } from './_helpers/tauri-shim';

test.describe('Task 2 — Settings 對話框', () => {
   test.beforeEach(async ({ page }) => {
      await installTauriShim(page);
      await page.goto('/');
      await expect(page.locator('#wrapper')).toBeVisible({ timeout: 10_000 });
      await page.waitForLoadState('networkidle');
   });

   test('opens, switches tabs, and closes', async ({ page }) => {
      // ── Step 1: 開啟 Dialog ──
      const dialog = await openSettings(page);
      await shot(page, 'task2-step1-dialog-open');

      // ── Step 2: 確認 General tab 預設 active ──
      const generalTab = dialog.locator('[role=tab]').first();
      await expect(generalTab).toHaveAttribute('data-state', 'active');

      // ── Step 3: 切到 Themes tab ──
      const themesTab = dialog.locator('[role=tab]').nth(1);
      await themesTab.click();
      await expect(themesTab).toHaveAttribute('data-state', 'active');
      await shot(page, 'task2-step2-themes-tab-active');

      // ── Step 4: 點 X 關閉 ──
      const closeBtn = dialog.locator('header button').first();
      await closeBtn.click();
      await expect(dialog).toBeHidden({ timeout: 5_000 });
      await shot(page, 'task2-step3-dialog-closed');
   });
});
