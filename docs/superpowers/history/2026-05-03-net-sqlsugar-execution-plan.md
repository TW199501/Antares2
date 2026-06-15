# .NET 10 + Furion + SqlSugar 後端遷移：可執行計畫（v4 — Admin.NET fork 戰略）

> **配套既有文件**:
> - `docs/superpowers/plans/2026-05-03-net-sqlsugar-migration.md` — 7-phase roadmap（概念層）
> - `docs/superpowers/plans/2026-05-03-backend-inventory.md` — 現狀清點（baseline）
>
> **參考架構**：`E:/source/platfrom-admin/`（Admin.NET.Core，Furion + SqlSugar 成熟範本）。
>
> **知識源**：`@elf-express/admin-net-mcp`（npm 已發布）— 把 Furion / SqlSugar / Admin.NET 慣例打包成 10 個 MCP tool，本計畫每個 phase 都註明「該查哪個 MCP tool」而非內聯說明 Furion 概念。

---

## 知識源整合：admin-net MCP Server

### 為什麼要整合
原 plan v2 把 Furion/SqlSugar 慣例內聯說明（例如 `IUnifyResultProvider` 用法、`IDynamicApiController` 結構），維護負擔大且容易跟上游 drift。改用 MCP server 把知識外部化：

- **實作期間 Claude 直接呼叫 MCP tool 取知識**，不必每次 session 重講 Furion
- **知識更新只需 `git pull` + `npm run build`**，計畫文件不變

### 可用 MCP Tools（在 antares2 也能用）
| Tool | 用在哪個 phase |
|------|-------------|
| `get_entity_guide` | Phase 5（連線 session 模型）、Phase 9-10（DTO） |
| `get_service_guide` | Phase 1, 5+（`IDynamicApiController` + `[ApiDescriptionSettings]` 樣板） |
| `get_sqlsugar_guide` | Phase 5+（連線、查詢、AOP、UnitOfWork） |
| `get_config_guide` | Phase 1（`IConfigurableOptions` + `Configuration/*.json`） |
| `get_plugin_guide` | （antares2 用不到，single csproj） |
| `get_event_guide` | Phase 13-14（背景任務跨服務溝通） |
| `get_attribute_guide` | 各 phase 用到 `[Idempotent]`、`[DataMask]` 時 |
| `get_vue_typescript_guide` | renderer 工作（不在這次 scope） |
| `search_knowledge` | 任何主題快速 keyword 搜尋（中英文） |
| `list_topics` | 不確定該查哪個時 |
| `list_furion_docs` | 列 25+ 章 Furion 教學手冊 |
| `get_furion_doc` | 拿 `06-1規範化接口`、`10-1-SqlSugar整合` 等深入文件 |

### 設定方式（Phase 0 deliverable）
在 antares2 的 `.claude/settings.json` 加（已驗證的 npm 版本）：
```json
{
  "mcpServers": {
    "admin-net": {
      "command": "npx",
      "args": ["-y", "@elf-express/admin-net-mcp"]
    }
  }
}
```
或本地路徑（離線環境）：
```json
{
  "mcpServers": {
    "admin-net": {
      "command": "node",
      "args": ["e:/source/platfrom-admin/.claude/mcp-server/dist/index.js"]
    }
  }
}
```

### 驗證
重啟 Claude Code 後 `/mcp` 應看到 `admin-net  ✓ connected  12 tools`。

### 風險（新增 R11）
- **MCP server 知識可能跟 Admin.NET upstream drift** → 緩解：commit 一份 `mcp-version-pin.txt` 記錄當下 npm version，每月驗證一次。

---

## Context

### 為什麼重構（與原 plan 一致）
1. **跨 DB DDL 一致性難題** — 5 個 client 各自 hand-code，共 7421 LOC。
2. **Inbound FK detection 痛點** — SqlSugar `DbMaintenance.GetForeignKeys()` 是這次遷移最大 ROI。
3. **Worker pool 散亂** — Node `worker_threads` 跨平台行為不穩。
4. **Bundle 體積** — Node sidecar + 52 transitive deps = ~200MB，.NET self-contained 預估 ~80MB。

### Locked Decisions（不再討論）
- ❌ Firebird、✅ .NET 10 LTS、✅ Furion 10、✅ SqlSugar 5
- ✅ 沿用 `{ status, response }` envelope + 5555 + `X-Sidecar-Token`，**renderer 0 修改**
- ✅ Workers C# rewrite、Node 僅留前端 build
- ✅ **Admin.NET fork 戰略 path A++**（self-grant 路徑）— 詳見下節
- ✅ **antares2 工具維持開源 MIT**（rename 評估中、命名保持中性）

### Admin.NET Fork 戰略（path A++ — self-grant）

#### 為什麼可行
antares2 跟 Admin.NET（`E:/source/platfrom-admin/`）的 copyright 都歸屬於使用者本人 / ELF International Express CO., LTD.（同一持有者）。經內部授權即可把 Admin.NET 程式碼直接搬入 antares2 並維持 MIT 公開。**不需要外部協商**。

#### 執行方式（一次性，Phase 0 完成）
在 antares2 root 建立 `LICENSE-ELF-GRANT.md`：
```markdown
# ELF Copyright Grant for antares2

ELF International Express CO., LTD., as the sole copyright holder of
Admin.NET (proprietary, copyright © 2024-2026), hereby grants the
antares2 project a perpetual, royalty-free, worldwide license to
incorporate, modify, and redistribute any portion of the Admin.NET
codebase under the antares2 project's applicable MIT license terms.

Granted: 2026-05-03
Authorized signatory: tw199501@elf.tw
```
之後 `LICENSE`（MIT）保留 Fabio 原作者 copyright（管 antares-sql 上游殘留部分）。Forked 進來的檔案頭部加單行註釋：
```csharp
// Adapted from Admin.NET (ELF, proprietary), relicensed to MIT for antares2
// per LICENSE-ELF-GRANT.md
```

#### Fork 範圍（從 Admin.NET 直接搬，不改寫）
| 來源 | LOC | 用在 phase | 改動量 |
|------|-----|-----------|-------|
| `Admin.NET.Core/Service/DataBase/SysDatabaseService.cs` | 1282 | Phase 6, 7, 8, 9, 10 | ~30%（移除 SysTenant 多租戶邏輯，改 stateless per-request 模型） |
| `Admin.NET.Core/Service/APIJSON/SelectTable.cs` | 974 | Phase 9（getTableData 動態 WHERE） | ~50%（移除 IdentityService 權限檢查、保留 ProcessWhere/ProcessOrder/ProcessGroup） |
| `Admin.NET.Core/Service/APIJSON/TableMapper.cs` | 28 | Phase 9 | ~0%（直接搬） |
| `Admin.NET.Core/SqlSugar/SqlSugarSetup.cs:67-113`（`SetDbConfig`） | ~50 | Phase 5 | ~20%（拿掉 ConfigId / SysTenant lookup，改 per-request build） |
| `Admin.NET.Core/Service/DataBase/Dto/*.cs` | ~150 | Phase 5-10 | ~10%（命名對齊、移除 Tenant 屬性） |

**估省 6-11 天**（中位 8 天）。實際下修工期 56 天 → **48-50 天**。

#### 不 fork 的部分
- `SysCodeGenService.cs` — 不同 paradigm（template-driven code 產生），用不到
- `IdentityService` / 權限模型 — antares2 是 stateless 桌面工具，不需要登入
- 多租戶基礎設施（`AsTenant().GetConnectionScope()`）— antares2 是「每個 HTTP 請求附帶連線參數」模型

### 直接上游通道（人脈 fallback）

使用者跟 **Furion + SqlSugar 作者有直接關係**，這是比 MCP 知識源更高一層的 escalation channel：

| 風險項 | 原預設 fallback | 新 fallback |
|-------|---------------|-----------|
| R2（Renci.SshNet cipher 缺現代演算法） | 自行 fallback 到外部 ssh CLI | 先問 SSH.NET 是否計劃補；不行再退 |
| R4（SqlSugar SQLite DbMaintenance NotSupported） | per-call try-catch + raw SQL | 直接問 SqlSugar 作者要 patch 或 PR |
| R6（Furion result filter 跟 ProblemDetails 衝突） | 設 `Order = int.MinValue` 蓋過去 | 問 Furion 作者該 phase 的正確設計 |
| R10（openapi-typescript 對 Furion polymorphicSchema 支援） | 退路 nswag | 問 Furion 作者建議的 codegen 工具 |

對應 R2 / R4 / R6 / R10 的嚴重度從「中」全部下調為「低」。

### Rename 中性原則（rename 評估中）
工具名 antares2 將來可能改名，所以新建命名一律保持品牌中性：
- 後端目錄 `server/`（已套用、不要 `antares-server/` 或 `src-antares/`）
- C# class 名 `SidecarServer`、`ConnectionService`、`SchemaService`（不要 `Antares*` 前綴）
- C# namespace 用 `Server`、`Server.Connections` 等通用名（不要 `Antares.Server`）
- csproj 名 `Server.csproj`（從 `Antares.Server.csproj` 改）

實際 rename 發生時，搜尋取代範圍最小。Tauri identifier `com.tw199501.antares2` 跟 Cargo crate `antares2` 暫不動（rename 評估完才動，影響使用者 AppData 路徑）。

### 從 Admin.NET 採用的 5 個關鍵慣例（**這版新增**）
| Admin.NET 慣例 | antares2 採用 | 影響 phase |
|--------------|-------------|----------|
| `IUnifyResultProvider` 全域信封 | 改用 `SidecarResultProvider`（取代手寫 filter） | Phase 2 |
| `IDynamicApiController` + `[ApiDescriptionSettings(Name=…), HttpPost]` | 擁抱自動 routing，用 attribute 客製 | Phase 1, 5+ |
| `Configuration/*.json` 自動 scan | `appsettings.json` 設 `ConfigurationScanDirectories` | Phase 1 |
| Swagger codegen 驅動前端型別 | **新 Phase 3 專做這件事**（消滅 R9） | Phase 3 |
| 5-project 拆分（Core/App/Web.Core/Web.Entry/Test） | **不採用**（單 csproj，sidecar 啟動延遲考量） | — |

### 重構後架構
```
Tauri (Rust)  ──spawns──>  .NET 10 self-contained binary
     |                              |
     |  get_sidecar_port            |  HTTP POST /api/{controller}/{action}
     |  get_sidecar_token           |  WS /ws/export, /ws/import
     |  (兩個 Tauri command 不變)    |
Vue renderer  <─────────────────────
(零修改 — httpClient.ts / ipc-api/* 完全保留)
```
**.NET 程序仍對 stdout 印 `READY:<port>:<token>`** → [src-tauri/src/sidecar.rs:112-122](src-tauri/src/sidecar.rs#L112) 不動。

---

## 整體執行策略

### A. 不採用 dual-sidecar 並行
單次切換（Phase 4）。任何 phase 失敗可 `git checkout master -- src/main/ scripts/build-sidecar.mjs ...` 回滾。

### B. 工作分支
- `dev` 工作枝；每 phase commit `chore(net-migration): phase X complete — <gist>`
- **不開 worktree**（memory 規範）

### C. 工程節奏
- **Full-time**：8 週、**Half-time**：16 週（與原估值一致，只是分得更細）
- 每 phase 末尾必有可驗證的 deliverable + verification gate

---

## Phase 總覽

> **Fork 註記**：✓ 表示該 phase 主要是 fork Admin.NET 程式碼 + 改寫；其餘 phase 是 antares2 專屬、無對應可 fork。

| # | 主題 | 工期 | LOC delta | 風險 | Fork? | 驗證 gate |
|---|-----|------|-----------|------|------|----------|
| 0 | 環境 + decision freeze + `LICENSE-ELF-GRANT.md` | 1d | 0 | — | — | `dotnet --list-sdks` + grant 檔 commit |
| 1 | Furion scaffold + `Configuration/` 慣例 | 2d | +500 | 低 | — | `/health` 回 200 |
| 2 | IUnifyResultProvider + token middleware + READY hook | 2d | +400 | 中（R7） | — | curl 帶 token vs 不帶 token 各跑一次 |
| 3 | **Swagger codegen pipeline**（消滅 R9） | 1d | +200 | 低 | — | 跑 codegen → diff `src/common/api-generated/` |
| 4 | Tauri sidecar binary swap | 2d | -100 | 中（R3） | — | `pnpm tauri:dev` 起得來 |
| 5 | Connection routes (5 endpoints) + SSH tunnel | **5d**（-2d） | +600 | **低**（R2 下調） | ✓ `SetDbConfig` | 4 種 DB 都連得起來 |
| 6 | Schema discovery（list 類） | **3d**（-1d） | +250 | 低 | ✓ `SysDatabaseService.GetTableList/ColumnList` | sidebar 物件樹完整 |
| 7 | Schema metadata（collations/engines/variables/getStructure） | 3d | +300 | 低 | 部分 ✓ | 各 DB 屬性面板正常 |
| 8 | Schema DDL（create/update/delete schema） | **1d**（-1d） | +150 | 中 | ✓ `AddColumn/DeleteColumn/UpdateColumn` | 建 schema → drop 流程通 |
| 9 | Tables — read endpoints（columns/data/indexes/keys/ddl…）| **5d**（-2d） | +650 | 中（fork 後降一級） | ✓ `QuerySelect` + `APIJSON.SelectTable` | 4 DB 全 e2e |
| 10 | Tables — DDL + cascade FK resolver（**最高 ROI**） | **3d**（-1d） | +400 | 高 | ✓ `ExportTableSchema` patterns | drop column with cascade 通 |
| 11 | Views + Triggers + Routines + Functions + Schedulers | 1w | +1000 | 中 | — | 各物件 CRUD 通 |
| 12 | Databases + Users + Application + AI（小尾巴） | 2d | +200 | 低 | — | 各小 endpoint 通 |
| 13 | Export task service + WS 進度推送 | 4d | +600 | 高（R5） | — | 1MB / 100MB / 1GB 表 dump |
| 14 | Import task service + cancel + AI translate-column | 3d | +400 | 高 | — | replay + 中途 cancel |
| 15 | Node 清理 + CI swap + 最終驗收 | 3-5d | -10K | 低 | — | 4 平台 build + 安裝包縮 30%+ |

**累計**：**48 天 ≈ 7 週 full-time**（從 v3 的 56 天下修 8 天，主要因 Phase 5/6/8/9/10 從 Admin.NET fork）

---

## Phase 0 — 環境 + decision freeze + 法律對齊（1 天）

### Deliverables
- 工作機 .NET 10 SDK 確認
- **在 antares2 `.claude/settings.json` 掛 `admin-net` MCP server**（見上方「知識源整合」段）
- 在 repo 根目錄建立空 `server/`（佔位）
- **新增 `LICENSE-ELF-GRANT.md`**（self-grant 文件，見 Admin.NET Fork 戰略段）
- 把這份 plan v4 commit 進去
- 跟 roadmap + inventory 交叉檢核衝突項
- commit `mcp-version-pin.txt` 記錄當下 `@elf-express/admin-net-mcp` npm version（R11 緩解）

### 動到的檔案
- 修改：`docs/superpowers/plans/2026-05-03-net-sqlsugar-execution-plan.md`（這份）
- 新增：`server/.gitkeep`
- 新增：**`LICENSE-ELF-GRANT.md`**（ELF → antares2 內部授權證明）
- 修改：`.claude/settings.json`（加 mcpServers）
- 新增：`mcp-version-pin.txt`（紀錄 MCP server npm version）

### Verification gate
```bash
dotnet --list-sdks | grep -E '^10\.'
ls server/
# Claude Code 內 /mcp 應該看到 admin-net  ✓ connected  12 tools
# Claude 執行：list_topics → 應回 8 主題；list_furion_docs → 應回 25+ 檔
```

---

## Phase 1 — Furion scaffold + Configuration 慣例（2 天）

### Deliverables
1. `server/Antares.Server.csproj` — Furion 10 + SqlSugar 5 + Renci.SshNet
2. `Program.cs`（Furion `Serve.Run` 風格）
3. `Startup.cs`（services + middleware pipeline）
4. `Configuration/` 子資料夾自動 scan
5. `/api/health` action 用 `IDynamicApiController`

### 新增檔案
```
server/
├── Antares.Server.csproj
├── Program.cs                          # Serve.Run(...) 入口
├── Startup.cs                          # IWebComponent.Load
├── appsettings.json                    # ConfigurationScanDirectories: ["Configuration"]
├── Configuration/
│   ├── Server.json                     # port、READY 行格式、log level
│   └── Logging.json
├── Health/
│   └── HealthService.cs                # IDynamicApiController + ITransient
└── Properties/launchSettings.json
```

### `HealthService.cs` 範例（採用 Admin.NET 慣例）
```csharp
[ApiDescriptionSettings("Health", Name = "health", Order = 1000)]
public class HealthService : IDynamicApiController, ITransient
{
    [HttpPost, AllowAnonymous]
    public HealthResult Check() => new() { Ok = true, Version = App.Configuration["Version"] };
}
```

### 對應 Admin.NET 參考 + MCP tool
- 程式碼樣板：[Admin.NET.Web.Entry/Program.cs](E:/source/platfrom-admin/Admin.NET.Web.Entry/Program.cs)、[Admin.NET.Web.Core/Startup.cs](E:/source/platfrom-admin/Admin.NET.Web.Core/Startup.cs)、[Admin.NET.Application/Configuration/](E:/source/platfrom-admin/Admin.NET.Application/Configuration/)
- **MCP 查詢**（實作期間呼叫）：
  - `get_service_guide` — `IDynamicApiController` + `[ApiDescriptionSettings]` 完整樣板
  - `get_config_guide` — `IConfigurableOptions` + `Configuration/*.json` 自動 scan 細節
  - `get_furion_doc 04-1-配置` / `04-2-選項` — Furion 配置系統深入解說
  - `get_furion_doc 05-1-動態WebAPI` — `IDynamicApiController` 完整教學

### Verification gate
```bash
dotnet run --project server/Antares.Server.csproj &
curl -X POST http://127.0.0.1:5555/api/health -d '{}'
# 期待：{ "status": "success", "response": { "ok": true, "version": "..." } }
# （envelope 在 Phase 2 才上，這裡先 raw）
```

---

## Phase 2 — IUnifyResultProvider + Token Middleware + READY hook（2 天）

### Deliverables
1. **`SidecarResultProvider`** 實作 `IUnifyResultProvider`（全域包 `{ status, response }`）
2. **`SidecarTokenMiddleware`** — `X-Sidecar-Token` 驗證
3. **WebSocket token 防漏**（R7）— 在 `OnConnectedAsync` 額外驗 `?token=` query
4. **`ReadyLineHook`** `IHostedService` — 對 stdout 印 `READY:<port>:<token>`

### 新增檔案
```
server/Infrastructure/
├── SidecarResultProvider.cs          # IUnifyResultProvider
├── SidecarResultModel.cs             # { status, response } DTO
├── SidecarTokenMiddleware.cs         # X-Sidecar-Token middleware
├── WebSocketTokenAuthenticator.cs    # WS upgrade 階段驗 query token
├── ReadyLineHook.cs                  # IHostedService → stdout READY:port:token
├── TokenGenerator.cs                 # per-launch 32-byte hex
└── PortAllocator.cs                  # dev=5555 / release=random free
```

### `SidecarResultProvider.cs` 骨架（套 Admin.NET 樣板）
```csharp
[UnifyModel(typeof(SidecarResult<>))]
public class SidecarResultProvider : IUnifyResultProvider
{
    public IActionResult OnSucceeded(ActionExecutedContext ctx, object data)
        => new JsonResult(new SidecarResult<object> { Status = "success", Response = data });

    public IActionResult OnException(ExceptionContext ctx, ExceptionMetadata meta)
        => new JsonResult(new SidecarResult<object>
           { Status = "error", Response = ctx.Exception.Message });

    public IActionResult OnAuthorizeException(AuthorizationFilterContext ctx, ExceptionMetadata meta)
        => new JsonResult(new SidecarResult<object> { Status = "error", Response = "401" });

    public IActionResult OnValidateFailed(ActionExecutingContext ctx, ValidationMetadata meta)
        => new JsonResult(new SidecarResult<object>
           { Status = "error", Response = string.Join(';', meta.ValidationResult) });
}
```

### Startup.cs 註冊（一行）
```csharp
services.AddInjectWithUnifyResult<SidecarResultProvider>();
```

### 對應 Admin.NET 參考 + MCP tool
- 程式碼樣板：[Admin.NET.Core/Utils/AdminResultProvider.cs](E:/source/platfrom-admin/Admin.NET.Core/Utils/AdminResultProvider.cs)（整支照抄改名）、[Admin.NET.Web.Core/Startup.cs:111](E:/source/platfrom-admin/Admin.NET.Web.Core/Startup.cs#L111)（註冊 line）
- **MCP 查詢**：
  - `get_furion_doc 06-1規範化接口` — `IUnifyResultProvider` 完整理論 + 範例
  - `get_furion_doc 05-3-篩選器攔截器AOP` — middleware 與 filter 的 pipeline 順序差異
  - `get_furion_doc 07-友好例外處理` — `OnException` 攔截法，避免 stack trace 外洩

### Verification gate
```bash
# 1) 帶 token：成功包封
TOKEN=$(grep -oP 'READY:\d+:\K[a-f0-9]+' < <(dotnet run --project server/Antares.Server.csproj &))
curl -X POST http://127.0.0.1:5555/api/health -H "X-Sidecar-Token: $TOKEN" -d '{}' | jq .
# 預期：{"status":"success","response":{"ok":true,...}}

# 2) 不帶 token：401
curl -X POST http://127.0.0.1:5555/api/health -d '{}' -i | head -1
# 預期：HTTP/1.1 401

# 3) WS 不帶 token：拒絕（測 R7 修補）
wscat -c "ws://127.0.0.1:5555/ws/export"
# 預期：connection refused / 4001 close code
```

---

## Phase 3 — Swagger Codegen Pipeline（1 天）

### 為什麼需要這個 phase
原 plan 的 R9「沒有 API schema、type 易 drift」風險。Admin.NET 的解法是 **Swagger codegen → 自動產 TypeScript axios client + models**。我們 antares2 雖然不全套（不換 httpClient.ts），但可以**用 codegen 產 type definition** 取代手寫 `src/common/interfaces/`。

### Deliverables
1. `server/` Swagger 啟用（dev mode 才掛 `app.UseSwaggerUI()`）
2. `scripts/codegen-api-types.mjs` — 用 `openapi-typescript` 把 swagger.json 編譯成純 TypeScript type
3. `src/common/api-generated/` 自動產出（gitignored，CI 跑前先 generate）
4. 至少一個 controller（`HealthService`）的 type 從 codegen 流程出來，驗證 pipeline

### 新增檔案
```
scripts/
└── codegen-api-types.mjs           # 跑 openapi-typescript

src/common/api-generated/           # gitignored
├── .gitkeep
├── health.d.ts                     # 從 Swagger 產的 type
└── (Phase 5+ 會持續加)
```

### 修改檔案
- `.gitignore`：新增 `src/common/api-generated/`（除了 `.gitkeep`）
- `package.json`：新增 `"codegen:api": "node scripts/codegen-api-types.mjs"`
- CI workflows：build 前跑 `pnpm codegen:api`

### 對應 Admin.NET 參考
- [Web/api_build/build.bat](E:/source/platfrom-admin/Web/api_build/build.bat) — Java swagger-codegen 範本
- [Web/src/api-services/](E:/source/platfrom-admin/Web/src/api-services/) — 60+ generated 檔範例

### Verification gate
```bash
pnpm codegen:api
ls src/common/api-generated/health.d.ts
pnpm type-check  # generated type 不能讓 type-check 變紅
```

### 風險
- **R9 → 已解決**：Swagger codegen 接管 type sync
- **新 R10**：openapi-typescript 對 Furion 的 `polymorphicSchema` 支援度不確定 → 退路：直接用 `nswag` 改產 raw TS interfaces

---

## Phase 4 — Tauri Sidecar Binary Swap（2 天）

### Deliverables
1. `scripts/build-net-sidecar.mjs` — 跨平台 `dotnet publish`
2. `scripts/stage-resources.mjs` 改 stage `.NET binary`（移除 node + node_modules + workers BFS）
3. Rust `sidecar.rs` 改一行 binary path
4. `tauri.conf.json` + 3 個 platform overlay 同步

### 修改檔案
| 檔 | 動作 |
|---|------|
| [src-tauri/src/sidecar.rs:69-87](src-tauri/src/sidecar.rs#L69) | path 字串改 `antares-server[.exe]` |
| [src-tauri/tauri.conf.json](src-tauri/tauri.conf.json) | bundle.resources 移除 cjs/workers/node_modules |
| 三個 platform overlay | binary 名 swap |
| [scripts/tauri-build.mjs](scripts/tauri-build.mjs) | 呼叫換成 build-net-sidecar |

### 新增 `scripts/build-net-sidecar.mjs` 大綱
```text
1. 偵測 process.platform / process.arch → 選 RID:
   win32 → win-x64
   darwin + arm64 → osx-arm64
   darwin + x64 → osx-x64
   linux → linux-x64
2. 用 Node 的 spawn (execFile 安全版) 執行：
   dotnet publish server/Antares.Server.csproj
     -c Release -r <RID> --self-contained
     -p:PublishSingleFile=true
     -o sidecar/
3. 預期輸出：sidecar/antares-server[.exe]
```
（實作時用 `child_process.spawn` 或 `execFile`，避免 shell injection；不用 `exec(...)`）

### Verification gate
```bash
pnpm sidecar:build:net
ls -lh sidecar/antares-server*  # 預期 ~80MB
pnpm tauri:dev                   # 整個 app 起得來、connection panel 載入
```

### 風險
- **R1 cold-start**：.NET 預估 1.5–3s（vs Node 0.8s）。確認 Rust `wait_for_ready` 至少等 10 秒
- **R3 macOS Gatekeeper**：CI macOS job 加 `codesign` step；本機 `codesign --force --deep --sign - sidecar/antares-server`

---

## Phase 5 — Connection Routes + SSH Tunnel（1 週）

### 對齊既有 5 endpoints
| Path | Node 檔 | .NET service |
|------|---------|--------------|
| `/api/connection/test` | [src/main/routes/connection.ts](src/main/routes/connection.ts) | `ConnectionService.Test` |
| `/api/connection/connect` | 同上 | `ConnectionService.Connect` |
| `/api/connection/abort` | 同上 | `ConnectionService.Abort` |
| `/api/connection/check` | 同上 | `ConnectionService.Check` |
| `/api/connection/disconnect` | 同上 | `ConnectionService.Disconnect` |

### Deliverables
1. **`ConnectionService : IDynamicApiController`** — 5 個 action（namespace `Server.Connections`，class 名不帶 Antares）
2. **`ISqlSugarClient` factory** — **fork** `Admin.NET.Core/SqlSugar/SqlSugarSetup.cs:67-113` 的 `SetDbConfig` pattern；改寫 ~20%：拿掉 ConfigId / SysTenant lookup，改 per-request build from renderer params
3. **`ConnectionRegistry`** — `ConcurrentDictionary<sessionId, ISqlSugarClient>` cache + idle timeout sweep（自寫，Admin.NET 是預設配置 pool 模型，跟我們不同）
4. **`SshTunnelService`** — `Renci.SshNet` local port forward
5. **SSL 設定**：MySQL/PG/MSSQL 的 connection string SSL options

### 新增檔案
```
server/
├── Connections/
│   ├── ConnectionService.cs            # 5 actions
│   ├── ConnectionRegistry.cs           # 連線快取
│   ├── ConnectionConfigBuilder.cs      # SqlSugar ConnectionConfig 動態組
│   └── SshTunnelService.cs             # Renci.SshNet wrapper
└── Models/Connection/
    ├── ConnectionParamsDto.cs
    ├── ConnectionResultDto.cs
    └── SshConfigDto.cs
```

### `ConnectionService.cs` 骨架
```csharp
[ApiDescriptionSettings("Connection", Order = 100)]
public class ConnectionService(ConnectionRegistry registry, SshTunnelService ssh)
    : IDynamicApiController, ITransient
{
    [HttpPost, ApiDescriptionSettings(Name = "test")]
    public async Task<ConnectionResultDto> Test(ConnectionParamsDto p) { ... }

    [HttpPost, ApiDescriptionSettings(Name = "connect")]
    public async Task<ConnectionResultDto> Connect(ConnectionParamsDto p) { ... }

    [HttpPost, ApiDescriptionSettings(Name = "abort")]
    public async Task<bool> Abort(SessionDto s) { ... }

    [HttpPost, ApiDescriptionSettings(Name = "check")]
    public async Task<CheckResultDto> Check(SessionDto s) { ... }

    [HttpPost, ApiDescriptionSettings(Name = "disconnect")]
    public async Task<bool> Disconnect(SessionDto s) { ... }
}
```

### 對應 Admin.NET 參考 + MCP tool
- 程式碼樣板：[Admin.NET.Core/Service/Auth/SysAuthService.cs](E:/source/platfrom-admin/Admin.NET.Core/Service/Auth/SysAuthService.cs)（service base）、[Admin.NET.Core/SqlSugar/SqlSugarSetup.cs](E:/source/platfrom-admin/Admin.NET.Core/SqlSugar/SqlSugarSetup.cs)（ConnectionConfig builder）
- **MCP 查詢**：
  - `get_service_guide` — service class 完整 CRUD 樣板
  - `get_sqlsugar_guide` — Repository 注入、AOP 自動填充、`ISqlSugarClient` factory
  - `get_furion_doc 10-1-SqlSugar整合` — Furion 端 SqlSugar 整合最佳實踐
  - `get_furion_doc 11-SaaS 多租戶筆記` — 多 DB 動態切換的範本（雖然 antares2 不是多租戶，但「per-request 切 DB」邏輯一樣）
  - `search_knowledge "ConnectionConfig"` — 找散落各文件的相關段落

### Verification gate
- 4 種 DB 各自手動 sanity test（MySQL 8、PG 16、MSSQL 2022、SQLite）
- e2e：`pnpm test:e2e e2e/mssql-database-switch.spec.ts` 全綠
- SSH tunnel：手動連有 SSH 跳板的 PG 機器

### 風險
- **R2 Renci.SshNet cipher** — 先做 OpenSSH cipher 矩陣（aes256-ctr / chacha20-poly1305 / curve25519-sha256）
- **連線 leak** — `ConnectionRegistry` 必須有 idle sweep（30 分鐘無活動踢掉）

---

## Phase 6 — Schema Discovery（List 類，3 天，**fork ✓**）

### 對齊 endpoints
- `/api/databases/getDatabases`
- `/api/schema/getStructure`（sidebar 物件樹用）
- `/api/{tables,views,triggers,routines,functions,schedulers}/getInformations` 系列

### Deliverables
- **fork** `Admin.NET.Core/Service/DataBase/SysDatabaseService.cs:471` (`GetTableList`) → `SchemaService.GetTables()`
- **fork** `Admin.NET.Core/Service/DataBase/SysDatabaseService.cs:214` (`GetColumnList`) → `SchemaService.GetColumns()`
- 改寫 ~30%：拿掉 `configId` 參數（改用 per-request `ISqlSugarClient`）、移除 SysTenant 查詢、保留 `db.DbMaintenance.GetTableInfoList(false)` / `GetColumnInfosByTableName(tableName)` 核心邏輯
- 不在 SqlSugar 抽象內的（schedulers、routines metadata）→ raw SQL fallback per-DB

### 新增檔案
```
server/Schemas/
├── SchemaService.cs                   # fork: SysDatabaseService 的 list 部分
├── ObjectListProvider.cs              # SqlSugar DbMaintenance + per-DB fallback
└── SchemaTreeBuilder.cs               # sidebar tree shape 對齊 renderer 期望
```

### Fork 標記
**保留**：`db.DbMaintenance.GetTableInfoList()` / `GetViewInfoList()` 等核心查詢、entity attribute 過濾邏輯
**移除**：SysTenant lookup、ConfigId 參數、權限檢查
**改名**：`SysDatabaseService` → `SchemaService`（去 Sys 前綴）

### Verification gate
- 4 DB 載入 sidebar：tables / views / triggers / routines / functions / schedulers 數量正確
- 跟 Node 版同 DB 跑 → object 數量必須 byte-identical

---

## Phase 7 — Schema Metadata（3 天）

### 對齊 endpoints
- `/api/schema/getCollations`
- `/api/schema/getDatabaseCollation`
- `/api/schema/getEngines`（MySQL only）
- `/api/schema/getVariables`

### Deliverables
- 各 metadata endpoint per-DB 一個 raw SQL（SqlSugar 不抽象）
- 用 `db.Ado.GetDataTable(sql)` 取資料、再 map 到 DTO

### 新增檔案
```
server/Schemas/
├── SchemaMetadataService.cs
├── CollationProvider/
│   ├── MySqlCollations.cs
│   ├── PgCollations.cs
│   ├── MssqlCollations.cs
│   └── SqliteCollations.cs            # SQLite 沒 collation 概念，回空陣列
└── EngineProvider/
    └── MySqlEngines.cs                # 僅 MySQL 有意義
```

### Verification gate
- 在 MySQL 開新 DB 流程能看到 collation dropdown
- PG/MSSQL/SQLite 屬性面板正常

---

## Phase 8 — Schema DDL（1 天，**fork ✓**）

### 對齊 endpoints
- `/api/schema/createSchema`
- `/api/schema/updateSchema`
- `/api/schema/deleteSchema`

### Deliverables
- **fork** `SysDatabaseService` 的 `AddColumn` / `DeleteColumn` / `UpdateColumn` 三個 action 的 DDL 構造邏輯
- 改寫：把 column-level 邏輯放大到 schema-level（CREATE/DROP DATABASE）；用 `DbMaintenance.CreateDatabase()` / `DropDatabase()` 為主
- 跨 DB 文法差異用 `IDdlGenerator` 介面 + per-DB 實作（自寫，Admin.NET 沒這層抽象）

### Verification gate
- 4 DB 各做：建 schema → 改 collation → drop schema 流程通

---

## Phase 9 — Tables Read Endpoints（1 週）

### 對齊 9 個 read endpoints
- `getColumns`、`getData`、`getCount`、`getOptions`、`getIndexes`、`getChecks`、`getDdl`、`getKeyUsage`、`searchColumns`

### Deliverables（**heavy fork ✓**）
1. **`getTableData`** — **fork** `Admin.NET.Core/Service/APIJSON/SelectTable.cs` 的 `ProcessWhere:506-556`、`ProcessOrder`、`PrcessGroup`、`ProcessHaving` 完整 fluent 動態查詢樣板。改寫 ~50%：移除 `IdentityService.GetSelectRole()` 權限檢查、移除 `@ColumnAlias` 角色過濾、保留 `ConditionalModel` 構造邏輯。+ **fork** `SysDatabaseService:1124-1168` 的 `QuerySelect` 安全 SELECT 樣板
2. **`getTableColumns`** — **fork** `SysDatabaseService:214` `GetColumnList` 邏輯（已在 Phase 6 對應，這裡共用）
3. **`getTableIndexes`** — `DbMaintenance.GetIndexList()` + per-DB fallback for SQL Server filtered indexes（自寫）
4. **`getTableDdl`** — `DbMaintenance.GetCreateTableSql()`（這是最大 win）
5. **`getKeyUsage`** — **inbound + outbound FK 都要**，`DbMaintenance.GetForeignKeys()` + reverse query

### 新增檔案
```
server/Tables/
├── TableQueryService.cs               # fork: APIJSON SelectTable 動態查詢 + QuerySelect 安全 SELECT
├── TableSchemaService.cs              # columns / indexes / checks / keys
├── TableDdlReadService.cs             # getDdl
├── TableOptionsProvider.cs            # MySQL engine/charset/comment 等
├── ForeignKeyResolver.cs              # inbound + outbound FK 探測
├── ConditionalModelBuilder.cs         # fork: APIJSON ProcessWhere ConditionalModel pattern
└── DynamicQueryDsl.cs                 # fork: APIJSON @column / @order / @group directives
```

### Fork 標記
**從 `Admin.NET.Core/Service/APIJSON/SelectTable.cs` 搬**：
- `SugarQueryable()` lines 422-454（建構 query pipeline）
- `ProcessColumn()` lines 429-496（欄位選擇 + alias）
- `ProcessWhere()` lines 506-556（動態 WHERE 構造，**這是核心**）
- `ProcessOrder()`、`PrcessGroup()`、`ProcessHaving()`（排序、分組、having）
- `TableMapper.cs` 整支 28 LOC 直接搬

**改寫**：
- 移除 `IdentityService.GetSelectRole()` 角色檢查（`SelectTable.cs:61` 整段）
- 移除 `@MenuId` 等管理介面整合
- SQL injection 防護片段（`SelectTable.cs:839-872`）保留並用 `SugarParameter` 包裝

### 對應 Admin.NET 參考 + MCP tool
- 程式碼樣板：Admin.NET 是用自家 entity，沒有直接對應。但 `Queryable<dynamic>` 樣板可以參考 [Admin.NET.Core/Service/User/SysUserService.cs](E:/source/platfrom-admin/Admin.NET.Core/Service/User/SysUserService.cs)
- **MCP 查詢**：
  - `get_sqlsugar_guide` — `Queryable` 鏈式語法、分頁、排序
  - `get_furion_doc SQL分頁查詢`（在 SqlSugar_Docs 子目錄）— 同步/非同步分頁的差異
  - `get_furion_doc Where用法` / `Select用法` / `OrderBY` — 各別深入文件
  - `search_knowledge "GetForeignKeys"` — DbMaintenance FK 探測（這是 Phase 10 cascade 核心）
  - `get_furion_doc SQL注入防護`（SqlSugar_Docs 子目錄）— 對齊 searchColumns 收緊（見下）

### 安全強化（順手收掉的 legacy 弱點）
**搬移 `searchColumns` 時收緊 SQL injection 防護**：
- 現況：[MySQLClient.ts:568](src/main/libs/clients/MySQLClient.ts#L568) 用 `search.replace(/'/g, '\'\'')` 手動 escape — 安全但不嚴謹（依賴單一 char escaping，未來改 SQL 引擎或加新 sanitize 路徑容易破功）
- 改法：.NET 版改用 SqlSugar parameterized query
  - `db.Ado.GetDataTable("... LIKE @kw", new SugarParameter("@kw", $"%{search}%"))`
  - 每個 DB 的 INFORMATION_SCHEMA 查詢都走 `SugarParameter`，不靠字串拼接
- 對齊 `getTableData` 的 WHERE 過濾也一律走 parameterized — 跟 SqlSugar fluent `Queryable<dynamic>().Where(expr, parameters)` 配合
- 不算新功能、是 1:1 平移時順便收緊的安全 baseline

### Verification gate
- 4 DB e2e：載入大表 (1M rows)、分頁、排序、過濾、欄位 metadata
- `pnpm test:e2e e2e/mssql-empty-table-header.spec.ts e2e/mssql-limit-guards.spec.ts` 全綠
- **SQL injection regression test**：input `';-- 測試%` 等 payload 至 search 欄、不能 panic、查詢結果應為空（而非執行注入）

---

## Phase 10 — Tables DDL + Cascade FK Resolver（3 天，**最高 ROI + fork ✓**）

### 對齊 endpoints
- `/api/tables/createTable`、`alterTable`、`dropTable`、`truncateTable`、`renameTable`、`emptyTable`、`copyTable`、`getTableOptions`、其餘 9 個

### 重點：Cascade FK
原本 5 個 client 各自寫的 cascade DDL：drop column 前必須先掃 inbound FK。**SqlSugar `DbMaintenance.GetForeignKeys()` 一行解掉**，跨 DB 一致。

### Fork 標記
**從 `Admin.NET.Core/Service/DataBase/SysDatabaseService.cs` 搬**：
- `AddColumn(input)`（DDL：加欄位）
- `DeleteColumn(input)`（DDL：刪欄位 — antares2 要在這裡加 cascade FK 邏輯）
- `UpdateColumn(input)`（DDL：改欄位定義）
- `ExportTableSchema()` / `ExportAllTableSchema()`（DDL dump，跨 DB 抽取）

**改寫**：
- 拿掉 `configId` 參數
- DeleteColumn 加上 `CascadeFkResolver.PrecheckInboundFks()` pre-flight 檢查
- ExportTableSchema 對齊 antares2 既有 SQL 格式（snapshot test 必須通過 byte-for-byte）

### 新增檔案
```
server/Tables/
├── TableDdlService.cs                 # CRUD + alter
├── CascadeFkResolver.cs               # 共用：GetForeignKeys → drop sequence
├── DdlGenerator/
│   ├── IDdlGenerator.cs
│   ├── MySqlDdlGenerator.cs
│   ├── PgDdlGenerator.cs
│   ├── MssqlDdlGenerator.cs
│   └── SqliteDdlGenerator.cs          # SQLite ALTER 限制要 emulate
```

### Verification gate
- 對 4 種 DB 各做：建表 → 加索引 → 加 FK → drop column（cascade）→ 確認資料完整
- LOC 比對：Phase 9+10 結束時 .NET tables 系列預估 ~700 LOC（vs Node 1700+ LOC）

### 風險
- **R4 SqlSugar 在 SQLite 某些 DbMaintenance NotSupported** — try-catch + raw SQL fallback
- **SQLite ALTER 文法限制**（不支援 DROP COLUMN）— `SqliteDdlGenerator` 用 CREATE-COPY-DROP-RENAME emulate

---

## Phase 11 — Views + Triggers + Routines + Functions + Schedulers（1 週）

### 對齊 endpoints
- views: 8（含 materialized view）、triggers: 5、routines: 4、functions: 6、schedulers: 5 = 共 28

### Deliverables
- 5 個 service class 共用同一個 CRUD 樣板
- 每種物件有 4-6 actions：getInformations / drop / alter / create / toggle / createMaterialized 等

### 新增檔案
```
server/
├── Views/
│   ├── ViewService.cs
│   └── MaterializedViewService.cs
├── Triggers/TriggerService.cs
├── Routines/RoutineService.cs         # stored procedures
├── Functions/FunctionService.cs       # scalar + trigger functions（PG）
└── Schedulers/SchedulerService.cs     # MySQL events、PG pg_cron、MSSQL Agent jobs
```

### Verification gate
- 4 DB 各做一遍 view CRUD、trigger CRUD…
- 對 PG 特別測 materialized view + REFRESH

---

## Phase 12 — Databases + Users + Application + AI（2 天，小尾巴）

### 對齊 endpoints
- databases: 2（getDatabases、getDatabaseComment）
- users: 1（getUsers）
- application: 2（showOpenDialog、showSaveDialog → 這 2 個是 Tauri 原生，不走 sidecar）
- ai: 1（translate-column）

### Deliverables
- `DatabaseService.cs`、`UserService.cs`
- `AiService.cs` — 呼叫 Anthropic API（用 `System.Net.Http.HttpClient`，從 settings 拿 API key）
- 注意：`application/showOpenDialog` 是 **Tauri plugin，不走 sidecar**，不需要 .NET 實作

### Verification gate
- AI translate-column 測：點欄位「翻譯」按鈕 → renderer 收到中文 comment
- `users.getUsers` 各 DB 回正確列表

---

## Phase 13 — Export Task Service + WS 進度推送（4 天）

### 對齊
- `WS /ws/export` + 相關 cancel endpoint

### Deliverables
1. **`ExportTaskService`** — background task，吃 `taskId` + `tables` + `options` → 寫 .sql 檔
2. **`ProgressBroadcaster`** — Channel<T> → WS hub
3. **`TaskRegistry`** — `taskId → CancellationTokenSource` map
4. 各 DB exporter 對齊 Node 版 SQL 格式（**byte-equality**）

### 為什麼不用 worker thread / process
.NET 的 GC + async/await 已經能處理長任務。原 Node `parentPort` 是繞過 event loop 卡住的設計，.NET 不需要。

### 新增檔案
```
server/
├── Workers/
│   ├── ExportTaskService.cs
│   ├── TaskRegistry.cs
│   └── ProgressBroadcaster.cs
├── Exporters/
│   ├── BaseExporter.cs
│   ├── MysqlExporter.cs
│   ├── PgExporter.cs
│   └── MssqlExporter.cs
└── WebSockets/
    └── ExportSchemaHub.cs              # WS endpoint + token 驗證（R7 第二段）
```

### MCP 查詢
- `get_furion_doc 24-即時通訊SignalR` — WS hub 的 broadcast pattern
- `get_furion_doc 25-輔助角色服務WorkerService` — `IHostedService` 背景任務樣板
- `get_event_guide` — 用 EventBus 推進度的替代方案

### Verification gate
- export 1MB / 100MB / 1GB 表 — 對比 Node 版時間、不能慢超過 1.5x
- snapshot test：對同 DB 同表 dump 出來的 SQL byte-for-byte 跟 Node 版一致

### 風險
- **R5 DDL byte-equality** — 用 fixture-based snapshot test 鎖定

---

## Phase 14 — Import Task Service + Cancel + AI（3 天）

### 對齊
- `WS /ws/import` + 相關 cancel

### Deliverables
1. **`ImportTaskService`** — 讀 .sql 檔、batched execute、推進度
2. SSH tunnel 整合（importer 也支援透過 SSH 連 DB）
3. Cancel：`CancellationTokenSource.Cancel()` → 釋放 transaction lock

### 新增檔案
```
server/
├── Workers/
│   └── ImportTaskService.cs
├── Importers/
│   ├── BaseImporter.cs
│   ├── MysqlImporter.cs
│   ├── PgImporter.cs
│   └── MssqlImporter.cs
└── WebSockets/
    └── ImportSchemaHub.cs
```

### Verification gate
- import 100MB .sql 檔
- 中途 `/api/import/cancel` → 30 秒內 transaction 真的 abort、no zombie lock

---

## Phase 15 — Node 清理 + CI Swap + 最終驗收（3-5 天）

### Deliverables
1. **刪除 `src/main/`**（35 個檔）
2. 刪除 `scripts/build-sidecar.mjs`
3. **`scripts/stage-resources.mjs`** 簡化（去掉 transitive-dep BFS）
4. **`package.json`** 移除 ~20 個 backend npm 套件
5. **CI workflows 改 .NET SDK setup**（移除 8 個「Download Node.js binary」step）

### CI 改動
| 檔 | 改動 |
|---|------|
| [.github/workflows/test-build.yml](.github/workflows/test-build.yml) | 4 個 Node download → 1 個 `actions/setup-dotnet@v4` |
| [.github/workflows/release.yml](.github/workflows/release.yml) | 同上 |
| [.github/workflows/test-e2e-win.yml](.github/workflows/test-e2e-win.yml) | 同上 |
| [.gitignore](.gitignore) | 移 `sidecar/node*`，加 `sidecar/antares-server*` |

### 移除的 npm packages（~20 個）
- `fastify` + `@fastify/*`
- `tsx`、`esbuild`（如僅後端用）
- `better-sqlite3`、`mysql2`、`pg`、`mssql`、`node-firebird`
- `ssh2`、`@fabio286/ssh2-promise`、`@heroku/socksv5`、`bindings`、`file-uri-to-path`
- `@faker-js/faker`（C# 改用 Bogus）

### Verification gate
```bash
# 全綠
pnpm lint && pnpm type-check && pnpm test:e2e
pnpm tauri:build  # 4 平台

# 安裝包尺寸
du -sh src-tauri/target/release/bundle/msi/*.msi
# 預期 < v0.8.x 70%

# 0 個 Node-download step
grep -rn "Download Node.js binary" .github/workflows/  # 必須無結果
```

---

## 風險登記簿（更新版）

| ID | 風險 | 嚴重度 | 緩解 | 狀態 |
|----|-----|-------|------|------|
| R1 | .NET cold-start > 3s | 中 | Phase 4 量測；超標就開 ReadyToRun | 觀察中 |
| R2 | Renci.SshNet cipher 不支援現代演算法 | **低**（從中下調） | Phase 5 做相容性矩陣；**SSH.NET 作者通道 fallback** | 觀察中 |
| R3 | macOS Gatekeeper 拒絕未簽 binary | 高 | CI codesign step；本機 ad-hoc sign | 已規劃 |
| R4 | SqlSugar 在 SQLite 某些 DbMaintenance NotSupported | **低**（已是低，再加上游 channel） | per-call try-catch + raw SQL；**SqlSugar 作者通道 fallback** | 已規劃 |
| R5 | DDL byte-equality 跨 DB 對齊 | 中 | snapshot test | 已規劃 |
| R6 | Furion result filter 跟 ProblemDetails 衝突 | **低**（已是低，再加上游 channel） | filter Order 設 int.MinValue；**Furion 作者通道 fallback** | 已規劃 |
| R7 | WebSocket 漏驗 token | 高 | OnConnectedAsync 手動驗 ?token= | 已規劃（Phase 2、13、14） |
| R8 | 8 個 CI Node-download step 漏改 | 低 | grep verify | 已規劃 |
| ~~R9~~ | ~~沒有 API schema、type drift~~ | — | **已解決**：Phase 3 Swagger codegen | ✅ 解除 |
| R10 | openapi-typescript 對 Furion polymorphicSchema 支援度未知 | **低**（已是低，再加上游 channel） | 退路：改用 nswag；**Furion 作者通道 fallback** | Phase 3 驗 |
| R11 | `admin-net` MCP server 知識跟 Admin.NET upstream drift | 低 | `mcp-version-pin.txt` 鎖 npm version；月驗 + 重新 build | 已規劃（Phase 0） |
| R12 | **Forked Admin.NET 程式碼跟 upstream drift**（fix / 新功能不會自動 sync） | 中 | fork 時 commit message 紀錄 source SHA；每季 review 比對；上游有新 fix 時 cherry-pick 過來 | 已規劃 |

---

## 不在這次 scope（明確排除）
- ❌ Firebird 支援（已斷捨離）
- ❌ Node sidecar 並行運行
- ❌ 前端 / Tauri Rust 端任何邏輯改動（除 sidecar.rs binary path）
- ❌ 新功能（1:1 平移）
- ❌ NativeAOT（先 R2R）
- ❌ Renderer IPC 重構
- ❌ Admin.NET 5-project 拆分（單 csproj）

---

## 驗證矩陣（最終驗收）

### Endpoint coverage（75 HTTP + 2 WS）
- [ ] connection: 5
- [ ] schema: 16 + 2 WS
- [ ] tables: 18
- [ ] views: 8
- [ ] triggers: 5
- [ ] routines: 4
- [ ] functions: 6
- [ ] schedulers: 5
- [ ] databases: 2
- [ ] users: 1
- [ ] application: 2（Tauri 原生，跳過）
- [ ] ai: 1

### DB 覆蓋（4 種，Firebird 排除）
- [ ] MySQL 8.x
- [ ] PostgreSQL 16
- [ ] SQL Server 2022 + 既有 3 e2e specs
- [ ] SQLite

### Build / CI
- [ ] `pnpm tauri:build` 4 平台都成功
- [ ] 安裝包尺寸 < v0.8.x 70%
- [ ] CI 0 個 "Download Node.js binary" step
- [ ] `package.json` 無 backend npm 套件

### Renderer 不變鐵律
- [ ] `src/renderer/` git diff = 0（除無關 UI 修）
- [ ] `httpClient.ts` 不動
- [ ] `sidecar.rs` 只有一行 path 改動
- [ ] `src/common/api-generated/` 從 codegen 自動產（**不手寫**）

---

## Admin.NET adoption 摘要表

### 慣例採用（純模仿，0 風險）
| 採用項目 | 影響 phase | 我們的 sidecar 慣用名 |
|--------|----------|---------------------|
| `IUnifyResultProvider` | Phase 2 | `SidecarResultProvider` |
| `IDynamicApiController + ITransient` | Phase 1, 5+ | service class 標準 base |
| `[ApiDescriptionSettings(Name=…), HttpPost]` | 所有 service action | 客製 RPC-style routing |
| `Configuration/*.json` 自動 scan | Phase 1 | `Configuration/Server.json` etc. |
| Swagger codegen → frontend types | Phase 3 | `src/common/api-generated/` |

### 知識來源
| 來源 | 用途 |
|------|------|
| **`@elf-express/admin-net-mcp` MCP server** | 慣例查詢、Furion / SqlSugar 教學手冊 |
| **Furion 作者直接通道**（人脈） | R6 / R10 升級 fallback |
| **SqlSugar 作者直接通道**（人脈） | R4 升級 fallback |

### Fork 戰略（path A++ self-grant，**新增 v4**）
| 來源檔案 | 影響 phase | 改動量 | 估省 |
|--------|----------|-------|-----|
| `Admin.NET.Core/Service/DataBase/SysDatabaseService.cs:471` (`GetTableList`) | Phase 6 | ~30% | 1 day |
| `Admin.NET.Core/Service/DataBase/SysDatabaseService.cs:214` (`GetColumnList`) | Phase 6, 9 | ~30% | 1 day |
| `Admin.NET.Core/Service/DataBase/SysDatabaseService.cs` (`AddColumn/DeleteColumn/UpdateColumn`) | Phase 8, 10 | ~30% | 1.5 days |
| `Admin.NET.Core/Service/DataBase/SysDatabaseService.cs:1124-1168` (`QuerySelect`) | Phase 9 | ~30% | 1 day |
| `Admin.NET.Core/Service/APIJSON/SelectTable.cs` (`ProcessWhere/Order/Group`) | Phase 9 | ~50% | 2-3 days |
| `Admin.NET.Core/Service/APIJSON/TableMapper.cs` | Phase 9 | ~0% | 0.5 day |
| `Admin.NET.Core/SqlSugar/SqlSugarSetup.cs:67-113` (`SetDbConfig`) | Phase 5 | ~20% | 1 day |
| **小計** | — | — | **~8 天** |

授權：`LICENSE-ELF-GRANT.md` 涵蓋（Phase 0 commit）

---

## 完成後 commit 序列建議

```
chore(net-migration): phase 0 — env + decision freeze
chore(net-migration): phase 1 — Furion scaffold
chore(net-migration): phase 2 — IUnifyResultProvider + token middleware
chore(net-migration): phase 3 — Swagger codegen pipeline
chore(net-migration): phase 4 — Tauri sidecar binary swap
...
chore(net-migration): phase 15 — Node cleanup + CI swap
```

每個 commit 都自包含、CI 必須過、可獨立 revert。
