/**
 * Task 7 — Settings → Shortcuts tab 渲染至少一筆綁定
 *
 * 驗收：
 *   1. Shortcuts tab（ModalSettings.vue tab 順序：general / themes / shortcuts /
 *      data / [update] / changelog / about — 第 3 個觸發）切換後 active。
 *   2. 對應 tabpanel 內至少有一筆控制鍵 chip（Ctrl / Cmd / Alt / Shift / 對應符號）。
 *
 * 失敗處理（rules §7）：找不到 chip 時不要把 filter 拿掉，先截圖回報實際 DOM。
 * 預先綁定至少有 Ctrl+Q（quit）+ 連線 / 查詢相關，所以這個 assertion 不該綠燈靠運氣。
 */
import { expect, test } from '@playwright/test';

import { shot } from './_helpers/screenshot';
import { openSettings } from './_helpers/settings-bar';
import { installTauriShim } from './_helpers/tauri-shim';

test.describe('Task 7 — Settings shortcuts tab', () => {
   test.beforeEach(async ({ page }) => {
      await installTauriShim(page);
      await page.goto('/');
      await expect(page.locator('#wrapper')).toBeVisible({ timeout: 10_000 });
      await page.waitForLoadState('networkidle');
   });

   test('shortcuts tab renders at least one binding', async ({ page }) => {
      // ── Step 1: 開啟 Settings + 切到 Shortcuts tab ──
      const dialog = await openSettings(page);
      await dialog.locator('[role=tab]').nth(2).click();

      // ── Step 2: 驗收 — tabpanel 可見 ──
      const panel = dialog.locator('[role=tabpanel][data-state=active]');
      await expect(panel).toBeVisible({ timeout: 3_000 });
      await shot(page, 'task7-step1-shortcuts-tab-active');

      // ── Step 3: 驗收 — 至少一筆 Ctrl/Cmd/Alt/Shift 綁定 chip ──
      const chip = panel
         .locator('kbd, span')
         .filter({ hasText: /Ctrl|Cmd|Alt|Shift|⌘|⌃|⌥|⇧/ })
         .first();
      await expect(chip).toBeVisible({ timeout: 3_000 });
      await shot(page, 'task7-step2-binding-visible');
   });
});
