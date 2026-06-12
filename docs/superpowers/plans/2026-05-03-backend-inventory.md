# antares2 Node.js backend — 完整盤點（migration baseline）

**用途**：作為 [.NET + SqlSugar 遷移計畫](./2026-05-03-net-sqlsugar-migration.md) 的對照表 — 每個 .NET 對應實作完成時對照這份標掉、確保 0 漏。

**範圍**：`src/main/`（後端 sidecar）+ `src/common/`（共享型別與 customizations）+ `sidecar/`（build artifact）。**不含** Tauri Rust shell（不變動）跟 renderer（不變動）。

---

## 1. 目錄結構

```
src/main/                              # Node.js / TypeScript backend
├── server.ts                          # Fastify 入口 + token middleware + ready signal (98 lines)
├── routes/                            # 12 個 HTTP route 模組
│   ├── ai.ts                          # 翻譯（已切 Google Translate）
│   ├── application.ts                 # 檔案讀寫 (Tauri appdata)
│   ├── connection.ts                  # 連線生命週期
│   ├── databases.ts                   # database list
│   ├── functions.ts                   # functions / trigger functions
│   ├── routines.ts                    # stored procedures
│   ├── schedulers.ts                  # MySQL events
│   ├── schema.ts                      # 跨 schema CRUD + WebSocket export/import
│   ├── tables.ts                      # tables CRUD + alterTable + cell ops
│   ├── triggers.ts
│   ├── users.ts
│   └── views.ts                       # views + materialized views
├── libs/
│   ├── ClientsFactory.ts              # 5-DB string → client class
│   ├── safeError.ts
│   ├── clients/
│   │   ├── BaseClient.ts              # 共用方法 + abstract API (302 LOC)
│   │   ├── MySQLClient.ts             # 1915 LOC
│   │   ├── PostgreSQLClient.ts        # 1863 LOC
│   │   ├── SQLServerClient.ts         # 1606 LOC
│   │   ├── SQLiteClient.ts            # 780 LOC
│   │   └── FirebirdSQLClient.ts       # 1255 LOC ❌ 遷移後刪除
│   ├── exporters/
│   │   ├── BaseExporter.ts
│   │   └── sql/
│   │       ├── SqlExporter.ts
│   │       ├── MysqlExporter.ts
│   │       ├── PostgreSQLExporter.ts
│   │       └── MSSQLExporter.ts       # 無 SQLite/Firebird exporter
│   ├── importers/
│   │   ├── BaseImporter.ts
│   │   └── sql/
│   │       ├── MysqlImporter.ts
│   │       ├── PostgreSQLImporter.ts
│   │       └── MSSQLImporter.ts       # 無 SQLite/Firebird importer
│   ├── parsers/
│   │   ├── MySQLParser.ts
│   │   └── PostgreSQLParser.ts
│   └── misc/
│       └── ipcLogger.ts
└── workers/                           # Node.js Worker thread bundles
    ├── exporter.ts                    # 102 LOC
    └── importer.ts                    # 157 LOC

src/common/                            # 共享型別 — renderer + sidecar 都用
├── interfaces/
│   ├── antares.ts                     # 主要 model (TableField, TableIndex, ...)
│   └── customizations.ts              # 80+ 個 per-DB feature flags 定義
├── customizations/
│   ├── defaults.ts                    # 全部 false / 空
│   ├── mysql.ts
│   ├── postgresql.ts
│   ├── sqlserver.ts
│   ├── sqlite.ts
│   ├── firebird.ts                    # ❌ 遷移後刪除
│   └── index.ts                       # 客戶字串 → customizations 對照
├── libs/                              # 純函式 utility (formatBytes 等)
└── shortcuts.ts                       # 鍵盤快捷鍵定義（renderer 用）

sidecar/                               # Build artifacts (committed except node binary)
├── antares-server.cjs                 # 10.4 MB — esbuild bundle of src/main/server.ts
├── antares-server.js                  # 5.5 MB — older bundle (will be removed)
└── node.exe                           # 86 MB — gitignored, downloaded per CI / manual
```

---

## 2. HTTP routes — 完整 endpoint 清單

**全部 75 個 endpoint，全用 POST**（沒設計 RESTful 動詞，treat as RPC over HTTP）。Auth 機制：每個 request header `X-Sidecar-Token`（WebSocket 用 `?token=` query），server 比對啟動時生成的 random token。

### 2.1 connection.ts (5)
| Endpoint | Purpose |
|---|---|
| `POST /api/connection/test` | 試連、不留 pool |
| `POST /api/connection/connect` | 建 pool、存到 sidecar in-memory map (uid → client) |
| `POST /api/connection/disconnect` | 關 pool |
| `POST /api/connection/abort` | 中止進行中的 query |
| `POST /api/connection/check` | 確認 pool 還在（uid 是否存在）|

### 2.2 schema.ts (16 + 2 WebSocket)
| Endpoint | Purpose |
|---|---|
| `POST /api/schema/create` | CREATE SCHEMA |
| `POST /api/schema/update` | ALTER SCHEMA（rename / collation）|
| `POST /api/schema/delete` | DROP SCHEMA |
| `POST /api/schema/getCollation` | 單 schema collation |
| `POST /api/schema/getStructure` | 整 connection 的 db→tables→cols 樹 |
| `POST /api/schema/getCollations` | 全 collation 列表 |
| `POST /api/schema/getVariables` | server variables |
| `POST /api/schema/getEngines` | MySQL engines |
| `POST /api/schema/getVersion` | server 版本 |
| `POST /api/schema/getProcesses` | 連線清單 |
| `POST /api/schema/killProcess` | 強斷 server-side process |
| `POST /api/schema/useSchema` | USE 切 default db |
| `POST /api/schema/rawQuery` | 任意 SQL execute（SQL Editor 用）|
| `POST /api/schema/export` | 啟動 export job（轉 worker thread）|
| `POST /api/schema/abortExport` | 中止 export |
| `POST /api/schema/importSql` | 啟動 import job |
| `POST /api/schema/abortImportSql` | 中止 import |
| `POST /api/schema/killTabQuery` | tab 級 query 中止 |
| `POST /api/schema/commitTab` | tab transaction commit |
| `POST /api/schema/rollbackTab` | tab transaction rollback |
| `POST /api/schema/destroyConnectionToCommit` | tab 連線拋棄 |
| **`GET /ws/export`** | WebSocket — export progress stream |
| **`GET /ws/import`** | WebSocket — import progress stream |

### 2.3 tables.ts (18) — **migration 重點區**
| Endpoint | Purpose |
|---|---|
| `POST /api/tables/getColumns` | column metadata |
| `POST /api/tables/searchColumns` | column 名稱搜尋 |
| `POST /api/tables/getData` | SELECT * with paging / sort / filter |
| `POST /api/tables/getCount` | approximate row count |
| `POST /api/tables/getOptions` | table-level options（name / comment / engine / collation 等）|
| `POST /api/tables/getIndexes` | index 列表 |
| `POST /api/tables/getChecks` | CHECK constraints |
| `POST /api/tables/getDdl` | SHOW CREATE TABLE |
| `POST /api/tables/getKeyUsage` | foreign keys |
| `POST /api/tables/updateCell` | UPDATE 單格 |
| `POST /api/tables/deleteRows` | DELETE WHERE PK IN (...) |
| `POST /api/tables/insertFakeRows` | faker.js 隨機資料生成 |
| `POST /api/tables/getForeignList` | reference table 列表 |
| `POST /api/tables/create` | CREATE TABLE |
| `POST /api/tables/alter` | **ALTER TABLE — autocommit-on-confirm 的核心 endpoint** |
| `POST /api/tables/duplicate` | CREATE TABLE LIKE |
| `POST /api/tables/truncate` | TRUNCATE |
| `POST /api/tables/drop` | DROP TABLE |

### 2.4 views.ts (8)
- 4 個 view CRUD（getInformations / drop / alter / create）
- 4 個 materializedView 對應（PostgreSQL only 實際）

### 2.5 triggers.ts (5) — getInformations / drop / alter / create / toggle
### 2.6 routines.ts (4) — stored procedures
### 2.7 functions.ts (6) — functions + triggerFunctions（PG）
### 2.8 schedulers.ts (5) — MySQL events
### 2.9 databases.ts (2) — getDatabases / getDatabaseComment
### 2.10 users.ts (1) — getUsers
### 2.11 application.ts (2) — readFile / writeFile（Tauri appdata mediator）
### 2.12 ai.ts (1) — translate-column（Google Translate proxy）

**總計：75 HTTP + 2 WebSocket = 77 個 endpoint**

---

## 3. Client 實作分布

`BaseClient.ts` 定義共用方法 + abstract API。每個 DB client 實作以下功能（完整覆蓋率對照）：

| 功能 | MySQL | PG | MSSQL | SQLite | Firebird |
|---|---|---|---|---|---|
| connect / disconnect | ✅ | ✅ | ✅ | ✅ | ❌ skip |
| getStructure（樹狀）| ✅ | ✅ | ✅ | ✅ | ❌ skip |
| getCollations | ✅ | ✅ | ✅ | n/a | ❌ |
| getEngines | ✅ | n/a | n/a | n/a | ❌ |
| getVariables | ✅ | ✅ | ✅ | n/a | ❌ |
| createTable / alterTable / dropTable | ✅ | ✅ | ✅ | ✅ | ❌ |
| getTableData / updateCell / deleteRows | ✅ | ✅ | ✅ | ✅ | ❌ |
| getIndexes / getKeyUsage / getChecks | ✅ | ✅ | ✅ | ✅ | ❌ |
| views / triggers / routines / functions / schedulers | ✅ | ✅ | ✅ partial | ✅ partial | ❌ |
| Export (mysqldump 等價) | ✅ | ✅ | ✅ | ❌ no exporter | ❌ |
| Import (.sql streaming) | ✅ | ✅ | ✅ | ❌ no importer | ❌ |

**LOC 分布**：MySQL 1915 / PG 1863 / MSSQL 1606 / Firebird 1255 / SQLite 780 = 7421 (excl. BaseClient 302)

**遷移到 SqlSugar 後預期**：4 個 DB（移除 Firebird）的 client 程式碼壓縮到 **~30%**（3000 LOC 內），因為 SqlSugar `db.DbMaintenance` + `Queryable` 抽象掉 80% 的 boilerplate。

---

## 4. Workers (Node.js Worker thread)

| Worker | LOC | 用途 |
|---|---|---|
| `exporter.ts` | 102 | 接 main thread message → 啟 BaseExporter 的 export → 透過 postMessage 回報進度 |
| `importer.ts` | 157 | 接 stream chunk → BaseImporter 解析 + execute |

**遷移到 .NET**：
- `Channel<T>` 替代 Worker postMessage
- `IAsyncEnumerable<T>` 給 import streaming
- `BackgroundService` host export job

---

## 5. Customizations — 80+ feature flags

`src/common/customizations/defaults.ts` 是基底（全部 false / 空），每個 client（mysql / postgresql / sqlserver / sqlite / firebird）覆寫自己支援的 flag。**Renderer 透過 `workspace.customizations.<flag>` 條件性顯示 UI**（例如 `customizations.engines: true` 才顯示 Engine 選單）。

抽樣 flag：
- DDL：`tableAdd`, `tableDdl`, `triggers`, `routines`, `functions`, `schedulers`, `tableTruncateDisableFKCheck`, `sortableFields` (column reorder)
- Field-level：`autoIncrement`, `nullable`, `nullablePrimary`, `unsigned`, `zerofill`, `collation`, `comment`
- Connection：`sslConnection`, `sshConnection`, `fileConnection`, `singleConnectionMode`
- Tools：`processesList`, `usersManagement`, `variables`
- Misc：`elementsWrapper` (`backtick \`` for MySQL, `"` for PG), `stringsWrapper`

**遷移到 .NET**：customizations 維持原 5 個檔案（POCO），由 .NET 經 IPC 回傳給 renderer，renderer 不改。Firebird 那份檔砍掉。

---

## 6. Sidecar entry point — `server.ts` 細節

```ts
// 入口流程（server.ts 98 行）
1. Fastify({ logger: false })
2. token = randomBytes(32).toString('hex')
3. 註冊 middleware：preHandler 檢查 X-Sidecar-Token / ?token=（/health 跳過）
4. cors 註冊（origin 開放，因 Tauri 內網）
5. websocket 註冊
6. 12 個 routes 註冊
7. listen(port)（dev 5555 / prod random free port）
8. console.log(`READY:${port}:${token}`) — Rust shell 從 stdout 抓取
9. process.on('SIGTERM' | 'SIGINT') graceful shutdown
```

**遷移到 .NET 對應**：
- `WebApplication.CreateBuilder()` + Furion `AddInject()`
- token 從 `RandomNumberGenerator.GetBytes(32).ToHex()` 生成
- middleware：自寫 `TokenAuthMiddleware`（Furion 沒有 OOTB）
- `app.Run("http://127.0.0.1:5555")`
- `Console.WriteLine($"READY:{port}:{token}")` 給 sidecar.rs
- `IHostApplicationLifetime.ApplicationStopping` 處理 SIGTERM

---

## 7. 已知 npm 依賴 — Phase 7 退場清單

從 `package.json` 來看，Phase 7 要從 `dependencies` 移除（搬到 .NET 等價套件）：

| Node 套件 | 用途 | .NET 等價 |
|---|---|---|
| `fastify` + `@fastify/cors` + `@fastify/websocket` | HTTP / WS 框架 | Furion (ASP.NET Core) |
| `mssql` | SQL Server driver | `Microsoft.Data.SqlClient` (SqlSugar 包) |
| `mysql2` | MySQL driver | `MySqlConnector` (SqlSugar 包) |
| `pg` + `pg-query-stream` + `pgsql-ast-parser` | PostgreSQL | `Npgsql` (SqlSugar 包) |
| `better-sqlite3` | SQLite | `Microsoft.Data.Sqlite` (SqlSugar 包) |
| `node-firebird` | Firebird | ❌ 遷移後刪 |
| `@heroku/socksv5` + `ssh2` + `@fabio286/ssh2-promise` | SSH tunnel | `Renci.SshNet` |
| `@faker-js/faker` | Fake row 生成 | `Bogus` |
| `sql-formatter` + `sql-highlight` | renderer 端用？需確認 | renderer 端保留 |

**保留前端用**：`vue` / `pinia` / `reka-ui` / `@tauri-apps/*` / `@vueuse/core` / `tailwindcss` / `vite` / `eslint` / 等等。

---

## 8. 遷移驗收 checklist

每個 endpoint 在 .NET 對應實作完成時打勾：

- [ ] 5 connection
- [ ] 16 + 2 WS schema
- [ ] 18 tables ← **重點**
- [ ] 8 views
- [ ] 5 triggers
- [ ] 4 routines
- [ ] 6 functions
- [ ] 5 schedulers
- [ ] 2 databases
- [ ] 1 users
- [ ] 2 application
- [ ] 1 ai
- [ ] 2 workers (export / import)

每個 client 在 SqlSugar / 自寫適配器跑通：
- [ ] MySQL
- [ ] PostgreSQL
- [ ] SQL Server
- [ ] SQLite

完成後對照本文件、確認 0 endpoint 遺漏才能釋出 v0.9.0。
