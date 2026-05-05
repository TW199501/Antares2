# 前端單元測試留尾收尾計畫 v2 (PR1 / PR2 / PR3) — post-audit

## Context

前 plan (`docs/superpowers/plans/2026-05-03-frontend-unit-test-rollout-v2-remaining.md`) 跑完 T0–T17 後留下 4 件「v2 決定點」：9 個 hand-crafted IPC fixture 未驗、4 個 type-check baseline error、3 個 quirk-locked source bug、2 個 zone target ⚠ 沒打到。User 不接受 5–10% drift 風險，要求重新切分成 PR1 / PR2 / PR3 後才動 .NET 遷移。

本 plan **v1 經審計員 (feature-dev:code-reviewer) 查出 15 個漏洞**，原本 38/100；本 v2 修了其中 14 個（#13 plan 檔位置另以「Plan 搬遷」段落處理）。完整修正記錄見尾段表格。

---

## Plan 搬遷（ExitPlanMode 通過後第一件事）

```powershell
Copy-Item C:\Users\EDDIE\.claude\plans\80-18-1-pet-1-pet-2-curious-wren.md `
          e:\source\antares2\docs\superpowers\plans\2026-05-06-pr1-pr2-pr3-cleanup.md
Remove-Item C:\Users\EDDIE\.claude\plans\80-18-1-pet-1-pet-2-curious-wren.md
```

之後 user 決定要不要 git add + commit 把 plan 進 repo。

---

## 已落地（plan-mode 啟動前完成、合進 PR1 step 1.0）

- [scripts/capture-contract-fixtures.mjs](scripts/capture-contract-fixtures.mjs) `INVOCATIONS` 從 7 → 9 條（加 `tables.getTableColumns` + `tables.getTableData`）—— **但有 3 處資料不一致，PR1 step 1.0 修**
- [tests/fixtures/contract/README.md](tests/fixtures/contract/README.md) Coverage 表 9 條對應 —— **「pending PR3.B」字串待改成「pending PR1」**
- `pnpm lint` 綠

---

## PR1 — drift 消除

### Step 1.0 — 修 capture script 3 處資料不一致（我做，ExitPlanMode 後第一件事）

不修這 3 處，user 跑 capture 後 wrapper test (`Connection.test.ts` / `Schema.test.ts`) 會直接爆紅、且部分 fixture 會喪失原本驗證能力。

| Sub-step | 檔案 | 改動 |
|---|---|---|
| **1.0.A** connect payload 缺 6 欄 | `scripts/capture-contract-fixtures.mjs` L117–130 | `payloadFor` 補回 `ask: false / readonly: true / singleConnectionMode: false / ssl: false / untrustedConnection: true / ssh: false`（從 hand-crafted fixture 複製） |
| **1.0.B** rawQuery SQL 太弱 | `scripts/capture-contract-fixtures.mjs` L170–176 | SQL 改成 `SELECT id, name, created_at FROM [dbo].[users] ORDER BY id`（跟 hand-crafted 對齊；mssql 用 brackets）|
| **1.0.C** mssql getStructure schemas 錯 | `scripts/capture-contract-fixtures.mjs` L147–150 | mssql 特例：`schemas: [cfg.schema]`（即 `'dbo'`）。其他 dialect 維持 `cfg.database \|\| cfg.schema` |
| **1.0.D** README pending 字串 | `tests/fixtures/contract/README.md` L132–144 | 把 9 行表格的「pending PR3.B」全改成「pending PR1」 |

驗收 step 1.0：`pnpm lint` 綠、本地 `node scripts/capture-contract-fixtures.mjs` 可起 sidecar（不採集，只確認 spawn ready）。

---

### Step 1.1–1.7 — user 端準備 + 採集

| Step | 誰 | 內容 |
|---|---|---|
| 1.1 | user | mssql 建 `antares_test_fixture` DB + 跑 [README seed SQL](tests/fixtures/contract/README.md)（含 `users` 5 列 / `orders` 4 列 / `user_orders` view / `[My Table]`）|
| 1.2 | user | 建 fixture-only SQL user（**only `antares_test_fixture` 讀寫**，**不能** sa）|
| 1.3 | user | PowerShell 設 `DEV_MSSQL_HOST / PORT / USER / PASSWORD / DATABASE`（**`DATABASE = antares_test_fixture`** 必設）|
| 1.4 | user | 備份到 **repo 外**：`Copy-Item -Recurse tests/fixtures/contract ../contract-handcrafted-baseline`（避免 `git add -A` 誤加）|
| 1.5 | user | `pnpm capture:contract -- mssql` |
| 1.6 | user | anonymization grep（**包含 hostname**）：</br>```Select-String -Path tests/fixtures/contract/*.json -Pattern "<你的 mssql 真實 host>"```</br>```Select-String -Path tests/fixtures/contract/*.json -Pattern "password" \| Where-Object { $_ -notmatch "REDACTED" }```</br>```Select-String -Path tests/fixtures/contract/connection.connect.mssql.happy.json -Pattern "host"``` 確認顯示 `127.0.0.1` |
| 1.7 | user | 把 `git diff --stat tests/fixtures/contract/` 結果貼給我 |

---

### Step 1.8–1.10 — 我看 diff、修 wrapper test 對齊

讀每個 fixture 的 `git diff`、判斷對應 `web/renderer/ipc-api/*.test.ts` 是否需要更新。

**已知必中**（審計員預判）：
- `Connection.test.ts` connect payload `calledWith` assertion（除非 1.0.A 已補 6 欄、capture 出來跟 hand-crafted 對齊）
- `Schema.test.ts` rawQuery（除非 1.0.B 已對齊 SQL）

**動作**：
- 修 wrapper test 對齊真 fixture
- 如發現 wrapper 邏輯真有 bug 一併修
- 跑 `pnpm test:unit:run` 全綠
- 跑 `pnpm lint` 綠

---

### Step 1.11 — user 驗收 + push

```powershell
# 驗收 1：confirm metadata.source 全部不再是 hand-crafted
Select-String -Path tests/fixtures/contract/*.json -Pattern "hand-crafted-from-wrapper-and-route-source"
# 預期：0 matches

# 驗收 2：刪備份
Remove-Item -Recurse ../contract-handcrafted-baseline

# Commit + push (user 主動 push)
git add scripts/capture-contract-fixtures.mjs tests/fixtures/contract/ web/renderer/ipc-api/
git commit -m "feat(test): T18 — 9 IPC contract fixtures real-captured against mssql"
git push origin dev
```

### PR1 驗收

- 9 個 fixture 全部 `metadata.source` 不含 `hand-crafted-from-wrapper-and-route-source` (grep 0 matches)
- ipc-api zone ≥ 90/75（plan v1 spec target）
- `pnpm test:unit:run` 全綠
- `pnpm lint` 綠
- `pnpm test:coverage:check` hard gate ≥ 60/60 維持

---

## PR2 — type-check baseline 清零

### Step 2.0 — 動手前先看 actual error（**不預設修法**）

```powershell
pnpm type-check 2>&1 | Tee-Object -FilePath type-check-snapshot.txt
```

讀 4 個 error 的完整 expected/received 訊息再決定修法路徑。**plan v1 預設的 error 描述跟實際介面 (`TableIndex.fields` 已有、`TableOptions = Partial<TableInfos>`) 不對齊，照描述修會走錯路。**

### Step 2.1 — 判斷修法路徑

讀 [WorkspaceTabPropsTable.vue](web/renderer/components/WorkspaceTabPropsTable.vue) line 172/174/182/186 上下文 + props-table refactor 三個 commit (`6024be5` / `8400a26` / `5c052c7`)。

每個 error 評估三種可能：
- **A**：component props 型別宣告錯（改 component 內部）
- **B**：saveChanges / 呼叫端組裝邏輯錯（改 emit payload）
- **C**：[common/interfaces/antares.ts](web/common/interfaces/antares.ts) 介面要動

### Step 2.2 — 並行決策

| step 2.1 結論 | PR1‖PR2 是否可並行 |
|---|---|
| 全部 A 或 B（不動 common/interfaces） | ✅ 並行 OK |
| **任何一個 C（動 common/interfaces）** | ❌ PR2 必須先 commit + push，再開 PR1 step 1.8–1.10（避免 wrapper test 對 cast 過的型別產生衝突）|

### Step 2.3 — 修 + 驗

- 修對應檔
- `pnpm type-check` **0 errors**
- `pnpm test:unit:run` 全綠
- `pnpm lint` 綠
- **user 用 `pnpm vite:dev` 開 props 頁面手測 5 分鐘**（我不代測 — Tauri shell 才能完整手測 + 我的 vite-only 環境覆蓋不夠）

### Step 2.4 — 我 commit / user push

```powershell
git add web/renderer/components/WorkspaceTabPropsTable.vue [+ 其他改動的檔]
git commit -m "fix(types): clear 4 type-check baseline errors in WorkspaceTabPropsTable"
# user push
git push origin dev
```

### PR2 驗收

- `pnpm type-check` 0 errors
- 既有 unit test + lint 全綠
- props 頁面視覺手測過（user 確認）

---

## PR3 — source bug 修 + common-and-libs zone 推到目標

### Part A — 3 個 quirk-locked source bug 升級為 fix

**先決條件（每個 bug）**：先寫「正確行為 spec」才動 source。spec 不確定就**保留 quirk 不修**、不要瞎猜。

| # | Bug | spec 必須回答 |
|---|---|---|
| A.1 | `sqlEscaper` 控制字元 (`\0` / `\b` / `\t` / `\n` / `\r` / `\x1A`) | 跨 5 個 client (mysql/pg/sqlite/firebird/mssql) 的跳脫規則一致嗎？參考 mysql2 / mssql / pg-driver 各自的 escape 行為 |
| A.2 | `querySplitter` dollar-tag corruption | PostgreSQL dollar-quoted string 規範：`$tag$...$tag$` 內可包含分號 / 換行，splitter 不應切到中間 |
| A.3 | `useResultTables` module-top Pinia call | 修法：`useStore()` 挪進 setup function 內。**動完立即**：`pnpm test:coverage:check` 確認 composables zone 仍 ≥ 85/70（不要等 Part B 一起跑）|

每個 bug 動作：reproducer → spec → 修源 → quirk-test 升級為 correct-behavior assertion → commit `fix(common): ...` 或 `fix(composable): ...`。

### Part B — common-and-libs zone 91.4/83.8 → ≥ 95/90

#### B.1 — 動手前先看 lcov 預判缺口

```powershell
pnpm test:coverage  # 重跑（PR3 Part A 改完之後）
start coverage/index.html
# 找 web/common/ + web/renderer/libs/ + web/renderer/lib/ 哪些檔 branch < 90
```

#### B.2 — 評估工時

如果缺口集中在難測檔（[ClientsFactory.ts](web/main/libs/ClientsFactory.ts) 要 mock 5 個 client、[persistStore.ts](web/renderer/libs/persistStore.ts) 要 mock Tauri FS），預估超 3h → **拆獨立 PR4 候選、本 PR3 只交 Part A**。

#### B.3 — 補 edge case test

focus 在 **branch coverage**（差距 6.2pp）。不要為了 line 拉高而寫無意義 happy-path test。

### Step 3.4 — 我 commit / user push

```powershell
git add [Part A 改動的 source + test]
git commit -m "fix(common): sqlEscaper / querySplitter / useResultTables — quirks identified during T8 lock-and-go"

# 如果 Part B 留在本 PR3:
git add [Part B 補的 test]
git commit -m "test(common): boost common-and-libs zone branch coverage to >= 90"

# user push
git push origin dev
```

### PR3 驗收

- 3 個 source bug 修掉、quirk-test 全升級為 correct-behavior
- composables zone ≥ 85/70 **維持**（A.3 動完即驗）
- common-and-libs zone ≥ 95/90（**或** B.2 結論改 PR4，本 PR3 只交 Part A）
- Hard gate ≥ 60/60 維持
- 全 unit test + lint 綠

---

## 順序

```
PR2 step 2.0–2.1 (5 min, type-check + 看 actual error)
   ↓
   並行決策（step 2.2）
   ├─ 動 common/interfaces → PR2 全做完 → PR1 → PR3
   └─ 不動 common/interfaces → PR1 ‖ PR2 → PR3
```

PR3 永遠排在 PR1 後面（避免 PR1 改 ipc-api wrapper test 跟 PR3 Part B 補 common test 同檔衝突）。

---

## 不在範圍

- **`components` zone**（7.1/4.4 → 40/25）：194 個 .vue、工程量週級、plan v1 設計靠 Playwright e2e。要做就獨立 PR4 候選。
- **mysql / pg / sqlite 真採集**：等 .NET 動工跟新 sidecar 一起做。
- **error scenario / WS frame fixture**：不在 plan v2 PR3.B 範圍。
- **任何對 user 內網設備的 probe / port scan / 試認證**：memory rule，永遠不在範圍。

---

## 全部完成驗收

- 9 個 fixture all real-captured（PR1：grep `hand-crafted-from-wrapper` 0 matches）
- `pnpm type-check` 0 errors（PR2）
- 3 個 source bug 修掉、quirk-test 全升級（PR3 Part A）
- composables zone ≥ 85/70 維持（PR3 A.3 動完即驗）
- common-and-libs zone ≥ 95/90 **或** 拆 PR4 候選（PR3 Part B）
- Hard gate ≥ 60/60 維持
- 全 unit test + lint 綠
- ≥ 4 commits pushed（user 主動 push）

完成後可動 [docs/superpowers/plans/2026-05-03-net-sqlsugar-execution-plan.md](docs/superpowers/plans/2026-05-03-net-sqlsugar-execution-plan.md) Phase 0（.NET 10 遷移）。

---

## 預估時間

| Phase | 我 | User | 合計 | 備註 |
|---|---|---|---|---|
| PR1 step 1.0 | 30 min | — | 30 min | 修 script 3 處 + README |
| PR1 step 1.1–1.7 | — | 30–60 min | 30–60 min | DB schema + capture + grep + 貼 diff |
| PR1 step 1.8–1.10 | 2–4h | — | 2–4h | 看 diff + 修 wrapper test（Connection / Schema 預期必中）|
| PR1 step 1.11 | 5 min | 5 min | 10 min | commit + push |
| PR2 | 1–2h | 10 min（手測）| 1–2h+ | 視 step 2.1 結論 |
| PR3 Part A | 2–3h | 5 min | 2–3h | 3 bug + spec + test 升級 |
| PR3 Part B | 1–3h（或 PR4）| 5 min | 1–3h | 視 lcov 缺口分布 |
| **合計** | **6–13h** | **1–2h** | **7–15h** | 上限視 audit 後續發現 |

---

## 審計修正記錄（v1 → v2）

審計員 (`feature-dev:code-reviewer`) 給 v1 評分 **38/100**，找到 15 個漏洞，本 v2 修 14 個：

| # | 漏洞（v1） | v2 修法 |
|---|---|---|
| 1 | `connection.connect` capture payload 缺 6 欄 (`ask/readonly/singleConnectionMode/ssl/untrustedConnection/ssh`)，wrapper test 必爆紅 | PR1 step 1.0.A 補回 |
| 2 | rawQuery SQL `SELECT 1` 太弱、跟 hand-crafted `SELECT id,name,created_at FROM users` 不一致，喪失欄位驗證能力 | PR1 step 1.0.B 對齊 |
| 3 | mssql getStructure 用 `cfg.database \|\| cfg.schema`，會送 `antares_test_fixture` 而非 `dbo`，sidecar 回空結果 | PR1 step 1.0.C 改 mssql 特例 `cfg.schema` |
| 4 | anonymize 不掃 hostname（非 RFC1918 區段） | PR1 step 1.6 user 端 grep 加 hostname check |
| 5 | 驗收條件 `git diff --stat` 不準（無 diff 不代表無採集）| 改用 `Select-String hand-crafted-from-wrapper` 0 matches |
| 6 | backup 在 repo 內可能被 `git add -A` 誤加 | step 1.4 改放 `../contract-handcrafted-baseline` |
| 7 | type-check error 描述「`TableIndex` 缺 fields」跟實際介面對不上 | PR2 step 2.0 動手前先看 actual error，plan 不預設描述 |
| 8 | 同 7（`TableOptions` 是 `Partial<TableInfos>`，name 非必填）| 同上 |
| 9 | PR1‖PR2 並行隱患：PR2 改 common/interfaces 時 PR1 wrapper test 衝突 | PR2 step 2.2 加並行決策分支 |
| 10 | 3 個 source bug 缺「正確行為 spec」 | PR3 Part A 每個 bug 先寫 spec，spec 不確定就保留 quirk |
| 11 | useResultTables 修法可能讓 composables zone regression | A.3 動完立即跑 coverage:check 驗 ≥ 85/70 |
| 12 | common-and-libs 缺口未預判，2-3h 工時可能低估 | Part B step B.1 先看 lcov，B.2 評估、必要時拆 PR4 |
| 13 | Plan 檔位置違反 `docs/superpowers/plans/` memory rule | 「Plan 搬遷」段落，ExitPlanMode 第一件事處理 |
| 14 | PR2/PR3 push 控制權沒明確還給 user | 每個 PR step 4 / 1.11 明確「user 自己 push」 |
| 15 | README「pending PR3.B」跟 plan PR1 編號對不上 | PR1 step 1.0.D 改 README |

修正後預估評分 **75–85/100**（仍有 user 規則符合度上的主觀風險，需 user approve 才知道）。
