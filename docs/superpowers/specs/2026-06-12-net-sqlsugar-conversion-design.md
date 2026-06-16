# .NET Sidecar SqlSugar Conversion — Design

**Date:** 2026-06-12
**Status:** Approved (brainstorming → plan)

## Problem

The Node→.NET migration left `server/` using SqlSugar **only as a connection pool + raw-SQL executor**:
~110 `entry.Db.Ado.ExecuteCommand / SqlQuery / GetDataTable` call sites, **zero** ORM/`DbMaintenance`
usage, and per-dialect SQL hand-branched 4× (mssql/mysql/pg/sqlite). This duplication is the source of a
recurring bug class — MSSQL reserved-word table names, `JsonElement` parameter coercion, and DTO/shape
drift (e.g. the `updateCell` / `insertFakeRows` bugs fixed on 2026-06-11).

Authoritative SqlSugar capability was confirmed via the project's **SqlSugar knowledge MCP**
(`sqlsugar-notes-mcp-server`, `https://168express-sqlsugar-mcp.hf.space/mcp`, configured in
`~/.claude.json` for this project). SqlSugar exposes a **cross-dialect** API: entity-less CRUD
(`Insertable/Updateable/Deleteable(dict).AS(table)`) and `DbMaintenance` for DDL + catalog reads — one
API spanning all four dialects ("一套頂十來種").

## Goal

Convert every **convertible** raw-SQL site to SqlSugar's cross-dialect API, deleting the 4-way dialect
branches, **without changing the renderer↔sidecar wire contract**. Eliminate the quoting/param bug classes
structurally rather than patching site-by-site.

## Approach (decided)

- **Decompose by service file** (~10 lanes). A lane = one `.cs` file, so parallel agents never touch the
  same file — true parallelism, zero merge conflict.
- **Each lane self-verifies via superpowers TDD**: offline `.ToSqlString()` characterization test first
  (config-only `SqlSugarScope`, no live DB — this also *is* the gate-1 reserved-word/schema-quoting proof),
  then convert, build (0 `error CS`), tests pass, `verification-before-completion` evidence, commit.
- **Orchestration: dispatching-parallel-agents.** Supervisor builds a shared foundation first (Wave 0),
  then dispatches one agent per lane (Wave 1), reviewing/integrating each as it returns (Wave 2).

## Three validation gates (proven by Wave 0 tests, applied per lane)

1. **Identifier quoting** — `Insertable/Updateable/DbMaintenance` correctly bracket MSSQL reserved-word
   (`[User]`) and schema-qualified names. Any dialect that fails keeps a raw fallback.
2. **Param typing** — `Dictionary<string,object?>` carrying `JsonElement` coerces correctly; the shared
   `JsonValue.Unwrap` helper normalizes values before they reach a param.
3. **DTO fidelity** — `DbMaintenance.GetColumnInfosByTableName` (`DbColumnInfo`) supplies enough to rebuild
   the renderer's `fields[]`/columns DTO; where it can't, that read stays raw (e.g. MSSQL reserved-word
   branch in `TablesReadService.GetColumns`, rich CTE metadata in `SchemaTreeBuilder`).

## Scope

**Convert:** data CRUD (3) + most DDL (CREATE/DROP/TRUNCATE/ALTER column/index/PK/remark via DbMaintenance)
+ much of catalog introspection (DbMaintenance `Get*` with DTO remap), across Tables/Views/Triggers/
Routines/Functions/Users/Schemas.

**Stay raw:** user raw query (`RawQueryExecutor`), `GetVersion`, session control (USE/SET/KILL/probes/
keep-alive), schedulers (EVENT/pg_cron/Agent), PG materialized views, FK/CHECK constraints (no DbMaintenance
API), MSSQL extended-property edge cases, and any catalog read needing a field `DbColumnInfo` lacks.

## Out of scope

EF Core (absent; not introduced). Renderer (`web/`) and Rust shell (`src-tauri/`) untouched.

## Execution plan

See `docs/superpowers/plans/2026-06-12-net-sqlsugar-conversion.md` (Wave 0 foundation → Wave 1 parallel
lanes → Wave 2 integration), with per-lane method→API mapping and verification DoD.
