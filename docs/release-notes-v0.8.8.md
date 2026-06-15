# Antares2 v0.8.8

This release reworks the .NET 10 sidecar's data layer to use **SqlSugar's
cross-dialect API** where it is provably safe, and fixes several Windows/ARM64
developer-environment papercuts. The renderer wire contract is unchanged — this
is a backend-internal refactor plus dev tooling.

## Backend — SqlSugar cross-dialect conversion

The sidecar previously used SqlSugar only as a raw-SQL executor (hand-built
per-dialect SQL at ~110 call sites). This release moves every **safely
convertible** site to SqlSugar's idiomatic API and deliberately keeps the rest
raw, gated by offline `.ToSql()` quoting tests:

- **CRUD** (`UpdateCell` / `DeleteRows` / `InsertFakeRows`) now use SqlSugar's
  entity-less `Updateable` / `Deleteable` / `Insertable`, which quote identifiers
  per dialect (MSSQL `[]`, MySQL/SQLite backticks, PostgreSQL lowercased) — so
  reserved-word table/column names (`User`, `Order`, …) are handled uniformly.
- **DDL** that SqlSugar quotes correctly (`DropTable` / `TruncateTable` /
  `DropColumn`) now goes through `DbMaintenance`; SQLite `TRUNCATE` also resets the
  autoincrement counter, and MSSQL `DROP COLUMN` drops a column's default
  constraint first (fixing a prior failure on columns with defaults).
- **Catalog reads** (columns / indexes / databases / views) use `DbMaintenance`
  where the shape matches the renderer's expected DTOs.
- Everything SqlSugar can't express without losing fidelity (full `CREATE TABLE`,
  `ALTER` with modifiers, indexes, foreign keys, CHECK constraints, view/proc/func
  DDL, users/roles) is **kept raw** and documented. See
  `docs/net-migration/2026-06-12-sqlsugar-conversion-outcome.md`.

## Fixes

- **PostgreSQL row delete**: `DeleteRows` now preserves the key value's CLR type
  (e.g. an integer PK binds as `Int64`, not text), fixing a potential
  `operator does not exist: integer = text` failure when deleting rows on pg.
- **DDL error reporting**: failures in `Triggers` / `Views` / `Routines` /
  `Functions` / schema DDL now surface as a proper `{status:"error"}` envelope
  (HTTP 200) instead of a raw 500 the UI couldn't read — you now see the real
  database error message.
- **Triggers**: repaired alter/drop/toggle payload binding that had drifted during
  the .NET migration.

## Developer environment (Windows / ARM64)

- Support building the sidecar on **win-arm64** and widen the build-probe timeout
  for cold self-extracting starts.
- Force `ASPNETCORE_ENVIRONMENT=Development` so the dev sidecar binds the fixed
  port 5555.
- Exclude `src-tauri` / `server` build output from the Vite watcher to avoid
  `EBUSY` on Windows.

## Docs & tooling

- Restructured `README.md` with a frontend/backend project tree.
- Archived completed implementation plans to `docs/superpowers/history/`.
- Recommend the Claude Code VS Code extension.

---

> Note: the SqlSugar write-path changes pass the full offline test suite (233
> tests) but real-database verification across MySQL / PostgreSQL / SQLite / MSSQL
> is ongoing.

## 🙏 Credits

Forked from [antares-sql/antares](https://github.com/antares-sql/antares) by Fabio Di Stasio (MIT License).
