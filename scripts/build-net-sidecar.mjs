#!/usr/bin/env node
// Phase 3: build the .NET sidecar single-file binary for the host RID.
// Output: sidecar-net/antares-server[.exe]
// Hard gate: pnpm sidecar:build:net produces a binary that prints READY:<port>:<token>
// to stdout within 10s when run with --probe-mode.

import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SERVER_PROJ = join(ROOT, 'server', 'AntaresServer.csproj');
const OUT_DIR = join(ROOT, 'sidecar-net');

function detectRid() {
   const platform = process.platform;
   const arch = process.arch;
   if (platform === 'win32' && arch === 'x64') return 'win-x64';
   if (platform === 'win32' && arch === 'arm64') return 'win-arm64';
   if (platform === 'linux' && arch === 'x64') return 'linux-x64';
   if (platform === 'darwin' && arch === 'x64') return 'osx-x64';
   if (platform === 'darwin' && arch === 'arm64') return 'osx-arm64';
   throw new Error(`unsupported platform/arch: ${platform}/${arch}`);
}

const rid = detectRid();
const binaryName = process.platform === 'win32' ? 'antares-server.exe' : 'antares-server';

console.log(`▸ Publishing .NET sidecar for ${rid} ...`);

if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const publishResult = spawnSync('dotnet', [
   'publish', SERVER_PROJ,
   '--configuration', 'Release',
   '--runtime', rid,
   '--self-contained', 'true',
   '/p:PublishSingleFile=true',
   '/p:PublishReadyToRun=true',
   '/p:PublishTrimmed=false',
   '/p:DebugType=embedded',
   '--verbosity', 'minimal'
], { stdio: 'inherit' });

if (publishResult.status !== 0) {
   console.error(`✗ dotnet publish failed (exit ${publishResult.status})`);
   process.exit(1);
}

const publishDir = join(ROOT, 'server', 'bin', 'Release', 'net10.0', rid, 'publish');
const sourceBin = join(publishDir, binaryName);
const targetBin = join(OUT_DIR, binaryName);

if (!existsSync(sourceBin)) {
   console.error(`✗ build output not found: ${sourceBin}`);
   process.exit(1);
}
copyFileSync(sourceBin, targetBin);
console.log(`▸ Copied → sidecar-net/${binaryName}`);

// First run of a single-file self-extracting bundle (IncludeAllContentForSelfExtract)
// unpacks ~290MB of native libs to a temp dir before main() runs; on slower hosts
// (and arm64 first-boot) that cold extract can exceed 10s. 30s leaves margin —
// warm runs still print READY in well under a second.
const PROBE_TIMEOUT_MS = 30000;
console.log(`▸ Probing binary for READY line (timeout ${PROBE_TIMEOUT_MS / 1000}s) ...`);
const child = spawn(targetBin, ['--probe-mode'], { stdio: ['ignore', 'pipe', 'pipe'] });
let probeBuffer = '';
const probeOk = await new Promise((resolveProbe) => {
   const timeout = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
      resolveProbe(false);
   }, PROBE_TIMEOUT_MS);

   child.stdout.on('data', (chunk) => {
      probeBuffer += chunk.toString();
      if (probeBuffer.includes('READY:')) {
         clearTimeout(timeout);
         try { child.kill('SIGKILL'); } catch { /* ignore */ }
         resolveProbe(true);
      }
   });
   // Drain stderr so child doesn't block on a full pipe.
   child.stderr.on('data', () => { /* noop */ });
   child.on('exit', () => {
      clearTimeout(timeout);
      resolveProbe(probeBuffer.includes('READY:'));
   });
   child.on('error', () => {
      clearTimeout(timeout);
      resolveProbe(false);
   });
});

if (!probeOk) {
   console.error('✗ READY line not received within 10s. Probe stdout was:');
   console.error(probeBuffer || '(empty)');
   process.exit(1);
}

console.log(`\n✓ sidecar-net/${binaryName} built + probe-verified`);
