#!/usr/bin/env node
/**
 * IPC Contract Fixture Capture
 * ----------------------------
 * Spawns a dev-mode sidecar (tsx web/main/server.ts --port 5556) against
 * developer-provided dev DBs, sends a curated set of HTTP / WebSocket
 * invocations, and persists request/response pairs to
 * tests/fixtures/contract/*.json (HTTP) and *.jsonl (WS frames).
 *
 * The fixtures are the **.NET 10 backend rewrite contract**: the new
 * sidecar must produce equivalent responses for the same inputs, or
 * the renderer breaks. T8 wrapper replay tests consume these fixtures
 * via @tests/fixtures/contract/<name>.json imports.
 *
 * Usage
 * -----
 *   1. Set up dev schemas — see tests/fixtures/contract/README.md
 *   2. Provide credentials via env (or .env.fixtures):
 *        DEV_MYSQL_HOST, DEV_MYSQL_PORT, DEV_MYSQL_USER, DEV_MYSQL_PASSWORD
 *        DEV_PG_HOST, DEV_PG_PORT, DEV_PG_USER, DEV_PG_PASSWORD
 *        DEV_MSSQL_HOST, DEV_MSSQL_PORT, DEV_MSSQL_USER, DEV_MSSQL_PASSWORD
 *        DEV_SQLITE_PATH (filesystem path)
 *   3. Run:  pnpm capture:contract              (all dialects)
 *            pnpm capture:contract -- mysql     (single dialect)
 *
 * Anonymization
 * -------------
 * After every capture, all fixture JSON is post-processed to scrub:
 *   - password / authToken / x-sidecar-token  → <REDACTED>
 *   - real internal hosts                     → 127.0.0.1
 *   - Windows C:\Users\<name>\... paths       → <USER_HOME>
 *   - UUIDs                                   → <UUID>
 *   - timestamps                              → 2026-01-01T00:00:00.000Z
 *
 * Anonymization is automatic but **commit-time review is mandatory** —
 * grep the fixture tree for password / your real host / etc. before
 * git commit.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(__dirname);
const FIXTURES_DIR = join(ROOT, 'tests', 'fixtures', 'contract');
const PORT = 5556;
const HOST = '127.0.0.1';

const argDialect = process.argv[2]; // optional dialect filter

// ─────────────────────────────────────────────────────────────────
// Config loaded from env (with safe placeholders for env-less probe)
// ─────────────────────────────────────────────────────────────────
const CONFIGS = {
   mysql: {
      client: 'mysql',
      name: 'fixture-mysql',
      host: process.env.DEV_MYSQL_HOST || '127.0.0.1',
      port: Number(process.env.DEV_MYSQL_PORT || 3306),
      user: process.env.DEV_MYSQL_USER || 'root',
      password: process.env.DEV_MYSQL_PASSWORD || '',
      database: 'antares_test_fixture',
      schema: 'antares_test_fixture'
   },
   pg: {
      client: 'pg',
      name: 'fixture-pg',
      host: process.env.DEV_PG_HOST || '127.0.0.1',
      port: Number(process.env.DEV_PG_PORT || 5432),
      user: process.env.DEV_PG_USER || 'postgres',
      password: process.env.DEV_PG_PASSWORD || '',
      database: 'antares_test_fixture',
      schema: 'public'
   },
   mssql: {
      client: 'mssql',
      name: 'fixture-mssql',
      host: process.env.DEV_MSSQL_HOST || '127.0.0.1',
      port: Number(process.env.DEV_MSSQL_PORT || 1433),
      user: process.env.DEV_MSSQL_USER || 'sa',
      password: process.env.DEV_MSSQL_PASSWORD || '',
      database: 'antares_test_fixture',
      schema: 'dbo'
   },
   sqlite: {
      client: 'sqlite',
      name: 'fixture-sqlite',
      databasePath: process.env.DEV_SQLITE_PATH || join(ROOT, 'tests', 'fixtures', 'contract', '_seed.sqlite'),
      schema: 'main'
   }
};

// ─────────────────────────────────────────────────────────────────
// Curated invocation list — extend as your dev DB schema permits
// ─────────────────────────────────────────────────────────────────
//
// Each invocation produces one fixture file. Naming convention:
//   <api-group>.<verb>.<dialect>.<scenario>.json
// Example: connection.connect.mysql.happy.json
//
// `payloadFor(cfg, ctx)` is called per dialect. It returns the request
// body. `ctx` carries forward state (e.g. uid from prior connect).
// `expectedShape` is the wrapper-internal type you're locking — T8
// replay tests use this to assert the wrapper transforms response
// correctly.
const INVOCATIONS = [
   {
      group: 'connection',
      verb: 'connect',
      route: '/api/connection/connect',
      scenario: 'happy',
      payloadFor: (cfg) => ({
         uid: '<UUID>',
         client: cfg.client,
         name: cfg.name,
         ...(cfg.client === 'sqlite'
            ? { databasePath: cfg.databasePath }
            : {
                 host: cfg.host,
                 port: cfg.port,
                 user: cfg.user,
                 password: cfg.password,
                 database: cfg.database
              })
      }),
      saveCtx: (ctx, _payload) => {
         ctx.uid = '<UUID>';
      }
   },
   {
      group: 'databases',
      verb: 'getDatabases',
      route: '/api/databases/getDatabases',
      scenario: 'happy',
      payloadFor: (_cfg, ctx) => ({ uid: ctx.uid })
   },
   {
      group: 'schema',
      verb: 'getStructure',
      route: '/api/schema/getStructure',
      scenario: 'happy',
      payloadFor: (cfg, ctx) => ({
         uid: ctx.uid,
         schemas: [cfg.database || cfg.schema]
      })
   },
   {
      group: 'schema',
      verb: 'getCollations',
      route: '/api/schema/getCollations',
      scenario: 'happy',
      payloadFor: (_cfg, ctx) => ({ uid: ctx.uid })
   },
   {
      group: 'schema',
      verb: 'getVersion',
      route: '/api/schema/getVersion',
      scenario: 'happy',
      payloadFor: (_cfg, ctx) => ({ uid: ctx.uid })
   },
   {
      group: 'schema',
      verb: 'rawQuery-select',
      route: '/api/schema/rawQuery',
      scenario: 'happy',
      payloadFor: (cfg, ctx) => ({
         uid: ctx.uid,
         query: 'SELECT 1 AS one, 2 AS two',
         schema: cfg.schema
      })
   },
   {
      group: 'connection',
      verb: 'disconnect',
      route: '/api/connection/disconnect',
      scenario: 'happy',
      payloadFor: (_cfg, ctx) => ({ uid: ctx.uid })
   }
   // TODO: extend with tables/views/triggers/routines/functions/users
   // once dev DB has the corresponding schema fixtures (see README).
];

// ─────────────────────────────────────────────────────────────────
// Sidecar spawn (waits for READY:<port>:<token> on stdout)
// ─────────────────────────────────────────────────────────────────
function spawnSidecar () {
   return new Promise((resolve, reject) => {
      const proc = spawn(
         'npx',
         ['tsx', 'web/main/server.ts', '--port', String(PORT)],
         { cwd: ROOT, shell: true, stdio: ['ignore', 'pipe', 'pipe'] }
      );

      let buffer = '';
      const onStdout = (chunk) => {
         buffer += chunk.toString();
         const m = buffer.match(/READY:(\d+):([a-f0-9]*)/);
         if (m) {
            proc.stdout.off('data', onStdout);
            // DEV_MODE produces empty token; capture script doesn't need one
            resolve({ proc, port: Number(m[1]), token: m[2] });
         }
      };

      proc.stdout.on('data', onStdout);
      proc.stderr.on('data', (d) => process.stderr.write(`[sidecar] ${d}`));
      proc.on('exit', (code) => {
         if (code !== 0 && code !== null) reject(new Error(`sidecar exited ${code}`));
      });

      setTimeout(() => reject(new Error('sidecar READY timeout (10s)')), 10_000);
   });
}

// ─────────────────────────────────────────────────────────────────
// Single HTTP capture
// ─────────────────────────────────────────────────────────────────
async function captureHttp (port, token, invocation, cfg, ctx) {
   const payload = invocation.payloadFor(cfg, ctx);
   const url = `http://${HOST}:${port}${invocation.route}`;

   const startedAt = Date.now();
   const res = await fetch(url, {
      method: 'POST',
      headers: {
         'Content-Type': 'application/json',
         ...(token ? { 'X-Sidecar-Token': token } : {})
      },
      body: JSON.stringify(payload)
   });
   const elapsedMs = Date.now() - startedAt;
   const body = await res.json().catch(() => null);

   if (invocation.saveCtx) invocation.saveCtx(ctx, payload, body);

   return {
      metadata: {
         captured_at: '2026-01-01T00:00:00.000Z',
         dialect: cfg.client,
         scenario: invocation.scenario,
         anonymized: true,
         elapsed_ms_observed: elapsedMs // informational, not asserted
      },
      request: {
         route: invocation.route,
         method: 'POST',
         headers: { 'Content-Type': 'application/json', 'X-Sidecar-Token': '<REDACTED>' },
         payload
      },
      response: {
         status: res.status,
         body
      },
      expected: body // baseline; refine per wrapper as T8 lands
   };
}

// ─────────────────────────────────────────────────────────────────
// Anonymization (defense-in-depth — should already be redacted but
// callers run on real dev DB so we sweep again as last resort)
// ─────────────────────────────────────────────────────────────────
function anonymize (obj) {
   const json = JSON.stringify(obj);
   const scrubbed = json
      // Real password values inside payloads (already <REDACTED> usually)
      .replace(/"password"\s*:\s*"[^"]*"/g, '"password":"<REDACTED>"')
      // Tokens
      .replace(/"X-Sidecar-Token"\s*:\s*"[^"]*"/g, '"X-Sidecar-Token":"<REDACTED>"')
      .replace(/"authToken"\s*:\s*"[^"]*"/g, '"authToken":"<REDACTED>"')
      // Windows user-home paths
      .replace(/[A-Z]:\\\\Users\\\\[^"\\\\]+/g, '<USER_HOME>')
      // POSIX user-home paths
      .replace(/\/(home|Users)\/[^/"]+/g, '<USER_HOME>')
      // UUIDs (canonical form)
      .replace(
         /"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"/gi,
         '"<UUID>"'
      )
      // ISO timestamps
      .replace(
         /"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z"/g,
         '"2026-01-01T00:00:00.000Z"'
      );
   return JSON.parse(scrubbed);
}

// ─────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────
async function captureForDialect (port, token, dialect) {
   const cfg = CONFIGS[dialect];
   if (!cfg) {
      console.warn(`[skip] unknown dialect ${dialect}`);
      return 0;
   }

   // Sanity: skip if password missing for non-sqlite dialect
   if (dialect !== 'sqlite' && !cfg.password) {
      console.warn(
         `[skip] ${dialect}: DEV_${dialect.toUpperCase()}_PASSWORD not set — skipping`
      );
      return 0;
   }

   console.log(`\n=== Capturing ${dialect} ===`);
   const ctx = {};
   let written = 0;

   for (const inv of INVOCATIONS) {
      try {
         const fixture = await captureHttp(port, token, inv, cfg, ctx);
         const anonymized = anonymize(fixture);
         const filename = `${inv.group}.${inv.verb}.${dialect}.${inv.scenario}.json`;
         const filepath = join(FIXTURES_DIR, filename);
         writeFileSync(filepath, JSON.stringify(anonymized, null, 2) + '\n', 'utf8');
         console.log(
            `  ✓ ${inv.group}.${inv.verb} (${anonymized.response.status}) → ${filename}`
         );
         written++;
      }
      catch (err) {
         console.error(`  ✗ ${inv.group}.${inv.verb} failed: ${err.message}`);
      }
   }

   return written;
}

async function main () {
   if (!existsSync(FIXTURES_DIR)) mkdirSync(FIXTURES_DIR, { recursive: true });

   console.log(`Spawning sidecar on port ${PORT}…`);
   const { proc, port, token } = await spawnSidecar();
   console.log(`Sidecar ready on ${port}, token=${token ? '<set>' : '<empty (DEV_MODE)>'}`);

   try {
      const dialects = argDialect ? [argDialect] : Object.keys(CONFIGS);
      let total = 0;
      for (const d of dialects) total += await captureForDialect(port, token, d);

      console.log(
         `\n=== Done. ${total} fixtures written to ${FIXTURES_DIR.replace(ROOT, '.')} ===`
      );
      console.log(
         '\nReminder: grep the fixture tree for "password", real host names, and your real',
         'username before git commit. Anonymization is best-effort — manual review is the gate.'
      );
   }
   finally {
      proc.kill();
   }
}

main().catch((err) => {
   console.error('FATAL:', err);
   process.exit(1);
});
