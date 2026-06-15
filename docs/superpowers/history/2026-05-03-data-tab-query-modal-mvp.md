# Plan: 統一查詢入口 — 「+」改開 ModalQueryBuilder（v3）

## Context

使用者要把所有 SQL 查詢入口統一到 tab strip 的「+」按鈕（保留位置與 muscle memory），但**改變其行為**：

- **舊行為**：點「+」→ 呼叫 `addQueryTab()` → `newTab({type:'query'})` → 開新 Query tab
- **新行為**：點「+」→ 開 `<ModalQueryBuilder>` → 在 modal 內選表、選欄位、產 SQL、執行
- **Icon / title 也換**：`mdiPlus` → `mdiDatabaseSearch`，title 改 `database.queryBuilder`

新 modal 提供 **單表查詢 + 直接語法** 兩個 mode（MVP），未來擴展 JOIN / 聚合 / 子查詢。SQL 執行底層邏輯（rawQuery IPC、Ace editor、結果表格、autocommit / commit / rollback）從舊 Query tab 抽成 composable `useQueryExecution`，讓 modal 重用，舊 Query tab 元件先保留（為內部 caller 像「執行 procedure」做 transition），Phase 2 一次刪。

**Data tab toolbar 不加任何新按鈕** — single 入口設計，使用者永遠只從「+」進入查詢，Modal 內「查詢表」dropdown 處理 single / multi 切換。

**參考 UI**（使用者貼的截圖、來自 Admin.NET）：modal 上方一排 mode tab（單表查詢 / JOIN 關聯 / 聚合統計 / JOIN+統計 / 子查詢 / 直接語法），中段是 builder 表單（查詢表 dropdown + 欄位 checkbox + 條件 + 排序 + 筆數），底部「產生 SQL」按鈕。

**MVP 關鍵決策**（已透過 AskUserQuestion 跟使用者確認）：

| 決策 | 答案 |
|------|------|
| 「產生 SQL」後流程 | 不立刻 execute — 產生 SQL 字串塞進 raw textarea 給使用者審；按「執行」才走 IPC |
| Mode 範圍 | MVP 只做 2 個：**單表查詢** + **直接語法**；JOIN/聚合/子查詢延後 |
| 與舊 Query tab 關係 | **遷移整合** — 「+」入口移除、SQL 執行邏輯搬進 modal、新 modal 是唯一 entry |
| DB client 優先 | **SQL Server (mssql)** 先；其他 4 個 client 延後 |
| 直接語法 mode 行為 | 像 SSMS — SELECT 跑完結果顯示在 modal 下方表格；INSERT/UPDATE/DELETE 走既有 2 階段 commit（autocommit off → 開 transaction → 使用者按 commit/rollback） |

---

## UI Surface

### 1. Tab strip「+」按鈕改 behavior

**檔案**：[src/renderer/components/Workspace.vue](src/renderer/components/Workspace.vue)（line 467-475）

現有：
```vue
<a class="tab-add" :title="t('application.openNewTab')" @click="addQueryTab">
  <BaseIcon icon-name="mdiPlus" :size="24" />
</a>
```

改為：
```vue
<a class="tab-add" :title="t('database.queryBuilder')" @click="showQueryBuilderModal">
  <BaseIcon icon-name="mdiDatabaseSearch" :size="24" />
</a>
```

新增 i18n key `database.queryBuilder` = "SQL 查詢" (zh-TW) / "SQL Query" (en-US) / 其他三個 locale 同步。

`addQueryTab` 函式 ([Workspace.vue:777-779](src/renderer/components/Workspace.vue#L777)) 移除（連同 [line 798](src/renderer/components/Workspace.vue#L798) 「open file」流程的 `newTab({type:'query'})` 一併用 modal 取代或暫保留為 Phase 2）。

[WorkspaceEmptyState.vue:7](src/renderer/components/WorkspaceEmptyState.vue#L7) 的「Open new tab」按鈕也改為觸發 `showQueryBuilderModal()`（透過 emit 上傳 + Workspace.vue handler），讓空狀態的「Open」按鈕也走同一個 modal。

### 2. Modal：`ModalQueryBuilder.vue`（新檔）

**結構**：
```
DialogContent (max-w-[1100px] h-[80vh])
├─ DialogHeader: 標題「SQL 查詢」+ 當前 connection/database 上下文
├─ Tabs (mode 切換)
│   ├─ TabsList: 單表查詢 / 直接語法 (MVP only — 其他 4 個 mode 留 disabled+tooltip "MVP 後續")
│   ├─ TabsContent value="single":
│   │   └─ <QueryBuilderSingleTable> — 表單 builder
│   └─ TabsContent value="raw":
│       └─ <QueryEditor> — 直接重用既有 Ace editor
├─ 「產生 SQL」按鈕 (只在 single mode 顯示) → 把 SQL 字串塞進 raw mode textarea + 切到 raw tab
├─ 「執行」按鈕 + autocommit toggle + commit/rollback (僅當 autocommit=false 時顯示)
└─ 結果區: <WorkspaceTabQueryTable> (重用 + 唯讀 mode) — 在 dialog 下半部
```

### 3. `<QueryBuilderSingleTable>`（新元件）

對應截圖的 form 結構：

| 欄位 | UI 元件 | Default |
|------|---------|---------|
| 查詢表 | `<BaseSelect>` 撈 schema 所有 tables (workspaces store) | 預填當前 data tab 的 table |
| 欄位 | 全選 Checkbox + 每個欄位 Checkbox（grid layout） | 全選 |
| 條件 | 多筆 row：`<BaseSelect>` 欄位 + 操作子 + 值；BETWEEN 顯示兩個輸入；可重複 | 空 |
| 排序 | 多筆 row：`<BaseSelect>` 欄位 + ASC/DESC | 空 |
| 筆數 | `<Input type="number">` + - / + button | 100 |

「產生 SQL」按鈕呼叫純 TS 函式 `buildSingleTableSql({client, table, fields, where, orderBy, limit})` 回傳 string。

---

## SQL Server Dialect

`buildSingleTableSql()` 在 SQL Server mode 要遵守：

- **Bracket quoting**: column / table 用 `[ident]`，內部 `]` escape 成 `]]`（重用 [SQLServerClient._bid](src/main/libs/clients/SQLServerClient.ts#L73)，但 builder 在 renderer 側 — 寫一個 `quoteMssqlIdent(name)` helper 在 `src/common/utils/`）
- **Schema prefix**: `[dbo].[table_name]`（從當前 data tab 的 schema 抓）
- **Paging**: 不用 `LIMIT n`，用 `TOP (n)` — `SELECT TOP (100) ... FROM ...`（簡單版，不需要 OFFSET-FETCH 因 MVP 沒 paging UI）
- **WHERE 操作子**: `=`, `<>`, `<`, `<=`, `>`, `>=`, `LIKE`, `NOT LIKE`, `IN`, `NOT IN`, `IS NULL`, `IS NOT NULL`, `BETWEEN`
- **ORDER BY**: 直接 `ORDER BY [col] ASC|DESC`，多欄逗號

範例輸出：
```sql
SELECT TOP (100) [id], [allowance_id], [allowance_date], [confirm_type]
FROM [dbo].[allowance_confirmations]
WHERE [receive_date] BETWEEN '2026-01-01' AND '2026-12-31'
ORDER BY [id] ASC;
```

---

## Data Flow

### 直接語法 mode

1. 使用者在 raw textarea 輸入 SQL
2. 按「執行」→ 走 `Schema.rawQuery({uid, query, schema, tabUid: modal_uid, autocommit: store.autocommit})`
3. Backend 走既有路徑（[Schema route](src/main/routes/schema.ts) → `SQLServerClient.raw()` → 若 `autocommit=false` 開 `mssql.Transaction`）
4. SELECT → response 含 results array → 塞進 modal 下方 `<WorkspaceTabQueryTable>`
5. 非 SELECT → response 含 affectedRows → 顯示在 status bar，commit/rollback 按鈕變 active

### 單表查詢 mode

1. 使用者填 form
2. 按「產生 SQL」→ `buildSingleTableSql()` 回 string → 自動切到 raw tab + 塞進 textarea（讓使用者可以審/微調）
3. 使用者按「執行」→ 走「直接語法 mode」相同路徑

---

## Files to Modify / Create

| Path | Type | Change |
|------|------|--------|
| [src/renderer/components/Workspace.vue](src/renderer/components/Workspace.vue) | Modify | 改 `<a class="tab-add">` 的 icon (`mdiPlus` → `mdiDatabaseSearch`)、title (`application.openNewTab` → `database.queryBuilder`)、@click (`addQueryTab` → `showQueryBuilderModal`) + 加 modal mount + 改 `<WorkspaceEmptyState @new-tab>` handler |
| [src/renderer/components/WorkspaceEmptyState.vue](src/renderer/components/WorkspaceEmptyState.vue) | Modify | 「Open new tab」按鈕的 emit 名稱不動，由 Workspace.vue 改 handler 觸發 modal（這個檔可能完全不用動，等 Workspace.vue 那邊接到 emit 即可） |
| `src/renderer/components/ModalQueryBuilder.vue` | **New** | Dialog shell + Tabs + 完整執行流程 |
| `src/renderer/components/QueryBuilderSingleTable.vue` | **New** | 單表 mode 表單 |
| `src/renderer/composables/useQueryExecution.ts` | **New** | 從 [WorkspaceTabQuery.vue:441-490](src/renderer/components/WorkspaceTabQuery.vue#L441) 抽出 `runQuery` / `commitTab` / `rollbackTab` 邏輯成 composable，給 modal 重用（舊 Query tab 也 refactor 成用同 composable，避免邏輯複製）|
| `src/common/libs/sqlBuilder/mssql.ts` | **New** | `buildSingleTableSql({client:'mssql', ...})` + `quoteMssqlIdent()` |
| `src/common/libs/sqlBuilder/index.ts` | **New** | dispatcher：`buildSingleTableSql({client, ...})` 依 client 路由（MVP 只有 mssql；其他 throw `NotImplementedError`）|
| `src/renderer/i18n/en-US.json` | Modify | 加 `database.queryBuilder`, `database.singleTable`, `database.directSql`, `database.generateSql`, `database.allFields`, `database.addCondition`, `database.addOrderBy`, `database.limit`, `database.queryTable`（約 9 keys）|
| `src/renderer/i18n/zh-TW.json` / `zh-CN.json` / `ja-JP.json` / `ko-KR.json` | Modify | 同步以上 9 keys |

### Query tab Deprecation Strategy

**MVP 不刪 [WorkspaceTabQuery.vue](src/renderer/components/WorkspaceTabQuery.vue)**：避免一次砍太大、破壞 ~12 處內部 caller。

但移除其主要 entry：
- `Workspace.vue` 的 `addQueryTab()` 移除（「+」改開 modal）→ 使用者無法再「主動」開新 Query tab
- 既有已開的 Query tab 仍可 render（迴避破壞）
- 其他內部 caller（[WorkspaceTabPropsFunction.vue:386](src/renderer/components/WorkspaceTabPropsFunction.vue#L386)、[WorkspaceTabPropsRoutine.vue:366](src/renderer/components/WorkspaceTabPropsRoutine.vue#L366)、[WorkspaceExploreBarTableContext.vue](src/renderer/components/WorkspaceExploreBarTableContext.vue)、[WorkspaceExploreBarMiscContext.vue](src/renderer/components/WorkspaceExploreBarMiscContext.vue)、[TheScratchpad.vue:316](src/renderer/components/TheScratchpad.vue#L316)、[WorkspaceTabNew*.vue](src/renderer/components/) 系列「執行 procedure / function / DDL」按鈕）— **MVP 暫不動**，這些 caller 仍呼叫 `newTab({type:'query'})` 開暫用 Query tab
- Phase 2：`useQueryExecution` composable 穩定後，把這 ~12 處 caller 改成 `showQueryBuilderModal({sql, autorun})` 預塞 SQL；Query tab 元件最終刪除

**約 8 新檔/composable + 6 修改檔**。預估 ~600 行新程式碼。

---

## Reused Existing Utilities

不重複造輪子：

- [`Schema.rawQuery()`](src/renderer/ipc-api/Schema.ts#L102) — SQL execution IPC
- [`QueryEditor.vue`](src/renderer/components/QueryEditor.vue) — Ace SQL editor，直接放 raw mode tab
- [`WorkspaceTabQueryTable.vue`](src/renderer/components/WorkspaceTabQueryTable.vue) — 結果表格（pass `mode="query"` 唯讀）
- [`Schema.commitTab()` / `rollbackTab()`](src/renderer/ipc-api/Schema.ts) — 2 階段 commit（modal 用同一個 tabUid 呼叫）
- shadcn-vue 22 個 primitive（Dialog / Tabs / Button / Checkbox / Input / Label / Select / ScrollArea）— 不需要新元件
- `applicationStore.tabs` 取目前 connection / schema 上下文
- `workspacesStore` 取目前 schema 的 tables list（給「查詢表」dropdown）

---

## Verification

1. **Type-check**: `pnpm type-check` 維持 12 baseline error，不應新增
2. **Lint**: `pnpm lint` pass
3. **Smoke test**:
   - SQL Server connection → 開任一 table → toolbar 出現「SQL 查詢」按鈕
   - 點按鈕 → modal 出現
   - **單表查詢 mode**：選欄位 / 條件 / 排序 / 筆數 → 按「產生 SQL」→ 自動切到 raw tab、textarea 內容是合法 T-SQL（含 `TOP (n)`、`[dbo].[table]` quoting）
   - **直接語法 mode**：輸入 SELECT 語法 → 按「執行」→ 結果在下方表格顯示
   - 輸入 INSERT / UPDATE / DELETE + autocommit off → 按「執行」→ 看到「N rows affected」，commit/rollback 按鈕亮起；按 commit 後 backend 真正 apply、按 rollback 後不 apply（用 SSMS 並行驗證）
4. **No-regression**：
   - 既有 Query tab 完全不動，仍可用「+」開新 Query tab
   - data tab 「新增單筆資料」按鈕還在原位且功能正常
5. **i18n**：5 個 locale 都有對應翻譯 — `pnpm translation:check zh-TW` / `zh-CN` / `ja-JP` / `ko-KR` 不報缺漏

---

## Out of Scope (Phase 2+)

明確不做的：

- 其他 4 個可視化 mode：JOIN 關聯 / 聚合統計 / JOIN+統計 / 子查詢（mode tab 顯示但 disabled + tooltip「MVP 後續」）
- 其他 4 個 DB client（MySQL / PostgreSQL / SQLite / Firebird）— builder dispatcher 預留 abstraction 但 throw "Not implemented"
- Paging / 分頁 UI（用 TOP n，n=筆數即可，無需 OFFSET）
- SQL syntax highlight 在「產生 SQL」preview 階段（Ace 編輯器本身已有 highlight）
- Query history / saved queries
- Schema autocomplete in raw mode（既有 `QueryEditor` 已內建，沿用即可）
- modal 內 result table 的編輯功能（pass mode="query" 唯讀；想改用 cell editing → 走 data tab 既有路徑）
- **Query tab 的最終刪除**：MVP 只移除 `addQueryTab` 入口、把核心邏輯抽成 composable。Query tab 元件本身留著，讓既有 caller（function / routine 執行）暫時還能開。Phase 2 把 Query tab 重構成 modal 形式 + 移除元件。
- 從 explore bar context menu / scratchpad 等次要入口的 `newTab({type:'query'})` 呼叫（[WorkspaceExploreBarMiscContext.vue](src/renderer/components/WorkspaceExploreBarMiscContext.vue)、[TheScratchpad.vue](src/renderer/components/TheScratchpad.vue)、[WorkspaceTabNewTable.vue](src/renderer/components/WorkspaceTabNewTable.vue) 等 ~12 處）— Phase 2 一次清理

---

## Risks / Notes

- **`buildSingleTableSql` 的 SQL 注入面**：使用者輸入的「值」會被 quote 成字串文字，若使用者打 `'; DROP TABLE x; --` 會 escape 成 `'''; DROP TABLE x; --'` — 用 `mssql` driver 的 parameterized query 會更安全。MVP 暫用字串拼接（簡單），但要在 helper 註明 TODO：之後改 named-param style（`@p0`, `@p1` ...）by passing `params` array to `Schema.rawQuery()`。
- **「執行」前 SQL preview**：使用者按「產生 SQL」→ 在 raw tab 看 SQL → 再按「執行」。這是兩階段，跟 user 的「輔助整合不是重疊」一致 — modal 不會偷偷直接 execute。
- **Schema context 跨 tab 一致性**：modal 從哪個 data tab 開的就用那個 schema / connection context。store 用 `applicationStore.tabs` 找 active tab uid，傳進 modal 當 prop。
