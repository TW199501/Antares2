# antares2 .NET Sidecar Migration — Design Spec

> **狀態**: locked design (2026-05-05) — 取代 v4 execution plan 的 design 部分
> **配套 plan**: [`2026-05-05-net-sidecar-migration.md`](../plans/2026-05-05-net-sidecar-migration.md)
> **取代**: `2026-05-03-net-sqlsugar-migration.md`（v1 roadmap）+ `2026-05-03-net-sqlsugar-execution-plan.md`（v4 execution plan）— 兩份保留為歷史紀錄、不再執行
> **盤點 baseline**: `2026-05-03-backend-inventory.md` — 仍為當前 Node sidecar 的權威 inventory

---

## 1. Goal

把 antares2 的 sidecar 從 **Node.js / Fastify (TypeScript)** 切換成 **.NET 10 LTS / Furion 4.9.8 / SqlSugar 5.1.4** self-contained binary，達成：

1. **Renderer 0 修改** — `web/renderer/`、`web/common/` 完全不動（除 unrelated feature commit）
2. **Tauri Rust shell 1 行修改** — `src-tauri/src/sidecar.rs` 只改 spawn 的 binary 路徑
3. **IPC contract byte-equivalent** — 既有 wrapper test (`web/renderer/ipc-api/*.test.ts`) 跟 fixture replay 全部通過
4. **Firebird 退場** — 4 DB 支援：MySQL 8 / PostgreSQL 16 / SQL Server 2022 / SQLite
5. **Bundle 體積降低 30%+** — Node 200MB hoisted deps → .NET self-contained 100-110MB（trim 後）
6. **DDL 一致性提升** — 4 個 client 各自實作的 DDL 收斂進 SqlSugar `DbMaintenance` + per-DB raw SQL fallback
7. **「一次成功」可驗** — 每個 phase 結束有可機械驗證的 hard gate（`pnpm replay:contract -- --filter=X` exit 0），失敗就 `git reset --hard <prev-tag>`

---

## 2. Locked decisions

> 這節已經吸收上一輪 5 個 reviewer 的審計修正。**不再討論**這些決策。

### 2.1 技術棧（reviewer-verified）

| 項目 | 選擇 | 來源驗證 |
|------|------|---------|
| Runtime | .NET 10 LTS（2025-11-11 GA、2028-11 EOL） | dotnet/core release notes |
| Web framework | **Furion 4.9.8.57** ⚠️ **不是 v10** — v4 plan 把 .NET 10 跟 Furion 版本搞混 | NuGet `Furion` |
| ORM | SqlSugar 5.1.4.207 / SqlSugarCore 5.1.4.214 | NuGet `SqlSugarCore` |
| MySQL driver | MySqlConnector（caching_sha2_password 原生支援，MySQL 8 預設 auth） | NuGet `MySqlConnector` |
| PostgreSQL driver | Npgsql（`SslMode` 是 enum、命名跟 Node `pg` 不同，要 mapping） | NuGet `Npgsql` |
| SQL Server driver | Microsoft.Data.SqlClient | NuGet `Microsoft.Data.SqlClient` |
| SQLite driver | Microsoft.Data.Sqlite（managed wrapper、跟 better-sqlite3 sync C++ 比可能慢一點，profile 後再決定要不要 raw P/Invoke） | NuGet `Microsoft.Data.Sqlite` |
| SSH | SSH.NET 2025.1.0（cipher: aes256-ctr / aes-gcm / chacha20-poly1305 / curve25519-sha256 confirmed） | NuGet `SSH.NET` |
| Faker | Bogus 35.6.5（`@faker-js/faker` 取代品） | NuGet `Bogus` |
| WebSocket | **Raw ASP.NET Core `WebSocketMiddleware`**（**不是 SignalR**——SignalR 會破壞 renderer 0 修改保證，因 SignalR 自帶 negotiation handshake + JSON envelope） | ASP.NET Core docs |

### 2.2 SqlSugar API reality check（**v4 三個謊言**）

v4 plan 假設下列 `IDbMaintenance` 方法存在、但實際上**不存在**：

| v4 假設 API | 實況 | 這個 spec 的對策 |
|------------|------|----------------|
| `db.DbMaintenance.GetForeignKeys()` | **不存在**——是 v4 Phase 10「最高 ROI」核心 | 改用 per-DB raw SQL：`INFORMATION_SCHEMA.KEY_COLUMN_USAGE` (MySQL) / `pg_constraint + pg_attribute` (PG) / `sys.foreign_keys + sys.foreign_key_columns` (MSSQL) / `PRAGMA foreign_key_list(table)` (SQLite) |
| `db.DbMaintenance.GetCreateTableSql()` | **不存在**——是 v4 Phase 9 「getTableDdl 最大 win」 | 改用 per-DB：`SHOW CREATE TABLE` (MySQL) / `pg_get_*def()` 或自行組裝 (PG) / `OBJECT_DEFINITION()` + `sp_helpconstraint` (MSSQL) / `SELECT sql FROM sqlite_master WHERE name=?` (SQLite) |
| `db.DbMaintenance.DropDatabase()` | **不存在** | Raw `DROP DATABASE name` (MySQL/PG/MSSQL)；SQLite 沒有 DROP DATABASE 概念，要 `Connection.Close() + File.Delete(path)` |
| `db.DbMaintenance.DeleteColumn()` | API 名是 `DropColumn` | 全文用 `DropColumn` |

**仍可用** 的 SqlSugar API（reviewer 驗證過存在）：
- `GetTableInfoList(false)` / `GetColumnInfosByTableName(table)` / `GetIndexList(table)`
- `AddColumn(table, columnInfo)` / `DropColumn(table, column)` / `UpdateColumn(table, columnInfo)`
- `CreateDatabase(name)` （只有 create，沒有 drop）
- `Queryable<T>().Where(expr, parameters)` 鏈式語法
- `Ado.GetDataTable(sql, params)` 帶 `SugarParameter` parameterized query

### 2.3 戰略決策

| 項目 | 決策 | 理由 |
|------|------|------|
| Admin.NET fork 戰略 | ❌ **拒絕** | reviewer 實測 `SelectTable.cs` 真實 mod ~65%、`SysDatabaseService.cs` ~50%，比宣稱 50%/30% 高很多；且 SqlSugar 三個關鍵 API 不存在後 fork 賣點剩不到一半。改 **clean-room rewrite** |
| MCP knowledge source | ❌ **不掛** | R11 drift 風險、額外依賴；Furion / SqlSugar 直接讀官方 docs + GitHub source |
| LICENSE 處理 | NOTICE 檔（**不是** self-grant memo） | reviewer 指出 antares2 是 MIT、Admin.NET 是 PROPRIETARY；無 fork 也就不需要 grant |
| 命名 | C# namespace 用 `AntaresServer.*`、csproj 用 `AntaresServer.csproj`、binary 名 `antares-server[.exe]` | 跟既有 `sidecar/antares-server.cjs` 對齊，避免 rename 連動；rename 評估完成後再一次性換 |
| Workers | C# `BackgroundService` + `Channel<T>`，**不用** `ThreadPool` 或 `Parallel.For`（避免 deadlock） | .NET async/await 已能處理 |
| 並行 vs 切換 | **Parallel-stack period until cutover** — Node binary 跟 .NET binary 同時 buildable，Phase 16 跑 dual-stack parity proof，Phase 17 才 cutover | 一行 `git revert` 就能回滾 |
| Fixture 採集 | **Phase-by-phase user 即時 capture** — 每個 service phase 開頭 user 對 dev DB 跑 `pnpm capture:contract -- --filter=<phase-routes>`，commit 進 `tests/fixtures/contract/` 才開動該 phase | 對齊 v2 plan 的 PR3.B 哲學（fixture capture is user-driven）+ memory `feedback_no_options_when_action.md` |
| 砍 Firebird | ✅ 是 | 使用率 < 5%、SqlSugar 不原生支援、v0.9.0 release notes 公告 |
| AOT | ❌ 不做 | SqlSugar reflection-heavy；用 `PublishSingleFile=true + PublishReadyToRun=true`，**不開** `PublishTrimmed`（trim + reflection ORM 易爆） |
| 工作分支 | `dev`（`git tag net-mig-NN-green` per phase），**不開 worktree** | 對齊 memory `feedback_no_worktree_without_consent.md` |

---

## 3. Architecture

### 3.1 Process model（與既有相同）

```
Tauri (Rust)  ──spawns──>  .NET 10 self-contained binary (antares-server[.exe])
     |                              |
     |  get_sidecar_port (Tauri cmd) |  HTTP POST 127.0.0.1:<port>/api/{controller}/{action}
     |  get_sidecar_token (Tauri cmd)|  WS  127.0.0.1:<port>/ws/{export|import}?token=<token>
     |                              |
Vue renderer  <─────────────────────
(httpClient.ts / ipc-api/* / 全部 store / 全部元件 不動)
```

`src-tauri/src/sidecar.rs` 只改 spawn 的可執行檔路徑（[`src-tauri/src/sidecar.rs:69-87`](../../src-tauri/src/sidecar.rs#L69)），其餘邏輯（`READY:<port>:<token>` stdout 解析、token 抓取、`get_sidecar_port` / `get_sidecar_token` Tauri command）完全保留。

### 3.2 Wire format（既有契約，不變）

**HTTP 包封**：

```ts
// 成功
{ "status": "success", "response": <T> }
// 錯誤
{ "status": "error", "response": "<message string>" }
```

⚠️ **錯誤 envelope 是「message string」、不是 `{ message, code }` 物件**——reviewer 抓出 v4 沒驗這點。`SidecarResultProvider.OnException` 必須回傳純 string，不能塞物件，否則 renderer 錯誤路徑會壞。

**`/health` 例外（不走 envelope）**：
```ts
// GET /health （raw，不包 envelope，不需 token）
{ "status": "ok", "port": <number> }
```
原因：Tauri Rust shell 的 `wait_for_ready` probe 直接讀這個 shape；走 envelope 會破壞 Rust 端 1-line-only 改動承諾。`HealthService` 用標準 ASP.NET Core Controller（不是 `IDynamicApiController`）跳過 `EnvelopeResultProvider`。

**Token 機制**：
- HTTP：`X-Sidecar-Token: <hex>` header（`/health` 跳過）
- WS：`?token=<hex>` query string（`OnConnectedAsync` 階段驗，**不能在** `OnReceiveAsync` 才驗——reviewer 的 R7 修補）

**Token 生成**：每次啟動 `RandomNumberGenerator.GetBytes(32)` → hex string，列印於 stdout `READY:<port>:<token>` 供 Rust 抓取。

**Port allocation**：dev = `5555` 固定；prod = `0`（OS 配 free port）後讀回實際綁定 port。

### 3.3 Repo 結構（target state）

```
antares2/
├── web/
│   ├── renderer/         # 不動
│   ├── common/           # 不動
│   └── main/             # Phase 18 才刪（dual-stack 期間並存）
├── src-tauri/            # Rust shell + sidecar.rs（一行 path 改動）
├── server/               # ✨ .NET 專案根
│   ├── AntaresServer.csproj
│   ├── Program.cs
│   ├── Startup.cs
│   ├── appsettings.json
│   ├── Configuration/
│   ├── Infrastructure/   # envelope provider / token middleware / ready hook / port allocator
│   ├── Connections/      # ConnectionService + ConnectionRegistry + SshTunnel + ConfigBuilder
│   ├── Schemas/          # SchemaService + SchemaMetadataService + DDL
│   ├── Tables/           # TableQueryService + TableSchemaService + TableDdlService + TableDataMutationService + ForeignKeyResolver
│   ├── Views/            # ViewService + MaterializedViewService
│   ├── Triggers/
│   ├── Routines/
│   ├── Functions/        # FunctionService + TriggerFunctionService（PG）
│   ├── Schedulers/
│   ├── Databases/
│   ├── Users/
│   ├── Application/      # FileService（readFile / writeFile）
│   ├── Ai/
│   ├── Workers/          # ExportTaskService + ImportTaskService + TaskRegistry + ProgressBroadcaster
│   ├── WebSockets/       # ExportHub + ImportHub
│   └── Models/           # DTOs per area
├── sidecar/              # antares-server[.exe]（取代 .cjs）
└── scripts/
    ├── build-net-sidecar.mjs   # ✨ 新增
    ├── build-sidecar.mjs       # 保留到 Phase 18 才刪
    ├── stage-resources.mjs     # 加 --target=net|node 旗標
    ├── replay-contract.mjs     # ✨ 新增（fixture replay harness）
    ├── capture-contract-fixtures.mjs  # 既有，加 --target=net 旗標
    ├── audit-renderer-untouched.mjs   # ✨ 新增
    ├── preflight-net.mjs       # ✨ 新增
    └── preflight-dbs.mjs       # ✨ 新增
```

---

## 4. Endpoint catalog（**81 個** = 78 HTTP POST + 1 GET /health + 2 WS）

> ⚠️ **v4 漏 14 個 endpoint** — 這次 spec audit reviewer 二次驗證（v4 表面漏 12，又把 views 8 個 collapse 成 1 行漏列、還少算 2 個）；這個表是 `web/main/routes/*.ts` 完整列舉的權威版本。
>
> Schema endpoint 共 21 個（不是 v1 plan 的 16）：3 DDL + 7 metadata + 3 discovery + 4 manual-commit + 4 export/import HTTP。Functions 共 6 個（含 PG 的 trigger function 2 個）。

### 4.1 phase-to-endpoint mapping

| # | Endpoint | Method | Phase | 注意事項 |
|---|----------|--------|-------|---------|
| 1 | `/health` | GET | 2 | 唯一不需要 token 的 route；**raw 回 `{ status: "ok", port }`，不走 envelope**（Rust shell 解析這個 shape，envelope 會破壞 1-line-only 改動） |
| 2-6 | `/api/connection/{test,connect,disconnect,abort,check}` | POST | 6 | SSH tunnel + SSL 檔讀取 + `singleConnectionMode` 三件套要一起設計 |
| 7 | `/api/schema/getStructure` | POST | 7 | sidebar 物件樹，回傳 db→tables→cols→keys 樹狀 |
| 8 | `/api/schema/getVersion` | POST | 7 | **v4 漏** |
| 9 | `/api/schema/rawQuery` | POST | 7 | **v4 漏** — 全 app 最常用 endpoint（Query Editor「Run」） |
| 10 | `/api/databases/getDatabases` | POST | 7 | |
| 11 | `/api/databases/getDatabaseComment` | POST | 7 | MySQL/SQLite 沒有 schema-level comment 概念 → 統一回 `{ description: "" }`（對齊 Node 慣例） |
| 12 | `/api/schema/getCollation` | POST | 8 | 單 schema collation |
| 13 | `/api/schema/getCollations` | POST | 8 | 全 collation 列表 |
| 14 | `/api/schema/getEngines` | POST | 8 | MySQL only |
| 15 | `/api/schema/getVariables` | POST | 8 | |
| 16 | `/api/schema/useSchema` | POST | 8 | **v4 漏** — MySQL `USE`、PG `SET search_path`、SQLite no-op、MSSQL `USE [...]` |
| 17 | `/api/schema/getProcesses` | POST | 8 | |
| 18 | `/api/schema/killProcess` | POST | 8 | |
| 19-21 | `/api/schema/{create,update,delete}` | POST | 9 | schema-level DDL（CREATE/DROP DATABASE）— SQLite 用 file ops 模擬 |
| 22-30 | `/api/tables/{getColumns,getData,getCount,getOptions,getIndexes,getChecks,getDdl,getKeyUsage,searchColumns}` | POST | 10 | 9 read endpoints — `getKeyUsage` 含 inbound + outbound FK |
| 31 | `/api/tables/getForeignList` | POST | 10 | **v4 漏** — FK dropdown 用 |
| 32-36 | `/api/tables/{create,alter,duplicate,truncate,drop}` | POST | 11 | 5 DDL endpoints；`alterTable` 是核心 |
| 37 | `/api/tables/updateCell` | POST | 11 | **v4 漏** — ~150 LOC per-type per-DB escape 邏輯 |
| 38 | `/api/tables/deleteRows` | POST | 11 | **v4 漏** |
| 39 | `/api/tables/insertFakeRows` | POST | 11 | **v4 漏** — 用 Bogus |
| 40 | `/api/views/getInformations` | POST | 12 | |
| 41 | `/api/views/drop` | POST | 12 | |
| 42 | `/api/views/alter` | POST | 12 | |
| 43 | `/api/views/create` | POST | 12 | |
| 44 | `/api/views/getMaterializedInformations` | POST | 12 | PG only；MySQL/MSSQL/SQLite 回空陣列 |
| 45 | `/api/views/dropMaterialized` | POST | 12 | PG only |
| 46 | `/api/views/alterMaterialized` | POST | 12 | PG only |
| 47 | `/api/views/createMaterialized` | POST | 12 | PG only |
| 48-52 | `/api/triggers/{getInformations,drop,alter,create,toggle}` | POST | 12 | toggle = enable/disable |
| 53-56 | `/api/routines/{getInformations,drop,alter,create}` | POST | 12 | stored procedures |
| 57-60 | `/api/functions/{getInformations,drop,alter,create}` | POST | 12 | scalar functions |
| 61-62 | `/api/functions/{alterTriggerFunction,createTriggerFunction}` | POST | 12 | **v4 漏** — PG only，是獨立物件類型 |
| 63-67 | `/api/schedulers/{getInformations,drop,alter,create,toggle}` | POST | 12 | MySQL events / PG pg_cron / MSSQL Agent jobs |
| 68 | `/api/users/getUsers` | POST | 12 | |
| 69 | `/api/ai/translate-column` | POST | 13 | ⚠️ **v4 寫錯**：實際是 Google Translate 不是 Anthropic API；payload `{ columnName, targetLocale }` → `{ description }` |
| 70 | `/api/app/readFile` | POST | 13 | **v4 漏** — `fs.readFileSync` 對應 |
| 71 | `/api/app/writeFile` | POST | 13 | **v4 漏** — `fs.writeFileSync` 對應 |
| 72 | `/api/schema/commitTab` | POST | 13 | **v4 漏** — manual-commit transaction COMMIT |
| 73 | `/api/schema/rollbackTab` | POST | 13 | **v4 漏** — manual-commit transaction ROLLBACK |
| 74 | `/api/schema/destroyConnectionToCommit` | POST | 13 | **v4 漏** — 釋放 manual-commit 專用連線 |
| 75 | `/api/schema/killTabQuery` | POST | 13 | **v4 漏** — tab-level cancel（per-DB 機制不同，見 §6.4） |
| 76 | `/api/schema/export` | POST | 14 | HTTP 啟動 export job（WS 收進度） |
| 77 | `/api/schema/abortExport` | POST | 14 | **v4 漏** — HTTP abort |
| 78 | `/api/schema/importSql` | POST | 15 | HTTP 啟動 import job |
| 79 | `/api/schema/abortImportSql` | POST | 15 | **v4 漏** |
| WS-1 | `/ws/export` | WS | 14 | 進度推送，token 走 query string |
| WS-2 | `/ws/import` | WS | 15 | 進度推送 + `query-error` 非致命錯誤 |

**注意**：`application/showOpenDialog` + `showSaveDialog` 是 **Tauri plugin、不走 sidecar**——v4 把這兩個跟 readFile/writeFile 搞反了。renderer 直接呼叫 Tauri command，不在這 spec 範圍。

### 4.2 BaseClient → .NET service method 對應

每個 `web/main/libs/clients/BaseClient.ts` 的 abstract method 都要有對應 .NET service action。reviewer 驗過的完整對應在 [backend-inventory.md §3](../plans/2026-05-03-backend-inventory.md) + audit gap report。新增（v4 漏的）：`raw()`, `use(schema)`, `getVersion()`, `killTabQuery(tabUid)`, `commitTab(tabUid)`, `rollbackTab(tabUid)`, `destroyConnectionToCommit(tabUid)`, `alterTriggerFunction()`, `createTriggerFunction()`, `keepAlive()`（registry 內部用）, `enableTrigger()`, `disableTrigger()`, `enableEvent()`, `disableEvent()`。

---

## 5. WebSocket protocol（**完整訊息類型**）

> ⚠️ v4 只籠統說「WS 進度推送」，沒列訊息類型；reviewer 的 backend coverage audit 全部列出來。

### 5.1 `/ws/export` — token via `?token=` query

**Client → Server**

| `type` | Payload shape |
|--------|--------------|
| `start` | `{ params: { uid, type, tables: string[], includes: { ... }, output, schema } }` |
| `abort` | `{}` |

**Server → Client**

| `type` | Payload shape | 說明 |
|--------|--------------|-----|
| `export-progress` | `{ totalItems?, currentItemIndex?, currentItem?, op? }` | 進度 tick |
| `end` | `{ cancelled: boolean }` | 完成（自然 / 已取消） |
| `cancel` | `{}` | 已收到 cancel ack |
| `error` | `string` | 致命錯誤、結束 connection |

### 5.2 `/ws/import` — token via `?token=` query

**Client → Server**

| `type` | Payload shape |
|--------|--------------|
| `start` | `{ params: { uid, type, schema, file: string } }` |
| `abort` | `{}` |

**Server → Client**

| `type` | Payload shape | 說明 |
|--------|--------------|-----|
| `import-progress` | `{ fileSize?, readPosition?, percentage?, queryCount?, op? }` | 進度 tick |
| `query-error` | `unknown` | **v4 漏** — 非致命單句錯誤、import 繼續 |
| `end` | `{ cancelled: boolean }` | |
| `cancel` | `{}` | |
| `error` | `string` | 致命錯誤 |

### 5.3 .NET 端實作

`ExportHub` / `ImportHub` 都是 raw `WebSocketMiddleware` controller（不是 SignalR）。Hub 內部用 `System.Threading.Channels.Channel<TaskMessage>` 解耦背景任務跟 WS sender，避免「進度推送 block 讓 task 等」。

```
TaskRegistry (singleton, ConcurrentDictionary<taskId, ExportTask>)
    └── ExportTask
          ├── CancellationTokenSource
          ├── Channel<TaskMessage>  ← writer = exporter, reader = WS hub
          └── BackgroundService task that drains Channel → WebSocket.SendAsync
```

**`abort` 處理時序（對齊 Node 行為）**：
1. WS hub 收 `{ type: "abort" }`
2. **立刻**寫 `{ type: "cancel" }` 進 channel（不等 task 結束 — 對齊 Node 同步發 cancel ack 行為）
3. 同時呼叫 `tokenSource.Cancel()` 通知 exporter
4. Exporter 觀察到 cancellation → 收尾 → 寫 `{ type: "end", cancelled: true }` 進 channel

關鍵：`cancel` 訊息**不**等 task 真的取消才送，否則 renderer 等 ack 會 timeout。Node 現況也是 sync ack（`schema.ts:409-415`）。

**`abortExport` HTTP vs WS `abort` 雙路**：兩個 endpoint 對同一個 `taskId` 有效。`POST /api/schema/abortExport` 從 `TaskRegistry` 找該 task → `tokenSource.Cancel()`。WS path 也是同一個 task。.NET `TaskRegistry` 是 singleton，兩條路收斂在同一個 entry。

---

## 6. Critical subsystems

### 6.1 ConnectionRegistry

**v4 只說「per-uid pool + idle sweep」就停了；reviewer 抓出三件 missing**——這 spec 全列。

```
ConnectionRegistry (singleton)
└── ConcurrentDictionary<uid, ConnectionEntry>
      ├── ISqlSugarClient           ← per-uid client
      ├── ConnectionConfigDto        ← raw config（給 keepalive 用）
      ├── DateTime LastUsedUtc       ← every API call 更新
      ├── Timer KeepAliveTimer       ← 10 分鐘 ping（MySQL/PG 必須，server-side idle timeout）
      ├── ConcurrentDictionary<tabUid, ManualCommitConnection>  ← v4 漏
      │     └── 專用連線（autocommit OFF）+ CancellationTokenSource
      └── bool SingleConnectionMode  ← v4 漏（poolSize=0 時 single connection、不 pool）
```

**Idle sweep**：背景 `Timer` 每 5 分鐘掃一次，`(now - LastUsedUtc) > 30min` 就 dispose。但**有 manual-commit connection 的 entry 不掃**（避免使用者中斷的 transaction 被殺）。

**Idle sweep 並發保護**：`commitTab` / `rollbackTab` / `destroyConnectionToCommit` 在「移除 manual-commit map entry」跟「dispose connection」之間有時間窗，可能導致 sweep 看到 entry 沒 manual-commit、誤殺正在 dispose 的連線。對策：`ConnectionEntry.IsBusy` flag（用 `Interlocked` 或 `lock`）；sweep 看到 `IsBusy = true` 就跳過；commit/rollback 流程把整段（清 map、dispose、設 LastUsedUtc）包在 `IsBusy = true → ... → IsBusy = false` 內。

**SSL 檔讀取**：`ConnectionConfigBuilder` 看到 `conn.cert / conn.key / conn.ca` 是檔案路徑時 `File.ReadAllText(path)` 讀進記憶體再放進 connection string——v4 漏這步。

### 6.2 Cancel 傳播（per-DB，v4 完全沒設計）

| Endpoint | MySQL | PostgreSQL | SQL Server | SQLite |
|----------|-------|-----------|-----------|--------|
| `connection/abort` | `KILL <connId>` | `pg_cancel_backend(<pid>)` | `SqlCommand.Cancel()` (per-request) | 無原生機制，靠 token + 主動中止 |
| `schema/killTabQuery` | 同上 + `_runningConnections[tabUid]` map 拿 conn id | 同上 | 同上 | 同上 |
| `import` cancel | `CancellationToken` → `transaction.Rollback()` 釋放 lock | 同上 | 同上（KILL SPID 在某些 long-running statement 也要） | `transaction.Rollback()` |

每個 DB 一個 `IQueryCanceller` 介面實作。

### 6.3 ManualCommit pattern（v4 漏整套）

當 query tab 切到「autocommit OFF」（lock 圖示）：
1. 第一次 query 來時，`ConnectionRegistry.GetOrCreateManualCommit(uid, tabUid)` 從 SqlSugar `ISqlSugarClient` 借**獨立** raw `IDbConnection`（不參與 pool），開 `BeginTransaction()`
2. 後續同 `tabUid` 的 query 都走這條獨立連線
3. `commitTab` → `IsBusy=true → transaction.Commit() + connection.Dispose() → 清 map → IsBusy=false`
4. `rollbackTab` → `IsBusy=true → transaction.Rollback() + connection.Dispose() → 清 map → IsBusy=false`
5. `destroyConnectionToCommit` → `IsBusy=true → connection.Dispose() → 清 map → IsBusy=false`（不管 transaction）
6. `killTabQuery` → 找該連線的 `CancellationTokenSource` cancel + 後續仍可走 commit/rollback
7. **`useSchema` 對 manual-commit 連線**：當 user 切 default schema 時，`useSchema` 必須對該 uid 下**所有** ManualCommitConnections 各自跑一次 schema 切換（MySQL `USE`、PG `SET search_path`、MSSQL `USE [...]`），否則該 tab 後續 query 還在舊 schema

**Manual commit map 不參與 idle sweep**（§6.1）。

### 6.4 Workers (Export / Import)

不用 Worker thread / process（.NET 不需要），用 `BackgroundService` + `Channel<T>`：

```
TaskRegistry (singleton)
└── ConcurrentDictionary<taskId, BackgroundTaskHandle>
      ├── CancellationTokenSource
      └── Task                    ← Task.Run(async () => ...)
                ↓ writes to
            Channel<TaskMessage>
                ↓ read by
            ExportHub.OnConnectedAsync 內的 reader loop → WebSocket.SendAsync
```

每個 DB 的 exporter/importer：
- `BaseExporter`: abstract，主流程（schema → tables → data）
- `MySqlExporter` / `PgExporter` / `MssqlExporter`：per-DB DDL 格式化
- SQLite **不支援 export**（沿用 Node 現況）

Exporter SQL 輸出**不追求** byte-for-byte 跟 Node 版相同（reviewer 抓出這假設不切實際），改追求**語意等價**：
- DDL：`Normalizer` 套件比較（拿掉空白、case insensitive keyword、column 順序）
- INSERT：值的 round-trip 相等（`SELECT * FROM table` 在 import 後跟 export 前相同）

### 6.5 翻譯 endpoint (`/api/ai/translate-column`)

⚠️ v4 寫成 Anthropic API 是錯的。實際是免費的 Google Translate `client=gtx` endpoint：
- Payload: `{ columnName: string, targetLocale: string }`
- Implementation: `HttpClient.GetAsync("https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl={targetLocale}&dt=t&q={columnName}")`
- Response 解析 nested JSON 拿 translated text → `{ description: string }`

不需要 API key、不需要新 settings。

---

## 7. Build & staging

### 7.1 `scripts/build-net-sidecar.mjs`

```
1. RID 偵測：win-x64 / osx-arm64 / osx-x64 / linux-x64
2. dotnet publish server/AntaresServer.csproj
     -c Release
     -r <RID>
     --self-contained true
     -p:PublishSingleFile=true
     -p:PublishReadyToRun=true
     -p:PublishTrimmed=false              ← reflection ORM 不能 trim
     -o sidecar-net/
3. 預期輸出：sidecar-net/antares-server[.exe]，~100-110MB
```

### 7.2 `scripts/stage-resources.mjs` 加旗標

`--target=node`（預設、現況）保留全部 BFS transitive deps + node[.exe] + cjs bundle + workers。
`--target=net` 只 stage `sidecar-net/antares-server[.exe]` 一支。
`--target=both` 兩個都 stage（Phase 16 dual-stack parity proof CI job 用，避免雙 build job 浪費 CI 分鐘）。
Phase 17 cutover 時把 `pnpm tauri:build` 走的 default 從 node 切 net；Phase 18 拿掉 `node` / `both` mode（永遠 net）。

### 7.3 Tauri config

`src-tauri/tauri.conf.json` + 三個 platform overlay（Windows/macOS/Linux）的 `bundle.resources` 在 cutover 後改：

```jsonc
{
  "bundle": {
    "resources": {
      "../sidecar-net/antares-server.exe": "antares-server.exe"
    }
  }
}
```

之前「`resources/node_modules` → `node_modules`」整段刪掉。

### 7.4 `src-tauri/src/sidecar.rs` 唯一改動

跨平台寫法（`#[cfg]` block 已有，spec 算「1 line」是因為**只有 binary path 那一行字面值**改）：
```rust
#[cfg(target_os = "windows")]
let server_path = resource_dir.join("antares-server.exe");  // 從 "sidecar/antares-server.cjs" 改

#[cfg(not(target_os = "windows"))]
let server_path = resource_dir.join("antares-server");      // Unix 無 .exe
```

`wait_for_ready` 也要動（5 秒 → 10 秒，cold start 緩衝）——這是第 2 行改動，但是常數調整不是邏輯改。

`READY:<port>:<token>` stdout 解析、`get_sidecar_port` / `get_sidecar_token` Tauri command、SIGTERM kill / `libc::kill` 全部不動。

⚠️ 「1 line」是 spec 簡化說法。實際 sidecar.rs 改 2-3 行（path × 2 due to cfg + timeout × 1）；其他都不動。Phase 17 hard gate 機械驗：`git diff src-tauri/src/sidecar.rs | grep -c '^[+-]' ≤ 8`（4 改動行 × 2 因為 diff 一加一減）。

---

## 8. CI gates（**全機械驗、不靠人眼判斷**）

### 8.1 `pnpm replay:contract`（Phase 4 引入）

```
1. spawn ./sidecar-net/antares-server[.exe] --probe-mode=false
2. 抓 stdout READY:<port>:<token>
3. 對 tests/fixtures/contract/*.json 每一個：
   - skip if metadata.skip = true（baseline-manifest 控制）
   - HTTP POST <port>/<request.route> with token + payload
   - deep-equal response vs expected, 忽略下方 IGNORE_PATHS
   - WS fixture：拆 JSONL frame、frame-by-frame deep-equal
4. process.kill(SIGTERM) sidecar
5. exit 0 if all pass / skip-and-pending; exit 1 if any fail
6. 印 N fixtures: M pass, K skip, X fail
7. 支援 --filter=pattern / --target=node|net|both / --against-running-app
```

**IGNORE_PATHS（real-DB 採集時非確定性的欄位，全列）**：

```js
const IGNORE_PATHS = [
  // 採集 metadata（每次採集時間/timestamp）
  'metadata.elapsed_ms_observed',
  'metadata.captured_at',

  // 連線/process 識別（每次 random）
  'response.connectionId',
  'response.processId',
  'response.uid',                   // 某些 endpoint 回 uuid
  'response.token',                 // sidecar restart token 變

  // rawQuery report（執行時間）
  'response.report.duration',
  'response.report.time',
  'response.report.elapsed_ms',

  // getStructure / getTables 的真實 DB 統計（rows/size 變動）
  'response[*].tables[*].rows',
  'response[*].tables[*].size',
  'response[*].size',
  'response[*].rows',
  'response[*].dataLength',         // MySQL
  'response[*].indexLength',        // MySQL
  'response[*].avgRowLength',       // MySQL
  'response[*].relpages',           // PG
  'response[*].reltuples',          // PG

  // getProcesses 的活動快照（每次都不同）
  'response[*].time',
  'response[*].state',
];
```

每 phase 採集新 fixture 時若發現新非確定性欄位，加進這 list、commit 進 `scripts/replay-contract.mjs`。

### 8.2 `pnpm audit:renderer`（Phase 5 引入）

```
1. git diff --name-only <baseline-tag>...HEAD -- web/renderer/ web/common/
2. 對每個 changed file：
   - 比對 docs/net-migration/renderer-audit-allowlist.txt（unrelated feature commit）
   - 不在 allowlist → exit 1
3. exit 0 if all changed files allowlisted or list is empty
```

### 8.3 `pnpm preflight:net` / `pnpm preflight:dbs`（Phase 0 引入）

`preflight:net`：
- `dotnet --version` 必須 ≥ 10.0
- 暫存資料夾 NuGet restore 一個空 `AntaresServer.csproj`（含 Furion + SqlSugar + Renci.SshNet + 4 個 driver + Bogus）
- 每個套件版本 lock 在 `server/Directory.Packages.props`

`preflight:dbs`：
- 從 `.env.test`（gitignored，user 自填）讀 4 個 dev DB 連線設定
- 每個 TCP-ping + open connection + `SELECT 1`
- 失敗就印缺哪個、提示 user 開機

### 8.4 既有 CI workflow 改動

| 檔 | Phase | 動作 |
|----|------|------|
| `.github/workflows/preflight-net.yml` | 0 | ✨ 新增：preflight:net（含 `actions/setup-dotnet@v4` with `dotnet-version: '10.0.x'`，CI runner 沒 .NET 10 預裝） |
| `.github/workflows/contract-replay.yml` | 4 | ✨ 新增：每 PR 跑、Linux + Windows matrix；同樣需 `setup-dotnet@v4` |
| `.github/workflows/renderer-audit.yml` | 5 | ✨ 新增：每 PR 跑 |
| `.github/workflows/test-build.yml` | 17 | 改 default 從 node 切 net；保留兩個 target |
| `.github/workflows/release.yml` | 17 | 同上 |
| `.github/workflows/test-e2e-win.yml` | — | 不動 |

**所有需要 .NET 的 workflow 必須先呼叫**：
```yaml
- uses: actions/setup-dotnet@v4
  with:
    dotnet-version: '10.0.x'
```
不能假設 runner 預裝。

---

## 9. Risk register（consolidated from 5 reviewers）

| ID | 風險 | 嚴重度 | 緩解 |
|----|------|-------|------|
| R1 | .NET cold start > 5s 超過 Tauri timeout | 中 | Phase 2 量測；Rust `wait_for_ready` 從 5s 拉到 10s |
| R2 | SSH.NET 對使用者 SSH gateway 的 cipher 不相容 | 中 | Phase 1 對使用者**真實** SSH gateway 跑 cipher matrix probe；不相容就 documented allowlist |
| R3 | macOS Gatekeeper 拒絕未簽 binary | 高 | CI codesign step；本機 `codesign --force --deep --sign - sidecar-net/antares-server` |
| R4 | SqlSugar SQLite `DbMaintenance` partial NotSupported | 低 | 每個 SQLite-touching 方法 try-catch，fallback 到 raw SQL（已知：`CreateDatabase` SQLite 會炸——SQLite 沒 DROP DATABASE 概念，連 CREATE 都半 broken；spec §2.2 已寫對策） |
| R5 | DDL 跨 DB byte-equality 達不到 | **已解** | 改追求語意等價（normalize 後比對）+ round-trip 測試，**不追求** byte-for-byte |
| R6 | Furion result filter 跟 ProblemDetails 衝突 | 低 | `OnException` 強制回 `{ status: "error", response: <string> }`（spec §3.2）；filter Order 設 `int.MinValue` |
| R7 | WebSocket 漏驗 token | 高 | `OnConnectedAsync` 階段就驗（不是 `OnReceiveAsync`），驗失敗 close code 4001 |
| R8 | CI 4 個 Node-download step 漏改 | 低 | Phase 17 cutover 後 grep verify |
| R9 | renderer 0 修改契約靠人眼維護 | 高 | Phase 5 引入 `audit:renderer` script、CI 強制 |
| R10 | openapi-typescript 對 Furion swagger 支援不足 | **已解** | **這個 spec 不做 codegen**——renderer 不動，TS interface 留在 `web/common/`，不靠 swagger 產生 |
| R11 | MCP server 知識 drift | **已解** | **這個 spec 不掛 MCP**——直接讀 Furion / SqlSugar 官方 docs |
| R12 | Forked Admin.NET 程式碼 drift | **已解** | **這個 spec 不 fork**——clean-room rewrite |
| R13 | `_v4 plan 漏 12 endpoint`、`updateCell` per-type per-DB escape ~150 LOC | 中 | spec §4.1 全列；Phase 11 為 `updateCell/deleteRows/insertFakeRows/getForeignList` 整套 3 天 |
| R14 | `rawQuery` 流量大、性能敏感 | 中 | Phase 7 baseline 量測 Node 版 latency；.NET 版必須在 1.5x 以內 |
| R15 | manual-commit transaction 5 個 endpoint 未經測試 | 中 | Phase 13 含 e2e：開 tab→關 autocommit→insert→killTabQuery→rollbackTab→驗證 row 不存在 |
| R16 | Cancel 傳播 per-DB 機制差異 | 中 | spec §6.2 表格化每個 DB 的實作；Phase 11 / 13 / 15 各自驗 |
| R17 | Microsoft.Data.Sqlite 跟 better-sqlite3 性能差距 | 低 | Phase 6 後 profile；超過 2x 才考慮 raw P/Invoke（不在這次 scope） |
| R18 | Coverage gate 在 Phase 18 砍 web/main/ 後爆掉 | 高 | Phase 18 三步：(1) `tests/` import audit `grep -rn "from ['\"]\\(common\\|web\\)/main" tests/` 找出 cross-imports；(2) 刪 `web/main/**/*.test.ts` + 改 `tests/` 內任何引 `web/main/` 的 helper；(3) 改 `scripts/check-coverage.mjs` 把 `web/main/` 從 exclusion 拿掉、重設 zone targets（剩餘 source 主要 `web/common/` + `web/renderer/` + `server/` C# 程式碼不參與 JS coverage）。Phase 18 hard gate 含「`pnpm test:coverage:check` exit 0」、新 baseline 文件 `docs/net-migration/coverage-post-phase18.md` 紀錄分子/分母 |
| R19 | LICENSE / NOTICE 不齊 | 中 | Phase 0 commit `NOTICE` 檔；不 fork Admin.NET 後法律風險大幅降低 |
| R20 | Fixture 採集靠 user，user 沒空時 phase 卡住 | 中 | spec §2.3「Phase-by-phase user 即時 capture」明示；agent 寫好 capture script + fixture template，user 1 個指令 5-10 分鐘採集；採集前 phase 不 unblock |
| R21 | `insertFakeRows` Bogus 對 Faker.js 慣用法的對映遺漏 | 中 | Phase 11 entry gate 必須先產 `docs/net-migration/bogus-mapping.md` 對應 `web/common/libs/fakerCustom.ts` 跟 `common/fieldTypes.ts`；至少涵蓋 NUMBER/FLOAT/TEXT/BLOB/BIT/BOOLEAN/ARRAY/DATE/DATETIME/JSON 10 種 column type，加上 12+ 常用語意（email/url/fullName/firstName/lastName/companyName/lorem.sentence/internet.ip/phone/uuid/etc.）。沒這份文件不開 Phase 11 |

---

## 10. Out of scope

- ❌ Firebird 支援（v0.9.0 release notes 公告退場）
- ❌ Node sidecar 並行（dual-stack 期間是 build 並行、runtime 還是單一）
- ❌ Renderer / Tauri Rust 端任何邏輯改動（除 sidecar.rs 一行 + bundle resources）
- ❌ 新功能（純 1:1 平移 + reviewer 修正）
- ❌ NativeAOT / PublishTrimmed
- ❌ Renderer IPC contract 重構
- ❌ Admin.NET fork / MCP server / openapi codegen
- ❌ rename antares2 → 其他名字（保留 `antares-server` binary 名、`com.tw199501.antares2` Tauri identifier）

---

## 11. Validation matrix（最終驗收）

### 11.1 Endpoint coverage（79 個全綠）

```
pnpm replay:contract --target=net
# 預期：79 fixtures: 79 pass, 0 skip, 0 fail
```

每一個 endpoint 至少一個 happy fixture；critical endpoints (`rawQuery`, `getTableData`, `updateCell`, `getKeyUsage`, `alterTable`, ws-export, ws-import) 加一個 error / cancel fixture。

### 11.2 DB 覆蓋（4 種）

每個 phase 結束前 user 對下列 4 種 dev DB 跑 capture：
- MySQL 8.x
- PostgreSQL 16
- SQL Server 2022（CI e2e 已有 3 specs）
- SQLite

### 11.3 Build / CI（4 平台）

```
pnpm tauri:build  # win-x64 / osx-arm64 / osx-x64 / linux-x64
```

預期：
- 每個 installer 產出
- 體積 < v0.8.x 70%（Node 200MB → .NET 100-110MB）
- `pnpm test:e2e e2e/mssql-*.spec.ts` 全綠
- `pnpm replay:contract --against-running-app` 全綠（hits Tauri-spawned sidecar）

### 11.4 Renderer 不變鐵律

```
pnpm audit:renderer
# 預期：exit 0
```

`web/renderer/` + `web/common/` git diff 必須**完全為空**或全部在 `docs/net-migration/renderer-audit-allowlist.txt`。

### 11.5 dual-stack parity（Phase 16 verdict）

```
pnpm replay:contract --target=node && pnpm replay:contract --target=net
# 兩個都 exit 0 才能進 Phase 17 cutover
```

---

## 12. Glossary

| 詞 | 意義 |
|----|------|
| **Sidecar** | Tauri spawn 的 backend process（Node 現在、.NET 之後） |
| **Envelope** | `{ status, response }` HTTP 包封 |
| **Token** | per-launch 32-byte hex，HTTP header / WS query 都帶 |
| **Fixture** | `tests/fixtures/contract/*.json` 凍結的 request/response 對 |
| **Replay harness** | `scripts/replay-contract.mjs`，跑 fixture 對 sidecar 比對 |
| **dual-stack** | Node + .NET binary 同時可建、各自跑 fixture replay 都過 |
| **Cutover** | Phase 17 把 Tauri sidecar.rs 從 spawn Node 切到 spawn .NET（一行 git revert 可回滾） |
| **Hard gate** | 一個 shell 指令、exit code 0 就過、不靠人眼 |
| **Manual-commit** | autocommit OFF 模式，per-tab 獨立連線 + 自管 transaction |

---

## 13. References

- [Backend inventory baseline](../plans/2026-05-03-backend-inventory.md)
- [Frontend unit test rollout v2](../plans/2026-05-03-frontend-unit-test-rollout-v2-remaining.md)（contract fixture 採集機制）
- [v4 execution plan (deprecated)](../plans/2026-05-03-net-sqlsugar-execution-plan.md)
- [Companion plan](../plans/2026-05-05-net-sidecar-migration.md)
- `web/main/server.ts` — Node sidecar entry
- `web/main/routes/*.ts` — 12 個 route 模組
- `web/main/libs/clients/BaseClient.ts` — abstract API surface
- `web/renderer/ipc-api/httpClient.ts` — HTTP wrapper（不改）
- `tests/fixtures/contract/` — 9 個既有 mssql happy fixture（PR3.A）
- `scripts/capture-contract-fixtures.mjs` — 採集腳本（v2 PR3 commit `1c8be66`）
