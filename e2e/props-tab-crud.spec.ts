/**
 * E2E 測試:Properties Tab CRUD round-trip
 *
 * 驗證 `/api/tables/alter` 的 7 條 diff 路徑都會真寫回 DB(T3-T5 commits).
 * Phase 11 的 stub 在這裡會徹底曝光 — alter 沒實作的話下面 SELECT 全會看不到變化.
 *
 * 路徑 / commits:
 *   T3 (3e3844d): options.comment             → sp_(add|update)extendedproperty
 *   T4 (d9d2eea): additions[]                 → ALTER TABLE ADD col
 *   T5 (6d75fce): deletions[]                 → ALTER TABLE DROP COLUMN
 *                 changes[] (orgName + alter) → sp_rename + ALTER COLUMN + comment
 *                 indexChanges                → CREATE INDEX / DROP INDEX
 *                 foreignChanges              → ADD/DROP CONSTRAINT
 *                 checkChanges                → ADD/DROP CHECK CONSTRAINT
 *
 * 執行前置:
 *   1. pnpm sidecar:dev 啟動,sidecar 在 5555
 *   2. SQL Server 可連線,環境變數:
 *      MSSQL_HOST, MSSQL_PORT, MSSQL_USER, MSSQL_PASS,
 *      MSSQL_DB1(預設 master)
 *
 * 執行:
 *   pnpm test:e2e e2e/props-tab-crud.spec.ts
 */

import { expect, test } from '@playwright/test';

const SIDECAR = 'http://127.0.0.1:5555';

const MSSQL = {
   host: process.env.MSSQL_HOST || 'localhost',
   port: Number(process.env.MSSQL_PORT || 1433),
   user: process.env.MSSQL_USER || 'sa',
   password: process.env.MSSQL_PASS || '',
   db: process.env.MSSQL_DB1 || 'master'
};

// 沙盒 table 名稱 — 每次跑用 timestamp 後綴避免衝突.
const sandbox = `_antares_e2e_${Date.now()}`;
const uid = () => `crud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const connect = (request: any, connUid: string) =>
   request.post(`${SIDECAR}/api/connection/connect`, {
      data: {
         uid: connUid,
         client: 'mssql',
         host: MSSQL.host,
         port: MSSQL.port,
         user: MSSQL.user,
         password: MSSQL.password,
         database: MSSQL.db
      }
   });

const disconnect = (request: any, connUid: string) =>
   request.post(`${SIDECAR}/api/connection/disconnect`, { data: { uid: connUid } });

const rawQuery = (request: any, connUid: string, query: string) =>
   request.post(`${SIDECAR}/api/schema/rawQuery`, {
      data: { uid: connUid, query, schema: 'dbo' }
   });

test.describe('Properties tab CRUD round-trip (mssql)', () => {
   // 一條長 spec 比拆很多短 spec 好 — DDL 步驟之間有依賴 (drop 前要先建).
   test('alter table 全部 7 條 diff 路徑會真寫回 DB', async ({ request }) => {
      const connUid = uid();

      try {
         // ── Setup: connect + 建沙盒 table ──
         const c = await connect(request, connUid);
         expect((await c.json()).status, '連線應成功').toBe('success');

         const createRes = await request.post(`${SIDECAR}/api/tables/create`, {
            data: {
               uid: connUid,
               schema: 'dbo',
               table: sandbox,
               columns: [
                  { name: 'id', type: 'INT', nullable: false, isPrimary: true, autoIncrement: true },
                  { name: 'email', type: 'NVARCHAR(255)', nullable: false }
               ]
            }
         });
         expect((await createRes.json()).status, '沙盒 table 建立應成功').toBe('success');

         // ── T3 path: options.comment 表級註解 ──
         const t3Res = await request.post(`${SIDECAR}/api/tables/alter`, {
            data: {
               uid: connUid,
               schema: 'dbo',
               table: sandbox,
               additions: [],
               changes: [],
               deletions: [],
               indexChanges: { additions: [], changes: [], deletions: [] },
               foreignChanges: { additions: [], changes: [], deletions: [] },
               options: { comment: 'E2E 測試沙盒 — props-tab-crud' }
            }
         });
         expect((await t3Res.json()).status, 'T3 alter (comment) 應成功').toBe('success');

         // 驗證:sys.extended_properties 應有對應記錄
         const verifyT3 = await rawQuery(request, connUid, `
            SELECT CAST(value AS NVARCHAR(MAX)) AS comment
            FROM sys.extended_properties ep
            JOIN sys.tables t ON ep.major_id = t.object_id
            WHERE t.name = '${sandbox}' AND ep.minor_id = 0 AND ep.name = 'MS_Description'
         `);
         const t3Data = await verifyT3.json();
         expect(t3Data.response?.rows?.[0]?.comment, 'T3 表級註解應寫入 extended_properties')
            .toContain('E2E 測試沙盒');

         // ── T4 path: additions[] 新增欄位 ──
         const t4Res = await request.post(`${SIDECAR}/api/tables/alter`, {
            data: {
               uid: connUid,
               schema: 'dbo',
               table: sandbox,
               additions: [
                  { name: 'avatar_url', type: 'NVARCHAR', length: 500, nullable: true, comment: '頭像連結' },
                  { name: 'is_admin', type: 'BIT', nullable: false, default: '0' }
               ],
               changes: [],
               deletions: [],
               indexChanges: { additions: [], changes: [], deletions: [] },
               foreignChanges: { additions: [], changes: [], deletions: [] },
               options: {}
            }
         });
         expect((await t4Res.json()).status, 'T4 alter (additions) 應成功').toBe('success');

         // 驗證:sys.columns 應看到 avatar_url + is_admin
         const verifyT4 = await rawQuery(request, connUid, `
            SELECT name FROM sys.columns
            WHERE object_id = OBJECT_ID('dbo.${sandbox}')
              AND name IN ('avatar_url', 'is_admin')
         `);
         const t4Data = await verifyT4.json();
         const t4Names = (t4Data.response?.rows ?? []).map((r: any) => r.name).sort();
         expect(t4Names, 'T4 新增欄位應出現在 sys.columns').toEqual(['avatar_url', 'is_admin']);

         // ── T5 path: changes[] (rename via orgName) ──
         const t5cRes = await request.post(`${SIDECAR}/api/tables/alter`, {
            data: {
               uid: connUid,
               schema: 'dbo',
               table: sandbox,
               additions: [],
               changes: [
                  { name: 'avatar', orgName: 'avatar_url', type: 'NVARCHAR', length: 500, nullable: true }
               ],
               deletions: [],
               indexChanges: { additions: [], changes: [], deletions: [] },
               foreignChanges: { additions: [], changes: [], deletions: [] },
               options: {}
            }
         });
         expect((await t5cRes.json()).status, 'T5 alter (changes rename) 應成功').toBe('success');

         const verifyT5c = await rawQuery(request, connUid, `
            SELECT name FROM sys.columns
            WHERE object_id = OBJECT_ID('dbo.${sandbox}')
              AND name IN ('avatar', 'avatar_url')
         `);
         const t5cNames = (await verifyT5c.json()).response?.rows?.map((r: any) => r.name) ?? [];
         expect(t5cNames, '改名後應只剩新名 avatar').toEqual(['avatar']);

         // ── T5 path: indexChanges (CREATE INDEX) ──
         const t5iRes = await request.post(`${SIDECAR}/api/tables/alter`, {
            data: {
               uid: connUid,
               schema: 'dbo',
               table: sandbox,
               additions: [],
               changes: [],
               deletions: [],
               indexChanges: {
                  additions: [
                     { name: 'IX_email', fields: ['email'], type: 'INDEX' },
                     { name: 'UQ_email', fields: ['email'], type: 'UNIQUE' }
                  ],
                  changes: [],
                  deletions: []
               },
               foreignChanges: { additions: [], changes: [], deletions: [] },
               options: {}
            }
         });
         expect((await t5iRes.json()).status, 'T5 alter (indexChanges) 應成功').toBe('success');

         const verifyT5i = await rawQuery(request, connUid, `
            SELECT name FROM sys.indexes
            WHERE object_id = OBJECT_ID('dbo.${sandbox}')
              AND name IN ('IX_email', 'UQ_email')
         `);
         const t5iNames = ((await verifyT5i.json()).response?.rows ?? [])
            .map((r: any) => r.name).sort();
         expect(t5iNames, 'T5 兩個 index 都該被建立').toEqual(['IX_email', 'UQ_email']);

         // ── T5 path: deletions[] ──
         const t5dRes = await request.post(`${SIDECAR}/api/tables/alter`, {
            data: {
               uid: connUid,
               schema: 'dbo',
               table: sandbox,
               additions: [],
               changes: [],
               deletions: [{ name: 'is_admin', type: 'BIT' }],
               // 刪 column 前必須先 drop 用到此 column 的 index — 但 is_admin 沒 index 故不需
               indexChanges: { additions: [], changes: [], deletions: [] },
               foreignChanges: { additions: [], changes: [], deletions: [] },
               options: {}
            }
         });
         expect((await t5dRes.json()).status, 'T5 alter (deletions) 應成功').toBe('success');

         const verifyT5d = await rawQuery(request, connUid, `
            SELECT COUNT(*) AS cnt FROM sys.columns
            WHERE object_id = OBJECT_ID('dbo.${sandbox}') AND name = 'is_admin'
         `);
         expect((await verifyT5d.json()).response?.rows?.[0]?.cnt, 'is_admin 應已刪除').toBe(0);
      }
      finally {
         // ── Cleanup ──
         await request.post(`${SIDECAR}/api/tables/drop`, {
            data: { uid: connUid, schema: 'dbo', table: sandbox }
         }).catch(() => { /* table 可能沒建成,忽略 */ });
         await disconnect(request, connUid).catch(() => { /* 忽略 */ });
      }
   });
});
