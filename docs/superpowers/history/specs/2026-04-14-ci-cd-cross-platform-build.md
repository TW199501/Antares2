# CI/CD Cross-Platform Build — Implementation Plan

> **Spec:** `docs/superpowers/specs/2026-04-14-ci-cd-cross-platform-build.md`  
> **Agentic workers:** Use `superpowers:executing-plans` or `superpowers:subagent-driven-development`

---

## Priority Levels

| Level | Meaning |
|-------|---------|
| P0 | Must work for any release to ship |
| P1 | Platform completeness — all target formats |
| P2 | End-user reliability — bundled Node.js |
| P3 | Future improvements — signing, arm64 |

---

## P0 — Core Release Workflow

### Task 1: Delete all obsolete workflows
- [ ] Delete `.github/workflows/build.yml`
- [ ] Delete `.github/workflows/build-beta.yml`
- [ ] Delete `.github/workflows/test-builds.yml`
- [ ] Delete `.github/workflows/create-artifact-macos.yml`
- [ ] Delete `.github/workflows/create-artifact-linux.yml`
- [ ] Delete `.github/workflows/create-artifact-linux-arm64.yml`
- [ ] Delete `.github/workflows/create-artifact-windows-appx.yml`

### Task 2: Create `.github/workflows/release.yml`

Trigger: `push` on tags matching `v[0-9]+.[0-9]+.[0-9]+`

Four parallel jobs, `fail-fast: false`:

**Job: `build-windows`** (`windows-latest`)
- [ ] checkout ref: master
- [ ] dtolnay/rust-toolchain@stable
- [ ] pnpm/action-setup@v4 (version: 9)
- [ ] actions/setup-node@v4 (node 20, cache: pnpm)
- [ ] `pnpm install`
- [ ] `pnpm tauri:build`
- [ ] ncipollo/release-action@v1 — upload `**/*.exe`, `**/*.msi` — draft: true, allowUpdates: true, generateReleaseNotes: true

**Job: `build-macos-x64`** (`macos-13`)
- [ ] checkout ref: master
- [ ] dtolnay/rust-toolchain@stable
- [ ] download Node 20 x64 darwin binary → `sidecar/node`, `chmod +x`
- [ ] pnpm/action-setup@v4
- [ ] actions/setup-node@v4
- [ ] `pnpm install`
- [ ] `pnpm tauri:build`
- [ ] ncipollo/release-action@v1 — upload `**/*.dmg` — draft: true, allowUpdates: true

**Job: `build-macos-arm`** (`macos-latest`)
- [ ] checkout ref: master
- [ ] dtolnay/rust-toolchain@stable with `targets: aarch64-apple-darwin`
- [ ] download Node 20 arm64 darwin binary → `sidecar/node`, `chmod +x`
- [ ] pnpm/action-setup@v4
- [ ] actions/setup-node@v4
- [ ] `pnpm install`
- [ ] `pnpm tauri:build --target aarch64-apple-darwin`
- [ ] ncipollo/release-action@v1 — upload `**/aarch64/**/*.dmg` — draft: true, allowUpdates: true

**Job: `build-linux`** (`ubuntu-22.04`)
- [ ] checkout ref: master
- [ ] dtolnay/rust-toolchain@stable
- [ ] `sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf rpm`
- [ ] download Node 20 x64 linux binary → `sidecar/node`, `chmod +x`
- [ ] pnpm/action-setup@v4
- [ ] actions/setup-node@v4
- [ ] `pnpm install`
- [ ] `pnpm tauri:build`
- [ ] ncipollo/release-action@v1 — upload `**/*.AppImage`, `**/*.deb`, `**/*.rpm` — draft: true, allowUpdates: true

---

## P1 — Test Build Workflow + Platform Config

### Task 3: Create `.github/workflows/test-build.yml`

Trigger: `push` to `dev` branch OR `workflow_dispatch`

Same four jobs as release.yml but:
- [ ] checkout uses `ref: dev` (or current SHA on push)
- [ ] Replace ncipollo/release-action with `actions/upload-artifact@v4`
  - retention-days: 3
  - names: `windows-build`, `macos-x64-build`, `macos-arm-build`, `linux-build`
- [ ] No GitHub Release created

### Task 4: Add `tauri.macos.conf.json`

File: `src-tauri/tauri.macos.conf.json`
- [ ] Create with content:
  ```json
  {
    "bundle": {
      "resources": {
        "../sidecar/node": "sidecar/node"
      }
    }
  }
  ```

### Task 5: Add `tauri.linux.conf.json`

File: `src-tauri/tauri.linux.conf.json`
- [ ] Create with content:
  ```json
  {
    "bundle": {
      "resources": {
        "../sidecar/node": "sidecar/node"
      }
    }
  }
  ```

### Task 6: Add `sidecar/node` to `.gitignore`
- [ ] Add `sidecar/node` to `.gitignore` (prevent committing platform binary)

---

## P2 — Node.js Sidecar Bundling (Rust)

### Task 7: Update `sidecar.rs` node binary lookup

File: `src-tauri/src/sidecar.rs`
- [ ] In the release build block, replace the current `node.exe`-only check:
  ```rust
  let node_bin = {
      let node_exe  = exe_dir.join("sidecar").join("node.exe");
      let node_unix = exe_dir.join("sidecar").join("node");
      if node_exe.exists() {
          node_exe.to_string_lossy().to_string()
      } else if node_unix.exists() {
          node_unix.to_string_lossy().to_string()
      } else {
          "node".to_string()
      }
  };
  ```
- [ ] Rebuild sidecar bundle: `pnpm sidecar:build`

---

## P3 — Future (Not In This Plan)

- [ ] macOS code signing (add `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_TEAM_ID` to GitHub Secrets)
- [ ] Linux arm64 builds
- [ ] Windows AppX/MSIX
- [ ] Auto-publish Release (remove `draft: true`)

---

## Acceptance Criteria

### P0
- [ ] Pushing tag `v0.8.0` on `master` triggers `release.yml`
- [ ] All four jobs run in parallel, independently (one failure doesn't cancel others)
- [ ] GitHub Release draft created with correct assets:
  - Windows: `Antares SQL_0.8.0_x64-setup.exe`, `Antares SQL_0.8.0_x64_en-US.msi`
  - macOS Intel: `Antares SQL_0.8.0_x64.dmg`
  - macOS ARM: `Antares SQL_0.8.0_aarch64.dmg`
  - Linux: `antares-sql_0.8.0_amd64.AppImage`, `antares-sql_0.8.0_amd64.deb`, `antares-sql_0.8.0.x86_64.rpm`

### P1
- [ ] Pushing to `dev` branch triggers `test-build.yml`
- [ ] Artifacts downloadable from GitHub Actions page (3-day retention)
- [ ] `tauri.macos.conf.json` and `tauri.linux.conf.json` present and valid

### P2
- [ ] macOS `.dmg` installs and launches without requiring system Node.js
- [ ] Linux `.AppImage` launches without requiring system Node.js

---

## Notes

- `ncipollo/release-action@v1` requires `GITHUB_TOKEN` — this is automatically provided by GitHub Actions, no manual secret needed
- Node binary download URL pattern:
  - macOS x64: `https://nodejs.org/dist/v20.x.x/node-v20.x.x-darwin-x64.tar.gz`
  - macOS arm64: `https://nodejs.org/dist/v20.x.x/node-v20.x.x-darwin-arm64.tar.gz`
  - Linux x64: `https://nodejs.org/dist/v20.x.x/node-v20.x.x-linux-x64.tar.gz`
  - Use Node 20 LTS (same version as the build environment)
- `macos-13` is the last GitHub-hosted Intel macOS runner; `macos-latest` is now arm64
- Linux RPM build requires `rpm` system package (added to apt-get step)
