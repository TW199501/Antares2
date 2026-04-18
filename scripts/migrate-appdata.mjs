#!/usr/bin/env node
/**
 * One-shot migration helper for the Antares SQL → Antares2 rebrand.
 *
 * When the Tauri `identifier` changed from `com.fabio286.antares` to
 * `com.tw199501.antares2`, the AppData directory path changed too:
 *
 *   Windows : %APPDATA%\com.fabio286.antares\  →  %APPDATA%\com.tw199501.antares2\
 *   macOS   : ~/Library/Application Support/com.fabio286.antares/  →  .../com.tw199501.antares2/
 *   Linux   : ~/.config/com.fabio286.antares/  →  ~/.config/com.tw199501.antares2/
 *
 * Existing settings / saved connections live under the old path. Run this
 * once before launching the new build to copy them across.
 *
 * Safe by default:
 *   - Only copies, never deletes the old directory.
 *   - Aborts if the new directory already exists and is non-empty.
 *   - Pass `--force` to overwrite an existing new directory.
 *
 * Usage:
 *   node scripts/migrate-appdata.mjs            # interactive, safe
 *   node scripts/migrate-appdata.mjs --force    # overwrite new dir if present
 *   node scripts/migrate-appdata.mjs --dry-run  # show plan, don't touch disk
 */

import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { homedir, platform } from 'os';
import { join, sep } from 'path';

const OLD_ID = 'com.fabio286.antares';
const NEW_ID = 'com.tw199501.antares2';

const args = new Set(process.argv.slice(2));
const FORCE = args.has('--force');
const DRY = args.has('--dry-run');

function appDataRoot () {
   switch (platform()) {
      case 'win32':
         return process.env.APPDATA || join(homedir(), 'AppData', 'Roaming');
      case 'darwin':
         return join(homedir(), 'Library', 'Application Support');
      default:
         return process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
   }
}

function isNonEmptyDir (p) {
   if (!existsSync(p)) return false;
   if (!statSync(p).isDirectory()) return false;
   return readdirSync(p).length > 0;
}

function main () {
   const root = appDataRoot();
   const oldPath = join(root, OLD_ID);
   const newPath = join(root, NEW_ID);

   console.log('Antares2 AppData migration');
   console.log('──────────────────────────');
   console.log(`  Old : ${oldPath}`);
   console.log(`  New : ${newPath}`);
   console.log('');

   if (!existsSync(oldPath)) {
      console.log('Old directory does not exist — nothing to migrate.');
      process.exit(0);
   }

   if (isNonEmptyDir(newPath) && !FORCE) {
      console.error('ERROR: new directory already exists and is non-empty.');
      console.error('       Pass --force to overwrite, or remove it first:');
      console.error(`       rm -rf "${newPath}"`);
      process.exit(1);
   }

   if (DRY) {
      console.log('[dry-run] would copy old → new (recursive).');
      process.exit(0);
   }

   mkdirSync(newPath, { recursive: true });
   cpSync(oldPath, newPath, { recursive: true, force: FORCE });

   console.log('Copied successfully.');
   console.log('');
   console.log('Next steps:');
   console.log('  1. Launch Antares2 — it should read your existing connections/settings.');
   console.log('  2. Once you confirm everything works, you can delete the old directory:');
   console.log(`       ${oldPath.replace(/\\/g, sep)}`);
}

main();
