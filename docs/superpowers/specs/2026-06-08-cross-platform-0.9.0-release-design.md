# Antares2 0.9.0 — Cross-Platform Release with macOS Signing & Notarization

- **Date:** 2026-06-08
- **Status:** Design approved — pending spec review
- **Owner:** tw199501
- **Type:** Release engineering + doc/cleanup batch

## Goal

Cut Antares2 **0.9.0** (minor bump from 0.8.6) producing installable artifacts on all
four CI targets, with the macOS `.dmg` builds (Intel + Apple Silicon) **code-signed with
a Developer ID Application certificate and notarized** so they pass Gatekeeper without any
user workaround. A small batch of doc/cleanup fixes lands first.

## Non-goals (explicit out-of-scope)

- **In-app auto-updater** stays dormant. No `latest.json` generation, no plugin
  activation. The existing `tauri-plugin-updater` wiring remains commented out per
  CLAUDE.md (`### Release process`). The `TAURI_SIGNING_PRIVATE_KEY*` env already passed
  to the build jobs stays but remains inert.
- **Windows Authenticode signing** — not done; the SmartScreen "unknown publisher"
  warning remains on first run. Functional, not blocking.
- **Linux deb/rpm GPG signing** — not done; only needed for apt/yum repo distribution.

## Decisions (locked with the user)

| Decision | Choice |
|---|---|
| Version | 0.9.0 (minor) |
| macOS distribution | Developer ID Application signing + notarization (stapled) |
| Notarization auth | App Store Connect API key (`.p8` + Key ID + Issuer ID) — preferred over Apple-ID + app-specific password |
| macOS architectures | Keep both Intel (x64, `macos-13`) and Apple Silicon (arm64, `macos-latest`) |
| Auto-updater | Remain dormant |

## Prerequisites — provided by the user (the agent cannot create these)

The macOS path cannot complete until these exist and are loaded into **GitHub Secrets**:

1. **Apple Developer Program membership** → 10-char **Team ID**.
2. **Developer ID Application certificate**, exported from Keychain as a `.p12` (+ export password).
3. **App Store Connect API key**: a `.p8` private key file + its **Key ID** + the **Issuer ID** (UUID), with a role of Developer or higher.

Secret names (consumed by Tauri v2's macOS bundler):

- `APPLE_CERTIFICATE` = base64 of the `.p12`
- `APPLE_CERTIFICATE_PASSWORD` = the `.p12` export password
- `APPLE_SIGNING_IDENTITY` = `Developer ID Application: <Name> (<TEAMID>)`
- `APPLE_TEAM_ID`
- `APPLE_API_ISSUER` (Issuer ID UUID), `APPLE_API_KEY` (Key ID), `APPLE_API_KEY_PATH` (path to the `.p8` materialized in the CI runner)

GitHub Secrets are write-only after upload — the user keeps local backups outside git.

## Phases

### Phase 1 — Fix batch (branch `dev`)

All mechanical; gated by `pnpm lint && pnpm type-check && pnpm check:eol`.

1. **Revert two no-op edits** to their committed state: `scripts/check-coverage.mjs`,
   `web/renderer/libs/ext-language_tools.js` (`git checkout -- <files>`). Both are
   behaviour-neutral accidental changes (`continue;` → empty block; `continue loop` →
   `continue` in a non-nested labelled loop).
2. **Normalize CRLF → LF**: `server/Triggers/TriggersService.cs` (108 CRLF lines),
   `server/Views/ViewsService.cs` (142 CRLF lines). Content unchanged; whole-file LF so
   the repo `check:eol` gate passes.
3. **`README.md` + `README.zh-TW.md`**: remove `DuckDB` from "Supported databases" (it was
   never implemented — zero code, not in the `ClientCode` union); change the `Firebird SQL`
   line to state it was dropped in 0.8.4 (use Antares2 ≤ 0.8.3 for Firebird).
4. **`CLAUDE.md`**: in the Process-model boot sequence, add the Swagger endpoints — UI at
   `/api/index.html`, OpenAPI doc at `/api/{group}/swagger.json` (served by
   `app.UseInject(string.Empty)` in `Startup.cs`, mounted *before* `SidecarTokenMiddleware`
   so dev browsing needs no token; loopback-only on 127.0.0.1).

**Acceptance:** lint + type-check clean; `pnpm check:eol` reports 0 CRLF for the two `.cs`
files; README lists neither DuckDB nor Firebird as supported; CLAUDE.md states the two
Swagger URLs.

### Phase 2 — macOS signing + notarization infrastructure

1. **`.github/workflows/release.yml`** — in both `build-macos-x64` and `build-macos-arm`,
   add the `APPLE_*` env block (the secrets listed above) to the `Build` step that runs
   `pnpm tauri:build`.
2. **Entitlements for the .NET sidecar** — add `src-tauri/entitlements.mac.plist` granting
   `com.apple.security.cs.allow-jit`, `com.apple.security.cs.allow-unsigned-executable-memory`,
   and `com.apple.security.cs.disable-library-validation`. The self-contained .NET 10 runtime
   needs these to run under macOS hardened runtime.
3. **Sign the nested `antares-server` binary** before the app is signed/notarized. Tauri
   signs the outer `.app`, but the bundled sidecar executable in `Contents/Resources/` is a
   separate Mach-O that must be independently code-signed with hardened runtime + the
   entitlements above, or notarization rejects the whole bundle. Implement as a step on the
   macOS build path — either a `codesign` of the staged binary inside
   `scripts/stage-resources.mjs` (mac branch) / a dedicated post-stage script, or a Tauri
   `beforeBundleCommand` hook. This is the highest-risk item — see Risks.
4. **`tauri.macos.conf.json`** — reference the entitlements plist (and set
   `minimumSystemVersion` if a floor is needed). The signing identity is supplied at build
   time via `APPLE_SIGNING_IDENTITY`; **no identity or secret is hardcoded in the repo**.

**Acceptance (verified at release time on the built artifacts, on a clean mac):**

- `codesign --verify --deep --strict --verbose=2 Antares2.app` → valid on disk
- `spctl -a -vvv Antares2.app` → `accepted` / source `Notarized Developer ID`
- `xcrun stapler validate Antares2.dmg` → `The validate action worked`

### Phase 3 — Cut the release

1. Ensure `dev` is clean and all Phase 1/2 changes are committed.
2. Run `pnpm release 0.9.0` — bumps the 4 version files (`package.json`,
   `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` `antares2` entry, `src-tauri/tauri.conf.json`),
   generates `docs/release-notes-v0.9.0.md`, commits `chore(release): bump version 0.8.6 -> 0.9.0`,
   tags `v0.9.0`, pushes `dev` + tag. **Never hand-edit the 4 version files.**
3. Fill in the release-notes prose section.
4. Tag push triggers `release.yml`: the four platform jobs build; the two mac jobs
   additionally sign + notarize + staple; `ncipollo/release-action` publishes one public
   (non-draft) Release with all artifacts attached.

**Acceptance:** GitHub Release `v0.9.0` exists (non-draft) carrying Windows (nsis + msi),
macOS (2 × dmg), and Linux (AppImage + deb + rpm) assets; a downloaded macOS `.dmg` opens
on a clean machine with no Gatekeeper override.

## Risks & mitigations

1. **Nested .NET sidecar signing/notarization (highest).** .NET self-contained binaries
   under hardened runtime routinely fail notarization without the JIT / library-validation
   entitlements and an explicit nested `codesign`. Mitigation: Phase 2.2–2.3; validate with
   `codesign --verify --deep` and, if uncertain, do one notarization dry-run on a throwaway
   tag before tagging `v0.9.0`.
2. **`macos-13` Intel runner deprecation.** GitHub is phasing out the macOS 13 Intel image.
   Mitigation: if it becomes unavailable, move `build-macos-x64` to a supported Intel image
   or drop Intel (deferred; both arches kept for now).
3. **Notarization latency / transient Apple API errors.** First submission can take several
   minutes; Tauri waits inline. A transient Apple-side failure may need a job re-run.
4. **Version-file drift.** Only `pnpm release` touches the 4 version files (per CLAUDE.md).

## Verification summary (commands)

- **Phase 1:** `pnpm lint`, `pnpm type-check`, `pnpm check:eol`, `pnpm replay:contract` (smoke — no DTO change expected).
- **Phase 2:** `codesign`, `spctl`, `xcrun stapler validate` on the CI-built artifacts.
- **Phase 3:** GitHub Release assets present + a manual Gatekeeper open test on macOS.
