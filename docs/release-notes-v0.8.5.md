# Antares2 v0.8.5

<!-- 補一段 release 主軸的人話敘述（為什麼這版重要、最關鍵的兩三件事）。骨架由 git log 自動產生，請刪掉這個註解。 -->

## ✨ Features

- feat(ui): merge ProcessesList into bottom console as a tab
- feat(diag): permanent renderer error + API-call diagnostics
- feat(ui): connection panel real-DB dropdown via /api/connection/listDatabases
- feat(net-mig)!: drop Firebird support in 0.8.4
- feat(net-mig): phase 00-15 — preflight + skeleton + 80 endpoint .NET sidecar
- feat(test): T7 hand-crafted IPC fixtures + script hardening (PR3.A)
- feat(test): T7 capture-contract-fixtures script + fixtures README (PR3)
- feat(test): T2 — global setup mocks + Pinia/composable test helpers
- feat(test): add Vitest infrastructure (T1 / PR1)
- feat(i18n): register 29 query-builder keys across 5 locales
- feat(workspace): wire tab-strip "+" to ModalQueryBuilder
- feat(query-builder): add ModalQueryBuilder.vue (Task 4 integration)
- feat(query-builder): add QueryBuilderSingleTable.vue visual form
- feat(composable): extract useQueryExecution from WorkspaceTabQuery
- feat(common): add SQL builder utility for SQL Server single-table queries
- feat(props-table): widen indexes / FK modals + searchable refTable picker
- feat(props-table): widen name col + expose edit btn + charset/collation modal + Google Translate

## 🐛 Bug fixes

- fix(ui): footer pager next to right icons + spectre tooltip migration
- fix(ui): processes list — render rows in inline mode, drop dead top icon, compact rows
- fix(net): table size/rows/collation in schema tree + [User] reserved word in getProcesses
- fix(net): TableDataDto.Duration so query timer doesn't show NaNs
- fix(net): clear sidecar token cache on respawn + table comments in schema tree
- fix(ui): sync system-db checkbox + auto-populate connection string
- fix(net): include column comments in /api/tables/getData response
- fix(net): bind sidecar to dev port 5555 and skip token enforcement in dev
- fix(ui): make BaseSelect popup width match trigger by default
- fix(ui): silence lightningcss :deep() and @apply warnings
- fix(ts): include playwright.config.ts + e2e/ in tsconfig
- fix(ui): add DialogDescription to ModalProcessesList for a11y
- fix(net): simplify GetDatabases DTO + add ListDatabases ephemeral endpoint
- fix(net): bypass DbMaintenance for MSSQL GetColumns/GetOptions
- fix(net): annotate manual-envelope endpoints with [NonUnify]
- fix(net): wire PortAllocator into Serve.Run(), no more fixed port 5000
- fix(net): return HTTP 200 for unhandled exceptions, not 500
- fix(deps): correct @types/mssql typo in package.json
- fix(common): sqlEscaper + querySplitter dollar-tag - upgrade quirks to correct behavior
- fix(composable): useResultTables resolves Pinia store inside function
- fix(types): clear 4 baseline type-check errors + correct interface drift
- fix(e2e): playwright baseURL → 5173 (vite dev server, was sidecar API port)
- fix(test): mountWithPinia type — cast mount call to silence T2345
- fix(layout): T0 follow-up — paths missed by initial spec
- fix(workspace): pre-select active data tab's table in query modal (M2)
- fix(query-builder): commit/rollback now check IpcResponse status
- fix(settings): enforce 60s minimum on tableAutoRefreshInterval
- fix(query-builder): address Task 3 code review (a11y + reactivity + dead state)
- fix(workspace-tab-table): rewrite auto-refresh effect — drop self-trigger race + gate on data view
- fix(sqlBuilder): address review feedback (empty-string + backend parity)
- fix(props-table): guard engines prop with Array.isArray for non-MySQL
- fix(props-table): user-feedback follow-ups (3 items)
- fix(ci): upgrade CodeQL workflow v1 -> v3 + grant correct permissions

## 🔧 Refactor

- refactor(ui): tab strip cleanup + ModalProcessesList inline prop
- refactor(net-mig): flip dev mode sidecar from Node tsx to .NET dotnet run
- refactor(layout): rename src/ to web/ to separate frontend (T0 / PR0)
- refactor(props-table): autocommit-on-confirm + read-only cells

## 📝 Documentation

- docs(plan): inventory .NET migration DTO regressions for batch fix
- docs: add wire contract + .NET sidecar gotchas + backend tests plan
- docs(e2e): add e2e/README with run/report/selector conventions
- docs: rewrite CLAUDE.md to .NET-only narrative (phase D)
- docs: align CLAUDE.md with .NET sidecar (phase 17 + 17.5)
- docs(net-mig): add phase 17.5 spec + plan
- docs(plan): coverage-to-60 plan + spec (4 phases, 14-22h, top 20 business components)
- docs(plan): .NET sidecar migration v5 - 18-phase locked execution plan + design spec
- docs(plan): add 2026-05-06 PR1/PR2/PR3 cleanup plan (post-audit v2, 38 -> ~80)
- docs(claude.md): refresh test stack section + fix stale e2e info
- docs(test): note vue-i18n mock isolation behavior in setup.ts
- docs(plan): frontend unit test rollout plan + 18 task specs (Phase 0)
- docs(plan): tighten searchColumns SQL injection in Phase 9
- docs(plan): integrate admin-net MCP server as knowledge source (v3)
- docs(plan): expand execution plan to 15 phases with Admin.NET adoption
- docs(plan): .NET 10 + SqlSugar execution plan with file-level detail
- docs(plan): backend inventory baseline for .NET migration
- docs(plan): .NET 10 + Furion + SqlSugar backend migration roadmap
- docs(composable): polish useQueryExecution per code review

## 🧹 Housekeeping

- chore(repo): wire cc-workflow-studio MCP + ignore sidecar runtime logs
- chore(repo): enforce no-worktree workflow rule via CLAUDE.md + PreToolUse hook
- chore(docs): drop obsolete 20260426 spec + trim playwright-rules trailing newline
- chore(deps): bump 4 NuGet packages auto-suggested by VS
- chore: gitignore .claude/scheduled_tasks.lock
- chore(net-mig)!: phase 18 — delete legacy Node sidecar wholesale
- chore(net-mig): phase 17.5 — unblock macOS / Linux release
- chore(net-mig): phase 17 — cutover Tauri sidecar to .NET binary
- chore(test): refine capture script + fixture README for PR1 real-capture (T18 prep)
- chore(docs): archive completed plans + ignore e2e-results in eslint
- chore(ci): T16 + T17 — coverage gate + CI unit-test job (PR7)
- chore(types): clear 9 baseline type errors (drift since 2026-04-28)

## 🧪 Tests

- test(net): add unit tests for Infrastructure + Connections (67 cases)
- test(e2e): cover scratchpad and specsnap inspector toggles (tasks 10/11)
- test(e2e): cover client switch (mysql/pg/mssql/sqlite) in connection panel (task 9)
- test(e2e): cover all 5 supported locales in i18n switch (task 5)
- test(e2e): add settings tabs (pagesize, shortcuts, about) coverage
- test(e2e): adopt shared helpers + per-step screenshots in 5 smoke specs
- test(e2e): wire playwright-rules infra (helpers + config)
- test(workspace): Phase H - rewrite QueryTable + Schema test (+0.5pp)
- test(workspace): Phase G - 23 small components (final coverage push, +4pp)
- test(workspace): Phase F - 9 medium business components (+4pp)
- test(workspace): Phase E - 15 mid-small business components (+5.5pp)
- test(workspace): Phase D - 15 mid-size business components (+5pp)
- test(workspace): Phase C - 10 medium business components (+4pp)
- test(workspace): Phase B - 5 medium business components (+3.5pp)
- test(workspace): Phase A - 5 large business component tests (+8pp)
- test(ui): batches 2-5 - 56 shadcn-vue primitive smoke tests
- test(ui): 20 shadcn-vue primitive smoke tests (Card/Dialog/Tabs/Tooltip/Accordion)
- test(e2e): T15 — 5 Playwright smoke specs + viewport (PR6/4)
- test(ui): T12 — shadcn primitive interaction smokes (PR6/1)
- test(components): T14 — The* layout + business + App.vue (PR6/3)
- test(components): T13 — 9 Base* primitive tests + history flake fix (PR6/2)
- test(stores): T9 + T11 — 7 small Pinia store tests (PR5/1+3)
- test(stores): T10 — 3 ipc-api Pinia store tests (PR5/2)
- test(ipc-api): T8 — 14 wrapper contract replay tests (PR4)
- test(renderer): T5 customizations shape + T6 composables (PR2 final)
- test(renderer): T4 — 9 renderer/libs utility test files (PR2)
- test(common): T3 — 14 utility test files for web/common/ (PR2)
- test(common): T3 sample — uidGen.test.ts + drop vitest internal threshold

---

## English Summary

<!-- 中英對照的英文摘要 -->

## 🙏 Credits

Forked from [antares-sql/antares](https://github.com/antares-sql/antares) by Fabio Di Stasio (MIT License).
