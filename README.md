![](https://raw.githubusercontent.com/antares-sql/antares/master/docs/gh-logo.png)

# Antares2

![GitHub license](https://img.shields.io/github/license/TW199501/Antares2)

**English** | [繁體中文](./README.zh-TW.md)

> **Fork of** [**antares-sql/antares**](https://github.com/antares-sql/antares) by [Fabio Di Stasio](https://github.com/Fabio286), used and extended under the [MIT License](./LICENSE).
> Full credit to the original project and all upstream contributors — Antares2 continues to build on their work.

## What's new in Antares2

| Area | Change |
| --- | --- |
| **Runtime** | Migrated from Electron to **Tauri v2** — smaller binary, better OS integration |
| **Backend** | Rewritten as a single **.NET 10 self-contained sidecar** (Furion + SqlSugar + native ADO.NET drivers) |
| **SQL Server** | Full support: SSL, read-only mode, single-connection mode, connection-pool stability fixes |
| **Stability** | Fixed race condition when switching databases; sidecar auto-reconnect on restart |
| **Auto-update** | Replaced electron-updater with `tauri-plugin-updater` |

🔗 [Latest release](https://github.com/TW199501/Antares2/releases/latest) · [Original project](https://github.com/antares-sql/antares)

---

Antares is a cross-platform SQL client built with [Tauri v2](https://tauri.app/) and [Vue.js](https://github.com/vuejs/vue), aiming to be a forever-free, open-source tool for developers.
This fork continues in the same spirit — open source, MIT licensed, community friendly.

## Key features

* Manage multiple database connections at the same time
* Database management (add / edit / delete)
* Full table management including indexes and foreign keys
* Views, triggers, stored procedures and functions (add / edit / delete)
* Modern tab system — keep multiple tabs open per workspace
* Fake-data filler for quickly generating test data
* Query suggestions and auto-completion
* Query history (last 1000 queries)
* Save queries, notes or todos
* SSH tunnel support
* Manual commit mode
* Database dump import / export
* Customizable keyboard shortcuts
* Dark and light themes
* Multiple editor themes

## Supported databases

* MySQL / MariaDB
* PostgreSQL
* SQLite
* ~~Firebird SQL~~ — dropped in 0.8.4 (use Antares2 ≤ 0.8.3 for Firebird)
* SQL Server (full support added in Antares2)

## Supported operating systems

#### x64

* Windows
* Linux
* macOS

#### ARM

* Windows
* Linux
* macOS

## Architecture

Antares2 is a **3-tier desktop app** with a clean frontend / backend split, bridged by a thin Rust shell:

```
        ┌───────────────────────────┐   loopback HTTP + WebSocket    ┌────────────────────────────┐
        │  FRONTEND  (web/)          │  POST /api/* + X-Sidecar-Token │  BACKEND  (server/)         │
        │  Vue 3 renderer            │ ─────────────────────────────▶ │  .NET 10 sidecar (Furion)   │
        │  runs in the Tauri webview │ ◀───────────────────────────── │  SqlSugar + ADO.NET drivers │
        └─────────────▲─────────────┘   { status, response } envelope └──────────────▲─────────────┘
                      │ Tauri commands (get_sidecar_port / get_sidecar_token)         │ spawns + supervises
                      └─────────────────────  DESKTOP SHELL  (src-tauri/, Rust)  ──────┘
```

The Rust shell spawns the .NET sidecar as a child process, captures its `READY:<port>:<token>` line, and hands
the port + per-session token to the renderer via Tauri commands. Every renderer → backend call is a POST carrying
that token; every response is a uniform `{ status, response }` envelope.

## Project structure

```
Antares2/
│
├── web/                       # ═══ FRONTEND — Vue 3 renderer (runs in Tauri webview) ═══
│   ├── renderer/
│   │   ├── App.vue            #   root component
│   │   ├── index.ts           #   entry: sidecar handshake, Pinia, i18n bootstrap
│   │   ├── components/        #   Vue SFCs — Base* primitives, The* layout, ui/ (shadcn-vue)
│   │   ├── stores/            #   Pinia state (workspaces, connections, settings, history, …)
│   │   ├── ipc-api/           #   HTTP wrappers that call the .NET backend (one file per resource)
│   │   ├── composables/       #   reusable composition functions
│   │   ├── i18n/              #   locale JSON (en-US, zh-CN, zh-TW, ja-JP, ko-KR)
│   │   ├── assets/ · scss/    #   Tailwind v4 + legacy SCSS
│   │   └── libs/ · lib/       #   renderer helpers (persistStore, …)
│   └── common/                #   shared by the renderer (not the backend)
│       ├── customizations/    #   per-DB feature flags (mysql / postgresql / sqlite / sqlserver)
│       ├── interfaces/        #   shared TypeScript types
│       └── data-types/ · libs/ · fieldTypes · FakerMethods · shortcuts
│
├── src-tauri/                 # ═══ DESKTOP SHELL — Rust / Tauri v2 (bridges the two tiers) ═══
│   ├── src/
│   │   ├── main.rs · lib.rs   #   app entry, plugin & Tauri-command registration
│   │   └── sidecar.rs         #   spawns + supervises the .NET sidecar child process
│   ├── capabilities/          #   Tauri permission capabilities
│   ├── icons/ · gen/          #   app icons, generated platform sources
│   ├── Cargo.toml             #   Rust dependencies
│   └── tauri*.conf.json       #   base + per-platform (windows / macos / linux) config
│
├── server/                    # ═══ BACKEND — .NET 10 self-contained sidecar ═══
│   ├── Program.cs             #   boot (Furion Serve.Run): pick port, print READY:<port>:<token>
│   ├── Startup.cs             #   DI + middleware wiring (AppStartup)
│   ├── Connections/           #   connection manager, SqlSugar config, query cancellers, SSH tunnel
│   ├── Schemas/               #   schema read, raw query, databases, export/import, manual commit
│   ├── Tables/                #   table read / write (data CRUD + DDL)
│   ├── Views/ · Triggers/ · Routines/ · Functions/ · Schedulers/ · Users/ · Ai/   # per-resource services
│   ├── WebSockets/            #   /ws/export + /ws/import hub
│   ├── Infrastructure/        #   envelope provider, token middleware, ReadyLineHook, PortAllocator
│   ├── Models/                #   DTOs
│   ├── Workers/ · Health/ · Echo/ · Application/ · Configuration/
│   └── AntaresServer.csproj   #   net10.0, single-file self-contained (SqlSugar + MySqlConnector / Npgsql / SqlClient / Sqlite)
│
├── scripts/                   # build & release tooling (build-net-sidecar, stage-resources, release, …)
├── tests/                     # Vitest setup, helpers, contract fixtures
│   └── integration-net/       #   xUnit tests for the .NET sidecar
├── e2e/                       # Playwright end-to-end specs
├── docs/                      # design docs, release notes, migration notes, superpowers plans
├── sidecar-net/               # build output: antares-server[.exe]  (gitignored)
│
├── package.json               # frontend deps + pnpm scripts (single root — pnpm only)
├── vite.config.ts             # renderer bundler
├── vitest.config.ts           # unit-test config        playwright.config.ts  # e2e config
├── pnpm-workspace.yaml        # pnpm allowBuilds (NOT a monorepo)
└── CLAUDE.md                  # deep architecture guide for contributors / AI agents
```

## Development

```bash
# Dev mode (starts Tauri shell + Vite + .NET sidecar together)
pnpm tauri:dev

# Production build (publishes the .NET sidecar, stages it, then `tauri build`)
pnpm tauri:build

# Lint (ESLint + Stylelint)
pnpm lint
pnpm lint:fix

# TypeScript / Vue type-check
pnpm type-check

# Frontend unit tests (Vitest)
pnpm test:unit:run

# Backend tests (.NET / xUnit)
dotnet test tests/integration-net/Server.IntegrationTests.csproj

# End-to-end tests (Playwright)
pnpm test:e2e

# Translation completeness check (locale arg required, e.g. zh-TW)
pnpm translation:check zh-TW
```

> **Package manager:** pnpm only (the repo ships `pnpm-lock.yaml`). The single root `package.json` is **not**
> a monorepo — `pnpm-workspace.yaml` exists only to carry pnpm's `allowBuilds` approvals.

## License

Released under the [MIT License](./LICENSE), same as the original project.

## Credits

Thanks to the [antares-sql/antares](https://github.com/antares-sql/antares) project and its upstream contributors — Antares2 would not exist without their foundation.
