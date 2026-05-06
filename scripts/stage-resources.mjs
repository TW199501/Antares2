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

console.log(`\n✓ staged → ${STAGING}`);
