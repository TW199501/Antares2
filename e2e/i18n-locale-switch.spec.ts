/**
 * Task 5 — i18n 語系切換（全 5 個語系 round-trip）
 *
 * 驗收：
 *   1. en-US ↔ zh-TW round-trip：Dialog 標題從 "Settings" → "設定" → "Settings"。
 *   2. 全 5 語系 round-trip：en-US → zh-CN → zh-TW → ja-JP → ko-KR → 回 en-US。
 *      每一站都驗 Dialog 標題 + 該語系的「Language」label（用來區分 zh-TW 跟
 *      ja-JP，兩者的 application.settings 都是「設定」，但 application.language
 *      分別是「語言」/「言語」）。
 *
 * Dropdown display names（web/renderer/i18n/supported-locales.ts）：
 *   en-US → English
 *   ja-JP → 日本語
 *   zh-CN → 简体中文
 *   zh-TW → 正體中文（注意不是「繁體中文」）
 *   ko-KR → 한국어
 *
 * 失敗處理（rules §7）：display name 不符時不要把 regex 拿掉，先 grep
 * supported-locales.ts 確認當前實際值再修，不要把 assertion 寬鬆掉騙綠燈。
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

interface LocaleCase {
   key: string;
   display: RegExp; // dropdown 顯示名
   settingsTitle: string; // application.settings
   languageLabel: RegExp; // application.language（區分 zh-TW vs ja-JP）
}

const LOCALES: LocaleCase[] = [
   { key: 'en-US', display: /^English/, settingsTitle: 'Settings', languageLabel: /Language/i },
   { key: 'zh-CN', display: /简体中文/, settingsTitle: '设置', languageLabel: /语言/ },
   { key: 'zh-TW', display: /正體中文/, settingsTitle: '設定', languageLabel: /語言/ },
   { key: 'ja-JP', display: /日本語/, settingsTitle: '設定', languageLabel: /言語/ },
   { key: 'ko-KR', display: /한국어/, settingsTitle: '설정', languageLabel: /언어/ }
];

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

      // ── Step 2: 切到 正體中文 ──
      await pickLocale(page, dialog, /正體中文/);
      await expect(dialog.locator('h2, [role=heading]').first()).toContainText('設定', { timeout: 3_000 });
      await shot(page, 'task5-step2-zh-tw');

      // ── Step 3: 切回 English（讓後續 spec 預設 en-US 起跑）──
      await pickLocale(page, dialog, /^English/);
      await expect(dialog.locator('h2, [role=heading]').first()).toContainText('Settings', { timeout: 3_000 });
      await shot(page, 'task5-step3-back-to-en');
   });

   test('round-trip through all 5 supported locales', async ({ page }) => {
      const dialog = await openSettings(page);

      for (const [i, loc] of LOCALES.entries()) {
         // ── Step N: 切到 <locale> ──
         await pickLocale(page, dialog, loc.display);

         // 標題（zh-TW + ja-JP 共用「設定」，所以還要驗 language label）
         await expect(dialog.locator('h2, [role=heading]').first()).toContainText(loc.settingsTitle, { timeout: 3_000 });

         // language label 是消歧鍵 — 在 General tabpanel 內
         const generalPanel = dialog.locator('[role=tabpanel][data-state=active]');
         await expect(generalPanel.getByText(loc.languageLabel).first()).toBeVisible({ timeout: 3_000 });

         await shot(page, `task5-step${i + 4}-${loc.key}`);
      }

      // 留在 en-US 讓後續 spec 預設可重現
      await pickLocale(page, dialog, /^English/);
      await expect(dialog.locator('h2, [role=heading]').first()).toContainText('Settings');
   });
});
