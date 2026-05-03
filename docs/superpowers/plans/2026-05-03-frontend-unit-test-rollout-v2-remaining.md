# Antares2 前端單元測試導入計畫 v2 — 剩餘工作（PR3-PR7）

> **承前**：[原 plan v1](./2026-05-03-frontend-unit-test-rollout.md) 已執行至 PR2 完成。本 v2 僅涵蓋**剩餘的 PR3-PR7**，把 v1 執行過程踩過的雷固化進來。

## 已完成狀態（無需重做）

| PR | 內容 | Commit | 結果 |
|----|------|--------|------|
| PR0 | `src/` → `web/` 改名 | `4b9bcda` + `cc0398a` | tauri:build 過、NSIS + MSI 產出 |
| PR1 | Vitest infra + setup + helpers + sample | `c791253` + `33085ab` + `a18b40a` + `bb1e3bc` + `ce8dc3e` | 20 tests / 4 files |
| chore | 9 個 baseline type errors 清掉（不在 v1 plan 內，bonus） | `9db642c` | 13 → 4 errors |
| PR2 | T3-T6 全部 utility / customization / composable | `bae4092` + `fb12da2` + `917979b` | **547 tests / 33 files** |
| PR3 | T7 fixture capture script + README（framework only）| `1c8be66` | script 寫好、實採集留 user 主導 |

**目前**：13 commits ahead of `origin/dev`、547 tests 全綠、type-check 4 errors（baseline）、lint clean。

## v1 → v2 修正摘要（從執行經驗學到的）

| # | v1 假設 | v2 修正 |
|---|--------|--------|
| 1 | T7 fixture 採集由 supervisor agent 跑（對 user dev DB 跑 capture script）| **採集只由 user 親手執行**。supervisor 提供 script + README、可在 user 給明確 credentials + scope 時執行、但**不主動 probe / port scan / 試 password 組合** |
| 2 | T7 必須在 PR4 之前完成（fixture replay 依賴 T7） | **允許 hand-crafted fixture 暫代** —— 從 source code (wrapper + route handler) 推導 request/response shape、commit 進 fixtures dir、待真採集時 diff verify |
| 3 | Subagent dispatch 用標準 prompt | **強制 prompt rule**：subagent 自己跑 `pnpm lint` + `pnpm type-check` 自驗、確認 0 errors 才回報。v1 PR2 開頭 44 lint errors 砸給 supervisor 救援，prompt 強化後 0 lint failure |
| 4 | Type-check baseline 12 (CLAUDE.md 寫的) | **Baseline 4，全在 `WorkspaceTabPropsTable.vue`** —— 是 props-table refactor (`6024be5`/`8400a26`/`5c052c7`) 三個 commit 留下、需要原作者 context 修。**不在本 plan 範圍**內 |
| 5 | 元件測試 i18n key 用真實 key | **i18n-ally 對 `t('字面值')` 強制檢查**，無論 key 是否存在。Test probe 用 `const probe = '__test__'; t(probe)` 變數包裝 bypass linter |
| 6 | happy-dom 需 polyfill 多項 DOM API | **happy-dom 20.x 已內建** IntersectionObserver / ResizeObserver / matchMedia / KeyboardEvent.getModifierState。setup.ts 仍 stub（defense-in-depth），但別把缺它當風險 |
| 7 | vue-i18n mock 全 session 持久 | **同檔案內 `vi.doUnmock('vue-i18n')` 不會自動 restore**。需要真 vue-i18n 的測試**單獨開檔**，不可跟 mocked 測試混雜（已在 setup.ts 文件化）|
| 8 | Subagent 找到 source bug 應修 | **Subagent 找到 source bug 一律 lock 不修源** —— 用 characterization test 鎖當前行為、commit message 標 quirk。修 bug 由 user 或專屬 PR 處理 |

## 剩餘任務 PR3-PR7

### PR3 / T7：IPC contract fixture（**大幅縮小範圍**）

**Scope 縮小**：v1 想對 4 dialect × 14 wrapper × happy/error path 全採集（≈ 600 fixture）。v2 切兩段：

#### PR3.A — hand-crafted fixture（supervisor 完成）

| 範圍 | 內容 |
|------|------|
| 來源 | 從 wrapper source (`web/renderer/ipc-api/*.ts`) + route handler source (`web/main/routes/*.ts`) 推導 |
| 對象 | 7-10 個最 critical 的 route：`connection/connect`、`connection/disconnect`、`databases/getDatabases`、`schema/getStructure`、`schema/getCollations`、`schema/getVersion`、`schema/rawQuery`、`tables/getTableData`、`tables/getTableColumns` |
| 格式 | `tests/fixtures/contract/<route>.<dialect>.<scenario>.json`，跟 v1 capture script 寫的格式一致 |
| Dialect | 預設 `mssql`（user 主環境）+ 1-2 個明顯有 dialect-specific 行為的（如 mysql 的 backtick、pg 的 schema-prefix） |
| Scenario | happy + 1 個 error path（如 invalid uid）|
| 來源證據 | 每個 fixture 在 `metadata` 加 `source: 'hand-crafted-from-wrapper-and-route-source'` 標記 |

#### PR3.B — real capture verify（**user 主導**）

當 user 提供完整 credentials（host / port / user / password 都明確）+ dedicated fixture DB 已建好時：
1. User 在自己終端機跑 `pnpm capture:contract -- mssql`（不在 chat 裡傳密碼）
2. User 把產出的 fixture 跟 PR3.A hand-crafted 版本 `diff`
3. 差異 = supervisor 推導不準的地方 → 用真 fixture 蓋過 hand-crafted、commit
4. 差異 < 5% 表示 PR3.A 推導品質可接受

**不阻塞 PR4**：PR3.A hand-crafted 落地即可開 PR4。PR3.B 是 follow-up validation。

**驗收**：`pnpm test:unit:run` 仍 547 tests + new fixture import 不 break、lint clean、`tests/fixtures/contract/` 目錄結構符合 README 規範。

---

### PR4 / T8：IPC contract replay 測試（**主管 + subagent 並行**）

**Scope**：14 個 ipc-api wrapper 各一個 `.test.ts`，重用 PR3.A fixture。

**Dispatch 策略**：4 個 subagent batch，每批 3-4 wrapper：
- Batch F：`Connection`、`Databases`、`Schema`（lifecycle 三件套）
- Batch G：`Tables`、`Views`（資料層）
- Batch H：`Triggers`、`Routines`、`Functions`、`Schedulers`（DDL 物件）
- Batch I：`Users`、`Application`、`Updater`、`Ai`（雜項）

**每個 wrapper test 形狀**（spec 已定）：
```ts
import fixture from '@tests/fixtures/contract/<route>.<dialect>.happy.json';
it('routes to correct path + maps response', async () => {
   vi.mocked(apiCall).mockResolvedValueOnce(fixture.response.body);
   const result = await Wrapper.method(fixture.request.payload);
   expect(apiCall).toHaveBeenCalledWith(fixture.request.route, fixture.request.payload);
   expect(result).toMatchObject(fixture.expected);
});
```

**httpClient.test.ts 加碼測試**（不 dispatch subagent，supervisor 親寫）：
- `X-Sidecar-Token` 注入
- `createWebSocket` 帶 `?token=` query
- token expire reload flow
- non-Tauri runtime fallback

**目標**：lines ≥ 90% / branches ≥ 75%（spec T8 warn-only target）

**驗收**：`pnpm test:unit:run` 全綠、新增 ~30-50 tests、lint clean、type-check 仍 4 errors。

---

### PR5 / T9-T11：Pinia stores 10 個（**3 commit 序列**）

跟 v1 spec 完全一致、執行時序也不變：

| Commit | Stores | 依賴 fixture? |
|--------|--------|--------------|
| T9 | settings、notifications、history、scratchpad | 否（純資料）|
| T10 | connections、workspaces、application | **是** —— 用 PR3.A fixture mock `apiCall` 回值 |
| T11 | console、schemaExport、tablePager | 否（schemaExport 走 worker thread protocol）|

**Dispatch 策略**：T9 + T11 supervisor 自己寫（小 + 簡單）；T10 dispatch 1 subagent（3 store 跨依賴複雜，避免並行 mock 衝突）。

**目標**：lines ≥ 80% / branches ≥ 65%（spec target）

**驗收**：`pnpm test:unit:run` 全綠、新增 ~50-80 tests、`createTestingPinia({ initialState })` 灌相依 store 預設值避免 NPE。

---

### PR6 / T12-T15：components + Playwright（**4 commit 序列**）

#### T12：shadcn 互動測試 5-7 個（supervisor 親寫）
- `Dialog` body pointer-events reset（user memory 抓到的雷）
- `Combobox` keyboard nav
- `Popover` ESC + click outside
- `Tooltip` aria-describedby
- `Sonner` toast queue + auto-dismiss
- `DropdownMenu` keyboard nav
- `ContextMenu` right-click trigger

#### T13：Base\* primitives 15-25 個（**dispatch 4-5 subagent 並行**）
從 `web/renderer/components/Base*.vue` Glob 出來、每個 subagent 5 個。

#### T14：The\* + 業務元件 5-10 個（supervisor + 1 subagent）
- The\*：`TheTitleBar`、`TheScratchpad`、`TheFooter`、`TheNotificationsBoard`、`TheSettingBar`、`TheSpecSnapInspector`
- 業務：`WorkspaceTabTable`（user 在改的）、`WorkspaceTabQuery`、`ModalEditCell`、`ModalNewConnection`、`SettingBarConnections`、`PropsTable`
- App.vue：`applicationTheme` toggle → `#wrapper` class 變化

#### T15：Playwright smoke 5 spec + viewport（supervisor 親寫）
- `app-boot.spec.ts`、`settings-modal.spec.ts`、`connection-modal.spec.ts`、`theme-toggle.spec.ts`、`i18n-locale-switch.spec.ts`
- `playwright.config.ts` 加 `viewport: { width: 1920, height: 1200 }`

**Claude 自驗**：T15 完成後 supervisor **必須**親跑 `pnpm vite:dev`（背景）+ `pnpm test:e2e`、貼結果（per v1 plan 自驗職責）。

**目標**：components 區 lines ≥ 40% / branches ≥ 25%（spec warn-only）；Playwright 8 spec 全綠（3 mssql 既有 + 5 新增）

**驗收**：`pnpm test:unit:run` 全綠、`pnpm test:e2e` 全綠、新增 ~50-100 tests + 5 e2e specs。

---

### PR7 / T16-T17：coverage gate + CI（**supervisor 親寫**）

#### T16：scripts/check-coverage.mjs（spec 已定）
- 讀 `coverage/lcov.info`
- 全域 hard gate：lines ≥ 60% / branches ≥ 60%
- 分區報告（warn-only）：common 95/90、ipc-api 90/75、stores 80/65、composables 85/70、components 40/25
- CLI：`pnpm test:coverage:check` / `... --report` 產 markdown table

#### T17：.github/workflows/test-build.yml unit-test job
- Parallel 跟 4 build job（不用 needs:）
- Steps：pnpm install → test:unit:run → test:coverage → test:coverage:check
- Upload `coverage/` 為 artifact
- Sticky PR comment 貼 coverage report

**驗收**：push dev、CI 4 build + 1 unit-test 全綠、PR comment 顯示 coverage 表。

---

## 順序 + 並行機會

```
PR3.A (hand-crafted fixture, supervisor)
   ↓
PR4 (8 個 wrapper replay subagent dispatch in 4 batches) ‖ PR5/T9 (4 pure stores, supervisor)
   ↓
PR5/T10 (3 ipc-api stores, 1 subagent) ‖ PR5/T11 (3 remaining stores, supervisor)
   ↓
PR6/T12 (shadcn interactions, supervisor) ‖ PR6/T13 (Base* primitives, 4-5 subagent)
   ↓
PR6/T14 (The* + business, supervisor + 1 subagent)
   ↓
PR6/T15 (Playwright smoke, supervisor + Claude self-run)
   ↓
PR7/T16 + T17 (coverage gate + CI, supervisor)
   ↓
PR3.B (real fixture capture, USER-MAINTAINED)
```

## 不在範圍（沿用 v1 + 新增）

- 不寫 97 個 shadcn primitive snapshot
- 不測 `web/main/`、`src-tauri/src/sidecar.rs`
- 不開 worktree
- 不改 `web/renderer/scss/main.scss` legacy
- 不拆 monorepo
- 不寫 .NET 10 backend
- **新增**：不主動對 user 內網設備 probe / port scan / 試認證組合（v1 PR3.B 教訓）
- **新增**：不修 `WorkspaceTabPropsTable.vue` 那 4 個 type errors（baseline，需 props-table refactor 作者 context）
- **新增**：subagent 找到 source bug 一律 lock 不修源（如 `sqlEscaper` 控制字元、`querySplitter` dollar-tag corruption、`useResultTables` module-top Pinia call）

## 預估時間

| PR | 預估 | 備註 |
|----|------|------|
| PR3.A | 1-2h | hand-crafted fixture，從 source 推 |
| PR4 | 2-3h | 4 batches subagent + httpClient supervisor 親寫 |
| PR5 | 2-3h | T9 + T11 supervisor 親寫、T10 1 subagent |
| PR6 | 3-4h | T13 是最重 dispatch 工作量、T15 Playwright 自跑驗收 |
| PR7 | 1-2h | T16 寫 lcov parser、T17 yaml |
| **合計** | **9-14h** | 不含 PR3.B real capture（user 主導、時間另計） |

## 風險（v2 新增 + 沿用）

- **PR3.A hand-crafted fixture 可能跟真 sidecar response 有 5-10% drift**：drift 區會在 PR3.B 真 capture 時暴露 → 真 fixture 蓋過 hand-crafted、相關 wrapper test 跟著 update。**這是已知 acceptable trade-off**，換取 PR4 不被 PR3 卡住。
- **happy-dom KeyboardEvent.target 需 `bubbles: true`** 才能冒到 window listener（PR2/T6 抓到、寫進 setup.ts comment）—— PR4-PR6 凡 dispatch keyboard event 都要 bubble。
- **subagent dispatch 仍可能漏 `pnpm lint` 自驗**：v2 prompt 要 explicit 寫「lint exit 0 才 reporting」、加上 supervisor 收到後 spot-check 兩個檔。
- **PR6/T15 Playwright 真跑** 需要 vite:dev 在 5173、sidecar 在 5555。**user 重啟 dev session 後 supervisor 才能跑** —— 否則 5556 上的 capture sidecar 跟 5555 上的 dev sidecar 共存沒衝突，但 e2e 預期打到 dev sidecar。
- **subagent prompt 要寫死「不對 user 內網做網路探測」**：v1 PR3.B 越界教訓，prompt 內顯式禁止 port scan / dictionary / connection retry on failure。

## v2 留下的決定點

供 user 隨時介入：
1. PR3.B 真 fixture 採集 —— 你準備好 dedicated fixture DB + 完整 credentials 後告訴我，我才跑（不再自己猜 port / password）。
2. `WorkspaceTabPropsTable.vue` 4 errors —— 哪天想清這 baseline 再說。
3. `sqlEscaper` / `querySplitter` 真 bug —— PR2 鎖在 test 裡、修不修是獨立 PR 決定。
4. push origin/dev 時機 —— 你決定哪個 commit 後 push，CI 4 build job 才會跑。
