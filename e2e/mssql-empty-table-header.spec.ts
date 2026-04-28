/**
 * E2E 測試：MSSQL 切換資料庫後，第一個開啟的「空表」是否正確渲染欄位 header
 *
 * 問題背景：
 *   使用者回報：「在第一個資料庫 MASTER 看起來正確，切換到第二個資料庫後又失效」
 *   初步修正（WorkspaceTabTable.vue 的 lastTable watcher 預賦值 + WorkspaceTabQueryTable
 *   的 filteredFields dedupe）後，**有資料的表** header 都能正確渲染。
 *
 *   但 2026-04-23 以 Playwright 重現發現：切換 DB 後若第一個開啟的表是「零列（0 rows）」，
 *   header 會完全不顯示（.th 元素在 DOM 中存在但高度為 0）。
 *   有資料的表則正常——這是 zero-row 特有 regression。
 *
 * 執行前置條件：
 *   1. pnpm vite:dev 已啟動（http://localhost:5173）
 *   2. SQL Server 可連線，預設連到 192.168.25.100:14330
 *   3. 使用環境變數覆蓋：MSSQL_HOST / MSSQL_PORT / MSSQL_USER / MSSQL_PASS
 *   4. Renderer 需要 Tauri runtime；本 spec 用 addInitScript 注入最小 TAURI_INTERNALS shim
 *      讓 httpClient.invoke('get_sidecar_token') 回傳空字串，配合 sidecar DEV_MODE 跳過鑑權。
 *
 * 執行指令：
 *   pnpm test:e2e e2e/mssql-empty-table-header.spec.ts
 *   或 headed mode 觀察：
 *   pnpm test:e2e e2e/mssql-empty-table-header.spec.ts --headed
 */

import { expect, Page, test } from '@playwright/test';

const VITE_URL = process.env.VITE_URL || 'http://localhost:5173';

// Reference connection identity for this test.
// Renamed with `_` prefix to satisfy @typescript-eslint/no-unused-vars —
// the test currently assumes the connection has been pre-seeded into
// localStorage by the operator (see "Prerequisites" comment above), so
// these env vars are not consumed by the spec itself, only documented
// here so a future fixture script can pick them up.
const _MSSQL = {
   host: process.env.MSSQL_HOST || '192.168.25.100',
   port: process.env.MSSQL_PORT || '14330',
   user: process.env.MSSQL_USER || 'sa',
   password: process.env.MSSQL_PASS || 'Sql@admin',
   name: 'e2e-header-test'
};

// 注入最小 Tauri shim — 讓 renderer 在純瀏覽器下可以 boot 起來。
async function installTauriShim (page: Page) {
   await page.addInitScript(() => {
      // 最小 invoke：get_sidecar_token 回空字串（DEV_MODE 跳過鑑權），其他命令 no-op。
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

// 點 BaseSelect 開 dropdown、選中特定 option
async function selectDbInSwitcher (page: Page, dbName: string) {
   const combobox = page.locator('[title="切換資料庫"] [role=combobox]');
   await combobox.click();
   // BaseSelect 的 dropdown 以 .select__list > .select__item 呈現
   const option = page.locator('.select__list .select__item', { hasText: new RegExp(`^${dbName}$`) });
   await option.first().click();
   // 等連線重建完成（connectionStatus 回 connected）
   await page.waitForTimeout(1500);
}

// 雙擊 sidebar 中第一個 table（依 label 定位）
async function openTableByName (page: Page, tableName: string) {
   const item = page.locator('.menu-item', { hasText: tableName }).first();
   await expect(item).toBeVisible();
   await item.dispatchEvent('dblclick');
   // 等 table data 載入 + WorkspaceTabTable 掛載
   await page.waitForTimeout(2000);
}

// 抓當前 active tab 的 header cell 文字 + 總高度
async function captureHeaderState (page: Page) {
   return await page.evaluate(() => {
      const ths = Array.from(document.querySelectorAll('.th'))
         .filter(el => (el as HTMLElement).offsetParent !== null) as HTMLElement[];
      return {
         count: ths.length,
         texts: ths.map(el => el.textContent?.trim() || '').filter(Boolean),
         // 總渲染高度：header row 真的「看得到」必須 > 0
         maxHeight: Math.max(0, ...ths.map(el => el.getBoundingClientRect().height)),
         firstRect: ths[0]?.getBoundingClientRect()
      };
   });
}

test.describe('MSSQL zero-row table header regression', () => {
   test.beforeEach(async ({ page }) => {
      await installTauriShim(page);
   });

   test('切換 DB 後，第一個開啟的空表仍需顯示欄位 header', async ({ page }) => {
      await page.goto(VITE_URL);
      await page.waitForLoadState('networkidle');

      // ── Step 1: 新增連線 ──
      // 這一步在 headed 手動建立連線 / 或預設 localStorage 已存在時會直接進 workspace
      // 本測試假設 localStorage 已有名為 MSSQL.name 的連線（由使用者或前置腳本建立）
      // —— 若全新環境請參考 e2e/screenshots/dbswitch-step1~3 的流程手動建立
      await page.screenshot({ path: 'e2e-results/screenshots/empty-header-step1-booted.png' });

      // ── Step 2: 進入第一個 DB（master），並開第一個有資料的表 ──
      await selectDbInSwitcher(page, 'master');
      await openTableByName(page, 'MSreplication_options');
      const masterState = await captureHeaderState(page);
      await page.screenshot({ path: 'e2e-results/screenshots/empty-header-step2-master-filled.png' });

      expect(masterState.count, 'master.MSreplication_options header 應該存在').toBeGreaterThanOrEqual(6);
      expect(masterState.maxHeight, 'master header row 應該看得到（height > 0）').toBeGreaterThan(10);

      // ── Step 3: 切換到第二個 DB（AdminNET）並開第一個表（approval_flow，0 列）──
      await selectDbInSwitcher(page, 'AdminNET');
      await openTableByName(page, 'approval_flow');
      const adminState = await captureHeaderState(page);
      await page.screenshot({ path: 'e2e-results/screenshots/empty-header-step3-admin-empty.png' });

      // ── 驗收：就算是零列，header 也必須渲染 ──
      expect(
         adminState.count,
         `AdminNET.approval_flow (0 rows) header 被吞掉了；實際 .th 可見數=${adminState.count}`
      ).toBeGreaterThanOrEqual(10);
      expect(
         adminState.maxHeight,
         `AdminNET.approval_flow header row 高度 ${adminState.maxHeight}px（應 > 10px）`
      ).toBeGreaterThan(10);

      // 附帶：特定欄位應該存在（不是只有一堆空格）
      expect(adminState.texts).toContain('id');
      expect(adminState.texts).toContain('name');
   });
});
