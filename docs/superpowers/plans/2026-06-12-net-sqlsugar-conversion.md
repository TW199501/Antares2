# .NET Sidecar SqlSugar Conversion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:dispatching-parallel-agents for Wave 1; each lane agent follows superpowers:test-driven-development + verification-before-completion. Steps use `- [ ]` checkboxes.

**Goal:** Convert all convertible hand-written SQL in `server/` to SqlSugar's cross-dialect API (`Insertable/Updateable/Deleteable` for data CRUD, `DbMaintenance` for DDL + catalog), executed as ~10 parallel service-file lanes, each self-verified by TDD, integrated by the supervisor — wire contract unchanged.

**Architecture:** Each user connection holds an `ISqlSugarClient` (`ConnectionRegistry.Entry.Db`, flavor in `Entry.Client`). Today ~110 sites use `entry.Db.Ado.*` with hand-built per-dialect SQL. SqlSugar's API is dialect-agnostic, so 4-way branches collapse to one call. Furion auto-exposes service methods as endpoints → only method bodies change.

**Tech stack:** .NET 10, Furion 4.9.8, SqlSugarCore 5.1.4.214, xUnit (`tests/integration-net/`).

---

## Constraints (hard)
- **No git worktree** (CLAUDE.md + `.claude/hooks/no-worktree.mjs`); work on `dev`, isolate with `git stash`.
- **Wire contract frozen:** payloads + `{ status, response }` shapes byte-compatible with `tests/fixtures/contract/*.json`, `web/renderer/ipc-api/*.ts`, `*.test.ts`. Keep `[NonUnify]`; keep HTTP 200 + envelope-error.
- **Build check = `error CS` only** (MSB file-lock from the live dev sidecar is benign; restart via Ctrl-C, never taskkill a live Tauri-owned sidecar).
- Dev sidecar = `dotnet run` on 5555; `server/` edits need a `pnpm tauri:dev` restart.

## Conversion pattern table (authoritative, from SqlSugar knowledge MCP)
| Raw today | SqlSugar replacement |
| --- | --- |
| `INSERT INTO t (...) VALUES (...)` | `db.Insertable(dict).AS(t).ExecuteCommand()` |
| `UPDATE t SET c=@v WHERE pk` | `db.Updateable(dict).AS(t).WhereColumns(keyCols).ExecuteCommand()` |
| `DELETE FROM t WHERE pk` | `db.Deleteable<object>().AS(t).Where(dict|sql).ExecuteCommand()` |
| `CREATE/DROP/TRUNCATE/ALTER col`, index, PK, remark | `db.DbMaintenance.{CreateTable,DropTable,TruncateTable,AddColumn,DropColumn,UpdateColumn,RenameColumn,RenameTable,AddPrimaryKey,DropConstraint,CreateIndex,CreateView,DropView,DropProc,DropFunc,AddDefaultValue,AddTableRemark,AddColumnRemark}` |
| catalog `SELECT … information_schema/sys.*` | `db.DbMaintenance.{GetTableInfoList,GetColumnInfosByTableName,GetViewInfoList,GetIndexList,GetProcList,GetFuncList,GetTriggerNames,GetPrimaries,GetIsIdentities,GetDataBaseList,IsAny*}` → remap to existing DTO |

`table` qualifier rule (all lanes): `var table = string.IsNullOrEmpty(p.Schema) ? p.Table! : $"{p.Schema}.{p.Table}";` then `.AS(table)`. Always wrap renderer values with `JsonValue.Unwrap(...)` before they enter a dict/param.

---

## WAVE 0 — shared foundation (sequential; supervisor does this BEFORE dispatching lanes)

### Task 0a: Copy plan + spec into repo
- [ ] `mkdir -p docs/superpowers/plans docs/superpowers/specs`; copy this plan → `docs/superpowers/plans/2026-06-12-net-sqlsugar-conversion.md` and the brainstorm spec → `docs/superpowers/specs/2026-06-12-net-sqlsugar-conversion-design.md`; commit `docs(plan): net SqlSugar conversion plan + spec`.

### Task 0b: `JsonValue.Unwrap` helper (gate 2) — TDD
- [ ] Test `tests/integration-net/Infrastructure/JsonValueTests.cs`: string→string, `42`→`42L`, `1.5`→`1.5d`, `true`→bool, `null`→null, non-JsonElement passthrough. Run → fail.
- [ ] Implement `server/Infrastructure/JsonValue.cs`:
```csharp
using System.Text.Json;
namespace Antares.Server.Infrastructure;
public static class JsonValue
{
    public static object? Unwrap(object? value)
    {
        if (value is not JsonElement je) return value;
        return je.ValueKind switch
        {
            JsonValueKind.String => je.GetString(),
            JsonValueKind.Number => je.TryGetInt64(out var l) ? l : je.GetDouble(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Null or JsonValueKind.Undefined => null,
            _ => je.GetRawText()
        };
    }
}
```
- [ ] `dotnet test ... --filter JsonValueTests` → pass. Commit `feat(net): JsonElement->primitive unwrap helper`.

### Task 0c: offline SQL-gen harness (gates 1 & 3) — TDD pattern all lanes copy
- [ ] `tests/integration-net/Tables/SqlSugarSqlGenTests.cs`: build a config-only `SqlSugarScope` per dialect via `ConnectionConfigBuilder.Build`; assert `db.Updateable(dict).AS("User").WhereColumns("Id").ToSqlString()` quotes `[User]`/`` `User` ``/`"User"` per dialect; add schema-qualified case. **Discover-then-lock:** run once, read actual SQL, lock assertions. If `.ToSqlString()` is unavailable on a builder, capture via `config.AopEvents.OnLogExecuting`.
- [ ] Commit `test(net): SqlSugar dialect-quoting harness (gate 1/3)`.
- [ ] **Gate decision recorded here:** for any dialect where quoting is wrong, that path keeps raw fallback in lanes.

---

## WAVE 1 — parallel lanes (dispatching-parallel-agents; one agent per file, distinct files = no conflict)

**Each lane agent's brief (identical recipe):** for every convertible method in its file — (1) write/extend an offline `.ToSqlString()` or DbMaintenance-shape test first, (2) verify fail, (3) convert the body using the pattern table + `JsonValue.Unwrap` + `table` qualifier, (4) `dotnet build` 0 `error CS` + its tests pass, (5) for catalog reads, remap `DbColumnInfo`/`DbTableInfo`→the existing DTO and keep field parity with the fixture, (6) leave raw fallback (with a one-line `// raw: <reason>`) for anything in the must-stay-raw list or any failing-gate path, (7) self-verify (verification-before-completion: paste build + test output), (8) commit per method-group. **Do NOT edit any file outside the assigned one.**

| Lane | File | Convert (method → API) | Keep raw |
|---|---|---|---|
| L1 | `Tables/TablesWriteService.cs` | `UpdateCell`→Updateable · `DeleteRows`→Deleteable · `InsertFakeRows`→Insertable · `Drop`→DropTable · `Truncate`→TruncateTable · `ApplyAdditions`→AddColumn · `ApplyDeletions`→DropColumn · `ApplyChanges`(type/rename)→UpdateColumn/RenameColumn · `ApplyIndexChanges`→CreateIndex · `SetTableComment`→AddTableRemark · column comments→AddColumnRemark | `Create` (complex multi-opt → CodeFirst/DynamicBuilder later), `Duplicate` (SELECT INTO multi-stmt), FK changes (`ApplyForeignChanges` — no DbMaintenance API), CHECK changes (`ApplyCheckChanges`), MSSQL extended-property edge cases |
| L2 | `Tables/TablesReadService.cs` | `GetColumns`(non-mssql)→GetColumnInfosByTableName+remap · `GetIndexes`→GetIndexList · keys/primaries→GetPrimaries/GetIsIdentities | mssql `GetColumns` (reserved-word raw branch), `GetData`/`GetCount` (paged rows need DataTable column metadata — keep `.Ado.GetDataTable` unless Queryable<object> proves to carry it), any DTO field DbMaintenance lacks |
| L3 | `Views/ViewsService.cs` | `Create`/`Alter`→CreateView · `Drop`→DropView · `GetInformations`→GetViewInfoList | PG materialized views (no API) |
| L4 | `Triggers/TriggersService.cs` | `GetInformations`→GetTriggerNames | `Create`/`Alter`/`Drop`/`Toggle` (user trigger SQL / enable-disable — no DbMaintenance API) |
| L5 | `Routines/RoutinesService.cs` | `Drop`→DropProc · `GetInformations`→GetProcList | `Create`/`Alter` (user proc SQL) |
| L6 | `Functions/FunctionsService.cs` | `Drop`→DropFunc · `GetInformations`→GetFuncList | `Create`/`Alter`, PG trigger-functions |
| L7 | `Users/UsersService.cs` | evaluate `GetUsers`→GetDataBaseList?/raw | likely all raw (user/role catalogs are dialect-specific; DbMaintenance has no user API) → confirm + keep raw |
| L8 | `Schemas/SchemaDdlService.cs` | DB-level `Create`/`Update`/`Delete` → evaluate DbMaintenance.CreateDatabase if present | raw if no cross-dialect API |
| L9 | `Schemas/DatabasesService.cs` | `GetDatabases`→GetDataBaseList (remap to `["name"]` flat shape per fixture) | sqlite hardcoded 'main' |
| L10 | `Schemas/SchemaTreeBuilder.cs` | table/view enumeration → GetTableInfoList/GetViewInfoList where shape allows | the rich CTE metadata (row counts, extended props) DbMaintenance can't supply → keep raw |

**Explicitly untouched (must stay raw):** `Schemas/RawQueryExecutor.cs`, `SchemaDiscoveryService` (RawQuery/GetVersion), `SchemaMetadataService` (UseSchema/GetVariables/GetProcesses/GetCollation), `Connections/*QueryCanceller.cs`, `ConnectionService` probes + `ConnectionRegistry` keep-alive, `ManualCommitService`, `Schedulers/SchedulersService.cs` (EVENT/pg_cron/Agent).

---

## WAVE 2 — integration + cleanup (supervisor, after lanes return)
- [ ] Review each lane's diff + verification evidence; resolve any cross-lane DTO drift.
- [ ] Global: `dotnet test tests/integration-net/Server.IntegrationTests.csproj` (3 arm64 SkeletonHealth env-fails are pre-existing), `pnpm test:unit:run`, `pnpm replay:contract`.
- [ ] Remove now-dead `QualifyTable/QuoteIdent/Sanitize` in fully-converted files (keep where raw remains).
- [ ] Update `CLAUDE.md` (DbMaintenance usage + caveat) and `docs/net-migration/`. Commit.

## Verification (DoD)
- Per lane: `dotnet build server/AntaresServer.csproj -c Debug` → 0 `error CS`; lane's offline tests pass; evidence pasted.
- Global: backend `dotnet test`, `pnpm replay:contract`, `pnpm test:unit:run`.
- Manual (user-driven, one pass on dev 5555): edit cell / add row / delete rows / alter column / browse columns / list views,triggers,routines,functions,databases on MySQL + PG + SQLite + MSSQL, including a reserved-word table.

## Out of scope
EF Core (absent, not introduced). Renderer (`web/`) and Rust shell (`src-tauri/`) untouched.
