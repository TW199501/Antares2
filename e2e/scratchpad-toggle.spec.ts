/**
 * Task 10 — Scratchpad（筆記）開合
 *
 * Source-of-truth：web/renderer/components/TheScratchpad.vue
 *   - 是 Reka Dialog（[role=dialog]）。
 *   - 標題文字 = t('application.note', 2)（en-US："Notes" / zh-TW："筆記"）。
 *   - 關閉路徑：DialogHeader 內 ghost size=icon 的 Button（mdiClose），按下
 *     觸發 hideScratchpad()。
 *
 * 驗收：
 *   1. 點 settingbar 底部第 2 個 icon（scratchpad）→ 新的 [role=dialog] 出現，
 *      且其標題包含「Notes」（en-US 預設）。
 *   2. 點該 dialog 內 header 的 close button → dialog 關閉。
 *
 * 失敗處理（rules §7）：若既存 dialog 數量 > 0（settings 沒關乾淨），spec 應該
 * 失敗讓你看到 spec 之間的污染，**不要**改 timing wait 或 force 關別人。
 */
import { expect, test } from '@playwright/test';

import { shot } from './_helpers/screenshot';
import { clickScratchpad } from './_helpers/settings-bar';
import { installTauriShim } from './_helpers/tauri-shim';

test.describe('Task 10 — Scratchpad 開合', () => {
   test.beforeEach(async ({ page }) => {
      await installTauriShim(page);
      await page.goto('/');
      await expect(page.locator('#wrapper')).toBeVisible({ timeout: 10_000 });
      await page.waitForLoadState('networkidle');
   });

   test('scratchpad opens then closes', async ({ page }) => {
      // ── Step 1: 紀錄前置狀態（應為 0 個 dialog）──
      const dialogsBefore = await page.locator('[role=dialog]').count();
      expect(dialogsBefore, 'no dialog should be open at start').toBe(0);

      // ── Step 2: 點 scratchpad icon ──
      await clickScratchpad(page);

      // ── Step 3: 驗收 — 新 dialog 出現且標題是 Notes（en-US 預設）──
      const dialog = page.locator('[role=dialog]', { hasText: /Notes/i }).first();
      await expect(dialog).toBeVisible({ timeout: 5_000 });
      await shot(page, 'task10-step1-scratchpad-open');

      // ── Step 4: 點 header 的 close button ──
      const closeBtn = dialog.locator('header button').filter({ has: page.locator('svg') }).first();
      await closeBtn.click();

      // ── Step 5: 驗收 — dialog 已關 ──
      await expect(dialog).toBeHidden({ timeout: 5_000 });
      await shot(page, 'task10-step2-scratchpad-closed');
   });
});
