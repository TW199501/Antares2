#!/usr/bin/env node
// Phase 0 hard gate: verify 4 dev DBs (mysql/pg/mssql/sqlite) reachable per .env.test.
// Plan: docs/superpowers/plans/2026-05-05-net-sidecar-migration.md (Phase 0 §93-124).
// Run on the user's dev machine only — CI has no DB engines, so preflight-net.yml
// runs preflight:net but NOT preflight:dbs.

import { existsSync, readFileSync } from 'node:fs';
import { connect } from 'node:net';
import { resolve } from 'node:path';

const ENV_PATH = resolve(process.cwd(), '.env.test');
if (!existsSync(ENV_PATH)) {
  console.error(`✗ .env.test not found at ${ENV_PATH}`);
  console.error('  Copy .env.test.example to .env.test and fill in your local DB credentials.');
  process.exit(1);
}

const env = {};
for (const rawLine of readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) continue;
  const eq = line.indexOf('=');
  if (eq < 0) continue;
  env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
}

let failures = 0;

function tcpPing(host, port, timeoutMs = 3000) {
  return new Promise((resolveFn) => {
    const socket = connect({ host, port, timeout: timeoutMs });
    let settled = false;
    const finalize = (success) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolveFn(success);
    };
    socket.once('connect', () => finalize(true));
    socket.once('error', () => finalize(false));
    socket.once('timeout', () => finalize(false));
  });
}

async function probe(name, host, port, runQuery) {
  if (!host || !port) {
    console.log(`⊘ ${name}: skipped (no host/port in .env.test)`);
    return;
  }
  const portNum = Number(port);
  const tcp = await tcpPing(host, portNum);
  if (!tcp) {
    console.error(`✗ ${name}: TCP ${host}:${port} unreachable`);
    failures += 1;
    return;
  }
  try {
    await runQuery();
    console.log(`✓ ${name}: ${host}:${port} reachable + SELECT 1 ok`);
  } catch (err) {
    console.error(`✗ ${name}: connect/query failed: ${err.message}`);
    failures += 1;
  }
}

await probe('mysql', env.DEV_MYSQL_HOST, env.DEV_MYSQL_PORT, async () => {
  const mysql = await import('mysql2/promise');
  const conn = await mysql.createConnection({
    host: env.DEV_MYSQL_HOST,
    port: Number(env.DEV_MYSQL_PORT),
    user: env.DEV_MYSQL_USER,
    password: env.DEV_MYSQL_PASSWORD,
    database: env.DEV_MYSQL_DATABASE || undefined,
    connectTimeout: 5000,
  });
  await conn.query('SELECT 1');
  await conn.end();
});

await probe('postgres', env.DEV_PG_HOST, env.DEV_PG_PORT, async () => {
  const pgMod = await import('pg');
  const pg = pgMod.default ?? pgMod;
  const client = new pg.Client({
    host: env.DEV_PG_HOST,
    port: Number(env.DEV_PG_PORT),
    user: env.DEV_PG_USER,
    password: env.DEV_PG_PASSWORD,
    database: env.DEV_PG_DATABASE || 'postgres',
    connectionTimeoutMillis: 5000,
  });
  await client.connect();
  await client.query('SELECT 1');
  await client.end();
});

await probe('mssql', env.DEV_MSSQL_HOST, env.DEV_MSSQL_PORT, async () => {
  const mssqlMod = await import('mssql');
  const mssql = mssqlMod.default ?? mssqlMod;
  const pool = await mssql.connect({
    server: env.DEV_MSSQL_HOST,
    port: Number(env.DEV_MSSQL_PORT),
    user: env.DEV_MSSQL_USER,
    password: env.DEV_MSSQL_PASSWORD,
    database: env.DEV_MSSQL_DATABASE || 'master',
    options: { trustServerCertificate: true, encrypt: false },
    connectionTimeout: 5000,
  });
  await pool.request().query('SELECT 1');
  await pool.close();
});

const sqlitePath = env.DEV_SQLITE_PATH;
if (!sqlitePath) {
  console.log('⊘ sqlite: skipped (no DEV_SQLITE_PATH in .env.test)');
} else {
  try {
    const Database = (await import('better-sqlite3')).default;
    const db = new Database(sqlitePath, { fileMustExist: false });
    db.prepare('SELECT 1').get();
    db.close();
    console.log(`✓ sqlite: ${sqlitePath} openable + SELECT 1 ok`);
  } catch (err) {
    console.error(`✗ sqlite: ${err.message}`);
    failures += 1;
  }
}

if (failures) {
  console.error(`\n✗ ${failures} DB probe(s) failed`);
  process.exit(1);
}
console.log('\n✓ preflight:dbs passed');
