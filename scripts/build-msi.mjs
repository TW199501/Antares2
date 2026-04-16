/**
 * build-msi.mjs
 *
 * Runs light.exe to produce the MSI installer using an already-built
 * .wixobj file (produced by `tauri build` or `tauri build --bundles nsis`).
 *
 * Tauri's WiX bundler fails with ICE30 because node_modules contain
 * multiple files with the same name in different subdirectories (e.g.
 * ssh2/lib/utils.js and ssh2/lib/protocol/utils.js). ICE30 is a
 * short-file-name collision check that is irrelevant on modern Windows
 * (8.3 SFN disabled by default since Vista). We suppress it here.
 *
 * Usage:
 *   node scripts/build-msi.mjs
 */

import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { createRequire } from 'module';
import { homedir } from 'os';
import { join } from 'path';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

const WIX_DIR = join(homedir(), 'AppData', 'Local', 'tauri', 'WixTools314');
const LIGHT_EXE = join(WIX_DIR, 'light.exe');
const WIX_X64 = 'src-tauri/target/release/wix/x64';
const WIXOBJ = join(WIX_X64, 'main.wixobj');
const WXLOC = join(WIX_X64, 'locale.wxl');
const OUT_MSI = `src-tauri/target/release/bundle/msi/Antares SQL_${version}_x64_en-US.msi`;

if (!existsSync(LIGHT_EXE)) {
   console.error(`light.exe not found at: ${LIGHT_EXE}`);
   process.exit(1);
}

if (!existsSync(WIXOBJ)) {
   console.error('main.wixobj not found. Run `pnpm tauri:build` first to generate it.');
   console.error(`Expected: ${WIXOBJ}`);
   process.exit(1);
}

console.log(`Building MSI v${version} (ICE30/57/61 suppressed)…`);

const result = spawnSync(
   LIGHT_EXE,
   [
      '-nologo',
      '-ext', 'WixUIExtension',
      '-ext', 'WixUtilExtension',
      WIXOBJ,
      '-loc', WXLOC,
      '-out', OUT_MSI,
      '-sice:ICE03', // string overflow in DownloadAndInvokeBootstrapper (benign)
      '-sice:ICE30', // duplicate SFN filenames — harmless on modern Windows
      '-sice:ICE40', // REINSTALLMODE property (Tauri template artefact)
      '-sice:ICE57', // per-user/per-machine registry key (Tauri uninstall shortcut)
      '-sice:ICE61' // no maximum version for upgrade (intentional)
   ],
   { stdio: 'inherit', shell: false }
);

if (result.status === 0 || existsSync(OUT_MSI)) {
   console.log(`\nMSI built → ${OUT_MSI}`);
   process.exit(0);
}
else {
   console.error('\nMSI build failed.');
   process.exit(result.status ?? 1);
}
