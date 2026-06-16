# Phase 17.5 — macOS / Linux Release Unblock Implementation Plan

> Companion plan to `docs/superpowers/specs/2026-05-06-phase-17-5-release-unblock.md`. Spec captures *why* and acceptance criteria; this plan captures *what to change*.

**Goal:** Make `pnpm tauri:build` succeed on macOS (x64 + arm64) and Linux x64 in CI, restoring 4-platform release capability after the Phase 17 .NET cutover.

**Architecture:** Two parallel fixes that together unblock the release matrix:
1. Move the sidecar binary `bundle.resources` entry from the base `tauri.conf.json` into per-platform config files, so each platform declares the binary with its correct filename (`antares-server.exe` on Windows, `antares-server` elsewhere). Drop the dangling `sidecar/node` references from `tauri.macos.conf.json` / `tauri.linux.conf.json`.
2. Add `actions/setup-dotnet@v4` (`dotnet-version: '10.x'`) to all 4 build jobs in both `release.yml` and `test-build.yml`, before `pnpm tauri:build` runs (which triggers `dotnet publish` inside `scripts/build-net-sidecar.mjs`).

**Tech Stack:** Tauri v2 platform-config auto-merge, GitHub Actions, `actions/setup-dotnet@v4`, `dotnet 10.x`.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src-tauri/tauri.conf.json` | Modify line 14–16 | `bundle.resources` → `{}`. Targets stay `["nsis", "msi"]` (Windows-default; per-platform overrides supply mac/linux targets). |
| `src-tauri/tauri.windows.conf.json` | Modify line 3 | `bundle.resources` → `{ "resources/antares-server.exe": "antares-server.exe" }`. |
| `src-tauri/tauri.macos.conf.json` | Modify line 4–6 | Replace `sidecar/node` with `{ "resources/antares-server": "antares-server" }`. Targets `["dmg", "app"]` unchanged. |
| `src-tauri/tauri.linux.conf.json` | Modify line 4–6 | Replace `sidecar/node` with `{ "resources/antares-server": "antares-server" }`. Targets `["appimage", "deb", "rpm"]` unchanged. |
| `.github/workflows/release.yml` | Modify 4 jobs | Insert `setup-dotnet@v4` step (between `Install Rust` and the build invocation) in build-windows / build-macos-x64 / build-macos-arm / build-linux. |
| `.github/workflows/test-build.yml` | Modify 4 jobs | Same `setup-dotnet@v4` insertion in the same 4 build jobs (unit-test job unchanged). |

**Reused, not modified:**

- `scripts/stage-resources.mjs:64-67` — already platform-aware, picks `antares-server.exe` vs `antares-server` correctly. No change.
- `scripts/build-net-sidecar.mjs:16-27` — already RID-aware, infers the right binary name. No change.
- `scripts/tauri-build.mjs` — already orchestrates `build-net-sidecar.mjs` then `stage-resources.mjs --target=net` then `tauri build`. No change.

No new files. No new scripts. No new dependencies.

---

## Task 1: Move sidecar binary resource entry out of base tauri.conf.json

**Files:**
- Modify: `src-tauri/tauri.conf.json:14-16`

- [x] **Step 1: Edit `tauri.conf.json` to empty `bundle.resources`**

Replace the `bundle` block:

```json
   "bundle": {
      "active": true,
      "targets": ["nsis", "msi"],
      "resources": {},
      "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.ico", "icons/icon.icns"]
   },
```

(Only the `resources` value changes — from `{ "resources/antares-server.exe": "antares-server.exe" }` to `{}`. Targets / icon untouched.)

- [x] **Step 2: Verify JSON parses**

```powershell
node -e "JSON.parse(require('fs').readFileSync('src-tauri/tauri.conf.json', 'utf8'))"
```

Expected: no output, exit 0.

---

## Task 2: Declare Windows resource in tauri.windows.conf.json

**Files:**
- Modify: `src-tauri/tauri.windows.conf.json:1-5`

- [x] **Step 1: Replace `tauri.windows.conf.json` body**

```json
{
   "bundle": {
      "resources": {
         "resources/antares-server.exe": "antares-server.exe"
      }
   }
}
```

- [x] **Step 2: Smoke-test locally** — see Task 7.

---

## Task 3: Replace `sidecar/node` with .NET binary in tauri.macos.conf.json

**Files:**
- Modify: `src-tauri/tauri.macos.conf.json:1-8`

- [x] **Step 1: Replace file body**

```json
{
   "bundle": {
      "targets": ["dmg", "app"],
      "resources": {
         "resources/antares-server": "antares-server"
      }
   }
}
```

(Targets line unchanged; only `bundle.resources` switched from `sidecar/node` to the unsuffixed `antares-server`.)

- [x] **Step 2: Verify JSON parses**

```powershell
node -e "JSON.parse(require('fs').readFileSync('src-tauri/tauri.macos.conf.json', 'utf8'))"
```

---

## Task 4: Replace `sidecar/node` with .NET binary in tauri.linux.conf.json

**Files:**
- Modify: `src-tauri/tauri.linux.conf.json:1-8`

- [x] **Step 1: Replace file body**

```json
{
   "bundle": {
      "targets": ["appimage", "deb", "rpm"],
      "resources": {
         "resources/antares-server": "antares-server"
      }
   }
}
```

- [x] **Step 2: Verify JSON parses**

```powershell
node -e "JSON.parse(require('fs').readFileSync('src-tauri/tauri.linux.conf.json', 'utf8'))"
```

---

## Task 5: Add `setup-dotnet` to all 4 build jobs in release.yml

**Files:**
- Modify: `.github/workflows/release.yml`

The insertion point is **immediately after `Install Rust`, before the `Download Node.js binary` step (or `Install system dependencies` for the Linux job)**. Same step block in every job:

```yaml
      - name: Install .NET 10 SDK
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '10.x'
```

- [x] **Step 1: Insert into build-windows** — after `Install Rust`, before `Download Node.js binary for Windows x64`.
- [x] **Step 2: Insert into build-macos-x64** — same relative position.
- [x] **Step 3: Insert into build-macos-arm** — sibling step after the `Install Rust` block (which has its own `with: targets: aarch64-apple-darwin`).
- [x] **Step 4: Insert into build-linux** — between `Install Rust` and `Install system dependencies` (the apt-get block).

- [x] **Step 5: Verify YAML parses + all 4 jobs got the step exactly once**

```powershell
python -c "import yaml; doc=yaml.safe_load(open('.github/workflows/release.yml', encoding='utf-8')); [print(j, len([s for s in doc['jobs'][j]['steps'] if s.get('name')=='Install .NET 10 SDK'])) for j in doc['jobs']]"
```

Expected: each of `build-windows`, `build-macos-x64`, `build-macos-arm`, `build-linux` reports `1`.

---

## Task 6: Add `setup-dotnet` to all 4 build jobs in test-build.yml

**Files:**
- Modify: `.github/workflows/test-build.yml`

Same insertion as Task 5 — after each job's `Install Rust` step, before the `Download Node.js binary for <platform>` step (or `Install system dependencies` step in the Linux job). The `unit-test` job has neither Rust nor Tauri build, so it gets nothing.

- [x] **Step 1–4: Insert into all 4 build jobs.**

- [x] **Step 5: Verify YAML parses**

```powershell
python -c "import yaml; doc=yaml.safe_load(open('.github/workflows/test-build.yml', encoding='utf-8')); [print(j, len([s for s in doc['jobs'][j]['steps'] if s.get('name')=='Install .NET 10 SDK'])) for j in doc['jobs']]"
```

Expected: `unit-test 0` + 4 build jobs each at `1`.

---

## Task 7: Local Windows regression smoke

**Why:** The dev machine is Windows. Confirm Tasks 1 + 2 don't break the existing Windows build path before pushing for non-Windows CI to validate the rest.

- [x] **Step 1: Clean prior staging**

```powershell
Remove-Item -Recurse -Force src-tauri\resources -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force sidecar-net -ErrorAction SilentlyContinue
```

- [x] **Step 2: Run full release-style build**

```powershell
pnpm tauri:build
```

Expected output sequence:
1. `▸ Publishing .NET sidecar for win-x64 ...` (from `build-net-sidecar.mjs`)
2. `▸ Probing binary for READY line ...` → `✓ sidecar-net/antares-server.exe built + probe-verified`
3. `staging resources (target=net) ...` → `· sidecar-net/antares-server.exe → resources/antares-server.exe`
4. `Compiling antares2 v0.8.4 ...` (Cargo)
5. `Bundling Antares2_0.8.4_x64-setup.exe ...` (NSIS) and `... .msi` (WiX)

Final state: `src-tauri/target/release/bundle/nsis/Antares2_0.8.4_x64-setup.exe` and `src-tauri/target/release/bundle/msi/Antares2_0.8.4_x64_en-US.msi` both exist.

- [x] **Step 3: Sanity-check the bundle contains the .NET binary** (optional; if 7-Zip is in PATH)

```powershell
7z l "src-tauri\target\release\bundle\nsis\Antares2_0.8.4_x64-setup.exe" | Select-String "antares-server"
```

---

## Task 8: Commit

- [x] **Step 1: Stage the 6 modified files**

```powershell
git add src-tauri/tauri.conf.json src-tauri/tauri.windows.conf.json src-tauri/tauri.macos.conf.json src-tauri/tauri.linux.conf.json .github/workflows/release.yml .github/workflows/test-build.yml
```

- [x] **Step 2: Commit** with the message:

```
chore(net-mig): phase 17.5 — unblock macOS / Linux release

- Move sidecar binary resource entry out of base tauri.conf.json into
  per-platform configs (antares-server.exe for Windows, antares-server
  for mac/linux). Drops the dangling sidecar/node references the
  Phase 17 cutover left in tauri.macos.conf.json + tauri.linux.conf.json.
- Add actions/setup-dotnet@v4 (dotnet-version: 10.x) to all 4 build jobs
  in release.yml and test-build.yml so dotnet publish has a runtime on
  fresh CI runners.

Closes the two follow-ups documented in CLAUDE.md after commit 2f26bcb.
```

- [x] **Step 3: Push to `dev` and watch CI** — landed as `496a134` on `origin/dev`.

```powershell
git push origin dev
gh run watch
```

Expected: All 5 jobs (`unit-test`, `build-windows`, `build-macos-x64`, `build-macos-arm`, `build-linux`) finish green. Total wall-time ≈ 15–25 min depending on runner load.

---

## Verification (end-to-end)

After Task 8 push + CI green, perform a full release dry-run on a scratch tag to confirm the release path also works:

1. Create a throwaway pre-release tag locally (do NOT push):
   ```powershell
   git tag -a v0.8.4-rc1 -m "rc"
   ```
2. Run the release.yml workflow manually via `workflow_dispatch` (this requires temporarily changing `release.yml` to add a `workflow_dispatch:` trigger, OR pushing the rc tag and accepting the public release; recommend the workflow_dispatch path).
3. Confirm 4 build jobs upload artifacts; do NOT publish a real release.
4. Delete the rc tag once confirmed: `git tag -d v0.8.4-rc1`.

If you skip the dry-run, the next real `pnpm release patch` will be the verification — acceptable trade-off because the failure modes (missing dotnet, missing `sidecar/node`) both produce loud, non-data-corrupting errors and the previous release artifacts on the GitHub Release page are not affected by a failed run.

**Coverage / unit tests:** No `web/renderer/`, `web/common/`, `tests/` or `server/` source code is touched by this plan. The existing 60/60 coverage gate runs automatically via `unit-test` job in `test-build.yml` and should remain green; if it doesn't, that's an unrelated regression.
