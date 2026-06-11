# Antares2 v0.8.7

<!-- 補一段 release 主軸的人話敘述（為什麼這版重要、最關鍵的兩三件事）。骨架由 git log 自動產生，請刪掉這個註解。 -->

## ✨ Features

- feat(net): T5 — 補完 alter 剩餘 DDL (Deletions/Changes/Index/Foreign/Check)
- feat(net): T4 — ADD COLUMN per-flavor in `/api/tables/alter`

## 🐛 Bug fixes

- fix(ui): dedupe query-result fields via Set, simplify explorebar scroll watch
- fix(ui): retain newest console logs and cap notifications at 200
- fix(ui): R1 — BaseConfirmModal overlay orphan sweep + open prop
- fix(net): R3 — [NonUnify] action 例外回 200+envelope (wire contract)
- fix(net): T9 — accept renderer's bool sentinels (length=false, after=false)
- fix(test): SidecarTokenMiddlewareTests provide IHostEnvironment
- fix(net): T3 — 補表級註解寫回 (`/api/tables/alter` Phase 11 stub)
- fix(ui): T2 — 屬性表名稱 / 描述欄寬固定 200px
- fix(ui): T1 — toolbar 雙行高度統一 outer 44px
- fix(net): wire Furion auto-Swagger UI via app.UseInject(string.Empty)
- fix(test): unblock unit-test ELIFECYCLE — 11 fails -> 0, 38 errors -> 24 baseline
- fix(ui): unify .table .th/.td row height to outer 29 via global SCSS rule

## 🔧 Refactor

- refactor(net): drop unused IQueryCanceller injection and no-op MSSQL ALTER

## 📝 Documentation

- docs: note fresh-checkout sidecar build+stage requirement for tauri:dev
- docs: note pnpm-workspace and correct worktree path in CLAUDE.md
- docs: rewrite sidecar boot sequence + add Swagger paths
- docs(readme): drop DuckDB (never implemented), mark Firebird dropped in 0.8.4
- docs(plan): 0.9.0 cross-platform release implementation plan
- docs(spec): 0.9.0 cross-platform release + macOS sign/notarize design
- docs(net-migration): T0 — endpoint coverage diff Node baseline vs .NET
- docs(plan): properties tab — UI 一致性 + CRUD 邏輯稽核 + Node baseline diff

## 🧹 Housekeeping

- chore(repo): track macOS gen schema for platform symmetry with windows-schema
- chore(repo): gitignore .idea + .air, add pnpm-workspace allowBuilds config
- ci(release): sign + notarize macOS builds (Developer ID + App Store Connect API key)
- build(macos): codesign embedded .NET sidecar with hardened runtime before bundle
- build(macos): reference entitlements.mac.plist in macOS bundle config
- build(macos): add hardened-runtime entitlements for .NET sidecar
- chore: re-encode .nvmrc as UTF-8 LF (was UTF-16 LE BOM + CRLF)
- chore(repo): drop obsolete misc/ and snap/ directories from Electron-Antares era

## 🧪 Tests

- test(e2e): UI walkthrough spec + bug log for follow-up
- test(net): T8 — Tables DDL renderer pure-function xunit tests
- test(e2e): T7 — props-tab CRUD round-trip 驗 7 條 alter diff 路徑會真寫回 DB
- test(ipc-api): T6 — Tables.alterTable diff payload coverage

---

## English Summary

<!-- 中英對照的英文摘要 -->

## 🙏 Credits

Forked from [antares-sql/antares](https://github.com/antares-sql/antares) by Fabio Di Stasio (MIT License).
