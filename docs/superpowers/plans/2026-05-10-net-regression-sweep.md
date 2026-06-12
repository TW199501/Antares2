# Antares2 .NET Migration Regression Sweep

> **Status**: in progress (2026-05-10)
> **Scope**: server-side DTO population gaps caused by Phase 17/18 .NET sidecar migration
> **Trigger**: user found multiple "previously worked, now missing" UI elements one at a time over a single session — root cause is a class of regressions where renderer expects fields the .NET server doesn't populate

## Context

The Node-sidecar → .NET-sidecar migration (commit `eb6fa20` Firebird drop, `8d7b95e` dev flip, `03aa211` Node deletion, see `docs/superpowers/plans/2026-05-06-net-sidecar-migration-v5.md`) preserved most wire contracts but **silently dropped several "metadata" DTO fields** that the renderer reads. The renderer doesn't crash because each field has a falsy fallback (`undefined / 0 / NaN`) which produces a degraded but non-fatal UI:
- `table.size` undefined → pie indicator (the green badge) doesn't render
- `table.rows` undefined → count badge doesn't render
- `field.comment` empty → "中" header toggle shows blank columns
- `result.duration` undefined → query timer shows `NaNs`
- table-level `Comment` empty → sidebar table list shows English-only

Each of these was reported separately by the user during the 2026-05-10 session, fixed one-by-one. This plan **systematically inventories every field the renderer reads vs every place the server populates it**, so the rest can be filled in one batch instead of drip-fed.

## Already fixed in 2026-05-10 session

| Commit | Fix |
|--------|-----|
| `66a7b62` | `:deep()` + `@apply` lightningcss warnings |
| `23375a5` | BaseSelect popup width matches trigger |
| `e85fd10` | Sidecar dev port 5555 + dev-mode token skip |
| `e0c88dc` | Column comments in `/api/tables/getData` (TableDataDto.Fields[].Comment) |
| `46d1620` | System-DB checkbox sync + connString auto-populate |
| `e7d3553` | Token cache cleared on sidecar respawn + table comments in schema tree (MSSQL/PG) |
| (uncommitted) | TableDataDto.Duration (NaNs → real seconds) |

## DTO population matrix — TableSummaryDto

`web/renderer/components/WorkspaceExploreBarSchema.vue` reads:
- `table.name` — sidebar label
- `table.type` — view vs table icon swap
- `table.comment` — Chinese description chip
- `table.size` — green pie indicator (`v-if` gated on `!isNaN(table.size)`)

Server populates per flavor (`server/Schemas/SchemaTreeBuilder.cs`):

| Field | mssql | mysql/maria | pg | sqlite |
|-------|-------|-------------|-----|--------|
| Name | ✓ | ✓ | ✓ | ✓ |
| Type | ✓ | ✓ | ✓ | ✓ |
| Comment | ✓ (e7d3553) | ✓ | ✓ (e7d3553) | ✗ (no native) |
| Engine | — | ✓ | N/A | N/A |
| **Rows** | **✗** | **✗** | **✗** | **✗** |
| **Size** | **✗** | **✗** | **✗** | **✗** |
| **Collation** | **✗** | **✗** | **✗** | **✗** |

**`Rows` / `Size` / `Collation` are NEVER populated for any client** — pure regression from .NET migration. Renderer fields exist, DTO fields exist, server SQL just doesn't query them.

## DTO population matrix — Database (SchemaInfoDto)

Reader: `WorkspaceExploreBarSchema.vue:32` — `v-if="database.size"` for db-level pie.

`SchemaInfoDto` per `ConnectionResultDto.cs:30`:
- `Name` ✓
- `Size` — never populated by SchemaTreeBuilder (BuildXxxAsync sets only Name + Tables)

## DTO population matrix — TableDataDto.Fields[] (RawFieldDto)

Reader: `WorkspaceTabQueryTable.vue:397-401` — `headerLabel` uses `field.comment` when 中 toggle is on.

| Field | mssql | mysql/maria | pg | sqlite |
|-------|-------|-------------|-----|--------|
| Name | ✓ | ✓ | ✓ | ✓ |
| Type | ✓ | ✓ | ✓ | ✓ |
| Comment | ✓ (e0c88dc) | ✓ (e0c88dc) | ✓ (e0c88dc) | ✗ (no native) |

## Tasks (ordered by ROI)

### T1 — TableSummaryDto.Size for MSSQL + MySQL + PG
**Why**: green pie indicator missing for ~all installations. Single most visible regression.
**SQL**:
- MSSQL: `SELECT t.name AS Name, ISNULL(SUM(p.rows),0) AS Rows, ISNULL(SUM(a.total_pages),0)*8*1024 AS Size FROM sys.tables t JOIN sys.indexes i ON t.object_id=i.object_id JOIN sys.partitions p ON i.object_id=p.object_id AND i.index_id=p.index_id JOIN sys.allocation_units a ON p.partition_id=a.container_id WHERE i.index_id IN (0,1) GROUP BY t.name`
- MySQL: enrich the existing INFORMATION_SCHEMA.TABLES query with `DATA_LENGTH+INDEX_LENGTH AS Size, TABLE_ROWS AS Rows, TABLE_COLLATION AS Collation`
- PG: `SELECT relname AS Name, n_live_tup AS Rows, pg_total_relation_size(c.oid) AS Size FROM pg_stat_user_tables JOIN pg_class c USING (relname)`
**Acceptance**: `info.Tables[].Size > 0` for non-empty tables; pie renders.

### T2 — TableSummaryDto.Rows for all flavors
Same query expansion as T1 (rows often comes in the same catalog query). MySQL TABLE_ROWS / MSSQL sys.partitions / PG n_live_tup.
**Acceptance**: row-count badge renders in sidebar.

### T3 — TableSummaryDto.Collation for MSSQL + MySQL
MySQL: `TABLE_COLLATION` from same INFORMATION_SCHEMA.TABLES.
MSSQL: doesn't have per-table collation, only per-column. Leave empty (current behavior is correct).
**Acceptance**: MySQL collation badge renders; MSSQL doesn't pretend.

### T4 — SchemaInfoDto.Size (database-level)
- MySQL: `SELECT SUM(DATA_LENGTH+INDEX_LENGTH) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=@s`
- MSSQL: `SELECT SUM(size)*8*1024 FROM sys.master_files WHERE database_id=DB_ID(@d)`
- PG: `pg_database_size(@d)`
**Acceptance**: db-level pie/byte indicator renders.

### T5 — TableSummaryDto.Comment for SQLite
SQLite has no native table comments but stores them as `pragma table_xinfo` notes? Actually no — SQLite truly has no native comment system. Leave ✗ as documented.

### T6 — Renderer defensive: NaN→"—" for any future missing fields
In `WorkspaceTabTable.vue:98` change `{{ results[0].duration / 1000 }}s` to a guarded display. Same pattern for other arithmetic-on-DTO-field templates. **Optional — fixing source is preferred per memory `feedback_specsnap_data_is_ground_truth.md`**.

### T7 — Add TableSummaryDto coverage tests
After T1-T4, add `tests/integration-net/Schemas/SchemaTreeBuilderTests` that asserts each flavor returns non-zero Size + Rows for a known seeded table. Lock in so future migrations don't drop the same fields again.

### T8 — Sweep other DTOs the same way
- `RoutineSummaryDto` — only `Name`. Renderer might want comment/parameters/returnType.
- `TriggerSummaryDto` — only `Name`. Renderer might want event/timing/table.
- `SchedulerSummaryDto` — TODO check.
- `SearchColumnHitDto` — TODO check.
For each, grep renderer for `<obj>.field` access, fill server gaps.

## Out of scope

- Renderer-side bugs unrelated to DTO population (those are separate fixes per their own commits).
- Firebird (dropped per CLAUDE.md `### Database clients`).
- Schema-write endpoints (CREATE/ALTER) — different code path, audit separately.

## Done criteria

- All flavors return non-zero `Size` / `Rows` for seeded test tables (verified by `tests/integration-net/Schemas`).
- Sidebar shows green pie for every table ≥ 1KB.
- No renderer template uses arithmetic on a DTO field that the server might not populate.
- T1-T4 commits land on `dev`; T7 test guards them; T8 spec catches other DTOs.
