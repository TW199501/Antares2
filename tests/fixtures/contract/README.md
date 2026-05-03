# IPC Contract Fixtures

This directory contains **frozen request/response pairs** between the
antares2 renderer and the Node sidecar. They are the **acceptance
contract for the upcoming .NET 10 + SqlSugar sidecar rewrite**: the
new sidecar must produce the same response shape for the same input,
or the renderer breaks at runtime in ways type-check cannot catch.

## Contents

| File pattern | What it captures |
|--------------|------------------|
| `<group>.<verb>.<dialect>.<scenario>.json` | One HTTP route call (request payload + response body + wrapper-internal `expected` shape) |
| `ws-<route>.<dialect>.<scenario>.jsonl` | One WebSocket session (handshake + frame sequence + close), one frame per line for clean diff |

`<group>` examples: `connection`, `databases`, `schema`, `tables`, `views`.
`<dialect>`: `mysql`, `pg`, `mssql`, `sqlite`, `firebird`.
`<scenario>`: `happy`, `error`, `cancel`, etc.

## Why this exists

1. **T8 wrapper replay tests** import these fixtures via `@tests/fixtures/contract/...` and use them to verify each `web/renderer/ipc-api/*.ts` wrapper transforms the response correctly. See `docs/superpowers/specs/2026-05-03-frontend-unit-test/PR4-ipc-contract-replay/T8-ipc-replay-tests.md`.
2. **.NET sidecar acceptance**: when the new sidecar lands, run the same capture script against it (`pnpm capture:contract --target=dotnet --port=...`) and `diff` against this baseline. Anything beyond timestamp / UUID drift is a **breaking change** that requires renderer adjustments before merge.

## How to (re)capture

### 1. Set up dev databases

You need a development instance of each dialect with a `antares_test_fixture` schema containing modest fixtures (small enough to keep JSON sizes manageable). Suggested seed schema:

```sql
-- Common to all dialects
CREATE TABLE users (
  id          INT          PRIMARY KEY,
  name        VARCHAR(50),
  created_at  TIMESTAMP
);

CREATE TABLE orders (
  id        INT             PRIMARY KEY,
  user_id   INT,
  amount    DECIMAL(10,2),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE VIEW user_orders AS
   SELECT u.name, o.amount
     FROM users u
     JOIN orders o ON u.id = o.user_id;

-- Insert 3-5 rows per table for capture variety
```

For SQL Server specifically, also add a table with **a space and a bracket in the name** to capture the bracket-escape contract:

```sql
CREATE TABLE [My Table] (id INT, [order] INT);  -- space in name + reserved word
```

### 2. Provide credentials via environment

```powershell
# Windows PowerShell
$env:DEV_MYSQL_HOST = '127.0.0.1'
$env:DEV_MYSQL_PORT = '3306'
$env:DEV_MYSQL_USER = 'fixture_user'
$env:DEV_MYSQL_PASSWORD = '<set this>'

$env:DEV_PG_HOST = '127.0.0.1'
$env:DEV_PG_PORT = '5432'
$env:DEV_PG_USER = 'fixture_user'
$env:DEV_PG_PASSWORD = '<set this>'

$env:DEV_MSSQL_HOST = '127.0.0.1'
$env:DEV_MSSQL_PORT = '1433'
$env:DEV_MSSQL_USER = 'fixture_user'
$env:DEV_MSSQL_PASSWORD = '<set this>'

$env:DEV_SQLITE_PATH = 'E:/source/antares2/tests/fixtures/contract/_seed.sqlite'
```

```bash
# Bash / zsh
export DEV_MYSQL_HOST=127.0.0.1
# ... (same vars)
```

> **Use a fixture-only DB user** with read-only-ish privileges. The capture script issues real `connect / getDatabases / rawQuery` calls; **never run against a production DB**.

### 3. Run the capture

```bash
# All dialects
pnpm capture:contract

# Single dialect (faster iteration)
pnpm capture:contract -- mysql
```

The script:
1. Spawns sidecar via `tsx web/main/server.ts --port 5556` (DEV_MODE — no token validation).
2. Walks the curated `INVOCATIONS` list in `scripts/capture-contract-fixtures.mjs`.
3. For each invocation, sends the request, captures `(req, res)`, runs anonymization sweep (`<REDACTED>` for password/token, `<USER_HOME>` for paths, `<UUID>` for UUIDs, fixed timestamp).
4. Writes the JSON fixture file.
5. Kills the sidecar.

### 4. Manual review BEFORE commit

Anonymization is automatic but the gate is **your eyeball**:

```bash
# These should all return zero matches
grep -ri "password" tests/fixtures/contract/ | grep -v REDACTED
grep -ri "<your-real-host>" tests/fixtures/contract/      # replace with your dev host
grep -ri "<your-username>" tests/fixtures/contract/        # replace with your real OS user

# File size sanity (< 250 KB total expected)
du -sh tests/fixtures/contract/
```

If anything sensitive leaked → manually edit + re-grep. **Never push fixtures with real credentials.**

### 5. Commit

```bash
git add tests/fixtures/contract/
git commit -m "chore(fixtures): refresh contract fixtures (mysql/pg/mssql captured)"
```

## Coverage so far

The initial `INVOCATIONS` list in the script is **deliberately small** — the 7 most-critical routes (connect → databases → schema → query → disconnect lifecycle). Expand the list as your dev DB schema permits:

- `tables/*` — needs concrete table fixture
- `views/*` — needs view fixture
- `triggers/*` / `routines/*` / `functions/*` — needs DB-side definitions
- `users/*` — needs read-only user-management privileges
- WS `/ws/export` and `/ws/import` — needs the `ws` Node module + frame log writer

Each addition is roughly 5-15 lines in the `INVOCATIONS` array. See script comments.

## Acceptance for .NET 10 sidecar

When the new sidecar is live:

```bash
# Spin up .NET sidecar on port 5557, run capture
pnpm capture:contract -- mysql --target=dotnet --port=5557

# Compare against committed baseline
diff -ur tests/fixtures/contract/ tests/fixtures/contract-dotnet/
```

Expected diff: **only** `metadata.elapsed_ms_observed` (informational, never asserted in T8 tests). Any other diff → bug in the .NET implementation, fix before merge.
