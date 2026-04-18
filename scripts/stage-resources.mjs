/**
 * stage-resources.mjs
 *
 * Copies all files/packages that need to ship with the Tauri bundle into
 * `src-tauri/resources/`, preserving subdirectory structure.
 *
 * Why: Tauri v2's object-form `resources` config with `**​/*` globs flattens
 * subdirectories at the destination, breaking Node packages that rely on
 * relative require paths (e.g. node-firebird → `./wire/const`, ssh2 →
 * `./lib/protocol/...`). Staging via Node's `fs.cpSync(..., { recursive: true })`
 * reliably preserves structure.
 *
 * Then `tauri.conf.json` references the staged directories with
 * directory-to-directory mappings (no globs) so Tauri copies them intact.
 */

import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STAGING = join(ROOT, 'src-tauri', 'resources');

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

function copyDir (relSrc, relDest) {
   const src = join(ROOT, relSrc);
   const dest = join(STAGING, relDest);
   if (!existsSync(src)) {
      console.error(`  ✗ missing dir: ${relSrc}`);
      process.exit(1);
   }
   // dereference: true follows pnpm's symlinks (node_modules/x → .pnpm/x/...)
   // and copies the real file contents (Windows symlink creation needs admin).
   cpSync(src, dest, { recursive: true, dereference: true });
   console.log(`  · ${relSrc}/ → resources/${relDest}/`);
}

console.log('staging resources …');

copyFile('sidecar/node.exe', 'sidecar/node.exe');
copyFile('sidecar/antares-server.cjs', 'sidecar/antares-server.cjs');

copyDir('workers', 'workers');

const packages = [
   'better-sqlite3',
   'ssh2',
   '@heroku/socksv5',
   '@fabio286/ssh2-promise',
   'bindings',
   'file-uri-to-path',
   'node-firebird'
];
for (const pkg of packages)
   copyDir(`node_modules/${pkg}`, `node_modules/${pkg}`);

console.log(`\n✓ staged → ${STAGING}`);
