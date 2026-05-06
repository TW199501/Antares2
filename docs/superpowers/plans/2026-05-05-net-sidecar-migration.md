# antares2 .NET Sidecar Migration — Execution Plan

> **狀態**: locked execution plan (2026-05-05) — 取代 v4
> **配套 spec**: [`2026-05-05-net-sidecar-migration-design.md`](../specs/2026-05-05-net-sidecar-migration-design.md)（design 鎖定處）
> **取代**: `2026-05-03-net-sqlsugar-migration.md` + `2026-05-03-net-sqlsugar-execution-plan.md`（v1 + v4，保留歷史紀錄）
> **總工期**: 39 天（**18 phase**，每 phase ≤ 3 天）
> **執行模型**: 單一 dev 分支、每 phase 結束 `git tag net-mig-NN-green`、rollback = `git reset --hard <prev-tag>`、**不開 worktree**

---

## 0. 「一次成功」的工程定義

> 不是「每行程式碼一次寫對」——是「每 phase 結束有可機械驗證的 hard gate；過了就鎖、沒過就 reset 到上一個 green tag、不留半殘狀態」。

**三個自校正機制**：

1. **每個 gate 是 shell 指令、exit code 0 就過**。沒有「人眼看起來 OK」的判斷空間。
2. **Fixture replay 是契約**。`tests/fixtures/contract/*.json` 由 user 對 dev DB 親手採集（real-DB 真資料），.NET 端必須通過 `pnpm replay:contract` 不變。
3. **Rollback 是單一 git 指令**。每個 phase 結束 tag、出錯就 `reset --hard`，從 phase 邊界恢復、絕不修一半。

**Tag 命名**：`net-mig-00-green` ~ `net-mig-18-green`，phase N 完成後才打 N 的 tag。

---

## 1. 全域慣例（每個 phase 都套用）

### 1.1 commit message
```
chore(net-mig): phase NN — <gist>
```
單 phase 多 commit 時，最後一個 commit 才打 tag；中間用 `chore(net-mig): phase NN/N — <step>`（N/N 子序列）。

### 1.2 Pre-flight checklist（每 phase 開始前）
- [ ] `git status` 工作樹乾淨（除 untracked plan 文件）
- [ ] `git rev-parse HEAD` 等於前一個 phase 的 green tag commit（或在其後）
- [ ] 上一 phase 的 hard gate 仍綠（`pnpm replay:contract --target=net` 等）
- [ ] CI 上一個 push 是綠（`gh run list --branch dev --limit 1` 看狀態）

任何一項未通過就**不開動**該 phase。

### 1.3 Deliverable 證據
- 每 phase 結束 commit 的 message body 必須包含「Hard gate 執行紀錄」：
```
Hard gate verified:
$ pnpm replay:contract -- --filter=connection.* --target=net
9 fixtures: 2 pass, 0 skip, 0 fail
exit 0
```

### 1.4 Rollback procedure（共用）
```powershell
# Windows PowerShell（dev 機）
git reset --hard net-mig-<N-1>-green
git tag -d net-mig-<N>-green       # 若已打但反悔
git push --delete origin net-mig-<N>-green   # 若已 push（謹慎）
```

### 1.5 Subagent dispatch 規則（採 v2 plan 學到的）
- 任何 subagent prompt 必須要求自驗：`pnpm lint && pnpm type-check && exit code 0` 才回報
- subagent 找到 source bug 不修，加 characterization test 鎖當前行為
- credentials 永不在 chat 傳；user 自己跑 `capture:contract`

---

## 2. Phase 總覽

| # | 主題 | 工期 | Tag | 依賴 |
|---|------|------|-----|------|
| 0 | Preflight environment + NOTICE | 1 d | `net-mig-00-green` | — |
| 1 | SSH cipher matrix probe | 1 d | `net-mig-01-green` | 0 |
| 2 | Sidecar skeleton + `/health` + envelope + token | 2 d | `net-mig-02-green` | 1 |
| 3 | Build pipeline + binary stage | 1 d | `net-mig-03-green` | 2 |
| 4 | Contract replay harness | 2 d | `net-mig-04-green` | 3 |
| 5 | Renderer-immutability audit gate | 1 d | `net-mig-05-green` | 4 |
| 6 | Connection group（5 endpoints） | 3 d | `net-mig-06-green` | 5 |
| 7 | Schema discovery group（5 endpoints） | 3 d | `net-mig-07-green` | 6 |
| 8 | Schema metadata group（7 endpoints） | 2 d | `net-mig-08-green` | 7 |
| 9 | Schema DDL group（3 endpoints） | 2 d | `net-mig-09-green` | 8 |
| 10 | Tables read group（10 endpoints） | 3 d | `net-mig-10-green` | 9 |
| 11 | Tables write group（8 endpoints） | 3 d | `net-mig-11-green` | 10 |
| 12 | Views + Triggers + Routines + Functions + Schedulers + Users（30 endpoints） | 3 d | `net-mig-12-green` | 11 |
| 13 | AI + manual-commit + file I/O（8 endpoints） | 2 d | `net-mig-13-green` | 12 |
| 14 | WS export task service（2 endpoints + 1 WS） | 3 d | `net-mig-14-green` | 13 |
| 15 | WS import task service（2 endpoints + 1 WS） | 3 d | `net-mig-15-green` | 14 |
| 16 | Full-baseline lock + dual-stack parity proof | 2 d | `net-mig-16-green` | 15 |
| 17 | Sidecar.rs cutover | 2 d | `net-mig-17-green` | 16 |
| 18 | Node deprecation cleanup（**≥ 2 個 release 後才執行**） | 2 d | `net-mig-18-green` | 17 + 兩個 release |

**總計 39 天**。Phase 17 後可 release v0.9.0；Phase 18 排在 v0.9.2 或 v1.0.0 視穩定度。

---

## Phase 0 — Preflight environment + NOTICE

### Goal
證明工具鏈、目標 DBs、套件 restore、license 文件都到位，**任何 .cs 檔尚未存在**。

### Pre-flight
- `dev` 分支乾淨；`origin/dev` 同步
- 4 個 dev DB engine 已在使用者本機跑起來（MySQL 8 / PG 16 / MSSQL 2022 / SQLite）

### Deliverables
1. `docs/superpowers/specs/2026-05-05-net-sidecar-migration-design.md`（spec，已 commit）
2. `docs/superpowers/plans/2026-05-05-net-sidecar-migration.md`（這份 plan）
3. `NOTICE` ✨ — 引述哪些第三方 license 跟版權
4. `scripts/preflight-net.mjs` — 探 `dotnet --version` ≥ 10、暫存資料夾 NuGet restore 一個只引 Furion + SqlSugar + Renci.SshNet + 4 driver + Bogus 的空 csproj
5. `scripts/preflight-dbs.mjs` — 從 `.env.test`（gitignored）讀 4 DB 連線、TCP-ping + open + `SELECT 1`
6. `.env.test.example` — 範本（user copy 成 `.env.test` 自填）
7. `.github/workflows/preflight-net.yml` — 跑 preflight:net（不含 DB probe，CI 沒 DB）；**含 `actions/setup-dotnet@v4` with `dotnet-version: '10.0.x'`**（CI runner 沒 .NET 10 預裝、不能假設）
8. `package.json` 加 scripts: `preflight:net`、`preflight:dbs`

### Hard gate
```powershell
pnpm preflight:net && pnpm preflight:dbs
# 兩個都 exit 0
# CI 上 preflight-net.yml 在 PR 也綠
```

### Rollback
無 tag 可回；`git reset --hard origin/dev` 即可（仍在 phase 0 邊界）。

### 動到的檔案
**新增**：`docs/superpowers/{specs,plans}/...`、`NOTICE`、`scripts/preflight-{net,dbs}.mjs`、`.env.test.example`、`.github/workflows/preflight-net.yml`
**修改**：`package.json`、`.gitignore`（加 `.env.test`）

### NOTICE 檔內容（locked）

```
antares2 NOTICE
================

This product includes:

- antares2 itself, MIT-licensed (LICENSE)
  Copyright (c) 2020 Fabio Di Stasio (upstream antares-sql/antares)
  Copyright (c) 2026 ELF International Express CO., LTD. (this fork)

- .NET 10 runtime (MIT, Microsoft Corporation)
- Furion (Apache 2.0, MonkSoul) — https://furion.net
- SqlSugar (MIT/Apache 2.0, donet5) — https://github.com/donet5/SqlSugar
- SSH.NET (MIT, Renci) — https://github.com/sshnet/SSH.NET
- MySqlConnector (MIT) — https://mysqlconnector.net
- Npgsql (PostgreSQL License) — https://www.npgsql.org
- Microsoft.Data.SqlClient (MIT, Microsoft)
- Microsoft.Data.Sqlite (MIT, Microsoft)
- Bogus (MIT, bchavez) — https://github.com/bchavez/Bogus

For full license texts of bundled binary dependencies, see
the per-package metadata in the .NET self-contained binary
distribution and `pnpm licenses` for Node-side build tools.
```

---

## Phase 1 — SSH cipher matrix probe

### Goal
證明 SSH.NET 跟 user 真實 SSH gateway 的 cipher 相容（R2 mitigation）；不相容的 cipher documented。

### Pre-flight
- Phase 0 gate 綠
- User 提供 1 個測試用 SSH gateway（host + key path），credentials 留在 user 本機 `.env.test` 不進 chat

### Deliverables
1. `server-probes/SshCompat/SshCompat.csproj` — 一次性 console（dev tool；commit 進去但 `tauri.conf.json` 不引用、不 bundle 進 binary）
2. `scripts/probe-ssh.mjs` — orchestrator（呼叫 `dotnet run` 跑 probe + 收集結果）
3. `tests/fixtures/ssh-cipher-list.txt` — 要測的 cipher 清單（locked: aes256-ctr / aes128-gcm / aes256-gcm / chacha20-poly1305 / curve25519-sha256）
4. `docs/net-migration/ssh-cipher-matrix.md` ✨ — auto-generated cipher → pass/fail 表 + 不相容項的 fallback 建議

### Hard gate
```powershell
pnpm probe:ssh
# 每個 cipher 都 pass / 在 documented allowlist
# ssh-cipher-matrix.md 已 commit
```

### Rollback
```powershell
git reset --hard net-mig-00-green
git tag -d net-mig-01-green
```

---

## Phase 2 — Sidecar skeleton + `/health` + envelope + token

### Goal
最小可運行的 .NET sidecar：boot、印 `READY:<port>:<token>`、`/health`（無 token）回 200、token-gated `/api/echo` 回 envelope，整套 token 驗證 + cold start 在 5 秒內。

### Pre-flight
- Phase 1 gate 綠

### Deliverables
1. `server/AntaresServer.csproj` — Furion 4.9.8 + SqlSugar 5.1.4 + Renci.SshNet + 4 DB driver + Bogus
2. `server/Program.cs` — `Serve.Run()` 入口
3. `server/Startup.cs` — service 註冊 + middleware pipeline
4. `server/appsettings.json` + `Configuration/Server.json`（`ConfigurationScanDirectories` 自動 scan）
5. `server/Infrastructure/`：
   - `EnvelopeResultProvider.cs` — `IUnifyResultProvider` 包 `{ status, response }`，**OnException 強制 string**（spec §3.2）
   - `SidecarTokenMiddleware.cs` — `X-Sidecar-Token` 驗證
   - `ReadyLineHook.cs` — `IHostedService` 印 `READY:<port>:<token>` 到 stdout
   - `PortAllocator.cs` — dev=5555 / prod=0
   - `TokenGenerator.cs` — `RandomNumberGenerator.GetBytes(32)` → hex
6. `server/Health/HealthService.cs` — `IDynamicApiController`，`[HttpGet, AllowAnonymous]`，**注意 GET 不是 POST**（renderer 約定）
7. `server/Echo/EchoService.cs` — token-gated POST，回 `{ ...payload }`（拿來測 envelope）
8. `tests/integration-net/Server.IntegrationTests.csproj` — xUnit
9. `tests/integration-net/SkeletonHealthTests.cs` — boot binary、抓 READY 行、`/health` 200 (raw, no envelope)、`/api/echo` with/without token (200/401)、cold start < 5s

### Hard gate
```powershell
dotnet test tests/integration-net/Server.IntegrationTests.csproj --filter Category=skeleton
# exit 0
```

### Rollback
```powershell
git reset --hard net-mig-01-green
git tag -d net-mig-02-green
```

### 動到的檔案
**新增**：`server/**`、`tests/integration-net/**`
**修改**：無（`web/`、`src-tauri/` 不動）

### 注意
- `/health` 是 **GET** + raw response（不包 envelope），對齊 renderer `httpClient.ts` 既有預期 + Tauri `wait_for_ready` probe
- envelope 只套用在 `[ApiDescriptionSettings]` 標記的 dynamic API controller，`/health` 用標準 ASP.NET Core controller 跳過 unify result
- cold start 量測：`Stopwatch.StartNew()` → spawn process → 收 READY 行 → `Stop()`，斷言 < 5s（Phase 17 cutover 前若超 5s 就要調 `wait_for_ready` 至 10s）

---

## Phase 3 — Build pipeline + binary stage

### Goal
產出 `sidecar-net/antares-server[.exe]`，`stage-resources.mjs` 多支援 `--target=net`。**不切換** Tauri default。

### Pre-flight
- Phase 2 gate 綠

### Deliverables
1. `scripts/build-net-sidecar.mjs` — RID 偵測 + `dotnet publish` 產 single-file
2. `scripts/stage-resources.mjs` — 加 `--target=node|net` 參數，`net` 只 stage `.exe`
3. `package.json` 加 script: `sidecar:build:net`
4. `.gitignore` 加 `sidecar-net/`

### Hard gate
```powershell
pnpm sidecar:build:net
Test-Path sidecar-net/antares-server.exe   # Windows
& ./sidecar-net/antares-server.exe --probe-mode | Select-String "READY:"
# 10 秒內收到 READY 行就 exit 0
```

`--probe-mode` 是 .NET 端 CLI 旗標：boot → 印 READY → 立刻 graceful shutdown，給 build verify 用。

### Rollback
```powershell
git reset --hard net-mig-02-green
git tag -d net-mig-03-green
```

### 動到的檔案
**新增**：`scripts/build-net-sidecar.mjs`
**修改**：`scripts/stage-resources.mjs`、`package.json`、`.gitignore`、`server/Program.cs`（加 `--probe-mode` 處理）

---

## Phase 4 — Contract replay harness（**整個 plan 的脊骨**）

### Goal
建立 `pnpm replay:contract`：spawn .NET binary、跑 fixture、deep-equal、exit code 是 verdict。**所有後續 service phase 的 gate 都靠這個**。

### Pre-flight
- Phase 3 gate 綠
- 既有 9 個 mssql hand-crafted fixture 在 `tests/fixtures/contract/`

### Deliverables
1. `scripts/replay-contract.mjs` — 完整實作（spec §8.1），**所有後續 phase 用到的旗標都在這 phase 預留 stub**：
   - `--filter=<pattern>` ✓ 完整實作
   - `--target=node|net|both` ✓ 完整實作
   - `--with-teardown` 旗標**保留**（Phase 9 啟用） — 看到 fixture 有 `teardown` 欄位但 flag 未開時 noop；flag 開了才 execute
   - JSONL fixture 格式**辨識**（Phase 14 啟用 live WS replay） — 副檔名 `.jsonl` 進來時拆 frame 但若 WS endpoint 還沒實作就 emit `skip: pending-phase-14`
   - `--against-running-app` 旗標**保留**（Phase 17 啟用） — 不 spawn binary、改用 Tauri command 拿 port
2. `tests/fixtures/contract/_baseline-manifest.json` ✨ — 列每個 fixture 的 `{ skip, expect, owner-phase }`，初始：`/health` `expect: pass`，其他 8 個 `skip: pending-phase-N`
3. `.github/workflows/contract-replay.yml` — 每 PR 跑、Linux + Windows matrix；**先 `actions/setup-dotnet@v4` with `dotnet-version: '10.0.x'`** 才 build sidecar
4. `package.json` 加 scripts: `replay:contract`、`replay:contract:node`（`--target=node`）、`replay:contract:net`（`--target=net`）、`replay:contract:both`（dual-stack parity，Phase 16 用）

### Hard gate
```powershell
pnpm replay:contract --target=net
# 預期輸出：9 fixtures: 1 pass, 8 skip-pending, 0 fail
# exit 0

# 反向驗 harness 自己會抓錯：
node -e "var f=require('./tests/fixtures/contract/connection.connect.mssql.happy.json');f.expected.foo='bogus';require('fs').writeFileSync('/tmp/bogus.json',JSON.stringify(f))"
pnpm replay:contract --filter=connection.connect --fixture-override=/tmp/bogus.json
# 必須 exit 1（self-test：刻意改壞 fixture，harness 應該抓出來）
```

### Rollback
```powershell
git reset --hard net-mig-03-green
git tag -d net-mig-04-green
```

### 動到的檔案
**新增**：`scripts/replay-contract.mjs`、`tests/fixtures/contract/_baseline-manifest.json`、`.github/workflows/contract-replay.yml`
**修改**：`package.json`

### 注意：non-deterministic field ignore list

**完整 IGNORE_PATHS 從一開始就要寫進 `replay-contract.mjs`**（spec §8.1 鎖定）：

```js
const IGNORE_PATHS = [
  // 採集 metadata
  'metadata.elapsed_ms_observed',
  'metadata.captured_at',
  // 連線 / process 識別
  'response.connectionId',
  'response.processId',
  'response.uid',
  'response.token',
  // rawQuery report
  'response.report.duration',
  'response.report.time',
  'response.report.elapsed_ms',
  // getStructure / getTables 真實 DB 統計
  'response[*].tables[*].rows',
  'response[*].tables[*].size',
  'response[*].size',
  'response[*].rows',
  'response[*].dataLength',
  'response[*].indexLength',
  'response[*].avgRowLength',
  'response[*].relpages',
  'response[*].reltuples',
  // getProcesses 活動快照
  'response[*].time',
  'response[*].state',
];
```

每 phase 採集新 fixture 時若發現新 non-deterministic 欄位、立刻加進這 list，commit 進 `scripts/replay-contract.mjs`。**不能讓 phase gate 偶發 fail 拖到下一 phase**。

---

## Phase 5 — Renderer-immutability audit gate

### Goal
機械驗證 Phase 0–4 沒動到 `web/renderer/` + `web/common/`（除 unrelated commit）；建立 audit 機制給後續 phase 持續驗。

### Pre-flight
- Phase 4 gate 綠

### Deliverables
1. `scripts/audit-renderer-untouched.mjs` — `git diff --name-only <baseline>...HEAD -- web/renderer/ web/common/`，每個 changed file 必須在 allowlist
2. `docs/net-migration/renderer-audit-allowlist.txt` ✨ — 格式：每行 `<commit-sha> <file-pattern> <reason>`
3. `.github/workflows/renderer-audit.yml` — 每 PR 跑
4. `package.json` 加 script: `audit:renderer`
5. `docs/net-migration/baseline-tag.txt` — 寫死 baseline tag = `net-mig-00-green`

### Hard gate
```powershell
pnpm audit:renderer
# exit 0（目前 web/renderer/ + web/common/ 應該完全沒動）
```

### Rollback
```powershell
git reset --hard net-mig-04-green
git tag -d net-mig-05-green
```

---

## Phase 6 — Connection group

### Goal
實作 `/api/connection/{test,connect,disconnect,abort,check}` 5 個 endpoint；4 DB 都連得起來；SSH tunnel + SSL + manual-commit + keep-alive 全套設計到位。

### Pre-flight
- Phase 5 gate 綠
- **User 採集 connection 群組 fixture**：對 4 個 dev DB 跑 `pnpm capture:contract -- --target=node --filter=connection.*`，commit 進 `tests/fixtures/contract/`
- `_baseline-manifest.json` 把這 5 × 4 = 20 個 fixture 從 `skip` 翻成 `expect: pass`

### Deliverables
1. `server/Connections/ConnectionService.cs` — 5 actions
2. `server/Connections/ConnectionRegistry.cs`（spec §6.1 完整實作）：
   - `ConcurrentDictionary<uid, ConnectionEntry>`
   - `KeepAliveTimer`（10 分鐘 ping）
   - `ManualCommitConnection` map
   - `LastUsedUtc` + idle sweep（5 分鐘掃、30 分鐘 idle）
   - `singleConnectionMode` 分支
3. `server/Connections/ConnectionConfigBuilder.cs` — per-DB SqlSugar `ConnectionConfig`，含 SSL 檔讀取（`File.ReadAllText`）
4. `server/Connections/SshTunnelService.cs` — `Renci.SshNet` local port forward
5. `server/Connections/IQueryCanceller.cs` + 4 個 per-DB 實作（給 abort 用）
6. `server/Models/Connection/{ConnectionParamsDto, ConnectionResultDto, SshConfigDto, SslConfigDto}.cs`
7. `tests/integration-net/ConnectionTests.cs` — xUnit，跑 4 個 dev DB

### Hard gate
```powershell
pnpm replay:contract --filter=connection.* --target=net
# 預期：20 fixtures: 20 pass, 0 skip, 0 fail
pnpm audit:renderer
# 仍 exit 0
```

### Rollback
```powershell
git reset --hard net-mig-05-green
git tag -d net-mig-06-green
```

### 動到的檔案
**新增**：`server/Connections/**`、`server/Models/Connection/**`、`tests/integration-net/ConnectionTests.cs`、`tests/fixtures/contract/connection.*.{mysql,pg,mssql,sqlite}.happy.json`
**修改**：`tests/fixtures/contract/_baseline-manifest.json`

### 注意
- `singleConnectionMode`: 看 connection params 的 `poolSize` — 若為 `0`，`ConnectionConfigBuilder` 設 `IsSingleConnection = true`，registry 不做 idle sweep（單一連線壞了沒得 fallback）
- SSL：`conn.ca` / `conn.cert` / `conn.key` 是檔路徑時 `File.ReadAllText` 讀進來、放進 connection string 對應欄位
- MySQL 預設 `auth_plugin = caching_sha2_password`，MySqlConnector 原生支援不需特別設

---

## Phase 7 — Schema discovery group

### Goal
實作 `/api/schema/{getStructure,getVersion,rawQuery}` + `/api/databases/{getDatabases,getDatabaseComment}` 5 個 endpoint。**`rawQuery` 是全 app 最常用 endpoint**——這 phase 的核心。

### Pre-flight
- Phase 6 gate 綠
- User 採集這 5 個 endpoint × 4 DB = 20 fixture（含 `getStructure` 大型 schema 的 1 個 stress fixture）
- **`docs/net-migration/perf-baseline.md` 已 commit Node 端基準**：rawQuery 跑 100 次 `SELECT 1` 的 p50/p95/p99 latency（4 DB 各跑一遍）；給這 phase 結束 .NET 端比對用
3. `server/Schemas/SchemaTreeBuilder.cs` — `getStructure` 樹狀組裝
4. `server/Schemas/RawQueryExecutor.cs` — `rawQuery` 走 `db.Ado.GetDataTable(sql, params)`，**支援 multi-statement**（用 `;` split）+ **per-tab transaction context** 整合（為 Phase 13 manual-commit 預留 hook）
5. `tests/fixtures/contract/_baseline-manifest.json` 翻 20 個 fixture
6. `tests/integration-net/SchemaDiscoveryTests.cs`

### Hard gate
```powershell
pnpm replay:contract --filter=schema.getStructure,schema.getVersion,schema.rawQuery,databases.* --target=net
# 預期：20 fixtures: 20 pass, 0 skip, 0 fail
pnpm audit:renderer && exit 0
```

### Rollback
```powershell
git reset --hard net-mig-06-green
git tag -d net-mig-07-green
```

### 額外 deliverable：perf-baseline.md（R14）
Phase 7 結束前產出 `docs/net-migration/perf-baseline.md`（pre-flight 已含 Node 端、這裡補 .NET 端）：
```powershell
# .NET 版（已 spawn）
$netMs = Measure-Command { 1..100 | % { Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:5555/api/schema/rawQuery" -Headers @{ "X-Sidecar-Token" = $token } -Body '...' -ContentType 'application/json' } } | % TotalMilliseconds
# 比 baseline
($netMs / $nodeBaselineMs) -lt 1.5
# 寫進 perf-baseline.md：「.NET p50=Xms p95=Yms p99=Zms vs Node baseline (commit-recap)」
```
超過 1.5x 就 Phase 7 fail、回 Phase 6 profile（不允許「先擱著」）。

---

## Phase 8 — Schema metadata group

### Goal
實作 `/api/schema/{getCollation,getCollations,getEngines,getVariables,useSchema,getProcesses,killProcess}` 7 個 endpoint。

### Pre-flight
- Phase 7 gate 綠
- User 採集 7 endpoint × 適用 DB = 約 20 fixture（`getEngines` 只 MySQL；`getCollations` MySQL/PG/MSSQL；SQLite 大多回空陣列）

### Deliverables
1. `server/Schemas/SchemaMetadataService.cs`
2. `server/Schemas/CollationProvider/{MySql,Pg,Mssql,Sqlite}Collations.cs`（SQLite 回空）
3. `server/Schemas/EngineProvider/MySqlEngines.cs`
4. `server/Schemas/UseSchemaHandler.cs` — MySQL `USE`、PG `SET search_path`、MSSQL `USE [...]`、SQLite no-op
5. `server/Schemas/ProcessListProvider/{...}.cs` + 配對的 kill 實作（per-DB，spec §6.2 表）
6. `tests/integration-net/SchemaMetadataTests.cs`

### Hard gate
```powershell
pnpm replay:contract --filter=schema.getCollation,schema.getCollations,schema.getEngines,schema.getVariables,schema.useSchema,schema.getProcesses,schema.killProcess --target=net
pnpm audit:renderer && exit 0
```

### Rollback
```powershell
git reset --hard net-mig-07-green
git tag -d net-mig-08-green
```

---

## Phase 9 — Schema DDL group

### Goal
實作 `/api/schema/{create,update,delete}` 3 個 endpoint（schema-level CREATE/ALTER/DROP DATABASE）。SQLite 走特殊路徑（`File.Delete` for delete、`Connection.Open()` 觸發 create）。

### Pre-flight
- Phase 8 gate 綠
- User 採集 3 endpoint × 4 DB = 12 fixture，**每個 fixture 帶 paired teardown**（避免 replay 的副作用）

### Deliverables
1. `server/Schemas/SchemaDdlService.cs` — 3 actions
2. `server/Schemas/IDdlGenerator.cs` + `{MySql,Pg,Mssql,Sqlite}DdlGenerator.cs` —— 跨 DB 文法差異收斂
3. **Fixture teardown 機制**：`replay-contract.mjs` 加 `--with-teardown` 旗標，replay 完跑 fixture 內 `teardown` payload
4. `tests/integration-net/SchemaDdlTests.cs`

### Hard gate
```powershell
pnpm replay:contract --filter=schema.create,schema.update,schema.delete --target=net --with-teardown
# 12 fixtures: 12 pass
```

### Rollback
```powershell
git reset --hard net-mig-08-green
git tag -d net-mig-09-green
```

### 注意：SQLite 例外
SQLite 沒 schema 概念，`schema/create` 跟 `schema/delete` 在 SQLite 是「附加 / 卸下 attached database 檔」。fixture 必須對齊 Node 現況（看 `web/main/libs/clients/SQLiteClient.ts` 的 `createSchema` / `dropSchema` 實作）。

---

## Phase 10 — Tables read group

### Goal
實作 10 個 read endpoint：`getColumns`、`getData`、`getCount`、`getOptions`、`getIndexes`、`getChecks`、`getDdl`、`getKeyUsage`、`searchColumns`、`getForeignList`。

`getKeyUsage` 含 **inbound + outbound FK**——v4 漏的 reviewer audit 已修。

### Pre-flight
- Phase 9 gate 綠
- User 採集 10 endpoint × 4 DB ≈ 40 fixture，**含 stress test**（1M 行表的 `getData` 分頁 / `getCount`）

### Deliverables
1. `server/Tables/TableQueryService.cs` — `getData` / `searchColumns` / `getCount` / `getForeignList`，**全用 SqlSugar parameterized query**（搬移時順手收緊 R13 SQL injection 防護，spec §6.5 風格）
2. `server/Tables/TableSchemaService.cs` — `getColumns` / `getIndexes` / `getChecks` / `getOptions`
3. `server/Tables/TableDdlReadService.cs` — `getDdl`，**per-DB raw SQL**（SqlSugar `GetCreateTableSql()` 不存在）：
   - MySQL: `SHOW CREATE TABLE`
   - PG: `pg_get_tabledef()` 不可用 → 自行組裝 from `INFORMATION_SCHEMA.columns + pg_constraint`
   - MSSQL: `OBJECT_DEFINITION()` + `sp_helpconstraint`
   - SQLite: `SELECT sql FROM sqlite_master WHERE name=?`
4. `server/Tables/ForeignKeyResolver.cs` — `getKeyUsage`（inbound + outbound），per-DB raw SQL（spec §2.2 對應的 4 種 query）
5. `tests/integration-net/TablesReadTests.cs`

### Hard gate
```powershell
pnpm replay:contract --filter=tables.getColumns,tables.getData,tables.getCount,tables.getOptions,tables.getIndexes,tables.getChecks,tables.getDdl,tables.getKeyUsage,tables.searchColumns,tables.getForeignList --target=net
# 40 fixtures: 40 pass
# Stress：getData on 1M-row table, p99 < Node baseline × 1.5

# bogus-mapping.md 已 commit（Phase 11 entry gate prerequisite）
Test-Path docs/net-migration/bogus-mapping.md
```

### Rollback
```powershell
git reset --hard net-mig-09-green
git tag -d net-mig-10-green
```

### 額外 deliverable：bogus-mapping.md（**Phase 11 entry gate prereq**）
Phase 10 結束前產出 `docs/net-migration/bogus-mapping.md`（這 phase 的尾聲事項）：
- 來源：`web/common/libs/fakerCustom.ts`（看 Faker.js 使用慣例）+ `web/common/libs/fieldTypes.ts`（看 column type 列舉）
- 內容：兩張對映表
  1. **Type 對映**：NUMBER / FLOAT / TEXT / BLOB / BIT / BOOLEAN / ARRAY / DATE / DATETIME / JSON 對到 Bogus call（如 NUMBER → `bogus.Random.Number()`、TEXT → `bogus.Lorem.Sentence()`）
  2. **Semantic 對映**：email / url / fullName / firstName / lastName / companyName / lorem.sentence / internet.ip / phone / uuid / password / streetAddress 對到 Bogus call（`bogus.Internet.Email()` 等）
- User review + commit 才視為完成；沒 commit 不開 Phase 11

---

## Phase 11 — Tables write group

### Goal
實作 8 個 write endpoint：`create`、`alter`、`duplicate`、`truncate`、`drop`、`updateCell`、`deleteRows`、`insertFakeRows`。**`updateCell` 帶 ~150 LOC per-type per-DB escape 邏輯**——v4 漏。

`alter` 含 cascade FK：drop column 前先掃 inbound FK（用 `ForeignKeyResolver` from Phase 10），按順序 `DROP CONSTRAINT` → `DROP COLUMN`。

### Pre-flight
- Phase 10 gate 綠
- **`docs/net-migration/bogus-mapping.md` 已 commit**（R21 entry gate）—— 對應 `web/common/libs/fakerCustom.ts` 跟 `common/fieldTypes.ts`，至少涵蓋 NUMBER/FLOAT/TEXT/BLOB/BIT/BOOLEAN/ARRAY/DATE/DATETIME/JSON 10 種 column type + 12+ semantic 對映（email/url/fullName/etc.）。沒這份文件**不開 Phase 11**
- User 採集 8 endpoint × 4 DB ≈ 32 fixture，每個 fixture **paired teardown**

### Deliverables
1. `server/Tables/TableDdlService.cs` — 5 DDL actions
2. `server/Tables/CascadeFkResolver.cs` — drop column / drop table 前的 FK 預掃（用 Phase 10 的 ForeignKeyResolver）
3. `server/Tables/TableDataMutationService.cs` — `updateCell` / `deleteRows` / `insertFakeRows`
4. `server/Tables/CellValueEncoder.cs` ✨ — **解 v4 漏的 ~150 LOC per-type per-DB escape**：
   - 介面 `ICellValueEncoder { string Encode(object value, ColumnType type, DbDialect dialect); }`
   - 實作：`MySqlCellValueEncoder` / `PgCellValueEncoder` / `MssqlCellValueEncoder` / `SqliteCellValueEncoder`
   - 對 NUMBER / FLOAT / TEXT / BLOB / BIT / BOOLEAN / ARRAY / NULL 8 種 type 各自處理
5. `server/Tables/FakeRowGenerator.cs` — 跟 `bogus-mapping.md`（Phase 10 deliverable）對齊
6. `server/Tables/SqliteAlterEmulator.cs` — SQLite 不支援 `DROP COLUMN`、用以下 6-step CREATE-COPY-DROP-RENAME emulate（對齊 SQLite 官方 ALTER TABLE workaround）：
   1. `PRAGMA foreign_keys = OFF;`
   2. `BEGIN TRANSACTION;`
   3. `CREATE TABLE <new> (...)` — 沒 dropped column 的新 schema；保留 indexes、triggers definition
   4. `INSERT INTO <new> SELECT <kept_cols> FROM <old>;`
   5. `DROP TABLE <old>; ALTER TABLE <new> RENAME TO <old>;`
   6. 重建 indexes / triggers；`COMMIT;` `PRAGMA foreign_keys = ON;`
7. `tests/integration-net/TablesWriteTests.cs`

### Hard gate
```powershell
pnpm replay:contract --filter=tables.create,tables.alter,tables.duplicate,tables.truncate,tables.drop,tables.updateCell,tables.deleteRows,tables.insertFakeRows --target=net --with-teardown
# 32 fixtures: 32 pass

# Cascade FK e2e：建子表 FK→drop 父欄→驗 cascade DDL 對：
pnpm test:integration-net --filter=CascadeFk
```

### Rollback
```powershell
git reset --hard net-mig-10-green
git tag -d net-mig-11-green
```

---

## Phase 12 — Views + Triggers + Routines + Functions + Schedulers + Users

### Goal
29 個 endpoint 一次平移：8 views（含 4 materialized view PG only）+ 5 triggers + 4 routines + 6 functions（含 PG 的 2 個 trigger function、v4 漏）+ 5 schedulers + 1 users。

低複雜度、reuse 同一個 CRUD 樣板，groupable into 1 phase。

### Pre-flight
- Phase 11 gate 綠
- User 採集 fixture，per-endpoint × DB applicability 如下表（共 ~60 fixture）：

| Endpoint group | MySQL | PG | MSSQL | SQLite | Total |
|---|---|---|---|---|---|
| views basic 4（getInformations/drop/alter/create） | ✓ | ✓ | ✓ | ✓ | 16 |
| views materialized 4 | ✗ | ✓ | ✗ | ✗ | 4 |
| triggers 5 | ✓ | ✓ | ✓ | ✓ | 20 |
| routines 4 | ✓ | ✓ | ✓ | ✗（SQLite 無 stored procedure） | 12 |
| functions basic 4 | ✓ | ✓ | ✓ | ✗ | 12 |
| functions triggerFunction 2 | ✗ | ✓ | ✗ | ✗ | 2 |
| schedulers 5（events/pg_cron/Agent jobs） | ✓ | ✓（pg_cron 安裝才有） | ✓（SQL Agent 跑才有） | ✗ | 11-15 |
| users 1 | ✓ | ✓ | ✓ | ✗（SQLite 無 user 概念） | 3 |
| **小計** |  |  |  |  | **~80**（依環境可能 70-85） |

注意 60 是樂觀估計、實況可能 80。整 phase 仍 3 天，因為 5 個 service class 用同一個 CRUD 樣板、reuse 度高。

### Deliverables
1. `server/Views/{ViewService, MaterializedViewService}.cs`（後者 PG only）
2. `server/Triggers/TriggerService.cs`（含 `enableTrigger` / `disableTrigger`）
3. `server/Routines/RoutineService.cs`
4. `server/Functions/{FunctionService, TriggerFunctionService}.cs`（**TriggerFunction 是 PG 獨立物件、v4 漏**）
5. `server/Schedulers/SchedulerService.cs` — **per-DB scheduler 模型完全不同**：
   - MySQL: `SHOW EVENTS` + `CREATE EVENT`
   - PG: `pg_cron` 擴充（不存在就回空 + 給友善錯誤）
   - MSSQL: `msdb.dbo.sysjobs`（需 SQL Agent 服務跑）
6. `server/Users/UserService.cs`
7. `tests/integration-net/Phase12Tests.cs`

### Hard gate
```powershell
pnpm replay:contract --filter=views.*,triggers.*,routines.*,functions.*,schedulers.*,users.* --target=net --with-teardown
# 60 fixtures: 60 pass
```

### Rollback
```powershell
git reset --hard net-mig-11-green
git tag -d net-mig-12-green
```

### 注意
- pg_cron 不存在時：`SchedulerService` catch `Npgsql.PostgresException` SQLSTATE `42883`，回 `[]`（renderer 已知會處理空清單）
- MSSQL Agent 沒跑時同理：catch `SqlException` SQLSTATE `S0001`、message 含 "SQLServerAgent"，回 `[]`

---

## Phase 13 — AI + manual-commit + file I/O

### Goal
8 個 endpoint：`/api/ai/translate-column` + 4 個 manual-commit (`commitTab`/`rollbackTab`/`destroyConnectionToCommit`/`killTabQuery`) + `/api/app/{readFile,writeFile}` + `/api/schema/{export,abortExport}`（**HTTP 啟動，WS 進度由 Phase 14 處理；export endpoint 在這 phase 先實作 HTTP 啟動部分**）。

→ 工期 2 天可完成因為 manual-commit pattern 在 Phase 6 ConnectionRegistry 已預埋 hook、`updateCell` 邏輯 Phase 11 已寫。

### Pre-flight
- Phase 12 gate 綠
- User 採集 8 endpoint fixture（manual-commit 4 個要對齊 query lifecycle，user 親手在 query tab 做完整 CRUD 收集）

### Deliverables
1. `server/Ai/AiService.cs` — Google Translate proxy（**不是 Anthropic API**），`HttpClient` 帶 `client=gtx` query
2. `server/Schemas/ManualCommitController.cs` — `commitTab`/`rollbackTab`/`destroyConnectionToCommit`/`killTabQuery` 4 actions
3. `server/Application/FileService.cs` — `readFile` / `writeFile`，路徑限制在 `%APPDATA%\com.tw199501.antares2\` 子樹（防 path traversal）
4. `server/Schemas/ExportController.cs` — `export` 啟動 task、回 `{ taskId }`；`abortExport` 對 task 發 cancel
5. `server/Workers/TaskRegistry.cs`（先做骨架，Phase 14 / 15 完整使用）
6. `tests/integration-net/{AiTests, ManualCommitTests, FileServiceTests}.cs`

### Hard gate
```powershell
pnpm replay:contract --filter=ai.*,schema.commitTab,schema.rollbackTab,schema.destroyConnectionToCommit,schema.killTabQuery,app.readFile,app.writeFile,schema.export,schema.abortExport --target=net
# fixture 數 ~ 30
```

### Rollback
```powershell
git reset --hard net-mig-12-green
git tag -d net-mig-13-green
```

### 注意
- Manual-commit 的 e2e test：開 query tab → 關 autocommit → INSERT 一筆 → `killTabQuery`（cancel 但 connection 仍在）→ `rollbackTab` → 換新 connection 驗 row 不存在
- File path traversal：`Path.GetFullPath(input).StartsWith(Path.GetFullPath(appDataDir))` 必須為 true，否則回 401

---

## Phase 14 — WS export task service

### Goal
`/ws/export` WebSocket 端點 + `BaseExporter` + 3 個 per-DB exporter（MySQL/PG/MSSQL，SQLite 不支援 export 沿用 Node 行為）。

### Pre-flight
- Phase 13 gate 綠
- User 採集 **JSONL fixture**（不是普通 JSON）— `pnpm capture:contract -- --target=node --kind=ws-export --table=<small_table>`，產出 frame-by-frame 紀錄

### Deliverables
1. `server/WebSockets/ExportHub.cs` — raw WebSocket，`OnConnectedAsync` 階段驗 `?token=`（spec §3.2、R7）
2. `server/Workers/ExportTaskService.cs` — `BackgroundService`，`Channel<TaskMessage>` 進度通道
3. `server/Workers/ProgressBroadcaster.cs` — channel reader → WebSocket sender
4. `server/Exporters/BaseExporter.cs` — 抽象主流程
5. `server/Exporters/{MysqlExporter, PgExporter, MssqlExporter}.cs`
6. `replay-contract.mjs` 加 JSONL fixture 支援（frame-by-frame deep-equal、order-preserving）
7. `tests/integration-net/ExportTests.cs`

### Hard gate
```powershell
pnpm replay:contract --filter=ws-export.* --target=net
# 預期：3 fixtures (mysql/pg/mssql happy 各一) all pass
# 進度 frame 數 / 順序 / payload 全 match
```

### Rollback
```powershell
git reset --hard net-mig-13-green
git tag -d net-mig-14-green
```

### 注意：DDL 輸出語意等價
不追求 byte-equality（spec §6.4 + R5），改：
- `Normalizer` 在 replay 比對前套：strip whitespace、lowercase keywords、sort columns
- 額外 round-trip test：export 出來的 SQL 在另一個空 DB 跑、再 export → 兩次輸出 normalize 後等

---

## Phase 15 — WS import task service

### Goal
`/ws/import` WebSocket + 3 個 per-DB importer + cancel 釋鎖 ≤ 30s。

### Pre-flight
- Phase 14 gate 綠
- User 採集 JSONL fixture — happy + cancel-mid-stream 各 1 個 per DB，至少 3 happy + 1 cancel = 4 fixture

### Deliverables
1. `server/WebSockets/ImportHub.cs`
2. `server/Workers/ImportTaskService.cs`
3. `server/Importers/{Base, MysqlImporter, PgImporter, MssqlImporter}.cs`
4. `query-error` 訊息類型（**v4 漏**——非致命單句錯誤、import 繼續）
5. `tests/integration-net/ImportTests.cs` — 含 cancel test：發 import → 中途 abort → 30 秒內 transaction rollback

### Hard gate
```powershell
pnpm replay:contract --filter=ws-import.* --target=net
# 4 fixtures: 4 pass
```

### Rollback
```powershell
git reset --hard net-mig-14-green
git tag -d net-mig-15-green
```

---

## Phase 16 — Full-baseline lock + dual-stack parity proof

### Goal
所有 endpoint 已實作；**recapture 全部 fixture 對 .NET binary**；commit 為新 baseline；同時驗 Node 跟 .NET 都通過 = parity proof。

### Pre-flight
- Phase 15 gate 綠
- User 跑 full recapture：`pnpm capture:contract -- --target=net`（這次 source 標 `recaptured-from-net-binary`）

### Deliverables
1. `tests/fixtures/contract/_baseline-manifest.json` — 全部翻 `expect: pass`、source 改 `recaptured-from-net-binary-2026-05-XX`
2. 重新採集後的全部 fixture commit
3. `.github/workflows/contract-replay.yml` — default `--target=net`，加 `--target=node` matrix job 驗 dual-stack
4. `docs/net-migration/parity-report.md` — 列每個 endpoint 在 Node / .NET 兩端的 fixture diff（應全為空）

### Hard gate
```powershell
# 1) Fixture replay 雙 target 都 pass（dual-stack parity）
pnpm replay:contract --target=net
# 預期：N fixtures: N pass, 0 skip, 0 fail
#   N ≈ 250+（每個 endpoint 1+ 個 fixture × 適用 DB；81 endpoint 不代表 81 fixture，多數 endpoint 跨 4 DB 有 4 個 fixture，少數 PG-only / MySQL-only 只有 1 個）

pnpm replay:contract --target=node
# 同一個 N，全 pass — dual-stack parity

# 2) E2E specs 對 .NET sidecar 跑通（cutover 前最後驗證）
$env:ANTARES_SIDECAR_TARGET = 'net'
pnpm test:e2e
# 預期：8 specs: 8 pass（5 smoke + 3 mssql），exit 0
# 失敗就回 Phase 6-15 找 endpoint mismatch，不 cutover
```

### Rollback
```powershell
git reset --hard net-mig-15-green
git tag -d net-mig-16-green
```

---

## Phase 17 — Sidecar.rs cutover

### Goal
**單一一行修改**：Tauri 從 spawn Node 切到 spawn .NET。Node binary 仍 buildable、`scripts/build-sidecar.mjs` 不刪、`web/main/` 不動。一行 `git revert` 可回滾。

### Pre-flight
- Phase 16 gate 綠
- 4 platform CI 上一個 push 仍綠

### Deliverables
1. `src-tauri/src/sidecar.rs` —— 改 path 字串值：Windows `"sidecar/antares-server.cjs"` → `"antares-server.exe"`，Unix `"sidecar/antares-server.cjs"` → `"antares-server"`（兩個 `#[cfg]` block 各改一行）
2. `src-tauri/src/sidecar.rs` —— `wait_for_ready` timeout 5s → 10s（cold start 緩衝、第 3 行改）
3. `tauri.conf.json` 跟 3 個 platform overlay：`bundle.resources` 移除 cjs/workers/node_modules，加 `antares-server[.exe]`
4. `scripts/stage-resources.mjs` —— default `--target=net`
5. `scripts/tauri-build.mjs` —— 呼叫 `build-net-sidecar.mjs` 取代 `build-sidecar.mjs`
6. `docs/release-notes-v0.9.0.md` —— release notes 草稿（強調：Firebird 砍、體積縮 30%、cascade FK 改善、相容性無變化）

### sidecar.rs 改動量機械驗
```powershell
# diff 限制：±8 lines（path × 2 cfg block + timeout × 1 = 4 改動 × ±2 = 8 max）
$diffLines = (git diff net-mig-16-green..HEAD -- src-tauri/src/sidecar.rs | Where-Object { $_ -match '^[+-][^+-]' }).Count
if ($diffLines -gt 8) { throw "sidecar.rs changed too much: $diffLines lines" }
```

### Hard gate
```powershell
# 1) 4 platform build 全綠
pnpm tauri:build  # 跑 GitHub Actions matrix

# 2) e2e 通
pnpm test:e2e

# 3) 安裝後對 Tauri-spawned sidecar 跑 replay
pnpm replay:contract --against-running-app
# 預期 exit 0
```

### Rollback
```powershell
# 單一 git revert（**不是 reset**）
git revert net-mig-17-cutover
git push
# Node 立刻回來（Node bundle 還在 sidecar/，scripts/build-sidecar.mjs 還在）
```

### 動到的檔案
**修改**：`src-tauri/src/sidecar.rs`、`src-tauri/tauri.conf.json` + 3 overlay、`scripts/stage-resources.mjs`、`scripts/tauri-build.mjs`、`.github/workflows/{test-build,release}.yml`
**新增**：`docs/release-notes-v0.9.0.md`

---

## Phase 18 — Node deprecation cleanup

> ⚠️ **Pre-flight 包含「等 ≥ 2 個 release tag」**——這是時間 gate，不是技術 gate。

### Goal
Node sidecar 完全退場：刪 `web/main/`、刪 build script、刪 staging BFS、刪 Node deps、CI workflow 移除 Node download step。

### Pre-flight
- Phase 17 跨上 master、tagged 為 `v0.9.0`
- **至少 2 個 release tag** 已發（例如 `v0.9.1`、`v0.9.2`）
- **「無嚴重 bug」客觀條件（取代主觀判斷）**：
  - `gh issue list --milestone v0.9.x --label "sev:critical","sev:high" --state open` 結果為空
  - 最後 14 天無新 crash report（檢視 GitHub issue label `crash` + sentry / log monitoring）
  - 任一條件不滿足就**不開動 Phase 18**，等
- `pnpm replay:contract --target=net` 仍綠

### Deliverables
1. **`tests/` import audit** ✨—— `Select-String -Pattern "from ['""]\\.\\./web/main|from ['""]@/main|from ['""]common/main" -Path tests/**/*.ts -Recurse` 找 cross-imports；任何 hit 必須先改掉（要嘛 inline、要嘛 fixture 化）才能進下一步
2. **刪**：`web/main/**`、`scripts/build-sidecar.mjs`、`sidecar/antares-server.cjs`
3. **刪**：`web/main/**/*.test.ts` 對應的 unit specs（co-located 測試也跟著走）
4. **修改 `scripts/check-coverage.mjs`** —— exclusion list 移除 `web/main/` 相關項；coverage zone 重新設（剩 `web/common/` + `web/renderer/components/*` excluded + ipc-api/stores/composables/libs included）
5. **新增 `docs/net-migration/coverage-post-phase18.md`** ✨—— 紀錄新 baseline（lines/branches 分子分母、zone 重設後 target、跟 Phase 17 baseline 的差距）
6. **修改 `package.json`** —— 移除 ~20 個 backend npm package：`fastify`、`@fastify/*`、`mssql`、`mysql2`、`pg`、`pg-query-stream`、`pgsql-ast-parser`、`better-sqlite3`、`node-firebird`、`@heroku/socksv5`、`ssh2`、`@fabio286/ssh2-promise`、`@faker-js/faker`、`bindings`、`file-uri-to-path`
7. **簡化 `scripts/stage-resources.mjs`** —— 移掉 Node BFS transitive deps walk、移掉 `--target=node`/`both` mode（永遠 net）
8. **CI workflow** —— 移除 4 個「Download Node.js binary for ...」step（保留 `setup-dotnet@v4` 給 .NET build）
9. **`.gitignore`** —— 移 `sidecar/node*`、加 `sidecar-net/`

### Hard gate
```powershell
# 不能找到任何殘留（PowerShell 5.1 相容寫法）
$residue = Get-ChildItem -Path .github,scripts,src-tauri -Recurse -Include *.yml,*.mjs,*.rs,*.json |
           Select-String -Pattern 'web/main|antares-server\.cjs|build-sidecar\.mjs|Download Node\.js binary'
if ($residue) { throw "Found Node sidecar residue: $residue" }

# tests/ 不再 import web/main（同樣用 Get-ChildItem | Select-String pipeline）
$crossImport = Get-ChildItem -Path tests -Filter *.ts -Recurse |
               Select-String -Pattern "from ['""]\.\./web/main|from ['""]@/main|from ['""]common/main"
if ($crossImport) { throw "tests/ still imports web/main: $crossImport" }

# Coverage gate 仍綠（新 baseline）
pnpm test:coverage:check

# Replay 仍綠
pnpm replay:contract --target=net

# 4 platform build 仍綠（CI matrix）

# Post-baseline 紀錄存在
if (-not (Test-Path docs/net-migration/coverage-post-phase18.md)) { throw "missing coverage baseline doc" }
```

### Rollback
```powershell
git reset --hard net-mig-17-green
git tag -d net-mig-18-green
```

⚠️ Phase 18 rollback 在實務上很少做——使用者已經跑 .NET 兩個 release，Node 程式碼回來也沒人會用。但機制保留。

---

## 3. Risk register（plan-specific，補充 spec §9）

| ID | 風險（plan 層級） | 緩解 |
|----|------|------|
| P-1 | Phase 7 `rawQuery` baseline 性能不過 1.5x | Phase 7 早 fail、回到 phase 6 不繼續；profile + 看是 Microsoft.Data.Sqlite 還是別處慢 |
| P-2 | Phase 11 `updateCell` per-type per-DB escape 比預期複雜 | Phase 11 拉長 1 天（保留 buffer），仍超時就 split phase（11a read-write basic / 11b cell escape） |
| P-3 | Phase 14/15 WS fixture 採集 user 沒空 | 該 phase 卡住、不 unblock 後續；plan 排在工期後段（user 已熟悉採集流程） |
| P-4 | Phase 17 cutover 後 cold start > Tauri timeout | Phase 2 已量測，pre-flight 條件包含「cold start < 5s」；超就調 `wait_for_ready` 為 10s 已預設 |
| P-5 | Subagent dispatch 把 lint errors 推給 supervisor | 對應 v2 plan 的學到——subagent prompt 強制自驗 |
| P-6 | Phase 中途 user 不在線、phase 半途 commit | commit 規則：phase 內 sub-step commit OK，但 tag 只在 hard gate 過後打 |

---

## 4. 工期表（39 天 full-time / 12 週 half-time）

```
Phase  Days  Cumulative
0       1      1
1       1      2
2       2      4
3       1      5
4       2      7
5       1      8
6       3     11
7       3     14
8       2     16
9       2     18
10      3     21
11      3     24
12      3     27
13      2     29
14      3     32
15      3     35
16      2     37
17      2     39   ← v0.9.0 release
18      2     41+  ← 2 release 後（≥ 4 週）
```

---

## 5. 不在這個 plan 的範圍

對齊 spec §10：
- Firebird 支援、Node 並行 runtime、renderer/Tauri 邏輯改、新功能、AOT/Trim、IPC contract 重構、Admin.NET fork、MCP server、openapi codegen、rename antares2

---

## 6. References

- **Spec**: [`2026-05-05-net-sidecar-migration-design.md`](../specs/2026-05-05-net-sidecar-migration-design.md)
- **Backend inventory**: [`2026-05-03-backend-inventory.md`](./2026-05-03-backend-inventory.md)
- **Frontend test rollout v2**: [`2026-05-03-frontend-unit-test-rollout-v2-remaining.md`](./2026-05-03-frontend-unit-test-rollout-v2-remaining.md)
- **Deprecated v4**: [`2026-05-03-net-sqlsugar-execution-plan.md`](./2026-05-03-net-sqlsugar-execution-plan.md)
- **CLAUDE.md**: project conventions
