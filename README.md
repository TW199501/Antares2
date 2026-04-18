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
* Firebird SQL
* SQL Server (full support added in Antares2)
* DuckDB
* More...

## Supported operating systems

#### x64

* Windows
* Linux
* macOS

#### ARM

* Windows
* Linux
* macOS

## Development

```bash
# Dev mode (starts Tauri shell + Vite + sidecar together)
pnpm tauri:dev

# Production build
pnpm tauri:build

# Lint
pnpm lint
pnpm lint:fix

# TypeScript type-check
pnpm vue-tsc --noEmit

# E2E tests (Playwright)
pnpm test:e2e

# Translation completeness check
pnpm translation:check
```

## License

Released under the [MIT License](./LICENSE), same as the original project.

## Credits

Thanks to the [antares-sql/antares](https://github.com/antares-sql/antares) project and its upstream contributors — Antares2 would not exist without their foundation.
