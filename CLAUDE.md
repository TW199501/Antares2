# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

Antares2 is a cross-platform desktop SQL client, forked from [antares-sql/antares](https://github.com/antares-sql/antares) by Fabio Di Stasio (MIT licensed, original project is no longer maintained). It supports MySQL/MariaDB, PostgreSQL, SQLite, and SQL Server (Firebird support was dropped in 0.8.4 — see `Firebird` note in **Database clients** below). The app was originally Electron-based; it has been migrated to **Tauri v2** (Rust shell + Vue.js renderer). Any references to Electron elsewhere in the repo (old docs, comments) are historical — the current runtime is Tauri. Tauri identifier: `com.tw199501.antares2` (AppData at `%APPDATA%\com.tw199501.antares2\` on Windows, `~/.config/com.tw199501.antares2/` on Linux, `~/Library/Application Support/com.tw199501.antares2/` on macOS).

**Sidecar runtime.** The backend is a single **.NET 10 self-contained single-file binary** built from `server/` (Furion 4.9.8 + SqlSugar 5.1.4 + native ADO.NET drivers — `MySqlConnector` / `Npgsql` / `Microsoft.Data.SqlClient` / `Microsoft.Data.Sqlite` / `SSH.NET`). Both dev and release modes spawn the .NET sidecar — dev via `dotnet run --project server/AntaresServer.csproj` (JIT, edits in `server/` pick up on next `pnpm tauri:dev`), release via the pre-published binary at `sidecar-net/antares-server[.exe]` staged into the Tauri bundle. The 18-phase migration that produced this state (commits `eb6fa20` Firebird drop, `8d7b95e` dev flip, `03aa211` Node deletion) is documented in `docs/superpowers/plans/2026-05-06-net-sidecar-migration-v5.md`; pre-migration Antares2 used a Node.js / Fastify sidecar but that code is gone — `git log --grep "phase 18"` finds the deletion commit if you need history.

## Commands

```bash
# Development — starts vite (5173) + Tauri shell. The Rust shell spawns the .NET
# sidecar via `dotnet run --project server/AntaresServer.csproj`; first cold
# start ~25s for full build, subsequent runs ~3s incremental. The renderer
# learns the random port + per-session token via Tauri commands.
pnpm tauri:dev

# Build the .NET 10 self-contained sidecar binary into sidecar-net/antares-server[.exe]
# (used by `pnpm tauri:build`; you rarely run this directly).
pnpm sidecar:build:net

# Build for production — runs scripts/tauri-build.mjs which orchestrates:
# build-net-sidecar.mjs (dotnet publish) → stage-resources.mjs --target=net
# (single binary copy) → tauri build (NSIS + MSI on Windows; DMG on macOS;
# AppImage / deb / rpm on Linux). Windows-only post-step: build-msi.mjs
# re-invokes WiX light.exe with ICE30 suppressed.
pnpm tauri:build

# .NET preflight: verifies dotnet SDK ≥ 10.0, runtime IDs, and required NuGet packages
pnpm preflight:net

# Replay captured fixtures against the live sidecar (`tests/fixtures/contract/*.json`).
# Used during the .NET migration to verify on-the-wire compatibility; still useful
# as a smoke test after server/ refactors.
pnpm replay:contract

# Lint (ESLint + Stylelint)
pnpm lint
pnpm lint:fix

# Type-check Vue + TypeScript
pnpm type-check

# End-to-end tests (Playwright)
pnpm test:e2e

# Unit tests (Vitest, ~80 specs across web/common/, web/renderer/, tests/)
pnpm test:unit              # watch mode
pnpm test:unit:run          # one-shot, exits 0 if no specs match (CI-friendly)
pnpm test:coverage          # writes coverage/lcov.info
pnpm test:coverage:check    # enforces hard gate; -- --report writes coverage/report.md

# .NET integration tests (xunit, server-side)
dotnet test tests/integration-net/Server.IntegrationTests.csproj

# LF line-ending audit (4-layer enforcement: .gitattributes / .editorconfig / VSCode / this script)
pnpm check:eol

# Check translation completeness against en-US baseline (locale arg required)
pnpm translation:check zh-TW

# Verify no remaining Electron API references after migration
pnpm verify:tauri-migration

# One-shot migration for users coming from upstream antares (copies AppData
# from com.fabio286.antares → com.tw199501.antares2). Not a routine dev task.
pnpm migrate:appdata

# Cut a release (see `### Release process` for the full flow). Bumps the 4
# version files, generates docs/release-notes-vX.Y.Z.md skeleton, commits,
# tags, pushes. NEVER hand-edit the 4 version files — they drift.
pnpm release patch              # 0.8.3 -> 0.8.4
pnpm release 0.9.0 --dry-run    # preview without writing
```

> **Package manager:** Use `pnpm` only. The project has `pnpm-lock.yaml`. Delete `package-lock.json` if present.
>
> `pnpm tauri:build` runs `scripts/tauri-build.mjs`, which orchestrates: (1) `scripts/build-net-sidecar.mjs` runs `dotnet publish -c Release -r <rid> --self-contained -p:PublishSingleFile=true` and drops `antares-server[.exe]` into `sidecar-net/`; (2) `scripts/stage-resources.mjs --target=net` copies just that single binary into `src-tauri/resources/` — no Node runtime, no `node_modules`, the .NET binary statically links everything; (3) `tauri build` produces installers per platform.

## Architecture

### Process model (sidecar pattern)

The Rust shell spawns the .NET sidecar as a child process and talks to it over loopback HTTP / WebSocket. The same code path runs in dev and release, with one difference: the program invoked.

```
                              Dev (`pnpm tauri:dev`, debug build)
                           ┌─────────────────────────────────────────┐
                           │  dotnet run --project server/...        │
                           │  JIT compile + Furion startup ~3-5s     │
Tauri (Rust)  ──spawns──>  └─────────────────────────────────────────┘
     |
     |                            Release (`pnpm tauri:build`)
     |                     ┌─────────────────────────────────────────┐
     |                     │  ./antares-server[.exe]                 │
     └────spawns────>      │  .NET 10 self-contained single file     │
                           │  Furion 4.9.8 (ASP.NET Core)            │
                           └─────────────────────────────────────────┘
                                        ▲
     |  get_sidecar_port / get_sidecar_token              |
     |  (Tauri commands)                                  | HTTP POST + WS
     v                                                    | (random port, X-Sidecar-Token)
Vue renderer  ─────────────────────────────────────────────┘
(web/renderer/)
```

`src-tauri/src/sidecar.rs` reads the child's stdout for a `READY:<port>:<token>` line. The port and a per-session secret token are stored in global `Mutex` values. The renderer retrieves the token via the `get_sidecar_token` Tauri command and sends it as `X-Sidecar-Token` on every HTTP request; WebSocket connections pass it as a `?token=` query parameter. All non-`/health` routes reject requests that omit the correct token. The renderer's `web/renderer/ipc-api/httpClient.ts` wraps all backend calls as HTTP POST requests.

The `READY:<port>:<token>` line, envelope unification, and token enforcement live in `server/Infrastructure/`: `ReadyLineHook` (`IHostedService` printing the READY line), `EnvelopeResultProvider` (Furion `IUnifyResultProvider` wired in `Startup.cs` via `.AddInjectWithUnifyResult<EnvelopeResultProvider>()`), `SidecarTokenMiddleware`. WebSocket export/import paths (`/ws/export`, `/ws/import`) are handled by `ExportImportHub`. The port is always picked from a random free port via `PortAllocator` — no fixed-port assumption in either mode.

### Source layout

| Path | Purpose |
|------|---------|
| `web/common/` | Shared utilities, interfaces, and per-client customizations used by the renderer |
| `web/common/customizations/` | Per-database-client feature flags (what each DB supports) |
| `web/renderer/` | Vue 3 frontend application |
| `web/renderer/stores/` | Pinia stores (connections, workspaces, settings, etc.) |
| `web/renderer/ipc-api/` | HTTP wrappers that call the sidecar — one file per resource group |
| `web/renderer/components/` | Vue SFCs; `Base*` = reusable primitives, `The*` = single-instance layout |
| `src-tauri/` | Rust Tauri shell; `src/lib.rs` registers plugins, `src/sidecar.rs` manages the .NET child process (dev = `dotnet run`, release = pre-published binary) |
| `server/` | **.NET 10 / Furion 4.9.8 sidecar (the only backend).** `Program.cs` boots Furion via `Serve.Run()`; `Startup.cs` (an `AppStartup`) registers DI + middleware. Subfolders by resource: `Connections/`, `Schemas/`, `Tables/`, `Views/`, `Triggers/`, `Routines/`, `Functions/`, `Schedulers/`, `Users/`, `Ai/`, `WebSockets/`, `Workers/`, `Health/`, `Echo/`, `Application/`. `Infrastructure/` holds cross-cutting pieces: `EnvelopeResultProvider` (Furion `IUnifyResultProvider` impl), `SidecarTokenMiddleware`, `ReadyLineHook` (`IHostedService` that prints `READY:<port>:<token>`), `TokenGenerator`, `PortAllocator`. `Models/` holds DTOs. Built with `pnpm sidecar:build:net` (which calls `dotnet publish`) — output lands in `sidecar-net/antares-server[.exe]` |
| `server/AntaresServer.csproj` | net10.0, `PublishSingleFile=true`, `SelfContained=true`, RIDs `win-x64;linux-x64;osx-x64;osx-arm64`. NuGet deps: Furion 4.9.8.57, SqlSugarCore 5.1.4.214, MySqlConnector 2.4, Npgsql 8.0.5, Microsoft.Data.SqlClient 5.2.2, Microsoft.Data.Sqlite 9.0, SSH.NET 2024.2, Bogus 35.6 |
| `tests/integration-net/` | xUnit tests for the .NET sidecar — `SkeletonHealthTests.cs` (spawns the binary and probes /health), `ConnectionConfigBuilderTests.cs` (unit tests for the per-flavor switch). Run via `dotnet test`, **not** vitest |
| `sidecar-net/` | Build output of `pnpm sidecar:build:net` — `antares-server[.exe]` (~290 MB self-contained). **Gitignored** — staged into the bundle by `stage-resources.mjs --target=net`. CI / release builds rebuild from source |
| `scripts/build-net-sidecar.mjs` | Wraps `dotnet publish -c Release -r <rid> --self-contained -p:PublishSingleFile=true`, then runs the published binary in `--probe-mode` to mechanically verify it can boot and emit `READY:` |
| `scripts/preflight-net.mjs` | Verifies dotnet SDK ≥ 10.0 + RID availability before a release |
| `scripts/replay-contract.mjs` | Replays `tests/fixtures/contract/*.json` against the live sidecar to catch on-the-wire regressions after `server/` changes |
| `scripts/stage-resources.mjs` | Copies the .NET binary from `sidecar-net/` into `src-tauri/resources/`. `--target=net` is the only valid value (the legacy `--target=node` branch was deleted in Phase 18) |
| `docs/net-migration/` | Migration artifacts: `baseline-tag.txt` (pre-Phase-17 commit SHA for archeology) + `renderer-audit-allowlist.txt` |
| `docs/superpowers/plans/2026-05-06-net-sidecar-migration-v5.md` | The 18-phase execution plan for the Node→.NET migration (now fully complete) |
| `e2e/` | Playwright e2e tests — 8 specs as of 2026-05: 3 mssql (`mssql-database-switch`, `mssql-limit-guards`, `mssql-empty-table-header`) + 5 smoke (`app-boot`, `settings-modal`, `connection-modal`, `theme-toggle`, `i18n-locale-switch`). `playwright.config.ts` sets `testDir: './e2e'` and `baseURL: http://localhost:5173` (the Vite dev server, **not** the sidecar API port — fixed in commit `0f2621e`). Use `localhost` not `127.0.0.1`: Vite on Windows binds to IPv6 `[::1]` by default, so a literal `127.0.0.1` baseURL gives `ERR_CONNECTION_REFUSED`. Override per-spec via `VITE_URL` env var (mssql specs do this). Outputs go to `e2e-results/` (gitignored) |
| `tests/` | Shared test setup + helpers (`tests/setup.ts`, `tests/helpers/`) + IPC contract fixtures (`tests/fixtures/contract/`). Path alias `@tests/` resolves here. Unit tests themselves are **co-located** next to source as `*.test.ts` (not in this directory) |
| `docs/ui-spec.md` | Single source for UI padding/height/font/color/radius conventions |
| `docs/superpowers/plans/` | Written implementation plans (dated `YYYY-MM-DD-slug.md`) — check here before starting multi-step work |
| `docs/superpowers/rules/` | Long-lived recipes/rules (e.g. `shadcn-vue-migration-recipe.md`, `playwright-rules.md`) |
| `docs/superpowers/specs/` | Feature specs accompanying plans |

### Database clients

`server/Connections/ConnectionService.cs` is the connection manager; per-flavor query cancellation is split into `IQueryCanceller` implementations registered as `Singleton` in `Startup.cs`:

| Flavor | Cancellation impl | Driver |
|--------|-------------------|--------|
| `mysql` / `maria` | `MysqlQueryCanceller` | MySqlConnector |
| `pg` | `PgQueryCanceller` | Npgsql |
| `mssql` | `MssqlQueryCanceller` | Microsoft.Data.SqlClient |
| `sqlite` | `SqliteQueryCanceller` | Microsoft.Data.Sqlite |
| `firebird` | **dropped in 0.8.4** — `ConnectionConfigBuilder` throws `NotSupportedException` pointing users to 0.8.3 | _(none — see Firebird note below)_ |

Schema reading goes through `SchemaTreeBuilder` / `SchemaDiscoveryService` / `SchemaMetadataService` / `SchemaDdlService` (`server/Schemas/`); raw SQL is `RawQueryExecutor`. Tables/Views/Triggers/Routines/Functions/Schedulers/Users each have their own service folder. SqlSugar (`SqlSugarCore 5.1.4.214`) is the ORM/query builder for everything that doesn't go through `RawQueryExecutor`. New database support means adding a flavor enum + registering its `IQueryCanceller` + extending `ConnectionConfigBuilder`, and adding a customizations file in `web/common/customizations/`.

**Firebird (dropped in 0.8.4).** Upstream antares-sql/antares supported Firebird via `node-firebird`; the .NET 10 sidecar does not. SqlSugar 5.1.4 has no native Firebird provider, the community has not published a `SqlSugar.Firebird` package, and rewriting the schema / query / exporter / import stack against raw `FirebirdSql.Data.FirebirdClient` ADO.NET (~1500 lines of branch code) was deemed out of scope for the .NET migration. `ConnectionConfigBuilder.Build` explicitly throws `NotSupportedException` for `client == "firebird"`. The renderer's connection wizard (`WorkspaceAddConnectionPanel.vue`, `WorkspaceEditConnectionPanel.vue`) no longer lists Firebird as a choosable client; the `'firebird'` branch of `workspaces.ts`'s switch falls through to the mysql customizations as a UI-error-path fallback (a stale 0.8.3-era persisted connection hits the .NET reject before any UI flag matters). If a future maintainer wants to revive Firebird support: write a SqlSugar custom provider DLL (estimate 2–4 weeks) or carry a parallel raw-ADO.NET branch through every service that touches schema metadata. Either path is a meaningful project; this paragraph plus the commit that dropped Firebird (search `git log --grep "drop Firebird"`) is the only roadmap.

### State management

Pinia stores live in `web/renderer/stores/`. Settings are persisted via `web/renderer/libs/persistStore.ts` (wraps Tauri FS plugin). The `workspaces` store is the central coordinator for open connections and tabs.

### i18n

vue-i18n runs in **Composition API mode** (`legacy: false`). Locale files are JSON in `web/renderer/i18n/<locale>.json`; supported locales are `en-US`, `zh-CN`, `zh-TW`, `ja-JP`, `ko-KR` (declared in `supported-locales.ts` and wired up in `index.ts`). When adding new strings, add keys to `en-US.json` first — it is the source of truth and typed as `MessageSchema`. `pnpm translation:check <locale>` (e.g. `pnpm translation:check zh-TW`) diffs a single locale against `en-US.json`; the argument is required.

### Unit tests (Vitest)

~80 unit specs live alongside source as `*.test.ts` (`web/common/`, `web/renderer/`) plus shared helpers in `tests/`. `vitest.config.ts` uses `happy-dom` with three path aliases: `@/` → `web/renderer/`, `common/` → `web/common/`, `@tests/` → `tests/`. Setup file: `tests/setup.ts`.

The test rollout was tracked in [docs/superpowers/plans/2026-05-03-frontend-unit-test-rollout.md](docs/superpowers/plans/2026-05-03-frontend-unit-test-rollout.md) (v1) and [...rollout-v2-remaining.md](docs/superpowers/plans/2026-05-03-frontend-unit-test-rollout-v2-remaining.md) (v2 corrections from execution experience). 18 tasks across 7 PRs (T0–T17). The motivation was to **freeze ipc-api real-DB contracts before the Node sidecar gets replaced by .NET 10 + SqlSugar** — wrapper tests replay captured fixtures so the .NET rewrite can be verified against the same contracts.

**v2 plan codified 8 lessons from v1 execution** — the load-bearing ones for future sessions:

- **Subagents must self-verify before reporting**: prompts that dispatch to subagents must require them to run `pnpm lint` + `pnpm type-check` and confirm 0 errors before returning. v1 PR2 dumped 44 lint errors back on the supervisor; the prompt rule eliminated this.
- **vue-i18n mock isolation**: `vi.doUnmock('vue-i18n')` does **not** auto-restore within the same test file. Tests that need the real vue-i18n must live in a separate file from mocked tests (documented in `tests/setup.ts`).
- **i18n-ally lints `t('literal')` regardless of key existence**: in test code, wrap the probe key in a variable (`const probe = '__test__'; t(probe)`) to bypass the linter without disabling the rule.
- **happy-dom 20.x already has** `IntersectionObserver` / `ResizeObserver` / `matchMedia` / `KeyboardEvent.getModifierState` built in. `tests/setup.ts` still stubs them as defense-in-depth, but missing-API failures are not the actual risk — assertion mismatch is.
- **Subagents that find a source bug do not fix it**: lock current behavior with a characterization test, mark the commit message with `quirk`, and let the user/owner open a dedicated fix PR.
- **Fixture capture is user-driven**: real-DB fixtures in `tests/fixtures/contract/*.json` are produced from a live sidecar against the user's own DB credentials — **never** run by an agent against credentials passed through chat. Agents may produce hand-crafted fixtures by reading wrapper + route source (mark them with `metadata.source: 'hand-crafted-from-wrapper-and-route-source'`); real-DB capture is the user's responsibility, run in their own terminal. The `pnpm capture:contract` script that did this for the legacy Node sidecar was removed in Phase 18; rebuild it for the .NET sidecar if/when needed.

**Coverage gate (`scripts/check-coverage.mjs`) is the single source of truth — not vitest's built-in `coverage.thresholds`.** Vitest's thresholds don't support warn-only semantics, which mattered during the multi-PR buildup. The gate has two layers:

1. **Hard gate (CI blocks)**: `lines ≥ 60%` AND `branches ≥ 60%` measured **on non-component code only** (excludes `web/renderer/components/`). Reason: 194 `.vue` files vs ~14 unit-tested would make the global ratio dominated by files tested via Playwright e2e instead. Including them would make the gate unhittable — *do not "fix" this*.
2. **Zone targets (warn-only, exit 0)**: per-folder soft targets — `common-and-libs` lines/branches 95/90, `ipc-api` 90/75, `stores` 80/65, `composables` 85/70, `components` 40/25.

T16/T17 (the gate + CI integration) landed in commit `6c18e01`; the plan was archived in `5e0c644`.

## Conventions

### Vue components
- **PascalCase** for `.vue` file names and component usage in templates.
- `Base` prefix for reusable primitive components (`BaseSelect`, `BaseTextEditor`, etc.).
- `The` prefix for single-instance layout components.
- **kebab-case** for prop and event names in templates.

### TypeScript / general
- Use template literals for string composition.
- `defineEmits` uses TypeScript generic form (not array syntax).
- Path aliases: `@/` resolves to `web/renderer/`, `common/` resolves to `web/common/`.

### Commits
Conventional Commits style is enforced by commitlint (`fix:`, `feat:`, `refactor:`, etc.). Single-scope commits are preferred because releases and the CHANGELOG are generated from commit history.

### Keyboard shortcuts

Shortcuts are handled entirely via DOM `CustomEvent`s — Tauri's global shortcut API is not used. `useShortcutDispatcher` (`web/renderer/composables/useShortcutDispatcher.ts`) listens for `keydown` on `window` and dispatches `new CustomEvent('antares:<event>')`. Components subscribe with `window.addEventListener('antares:<event>', handler)`. Shortcut definitions live in `common/shortcuts.ts` and are stored in the `settings` Pinia store.

### Customizations pattern
When a feature exists for some databases but not others, gate it via the `customizations` object rather than hard-coding client checks in the UI. Access via `workspace.customizations.<feature>` in renderer code, or import `common/customizations/<client>.ts` directly.

### UI spec (read before any UI change)

All UI decisions — padding, height, font-size, color, radius, state persistence — are governed by [docs/ui-spec.md](docs/ui-spec.md). Read it **before** touching any component that affects visuals. It consolidates the existing `tailwind.css` design tokens, component heights/fonts derived from session work, the reverse-video rule for primary surfaces, and the Tailwind-vs-SCSS boundary. Do not invent values ad-hoc.

If `ui-spec.md` doesn't answer your question, the authoritative design file is `pencil-new.pen` at repo root — accessed via the `pencil` MCP server, but it requires the file to be open in Pencil desktop first (ask the user if MCP times out). Never try to `Read`/`Grep` `.pen` files; they're encrypted.

### UI stack: shadcn-vue + Tailwind v4

The renderer is **fully shadcn-vue + Tailwind CSS v4**. As of Phase 2 completion (2026-04-28), `spectre.css` has been removed entirely. `html { font-size: 20px }` workaround is gone — root is back to the browser default 16px.

**Stack details**:

- **shadcn-vue is not an npm package.** You won't find it in `package.json` — that's by design. It's a CLI that copies component source files into `web/renderer/components/ui/` (22 primitives as of 2026-05: Accordion / Badge / Button / Card / Checkbox / Combobox / ContextMenu / Dialog / DropdownMenu / FormField / Input / Label / Popover / RadioGroup / ScrollArea / Select / Separator / Sonner / Switch / Tabs / Textarea / Tooltip), which means **you own those files** and can edit them freely. Runtime deps powering those: `reka-ui` (Vue port of Radix UI — headless a11y primitives), `class-variance-authority` (variant API), `clsx` (conditional className merge), `tailwind-merge` (resolves conflicting Tailwind classes). This is also why CLAUDE.md warns never to run the shadcn-vue CLI in-repo — it would overwrite your local customizations (icon swap, dark-glass tokens, etc.).
- Tailwind v4 is configured entirely in `web/renderer/assets/tailwind.css`. Full `@import "tailwindcss"` (this was deliberately restored in commit `d19c7ff` because the split `theme.css + utilities.css` form skipped color utilities). There is **no** `tailwind.config.ts` — don't add one; add tokens/variants to the `@theme inline` / `@custom-variant` blocks instead.
- Design tokens are **hex CSS variables** (not HSL — do **not** wrap them in `hsl(...)` like upstream shadcn-vue docs suggest). Palette matches the `pencil-new.pen` design: brand `#FF5000`, light mode lavender-tinted neutrals (`--background: #ffffff`, `--accent: #f0e9ff`), dark mode "navy glass" (`--background: #08091A`), 4-step radius scale, `Inter` + CJK (`Microsoft JhengHei` / `PingFang TC` / `Noto Sans TC`) sans stack.
- The dark variant is declared as `@custom-variant dark (&:where(.theme-dark, .theme-dark *))` in `tailwind.css`. The `theme-${applicationTheme}` class on `#wrapper` (`App.vue`) drives Tailwind — don't rename it.
- Never install `lucide-vue-next`. shadcn-vue's default icons must be swapped to `BaseIcon` + `mdi*` names. See [docs/superpowers/rules/shadcn-vue-migration-recipe.md](docs/superpowers/rules/shadcn-vue-migration-recipe.md).
- Never let the shadcn-vue CLI write into the repo (`pnpm dlx shadcn-vue@latest add ...`). Run it in a scratch directory and hand-port, because the CLI assumes aliases/icon libs/HSL tokens that don't match this project.
- When migrating or refactoring a component, keep its **public API (props/emits/slots) identical** so callers don't need to change in the same PR. The whole Phase 2 migration was done this way — 80 files migrated with near-zero caller churn.
- **Tailwind rem-based tokens now resolve to standard sizes** (root = 16px): `text-xs` → 12px, `text-sm` → 14px, `text-base` → 16px. The `text-[12px]` / `text-[14px]` arbitrary tokens used during Phase 2 (when spectre forced `html { font-size: 20px }`) have been batch-reclaimed to `text-xs` / `text-sm`. Use native tokens for new code.
- Form `<input>` elements have a **browser-default `color: black`** that doesn't inherit from the themed ancestor. shadcn-vue's upstream `Input.vue` omits `text-foreground`, which makes typed text invisible on dark backgrounds. The local `web/renderer/components/ui/input/Input.vue` has `text-foreground` patched in — don't remove it, and add `text-foreground` to any raw `<input>` you hand-roll.
- `color-scheme: light / dark` **must** be set on `:root` and `.theme-dark` respectively in `web/renderer/assets/tailwind.css`. This is a browser-level hint that fixes Chrome's peach autofill background, native scrollbar / form-control colors, and the cream `<button>` default. Without it, native form controls render with light-OS colors even under `.theme-dark`. Paired with the `-webkit-autofill` override at the bottom of the same file (plus a solid `--autofill` token per theme to cover Chromium's peach bleed-through) — all three pieces are required.
- Dark `--card: rgb(255 255 255 / 0.04)` is an **intentional deviation** from shadcn-vue's default solid-card convention. It implements the approved "navy glass" design. If a component looks washed out against the `#08091A` body, add `bg-card/90 backdrop-blur-sm` or a hairline `border-border/60` at the call site rather than making `--card` opaque globally. All other dark tokens (`--secondary`, `--muted`, `--accent`, `--popover`) are intentionally **solid** to prevent Chromium's peach/yellow autofill bleeding through translucent form controls.
- A small set of legacy custom SCSS classes survive in `web/renderer/scss/main.scss`: `.cut-text`, `.no-outline`, `.no-radius`, `.no-border`, `.cancellable`, `.workspace-query-results .table .th/td` (custom result-table layout), `.workspace-tabs`, `.process-row`, `.rotate`, custom `::-webkit-scrollbar`, `.sql-hl-*`. These are app-specific and not spectre — keep them.

### Embedded SpecSnap Inspector

The sidebar crosshair icon opens the SpecSnap DOM inspector. Since 2026-04-22 this is the **`@tw199501/specsnap-inspector-vue`** published wrapper, mounted by `web/renderer/components/TheSpecSnapInspector.vue` as a ~90-line shell. The shell:

- Is gated by `applicationStore.isSpecsnap` via `App.vue`'s `v-if` (lazy — wrapper CSS only loads when first opened).
- Calls `inspectorRef.value?.open()` on mount (wrapper's built-in `:trigger` is disabled; the sidebar button is the only entry point).
- Bridges the panel's `@close` event back to `hideSpecsnap()` so the store flag flips false and the shell unmounts cleanly.
- Attaches `useDraggable` on top of the wrapper's panel. The wrapper uses `data-position="bottom-right"` corner pinning; the shell uses a `MutationObserver` to grab the Teleported panel, strips `data-position`, and replaces `bottom/right` with inline `top/left` driven by `@vueuse/core`'s `useDraggable` with the panel header as handle. This restores the drag-anywhere UX that the pre-0.0.9 hand-roll had. When upstream adds a native `draggable` / `position="custom"` prop, this shim can be removed.

Do **not** import from `@tw199501/specsnap-core` directly — the wrapper transitively re-exports any needed types via `@tw199501/specsnap-inspector-core`. There is also a direct `fflate` dep in `package.json` that exists solely because `inspector-core` dynamically imports `fflate` for its ZIP storage fallback but does not declare it as a dep (upstream oversight); removing `fflate` will break the production bundle.

Panel button labels are currently English-only (`Start Inspect` / `Clear` / `Copy MD` etc.) — the wrapper has no `labels` prop yet. The dormant `application.specsnap.{done,clear,copy,copied,…}` i18n keys remain in the locale files; they will reactivate when the wrapper accepts a `labels` prop upstream. Only `application.specsnap.inspector` (used as `panel-title` + sidebar tooltip) is live today.

### Sidecar bundle

`pnpm sidecar:build:net` runs `dotnet publish -c Release -r <rid> --self-contained -p:PublishSingleFile=true` in `server/`, producing `sidecar-net/antares-server[.exe]` (~290 MB on win-x64 — self-contained means the entire .NET 10 runtime is statically embedded). `scripts/stage-resources.mjs --target=net` then copies that single binary into `src-tauri/resources/`. No `node_modules`, no separate runtime to download — the .NET binary statically links everything. After changing anything in `server/`, run `pnpm sidecar:build:net` to verify; CI rebuilds from source on every release.

### Cross-platform Tauri configuration

Tauri v2 auto-merges `tauri.{windows,macos,linux}.conf.json` on top of base `tauri.conf.json` (no CLI flag needed). The merge is **deep on `bundle.resources`** — the base map and the platform map are unioned, not replaced. After Phase 17.5 (commit `496a134`) each platform declares its own binary so the union has no dead entries on any platform:

| File | Adds / overrides |
|------|------------------|
| `tauri.conf.json` | `bundle.targets: ["nsis", "msi"]` (Windows-default; per-platform overrides supply mac/linux targets), `bundle.resources: {}` (empty — each platform contributes its own binary) |
| `tauri.windows.conf.json` | `bundle.resources: { "resources/antares-server.exe": "antares-server.exe" }` |
| `tauri.macos.conf.json` | `bundle.targets: ["dmg", "app"]`, `bundle.resources: { "resources/antares-server": "antares-server" }` |
| `tauri.linux.conf.json` | `bundle.targets: ["appimage", "deb", "rpm"]`, `bundle.resources: { "resources/antares-server": "antares-server" }` |

`stage-resources.mjs --target=net` picks the correct binary name by `process.platform === 'win32' ? 'antares-server.exe' : 'antares-server'`, matching the per-platform conf entry exactly.

> Why **not** keep a shared entry in base? Tauri's deep-merge on `bundle.resources` means a base `antares-server.exe` would still be requested on macOS / Linux even after a platform-specific override, and `stage-resources.mjs --target=net` doesn't produce that name there. The Phase 17.5 fix moved the entry **out** of base so each platform's resource map is exactly one entry, with the right filename. This cost two extra lines of config; the alternative (a generic name in base, no extension) breaks NSIS-driven invocation on Windows.

### CI/CD pipeline

Five workflow files live under `.github/workflows/`. Two drive routine builds, three are auxiliary:

- **`test-build.yml`** — triggers on push to `dev` (and manual dispatch). Runs vitest unit tests + `test:coverage:check` (hard 60/60 gate) on Linux as a separate job, then builds 4 platforms (Windows / macOS Intel x64 / macOS Apple Silicon / Linux) and uploads as `actions/upload-artifact` with 3-day retention. The unit-test job is the merge gate; coverage failure blocks before the build matrix even starts.
- **`release.yml`** — triggers on tag `v[0-9]+.[0-9]+.[0-9]+`, builds the same 4 platforms, and uploads via `ncipollo/release-action` to a **public** (non-draft) GitHub Release. See `### Release process` below for the full flow.
- **`codeql-analysis.yml`** — GitHub-managed security scan, scheduled.
- **`test-e2e-win.yml`** — Playwright e2e on Windows, **manual dispatch only** (the `push` trigger is commented out). Not part of the merge gate.
- **`create-generated-sources.yml`** — upstream legacy from `antares-sql/antares`, retained but not relied on.

Each build job has an `actions/setup-dotnet@v4` step (`dotnet-version: '10.x'`) so `dotnet publish` in `build-net-sidecar.mjs` has a runtime; `actions/setup-node@v4` is also present because the build orchestration (`scripts/tauri-build.mjs`, `stage-resources.mjs`, etc.) is Node. The `dotnet-version: '10.x'` floats to the latest .NET 10 patch — pin to a specific patch only if a build break demands it.

### Release process

The canonical release flow is **one command**: `pnpm release <version>` (e.g. `pnpm release patch` for 0.8.3 → 0.8.4). The script (`scripts/release.mjs`) does everything:

1. Pre-flight: refuses to run unless on `dev` with a clean working tree.
2. Bumps the version in **all 4 places it must stay in sync**: `package.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` (`antares2` entry only — Cargo.lock has many unrelated `version = "0.8.x"` lines for other crates, so the regex is anchored on the `[[package]]/name="antares2"` block), and `src-tauri/tauri.conf.json`.
3. Generates `docs/release-notes-vX.Y.Z.md` skeleton: groups commits since the previous tag by Conventional Commit type (`feat`/`fix`/`refactor`/`docs`/`chore`/etc.). Already-existing files are kept (re-running is idempotent).
4. Pauses for the author to fill in the prose section (skip via `--no-prompt`).
5. Commits `chore(release): bump version <prev> -> <next>`, annotated tag `vX.Y.Z`, pushes `dev` + tag.

Tag push triggers `release.yml`. Each of the 4 build jobs ends with `ncipollo/release-action` which **creates one public Release** (`draft: false`) with **`docs/release-notes-vX.Y.Z.md` as the body** (`bodyFile`), `omitBodyDuringUpdate: true` so only the first finishing job sets the body. Subsequent jobs add their artifacts.

**Three pre-existing bugs were closed in the v0.8.3 release work; if anything regresses, check these first:**

1. **`permissions: contents: write`** at `release.yml` workflow level. Without it, `ncipollo/release-action` gets `HTTP 403 "Resource not accessible by integration"` because GitHub's default `GITHUB_TOKEN` is `contents: read` since 2023. Symptom: build steps succeed, the "Upload to Release" step fails with that exact 403.
2. **`bundle.icon` in `tauri.conf.json` references `icons/icon.icns` and `icons/icon.ico`**, but neither was committed for the first 2 releases. Bundle step on macOS / Linux silently fails: `Failed to create app icon: resource path 'icons/icon.icns' doesn't exist`. Regenerate the full set with `pnpm tauri icon src-tauri/icons/1024X1024.png` if you ever swap the source PNG; only commit the 4 files actually referenced by `bundle.icon` (32x32.png, 128x128.png, icon.ico, icon.icns) — skip the auto-generated Android/iOS/Windows-Store outputs.
3. **`generateReleaseNotes: true`** must NOT be passed to `ncipollo/release-action` — the project ships hand-written `docs/release-notes-vX.Y.Z.md` files. The auto-generation API also needs `contents: write`, so leaving it on creates a second 403 path.

**If a release goes wrong** (build failures, 403, etc.) before the tag has produced a usable Release: cancel the in-flight workflow run, fix the issue on `dev` + merge to `master`, then `git tag -d vX.Y.Z && git tag -a vX.Y.Z <new-master-sha> && git push origin vX.Y.Z --force`. Force-pushing a tag is acceptable **only** when the prior attempt didn't produce a public Release (which it can't, if it 403'd). Once a Release with that tag has been published and downloaded, re-tagging is destructive and should be avoided.

**In-app auto-updater is half-wired but kept dormant.** Both halves of the feature panic when triggered without a real keypair, so two pieces are deliberately left disabled until the user runs the activation procedure below:

1. The plugin registration line in `src-tauri/src/lib.rs` is **commented out**. Tauri's updater plugin panics at startup if `plugins.updater` isn't in `tauri.conf.json` with a valid minisign base64 pubkey.
2. The `plugins.updater` block in `src-tauri/tauri.conf.json` is **absent**. An invalid placeholder pubkey also panics.

What IS already in place (does no harm without activation):

- `tauri-plugin-updater = "2"` declared in `src-tauri/Cargo.toml`
- `updater:default` + `process:allow-restart` permissions in `src-tauri/capabilities/default.json`
- 4 build jobs in `.github/workflows/release.yml` pass `TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` env vars to `pnpm tauri:build` (silently ignored when secrets are unset)
- Renderer flow: `web/renderer/ipc-api/Updater.ts` + `application` Pinia store (`checkForUpdates` / `installUpdate`) + `ModalSettingsUpdate.vue` UI + i18n keys. With the plugin not registered, `check()` throws → caught → status becomes `'nocheck'` → the "Check for updates" button in settings is a graceful no-op instead of crashing.

**Activating the feature** is a one-time setup:

1. `pnpm tauri signer generate -w ~/.tauri/antares2-updater.key` (no password recommended)
2. Add this block to `src-tauri/tauri.conf.json` (top-level), pasting the **contents of `~/.tauri/antares2-updater.key.pub`** as the `pubkey` value (single line, base64):
   ```json
   "plugins": {
     "updater": {
       "endpoints": ["https://github.com/TW199501/Antares2/releases/latest/download/latest.json"],
       "pubkey": "<paste here>",
       "windows": { "installMode": "passive" }
     }
   }
   ```
3. **Uncomment the `.plugin(tauri_plugin_updater::Builder::new().build())` line** in `src-tauri/src/lib.rs`.
4. `gh secret set TAURI_SIGNING_PRIVATE_KEY < ~/.tauri/antares2-updater.key`
5. (optional) `gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --body "<your-password>"`
6. **Back up `~/.tauri/antares2-updater.key`** outside of git — GitHub Secrets are write-only after upload, so this private key is the only way to keep signing the same chain. Lose it = all installed users must re-install when you rotate to a new pubkey.
7. Cut a release with `pnpm release patch`.

**Outstanding (not yet implemented):** generating `latest.json` manifest after build and uploading it to the Release. Without this file, the updater endpoint returns 404 and `check()` resolves to `null` → `'noupdate'` status (graceful but the feature is moot until done). Approaches: a) post-build Node script that reads `*.sig` files + composes `latest.json`, b) switch to `tauri-action` which handles this natively. Track this work as a follow-up.

### Cross-platform Rust caveat

`src-tauri/src/sidecar.rs` has `#[cfg(windows)]` and `#[cfg(not(windows))]` branches (the latter calls `libc::kill` to terminate the sidecar child). On a Windows dev machine, `cargo check` / `cargo build` **does not compile** the `cfg(not(windows))` branch — so missing crates referenced only there will pass locally and only fail on macOS / Linux CI. Such crates must be declared under `[target.'cfg(unix)'.dependencies]` in `Cargo.toml` (currently: `libc = "0.2"`). The same trap applies to the `#[cfg(debug_assertions)]` (dev = `dotnet run`) vs `#[cfg(not(debug_assertions))]` (release = pre-built binary) branches in `spawn_server`: a `cargo check` of a debug build does not type-check the release path, and vice versa. When adding any platform-conditional or build-mode-conditional Rust code, push to `dev` and watch the CI run on a release build before assuming it works.
