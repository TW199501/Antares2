# Antares2 0.9.0 Cross-Platform Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Antares2 **0.9.0** with code-signed + notarized macOS `.dmg` builds (Intel + Apple Silicon) alongside the existing Windows/Linux installers, after a small doc/cleanup fix batch.

**Architecture:** Three implementation phases plus a user-owned credentials phase. Phase 1 = mechanical doc/working-tree cleanup on `dev`. Phase 2 = macOS signing infrastructure (entitlements plist + nested `.NET` sidecar `codesign` inside `stage-resources.mjs` + `APPLE_*` env in `release.yml`). Phase 3 = cut the release via `pnpm release 0.9.0` and verify CI artifacts. Phase 0 (user) loads Apple credentials into GitHub Secrets and blocks only Phase 3.

**Tech Stack:** Tauri v2 macOS bundler (`codesign` + `notarytool`), .NET 10 self-contained sidecar, GitHub Actions, `openssl` + `gh` CLI on Windows PowerShell, pnpm.

**Spec:** `docs/superpowers/specs/2026-06-08-cross-platform-0.9.0-release-design.md`

---

## Ownership legend

- 🧑 **USER** — you run these (Apple credentials, secrets, the release cut). Commands given for **Windows PowerShell** unless noted `(git-bash)`.
- 🤖 **AGENT** — implemented in-repo by Claude.

## Correction baked into this plan

The two `.cs` files (`TriggersService.cs`, `ViewsService.cs`) are **already LF in the committed index** (`git ls-files --eol` → `i/lf`); only the local working tree is CRLF. **CI is not affected.** Likewise the two `no-op` edits are uncommitted working-tree changes. All four are reverted by a single `git checkout --` with **nothing to commit** (Task 1).

---

## Phase 0 — Apple credentials 🧑 USER (do in parallel with Phase 1–2; blocks only Phase 3)

You have: paid membership ✅, API-key experience ✅. You need to **create a Developer ID Application certificate** (you don't have one) and load all secrets.

### Task 0.1: Get the Team ID
- [ ] Open <https://developer.apple.com/account> → **Membership details** → copy the 10-char **Team ID** (e.g. `AB12CD34EF`).

### Task 0.2: Create a Developer ID Application certificate → `.p12` (no Mac needed, via openssl)

> ⚠️ Only the **Account Holder** can create a Developer ID certificate.

- [ ] **Generate a private key + CSR** (git-bash or any openssl):

```bash
openssl genrsa -out devid.key 2048
openssl req -new -key devid.key -out devid.csr \
  -subj "/emailAddress=tw199501@elf.tw/CN=Antares2 Developer ID/C=TW"
```

- [ ] **Create the cert in Apple's portal:** <https://developer.apple.com/account/resources/certificates/list> → `+` → **Software ▸ Developer ID Application** → Continue → upload `devid.csr` → download `developerID_application.cer`.

- [ ] **Download Apple's intermediate** (helps the chain validate during notarization):
  <https://www.apple.com/certificateauthority/DeveloperIDG2CA.cer>

- [ ] **Bundle cert + key (+ intermediate) into a password-protected `.p12`:**

```bash
openssl x509 -inform DER -in developerID_application.cer -out devid.cer.pem
openssl x509 -inform DER -in DeveloperIDG2CA.cer        -out DeveloperIDG2CA.pem
openssl pkcs12 -export \
  -inkey devid.key \
  -in devid.cer.pem \
  -certfile DeveloperIDG2CA.pem \
  -name "Developer ID Application" \
  -out antares-devid.p12
# It prompts for an Export Password — remember it; that is APPLE_CERTIFICATE_PASSWORD.
```

- [ ] **Read the signing-identity string** (the part inside the cert): it is
  `Developer ID Application: <Your Name/Org> (<TEAMID>)`. The `<Your Name/Org>` matches your Apple account holder name; `<TEAMID>` is from Task 0.1.

### Task 0.3: App Store Connect API key (`.p8`) — you've done this before
- [ ] <https://appstoreconnect.apple.com/access/integrations/api> → **Keys** → `+` → role **Developer** → download `AuthKey_<KEYID>.p8` (one-time download).
- [ ] Note the **Key ID** (`<KEYID>`) and the **Issuer ID** (UUID at top of the Keys page).

### Task 0.4: Load all GitHub Secrets (PowerShell)

> PowerShell has no `<` input redirection — use `--body (Get-Content -Raw ...)`.

- [ ] Base64 the `.p12` and the `.p8`:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("antares-devid.p12")) | Out-File -Encoding ascii antares-devid.p12.b64
[Convert]::ToBase64String([IO.File]::ReadAllBytes("AuthKey_<KEYID>.p8")) | Out-File -Encoding ascii authkey.p8.b64
```

- [ ] Set the secrets:

```powershell
gh secret set APPLE_CERTIFICATE          --body (Get-Content -Raw antares-devid.p12.b64)
gh secret set APPLE_CERTIFICATE_PASSWORD --body "<your .p12 export password>"
gh secret set APPLE_SIGNING_IDENTITY     --body "Developer ID Application: <Your Name/Org> (<TEAMID>)"
gh secret set APPLE_TEAM_ID              --body "<TEAMID>"
gh secret set APPLE_API_ISSUER           --body "<issuer-uuid>"
gh secret set APPLE_API_KEY              --body "<KEYID>"
gh secret set APPLE_API_KEY_P8           --body (Get-Content -Raw authkey.p8.b64)
```

- [ ] **Verify** the 7 secrets exist: `gh secret list` shows `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_TEAM_ID`, `APPLE_API_ISSUER`, `APPLE_API_KEY`, `APPLE_API_KEY_P8`.
- [ ] **Delete the local plaintext key material** (`devid.key`, `*.p12`, `*.p8`, `*.b64`) after backing it up somewhere safe outside git. Secrets are write-only after upload.

---

## Phase 1 — Cleanup + doc fixes 🤖 AGENT (branch `dev`)

### Task 1: Revert the four working-tree deviations (no commit)

**Files:** `scripts/check-coverage.mjs`, `web/renderer/libs/ext-language_tools.js`, `server/Triggers/TriggersService.cs`, `server/Views/ViewsService.cs`

- [ ] **Step 1: Restore all four to their (clean LF) index state**

```bash
git checkout -- scripts/check-coverage.mjs web/renderer/libs/ext-language_tools.js server/Triggers/TriggersService.cs server/Views/ViewsService.cs
```

- [ ] **Step 2: Verify the working tree is clean for these**

Run: `git status --porcelain scripts/check-coverage.mjs web/renderer/libs/ext-language_tools.js server/Triggers/TriggersService.cs server/Views/ViewsService.cs`
Expected: **empty output** (no `M` lines).

- [ ] **Step 3: Verify EOL is now LF in the working tree**

Run: `git ls-files --eol server/Triggers/TriggersService.cs server/Views/ViewsService.cs`
Expected: both show `i/lf  w/lf  attr/text eol=lf`.

> No commit — these were never committed deviations.

### Task 2: README — drop DuckDB, mark Firebird dropped

**Files:** `README.md`, `README.zh-TW.md`

- [ ] **Step 1: Inspect the current "Supported databases" block in both files**

Run: `grep -nA12 -i "supported databases" README.md README.zh-TW.md`
Expected: a bullet list including `Firebird SQL` and `DuckDB`.

- [ ] **Step 2: Edit `README.md`** — in the "Supported databases" list, **delete the `* DuckDB` line and the `* More...` line**, and **replace the `* Firebird SQL` line** with:

```markdown
* ~~Firebird SQL~~ — dropped in 0.8.4 (use Antares2 ≤ 0.8.3 for Firebird)
```

- [ ] **Step 3: Edit `README.zh-TW.md`** — apply the same change (delete DuckDB + "更多..." line; strike Firebird):

```markdown
* ~~Firebird SQL~~ — 0.8.4 起移除（Firebird 請用 Antares2 ≤ 0.8.3）
```

- [ ] **Step 4: Verify DuckDB is gone from both READMEs**

Run: `grep -ni duckdb README.md README.zh-TW.md`
Expected: **no matches** (exit 1 / empty).

- [ ] **Step 5: Commit**

```bash
git add README.md README.zh-TW.md
git commit -m "docs(readme): drop DuckDB (never implemented), mark Firebird dropped in 0.8.4"
```

### Task 3: CLAUDE.md — add the Swagger endpoint paths

**Files:** `CLAUDE.md` (boot-sequence "Where these pieces live" paragraph)

> CLAUDE.md currently has uncommitted edits (the boot-sequence rewrite + markdown reformatting). This task adds the Swagger paths and commits the whole doc together. If the IDE's markdown formatter races your `Edit` ("File modified since read"), close CLAUDE.md in the editor or use a Node anchor-splice (see prior session technique).

- [ ] **Step 1: Append the Swagger paths to the "Where these pieces live" paragraph.** Find the sentence ending `… served by ``ExportImportHub``.` and add immediately after it:

```markdown
The auto-generated Swagger UI is at `/api/index.html` and the OpenAPI JSON at `/api/{group}/swagger.json` (Furion `app.UseInject(string.Empty)` in `Startup.cs`, mounted *before* `SidecarTokenMiddleware` so dev browsing needs no token; loopback-only on 127.0.0.1).
```

- [ ] **Step 2: Verify the Swagger paths are present and CLAUDE.md is LF**

Run: `grep -c "/api/index.html" CLAUDE.md` → expect `1`
Run (git-bash): `node -e "console.log((require('fs').readFileSync('CLAUDE.md').includes(0x0d)))"` → expect `false`

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: rewrite sidecar boot sequence + add Swagger paths"
```

### Task 4: Verify Phase 1 green

- [ ] **Step 1: Lint + type-check + EOL**

Run: `pnpm lint` → expect 0 errors (2 pre-existing tooltip warnings OK)
Run: `pnpm type-check` → expect 0 errors
Run: `pnpm check:eol` → expect `✓` (0 CRLF offenders)

---

## Phase 2 — macOS signing infrastructure 🤖 AGENT

> These changes are **inert off macOS / when `APPLE_SIGNING_IDENTITY` is unset**, so Windows/Linux builds and local unsigned mac builds are unaffected. They cannot be fully verified on Windows — final verification is in CI at Phase 3.

### Task 5: Add the hardened-runtime entitlements for the .NET sidecar

**Files:** Create `src-tauri/entitlements.mac.plist`

- [ ] **Step 1: Create the entitlements file**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
</dict>
</plist>
```

- [ ] **Step 2: Verify it is valid plist + LF**

Run (git-bash): `node -e "const s=require('fs').readFileSync('src-tauri/entitlements.mac.plist','utf8'); if(s.includes('\r'))throw 'CRLF'; if(!s.includes('allow-jit'))throw 'missing key'; console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add src-tauri/entitlements.mac.plist
git commit -m "build(macos): add hardened-runtime entitlements for .NET sidecar"
```

### Task 6: Point the macOS bundle at the entitlements

**Files:** Modify `src-tauri/tauri.macos.conf.json`

- [ ] **Step 1: Add the `macOS.entitlements` key** so the file reads exactly:

```json
{
   "bundle": {
      "targets": ["dmg", "app"],
      "resources": {
         "resources/antares-server": "antares-server"
      },
      "macOS": {
         "entitlements": "entitlements.mac.plist"
      }
   }
}
```

- [ ] **Step 2: Verify it parses as JSON**

Run (git-bash): `node -e "JSON.parse(require('fs').readFileSync('src-tauri/tauri.macos.conf.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add src-tauri/tauri.macos.conf.json
git commit -m "build(macos): reference entitlements.mac.plist in macOS bundle config"
```

### Task 7: Sign the nested sidecar in `stage-resources.mjs`

**Files:** Modify `scripts/stage-resources.mjs`

- [ ] **Step 1: Add the `spawnSync` import.** Change the top import line:

```js
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
```

- [ ] **Step 2: After the `copyFile(...)` call (currently line ~45), add the macOS codesign block:**

```js
const binaryName = process.platform === 'win32' ? 'antares-server.exe' : 'antares-server';
copyFile(`sidecar-net/${binaryName}`, binaryName);

// macOS: sign the embedded sidecar with hardened runtime + entitlements BEFORE
// `tauri build` bundles it into Antares2.app. Notarization rejects the bundle
// if this nested Mach-O isn't independently signed with the same Developer ID.
// No-op off macOS or when APPLE_SIGNING_IDENTITY is unset (local unsigned builds
// and Windows/Linux are unaffected).
if (process.platform === 'darwin' && process.env.APPLE_SIGNING_IDENTITY) {
   const staged = join(STAGING, binaryName);
   const entitlements = join(ROOT, 'src-tauri', 'entitlements.mac.plist');
   console.log(`  · codesign (hardened runtime) ${binaryName}`);
   const r = spawnSync('codesign', [
      '--force', '--options', 'runtime', '--timestamp',
      '--entitlements', entitlements,
      '--sign', process.env.APPLE_SIGNING_IDENTITY,
      staged
   ], { stdio: 'inherit' });
   if (r.status !== 0) {
      console.error('  ✗ codesign of sidecar failed');
      process.exit(r.status ?? 1);
   }
}
```

- [ ] **Step 3: Verify the script still runs on Windows (codesign block skipped)**

Run: `pnpm sidecar:build:net` then `node scripts/stage-resources.mjs --target=net`
Expected: `✓ staged → …` with **no** codesign line (Windows skips the block).

- [ ] **Step 4: Commit**

```bash
git add scripts/stage-resources.mjs
git commit -m "build(macos): codesign embedded .NET sidecar with hardened runtime before bundle"
```

### Task 8: Wire `APPLE_*` env into both macOS CI jobs

**Files:** Modify `.github/workflows/release.yml` (`build-macos-x64` and `build-macos-arm`)

- [ ] **Step 1: In `build-macos-x64`, replace the `Build` step** (around lines 98-102) with a key-materialize step + an env-rich build:

```yaml
      - name: Materialize App Store Connect API key
        run: echo "${{ secrets.APPLE_API_KEY_P8 }}" | openssl base64 -d -A > "$RUNNER_TEMP/AuthKey.p8"

      - name: Build
        env:
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          APPLE_API_ISSUER: ${{ secrets.APPLE_API_ISSUER }}
          APPLE_API_KEY: ${{ secrets.APPLE_API_KEY }}
          APPLE_API_KEY_PATH: ${{ runner.temp }}/AuthKey.p8
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        run: pnpm tauri:build
```

- [ ] **Step 2: In `build-macos-arm`, apply the same two steps**, but the build command keeps its target flag:

```yaml
        run: pnpm tauri:build --target aarch64-apple-darwin
```

- [ ] **Step 3: Verify the workflow is valid YAML**

Run (git-bash): `node -e "const y=require('fs').readFileSync('.github/workflows/release.yml','utf8'); if(y.includes('\r'))throw 'CRLF'; if((y.match(/APPLE_API_KEY_PATH/g)||[]).length!==2)throw 'expected 2 mac jobs wired'; console.log('ok')"`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci(release): sign + notarize macOS builds (Developer ID + App Store Connect API key)"
```

---

## Phase 3 — Cut the release 🧑 USER + 🤖 AGENT (needs Phase 0 + 1 + 2 done)

### Task 9: Bump + tag + push

- [ ] **Step 1: Confirm `dev` is clean** — Run: `git status --porcelain` → expect empty.
- [ ] **Step 2: Cut the release** (🧑 USER, PowerShell) — Run: `pnpm release 0.9.0`
  This bumps the 4 version files, generates `docs/release-notes-v0.9.0.md`, commits `chore(release): bump version 0.8.6 -> 0.9.0`, tags `v0.9.0`, pushes `dev` + tag. **Never hand-edit the 4 version files.**
- [ ] **Step 3: Verify version sync** — Run: `node -e "console.log(require('./package.json').version)"` → expect `0.9.0`; Run: `grep -n '^version' src-tauri/Cargo.toml` → expect `0.9.0`.

### Task 10: Fill release notes

- [ ] **Step 1:** Edit `docs/release-notes-v0.9.0.md` prose section (the `pnpm release` skeleton already grouped commits by type). Mention: cross-platform signed builds; Firebird/DuckDB doc correction.
- [ ] **Step 2: Commit + push** (if `pnpm release` paused for prose):

```bash
git add docs/release-notes-v0.9.0.md
git commit -m "docs(release): v0.9.0 notes"
git push origin dev
```

### Task 11: Verify the published artifacts

- [ ] **Step 1: Watch the run** — Run: `gh run watch` (or `gh run list --workflow=release.yml`). All 4 jobs green.
- [ ] **Step 2: Confirm the Release assets exist** — Run: `gh release view v0.9.0` → expect Windows (`*-setup.exe`, `*.msi`), macOS (2 × `*.dmg`), Linux (`*.AppImage`, `*.deb`, `*.rpm`).
- [ ] **Step 3 (needs a Mac — you or a tester): validate signing + notarization** on a downloaded `.dmg`:

```bash
spctl -a -t open --context context:primary-signature -vvv ~/Downloads/Antares2_0.9.0_*.dmg   # expect: accepted, source=Notarized Developer ID
xcrun stapler validate ~/Downloads/Antares2_0.9.0_*.dmg                                        # expect: The validate action worked
# after mounting + copying Antares2.app out:
codesign --verify --deep --strict --verbose=2 /Applications/Antares2.app                       # expect: valid on disk
```

- [ ] **Step 4: Smoke test** — open the `.app` on a clean Mac (no `xattr -cr`); it should launch without a Gatekeeper override, connect to a DB, and the sidecar should boot (READY line in Console.app under "Antares2" if needed).

---

## Risks & mitigations (from spec)

1. **Nested .NET sidecar notarization (highest).** Mitigated by Task 5–7. If notarization still rejects, check `notarytool log` for the rejected path; the most common cause is a missing entitlement or an unsigned helper inside the bundle. Consider a throwaway pre-tag (`v0.9.0-rc1`) to dry-run before the real tag.
2. **`macos-13` Intel runner deprecation.** If `build-macos-x64` fails to schedule, switch the runner image or drop Intel (both arches kept for now).
3. **Notarization latency.** First submit can take minutes; Tauri waits inline. Re-run the job on transient Apple-API errors.
4. **Version-file drift.** Only `pnpm release` touches the 4 version files.

## Out of scope (unchanged)

Auto-updater (stays dormant, no `latest.json`), Windows Authenticode signing, Linux deb/rpm GPG signing.
