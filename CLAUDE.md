# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

Antares2 is a cross-platform desktop SQL client, forked from [antares-sql/antares](https://github.com/antares-sql/antares) by Fabio Di Stasio (MIT licensed, original project is no longer maintained). It supports MySQL/MariaDB, PostgreSQL, SQLite, Firebird SQL, and SQL Server. The app was originally Electron-based; it has been migrated to **Tauri v2** (Rust shell + Vue.js renderer). Any references to Electron elsewhere in the repo (old docs, comments) are historical — the current runtime is Tauri. Tauri identifier: `com.tw199501.antares2` (AppData at `%APPDATA%\com.tw199501.antares2\` on Windows, `~/.config/com.tw199501.antares2/` on Linux, `~/Library/Application Support/com.tw199501.antares2/` on macOS).

## Commands

```bash
# Development (starts Tauri shell + Vite dev server + sidecar automatically)
pnpm tauri:dev

# Run the sidecar server standalone in watch mode (useful for backend-only changes)
pnpm sidecar:dev

# Build for production
pnpm tauri:build

# Lint (ESLint + Stylelint)
pnpm lint
pnpm lint:fix

# Type-check Vue + TypeScript (12 known pre-existing errors as of 2026-04-28; new code should not add more)
pnpm type-check

# End-to-end tests (Playwright)
pnpm test:e2e

# Check translation completeness across all locales
pnpm translation:check

# Verify no remaining Electron API references after migration
pnpm verify:tauri-migration

# One-shot migration for users coming from upstream antares (copies AppData
# from com.fabio286.antares → com.tw199501.antares2). Not a routine dev task.
pnpm migrate:appdata

# Cut a release: bump the 4 version files (package.json / Cargo.toml /
# Cargo.lock antares2 entry / tauri.conf.json), generate the docs/release-
# notes-vX.Y.Z.md skeleton from `git log v_prev..HEAD`, commit, tag, push.
# Use `--dry-run` to preview, `--no-push` to keep it local. **Do not** edit
# the 4 version files by hand — let this script do it so they never drift.
pnpm release patch          # 0.8.3 -> 0.8.4
pnpm release 0.9.0 --dry-run
```

> The Vite dev server alone (`pnpm vite:dev`) also works: `sidecarPlugin` in `vite.config.ts` auto-starts the Fastify sidecar on port 5555.
>
> **Package manager:** Use `pnpm` only. The project has `pnpm-lock.yaml`. Delete `package-lock.json` if present.
>
> `pnpm tauri:build` runs `scripts/tauri-build.mjs`, which orchestrates: (1) `scripts/build-sidecar.mjs` rebuilds the server + worker bundles; (2) `scripts/stage-resources.mjs` copies them plus the native-module `node_modules/` subtrees into `src-tauri/resources/` with preserved directory structure (Tauri's object-form `**/*` glob flattens subdirs, which breaks `bindings`-based native loads); (3) `tauri build` produces installers per platform. **Windows-only** post-step (4): the MSI is re-built via `scripts/build-msi.mjs` which re-invokes WiX's `light.exe` with `ICE30` suppressed — without this, MSI fails because multiple sidecar files share the same target directory. On macOS/Linux step (4) is skipped and `tauri build`'s exit status is authoritative. Run `pnpm sidecar:build` standalone to rebuild only the bundle without a full Tauri build.

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

The Rust layer (`src-tauri/src/sidecar.rs`) spawns the Node.js server as a child process and reads its stdout for a `READY:<port>:<token>` line. The port and a per-session secret token are stored in global `Mutex` values. The renderer retrieves the token via the `get_sidecar_token` Tauri command and sends it as `X-Sidecar-Token` on every HTTP request; WebSocket connections pass it as a `?token=` query parameter. All non-`/health` routes reject requests that omit the correct token. The renderer's `src/renderer/ipc-api/httpClient.ts` wraps all backend calls as HTTP POST requests.

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
| `src/main/workers/` | Node.js Worker threads for long-running export/import jobs (`exporter.ts`, `importer.ts`) — export only supports MySQL/MariaDB, PostgreSQL, and SQL Server |
| `src/main/libs/exporters/` | Exporter hierarchy: `BaseExporter` → `SqlExporter` → database-specific exporters |
| `workers/` | Pre-built worker bundles (generated by `sidecar:build`, committed to repo, bundled as resources) |
| `sidecar/` | Pre-built server bundle `antares-server.cjs` (committed). The `node` / `node.exe` runtime binary lives here too but is **gitignored** — kept locally for `pnpm tauri:build` and downloaded fresh on each CI runner |
| `scripts/build-sidecar.mjs` | esbuild script that bundles `src/main/server.ts` → `sidecar/antares-server.cjs` and workers |
| `e2e/` | Playwright e2e tests — currently 3 SQL Server specs (`mssql-database-switch.spec.ts`, `mssql-limit-guards.spec.ts`, `mssql-empty-table-header.spec.ts`). `playwright.config.ts` sets `testDir: './e2e'` and `baseURL: http://127.0.0.1:5555`, so the Vite dev server (which boots the sidecar) must be running before `pnpm test:e2e`. Outputs go to `e2e-results/` (gitignored) |
| `docs/ui-spec.md` | Single source for UI padding/height/font/color/radius conventions |
| `docs/superpowers/plans/` | Written implementation plans (dated `YYYY-MM-DD-slug.md`) — check here before starting multi-step work |
| `docs/superpowers/rules/` | Long-lived recipes/rules (e.g. `shadcn-vue-migration-recipe.md`, `playwright-rules.md`) |
| `docs/superpowers/specs/` | Feature specs accompanying plans |

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

vue-i18n runs in **Composition API mode** (`legacy: false`). Locale files are JSON in `src/renderer/i18n/<locale>.json`; supported locales are `en-US`, `zh-CN`, `zh-TW`, `ja-JP`, `ko-KR` (declared in `supported-locales.ts` and wired up in `index.ts`). When adding new strings, add keys to `en-US.json` first — it is the source of truth and typed as `MessageSchema`. `pnpm translation:check <locale>` (e.g. `pnpm translation:check zh-TW`) diffs a single locale against `en-US.json`; the argument is required.

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

### Keyboard shortcuts

Shortcuts are handled entirely via DOM `CustomEvent`s — Tauri's global shortcut API is not used. `useShortcutDispatcher` (`src/renderer/composables/useShortcutDispatcher.ts`) listens for `keydown` on `window` and dispatches `new CustomEvent('antares:<event>')`. Components subscribe with `window.addEventListener('antares:<event>', handler)`. Shortcut definitions live in `common/shortcuts.ts` and are stored in the `settings` Pinia store.

### Customizations pattern
When a feature exists for some databases but not others, gate it via the `customizations` object rather than hard-coding client checks in the UI. Access via `workspace.customizations.<feature>` in renderer code, or import `common/customizations/<client>.ts` directly.

### UI spec (read before any UI change)

All UI decisions — padding, height, font-size, color, radius, state persistence — are governed by [docs/ui-spec.md](docs/ui-spec.md). Read it **before** touching any component that affects visuals. It consolidates the existing `tailwind.css` design tokens, component heights/fonts derived from session work, the reverse-video rule for primary surfaces, and the Tailwind-vs-SCSS boundary. Do not invent values ad-hoc.

If `ui-spec.md` doesn't answer your question, the authoritative design file is `pencil-new.pen` at repo root — accessed via the `pencil` MCP server, but it requires the file to be open in Pencil desktop first (ask the user if MCP times out). Never try to `Read`/`Grep` `.pen` files; they're encrypted.

### UI stack: shadcn-vue + Tailwind v4

The renderer is **fully shadcn-vue + Tailwind CSS v4**. As of Phase 2 completion (2026-04-28), `spectre.css` has been removed entirely. `html { font-size: 20px }` workaround is gone — root is back to the browser default 16px.

**Stack details**:

- **shadcn-vue is not an npm package.** You won't find it in `package.json` — that's by design. It's a CLI that copies component source files into `src/renderer/components/ui/` (22 primitives as of 2026-05: Accordion / Badge / Button / Card / Checkbox / Combobox / ContextMenu / Dialog / DropdownMenu / FormField / Input / Label / Popover / RadioGroup / ScrollArea / Select / Separator / Sonner / Switch / Tabs / Textarea / Tooltip), which means **you own those files** and can edit them freely. Runtime deps powering those: `reka-ui` (Vue port of Radix UI — headless a11y primitives), `class-variance-authority` (variant API), `clsx` (conditional className merge), `tailwind-merge` (resolves conflicting Tailwind classes). This is also why CLAUDE.md warns never to run the shadcn-vue CLI in-repo — it would overwrite your local customizations (icon swap, dark-glass tokens, etc.).
- Tailwind v4 is configured entirely in `src/renderer/assets/tailwind.css`. Full `@import "tailwindcss"` (this was deliberately restored in commit `d19c7ff` because the split `theme.css + utilities.css` form skipped color utilities). There is **no** `tailwind.config.ts` — don't add one; add tokens/variants to the `@theme inline` / `@custom-variant` blocks instead.
- Design tokens are **hex CSS variables** (not HSL — do **not** wrap them in `hsl(...)` like upstream shadcn-vue docs suggest). Palette matches the `pencil-new.pen` design: brand `#FF5000`, light mode lavender-tinted neutrals (`--background: #ffffff`, `--accent: #f0e9ff`), dark mode "navy glass" (`--background: #08091A`), 4-step radius scale, `Inter` + CJK (`Microsoft JhengHei` / `PingFang TC` / `Noto Sans TC`) sans stack.
- The dark variant is declared as `@custom-variant dark (&:where(.theme-dark, .theme-dark *))` in `tailwind.css`. The `theme-${applicationTheme}` class on `#wrapper` (`App.vue`) drives Tailwind — don't rename it.
- Never install `lucide-vue-next`. shadcn-vue's default icons must be swapped to `BaseIcon` + `mdi*` names. See [docs/superpowers/rules/shadcn-vue-migration-recipe.md](docs/superpowers/rules/shadcn-vue-migration-recipe.md).
- Never let the shadcn-vue CLI write into the repo (`pnpm dlx shadcn-vue@latest add ...`). Run it in a scratch directory and hand-port, because the CLI assumes aliases/icon libs/HSL tokens that don't match this project.
- When migrating or refactoring a component, keep its **public API (props/emits/slots) identical** so callers don't need to change in the same PR. The whole Phase 2 migration was done this way — 80 files migrated with near-zero caller churn.
- **Tailwind rem-based tokens now resolve to standard sizes** (root = 16px): `text-xs` → 12px, `text-sm` → 14px, `text-base` → 16px. The `text-[12px]` / `text-[14px]` arbitrary tokens used during Phase 2 (when spectre forced `html { font-size: 20px }`) have been batch-reclaimed to `text-xs` / `text-sm`. Use native tokens for new code.
- Form `<input>` elements have a **browser-default `color: black`** that doesn't inherit from the themed ancestor. shadcn-vue's upstream `Input.vue` omits `text-foreground`, which makes typed text invisible on dark backgrounds. The local `src/renderer/components/ui/input/Input.vue` has `text-foreground` patched in — don't remove it, and add `text-foreground` to any raw `<input>` you hand-roll.
- `color-scheme: light / dark` **must** be set on `:root` and `.theme-dark` respectively in `src/renderer/assets/tailwind.css`. This is a browser-level hint that fixes Chrome's peach autofill background, native scrollbar / form-control colors, and the cream `<button>` default. Without it, native form controls render with light-OS colors even under `.theme-dark`. Paired with the `-webkit-autofill` override at the bottom of the same file (plus a solid `--autofill` token per theme to cover Chromium's peach bleed-through) — all three pieces are required.
- Dark `--card: rgb(255 255 255 / 0.04)` is an **intentional deviation** from shadcn-vue's default solid-card convention. It implements the approved "navy glass" design. If a component looks washed out against the `#08091A` body, add `bg-card/90 backdrop-blur-sm` or a hairline `border-border/60` at the call site rather than making `--card` opaque globally. All other dark tokens (`--secondary`, `--muted`, `--accent`, `--popover`) are intentionally **solid** to prevent Chromium's peach/yellow autofill bleeding through translucent form controls.
- A small set of legacy custom SCSS classes survive in `src/renderer/scss/main.scss`: `.cut-text`, `.no-outline`, `.no-radius`, `.no-border`, `.cancellable`, `.workspace-query-results .table .th/td` (custom result-table layout), `.workspace-tabs`, `.process-row`, `.rotate`, custom `::-webkit-scrollbar`, `.sql-hl-*`. These are app-specific and not spectre — keep them.

### Embedded SpecSnap Inspector

The sidebar crosshair icon opens the SpecSnap DOM inspector. Since 2026-04-22 this is the **`@tw199501/specsnap-inspector-vue`** published wrapper, mounted by `src/renderer/components/TheSpecSnapInspector.vue` as a ~90-line shell. The shell:

- Is gated by `applicationStore.isSpecsnap` via `App.vue`'s `v-if` (lazy — wrapper CSS only loads when first opened).
- Calls `inspectorRef.value?.open()` on mount (wrapper's built-in `:trigger` is disabled; the sidebar button is the only entry point).
- Bridges the panel's `@close` event back to `hideSpecsnap()` so the store flag flips false and the shell unmounts cleanly.
- Attaches `useDraggable` on top of the wrapper's panel. The wrapper uses `data-position="bottom-right"` corner pinning; the shell uses a `MutationObserver` to grab the Teleported panel, strips `data-position`, and replaces `bottom/right` with inline `top/left` driven by `@vueuse/core`'s `useDraggable` with the panel header as handle. This restores the drag-anywhere UX that the pre-0.0.9 hand-roll had. When upstream adds a native `draggable` / `position="custom"` prop, this shim can be removed.

Do **not** import from `@tw199501/specsnap-core` directly — the wrapper transitively re-exports any needed types via `@tw199501/specsnap-inspector-core`. There is also a direct `fflate` dep in `package.json` that exists solely because `inspector-core` dynamically imports `fflate` for its ZIP storage fallback but does not declare it as a dep (upstream oversight); removing `fflate` will break the production bundle.

Panel button labels are currently English-only (`Start Inspect` / `Clear` / `Copy MD` etc.) — the wrapper has no `labels` prop yet. The dormant `application.specsnap.{done,clear,copy,copied,…}` i18n keys remain in the locale files; they will reactivate when the wrapper accepts a `labels` prop upstream. Only `application.specsnap.inspector` (used as `panel-title` + sidebar tooltip) is live today.

### Sidecar bundle
`sidecar/antares-server.cjs` and `workers/*.js` are esbuild outputs committed to the repo. After changing anything in `src/main/`, run `pnpm sidecar:build` and commit both the source change and the updated bundle together. Packages with dynamic `__dirname`-based requires or native addons (`@heroku/socksv5`, `better-sqlite3`, `ssh2`, `node-firebird`, etc.) are marked `external` in `scripts/build-sidecar.mjs` — they are loaded from the `node_modules/` directory that Tauri bundles as a resource alongside the exe.

**Recursive transitive-dep staging.** `scripts/stage-resources.mjs` does **not** maintain a hand-written package list. It starts from a 7-package seed (the externals above) and BFS-walks each package's `dependencies` from `package.json`, staging every reached package into `src-tauri/resources/node_modules/`. Currently resolves to ~52 packages. **Never** revert this to a hand-written list: pnpm hoists transitive deps (`big-integer`, `asn1`, `safer-buffer`, `ip-address`, etc.) to top-level `node_modules/`, and missing any one of them causes the installed sidecar to crash at startup with `Cannot find module 'X'`, surfacing as `TypeError: Failed to fetch` on every renderer API call. `tauri.conf.json` correspondingly maps the staged tree as a single dir-to-dir entry: `"resources/node_modules": "node_modules"` — adding new deps does not require tauri.conf changes.

### Cross-platform Tauri configuration

Tauri v2 auto-merges `tauri.{windows,macos,linux}.conf.json` (no CLI flag needed) on top of base `tauri.conf.json`. The split per platform:

| File | Adds / overrides |
|------|------------------|
| `tauri.conf.json` | `bundle.targets: ["nsis", "msi"]` (Windows-implicit), shared resources (`antares-server.cjs`, `workers/`, `node_modules/`) |
| `tauri.windows.conf.json` | Adds `resources/sidecar/node.exe` resource entry |
| `tauri.macos.conf.json` | `bundle.targets: ["dmg", "app"]` + `node` (no `.exe`) resource |
| `tauri.linux.conf.json` | `bundle.targets: ["appimage", "deb", "rpm"]` + `node` resource |

`stage-resources.mjs` picks the correct binary by `process.platform === 'win32' ? 'node.exe' : 'node'`. Adding new bundled resources usually means editing only `tauri.conf.json` (shared); only edit a platform file if the resource truly is OS-specific.

### CI/CD pipeline

Five workflow files live under `.github/workflows/`. Two drive routine builds, three are auxiliary:

- **`test-build.yml`** — triggers on push to `dev` (and manual dispatch). Builds 4 platforms (Windows / macOS Intel x64 / macOS Apple Silicon / Linux) and uploads as `actions/upload-artifact` with 3-day retention.
- **`release.yml`** — triggers on tag `v[0-9]+.[0-9]+.[0-9]+` from `master`. Builds the same 4 platforms and uploads via `ncipollo/release-action` to a draft GitHub Release.
- **`codeql-analysis.yml`** — GitHub-managed security scan, scheduled.
- **`test-e2e-win.yml`** — Playwright e2e on Windows, **manual dispatch only** (the `push` trigger is commented out). Not part of the merge gate.
- **`create-generated-sources.yml`** — upstream legacy from `antares-sql/antares`, retained but not relied on.

Each non-Windows job has a `Download Node.js binary for <platform>` step that `curl`s the exact `nodejs.org` tarball into `sidecar/`. The Windows job uses PowerShell `Invoke-WebRequest` to fetch the win-x64 zip and extract `node.exe`. **Required** because `sidecar/node*` is gitignored — without this step `stage-resources.mjs` fails with `✗ missing: sidecar/node[.exe]`. If you bump `NODE_VERSION` in any of the four download steps, bump it in all four (currently `20.19.0`).

Antares2 currently has **no** Tauri updater plugin configured (`tauri.conf.json` has no `plugins.updater` block). This means CI does not need `TAURI_SIGNING_PRIVATE_KEY` secrets and there is no signing step that can fail post-bundle. If updater is added later, the keypair must be generated **once** and stored as a GitHub Secret + a local backup — the private key is not retrievable from GitHub Secrets after upload.

### Cross-platform Rust caveat

`src-tauri/src/sidecar.rs` has `#[cfg(windows)]` and `#[cfg(not(windows))]` branches (the latter calls `libc::kill` to terminate the Node child). On a Windows dev machine, `cargo check` / `cargo build` **does not compile** the `cfg(not(windows))` branch — so missing crates referenced only there will pass locally and only fail on macOS/Linux CI. Such crates must be declared under `[target.'cfg(unix)'.dependencies]` in `Cargo.toml` (currently: `libc = "0.2"`). When adding any platform-conditional Rust code, push to `dev` and watch the CI run before assuming it works cross-platform.
