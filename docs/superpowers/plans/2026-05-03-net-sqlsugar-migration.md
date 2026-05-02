# Plan: antares2 backend 切 .NET (Furion + SqlSugar + DynamicApi)

## Context

antares2 fork 自上游 Node.js (Fastify) 後，5 個 client (`src/main/libs/clients/*.ts`) 各自實作 DDL 抽象 — DROP COLUMN 沒擋 inbound FK、column reorder 5 個 DB 各做各的、autocommit cascade DDL 順序靠 client 自己拼。這些痛點 SqlSugar 的 `db.DbMaintenance` API 原生支援。

使用者的其他專案（jiebei-lease）已用 .NET + SqlSugar，stack 對齊省下知識成本。antares2 是長期維護專案、值得一次性遷移。

**結果目標**：Tauri shell（Rust）不變，sidecar 從 Node.js (TypeScript + Fastify) 切成 .NET 10 self-contained binary（Furion + SqlSugar + DynamicApi）。Renderer (Vue) IPC contract 不變，0 修改。

---

## 鎖定決策

| 決策 | 選項 | 理由 |
|---|---|---|
| **Firebird** | ❌ 斷捨離 | 使用率 <5%，SqlSugar 不原生支援。`src-net/` 不寫；renderer 後續清 |
| **.NET 版本** | .NET 10（LTS, 2025-11 起）| 主流選項，Furion 完整支援，PGO/NativeAOT 候選 |
| **API contract** | 沿用 `{ status, response }` + 5555 + `X-Sidecar-Token` | renderer 0 修改、IPC layer 透明切換、Furion 仍自動產 Swagger 給內部 debug 使用，不影響 |
| **Workers (export/import)** | C# 完整 rewrite | 避免 hybrid stack；長期維護單一語言更乾淨 |
| **Node.js scope** | 僅留前端 build（vite / pnpm / lint），後端側 0 Node.js 依賴 | 開發機仍要 Node 18+ 跑 renderer dev；production binary 不含 Node runtime / node_modules |

---

## Repo 結構（target state）

```
antares2/
├── src/
│   ├── renderer/              # Vue 3，不動
│   ├── common/                # TS interfaces，逐步用 OpenAPI gen
│   └── main/                  # ❌ 退場（Phase 7 刪）
├── src-tauri/                 # Rust shell + sidecar.rs
│   └── src/sidecar.rs         # spawn antares-server.exe（不再 spawn node）
├── src-net/                   # ✨ 新增 .NET 專案根
│   ├── Antares.Server/        # Furion API host
│   │   ├── Program.cs
│   │   ├── DynamicApi/        # Service classes → auto REST endpoints
│   │   ├── DbContext/         # SqlSugarClient pool per uid
│   │   └── Workers/           # Export/Import (replaces src/main/workers/)
│   ├── Antares.Domain/        # POCOs，跟 src/common/interfaces 對齊
│   └── Antares.sln
├── sidecar/                   # antares-server.exe (replaces .cjs)
└── scripts/
    ├── build-sidecar.mjs      # ❌ 退場
    ├── build-net-sidecar.mjs  # ✨ 新增：dotnet publish per RID
    └── stage-resources.mjs    # 改 stage .NET binary，不再 BFS Node deps
```

---

## Phased roadmap

### Phase 0 — 環境 + 決策確認（1 天）

- 安裝 .NET 10 SDK 到 dev 機 + 4 platform CI runners (`actions/setup-dotnet@v4`)
- 確認 SqlSugar 對 5 → 4 DB 的支援表（MSSQL/MySQL/PG/SQLite）
- 文件化 Firebird 退場聲明（v0.9.0 release notes）
- **PoC：Hello World Furion API in Tauri sidecar pattern** — 起 5555 + `READY:` 行 + `/health` 回 200

**驗證**：`pnpm tauri:dev` 換用 .NET PoC binary、renderer 跑得起來、`/health` 通

### Phase 1 — Furion scaffold + auth (2-3 天)

- `src-net/Antares.Server` 新專案，Furion 10 + SqlSugar 5
- Token middleware（`X-Sidecar-Token` header 跟 `?token=` query 都接）
- `DynamicApi` base controller、Swagger 跑起來（dev only）
- `IpcResponse<T>` DTO `{ status: "success"|"error", response: T }`，跟 renderer 共用 shape
- stdout 印 `READY:<port>:<token>`、SIGTERM/Ctrl+C graceful shutdown

**驗證**：`/api/health` + 手寫一個 dummy `/api/test/echo` 由 DynamicApi 自動 expose

### Phase 2 — Tauri sidecar 切 binary (2 天)

- `src-tauri/src/sidecar.rs` `spawn_server` 改 spawn `antares-server.exe`（Win）/ `./antares-server`（Mac/Linux），不再 spawn `node antares-server.cjs`
- `scripts/stage-resources.mjs` 重寫：不 BFS Node deps，改 copy `src-net/Antares.Server/bin/Release/net10.0/<rid>/publish/` 的 self-contained 輸出
- `tauri.conf.json` `bundle.resources` 移除 `node_modules/` mapping
- `tauri.{windows,macos,linux}.conf.json` resource 換成 `.exe` / unix binary

**驗證**：`pnpm tauri:build` win-x64 出 NSIS/MSI、安裝後 sidecar 跑 .NET 不跑 Node

### Phase 3 — Connection routes (1 週)

移植：
- `connection.connect` / `disconnect` / `check`
- `SqlSugarClient` per-uid pool（在 .NET DI container 用 `IServiceProvider` keyed services 或 ConcurrentDictionary）
- SSH tunnel（用 `Renci.SshNet` 替 Node 的 `@heroku/socksv5` + `ssh2`）
- SSL cert handling

**驗證**：renderer 連 4 個 DB（MSSQL/MySQL/PG/SQLite）都能通 + `pnpm test:e2e e2e/mssql-database-switch.spec.ts` 跑通

### Phase 4 — Schema routes (1.5-2 週)

移植：
- `databases.getDatabases`
- `tables.getTables` / `getTableColumns` / `getTableIndexes` / `getKeyUsage` / `getTableChecks` / `getTableOptions`
- 用 SqlSugar 的 `db.DbMaintenance.GetTableInfoList()` / `GetColumnInfosByTableName()` 取代手寫 INFORMATION_SCHEMA query
- views / triggers / functions / routines / schedulers 各自 routes

**驗證**：renderer 開 explore tree → schema metadata 正常顯示

### Phase 5 — Data + DDL routes (1.5 週)，**主要受益區**

- `tables.getTableData` / `getTableApproximateCount` / `searchColumns`
- `tables.alterTable` — **這是切 SqlSugar 的最大價值點**：
  - 用 `db.DbMaintenance.AddColumn` / `DropColumn` / `AlterColumn` / `RenameColumn` 跨 DB 抽象
  - **inbound FK 偵測原生支援**：`db.DbMaintenance.GetForeignKeys()` 回傳 referenced 列表，drop column 前先檢查
  - DDL 順序自動處理（DROP CONSTRAINT 在 DROP COLUMN 之前）
  - 之前討論的 Layer 1+2 確認 modal 的後端側「免費」實現

**驗證**：renderer 屬性 tab 增/改/刪欄位、加 index、加 FK 全部行為一致 + DROP COLUMN with FK 自動 cascade（之前要手刻）

### Phase 6 — Workers rewrite (1-2 週)

- `src/main/workers/exporter.ts` → `src-net/Antares.Server/Workers/Exporter.cs`
- `importer.ts` → `Importer.cs`
- 用 `Channel<T>` 或 `IAsyncEnumerable<T>` 做 streaming 輸出（取代 Node Worker thread + postMessage）
- 進度回報走 SSE 或 WebSocket（Furion 兩個都支援）

**驗證**：mysqldump 等價輸出 + 大表 import 不 OOM

### Phase 7 — 退場 Node.js (sidecar + workers) + 釋出 (2-3 天)

- 刪 `src/main/`、`scripts/build-sidecar.mjs`、`sidecar/antares-server.cjs` (dev) / 不再 commit `sidecar/node*`
- 更新 CLAUDE.md「Process model」段：sidecar 改成 .NET、Node.js 標註「僅 dev 期間 vite / pnpm 工具用，production binary 不含」
- 更新 `pnpm sidecar:dev` → `pnpm sidecar:dev:net`（呼叫 `dotnet watch run`），保留 `pnpm vite:dev` 不動
- 從 `package.json` `dependencies` 移除所有後端用 npm 套件：`fastify`、`mssql`、`mysql2`、`pg`、`better-sqlite3`、`node-firebird`、`@fastify/*`、`@heroku/socksv5`、`ssh2`、`@faker-js/faker` 等 ~20 個
- 保留純前端用：`vue`、`pinia`、`reka-ui`、`@tauri-apps/*`、build tools
- 釋出 v0.9.0：「backend 切 .NET + SqlSugar，Firebird 不再支援，其他 DB 行為一致；installer 體積縮 30%+」

**驗證**：`pnpm tauri:build` 4 platform 全綠、無 node_modules 殘留 → installer 體積估縮 30-40%（Node 200MB hoisted deps 換成 .NET 80MB self-contained）

---

## 估總工時

| 範圍 | 全職估計 | 兼職估計（half-time）|
|---|---|---|
| Phase 0-2（基礎建設）| 5-7 天 | 2 週 |
| Phase 3-5（routes）| 4-5 週 | 8-10 週 |
| Phase 6-7（workers + 退場）| 1.5-2.5 週 | 3-5 週 |
| **總計** | **6-9 週** | **13-17 週** |

---

## 隱形風險

- **SSH tunnel** — Renci.SshNet 跟 Node 的 ssh2 有 cipher / KEX 差異，連舊 server 可能要 manual config
- **MySQL native_password vs caching_sha2** — MySqlConnector (.NET) 跟 mysql2 (Node) 對 8.0+ 預設 auth plugin 處理略不同，新建 user 可能要 ALTER USER
- **better-sqlite3 → Microsoft.Data.Sqlite** — performance 差異（前者是 sync C++ binding、後者是 ADO.NET wrapper），大資料夾 query 慢一些
- **PostgreSQL 連線字串** — Npgsql 對 SSL mode 命名跟 pg (Node) 不同，需要 contract mapping
- **renderer ipc-api 共型** — `src/common/interfaces/antares.ts` TypeScript 跟 .NET POCO 要保持同步。建議用 `NSwag` 或 `Refit` codegen 自動同步，或手動每次 PR 對齊
- **Tauri sidecar 重啟邏輯** — Node 用 `process.exit` 後 Tauri 監看 stdout 知道 ready；.NET 啟動時間較 Node 長 200-500ms，要調整 sidecar.rs 的 ready timeout
- **dev 體驗回歸** — `dotnet watch` 不像 `tsx watch` 即時，預期 reload 從 ~2s 退到 5-10s。可接受但要心理準備
- **NativeAOT 試水** — Furion 10 + SqlSugar 對 NativeAOT 的支援尚未成熟（reflection-heavy）。Phase 0-7 先用 self-contained，NativeAOT 列為 v0.10 evaluation

---

## Verification matrix

每個 Phase 結束跑一致的 smoke：

```bash
# Phase 0-2
pnpm tauri:build && # installer ok
.\Antares2.exe &&   # 可啟、健康
curl http://127.0.0.1:5555/health  # 200

# Phase 3+
pnpm test:e2e e2e/mssql-database-switch.spec.ts
pnpm test:e2e e2e/mssql-empty-table-header.spec.ts
pnpm test:e2e e2e/mssql-limit-guards.spec.ts
# + 手動 smoke：每個 DB 連線 + open table + edit field + Save → 在 Properties tab 改 / 在 Data tab 改

# Phase 5 (key win)
# DROP COLUMN with inbound FK：
#   1. 在子表建 FK 指向 ding_talk_role_user.id
#   2. 屬性 tab 點 ⬛ 刪 id 欄位
#   3. 應彈出「依賴清單」確認 modal 列出該 FK
#   4. 確認 → SqlSugar 自動 DROP CONSTRAINT 再 DROP COLUMN，成功
#   或：拒絕 cascading → 取消、原狀

# Phase 7
node -e "console.log(process.versions.node)" # 不再被 sidecar 用
pnpm tauri:build && du -sh dist/* # installer 體積比 v0.8 縮 30%+
```

---

## 不在這個 plan 裡

- **新功能**（Pivoted to other agent / sidebar / etc.）— 純後端遷移、UI 不動
- **migration of existing user data** — antares2 是 client tool、無自家資料儲存，Tauri AppData (settings.json + connections.json) shape 不變
- **NativeAOT** — 列 v0.10 evaluation
- **效能優化** — 等 Phase 7 完整跑過再 profile，不預判
