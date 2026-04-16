# CI/CD Cross-Platform Build — Design Spec

**Date:** 2026-04-14  
**Status:** Approved for implementation

---

## Context

Antares SQL is a Tauri v2 desktop app (Rust + Vue 3 + Node.js sidecar). After migrating from Electron, the existing GitHub Actions workflows have accumulated technical debt: stale branch names (`develop`/`beta`), scattered per-platform artifact workflows, missing Linux RPM target, no bundled Node.js binary for macOS/Linux, and broken branch-guard logic.

All existing workflows will be **deleted** and replaced by a clean, unified set.

---

## Branch Model

| Branch | Purpose |
| --- | --- |
| `master` | Production-ready code; stable releases tagged here |
| `dev` | Active development; test builds triggered from here |
| `release` | Pre-release staging (reserved for future use) |

---

## Trigger Model

| Event | Workflow | Output |
| --- | --- | --- |
| `git push origin v*.*.*` | `release.yml` | GitHub Release (draft) with all platform installers |
| Push to `dev` OR manual dispatch | `test-build.yml` | Workflow artifacts (3-day retention, no release) |
| Manual dispatch | `test-e2e-win.yml` | E2E test results |
| Push to any branch | `codeql-analysis.yml` | Security scan |

---

## Platform Matrix

### Windows

*   Runner: `windows-latest`
*   Formats: `.exe` (NSIS), `.msi`
*   Node: bundled `sidecar/node.exe` (already committed)

### macOS Intel

*   Runner: `macos-13` (last Intel runner)
*   Formats: `.dmg`
*   Node: downloaded at build time → `sidecar/node` → bundled via `tauri.macos.conf.json`
*   Signing: **unsigned for now** (macOS Gatekeeper bypass: right-click → Open)

### macOS Apple Silicon

*   Runner: `macos-latest` (arm64)
*   Rust target: `aarch64-apple-darwin`
*   Formats: `.dmg`
*   Node: arm64 binary downloaded at build time

### Linux x64

*   Runner: `ubuntu-22.04`
*   System deps: `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`
*   Formats: `.AppImage`, `.deb`, `.rpm`
*   Node: downloaded at build time → bundled via `tauri.linux.conf.json`

---

## Node.js Bundling (macOS / Linux)

**Problem:** `sidecar.rs` only bundles `node.exe` for Windows. macOS/Linux production builds fall back to system `node`, which end-users may not have installed.

**Solution:**

1.  CI workflow steps download the official Node.js binary for the target platform/arch before `pnpm tauri:build`
2.  Place it at `sidecar/node` (no extension)
3.  Platform-specific Tauri config files (`tauri.macos.conf.json`, `tauri.linux.conf.json`) add it as a bundled resource
4.  `sidecar.rs` updated to also check `sidecar/node` (no extension) as fallback before system `node`

```
sidecar/node.exe   → Windows (committed to repo)
sidecar/node       → macOS / Linux (downloaded in CI, NOT committed)
```

The `sidecar/node` binary should be added to `.gitignore` to avoid accidental commits.

---

## Workflow Files

### Files to DELETE

*   `.github/workflows/build.yml`
*   `.github/workflows/build-beta.yml`
*   `.github/workflows/test-builds.yml`
*   `.github/workflows/create-artifact-macos.yml`
*   `.github/workflows/create-artifact-linux.yml`
*   `.github/workflows/create-artifact-linux-arm64.yml`
*   `.github/workflows/create-artifact-windows-appx.yml`

### Files to CREATE

*   `.github/workflows/release.yml` — tag-triggered, all platforms, uploads to GitHub Release as draft
*   `.github/workflows/test-build.yml` — dev push + manual dispatch, all platforms, artifacts only

### Files to KEEP (unchanged)

*   `.github/workflows/codeql-analysis.yml`
*   `.github/workflows/test-e2e-win.yml` (minor fix: remove hardcoded matrix)
*   `.github/workflows/create-generated-sources.yml`

---

## release.yml Design

```
Trigger: push tag matching v[0-9]+.[0-9]+.[0-9]+

Jobs (fail-fast: false, all run in parallel):
  build-windows   → windows-latest
  build-macos-x64 → macos-13
  build-macos-arm → macos-latest
  build-linux     → ubuntu-22.04

Each job:
  1. checkout (ref: master)
  2. install Rust stable
  3. (Linux only) install system deps
  4. (macOS/Linux only) download + place Node binary
  5. install pnpm@9
  6. install Node 20
  7. pnpm install
  8. pnpm tauri:build [--target for arm]
  9. upload artifacts to GitHub Release (draft)
     using ncipollo/release-action@v1
     allowUpdates: true, draft: true, generateReleaseNotes: true

Artifact globs per platform:
  Windows: **/*.exe, **/*.msi
  macOS:   **/*.dmg
  Linux:   **/*.AppImage, **/*.deb, **/*.rpm
```

---

## tauri.conf.json Changes

Add `"msi"` to targets (already done) and ensure Linux `.rpm` is configured:

```
"targets": ["nsis", "msi"]
```

Linux RPM requires no tauri.conf.json change — Tauri builds rpm automatically when on Linux if `rpm` tools are available. The `ubuntu-22.04` runner needs `rpm` package installed.

For macOS/Linux Node bundling, new platform config files:

`**src-tauri/tauri.macos.conf.json**`

```
{
  "bundle": {
    "resources": {
      "../sidecar/node": "sidecar/node"
    }
  }
}
```

`**src-tauri/tauri.linux.conf.json**`

```
{
  "bundle": {
    "resources": {
      "../sidecar/node": "sidecar/node"
    }
  }
}
```

---

## sidecar.rs Changes

Update the node binary lookup to check for `sidecar/node` (no extension) before falling back to system node:

```
let node_bin = {
    let node_exe  = exe_dir.join("sidecar").join("node.exe"); // Windows
    let node_unix = exe_dir.join("sidecar").join("node");     // macOS/Linux
    if node_exe.exists() {
        node_exe.to_string_lossy().to_string()
    } else if node_unix.exists() {
        node_unix.to_string_lossy().to_string()
    } else {
        "node".to_string() // last resort: system node
    }
};
```

---

## Error Handling

*   `fail-fast: false` on all matrix jobs — one platform failure does not cancel others
*   Node download failures in CI should fail the build immediately (not silently skip)
*   Draft release: all artifacts upload to a draft; human reviews and publishes

---

## Out of Scope (Future)

*   macOS code signing (add Apple cert to GitHub Secrets when ready)
*   Linux arm64 builds
*   Windows AppX/MSIX packaging
*   Auto-publish release (currently stays as draft)