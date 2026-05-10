# Endpoint Coverage Diff — Node baseline vs .NET sidecar

> **Generated:** 2026-05-10
> **Baseline ref:** commit `03aa211^` (parent of `chore(net-mig)!: phase 18 — delete legacy Node sidecar wholesale`)
> **Current ref:** dev HEAD
> **Method:**
>   - Node endpoints: `for f in tables schema connection databases triggers routines functions schedulers users views ai application; do git show 03aa211^:web/main/routes/$f.ts | grep -oE "app\.post\('/api/[^']+'" ; done`
>   - .NET endpoints: `grep -rE 'HttpPost\("[^"]+"' server/ | grep -oE 'HttpPost\("/[^"]+"' | sort -u`

## TL;DR — 反直覺結論

**端點 URL 100% covered** — Node 的 76 個端點全部都有對應的 `[HttpPost("/api/...")]` C# 實作。.NET 還多了 2 個(`listDatabases`, `echo`)。所以使用者反映的「.NET 後端變空 / 沒反應」**不是端點漏實作**,是 **endpoint 內部行為差異**:

- **DTO shape drift** — 同名端點回不同 JSON shape,renderer destructure 拿到 undefined → UI 顯空白(已知例:`getDatabases` 回 `[{database:"x"}]` 應該是 `["x"]`,當時修在 commit `086c941`)
- **SQL behavior bug** — 同樣 SQL 邏輯遷移時改寫,踩 SqlSugar `DbMaintenance` 對 reserved word table name 不 quote 等 footgun(per CLAUDE.md `### .NET sidecar gotchas`)
- **Comments / metadata fields silently dropped** — 像 `TableSummaryDto.{Rows,Size,Collation}`、`RawFieldDto.Comment`、`TableDataDto.Duration` 都是 .NET 忘了 populate(本 session 已修了 5 個 — `e0c88dc`/`e7d3553`/`d3f69b5`/`dbbfd9c`/`46d1620`)
- **Renderer click handler missing wire** — 端點有,但渲染端 onClick 沒 emit / 沒 invoke(候選:新增欄位按鈕無反應 — 屬本計畫 T4)

## 端點 1:1 對照表

### connection (5 + 1)
| Node | .NET | Status |
|------|------|--------|
| `/api/connection/abort` | ✓ | OK |
| `/api/connection/check` | ✓ | OK |
| `/api/connection/connect` | ✓ | OK |
| `/api/connection/disconnect` | ✓ | OK |
| `/api/connection/test` | ✓ | OK |
| — | `/api/connection/listDatabases` | New in .NET (commit 80726d3) |

### databases (2)
| Node | .NET | Status |
|------|------|--------|
| `/api/databases/getDatabaseComment` | ✓ | **Verify behavior** — 表描述編輯後寫回路徑 |
| `/api/databases/getDatabases` | ✓ | DTO shape fixed (086c941) |

### schema (21)
| Node | .NET | Status |
|------|------|--------|
| `/api/schema/abortExport` | ✓ | OK |
| `/api/schema/abortImportSql` | ✓ | OK |
| `/api/schema/commitTab` | ✓ | OK |
| `/api/schema/create` | ✓ | **Suspect** — 使用者說「建立 schema 點下去空白」,renderer wire 或 modal 渲染 bug |
| `/api/schema/delete` | ✓ | OK |
| `/api/schema/destroyConnectionToCommit` | ✓ | OK |
| `/api/schema/export` | ✓ | OK |
| `/api/schema/getCollation` | ✓ | OK |
| `/api/schema/getCollations` | ✓ | OK |
| `/api/schema/getEngines` | ✓ | OK |
| `/api/schema/getProcesses` | ✓ | `[User]` reserved word fixed (dbbfd9c); inline ref binding fixed (本 session) |
| `/api/schema/getStructure` | ✓ | T1-T3 schema-tree gaps fixed (dbbfd9c, e7d3553) |
| `/api/schema/getVariables` | ✓ | **Verify** |
| `/api/schema/getVersion` | ✓ | OK |
| `/api/schema/importSql` | ✓ | OK |
| `/api/schema/killProcess` | ✓ | OK |
| `/api/schema/killTabQuery` | ✓ | OK |
| `/api/schema/rawQuery` | ✓ | OK |
| `/api/schema/rollbackTab` | ✓ | OK |
| `/api/schema/update` | ✓ | **Suspect** — 表描述編輯可能透過此 endpoint,Verify 寫回路徑 |
| `/api/schema/useSchema` | ✓ | OK |

### tables (18)
| Node | .NET | Status |
|------|------|--------|
| `/api/tables/alter` | ✓ | **Suspect** — 新增欄位 / 編輯欄位 走此 endpoint,T4-T5 重點驗證 |
| `/api/tables/create` | ✓ | Verify |
| `/api/tables/deleteRows` | ✓ | Verify |
| `/api/tables/drop` | ✓ | Verify |
| `/api/tables/duplicate` | ✓ | Verify |
| `/api/tables/getChecks` | ✓ | OK (per CLAUDE.md hand-rolled MSSQL path) |
| `/api/tables/getColumns` | ✓ | comments fixed (e0c88dc) |
| `/api/tables/getCount` | ✓ | OK |
| `/api/tables/getData` | ✓ | comments + duration fixed (e0c88dc, d3f69b5) |
| `/api/tables/getDdl` | ✓ | Verify |
| `/api/tables/getForeignList` | ✓ | Verify |
| `/api/tables/getIndexes` | ✓ | OK (hand-rolled MSSQL) |
| `/api/tables/getKeyUsage` | ✓ | DTO shape fixed earlier |
| `/api/tables/getOptions` | ✓ | OK |
| `/api/tables/insertFakeRows` | ✓ | Verify |
| `/api/tables/searchColumns` | ✓ | OK |
| `/api/tables/truncate` | ✓ | Verify |
| `/api/tables/updateCell` | ✓ | Verify |

### triggers / routines / functions / schedulers / views / users / ai / app (1:1 全 covered)
端點全部存在,行為個別未驗證。屬於使用者後續實機操作觀察到問題才細查的範圍。

## 後續行動

### Audit findings 驅動 plan tasks
- **T3** — 表描述編輯 bug: 從 `/api/databases/getDatabaseComment` 反向找 setter (可能是 `/api/schema/update` 或新加 `/api/databases/setDatabaseComment`?). MSSQL 路徑要 `EXEC sp_addextendedproperty` / `sp_updateextendedproperty 'MS_Description', ...`.
- **T4** — 新增欄位 click 沒反應: 9 成是 renderer 端 click handler 沒 wire 或 modal 沒開啟,對應的 `/api/tables/alter` endpoint 後端可能 OK. 從 `WorkspaceTabPropsTable.vue` 「新增」按鈕的 `@click` 開始追.
- **T5** — 全 CRUD round-trip: 用上表 `Verify` 標的 endpoint 一個個實機點過 + DB 真寫回確認.

### 沒在這次 audit 涵蓋
- WebSocket endpoints (`/ws/export`, `/ws/import`) — Node 跟 .NET 都有,行為差異不在此本 audit 範圍
- DTO field-level diff — endpoint URL 比對只能找 URL 缺漏,DTO shape 錯誤要看 `tests/fixtures/contract/*.json` replay 結果
