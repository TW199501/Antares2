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

## Post-review fixes (final code review, 2026-06-12)

A final code-review pass found two real Important issues, both fixed:

1. **`DeleteRows` discarded key-value CLR types** (`e42d05d`). The converted
   `Deleteable<object>().Where(ConditionalModel{FieldValue=string})` bound every key as
   a String/text parameter; mysql/sqlite/mssql implicitly cast, but **Postgres rejects
   `integer = text` at runtime** — deleting a row by integer PK could fail. New
   `TablesWriteService.BuildKeyConditional` sets `CSharpTypeName` from the unwrapped
   CLR type (`long`→`DbType.Int64`, verified offline via `.ToSql()` param inspection)
   and uses `ConditionalType.EqualNull` for null keys (emits `IS NULL`, no bound param).
   4 regression tests in `SqlSugarSqlGenTests`.
2. **NonUnify DDL errors returned raw HTTP 500** on Triggers/Views/Routines/Functions
   (`80a0787`). Their `[NonUnify]` create/alter/drop/toggle endpoints bypassed the
   unify provider, so a failing DDL surfaced as 500 (renderer shows a generic toast).
   Applied class-level `[ExceptionAsEnvelope]` (the same fix L8 used for SchemaDdl) →
   200 + `{status:"error"}`. Shape-identical to the unify provider's `OnException`, so
   the unified `GetInformations` reads and the `No active connection` auto-reconnect
   gate are unaffected.

Review-noted Minor items left for later (pre-existing, not regressions): mssql trigger
toggle emits `ON []` (renderer sends no table — `TriggersService.BuildToggleSql`);
`DatabasesService` mysql ordering uses `StringComparer.Ordinal` vs server collation;
`UpdateCell` empty-SET if the edited column name equals a PK key (not reachable in
normal cell-edit flow).

## Follow-up: table-structure DDL quality parity (2026-06-16)

The kept-raw table-structure DDL (CREATE / ADD-COLUMN / CHANGE-COLUMN / index /
duplicate) was the "other half" that never got the test-locked treatment. This pass
**kept it raw** (see decision below) but raised it to parity: all SQL construction
extracted from the ~1125-line `TablesWriteService` into a dedicated pure-function
`server/Tables/TableDdl.cs` (now 873 / 335 lines), every dialect×path locked with
offline characterization tests, plus two real bug fixes. Final code review: byte-for-byte
faithful extraction (no SQL drift), ready to merge.

- **pg CREATE auto-increment** — `RenderColumn` pg branch silently dropped
  AUTO_INCREMENT; now emits `GENERATED BY DEFAULT AS IDENTITY` (pg 10+). Identity
  columns also correctly omit DEFAULT (pg/mssql reject identity+default).
- **duplicateTable was broken** — the renderer sends only `{uid,schema,table}` (the
  source) but the DTO bound `Source`/`Destination`/`CopyData` (none sent) → empty names
  → `CREATE TABLE "" LIKE ""`. Rebound to `TableTargetPayload`; destination derived as
  `<table>_copy`.
- **createTable was broken** (found by the pre-merge review) — same DTO-drift class.
  The renderer sends `{uid,schema,fields,foreigns,indexes,checks,options}` (table name
  in `options.name`, PRIMARY KEY as a PRIMARY entry in `indexes`), but `CreateTablePayload`
  bound `Columns`/`Table` (never sent) → every create threw "at least one column is
  required". Rebound to the real contract; columns render from the rich `FieldDto` via
  `RenderCreateTableFromFields`, non-primary indexes / FKs / checks / comment applied via
  the shared `Apply*` steps. Verified end-to-end against real sqlite.
- Known follow-ups (pre-existing, characterized not fixed): sqlite auto-increment CREATE
  emits invalid `INT AUTOINCREMENT` (needs `INTEGER PRIMARY KEY AUTOINCREMENT` inline);
  `<table>_copy` duplicate has no collision-suffix.

### Why NOT SqlSugar for table-structure DDL (decision, evidence-based)

The user asked whether SqlSugar should own this DDL. Investigated **with the SqlSugar
MCP** (`168express-sqlsugar-mcp.hf.space` — read `庫表管理DbMaintenance`,
`庫表管理操作指南`, `動態建類CRUD`) and a live probe. SqlSugar's DbMaintenance/CodeFirst
DDL is **weaker than the hand-rolled SQL here**: drops DEFAULT/scale/comment/unsigned,
pg `serialt` typo in `CreateTable`, sqlite `UpdateColumn` broken, named
`CreateIndex`/`AddPrimaryKeys` leave columns unquoted. The clean SqlSugar wins
(Drop/Truncate/DropColumn/CRUD/catalog) were already taken in the first pass. Principle:
**simple ops → SqlSugar; complex modifier-bearing DDL → hand-rolled.**

### 無實體建表 (SqlSugar DynamicBuilder/CodeFirst) — the SqlSugar-native alternative

This IS a real, important tool and the conceptual fit for Antares' runtime "design a
table → create" feature. **Verified working against a real sqlite DB**:
```csharp
var tb = db.DynamicBuilder().CreateClass("User", new SugarTable());
tb.CreateProperty("Score", typeof(decimal), new SugarColumn { ColumnDataType = "decimal(10,2)" });
db.CodeFirst.InitTables(tb.BuilderType());
// → CREATE TABLE IF NOT EXISTS "User"( ... "Score" decimal(10,2) NULL ... )
```
`ColumnDataType` forces the exact type string (`"decimal(10,2)"`, `"int unsigned"`,
`"enum('a','b')"`), sidestepping the type-inference bugs of the bare `CreateTable`.
**Costs that kept it out of the default path:** (1) `CodeFirst.InitTables` is an
**online create-or-sync** — it introspects the live DB, so only sqlite is offline-
verifiable (mysql/pg/mssql need live DBs); (2) it **does not emit column DEFAULTs**
(needs `AddDefaultValue` post-step, which sqlite ALTER can't do); (3) schema-qualified
names + per-dialect identity need live verification. It is the recommended migration
target **if/when** the project accepts live-DB integration testing for the DDL path.

### Task skipped: identifier quoting via SqlSugar

Replacing the `Sanitize`/`QuoteIdent` denylist with SqlSugar's quoter was evaluated and
**skipped** — SqlSugar's pg quoter lowercases identifiers, but the raw DDL path
deliberately preserves pg case; swapping it would silently lowercase pg DDL identifiers
(a behavior change), not a clean win.
