/**
 * Task 4 — 主題切換（dark ↔ light）
 *
 * 驗收：
 *   1. #wrapper 一律帶有 theme-<name> class（App.vue 的 [`theme-${applicationTheme}`]）。
 *   2. 開啟 Settings → Themes tab → 點對立主題 tile → #wrapper class 翻轉。
 *
 * 注意：active theme 會透過 persistStore（Tauri FS plugin）寫入磁碟。我們的
 * Tauri shim 對未知 invoke 回傳 null，所以持久化是 no-op；這裡只驗收 in-memory
 * class flip，不測 reload 後是否保留。
 */
import { expect, test } from '@playwright/test';

import { shot } from './_helpers/screenshot';
import { openSettings } from './_helpers/settings-bar';
import { installTauriShim } from './_helpers/tauri-shim';

test.describe('Task 4 — 主題切換', () => {
   test.beforeEach(async ({ page }) => {
      await installTauriShim(page);
      await page.goto('/');
      await expect(page.locator('#wrapper')).toBeVisible({ timeout: 10_000 });
      await page.waitForLoadState('networkidle');
   });

   test('theme toggle changes #wrapper class', async ({ page }) => {
      const wrapper = page.locator('#wrapper');

      // ── Step 1: 紀錄初始主題 ──
      const initialClass = (await wrapper.getAttribute('class')) || '';
      const wasDark = /(^|\s)theme-dark(\s|$)/.test(initialClass);
      await shot(page, 'task4-step1-initial-theme');

      // ── Step 2: 開啟 Settings → 切到 Themes tab ──
      const dialog = await openSettings(page);
      await dialog.locator('[role=tab]').nth(1).click();

      // ── Step 3: 點對立主題 tile ──
      const themePanel = dialog.locator('[role=tabpanel][data-state=active]');
      await expect(themePanel).toBeVisible();
      const tiles = themePanel.locator('button[type=button]');
      const targetTile = wasDark ? tiles.nth(1) : tiles.nth(0);
      await targetTile.click();
      await shot(page, 'task4-step2-after-tile-click');

      // ── Step 4: 驗收 — class 已翻轉 ──
      const expected = wasDark ? 'theme-light' : 'theme-dark';
      await expect(wrapper).toHaveClass(new RegExp(`(^|\\s)${expected}(\\s|$)`), { timeout: 2_000 });
      const newClass = (await wrapper.getAttribute('class')) || '';
      expect(newClass).not.toBe(initialClass);
      await shot(page, 'task4-step3-theme-flipped');
   });
});
