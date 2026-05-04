/**
 * E2E smoke: settings modal open / tab switch / close.
 *
 * Asserts:
 *   1. Clicking the gear icon in the bottom of #settingbar opens ModalSettings
 *      (Reka Dialog teleports content under the document body — we wait for
 *      `[role=dialog]`).
 *   2. Tabs render with `value="general"` selected by default and switching to
 *      `value="themes"` updates the active TabsTrigger's data-state.
 *   3. Clicking the close X button (the only ghost icon button in the dialog
 *      header) dismisses the dialog.
 *
 * Prerequisites:
 *   - `pnpm vite:dev` running on http://127.0.0.1:5555.
 *
 * Selector convention:
 *   - Structural CSS for the settingbar (no data-testid attributes exist on
 *     `.settingbar-element` items; we anchor on the bottom group + its third
 *     child which is the gear/settings icon — see web/renderer/components/
 *     TheSettingBar.vue).
 *   - Reka-vue's Dialog exposes `[role=dialog]`; Tabs expose `[role=tablist]`
 *     and `[role=tab][data-state=active|inactive]`. These are stable a11y
 *     hooks owned by the upstream library.
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

test.describe('settings modal', () => {
   test.beforeEach(async ({ page }) => {
      await installTauriShim(page);
      await page.goto('/');
      await expect(page.locator('#wrapper')).toBeVisible({ timeout: 10_000 });
      await page.waitForLoadState('networkidle');
   });

   test('opens, switches tabs, and closes', async ({ page }) => {
      // Bottom group of settingbar: [specsnap, scratchpad, settings].
      // Settings (gear) is the last `.settingbar-element`. Anchored on the
      // bottom group container so we don't accidentally hit the top
      // connections list or the middle `add connection` button.
      const settingsBtn = page
         .locator('.settingbar-bottom-elements .settingbar-element')
         .last();
      await settingsBtn.click();

      // Reka teleports Dialog content to <body>; the dialog itself carries
      // role=dialog with an aria-labelledby that points to the title.
      const dialog = page.locator('[role=dialog]').first();
      await expect(dialog).toBeVisible({ timeout: 5_000 });

      // Default tab is "general" (set in store via showSettingModal('general')
      // -> selectedSettingTab). data-state is owned by Reka.
      const generalTab = dialog.locator('[role=tab][data-value=general], [role=tab]').filter({ hasText: /^.+$/ }).first();
      await expect(generalTab).toHaveAttribute('data-state', 'active');

      // Themes tab is the 2nd trigger. We anchor on order rather than text
      // because text is i18n-translated.
      const themesTab = dialog.locator('[role=tab]').nth(1);
      await themesTab.click();
      await expect(themesTab).toHaveAttribute('data-state', 'active');

      // Close via the X button in the header. ModalSettings.vue puts a single
      // ghost icon button in the DialogHeader (variant=ghost size=icon, with
      // an mdiClose svg). It's the only `button` directly inside the header
      // grid — `header button` matches it.
      const closeBtn = dialog.locator('header button').first();
      await closeBtn.click();

      await expect(dialog).toBeHidden({ timeout: 5_000 });
   });
});
