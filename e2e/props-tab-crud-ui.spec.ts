/**
 * E2E 測試:Properties Tab CRUD — UI 點按鈕逐步走查
 *
 * 跟 props-tab-crud.spec.ts(T7 直連 API)互補 — 這支跑「使用者真的在 UI 上點」
 * 的完整流程:
 *   1. 連線(MSSQL master)
 *   2. 雙擊 _antares_walk 開 table tab
 *   3. 切到「屬性」tab
 *   4. 按「新增」開 EditFieldModal,填 avatar_url + NVARCHAR(500) + 中文 comment,確定
 *   5. (可選)按 avatar_url row 的「編輯欄位」改名 → avatar
 *   6. (可選)按「刪除」DROP COLUMN
 *   7. 用 `request` fixture 直接查 sys.columns / sys.extended_properties 驗 DB
 *
 * 為什麼用 marker 模式 (`data-walkthrough` attribute)?
 *   Reka UI 的 [role="tab"] / dropdown chevron 等元件,Playwright 預設的
 *   getByRole / getByText 在 hidden tab panels 殘留時容易選錯到不可見的副本
 *   (workspace-query-tab 的 hidden 屬性 tabs).改用「先 evaluate 標 attribute、
 *   再 locator click」的 mark-then-click 模式可以保證選到 visible 的那個.
 *
 * 已知 renderer-side 不過 — UI 走查時觀察到的 bug,跟 backend T9 converter 修
 * 已分開處理.這支 spec 暫時只 assert 到「modal 開、可填寫、按確定」,UI 可見的
 * row 是否更新由「直接 SELECT DB 驗證」承擔.等 renderer bug 修完再加 row 斷言.
 *
 * 已知 bug(commit f-up 紀錄在 docs/superpowers/plans/...):
 *   1. Reka Dialog 關閉時 overlay 殘留,連續開關時擋下次 click
 *   2. Edit 模式 confirmEditModal 走 add+drop 而非 in-place,產生
 *      "Column name specified more than once" 500 error
 *   3. SQL 執行例外回 500 而非 200+envelope error(violates wire contract)
 *
 * 執行:
 *   pnpm test:e2e e2e/props-tab-crud-ui.spec.ts
 *
 * 前置:
 *   pnpm sidecar:dev / pnpm tauri:dev 已啟動,MSSQL 環境變數齊全
 */

import { expect, test } from '@playwright/test';

const SIDECAR = 'http://127.0.0.1:5555';

const MSSQL = {
   host: process.env.MSSQL_HOST || 'localhost',
   port: Number(process.env.MSSQL_PORT || 1433),
   user: process.env.MSSQL_USER || 'sa',
   password: process.env.MSSQL_PASS || '',
   db: process.env.MSSQL_DB1 || 'master'
};

const sandbox = `_antares_ui_${Date.now()}`;
const probeUid = () => `probe-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

test.describe('Properties tab CRUD — UI walkthrough (mssql)', () => {
   test('新增欄位 button: full modal flow + DB write', async ({ page, request }) => {
      const uid = probeUid();

      try {
         // ── Setup: 用 request 直接建沙盒 table(避免 UI 「建表」 modal 的牽涉) ──
         await request.post(`${SIDECAR}/api/connection/connect`, {
            data: {
               uid,
               client: 'mssql',
               host: MSSQL.host,
               port: MSSQL.port,
               user: MSSQL.user,
               password: MSSQL.password,
               database: MSSQL.db
            }
         });
         await request.post(`${SIDECAR}/api/tables/create`, {
            data: {
               uid,
               schema: 'dbo',
               table: sandbox,
               columns: [
                  { name: 'id', type: 'INT', nullable: false, isPrimary: true, autoIncrement: true },
                  { name: 'email', type: 'NVARCHAR(255)', nullable: false }
               ]
            }
         });

         // ── 開瀏覽器、連到 dev server、走 UI ──
         await page.goto('http://localhost:5173');

         // 1) 連線(假設連線面板已預填,使用者只需點「連線」)
         const markBtn = (text: string, name: string) => page.evaluate(([t, n]) => {
            const b = Array.from(document.querySelectorAll('button')).find(b =>
               (b.textContent || '').trim() === t && (b as HTMLElement).offsetParent !== null);
            if (b) b.setAttribute('data-walkthrough', n);
            return !!b;
         }, [text, name]);

         if (await markBtn('連線', 'connect')) {
            await page.locator('[data-walkthrough="connect"]').click();
            await page.waitForTimeout(2000);
         }

         // 2) 重新整理 schema tree(因為沙盒 table 是直接走 API 建的)
         await page.evaluate(() => {
            // 第二個按鈕是 refresh(第一個是「新建 schema」),依 WorkspaceExploreBar.vue 順序
            const btns = Array.from(document.querySelectorAll('button.inline-flex.h-8.w-8'))
               .filter(b => (b as HTMLElement).offsetParent !== null);
            (btns[1] as HTMLButtonElement)?.click();
         });
         await page.waitForTimeout(1000);

         // 3) 雙擊 sandbox table 開 tab
         await page.evaluate((name) => {
            const li = Array.from(document.querySelectorAll('li.tree-row')).find(e =>
               (e.textContent || '').trim() === name);
            if (li) {
               ['mousedown', 'mouseup', 'click', 'mousedown', 'mouseup', 'click', 'dblclick'].forEach(t =>
                  li.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window, button: 0 })));
            }
         }, sandbox);
         await page.waitForTimeout(1000);

         // 4) 切到「屬性」tab(篩 visible — 過濾掉 hidden workspace-query-tab 的副本)
         await page.evaluate(() => {
            const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
            const propsTab = tabs.find(t =>
               (t.textContent || '').trim() === '屬性' && t.getBoundingClientRect().width > 0);
            if (propsTab) propsTab.setAttribute('data-walkthrough', 'props-tab');
         });
         await page.locator('[data-walkthrough="props-tab"]').click();

         // 5) 點「新增」開 EditFieldModal(屬性 tab 唯一可見的「新增」按鈕)
         await markBtn('新增', 'add-field');
         await page.locator('[data-walkthrough="add-field"]').click();

         // 6) 等 modal 開、標記內部元素
         await expect(page.locator('[role="dialog"][data-state="open"]')).toBeVisible();
         await page.evaluate(() => {
            const dialog = document.querySelector('[role="dialog"][data-state="open"]')!;
            const inputs = Array.from(dialog.querySelectorAll('input, textarea')) as HTMLInputElement[];
            inputs[0]?.setAttribute('data-walkthrough', 'name-input');
            const popup = Array.from(dialog.querySelectorAll('button')).find(b =>
               (b.getAttribute('aria-label') || '').includes('popup') ||
               (b.textContent || '').trim() === 'Show popup');
            popup?.setAttribute('data-walkthrough', 'type-popup');
            const desc = inputs.find(el => el.placeholder === '輸入描述...');
            desc?.setAttribute('data-walkthrough', 'desc-input');
            const confirm = Array.from(dialog.querySelectorAll('button')).find(b =>
               (b.textContent || '').trim() === '確定');
            confirm?.setAttribute('data-walkthrough', 'modal-confirm');
         });

         // 7) 填表、開 type popup、選 NVARCHAR、填描述
         await page.locator('[data-walkthrough="name-input"]').fill('avatar_url');
         await page.locator('[data-walkthrough="type-popup"]').click();
         await page.evaluate(() => {
            const nv = Array.from(document.querySelectorAll('[role="option"]'))
               .find(o => (o.textContent || '').trim() === 'NVARCHAR');
            nv?.setAttribute('data-walkthrough', 'opt-nvarchar');
         });
         await page.locator('[data-walkthrough="opt-nvarchar"]').click();
         await page.locator('[data-walkthrough="desc-input"]').fill('頭像 URL — UI 走查');

         // 8) 確定 — 觸發 confirmEditModal → push 到 localFields → saveChanges → POST /api/tables/alter
         await page.locator('[data-walkthrough="modal-confirm"]').click();
         await page.waitForTimeout(2000);

         // 9) 直接查 DB 驗 column 真寫入(不依 UI 渲染 — UI 那條路徑有 known renderer bug)
         const verifyRes = await request.post(`${SIDECAR}/api/schema/rawQuery`, {
            data: {
               uid,
               schema: 'dbo',
               query: `SELECT name FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.${sandbox}') AND name = 'avatar_url'`
            }
         });
         const verifyData = await verifyRes.json();
         expect(verifyData.status, '查詢應成功').toBe('success');
         expect(
            verifyData.response?.rows?.length,
            'avatar_url 應該已透過「新增欄位」按鈕寫入 sys.columns'
         ).toBe(1);
      }
      finally {
         await request.post(`${SIDECAR}/api/tables/drop`, {
            data: { uid, schema: 'dbo', table: sandbox }
         }).catch(() => { /* ignore */ });
         await request.post(`${SIDECAR}/api/connection/disconnect`, {
            data: { uid }
         }).catch(() => { /* ignore */ });
      }
   });
});
