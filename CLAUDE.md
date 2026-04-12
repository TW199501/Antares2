# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

Antares SQL is a cross-platform desktop SQL client. It supports MySQL/MariaDB, PostgreSQL, SQLite, Firebird SQL, and SQL Server. The app was originally Electron-based; it has been migrated to **Tauri v2** (Rust shell + Vue.js renderer). The CONTRIBUTING.md still references Electron — ignore those references.

## Commands

```bash
# Development (starts Tauri shell + Vite dev server + sidecar automatically)
pnpm tauri:dev

# Build for production
pnpm tauri:build

# Lint (ESLint + Stylelint)
pnpm lint
pnpm lint:fix

# Type-check Vue + TypeScript
pnpm vue-tsc --noEmit

# End-to-end tests (Playwright)
pnpm test:e2e

# Check translation completeness across all locales
pnpm translation:check
```

> The Vite dev server alone (`pnpm vite:dev`) also works: `sidecarPlugin` in `vite.config.ts` auto-starts the Fastify sidecar on port 5555.
>
> **Package manager:** Use `pnpm` only. The project has `pnpm-lock.yaml`. Delete `package-lock.json` if present.

## Architecture

### Process model (sidecar pattern)

```
Tauri (Rust)  ──spawns──>  Node.js/Fastify sidecar  (src/main/server.ts)
     |                              |
     |  get_sidecar_port            | HTTP POST to 127.0.0.1:<port>
     |  (Tauri command)             |
Vue renderer  <─────────────────────
(src/renderer/)
```

The Rust layer (`src-tauri/src/sidecar.rs`) spawns the Node.js server as a child process and reads its stdout for a `READY:<port>` line. The port is stored in a global `Mutex<u16>` and returned to the renderer via the `get_sidecar_port` Tauri command. The renderer's `src/renderer/ipc-api/httpClient.ts` wraps all backend calls as HTTP POST requests.

In dev mode the sidecar always runs on port **5555**. In production a random free port is used.

### Source layout

| Path | Purpose |
|------|---------|
| `src/common/` | Shared utilities, interfaces, and per-client customizations used by both renderer and sidecar |
| `src/common/customizations/` | Per-database-client feature flags (what each DB supports) |
| `src/main/server.ts` | Fastify HTTP server entry point — registers all route groups |
| `src/main/routes/` | One file per resource type (`tables`, `views`, `triggers`, etc.) |
| `src/main/libs/clients/` | Database client implementations, all extending `BaseClient` |
| `src/main/libs/ClientsFactory.ts` | Factory that returns the right client by `args.client` string |
| `src/renderer/` | Vue 3 frontend application |
| `src/renderer/stores/` | Pinia stores (connections, workspaces, settings, etc.) |
| `src/renderer/ipc-api/` | HTTP wrappers that call the sidecar — one file per resource group |
| `src/renderer/components/` | Vue SFCs; `Base*` = reusable primitives, `The*` = single-instance layout |
| `src-tauri/` | Rust Tauri shell; `src/lib.rs` registers plugins, `src/sidecar.rs` manages the child process |
| `tests/` | Playwright e2e tests (single file `app.spec.ts`) |

### Database clients

`ClientsFactory` maps connection type strings to client classes:

| String | Class |
|--------|-------|
| `mysql` / `maria` | `MySQLClient` |
| `pg` | `PostgreSQLClient` |
| `sqlite` | `SQLiteClient` |
| `firebird` | `FirebirdSQLClient` |
| `mssql` | `SQLServerClient` |

All clients extend `BaseClient` (`src/main/libs/clients/BaseClient.ts`). New database support means adding a new client class, registering it in the factory, and adding a customizations file in `src/common/customizations/`.

### State management

Pinia stores live in `src/renderer/stores/`. Settings are persisted via `src/renderer/libs/persistStore.ts` (wraps Tauri FS plugin). The `workspaces` store is the central coordinator for open connections and tabs.

### i18n

vue-i18n runs in **Composition API mode** (`legacy: false`). Locale files are in `src/renderer/i18n/<locale>.ts`. When adding new strings, add keys to `en-US.ts` first; the translation check script compares all locales against it.

## Conventions

### Vue components
- **PascalCase** for `.vue` file names and component usage in templates.
- `Base` prefix for reusable primitive components (`BaseSelect`, `BaseTextEditor`, etc.).
- `The` prefix for single-instance layout components.
- **kebab-case** for prop and event names in templates.

### TypeScript / general
- Use template literals for string composition.
- `defineEmits` uses TypeScript generic form (not array syntax).
- Path aliases: `@/` resolves to `src/renderer/`, `common/` resolves to `src/common/`.

### Commits
Conventional Commits style is enforced by commitlint (`fix:`, `feat:`, `refactor:`, etc.). Single-scope commits are preferred because releases and the CHANGELOG are generated from commit history.

### Customizations pattern
When a feature exists for some databases but not others, gate it via the `customizations` object rather than hard-coding client checks in the UI. Access via `workspace.customizations.<feature>` in renderer code, or import `common/customizations/<client>.ts` directly.
