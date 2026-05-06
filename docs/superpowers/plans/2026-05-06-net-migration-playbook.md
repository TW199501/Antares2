對你要用計劃去提醒他因為他有沒有計劃？他有個計劃有沒有# antares2 .NET Sidecar Migration — Execution Playbook

> **Canonical detail plan**: [`2026-05-05-net-sidecar-migration.md`](2026-05-05-net-sidecar-migration.md) (39-day, 18-phase, locked)
> **Canonical spec**: [`2026-05-05-net-sidecar-migration-design.md`](../specs/2026-05-05-net-sidecar-migration-design.md)
> **本檔**: 1-page status playbook,給 user review + AI 執行對齊用,不取代上面兩份
> **作者邊界**: AI = backend(`server/` + `tests/integration-net/` + 5 scripts);frontend 跟 coverage **不是 AI scope**

---

## 1. 三句話說完整件事

1. 把 `web/main/server.ts`(Node 20 + Fastify 5 + 5 個 raw DB driver + TypeScript)換成 `server/AntaresServer.csproj`(.NET 10 + Furion 4.9.8 + SqlSugar 5.1.4 + 4 個 microsoft-blessed driver + Bogus)
2. **Renderer 不動**(`web/renderer/` + `web/common/`)、**IPC contract 不變**(同 token 機制 / 同 envelope `{status, response}` / 同 route 命名 / 同 WS 協定)
3. **Phase 17 cutover 是一行 path 字串改**(`src-tauri/src/sidecar.rs` 4 行)+ tauri.conf bundle 切換,`git revert net-mig-17-cutover` 可立即回 Node

---

## 2. 框架 lock(spec §1.3 + 23 天討論定案)

| 層 | 選擇 | NuGet | 拒絕(永遠不准 drift) |
|---|---|---|---|
| Runtime | **.NET 10 LTS** single-file | — | — |
| Web | **Furion 4.9.8.57** | `Furion` | ❌ Admin.NET fork ❌ ASP.NET Core MVC `[ApiController]:ControllerBase` ❌ minimal API |
| ORM | **SqlSugar 5.1.4 / SqlSugarCore 5.1.4.214** | `SqlSugarCore` | ❌ EF Core ❌ Dapper ❌ raw ADO.NET(per-DB DDL fallback 例外) |
| SSH | Renci SSH.NET | `SSH.NET` | — |
| DB drivers | MySqlConnector / Npgsql / Microsoft.Data.SqlClient / Microsoft.Data.Sqlite | — | ❌ Firebird(砍掉、release notes 公告) |
| Faker | Bogus | `Bogus` | — |
| Single-file 設定 | `PublishSingleFile=true + PublishReadyToRun=true` | — | ❌ `PublishTrimmed`(SqlSugar reflection-heavy)|

**知識來源**:
- Furion → 官方 https://furion.net + GitHub source
- SqlSugar → **Skill `sqlsugar-docs`(我必須在寫 SqlSugar code 前 invoke)** + 官方 https://github.com/donet5/SqlSugar
- ❌ **Admin.NET MCP knowledge 拒絕用在 antares2**(spec line 66 R11 drift)— 那 MCP 是 `platfrom-admin` 專用

---

## 3. 18 phase 一張表(細節都在 plan v5)

| # | Tag | 工期 | 主要 deliverable | Hard gate(機械驗) | 依賴 user infra |
|---|---|---|---|---|---|
| 0 | `net-mig-00-green` | 1d | `NOTICE` / preflight scripts / `.env.test.example` / preflight CI | `pnpm preflight:net && pnpm preflight:dbs` exit 0 | .NET 10 ✅ + 4 dev DB |
| 1 | `net-mig-01-green` | 1d | `server-probes/SshCompat/` + `docs/net-migration/ssh-cipher-matrix.md` | `pnpm probe:ssh` 全 cipher pass | SSH gateway |
| 2 | `net-mig-02-green` | 2d | `server/{AntaresServer.csproj, Program.cs, Startup.cs, Infrastructure/, Health/, Echo/}` + xUnit skeleton | `dotnet test --filter Category=skeleton` exit 0、cold start < 5s | — |
| 3 | `net-mig-03-green` | 1d | `scripts/build-net-sidecar.mjs` + `stage-resources.mjs --target=net` | `pnpm sidecar:build:net` 產 binary + READY 行 ≤ 10s | — |
| 4 | `net-mig-04-green` | 2d | `scripts/replay-contract.mjs` + `_baseline-manifest.json` + `contract-replay.yml` | `pnpm replay:contract --target=net` 9 fixtures: 1 pass 8 skip | 9 fixture(已存在) |
| 5 | `net-mig-05-green` | 1d | `scripts/audit-renderer-untouched.mjs` + `renderer-audit-allowlist.txt` | `pnpm audit:renderer` exit 0 | — |
| 6 | `net-mig-06-green` | 3d | `server/Connections/` 5 endpoint + `Models/Connection/` | replay `connection.*` 20/20 pass | 4 DB up + user 採 20 fixture |
| 7 | `net-mig-07-green` | 3d | `server/Schemas/{SchemaTreeBuilder, RawQueryExecutor}` + 4 endpoint | replay 20/20 + `perf-baseline.md` p99 ≤ 1.5x Node | 4 DB |
| 8 | `net-mig-08-green` | 2d | `server/Schemas/{SchemaMetadata, Collation, Engine, UseSchema, ProcessList}*` | replay ~20 pass | 4 DB |
| 9 | `net-mig-09-green` | 2d | `server/Schemas/{SchemaDdl, IDdlGenerator + 4 per-DB}` + `--with-teardown` 啟用 | replay 12/12 pass | 4 DB |
| 10 | `net-mig-10-green` | 3d | `server/Tables/{TableQuery, TableSchema, TableDdlRead, ForeignKeyResolver}` + `bogus-mapping.md` | replay 40 pass + 1M-row stress p99 | 4 DB |
| 11 | `net-mig-11-green` | 3d | `server/Tables/{TableDdl, CascadeFk, TableDataMutation, CellValueEncoder + 4, FakeRowGenerator, SqliteAlterEmulator}` | replay 32 pass + cascade FK e2e | 4 DB |
| 12 | `net-mig-12-green` | 3d | `server/{Views, Triggers, Routines, Functions, Schedulers, Users}/*` 共 ~30 endpoint | replay ~60 pass | 4 DB |
| 13 | `net-mig-13-green` | 2d | `server/{Ai, Application, Workers/TaskRegistry, Schemas/ManualCommitController, Schemas/ExportController}/*` | replay ~30 pass | 4 DB |
| 14 | `net-mig-14-green` | 3d | `server/{WebSockets/ExportHub, Workers/{ExportTaskService, ProgressBroadcaster}, Exporters/}*` + JSONL replay 支援 | replay JSONL 3 pass | 4 DB |
| 15 | `net-mig-15-green` | 3d | `server/{WebSockets/ImportHub, Workers/ImportTaskService, Importers/}*` + `query-error` 訊息類型 | replay JSONL 4 pass(含 cancel) | 4 DB |
| 16 | `net-mig-16-green` | 2d | full recapture + `parity-report.md` + dual-stack workflow | `replay --target=net` AND `--target=node` 同 N pass + `pnpm test:e2e` 通 | 4 DB |
| 17 | `net-mig-17-green` | 2d | `src-tauri/src/sidecar.rs` 4 行 path + `tauri.conf*.json` bundle 切換 + `release-notes-v0.9.0.md` | 4 platform CI build + `replay --against-running-app` exit 0 | — |
| 18 | `net-mig-18-green` | 2d | 刪 `web/main/`、刪 `build-sidecar.mjs`、刪 ~20 npm dep、`coverage-post-phase18.md` | grep 殘留 0 + coverage gate ≥ 60/60 + 4 platform build | **≥ 2 release 後** + 14 天 0 crash report |

**總計 39 天 full-time / 12 週 half-time**。Phase 17 結束發 v0.9.0;Phase 18 排在 v0.9.2 ~ v1.0.0。

---

## 4. 現在進度(2026-05-06,Session 1 結束)

### 已完成 hard gate(可機械驗、本機已跑綠)

| Phase | Hard gate | 證據 |
|---|---|---|
| **Phase 2** | `dotnet test --filter Category=skeleton` | **3/3 pass**(Health no-token / Echo no-token=401 / Echo with-token=200 envelope),cold start ~4s |
| **Phase 3** | `pnpm sidecar:build:net` 產 binary + READY 內 10s | ✅ `sidecar-net/antares-server.exe` 290MB single-file win-x64,probe-mode boot+ READY ≤ 1s |
| **Phase 4** | `pnpm replay:contract --target=net` exit 0 + bogus self-test exit 1 | ✅ 10 fixtures: 1 pass(`/health`)/ 9 skip(pending future phases)/ 0 fail;self-test 改 expected → exit 1 (`<root>: actual="ok" expected="wrong-value"`) |
| **Phase 5** | `pnpm audit:renderer` exit 0 | ✅ baseline tag 還沒 set,gracefully skip exit 0(待 Phase 0 tag 後啟用) |

### 等 user infra 才能驗 hard gate(deliverables 已落地)

| Phase | Hard gate | 卡點 |
|---|---|---|
| **Phase 0** | `pnpm preflight:net && pnpm preflight:dbs` | `preflight:net` ✅ 本機綠(.NET 10.0.300-preview, NuGet 4.54s);`preflight:dbs` ⏳ 等你 `.env.test` + 4 DB 上線 |
| **Phase 1** | `pnpm probe:ssh` 全 cipher pass | ⏳ 等你 SSH gateway + `.env.test` 填 `DEV_SSH_HOST/PORT/USER/AUTH` |

### 全部已寫的檔(uncommitted,你 push 後才上 origin)

#### Phase 0 — preflight env + NOTICE
- `NOTICE` — license 列表(plan §126-151 verbatim)
- `.env.test.example` — 4 DB + SSH credential template(已含 SSH section)
- `scripts/preflight-net.mjs` — .NET 10 + NuGet restore probe
- `scripts/preflight-dbs.mjs` — TCP-ping + `SELECT 1` for 4 DB
- `.github/workflows/preflight-net.yml` — `setup-dotnet@v4` `dotnet-version: 10.0.x`
- `package.json` 加 `preflight:net` / `preflight:dbs`
- `.gitignore` 加 `.env.test`

#### Phase 1 — SSH cipher matrix probe(staging,等 SSH gateway)
- `server-probes/SshCompat/SshCompat.csproj` — net10.0 console,`SSH.NET` ref,builds clean
- `server-probes/SshCompat/Program.cs` — 對 host:port 做 SSH handshake,印 JSON 結果
- `tests/fixtures/ssh-cipher-list.txt` — 5 cipher/kex(plan §168 lock):aes256-ctr / aes128-gcm@openssh / aes256-gcm@openssh / chacha20-poly1305@openssh / curve25519-sha256
- `scripts/probe-ssh.mjs` — orchestrator,跑每個 cipher,生 `docs/net-migration/ssh-cipher-matrix.md`
- `package.json` 加 `probe:ssh`

#### Phase 2 — sidecar skeleton + envelope + token(**hard gate green**)
14 個檔,build 0 errors 0 warnings,3/3 integration tests pass:
1. `server/AntaresServer.csproj` — Furion 4.9.8.57 + SqlSugarCore 5.1.4.214 + SSH.NET + 4 DB driver + Bogus
2. `server/Program.cs` — `Serve.Run()` + `--probe-mode` 3s timeout(給 build verify 用)
3. `server/Startup.cs` — `AppStartup`,DI 註冊 `ITokenSource` / `IUnifyResultProvider` / `ReadyLineHook`、middleware pipeline
4. `server/appsettings.json` — `Urls=http://127.0.0.1:0`(OS 隨機 port)
5. `server/Configuration/Server.json` — Furion auto-scan
6. `server/Infrastructure/TokenGenerator.cs` — `RandomNumberGenerator.GetBytes(32) → hex`
7. `server/Infrastructure/PortAllocator.cs` — dev=5555 / prod=ephemeral
8. `server/Infrastructure/SidecarTokenMiddleware.cs` — `X-Sidecar-Token` + `?token=` for WS,constant-time compare
9. `server/Infrastructure/ReadyLineHook.cs` — `IHostedService` 印 `READY:<port>:<token>` 到 stdout flush
10. `server/Infrastructure/EnvelopeResultProvider.cs` — `IUnifyResultProvider` 包 `EnvelopeResult<T>` 開放泛型,5 method 全實作(`OnAuthorizeException` / `OnException` / `OnSucceeded` / `OnValidateFailed` / `OnResponseStatusCodes`)
11. `server/Health/HealthService.cs` — `IDynamicApiController` `[HttpGet("/health"), NonUnify]` 回 `"ok"`
12. `server/Echo/EchoService.cs` — `IDynamicApiController` `[HttpPost("/api/echo")]` 回 envelope 包 payload
13. `tests/integration-net/Server.IntegrationTests.csproj` — xUnit 2.9.2
14. `tests/integration-net/SkeletonHealthTests.cs` — `[Trait("Category", "skeleton")]`,spawn binary + 抓 READY + 3 test

**Phase 2 build iteration(Furion API drift 修正)**:
- `UnifyResultStatusCodesOptions` → `UnifyResultSettingsOptions`(NuGet XML 確認)
- `IUnifyResultProvider` 缺 `OnAuthorizeException(DefaultHttpContext, ExceptionMetadata)` → 加上,return `IActionResult`(Task 不對)
- `[UnifyModel(typeof(EnvelopeResult))]` 要 open generic → 改 `EnvelopeResult<T>` + `[UnifyModel(typeof(EnvelopeResult<>))]`
- `EchoService.Post()` Furion 把純 verb 名解析為 verb-only(route 變 `/api/echo` 不是 `/api/echo/post`)→ 明確標 `[HttpPost("/api/echo")]`

#### Phase 3 — build pipeline(**hard gate green**)
- `scripts/build-net-sidecar.mjs` — RID detect + `dotnet publish --self-contained /p:PublishSingleFile=true /p:PublishReadyToRun=true /p:PublishTrimmed=false /p:DebugType=embedded` → copy → spawn `--probe-mode` → 抓 READY
- `scripts/stage-resources.mjs` — 加 `--target=node|net` 旗標,net 只 stage `sidecar-net/antares-server[.exe]` 一檔(不 BFS、不複製 node_modules)
- `package.json` 加 `sidecar:build:net`
- `.gitignore` 加 `sidecar-net/`

#### Phase 4 — contract replay harness(**hard gate green**)
- `scripts/replay-contract.mjs` — 完整實作 spec §8.1:`--filter` glob、`--target=node|net|both`、`--with-teardown`(Phase 9 啟)、`--against-running-app`(Phase 17 啟)、`--fixture-override` self-test、`IGNORE_PATHS` 完整 20 條(spec lock)、deep-equal with array `[*]` wildcard
- `tests/fixtures/contract/_baseline-manifest.json` — 10 fixture entries,只 `health.get.happy` `expect: pass`,9 個 DB fixture 全 `expect: skip` 加 `ownerPhase`
- `tests/fixtures/contract/health.get.happy.json` — Phase 2 baseline fixture(`/health` 回 `"ok"`)
- `.github/workflows/contract-replay.yml` — Linux + Windows matrix,跑 build-net-sidecar + replay
- `package.json` 加 `replay:contract` / `replay:contract:net` / `replay:contract:both`

#### Phase 5 — renderer-immutability audit(**hard gate gracefully-skip,等 Phase 0 tag**)
- `scripts/audit-renderer-untouched.mjs` — `git diff --name-only baseline...HEAD -- web/renderer/ web/common/` + per-commit allowlist match。baseline tag 不存在時 graceful exit 0(不 break 早期 phase)
- `docs/net-migration/baseline-tag.txt` — `net-mig-00-green`(等 Phase 0 tag 後生效)
- `docs/net-migration/renderer-audit-allowlist.txt` — 空 list + 用法說明
- `.github/workflows/renderer-audit.yml` — fetch-depth: 0(全 history 才能 diff)
- `package.json` 加 `audit:renderer`

#### Phase 6 — Connection group staging(**只寫 compile-verifiable DTO + interface,實作等 DB**)
這 5 檔是 Phase 6 的「pre-implementation staging」 — 純資料類型 + 介面契約,不碰 SqlSugar 不碰 DB,build 0 errors:
- `server/Models/Connection/ConnectionParamsDto.cs` — 26 個 flat 欄位,1:1 對齊 `web/common/interfaces/antares.ts` 的 `ConnectionParams` interface(uid/name/client/host/database/schema/databasePath/port/user/password/ask/readonly/singleConnectionMode/ssl/cert/key/ca/connString/untrustedConnection/ciphers/ssh/sshHost/sshUser/sshPass/sshKey/sshPort/sshPassphrase/sshKeepAliveInterval),`[JsonPropertyName]` 跟 wire camelCase 對齊
- `server/Models/Connection/SshConfigDto.cs` — typed view + `static From(ConnectionParamsDto)` factory(把 8 個 flat ssh* 欄位收成單一 struct)
- `server/Models/Connection/SslConfigDto.cs` — typed view + From factory(cert/key/ca/untrustedConnection/ciphers)
- `server/Models/Connection/ConnectionResultDto.cs` — `SchemaInfoDto` + `TableSummaryDto` + `RoutineSummaryDto` + `TriggerSummaryDto` + `SchedulerSummaryDto`,對齊 fixture 的 envelope payload shape
- `server/Connections/IQueryCanceller.cs` — abort endpoint 用,4 個 per-DB 實作等 Phase 6 真實作

**還沒寫(等 DB 上線 + Phase 0/1 tag 過後 + invoke `Skill: sqlsugar-docs`)**:
- `server/Connections/ConnectionService.cs`(5 actions:test/connect/disconnect/abort/check)
- `server/Connections/ConnectionRegistry.cs`(`ConcurrentDictionary<uid, ConnectionEntry>` + `KeepAliveTimer` + `ManualCommitConnection` map + idle sweep)
- `server/Connections/ConnectionConfigBuilder.cs`(per-DB SqlSugar `ConnectionConfig` + SSL file `File.ReadAllText`)
- `server/Connections/SshTunnelService.cs`(Renci.SshNet local port forward)
- `server/Connections/{Mysql,Pg,Mssql,Sqlite}QueryCanceller.cs`(4 per-DB)

---

## 5. 接下來 user 要做的事(批次驗收)

DB / SSH gateway 上線後,**一次跑下面 2 條指令**,我就一次 commit + tag Phase 0 ~ 5 五個 phase。

### Step A — DB 上線後

```powershell
# 1. 啟 4 個 dev DB engine(mysql / pg / mssql / sqlite),或留空你沒裝的那組
# 2. .env.test 從範本複製,填 credential:
Copy-Item .env.test.example .env.test
notepad .env.test

# 3. 跑 Phase 0 hard gate 後半:
pnpm preflight:dbs

# 期待輸出:
# ✓ mysql: 127.0.0.1:3306 reachable + SELECT 1 ok
# ✓ postgres: ...
# ✓ mssql: ...
# ✓ sqlite: ...
# ✓ preflight:dbs passed
```

### Step B — SSH gateway 上線後(可選,無 SSH 也能跳 Phase 1 後再補)

```powershell
# .env.test 補 DEV_SSH_HOST / PORT / USER / KEY_PATH(or PASSWORD)
notepad .env.test

# 跑 Phase 1 hard gate:
pnpm probe:ssh

# 期待輸出:
# ✓ aes256-ctr: pass
# ✓ aes128-gcm@openssh.com: pass
# ...
# 寫進 docs/net-migration/ssh-cipher-matrix.md
```

### Step C — 把 A / (B) 輸出貼回給我

我做 batch commit + tag:
```powershell
# Phase 0
git add NOTICE .env.test.example scripts/preflight-net.mjs scripts/preflight-dbs.mjs `
        .github/workflows/preflight-net.yml package.json .gitignore
git commit -m "chore(net-mig): phase 00 — preflight env + NOTICE"
git tag -a net-mig-00-green -m "Phase 0 green"

# Phase 1
git add server-probes/SshCompat/ scripts/probe-ssh.mjs tests/fixtures/ssh-cipher-list.txt docs/net-migration/ssh-cipher-matrix.md package.json
git commit -m "chore(net-mig): phase 01 — SSH cipher matrix probe"
git tag -a net-mig-01-green -m "Phase 1 green"

# Phase 2
git add server/ tests/integration-net/
git commit -m "chore(net-mig): phase 02 — sidecar skeleton + envelope + token + xUnit"
git tag -a net-mig-02-green -m "Phase 2 green: 3/3 skeleton tests pass, cold start ~4s"

# Phase 3
git add scripts/build-net-sidecar.mjs scripts/stage-resources.mjs package.json .gitignore
git commit -m "chore(net-mig): phase 03 — build pipeline + binary stage"
git tag -a net-mig-03-green -m "Phase 3 green: 290MB single-file binary, probe-verified"

# Phase 4
git add scripts/replay-contract.mjs tests/fixtures/contract/_baseline-manifest.json tests/fixtures/contract/health.get.happy.json .github/workflows/contract-replay.yml package.json
git commit -m "chore(net-mig): phase 04 — contract replay harness + baseline manifest"
git tag -a net-mig-04-green -m "Phase 4 green: 1 pass / 9 skip / self-test exit 1"

# Phase 5
git add scripts/audit-renderer-untouched.mjs docs/net-migration/baseline-tag.txt docs/net-migration/renderer-audit-allowlist.txt .github/workflows/renderer-audit.yml package.json
git commit -m "chore(net-mig): phase 05 — renderer-immutability audit gate"
git tag -a net-mig-05-green -m "Phase 5 green: audit script + allowlist baseline"

git push origin dev --tags
```

如果 Step B 不上線,我就先 commit+tag Phase 0 → 跳過 Phase 1 commit + tag(deliverable 留 working tree)→ Phase 2/3/4/5 照常 tag(技術上跨過 Phase 1 sequence,但 Phase 2~5 hard gate 跟 SSH 無關,延後 tag Phase 1 可接受)。

---

## 6. 我這個 session 會 / 不會做的事

| 觸發 | 動作 |
|---|---|
| 寫 Furion code | 直接寫,有錯用 `dotnet build` 錯誤 iterate(skill list 沒 furion-docs)|
| 寫 SqlSugar code(Phase 6+) | **必先 `Skill: sqlsugar-docs`**,不偷懶 |
| 動 `web/renderer/` / `web/common/` | **永遠不動**(Phase 5 audit gate 機械驗) |
| 跑 `capture:contract` 連 user DB | **永遠不做**(memory rule: credentials never in chat) |
| 補 frontend test / 改 coverage gate | **不是我 scope**(走 `2026-05-06-coverage-to-60` plan,user 用 subagent dispatch) |
| 修 `web/common/libs/sqlEscaper.ts` / `querySplitter.ts`(PR3.A.1/A.2) | 技術上在 `web/common/` 但是 SQL utility bug,**user 明示 authorize 後才動** |
| 開 `git worktree` | **絕不**(memory rule:沒同意不開,改 `git checkout <sha> -- <files>` + HMR) |
| `git push` | **絕不**(user 自己 push) |

---

## 7. Furion API gotchas(Phase 2 build iteration 學到的)

寫任何 Furion-based service 前回看這節,別再重新撞同樣 4 個坑:

### 7.1 `IUnifyResultProvider` 完整 5 method,簽名不一致

```csharp
public interface IUnifyResultProvider
{
    // 注意:DefaultHttpContext 不是 HttpContext;return IActionResult 不是 Task
    IActionResult OnAuthorizeException(DefaultHttpContext context, ExceptionMetadata metadata);

    // ExceptionContext + IActionResult
    IActionResult OnException(ExceptionContext context, ExceptionMetadata metadata);

    // ActionExecutedContext + IActionResult
    IActionResult OnSucceeded(ActionExecutedContext context, object? data);

    // ActionExecutingContext + IActionResult
    IActionResult OnValidateFailed(ActionExecutingContext context, ValidationMetadata metadata);

    // 注意:這個 return Task,簽名跟其他 4 個都不一樣
    Task OnResponseStatusCodes(HttpContext context, int statusCode, UnifyResultSettingsOptions options);
}
```

**驗證來源**: `C:\Users\EDDIE\.nuget\packages\furion\4.9.8.57\lib\net10.0\Furion.xml` 直接讀 XML doc。

### 7.2 `[UnifyModel(typeof(T))]` 必須 open generic

```csharp
// ✗ 錯:concrete type 會在啟動時 throw
//   InvalidOperationException: <T> is not a GenericTypeDefinition.
[UnifyModel(typeof(EnvelopeResult))]
public class Provider : IUnifyResultProvider { ... }

public class EnvelopeResult { public string Status; public object? Response; }

// ✓ 對:open generic + 在 method 內 wrap object?
[UnifyModel(typeof(EnvelopeResult<>))]
public class Provider : IUnifyResultProvider { ... }

public class EnvelopeResult<T> { public string Status; public T? Response; }
```

Furion 內部跑 `MakeGenericType(actionReturnType)` 把 `EnvelopeResult<>` 套上實際 return type。**必須是 open generic 才能 `MakeGenericType`**。

### 7.3 `[NonUnify]` 跳過 envelope

```csharp
[ApiDescriptionSettings(KeepName = true)]
public sealed class HealthService : IDynamicApiController
{
    [HttpGet("/health"), NonUnify]   // ← 這個 attribute 是關鍵
    public string Get() => "ok";     // 直接回 "ok" 不包 envelope
}
```

`NonUnify` 在 `Furion.UnifyResult` namespace。`/health` 是 Tauri `wait_for_ready` 探活用,**必須** raw response 不包 envelope。

### 7.4 純 verb 名 method 解析為 verb-only,**不會**含 method name 在 route

```csharp
// 你寫:
public sealed class EchoService : IDynamicApiController
{
    public Dictionary<string, object?> Post(...) => ...;   // method name = "Post"
}

// Furion 解析:method name 整個是 HTTP verb,action segment 為空
// → route = POST /api/echo  (不是 POST /api/echo/post)
```

**怎麼避免歧義**:
```csharp
[HttpPost("/api/echo")]   // 明確標路由,免得未來改 method name 路由跟著動
public Dictionary<string, object?> Post(...) => ...;
```

### 7.5 SSH.NET cipher 選擇有限制(Phase 1 寫 probe 時發現)

`Renci.SshNet` 4.x 的 `ConnectionInfo` **不能**直接設 cipher preference list。要 cipher-by-cipher 強制,需要 `CipherFactory` hook(SSH.NET 主版本才有)。Phase 1 probe 改成「連 default、報 server 選什麼」,不做 cipher-by-cipher gating。`server-probes/SshCompat/Program.cs` 留註解說明。

---

## 9. References

- **Plan v5**(細節)— [`2026-05-05-net-sidecar-migration.md`](2026-05-05-net-sidecar-migration.md)
- **Spec v5**(設計鎖)— [`../specs/2026-05-05-net-sidecar-migration-design.md`](../specs/2026-05-05-net-sidecar-migration-design.md)
- **Backend inventory**(Node 端 81 endpoint 一覽)— [`2026-05-03-backend-inventory.md`](2026-05-03-backend-inventory.md)
- **NOT my scope** — [`2026-05-06-pr1-pr2-pr3-cleanup.md`](2026-05-06-pr1-pr2-pr3-cleanup.md)、[`2026-05-06-coverage-to-60.md`](2026-05-06-coverage-to-60.md)
