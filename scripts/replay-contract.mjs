#!/usr/bin/env node
// Phase 4: contract replay harness — the spine of the .NET migration verification.
// Spawns the sidecar binary, replays each fixture in tests/fixtures/contract/,
// deep-equals the response against fixture.expected ignoring known
// non-deterministic fields, and exits 0 iff all `expect: pass` fixtures match.
//
// Plan: docs/superpowers/plans/2026-05-05-net-sidecar-migration.md (Phase 4 §272-345)

// We use spawn/spawnSync (not exec) — no shell, no injection vector. Inputs are all
// constants from package.json scripts; user-supplied args go into argv parsing only.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES_DIR = join(ROOT, 'tests', 'fixtures', 'contract');
const MANIFEST_PATH = join(FIXTURES_DIR, '_baseline-manifest.json');

// Spec §8.1 — these paths in the response (or metadata) are non-deterministic
// across captures, so we strip them before deep-equal. Add new entries any time
// replay flakes on a real-DB capture.
const IGNORE_PATHS = [
   'metadata.elapsed_ms_observed',
   'metadata.captured_at',
   'response.connectionId',
   'response.processId',
   'response.uid',
   'response.token',
   'response.report.duration',
   'response.report.time',
   'response.report.elapsed_ms',
   'response[*].tables[*].rows',
   'response[*].tables[*].size',
   'response[*].size',
   'response[*].rows',
   'response[*].dataLength',
   'response[*].indexLength',
   'response[*].avgRowLength',
   'response[*].relpages',
   'response[*].reltuples',
   'response[*].time',
   'response[*].state'
];

// ---- arg parsing ----------------------------------------------------------

const args = process.argv.slice(2);
const filterArg = args.find(a => a.startsWith('--filter='))?.split('=')[1] ?? null;
// Legacy 'node' / 'both' targets were removed in Phase 18 (Node sidecar deletion).
// 'net' is now the only valid target; the flag is retained for back-compat with
// pnpm replay:contract:net.
const targetArg = args.find(a => a.startsWith('--target='))?.split('=')[1] ?? 'net';
const withTeardown = args.includes('--with-teardown');
const againstRunningApp = args.includes('--against-running-app');
const fixtureOverride = args.find(a => a.startsWith('--fixture-override='))?.split('=')[1] ?? null;

if (targetArg !== 'net') {
   console.error(`✗ invalid --target: ${targetArg} (only 'net' is supported after Phase 18)`);
   process.exit(1);
}

// ---- fixture loading ------------------------------------------------------

if (!existsSync(MANIFEST_PATH)) {
   console.error(`✗ manifest not found: ${MANIFEST_PATH}`);
   process.exit(1);
}
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));

function fixtureNameMatches (name) {
   if (!filterArg) return true;
   const patterns = filterArg.split(',').map(p => p.trim());
   return patterns.some(p => {
      const re = new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
      return re.test(name);
   });
}

function loadFixture (entry) {
   if (fixtureOverride) {
      const data = JSON.parse(readFileSync(fixtureOverride, 'utf8'));
      return { ...entry, data };
   }
   const path = join(FIXTURES_DIR, `${entry.name}.json`);
   if (!existsSync(path)) {
      console.error(`✗ fixture file missing: ${path}`);
      process.exit(1);
   }
   return { ...entry, data: JSON.parse(readFileSync(path, 'utf8')) };
}

const selectedEntries = manifest.fixtures
   .filter(e => fixtureNameMatches(e.name))
   .map(loadFixture);

if (selectedEntries.length === 0) {
   console.error(`✗ no fixtures matched filter: ${filterArg ?? '(none)'}`);
   process.exit(1);
}

// ---- compare ignoring IGNORE_PATHS ----------------------------------------

function isObject (v) {
   return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function buildIgnoreMatchers () {
   return IGNORE_PATHS.map(p => {
      const segments = [];
      const re = /[^.[\]]+|\[\*\]/g;
      let m;
      while ((m = re.exec(p)) !== null) segments.push(m[0]);
      return segments;
   });
}

function pathMatches (matcher, pathSegments) {
   if (matcher.length !== pathSegments.length) return false;
   for (let i = 0; i < matcher.length; i++) {
      const m = matcher[i];
      const s = pathSegments[i];
      if (m === '[*]') {
         if (typeof s !== 'number') return false;
         continue;
      }
      if (m !== String(s)) return false;
   }
   return true;
}

const ignoreMatchers = buildIgnoreMatchers();

function isIgnored (pathSegments) {
   return ignoreMatchers.some(m => pathMatches(m, pathSegments));
}

function diffDeep (actual, expected, pathSegments = []) {
   if (isIgnored(pathSegments)) return [];

   if (Array.isArray(expected)) {
      if (!Array.isArray(actual)) return [{ path: pathSegments.join('.'), reason: `expected array, got ${typeof actual}` }];
      if (actual.length !== expected.length) {
         return [{ path: pathSegments.join('.') || '<root>', reason: `array length differs: actual=${actual.length} expected=${expected.length}` }];
      }
      const diffs = [];
      for (let i = 0; i < expected.length; i++) {
         diffs.push(...diffDeep(actual[i], expected[i], [...pathSegments, i]));
      }
      return diffs;
   }

   if (isObject(expected)) {
      if (!isObject(actual)) return [{ path: pathSegments.join('.'), reason: `expected object, got ${typeof actual}` }];
      const diffs = [];
      const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
      for (const key of keys) {
         diffs.push(...diffDeep(actual[key], expected[key], [...pathSegments, key]));
      }
      return diffs;
   }

   if (actual !== expected) {
      return [{ path: pathSegments.join('.') || '<root>', reason: `actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}` }];
   }
   return [];
}

// ---- sidecar lifecycle ----------------------------------------------------

async function startSidecar () {
   if (againstRunningApp) {
      console.error('✗ --against-running-app is reserved for Phase 17; not implemented yet');
      process.exit(2);
   }

   const binaryName = process.platform === 'win32' ? 'antares-server.exe' : 'antares-server';
   const binary = join(ROOT, 'sidecar-net', binaryName);
   if (!existsSync(binary)) {
      console.error(`✗ sidecar binary not found: ${binary}`);
      console.error('  Run `pnpm sidecar:build:net` first.');
      process.exit(1);
   }

   const child = spawn(binary, [], { stdio: ['ignore', 'pipe', 'pipe'] });
   child.stderr.on('data', () => { /* drain */ });

   return await new Promise((resolveStart, rejectStart) => {
      let buffer = '';
      const timeout = setTimeout(() => {
         try { child.kill('SIGKILL'); } catch { /* ignore */ }
         rejectStart(new Error(`sidecar didn't print READY within 15s. stdout: ${buffer.slice(0, 500)}`));
      }, 15000);

      child.stdout.on('data', (chunk) => {
         buffer += chunk.toString();
         const match = buffer.match(/READY:(\d+):([0-9A-Fa-f]+)/);
         if (match) {
            clearTimeout(timeout);
            const port = Number(match[1]);
            const token = match[2];
            resolveStart({ child, port, token });
         }
      });
      child.on('exit', (code) => {
         clearTimeout(timeout);
         rejectStart(new Error(`sidecar exited early (code ${code}). stdout: ${buffer.slice(0, 500)}`));
      });
   });
}

async function stopSidecar (handle) {
   if (!handle?.child) return;
   try { handle.child.kill('SIGTERM'); } catch { /* ignore */ }
}

// ---- replay one fixture ---------------------------------------------------

async function replayOne (entry, sidecar) {
   const fx = entry.data;
   const url = `http://127.0.0.1:${sidecar.port}${fx.request.route}`;
   const headers = { ...fx.request.headers };

   if ('X-Sidecar-Token' in headers) headers['X-Sidecar-Token'] = sidecar.token;
   if (!('Content-Type' in headers) && fx.request.payload !== undefined) headers['Content-Type'] = 'application/json';

   const init = { method: fx.request.method, headers };
   if (fx.request.payload !== undefined) {
      init.body = JSON.stringify(fx.request.payload);
   }

   let resp, bodyText;
   try {
      resp = await fetch(url, init);
      bodyText = await resp.text();
   } catch (err) {
      return { name: entry.name, ok: false, reason: `fetch threw: ${err.message}` };
   }

   if (resp.status !== fx.response.status) {
      return { name: entry.name, ok: false, reason: `http status mismatch: actual=${resp.status} expected=${fx.response.status}` };
   }

   let actual;
   try {
      actual = bodyText.length === 0 ? null : JSON.parse(bodyText);
   } catch {
      actual = bodyText;
   }

   const expected = fx.expected;
   const diffs = diffDeep(actual, expected);
   if (diffs.length > 0) {
      return { name: entry.name, ok: false, reason: `${diffs.length} diff(s)`, diffs };
   }
   return { name: entry.name, ok: true };
}

// ---- main -----------------------------------------------------------------

async function runOnce (target) {
   let sidecar;
   try {
      sidecar = await startSidecar();
   } catch (err) {
      console.error(`✗ ${err.message}`);
      process.exit(1);
   }

   const counts = { pass: 0, skip: 0, fail: 0 };
   const failures = [];

   try {
      for (const entry of selectedEntries) {
         if (entry.expect === 'skip') {
            counts.skip += 1;
            console.log(`SKIP ${entry.name} (${entry.reason ?? 'no-reason'})`);
            continue;
         }
         if (entry.expect !== 'pass') {
            counts.fail += 1;
            failures.push({ name: entry.name, reason: `unknown expect: ${entry.expect}` });
            console.log(`FAIL ${entry.name} (unknown expect)`);
            continue;
         }
         const result = await replayOne(entry, sidecar);
         if (result.ok) {
            counts.pass += 1;
            console.log(`PASS ${entry.name}`);
         } else {
            counts.fail += 1;
            failures.push(result);
            console.log(`FAIL ${entry.name} — ${result.reason}`);
            if (result.diffs) {
               for (const d of result.diffs.slice(0, 5)) console.log(`     · ${d.path}: ${d.reason}`);
               if (result.diffs.length > 5) console.log(`     · (and ${result.diffs.length - 5} more)`);
            }
         }
      }
   } finally {
      await stopSidecar(sidecar);
   }

   const total = counts.pass + counts.skip + counts.fail;
   console.log(`\n${total} fixtures (target=${target}): ${counts.pass} pass, ${counts.skip} skip, ${counts.fail} fail`);
   return counts.fail === 0 ? 0 : 1;
}

const code = await runOnce(targetArg);
process.exit(code);
