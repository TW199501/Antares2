# SqlSugar conversion — outcome (2026-06-12)

Follow-up to the .NET sidecar migration. The migration had left `server/` using
SqlSugar **only as a raw-SQL executor** (`entry.Db.Ado.*` + hand-built per-dialect
SQL, ~110 sites). This pass moved every **safely-convertible** site to SqlSugar's
cross-dialect API and deliberately kept the rest raw, with the wire contract
(`{status,response}` envelopes, `[NonUnify]`, contract fixtures) unchanged.

Plan: [`docs/superpowers/plans/2026-06-12-net-sqlsugar-conversion.md`](../superpowers/plans/2026-06-12-net-sqlsugar-conversion.md) ·
Spec: [`docs/superpowers/specs/2026-06-12-net-sqlsugar-conversion-design.md`](../superpowers/specs/2026-06-12-net-sqlsugar-conversion-design.md)

## The dividing line: does the SqlSugar 5.1.4.214 API quote identifiers?

Proven offline (no DB) by `tests/integration-net/Tables/SqlSugarSqlGenTests.cs`
via `.ToSqlString()`, against the reserved word `User` and schema-qualified names.

| Category | APIs | Quoting | Decision |
|---|---|---|---|
| **Quotes correctly** | entity-less `Insertable`/`Updateable(dict).AS(t).WhereColumns(keys)`, `Deleteable<object>().AS(t).Where(conds)`; `DbMaintenance.DropTable`/`TruncateTable`/`DropColumn` | mssql `[User]`, mysql/sqlite `` `User` ``, pg `"user"` (lowercased) | **Converted** |
| **Does NOT quote** | `DbMaintenance.DropView`/`DropProc`/`DropFunc` | bare unqualified name → reserved-word breaks | **Kept raw** |
| **Lossy** | `AddColumn`/`UpdateColumn`/`RenameColumn` (drop unsigned/auto_increment/comment/collation/default + per-flavor multi-stmt ordering); `CreateIndex` (hardcodes `Index_<t>_<c>`, forces mssql `NONCLUSTERED`, no PK path); `AddTableRemark`/`AddColumnRemark` (add-only, throw if exists; unsupported mysql/sqlite) | — | **Kept raw** |
| **No API** | foreign keys, CHECK constraints, full `CREATE TABLE`, `SELECT INTO`/`CREATE TABLE LIKE`, users/roles/logins | — | **Permanently raw** |

> pg note: SqlSugar folds unquoted pg identifiers to lowercase (`"user"`), matching
> standard pg unquoted-create semantics. A pg table created with a quoted mixed-case
> name (`CREATE TABLE "User"`) is a raw-fallback edge case.

## Supporting helpers (Wave 0)

- `server/Infrastructure/JsonValue.cs` — `Unwrap(object?)` converts the `JsonElement`
  that System.Text.Json binds renderer values to → CLR primitive before it enters a
  SqlSugar param dict. The number branch's `(object)` cast is load-bearing (keeps
  integers `long`, not `double`). Tests: `tests/integration-net/Infrastructure/JsonValueTests.cs`.
- `SqlSugarSqlGenTests.cs` — the offline `.ToSqlString()` gate; the TDD pattern every
  lane copied (discover real generated SQL once, then lock the assertion).

## Per-lane outcome

| Lane | File | Converted | Kept raw | Commit(s) |
|---|---|---|---|---|
| Wave 0 | infra + gate tests | — | — | `606191c` |
| L1 CRUD | `Tables/TablesWriteService.cs` | UpdateCell, DeleteRows, InsertFakeRows | — | `097c4ce` |
| L1 DDL | `Tables/TablesWriteService.cs` | Drop, Truncate, ApplyDeletions (DropColumn) | Create, Duplicate, ApplyAdditions, ApplyChanges, ApplyIndexChanges, FK/CHECK, comments | `93f8ef4` |
| L2 | `Tables/TablesReadService.cs` | catalog reads (non-mssql columns) | mssql GetColumns, GetData/GetCount (DataTable metadata) | `a323624`, `92a6888` |
| L3 Views | `Views/ViewsService.cs` | — (DropView unquoted) | all (Create/Alter user SQL, Drop, GetInformations) | `a7541c0` |
| L4 Triggers | `Triggers/TriggersService.cs` | — | all; **also fixed DTO contract drift** in alter/drop/toggle | `a94be5a`, `ff40400` |
| L5 Routines | `Routines/RoutinesService.cs` | — (Drop→DropProc tried, **reverted**: unquoted) | all | `5513f4e`, `fd8438e` |
| L6 Functions | `Functions/FunctionsService.cs` | — | all (no safe DbMaintenance path) | `2c449f7` |
| L7 Users | `Users/UsersService.cs` | — (no user/role DbMaintenance API) | all; behavior locked with characterization test | `4282806` |
| L8 SchemaDdl | `Schemas/SchemaDdlService.cs` | — (DB-level DDL dialect-specific) | all; **also wrapped NonUnify DDL with ExceptionAsEnvelope** | `dc4ac48`, `4631b23` |
| L9 Databases | `Schemas/DatabasesService.cs` | GetDatabases → GetDataBaseList (remapped to flat `[name]`) | sqlite hardcoded `main` | `3a49a70` |
| L10 SchemaTree | `Schemas/SchemaTreeBuilder.cs` | — (rich CTE metadata DbMaintenance can't supply) | all | `e7e2a2c` |

## Process

Executed as 10 service-file lanes via a background Workflow (35 agents): per lane
implement (TDD) → spec-compliance review + code-quality review (parallel) →
conditional fix loop. The review gate caught and corrected two real issues: L5
(unverified/wrong quoting claim → reverted to raw) and L7 (a "fake-done" lane that
hadn't actually been written → fix agent completed it). No dead helpers were left:
`QualifyTable`/`QuoteIdent`/`Sanitize`/`Quote` remain in every file because the
must-stay-raw methods still use them.

## Verification

- `dotnet test tests/integration-net/Server.IntegrationTests.csproj`: **231/232**.
  The one failure (`SkeletonHealthTests.Echo_without_token_returns_401`) is a
  **pre-existing self-contradictory test** — it sets `ASPNETCORE_ENVIRONMENT=Development`,
  but `SidecarTokenMiddleware` intentionally bypasses the token gate in Development,
  so `/api/echo` returns 200 not 401. Both files unchanged since the migration baseline.
- `pnpm test:unit:run`: **1978/1978** pass (24 pre-existing teardown unhandled
  rejections in untouched `WorkspaceTabProps*.vue` editor refs; `web/` had 0 commits).
- `pnpm replay:contract`: user-driven (needs a live sidecar + the user's DBs).
- Manual real-DB pass (edit cell / add row / alter column / browse columns / list
  views,triggers,routines,functions,databases on MySQL+PG+SQLite+MSSQL incl. a
  reserved-word table): **pending, user-driven**.
