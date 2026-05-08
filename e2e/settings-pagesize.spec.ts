/**
 * Task 6 — Settings → General → Page size 切換並跨關閉/重開仍存在
 *
 * 驗收：
 *   1. pageSize BaseSelect（General tab 內第 2 個 combobox，第 1 個是 Language）
 *      開啟下拉並有可選的數字選項。
 *   2. 點選非預設值（例：250）後 trigger 反映新值。
 *   3. 關閉 modal → 重開 → trigger 仍是 250（in-memory 持久；磁碟 persistence 在
 *      Tauri shim 下是 no-op，但 store 仍保留切換值，所以重開仍可見）。
 *
 * 失敗處理（rules §7）：若 [role=combobox] 順序不是 language/pageSize，spec 應該
 * 失敗並在報告裡截圖整個 General tab，不要為了綠燈調寬 assertion。
 */
import { expect, test } from '@playwright/test';

import { shot } from './_helpers/screenshot';
import { openSettings } from './_helpers/settings-bar';
import { installTauriShim } from './_helpers/tauri-shim';

test.describe('Task 6 — Settings page-size', () => {
   test.beforeEach(async ({ page }) => {
      await installTauriShim(page);
      await page.goto('/');
      await expect(page.locator('#wrapper')).toBeVisible({ timeout: 10_000 });
      await page.waitForLoadState('networkidle');
   });

   test('pageSize change persists across modal close+reopen', async ({ page }) => {
      // ── Step 1: 開啟 Settings + 紀錄 pageSize 預設值 ──
      const dialog = await openSettings(page);
      const generalPanel = dialog.locator('[role=tabpanel][data-state=active]');
      const pageSizeSelect = generalPanel.locator('[role=combobox]').nth(1);
      const initialLabel = (await pageSizeSelect.textContent())?.trim() || '';
      await shot(page, 'task6-step1-initial-pagesize');

      // ── Step 2: 開啟下拉 + 點非預設值 ──
      await pageSizeSelect.click();
      const item250 = page.locator('.select__list .select__item', { hasText: /^250$/ }).first();
      const fallback = page.locator('.select__list .select__item').last();
      const target = (await item250.count()) > 0 ? item250 : fallback;
      const targetText = (await target.textContent())?.trim() || '';
      await target.click();

      // ── Step 3: 驗收 — trigger 反映新值且不等於初始 ──
      await expect(pageSizeSelect).toContainText(targetText, { timeout: 2_000 });
      expect(targetText, 'must change to a different value').not.toBe(initialLabel);
      await shot(page, 'task6-step2-pagesize-changed');

      // ── Step 4: 關閉 modal ──
      await dialog.locator('header button').first().click();
      await expect(dialog).toBeHidden({ timeout: 3_000 });

      // ── Step 5: 重開 + 驗收 — 仍是新值 ──
      const dialog2 = await openSettings(page);
      const generalPanel2 = dialog2.locator('[role=tabpanel][data-state=active]');
      const pageSizeSelect2 = generalPanel2.locator('[role=combobox]').nth(1);
      await expect(pageSizeSelect2).toContainText(targetText, { timeout: 2_000 });
      await shot(page, 'task6-step3-persisted-after-reopen');
   });
});
