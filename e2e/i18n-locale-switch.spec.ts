/**
 * E2E smoke: i18n locale switch (en-US ↔ zh-TW).
 *
 * Asserts:
 *   1. Switching locale via Settings → General → Language updates rendered
 *      UI text. Specifically the dialog title (`application.settings`) goes
 *      from "Settings" (en-US) to "設定" (zh-TW) without a reload.
 *
 * Prerequisites:
 *   - `pnpm vite:dev` running on http://127.0.0.1:5555.
 *
 * Selector convention:
 *   - The Language row uses `BaseSelect` (custom), not a native `<select>` —
 *     it renders a button-styled trigger with a ".select__list .select__item"
 *     dropdown (same convention used by mssql-empty-table-header.spec.ts to
 *     pick a database in WorkspaceTabSelector).
 *   - Dialog title text comes from `t('application.settings')` which is
 *     "Settings" in en-US.json and "設定" in zh-TW.json.
 *
 * Caveat:
 *   - Persistence to disk is a no-op under the Tauri shim, but in-memory
 *     locale switching is driven by the Pinia settings store + vue-i18n's
 *     reactive locale, both of which run fully in the renderer. So the
 *     visual flip we assert is real.
 */

import { expect, Page, test } from '@playwright/test';

async function installTauriShim (page: Page) {
   await page.addInitScript(() => {
      (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {
         metadata: {
            currentWindow: { label: 'main' },
            currentWebview: { label: 'main', windowLabel: 'main' },
            windows: [{ label: 'main' }],
            webviews: [{ label: 'main', windowLabel: 'main' }]
         },
         invoke: (cmd: string) => {
            if (cmd === 'get_sidecar_token') return Promise.resolve('');
            return Promise.resolve(null);
         },
         transformCallback: (cb: unknown) => cb,
         convertFileSrc: (p: string) => p
      };
   });
}

async function openSettings (page: Page) {
   await page
      .locator('.settingbar-bottom-elements .settingbar-element')
      .last()
      .click();
   const dialog = page.locator('[role=dialog]').first();
   await expect(dialog).toBeVisible({ timeout: 5_000 });
   return dialog;
}

test.describe('i18n locale switch', () => {
   test.beforeEach(async ({ page }) => {
      await installTauriShim(page);
      await page.goto('/');
      await expect(page.locator('#wrapper')).toBeVisible({ timeout: 10_000 });
      await page.waitForLoadState('networkidle');
   });

   test('switching locale updates rendered UI text', async ({ page }) => {
      const dialog = await openSettings(page);

      // The General tab is the default. The first BaseSelect on the General
      // tab is the Language row (per ModalSettings.vue ordering: language,
      // pageSize, ...). BaseSelect renders a `.select__trigger`-style button
      // and opens a `.select__list` popup with `.select__item` rows.
      // We anchor on the active tabpanel to avoid hitting other selects.
      const generalPanel = dialog.locator('[role=tabpanel][data-state=active]');
      const languageSelect = generalPanel.locator('[role=combobox]').first();
      await languageSelect.click();

      // Choose 繁體中文 (zh-TW). The list is teleported but each item has
      // the locale display name as text.
      const zhTwOption = page.locator('.select__list .select__item', { hasText: /繁體中文/ }).first();
      await zhTwOption.click();

      // After switch, dialog title text should flip from "Settings" → "設定"
      // (i18n key application.settings). We give a short window for the
      // reactive update to flush.
      await expect(dialog.locator('h2, [role=heading]').first()).toContainText('設定', { timeout: 3_000 });

      // Switch back to English so the test leaves the persisted store in a
      // predictable state for following tests in the suite.
      await languageSelect.click();
      const enOption = page.locator('.select__list .select__item', { hasText: /^English/ }).first();
      await enOption.click();
      await expect(dialog.locator('h2, [role=heading]').first()).toContainText('Settings', { timeout: 3_000 });
   });
});
