/**
 * E2E smoke: theme toggle.
 *
 * Asserts:
 *   1. `#wrapper` always carries a `theme-<name>` class (driven by App.vue's
 *      `[\`theme-${applicationTheme}\`]` binding).
 *   2. Opening Settings → Themes tab and clicking the *opposite* theme tile
 *      flips the class on `#wrapper`.
 *
 * Prerequisites:
 *   - `pnpm vite:dev` running on http://127.0.0.1:5555.
 *
 * Selector convention:
 *   - `#wrapper` (App.vue root) for class observation.
 *   - Settingbar gear icon: structural CSS `.settingbar-bottom-elements
 *     .settingbar-element:last-child`.
 *   - Theme tiles: ModalSettings.vue renders the dark/light tiles as the
 *     two `<button type="button">` children of a 2-col grid inside the
 *     `themes` TabsContent. We anchor on the dialog + tabpanel to scope.
 *
 * Caveat:
 *   - The active theme is persisted via `persistStore` (Tauri FS plugin).
 *     With our shim returning `null` for unknown invokes, the persistence
 *     write is a no-op. That is fine for this in-memory class-flip
 *     assertion — we are not testing reload survival here.
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

test.describe('theme toggle', () => {
   test.beforeEach(async ({ page }) => {
      await installTauriShim(page);
      await page.goto('/');
      await expect(page.locator('#wrapper')).toBeVisible({ timeout: 10_000 });
      await page.waitForLoadState('networkidle');
   });

   test('theme toggle changes #wrapper class', async ({ page }) => {
      const wrapper = page.locator('#wrapper');
      const initialClass = (await wrapper.getAttribute('class')) || '';
      const wasDark = /(^|\s)theme-dark(\s|$)/.test(initialClass);

      // Open settings.
      await page
         .locator('.settingbar-bottom-elements .settingbar-element')
         .last()
         .click();

      const dialog = page.locator('[role=dialog]').first();
      await expect(dialog).toBeVisible({ timeout: 5_000 });

      // Switch to the Themes tab (2nd trigger — matches the order in
      // ModalSettings.vue: general, themes, shortcuts, data, [update],
      // changelog, about).
      await dialog.locator('[role=tab]').nth(1).click();

      // The two theme tiles are direct `button[type=button]` children inside
      // the `value=themes` TabsContent grid. dark is first, light is second.
      const themePanel = dialog.locator('[role=tabpanel][data-state=active]');
      await expect(themePanel).toBeVisible();
      const tiles = themePanel.locator('button[type=button]');
      // Click the *opposite* of the current theme so we always observe a flip.
      const targetTile = wasDark ? tiles.nth(1) : tiles.nth(0);
      await targetTile.click();

      // The wrapper's class should now contain the opposite theme.
      const expectedClassFragment = wasDark ? 'theme-light' : 'theme-dark';
      await expect(wrapper).toHaveClass(new RegExp(`(^|\\s)${expectedClassFragment}(\\s|$)`), { timeout: 2_000 });

      const newClass = (await wrapper.getAttribute('class')) || '';
      expect(newClass).not.toBe(initialClass);
   });
});
