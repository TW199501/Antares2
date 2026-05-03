# .NET 10 + Furion + SqlSugar 後端遷移：可執行計畫

> **目標檔位置（plan-mode 結束後搬）**: `docs/superpowers/plans/2026-05-03-net-sqlsugar-execution-plan.md`
> **配套既有文件**:
> - `docs/superpowers/plans/2026-05-03-net-sqlsugar-migration.md` — 7-phase roadmap（概念）
> - `docs/superpowers/plans/2026-05-03-backend-inventory.md` — 現狀清點（baseline）
>
> 這份是把上述兩份 stitch 成「對應 file path 的 execution plan」。

## Context

### 為什麼重構
1. **跨 DB DDL 一致性難題**：5 個 DB client 各自 hand-code 1.2k–1.9k LOC（共 7421 LOC，扣掉 BaseClient 302 LOC），每個 DDL 動作（add/drop column、cascade FK detection）要在 5 個檔分別維護。
2. **Inbound FK detection 痛點**：drop column 時要先掃所有 referencing FK，目前 client 各自實作 `getKeyUsage()` 邏輯，bug 散布。SqlSugar 的 `DbMaintenance.GetForeignKeys()` 跨 4 種 DB 統一語意，是這次遷移的最大 ROI。
3. **Worker pool 散亂**：export/import 用 Node `worker_threads` + `parentPort` 雙向訊息，跨平台行為不穩（macOS 檔案 lock 問題）。
4. **Bundle 體積**：Node sidecar + 52 個遞迴 stage 的 transitive deps（pnpm hoist 後 BFS 走出來的）讓安裝包 ~200MB。.NET 10 self-contained + R2R 預估 ~80MB（縮 30–40%）。

### Locked Decisions（已在 commit 97353d7 鎖定，不再討論）
| 決策 | 內容 |
|------|------|
| Firebird 支援 | **斷捨離**（使用率 <5%、SqlSugar 不原生支援） |
| .NET 版本 | **.NET 10 LTS**（2025-11 起） |
| Web framework | **Furion 10**（DI + 動態 API + Swagger） |
| ORM | **SqlSugar 5**（CodeFirst + DbMaintenance + 跨 DB） |
| IPC 契約 | **沿用 `{ status, response }` envelope + port 5555 + `X-Sidecar-Token` header**，renderer **零修改** |
| Workers | **C# 完整 rewrite**（不維持 Node hybrid） |
| Node 範圍 | **僅留前端 build**（vite/pnpm/lint），production binary **零 Node 依賴** |

### 重構後的目標架構
```
Tauri (Rust)  ──spawns──>  .NET 10 self-contained binary
     |                              |
     |  get_sidecar_port            |  HTTP POST /api/{controller}/{action}
     |  get_sidecar_token           |  WS /ws/export, /ws/import
     |  (兩個 Tauri command 不變)    |
Vue renderer  <─────────────────────
(零修改 — httpClient.ts / ipc-api/* 完全保留)
```

關鍵：**.NET 程序仍對 stdout 印 `READY:<port>:<token>`**，這樣 [src-tauri/src/sidecar.rs:112-122](src-tauri/src/sidecar.rs#L112) 完全不動。Rust 把 `node.exe` 換成 `antares-server.exe` 是唯一改動（一行 path 字串）。

---

## 整體執行策略

### A. 不採用 dual-sidecar 並行
原 roadmap 沒明說但暗示「Phase 2 一次切換」。經評估後決定**沿用一次切換**而非 N+1 sidecar 並行：
- **拒絕原因**：兩個 sidecar 同搶 5555 port、需要 path-based router 才能分流 75 endpoints、token/port discovery 複雜化、renderer 要改（破壞「零修改」鐵律）。
- **替代風險控管**：每 phase 結束都跑完整 e2e（`pnpm test:e2e e2e/mssql-*.spec.ts`）+ 手動驗證關鍵流程，**Node sidecar 在 master branch 一直可用直到 Phase 6 收工**，dev branch 上做 .NET 工作；任何 phase 失敗可 `git checkout master -- src/main/ scripts/build-sidecar.mjs ...` 復原。

### B. 工作分支策略
- `dev` 是工作枝；每 phase 結束開 PR 合回 `dev`，過 CI 才繼續下一 phase。
- **不開 worktree**（memory rule：「沒同意不要開 worktree」）。
- 每完成一個 phase commit `chore(net-migration): phase X complete — <gist>`，方便 bisect。

### C. 工程節奏
- Full-time：6–9 週；Half-time：13–17 週（沿用 roadmap 估值）。
- 每 phase 結束都有可驗證的 deliverable，不堆積。
- 暫不引入 ReadyToRun / NativeAOT；等 Phase 6 收尾才量測 cold-start，超過 3 秒再開 R2R。

---

## Phase 0：環境 + decision freeze（1 天）

### Deliverables
- 工作機 .NET 10 SDK 安裝 + `dotnet --version` 驗證
- 在 repo 根目錄建立 `src-net/` 但**保持空白**（佔位）
- 把這份 execution plan 搬到 `docs/superpowers/plans/`、commit
- 跟現有兩份 plan 一起做交叉檢核，記下衝突項

### 動到的檔案
- 新增：`docs/superpowers/plans/2026-05-03-net-sqlsugar-execution-plan.md`（這份）
- 新增：`src-net/.gitkeep`

### Verification gate
```bash
dotnet --list-sdks | grep -E '^10\.'
ls src-net/
```

---

## Phase 1：Furion scaffold + 共用基礎設施（2–3 天）

### Deliverables
1. `src-net/Antares.Server.csproj` — Furion 10 web host
2. 對 stdout 印 `READY:<port>:<token>` 的 startup hook（讓 Rust 端零變動）
3. **`X-Sidecar-Token` middleware**：所有非 `/health` route 拒絕無 token 請求；WS 也檢查 `?token=` query
4. **`{ status, response }` 全域 result filter**：把 controller return value 自動包進 envelope
5. `/health` endpoint
6. SqlSugar DI 註冊（`ISqlSugarClient` scoped service factory，per-connection）

### 新增檔案
```
src-net/
├── Antares.Server.csproj
├── Program.cs                      # Furion bootstrap
├── Startup.cs                      # services + middleware
├── Infrastructure/
│   ├── ReadyLineHook.cs            # IHostedService — print READY:<port>:<token>
│   ├── SidecarTokenMiddleware.cs   # X-Sidecar-Token + WS query check
│   ├── IpcResponseFilter.cs        # 全域包 { status, response }
│   ├── TokenGenerator.cs           # 32-byte hex per-launch
│   └── PortAllocator.cs            # dev=5555, release=random free port
├── Health/
│   └── HealthController.cs         # POST /api/health → { status: 'success' }
└── appsettings.json                # 預設 port + log level
```

### 修改檔案
- `package.json`：新增 `"sidecar:dev:net": "dotnet watch --project src-net/Antares.Server.csproj"` script（暫不替換既有 `sidecar:dev`）

### Verification gate
```bash
dotnet run --project src-net/Antares.Server.csproj &
PID=$!
# 等 stdout 印 READY:<port>:<token>
TOKEN=...  # 從 stdout 抓
curl -X POST http://127.0.0.1:5555/api/health -H "X-Sidecar-Token: $TOKEN" -d '{}' | jq .
# 預期：{ "status": "success", "response": { "ok": true } }
curl -X POST http://127.0.0.1:5555/api/health  # 無 token
# 預期：401
kill $PID
```

### 風險 + 緩解
- **Furion 預設 DynamicApi verb 自動 routing 跟我們的 RPC 風格不合**：所有 controller class 都標 `[ApiExplorerSettings(IgnoreApi = false)]` + `[Route("api/[controller]/[action]")]`，方法用 `[HttpPost]`，**不用** `[Get/Post]Mapping` 自動 verb。
- **Furion 啟動慢**：移除不需要的中間件（authentication/authorization 都不用，token middleware 自己做）、Logger 預設 Console（不寫檔）、Swagger 只在 `Environment == Development` 才啟用。

---

## Phase 2：Tauri sidecar binary swap（2 天）

### Deliverables
1. Rust 端把 `sidecar/node[.exe]` path 改指向 `sidecar/antares-server[.exe]`
2. `scripts/build-net-sidecar.mjs`：跨平台 publish .NET 自包含 binary
3. `scripts/stage-resources.mjs` 改成 stage .NET binary（移除 node + node_modules + workers）
4. `tauri.conf.json` + 三個 platform overlay 同步調整

### 修改檔案
| 檔案 | 動作 |
|------|------|
| [src-tauri/src/sidecar.rs](src-tauri/src/sidecar.rs) | line 69-87：binary path 改 `antares-server[.exe]`；stdout READY 解析不動 |
| [src-tauri/tauri.conf.json](src-tauri/tauri.conf.json) | `bundle.resources` 移除 `resources/sidecar/antares-server.cjs` / `workers/` / `node_modules`，改成 `resources/sidecar/antares-server[.exe]`（per-platform overlay 處理 .exe vs no-ext） |
| [src-tauri/tauri.windows.conf.json](src-tauri/tauri.windows.conf.json) | 移除 `resources/sidecar/node.exe`，加 `antares-server.exe` |
| [src-tauri/tauri.macos.conf.json](src-tauri/tauri.macos.conf.json) | 移除 `node`，加 `antares-server` |
| [src-tauri/tauri.linux.conf.json](src-tauri/tauri.linux.conf.json) | 移除 `node`，加 `antares-server` |
| [scripts/tauri-build.mjs](scripts/tauri-build.mjs) | 把 `build-sidecar.mjs` 呼叫換成 `build-net-sidecar.mjs` |

### 新增檔案
- `scripts/build-net-sidecar.mjs`
  ```js
  // 大綱：依 process.platform 決定 RID（win-x64/osx-x64/osx-arm64/linux-x64）
  // 執行 dotnet publish -c Release -r <RID> --self-contained -p:PublishSingleFile=true
  //                    -o sidecar/   src-net/Antares.Server.csproj
  // 輸出 sidecar/antares-server[.exe]
  ```

### Verification gate
```bash
pnpm sidecar:build:net   # 新 script
ls -lh sidecar/antares-server*
pnpm tauri:dev           # 整個 app 起得來
# 在 app 內：點 health endpoint 或新建一個假連線（測試/連線按鈕）→ 不能爆 token error
```

### 風險 + 緩解
- **Cold-start 拉長**：.NET 預估 1.5–3s vs Node 0.8s。Rust 端 `wait_for_ready` 預設等 5 秒（[sidecar.rs:108](src-tauri/src/sidecar.rs#L108) 一帶），確認 timeout ≥10 秒；超時就在 splash screen 提示「Server starting…」而非報錯。
- **macOS Gatekeeper 阻擋未簽名 binary**：CI 在 macOS job 加 codesign step；本機開發加 `codesign --force --deep --sign - sidecar/antares-server` 自簽。

---

## Phase 3：連線（Connection）routes（1 週）

### 對齊既有 5 endpoints
| Path | 對應 Node 檔 | .NET controller |
|------|----------|---------|
| `/api/connection/test` | `src/main/routes/connection.ts` | `Connection/TestAction.cs` |
| `/api/connection/connect` | 同上 | `Connection/ConnectAction.cs` |
| `/api/connection/abort` | 同上 | `Connection/AbortAction.cs` |
| `/api/connection/check` | 同上 | `Connection/CheckAction.cs` |
| `/api/connection/disconnect` | 同上 | `Connection/DisconnectAction.cs` |

### Deliverables
1. **`ISqlSugarClient` factory**：從前端傳來的連線參數（host/port/user/pwd/db/ssh tunnel/ssl options）動態 build SqlSugar `ConnectionConfig`，cache 在 `ConcurrentDictionary<string sessionId, ISqlSugarClient>`。
2. **SSH tunnel**：用 `Renci.SshNet` 建 local port forward（取代 `@fabio286/ssh2-promise`）
3. **SSL**：SqlSugar `ConnectionConfig.SqlSugarConfig.MoreSettings` + 各 DB 原生 connection string SSL options
4. 5 個 endpoints 1:1 實作

### 新增檔案
```
src-net/
├── Connections/
│   ├── ConnectionController.cs     # [Route("api/connection")] [HttpPost("test")]
│   ├── ConnectionService.cs        # 主要邏輯
│   ├── ConnectionRegistry.cs       # ConcurrentDictionary cache
│   └── SshTunnel.cs                # Renci.SshNet wrapper
├── Models/
│   ├── ConnectionParams.cs         # 對應 renderer 送來的 JSON
│   └── ConnectionResult.cs
```

### Verification gate
- 對 4 種 DB 各自 sanity test：
  - MySQL 8（無 SSH）
  - PostgreSQL 16（SSL required）
  - SQL Server 2022（Windows auth + SQL auth）
  - SQLite local file
- e2e：`pnpm test:e2e e2e/mssql-database-switch.spec.ts` 全綠

### 風險 + 緩解
- **`Renci.SshNet` 加密演算法支援不及 ssh2**（如 chacha20-poly1305@openssh.com、curve25519-sha256）：先用 OpenSSH server 對 4 種主流 cipher/KEX 做相容性測試；如果有缺，改用 `SSH.NET 2024.2.0`（pre-release）支援 modern algorithms，或 fallback 用 SSH `cmd` external process。
- **SqlSugar 連線 leak**：每個 controller action 結束後若 session expired/disposed，要從 registry 移除；加 `IDisposable` + idle timeout sweep。

---

## Phase 4：Schema routes（1.5–2 週）

### 對齊 16 endpoints + 2 WS streams
全部從 `src/main/routes/schema.ts` 對應到 `src-net/Schemas/SchemaController.cs`。完整列表見 [backend-inventory.md](docs/superpowers/plans/2026-05-03-backend-inventory.md)。

### 重點
1. **Schema discovery**（DB list、tables/views/triggers/routines/functions/schedulers list）
   - SqlSugar `DbMaintenance.GetTableInfoList()` / `GetViewInfoList()` 等是骨幹
   - 每個 list endpoint 都用 `DbMaintenance` + 必要時 fallback 到 raw SQL（SqlSugar 沒覆蓋的小角落）
2. **Schema 結構（getStructure）** — 對應 sidebar 的物件樹
3. **Collations / engines / variables** — 各 DB 一個 raw SQL，SqlSugar 沒抽象就直接 `Ado.GetDataTable`
4. **Export / Import schema (DDL dump)** — Phase 4-末尾才做（包含 WebSocket 推進度）

### 新增檔案（節錄）
```
src-net/
├── Schemas/
│   ├── SchemaController.cs              # 主 controller
│   ├── SchemaService.cs
│   ├── DatabaseDiscoveryService.cs      # tables/views/... 列表
│   ├── CollationProvider.cs             # 各 DB 的 raw SQL
│   ├── ExportSchemaService.cs           # WS /ws/export 的 DDL dump
│   └── ImportSchemaService.cs           # WS /ws/import 的 SQL replay
├── WebSockets/
│   ├── ExportSchemaHub.cs               # Furion 動態 WS endpoint
│   └── ImportSchemaHub.cs
```

### Verification gate
- 對 4 種 DB 載入 sidebar 物件樹完整無缺漏（手動）
- export schema 至 `.sql` 檔，再 import 回去 → 物件數量一致
- e2e tests pass

### 風險 + 緩解
- **WebSocket 推進度的訊息格式**：用 Node side 同樣的 `{ type: 'export-progress', payload: { table, percent, rowsExported } }` JSON。renderer 既有 listener（`ModalExportSchema.vue`、`ModalImportSchema.vue`）零修改。
- **DDL dump 格式 cross-DB 不一致**：保留 Node 既有 `Exporters/{Mysql,Pg,Mssql}Exporter.ts` 的 SQL 格式，C# port 時用 snapshot test 對齊（同一張表 dump 出來的 SQL 必須 byte-for-byte 一致）。

---

## Phase 5：Data + DDL routes（1.5 週，最高 ROI）

### 對齊 18 tables + 8 views + 5 triggers + 4 routines + 6 functions + 5 schedulers endpoints
這是 **migration 的最大 win 區**。原本 5 client 各自寫的 cascade DDL 邏輯，SqlSugar 一次解決。

### 重點
1. **`getTableData`** — pagination + filter + order；SqlSugar `Queryable<dynamic>().Where().OrderBy().ToPagedList()`
2. **`getTableColumns`、`getTableIndexes`、`getKeyUsage`** — `DbMaintenance.GetColumnInfosByTableName/GetIndexList/GetForeignKeys` 一行解掉
3. **drop column with cascade FK** — Phase 5 的關鍵：先 `GetForeignKeys()` 拿 inbound FK，前端 modal 確認後依序 drop FK → drop column
4. **`getTableDdl`** — `DbMaintenance.GetCreateTableSql()` 拿 DDL，跨 DB 一致

### 新增檔案
```
src-net/
├── Tables/
│   ├── TableController.cs
│   ├── TableQueryService.cs        # 資料 CRUD
│   ├── TableSchemaService.cs       # columns/indexes/checks/keys
│   ├── TableDdlService.cs          # CREATE/DROP/ALTER + cascade
│   └── CascadeFkResolver.cs        # 共用：GetForeignKeys → drop sequence
├── Views/...                        # (同樣模式)
├── Triggers/...
├── Routines/...
├── Functions/...
└── Schedulers/...
```

### Verification gate
- 對 4 種 DB 各做：建表 → 加索引 → 加 FK → drop column（觸發 cascade）→ 確認資料完整
- e2e：`pnpm test:e2e e2e/mssql-empty-table-header.spec.ts e2e/mssql-limit-guards.spec.ts`
- 比對 LOC：5 client 累計 7421 LOC（不含 BaseClient），Phase 5 結束時 .NET 版預估 ~2200 LOC（70% 削減）

### 風險 + 緩解
- **SqlSugar `DbMaintenance` 在 SQLite 上某些方法回傳 NotSupported**：每個方法呼叫前先 try-catch + fallback 到 raw SQL
- **同一 DDL 在 4 種 DB 的 SQL 文法差異**：用 `IDdlGenerator` 介面 + per-DB 實作，避開「在 SqlSuger 之上又寫 DB 判斷」的 anti-pattern

---

## Phase 6：剩餘 routes + workers（1.5–2 週）

### Deliverables
1. 剩餘小 routes：`databases (2)`、`users (1)`、`application (2)`、`ai (1)`
2. **Workers C# rewrite**（export/import）— 整個 worker 的真正大頭
3. AI translate-column endpoint（保留 Node side 對 Anthropic API 的呼叫邏輯，只換 HTTP client）

### Workers 實作策略
- **取消 worker thread 分離**：直接在 .NET 主進程跑 background `Task` + `IProgress<T>` + `Channel<T>`
  - 為什麼：.NET 的 GC + async/await 已經能處理長任務，不像 Node 需要 worker thread 才能不卡 event loop
  - 取消 worker process 簡化 IPC（不需要 named pipe / gRPC）
- **進度推送**：直接從 background task 寫到 WebSocket hub 的 channel，hub 廣播給所有訂閱的 renderer connection（用 `IsTaskActive` map 鍵 = `taskId`）
- **取消功能**：renderer 透過 `/api/export/cancel` POST 一個 `taskId` → service 設 `CancellationTokenSource`.Cancel()

### 新增檔案
```
src-net/
├── Workers/                          # 注意：不是 .NET worker process，是 background task 的 namespace
│   ├── ExportTaskService.cs
│   ├── ImportTaskService.cs
│   ├── TaskRegistry.cs               # taskId → CancellationTokenSource map
│   └── ProgressBroadcaster.cs        # 推進度到 WS hub
├── Exporters/                        # 對應 Node src/main/libs/exporters/
│   ├── BaseExporter.cs
│   ├── MysqlExporter.cs
│   ├── PgExporter.cs
│   └── MssqlExporter.cs
├── Importers/...
├── Databases/...
├── Users/...
└── Ai/...
```

### Verification gate
- export 1MB / 100MB / 1GB 表，對比 Node 版時間（不能慢超過 1.5x）
- import 同樣容量；中途 cancel 測試 lock 是否釋放
- AI translate-column 仍能呼叫 Anthropic API 並回傳

---

## Phase 7：Node 端清理 + CI 收尾（3–5 天）

### Deliverables
1. 刪除 `src/main/`（35 個檔）
2. 刪除 `scripts/build-sidecar.mjs`、`scripts/stage-resources.mjs` 的 transitive-dep BFS 邏輯（stage-resources 仍保留 .NET binary 的 stage 任務）
3. 從 `package.json` 移除 ~20 個 backend npm 套件（保留前端 deps）
4. **CI workflows 改 Node 下載 → .NET SDK setup**

### CI 改動範圍
| 檔案 | 改動 |
|------|------|
| [.github/workflows/test-build.yml](.github/workflows/test-build.yml) | 移除 4 個 "Download Node.js binary for ..." steps；改 1 個 `actions/setup-dotnet@v4` 帶 `dotnet-version: '10.x'`；保留 pnpm + node 給前端 build |
| [.github/workflows/release.yml](.github/workflows/release.yml) | 同上，4 個 steps → 1 個；signing flow 不變 |
| [.github/workflows/test-e2e-win.yml](.github/workflows/test-e2e-win.yml) | 同上 |
| [.gitignore](.gitignore) | 移除 `sidecar/node*` 行；新增 `sidecar/antares-server*`（不 commit binary） |

### 移除的 npm packages（從 package.json dependencies）
從 inventory 清點，預期移除 ~20 個，包括：
- `fastify` + `@fastify/*`
- `tsx`、`esbuild`（如果只是 backend 用，前端用 vite）
- `better-sqlite3`、`mysql2`、`pg`、`mssql`、`node-firebird`
- `ssh2`、`@fabio286/ssh2-promise`、`@heroku/socksv5`
- `bindings`、`file-uri-to-path`
- `@faker-js/faker`（worker 內用，已移到 C# Bogus）

完整名單在 [backend-inventory.md](docs/superpowers/plans/2026-05-03-backend-inventory.md)。

### Verification gate
```bash
# 全綠：前端、type-check、lint、e2e、build
pnpm lint && pnpm type-check && pnpm test:e2e
pnpm tauri:build  # 4 platforms 都過

# 安裝包尺寸對比
du -sh src-tauri/target/release/bundle/msi/*.msi
# 預期 30-40% 縮減 vs v0.8.x
```

---

## 風險登記簿（gaps the existing roadmap missed）

| ID | 風險 | 嚴重度 | 緩解 |
|----|-----|-------|-----|
| R1 | .NET cold-start > 3s | 中 | Phase 6 量測；超標就開 ReadyToRun (`<PublishReadyToRun>true</PublishReadyToRun>`)，再爆就上 NativeAOT |
| R2 | `Renci.SshNet` 不支援 chacha20-poly1305 等現代演算法 | 中 | Phase 3 做 cipher 相容性矩陣；缺項用 fallback library 或外部 `ssh` CLI |
| R3 | macOS Gatekeeper 拒絕未簽名 .NET binary | 高 | CI macOS job 加 codesign step；本機 dev 用 ad-hoc sign |
| R4 | SqlSugar 在 SQLite 某些 DbMaintenance 方法 NotSupported | 低 | per-call try-catch + raw SQL fallback |
| R5 | DDL dump 跨 DB 文法不一致導致 export 出來的 SQL 跟 Node 版不 byte-equal | 中 | 用 snapshot test 鎖定 SQL 格式 |
| R6 | Furion 全域 result filter 跟 ASP.NET Core ProblemDetails 衝突 | 低 | filter pipeline order 設 `Order = int.MinValue` 早於內建 |
| R7 | `X-Sidecar-Token` middleware 漏掉 WebSocket（middleware 不跑在 WS upgrade 階段） | 高 | WS endpoint 在 OnConnectedAsync 內手動驗 `?token=` query；單元測試覆蓋 |
| R8 | 8 個 CI Node-download steps 意外漏改 | 低 | 用 grep verify：`grep -rn "Download Node.js binary" .github/workflows/` 結果為空 |

---

## 不在這次 scope（明確排除）
- ❌ Firebird 支援（已斷捨離）
- ❌ Node sidecar 並行運行（dual-sidecar pattern 拒絕）
- ❌ 前端 / Tauri Rust 端任何邏輯改動（除了 sidecar.rs 的 binary path 字串）
- ❌ 新功能（這次只做 1:1 平移，新功能等 .NET 站穩）
- ❌ NativeAOT（先 R2R，看量測再決定）
- ❌ Renderer IPC 重構（保留 `{ status, response }` envelope）

---

## 驗證矩陣（Migration acceptance）

從 [backend-inventory.md](docs/superpowers/plans/2026-05-03-backend-inventory.md) 的 checklist 加上這份的 gates：

### Endpoint coverage（75 HTTP + 2 WS）
- [ ] connection: 5 endpoints
- [ ] schema: 16 + 2 WS（export/import）
- [ ] tables: 18
- [ ] views: 8
- [ ] triggers: 5
- [ ] routines: 4
- [ ] functions: 6
- [ ] schedulers: 5
- [ ] databases: 2
- [ ] users: 1
- [ ] application: 2
- [ ] ai: 1

### DB 覆蓋（4 種，Firebird 排除）
- [ ] MySQL 8.x — 全 endpoint 通過
- [ ] PostgreSQL 16 — 全 endpoint 通過
- [ ] SQL Server 2022 — 全 endpoint 通過 + 既有 3 個 e2e specs 全綠
- [ ] SQLite — 全 endpoint 通過

### Build / CI
- [ ] `pnpm tauri:build` 4 平台都成功
- [ ] 安裝包尺寸 < v0.8.x 70%
- [ ] CI 中 0 個 "Download Node.js binary" step（grep 驗證）
- [ ] `package.json` 中無 backend npm 套件（手動確認）

### Renderer 不變鐵律
- [ ] `src/renderer/` git diff 在整個 migration 期間 = 0（除非是同期不相關的 UI 修）
- [ ] `src/renderer/ipc-api/httpClient.ts` 不動
- [ ] `src-tauri/src/sidecar.rs` 只有 binary path 字串那一行改動

---

## 完成後的搬檔動作

Plan-mode 結束後執行：
```bash
mkdir -p docs/superpowers/plans/  # 已存在
mv "C:/Users/EDDIE/.claude/plans/misty-splashing-wall.md" \
   "docs/superpowers/plans/2026-05-03-net-sqlsugar-execution-plan.md"
git add docs/superpowers/plans/2026-05-03-net-sqlsugar-execution-plan.md
git commit -m "docs(plan): .NET 10 + SqlSugar execution plan with file-level detail"
```
