/**
 * Task 9 — 連線面板 client 切換 → port 預設 + tab 列表更新
 *
 * 來源：web/common/customizations/{mysql,postgresql,sqlserver,sqlite}.ts。
 * 切換 client 觸發 panel 內的 watch（WorkspaceAddConnectionPanel.vue:512）
 * 將 connection.port = customizations.defaultPort、database = defaultDatabase
 * 重置。
 *
 * 驗收：每個 client 切過去後：
 *   - mysql / pg / mssql：3 個 tab（General + SSL + SSH）+ 預設 port 對應
 *     defaultPort（3306 / 5432 / 1433）。
 *   - sqlite：fileConnection 模式，沒有 numeric port input，General tab 是
 *     唯一 tab。
 *
 * 失敗處理（rules §7）：port 沒重置 = 真的 bug，spec 應失敗讓你看到，**不要**
 * 把 toHaveValue 拿掉換成 toBeVisible 騙綠燈。
 */
import { expect, test } from '@playwright/test';

import { shot } from './_helpers/screenshot';
import { clickAddConnection } from './_helpers/settings-bar';
import { installTauriShim } from './_helpers/tauri-shim';

interface ClientCase {
   slug: string; // customization key（給 screenshot 命名用）
   displayText: RegExp; // dropdown 顯示名
   expectPort?: string; // sqlite 不適用
   expectTabsCount: number; // 1（sqlite）/ 3（mysql/pg/mssql）
}

const CASES: ClientCase[] = [
   { slug: 'mysql', displayText: /^MySQL$/, expectPort: '3306', expectTabsCount: 3 },
   { slug: 'pg', displayText: /PostgreSQL/, expectPort: '5432', expectTabsCount: 3 },
   { slug: 'mssql', displayText: /SQL Server/, expectPort: '1433', expectTabsCount: 3 },
   { slug: 'sqlite', displayText: /SQLite/, expectTabsCount: 1 }
];

test.describe('Task 9 — 連線面板 client 切換', () => {
   test.beforeEach(async ({ page }) => {
      await installTauriShim(page);
      await page.goto('/');
      await expect(page.locator('#wrapper')).toBeVisible({ timeout: 10_000 });
      await page.waitForLoadState('networkidle');
   });

   test('switching client updates port + tab visibility', async ({ page }) => {
      // ── Step 1: 開啟連線面板（預設 mysql）──
      const panel = await clickAddConnection(page);
      await shot(page, 'task9-step1-panel-mounted');

      for (const [i, c] of CASES.entries()) {
         // ── Step N: 切換 client ──
         const clientSelect = panel.locator('[role=combobox]').first();
         await clientSelect.click();
         await page
            .locator('.select__list .select__item', { hasText: c.displayText })
            .first()
            .click();

         // ── Step N: 驗收 — tab 數量 ──
         await expect(panel.locator('[role=tab]')).toHaveCount(c.expectTabsCount, { timeout: 3_000 });

         // ── Step N: 驗收 — port 預設值（sqlite 例外，無 port）──
         if (c.expectPort !== undefined) {
            const portInput = panel.locator('input[type=number]').first();
            await expect(portInput).toHaveValue(c.expectPort);
         }
         else {
            // sqlite：file connection 模式，不應有 numeric port input
            await expect(panel.locator('input[type=number]')).toHaveCount(0, { timeout: 1_000 });
         }

         await shot(page, `task9-step${i + 2}-client-${c.slug}`);
      }
   });
});
