# Phase 17.5 — macOS / Linux Release Unblock (Spec)

> Companion spec to `docs/superpowers/plans/2026-05-06-phase-17-5-release-unblock.md`.

## Why this work

Commit `2f26bcb` (Phase 17, 2026-05-06) cut the production sidecar over from Node.js to a .NET 10 self-contained binary. The cutover was completed and merged on Windows, but two pieces of supporting infrastructure were not updated in the same commit:

1. **`tauri.macos.conf.json` and `tauri.linux.conf.json`** still contain `"resources/sidecar/node": "sidecar/node"` from the legacy Node sidecar path. `scripts/stage-resources.mjs --target=net` (the production staging script) does not produce `sidecar/node` anymore — it only stages `antares-server` / `antares-server.exe`. The base `tauri.conf.json` declares `"resources/antares-server.exe": "antares-server.exe"`, which is Windows-only naming. Tauri's platform config deep-merges the `bundle.resources` object: on macOS / Linux that yields a request for **both** `antares-server.exe` (from base) **and** `sidecar/node` (from platform override), neither of which exist. The bundle step fails with `✗ missing: sidecar/node`.

2. **`release.yml` and `test-build.yml`** have `setup-node` steps but no `setup-dotnet` step. `pnpm tauri:build` invokes `scripts/tauri-build.mjs` → `scripts/build-net-sidecar.mjs` → `dotnet publish`. On a fresh CI runner without `dotnet 10.x` installed, this fails with `dotnet: command not found` (Linux / mac runners) or pre-installed-but-wrong-major-version (Windows runners default to .NET 8/9 SDK depending on image vintage).

Both pieces are blocking — neither can ship a working non-Windows release without the other. Combining them into one PR avoids two consecutive failed release attempts.

## What "done" looks like

| # | Acceptance criterion | How to verify |
|---|----------------------|---------------|
| 1 | `pnpm tauri:build` on Windows produces NSIS + MSI installers as before (regression check) | Run locally on `win32`, inspect `src-tauri/target/release/bundle/{nsis,msi}/` |
| 2 | `test-build.yml` build-windows / build-macos-x64 / build-macos-arm / build-linux jobs all complete green when triggered by a push to `dev` | Push a no-op commit to `dev`, watch all 5 jobs (4 build + 1 unit-test) finish green in Actions |
| 3 | A subsequent `pnpm release patch` produces a tagged release where the `release.yml` matrix uploads NSIS + MSI + DMG (×2) + AppImage + deb + rpm to a public GitHub Release | Run release flow, confirm Release page has 7 artifacts |
| 4 | The .NET sidecar inside each non-Windows bundle is the unsuffixed `antares-server` binary, executable, and prints `READY:<port>:<token>` when invoked with `--probe-mode` | Unpack one of the `.dmg` / `.AppImage` artifacts, run the binary directly |
| 5 | Coverage gate on `unit-test` job remains green (no regression in `pnpm test:coverage:check`) | Job runs in parallel; existing 60/60 hard gate still passes |

## Out of scope (deliberately excluded)

- Removing the four `Download Node.js binary for <platform>` steps from the workflows. They are dead weight on the .NET path but **must remain** until Phase 18 lands so a `git revert 2f26bcb` rollback still produces working CI without an additional workflow change.
- Bumping `NODE_VERSION` from 20.19.0 — same reason.
- Firebird `IQueryCanceller`, Phase 18 Node deletion, auto-updater activation. Those are tracked in CLAUDE.md as separate follow-ups; each will be its own plan when prioritized.
- Replacing `actions/setup-dotnet@v4` with the `microsoft/setup-dotnet` action variant — `actions/setup-dotnet` is the canonical, well-supported choice as of 2026-05.

## Design decision: where to declare the sidecar binary resource

**Chosen:** Empty `bundle.resources: {}` in base `tauri.conf.json`. Each platform-specific config declares its own single resource entry.

**Rejected — keep in base, generalize name:** Drop the `.exe` from base and have `stage-resources.mjs` always stage as `antares-server`. This breaks Windows because the bundled binary needs `.exe` to be executable by the NSIS installer's runtime invocation.

**Rejected — keep current behavior, fix just mac/linux:** Override `bundle.resources` in mac/linux to drop the `.exe` entry. Doesn't work because Tauri deep-merges objects — the platform-specific override **adds to** the base entry, it does not replace it. So `antares-server.exe` would still be requested on mac/linux.

The chosen approach is the only one that produces a clean per-platform declaration with no dead entries.
