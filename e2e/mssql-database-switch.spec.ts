/**
 * E2E 測試：MSSQL 切換資料庫的競態條件
 *
 * 問題背景：
 *   使用者從 MASTER 切換到 ADMINNET_LOG 時出現
 *   "No active connection for uid ..." 錯誤（已發生 100+ 次）。
 *
 * 根本原因：
 *   1. switchConnection() 呼叫 disconnect() 再 connectWorkspace(mode:'switch')
 *   2. mode:'switch' 立即把 connectionStatus 設為 'connected'（連線未就緒）
 *   3. 監聽 connectionStatus 的元件立刻發出 API 請求 → sidecar 查無此連線
 *   4. noConnectionHandler 看到 'connected' 狀態 → 再次觸發 connectWorkspace
 *   5. 多個 connectWorkspace 並行執行 → 連線互相覆蓋 + pool 洩漏
 *
 * 執行前置條件：
 *   1. pnpm sidecar:dev（或 pnpm vite:dev）已啟動，sidecar 在 port 5555
 *   2. SQL Server 可連線，設定環境變數：
 *      MSSQL_HOST, MSSQL_PORT, MSSQL_USER, MSSQL_PASS,
 *      MSSQL_DB1（預設 master）, MSSQL_DB2（預設 ADMINNET_LOG）
 *
 * 執行指令：
 *   pnpm test:e2e e2e/mssql-database-switch.spec.ts
 */

import { expect, test } from '@playwright/test';

const SIDECAR = 'http://127.0.0.1:5555';

const MSSQL = {
   host: process.env.MSSQL_HOST || 'localhost',
   port: Number(process.env.MSSQL_PORT || 1433),
   user: process.env.MSSQL_USER || 'sa',
   password: process.env.MSSQL_PASS || '',
   db1: process.env.MSSQL_DB1 || 'master',
   db2: process.env.MSSQL_DB2 || 'ADMINNET_LOG'
};

const uid = () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const connect = (request: any, connUid: string, database: string) =>
   request.post(`${SIDECAR}/api/connection/connect`, {
      data: {
         uid: connUid,
         client: 'mssql',
         host: MSSQL.host,
         port: MSSQL.port,
         user: MSSQL.user,
         password: MSSQL.password,
         database
      }
   });

const disconnect = (request: any, connUid: string) =>
   request.post(`${SIDECAR}/api/connection/disconnect`, {
      data: { uid: connUid }
   });

const rawQuery = (request: any, connUid: string, query: string) =>
   request.post(`${SIDECAR}/api/schema/rawQuery`, {
      data: { uid: connUid, query, schema: 'dbo' }
   });

// ──────────────────────────────────────────────────────────────────
// Test 1：切換資料庫後連線必須存活
// ──────────────────────────────────────────────────────────────────
test('切換資料庫後可正常查詢，不出現 "No active connection"', async ({ request }) => {
   const connUid = uid();

   // ── Step 1: 連線到 db1（master）──
   const connectRes = await connect(request, connUid, MSSQL.db1);
   const connectData = await connectRes.json();
   expect(connectData.status, `初始連線 ${MSSQL.db1} 應成功`).toBe('success');

   // ── Step 2: 確認連線在 sidecar 存在 ──
   const checkRes1 = await request.post(`${SIDECAR}/api/connection/check`, {
      data: { uid: connUid }
   });
   const checkData1 = await checkRes1.json();
   expect(checkData1.response, '連線應存在').toBe(true);

   // ── Step 3: 斷線（模擬 switchConnection 的第一步）──
   await disconnect(request, connUid);

   // ── Step 4: 重新連線到 db2（ADMINNET_LOG）──
   const reconnectRes = await connect(request, connUid, MSSQL.db2);
   const reconnectData = await reconnectRes.json();
   expect(reconnectData.status, `切換到 ${MSSQL.db2} 應成功`).toBe('success');

   // ── Step 5: 切換後執行查詢 ──
   // 這是關鍵驗收：切換後查詢不應出現 "No active connection"
   const queryRes = await rawQuery(request, connUid, 'SELECT DB_NAME() AS db_name');
   const queryData = await queryRes.json();

   expect(
      queryData.status,
      `切換後查詢不應出現 "No active connection"（實際回應：${JSON.stringify(queryData)}）`
   ).toBe('success');
   expect(
      String(queryData.response),
      '查詢結果不應包含 "No active connection"'
   ).not.toContain('No active connection');

   // ── Cleanup ──
   await disconnect(request, connUid);
});

// ──────────────────────────────────────────────────────────────────
// Test 2：斷線空窗期發出的並行請求不應讓 sidecar 崩潰
//          （模擬 noConnectionHandler 競態）
// ──────────────────────────────────────────────────────────────────
test('斷線空窗期的並行請求不會讓 sidecar 崩潰', async ({ request }) => {
   const connUid = uid();

   // 連線到 db1
   const c = await connect(request, connUid, MSSQL.db1);
   expect((await c.json()).status).toBe('success');

   // 模擬競態：斷線 + 立刻發出 3 個並行查詢 + 重新連線
   // （這就是 noConnectionHandler 觸發 connectWorkspace 的場景）
   const [, raceQ1, raceQ2, raceQ3, reconnectResult] = await Promise.all([
      disconnect(request, connUid),
      rawQuery(request, connUid, 'SELECT 1 AS n').then(r => r.json()),
      rawQuery(request, connUid, 'SELECT 2 AS n').then(r => r.json()),
      rawQuery(request, connUid, 'SELECT 3 AS n').then(r => r.json()),
      connect(request, connUid, MSSQL.db2).then(r => r.json())
   ]);

   // 空窗期的查詢預期失敗（這是正常的），但不應讓 sidecar 整個壞掉
   // 驗收：sidecar 應仍可回應（status 必須是 'error' 或 'success'，不是網路錯誤）
   for (const raceData of [raceQ1, raceQ2, raceQ3]) {
      expect(
         ['success', 'error'],
         `空窗期查詢應回傳 success 或 error，而非網路錯誤（實際：${JSON.stringify(raceData)}）`
      ).toContain(raceData.status);
   }

   // 關鍵：重新連線應成功
   expect(reconnectResult.status, `重連到 ${MSSQL.db2} 應成功`).toBe('success');

   // 重連後查詢應可正常執行
   const afterRes = await rawQuery(request, connUid, 'SELECT 1 AS alive');
   const afterData = await afterRes.json();
   expect(afterData.status, '重連後查詢應成功').toBe('success');

   await disconnect(request, connUid);
});

// ──────────────────────────────────────────────────────────────────
// Test 3：快速連續切換 5 次不應累積孤兒 pool（不 OOM / 不超過連線數）
// ──────────────────────────────────────────────────────────────────
test('快速連續切換資料庫 5 次後連線仍穩定', async ({ request }) => {
   const connUid = uid();

   await connect(request, connUid, MSSQL.db1);

   const databases = [MSSQL.db2, MSSQL.db1, MSSQL.db2, MSSQL.db1, MSSQL.db2];

   for (const [i, db] of databases.entries()) {
      // ── Step: 斷線 ──
      await disconnect(request, connUid);

      // ── Step: 重連到目標資料庫 ──
      const res = await connect(request, connUid, db);
      const data = await res.json();
      expect(data.status, `第 ${i + 1} 次切換到 ${db} 應成功`).toBe('success');
   }

   // 最終資料庫應是 db2
   const finalQuery = await rawQuery(request, connUid, 'SELECT DB_NAME() AS db_name');
   const finalData = await finalQuery.json();

   expect(finalData.status, '最終查詢應成功').toBe('success');
   // DB_NAME() 回傳當前連線的資料庫，應為最後切換的目標
   const actualDb = finalData.response?.rows?.[0]?.db_name;
   expect(
      actualDb,
      `最終資料庫應為 ${MSSQL.db2}（實際：${actualDb}）`
   ).toBe(MSSQL.db2);

   await disconnect(request, connUid);
});

// ──────────────────────────────────────────────────────────────────
// Test 4：同一個 UID 多個並行 connect() 不應造成 pool 洩漏
//          （模擬 noConnectionHandler 多次觸發 connectWorkspace）
// ──────────────────────────────────────────────────────────────────
test('並行 connect 請求不會造成 pool 洩漏或 sidecar 崩潰', async ({ request }) => {
   const connUid = uid();

   // 斷線後立刻並行發出 3 個 connect 請求（模擬多次 connectWorkspace）
   const [c1, c2, c3] = await Promise.all([
      connect(request, connUid, MSSQL.db1).then(r => r.json()),
      connect(request, connUid, MSSQL.db1).then(r => r.json()),
      connect(request, connUid, MSSQL.db1).then(r => r.json())
   ]);

   // 至少有一個應成功
   const results = [c1, c2, c3];
   const successCount = results.filter(r => r.status === 'success').length;
   expect(successCount, '至少一個並行 connect 應成功').toBeGreaterThanOrEqual(1);

   // 連線後查詢應可正常執行
   const qRes = await rawQuery(request, connUid, 'SELECT 1 AS n');
   const qData = await qRes.json();
   expect(qData.status, '並行 connect 後查詢應成功').toBe('success');

   await disconnect(request, connUid);
});
