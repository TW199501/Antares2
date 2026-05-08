/**
 * Task 5 — i18n 語系切換（en-US ↔ zh-TW）
 *
 * Batch 1 只驗 en-US ↔ zh-TW round-trip。
 * Batch 3 會擴充到全 5 個語系（en-US / zh-CN / zh-TW / ja-JP / ko-KR）。
 *
 * 驗收：
 *   1. Settings → General → Language 切到 繁體中文 → Dialog 標題從
 *      "Settings" → "設定"（i18n key application.settings）。
 *   2. 切回 English → 標題回到 "Settings"。
 *
 * 注意：磁碟持久化是 no-op（Tauri shim 把 unknown invoke 設為 null），但 in-memory
 * locale 切換由 Pinia settings store + vue-i18n reactive locale 驅動，視覺翻轉是真的。
 */
import { expect, Locator, Page, test } from '@playwright/test';

import { shot } from './_helpers/screenshot';
import { openSettings } from './_helpers/settings-bar';
import { installTauriShim } from './_helpers/tauri-shim';

async function pickLocale (page: Page, dialog: Locator, displayText: RegExp) {
   const generalPanel = dialog.locator('[role=tabpanel][data-state=active]');
   const languageSelect = generalPanel.locator('[role=combobox]').first();
   await languageSelect.click();
   const option = page.locator('.select__list .select__item', { hasText: displayText }).first();
   await option.click();
}

test.describe('Task 5 — i18n 語系切換', () => {
   test.beforeEach(async ({ page }) => {
      await installTauriShim(page);
      await page.goto('/');
      await expect(page.locator('#wrapper')).toBeVisible({ timeout: 10_000 });
      await page.waitForLoadState('networkidle');
   });

   test('en-US ↔ zh-TW round-trip', async ({ page }) => {
      // ── Step 1: 開啟 Settings（預設 en-US）──
      const dialog = await openSettings(page);
      await shot(page, 'task5-step1-en-default');

      // ── Step 2: 切到 繁體中文 ──
      await pickLocale(page, dialog, /繁體中文/);
      await expect(dialog.locator('h2, [role=heading]').first()).toContainText('設定', { timeout: 3_000 });
      await shot(page, 'task5-step2-zh-tw');

      // ── Step 3: 切回 English（讓後續 spec 預設 en-US 起跑）──
      await pickLocale(page, dialog, /^English/);
      await expect(dialog.locator('h2, [role=heading]').first()).toContainText('Settings', { timeout: 3_000 });
      await shot(page, 'task5-step3-back-to-en');
   });
});
