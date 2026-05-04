/**
 * E2E smoke: application boot.
 *
 * Asserts:
 *   1. The Vite dev server serves the renderer and #wrapper mounts.
 *   2. No `console.error` is emitted during the first paint (network-idle).
 *
 * Prerequisites:
 *   - `pnpm vite:dev` running on http://127.0.0.1:5555 (boots the sidecar via
 *     vite plugin). Without it the page never loads.
 *
 * Selector convention:
 *   - Renderer mounts under `#wrapper` (see web/renderer/App.vue). This is the
 *     most stable structural selector available — there are no data-testid
 *     attributes on the root layout components yet.
 *
 * Tauri shim:
 *   - The renderer calls `invoke('get_sidecar_token')` at boot via the
 *     Tauri Internals bridge. Inside a plain browser that bridge is missing
 *     and the renderer fails to register HTTP auth headers. We inject a
 *     minimal stub that resolves the token to '' (sidecar's DEV_MODE skips
 *     auth) so the renderer can finish booting. Same shim pattern as
 *     `e2e/mssql-empty-table-header.spec.ts`.
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

test.describe('app boot', () => {
   test.beforeEach(async ({ page }) => {
      await installTauriShim(page);
   });

   test('app boots with main window visible', async ({ page }) => {
      await page.goto('/');
      // 10s ceiling to ride out Vite's first-request transform; once mounted
      // the renderer paints in <1s on the dev box.
      await expect(page.locator('#wrapper')).toBeVisible({ timeout: 10_000 });

      // The settingbar is the canonical "renderer is alive" signal — it is
      // owned by App.vue (not lazy-loaded behind a connection) so its presence
      // proves the Pinia stores hydrated and the layout chrome rendered.
      await expect(page.locator('#settingbar')).toBeVisible();
   });

   test('no console errors on first paint', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => {
         if (msg.type() === 'error') errors.push(msg.text());
      });
      page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));

      await page.goto('/');
      await expect(page.locator('#wrapper')).toBeVisible({ timeout: 10_000 });
      await page.waitForLoadState('networkidle');

      expect(
         errors,
         `unexpected console.error during first paint:\n${errors.join('\n')}`
      ).toEqual([]);
   });
});
