/**
 * Task 1 — 應用程式啟動 smoke
 *
 * 驗收：
 *   1. Vite dev server 提供 renderer，#wrapper 掛載成功。
 *   2. 第一次繪製（network-idle）期間沒有 console.error。
 *
 * 前置：pnpm vite:dev（或 pnpm tauri:dev）跑在 http://localhost:5173。
 */
import { expect, test } from '@playwright/test';

import { shot } from './_helpers/screenshot';
import { installTauriShim } from './_helpers/tauri-shim';

test.describe('Task 1 — 應用程式啟動', () => {
   test.beforeEach(async ({ page }) => {
      await installTauriShim(page);
   });

   test('app boots with main window visible', async ({ page }) => {
      // ── Step 1: 導航 ──
      await page.goto('/');
      await expect(page.locator('#wrapper')).toBeVisible({ timeout: 10_000 });
      await shot(page, 'task1-step1-wrapper-mounted');

      // ── Step 2: 驗收 — settingbar 可見（store 已 hydrate）──
      await expect(page.locator('#settingbar')).toBeVisible();
      await shot(page, 'task1-step2-settingbar-visible');
   });

   test('no console errors on first paint', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => {
         if (msg.type() === 'error') errors.push(msg.text());
      });
      page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));

      // ── Step 1: 導航 + 等到 network idle ──
      await page.goto('/');
      await expect(page.locator('#wrapper')).toBeVisible({ timeout: 10_000 });
      await page.waitForLoadState('networkidle');
      await shot(page, 'task1-step3-after-network-idle');

      // ── Step 2: 驗收 — 沒有 console.error ──
      expect(
         errors,
         `unexpected console.error during first paint:\n${errors.join('\n')}`
      ).toEqual([]);
   });
});
