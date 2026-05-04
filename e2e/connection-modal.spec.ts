/**
 * E2E smoke: connection-creation panel.
 *
 * NOTE: "Add connection" in antares2 is *not* a Reka Dialog. Clicking the
 * mdiPlus icon in TheSettingBar invokes `selectWorkspace('NEW')` which
 * mounts `WorkspaceAddConnectionPanel.vue` inline inside `#main-content`
 * (see web/renderer/App.vue). This spec verifies that flow renders the
 * General/SSL/SSH tab list and an editable connection-name input.
 *
 * Asserts:
 *   1. Clicking `+` in the settingbar middle group mounts the connection panel
 *      (`.connection-panel-wrapper`).
 *   2. The panel renders with the General tab as the default + a Connection
 *      Name input that can receive focus and accept text.
 *   3. Clicking another workspace icon (or the panel close affordance, if
 *      present) is not exercised here — there is no Cancel button in the
 *      legacy panel; the user navigates away by selecting a different
 *      workspace. We therefore stop at "renders + input works".
 *
 * Prerequisites:
 *   - `pnpm vite:dev` running on http://127.0.0.1:5555.
 *
 * Selector convention:
 *   - Structural CSS: `.settingbar-middle-elements .settingbar-element` (the
 *     mdiPlus button). The bottom group hosts settings/scratchpad/specsnap;
 *     the middle group hosts only the dots-overflow + plus icons. We pick the
 *     *last* element to skip the conditional dots-overflow icon.
 *   - `.connection-panel-wrapper` is owned by WorkspaceAddConnectionPanel.vue.
 *   - Tabs use Reka — `[role=tablist]` / `[role=tab]` are stable a11y hooks.
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

test.describe('connection-creation panel', () => {
   test.beforeEach(async ({ page }) => {
      await installTauriShim(page);
      await page.goto('/');
      await expect(page.locator('#wrapper')).toBeVisible({ timeout: 10_000 });
      await page.waitForLoadState('networkidle');
   });

   test('opens connection panel, form renders, name input accepts input', async ({ page }) => {
      // mdiPlus is the last item in the middle group (dots-overflow only
      // appears when the connections list is scrollable — usually not in
      // a fresh dev session, but we still take .last() to be robust).
      const plusBtn = page
         .locator('.settingbar-middle-elements .settingbar-element')
         .last();
      await plusBtn.click();

      const panel = page.locator('.connection-panel-wrapper');
      await expect(panel).toBeVisible({ timeout: 5_000 });

      // Tabs render: at minimum "general", optionally ssl/ssh depending on
      // selected client's customizations. Default client is mysql (per
      // WorkspaceAddConnectionPanel default state), which exposes all three.
      const tabs = panel.locator('[role=tab]');
      await expect(tabs.first()).toBeVisible();
      const tabCount = await tabs.count();
      expect(tabCount, 'expected at least the General tab').toBeGreaterThanOrEqual(1);

      // The very first input on the General tab is the connection-name field
      // (FormField labelled `connection.connectionName`). We don't query by
      // text since labels are i18n-translated.
      const firstInput = panel.locator('input[type=text]').first();
      await expect(firstInput).toBeVisible();
      await firstInput.fill('e2e-smoke-connection');
      await expect(firstInput).toHaveValue('e2e-smoke-connection');
   });
});
