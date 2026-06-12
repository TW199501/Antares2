/**
 * stage-resources.mjs
 *
 * Copies the .NET 10 sidecar binary into `src-tauri/resources/`, where
 * `tauri build` picks it up via `bundle.resources` per-platform entries.
 *
 * Single target: `--target=net` (default). The legacy `node` target was
 * removed in Phase 18 along with web/main/, workers/, sidecar/, and
 * scripts/build-sidecar.mjs. Argument retained for back-compat with
 * scripts/tauri-build.mjs callers.
 */

import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STAGING = join(ROOT, 'src-tauri', 'resources');

const args = process.argv.slice(2);
const targetArg = args.find(a => a.startsWith('--target='))?.split('=')[1] ?? 'net';
if (targetArg !== 'net') {
   console.error(`✗ invalid --target value: ${targetArg} (must be 'net'; the 'node' target was removed in Phase 18)`);
   process.exit(1);
}

rmSync(STAGING, { recursive: true, force: true });
mkdirSync(STAGING, { recursive: true });

function copyFile (relSrc, relDest) {
   const src = join(ROOT, relSrc);
   const dest = join(STAGING, relDest);
   if (!existsSync(src)) {
      console.error(`  ✗ missing: ${relSrc}`);
      process.exit(1);
   }
   mkdirSync(dirname(dest), { recursive: true });
   cpSync(src, dest);
   console.log(`  · ${relSrc} → resources/${relDest}`);
}

console.log(`staging resources (target=${targetArg}) …`);

const binaryName = process.platform === 'win32' ? 'antares-server.exe' : 'antares-server';
copyFile(`sidecar-net/${binaryName}`, binaryName);

// macOS: sign the embedded sidecar with hardened runtime + entitlements BEFORE
// `tauri build` bundles it into Antares2.app. Notarization rejects the bundle if
// this nested Mach-O isn't independently signed with the same Developer ID.
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

console.log(`\n✓ staged → ${STAGING}`);
