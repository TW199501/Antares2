/**
 * stage-resources.mjs
 *
 * Copies all files/packages that need to ship with the Tauri bundle into
 * `src-tauri/resources/`, preserving subdirectory structure.
 *
 * Two targets:
 *   --target=node  (default) — current Node sidecar (Fastify + esbuild bundle + native deps)
 *   --target=net              — .NET sidecar single-file binary (Phase 3+ of net migration)
 *
 * Why staging is needed for the Node target: Tauri v2's object-form `resources` config with
 * `**​/*` globs flattens subdirectories at the destination, breaking Node packages that rely on
 * relative require paths (e.g. node-firebird → `./wire/const`, ssh2 → `./lib/protocol/...`).
 * Staging via Node's `fs.cpSync(..., { recursive: true })` reliably preserves structure.
 *
 * Then `tauri.conf.json` references the staged directories with directory-to-directory mappings
 * (no globs) so Tauri copies them intact.
 */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STAGING = join(ROOT, 'src-tauri', 'resources');

const args = process.argv.slice(2);
const targetArg = args.find(a => a.startsWith('--target='))?.split('=')[1] ?? 'node';
if (!['node', 'net'].includes(targetArg)) {
   console.error(`✗ invalid --target value: ${targetArg} (must be 'node' or 'net')`);
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

console.log(`staging resources (target=${targetArg}) …`);

if (targetArg === 'net') {
   // .NET sidecar = one self-contained binary. No node runtime, no node_modules walk.
   const binaryName = process.platform === 'win32' ? 'antares-server.exe' : 'antares-server';
   copyFile(`sidecar-net/${binaryName}`, binaryName);
} else {
   // Node sidecar (current default through Phase 16; cuts over in Phase 17).

   // Node binary differs by platform: `node.exe` on Windows, `node` on macOS/Linux.
   // CI workflows download the right one into sidecar/ before this script runs.
   const nodeBin = process.platform === 'win32' ? 'node.exe' : 'node';
   copyFile(`sidecar/${nodeBin}`, `sidecar/${nodeBin}`);
   copyFile('sidecar/antares-server.cjs', 'sidecar/antares-server.cjs');

   copyDir('workers', 'workers');

   // Seed: packages required at sidecar runtime that are externalized from the
   // esbuild bundle (native addons, dynamic __dirname requires, or bindings-based
   // loads). We then walk their `dependencies` graphs to capture transitive deps
   // hoisted to top-level node_modules by pnpm — without this walk, runtime hits
   // `Cannot find module 'big-integer'` etc. when the sidecar starts.
   const seedPackages = [
      'better-sqlite3',
      'ssh2',
      '@heroku/socksv5',
      '@fabio286/ssh2-promise',
      'bindings',
      'file-uri-to-path',
      'node-firebird'
   ];

   const staged = new Set();
   const queue = [...seedPackages];
   while (queue.length) {
      const pkg = queue.shift();
      if (staged.has(pkg)) continue;
      const pkgJsonPath = join(ROOT, 'node_modules', pkg, 'package.json');
      if (!existsSync(pkgJsonPath)) {
         // Optional dep not installed (e.g. platform-specific). Skip silently.
         continue;
      }
      staged.add(pkg);
      copyDir(`node_modules/${pkg}`, `node_modules/${pkg}`);
      const deps = JSON.parse(readFileSync(pkgJsonPath, 'utf8')).dependencies || {};
      for (const dep of Object.keys(deps))
         if (!staged.has(dep)) queue.push(dep);
   }
   console.log(`  (resolved ${staged.size} packages from ${seedPackages.length} seeds)`);
}

console.log(`\n✓ staged → ${STAGING}`);
