/**
 * Task 8 — Settings → About tab 顯示版本號與 package.json 一致
 *
 * 驗收：
 *   1. About tab（ModalSettings.vue tab 順序最後一個）切換後 active。
 *   2. 對應 tabpanel 內含 package.json 的 version 字串（目前 0.8.4）。
 *
 * 失敗處理（rules §7）：版本不符時，failure 訊息會帶出實際渲染文字，便於診斷。
 * 不要為了綠燈調寬到「contains 0」這種無意義 assertion。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { shot } from './_helpers/screenshot';
import { openSettings } from './_helpers/settings-bar';
import { installTauriShim } from './_helpers/tauri-shim';

const VERSION = (JSON.parse(
   readFileSync(join(process.cwd(), 'package.json'), 'utf-8')
) as { version: string }).version;

test.describe('Task 8 — Settings about tab', () => {
   test.beforeEach(async ({ page }) => {
      await installTauriShim(page);
      await page.goto('/');
      await expect(page.locator('#wrapper')).toBeVisible({ timeout: 10_000 });
      await page.waitForLoadState('networkidle');
   });

   test(`about tab shows version ${VERSION}`, async ({ page }) => {
      // ── Step 1: 開啟 Settings + 切到最後一個 tab（About）──
      const dialog = await openSettings(page);
      await dialog.locator('[role=tab]').last().click();

      // ── Step 2: 驗收 — tabpanel 可見 ──
      const panel = dialog.locator('[role=tabpanel][data-state=active]');
      await expect(panel).toBeVisible({ timeout: 3_000 });
      await shot(page, 'task8-step1-about-tab-active');

      // ── Step 3: 驗收 — 顯示與 package.json 一致的版本號 ──
      await expect(panel).toContainText(VERSION, { timeout: 3_000 });
      await shot(page, 'task8-step2-version-matches');
   });
});
