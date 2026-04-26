/**
 * tauri-build.mjs
 *
 * Full production build:
 *   1. Build sidecar + workers
 *   2. tauri build  (produces exe + NSIS; MSI step may fail with ICE30)
 *   3. build-msi    (re-runs light.exe with ICE30 suppressed → MSI)
 *
 * Exit 0 only when NSIS succeeded and MSI was produced.
 */

import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

function run (cmd, args, opts = {}) {
   console.log(`\n> ${cmd} ${args.join(' ')}`);
   const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true, ...opts });
   return r.status ?? 1;
}

// ── Step 1: sidecar ──────────────────────────────────────────────────────────
const sidecarStatus = run('node', ['scripts/build-sidecar.mjs']);
if (sidecarStatus !== 0) {
   console.error('Sidecar build failed.');
   process.exit(sidecarStatus);
}

// ── Step 1b: stage resources ────────────────────────────────────────────────
// Tauri's object-form `**/*` glob flattens subdirs; we pre-stage with preserved
// structure into src-tauri/resources/ and reference that in tauri.conf.json.
const stageStatus = run('node', ['scripts/stage-resources.mjs']);
if (stageStatus !== 0) {
   console.error('Resource staging failed.');
   process.exit(stageStatus);
}

// ── Step 2: tauri build ──────────────────────────────────────────────────────
// On Windows, the MSI sub-step is expected to fail with ICE30; we re-run light.exe
// in step 3. On macOS/Linux, tauri build produces dmg/appimage/deb/rpm directly
// and the MSI step does not apply.
const tauriArgs = process.argv.slice(2); // pass through (e.g. --target aarch64-apple-darwin)
const tauriStatus = run('tauri', ['build', ...tauriArgs]);

if (process.platform !== 'win32') {
   // Non-Windows: tauri build's exit status is authoritative.
   process.exit(tauriStatus);
}

const NSIS = `src-tauri/target/release/bundle/nsis/Antares2_${version}_x64-setup.exe`;
if (!existsSync(NSIS)) {
   console.error('NSIS installer was not produced — aborting.');
   process.exit(tauriStatus);
}
console.log(`\nNSIS installer built → ${NSIS}`);

// ── Step 3: MSI via build-msi.mjs (Windows only) ─────────────────────────────
const msiStatus = run('node', ['scripts/build-msi.mjs']);

process.exit(msiStatus);
