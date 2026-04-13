import { expect, test } from '@playwright/test';

const SIDECAR = 'http://127.0.0.1:5555';

const MSSQL = {
   host: process.env.MSSQL_HOST || 'localhost',
   port: Number(process.env.MSSQL_PORT || 1433),
   user: process.env.MSSQL_USER || 'sa',
   password: process.env.MSSQL_PASS || '',
   database: process.env.MSSQL_DB1 || 'master'
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

test('MSSQL update/delete routes keep affected rows within requested limits', async ({ request }) => {
   const connUid = uid();
   const tableName = `__antares_limit_guard_${Date.now()}`;

   const connectRes = await connect(request, connUid, MSSQL.database);
   const connectData = await connectRes.json();
   expect(connectData.status, `failed to connect: ${JSON.stringify(connectData)}`).toBe('success');

   const seedSql = `
      IF OBJECT_ID('[dbo].[${tableName}]', 'U') IS NOT NULL DROP TABLE [dbo].[${tableName}];
      CREATE TABLE [dbo].[${tableName}] (
         [id] INT NOT NULL PRIMARY KEY,
         [v] INT NOT NULL
      );
      INSERT INTO [dbo].[${tableName}] ([id], [v]) VALUES (1, 10), (2, 20), (3, 30);
   `;

   const seedRes = await rawQuery(request, connUid, seedSql);
   const seedData = await seedRes.json();
   expect(seedData.status, `failed to seed table: ${JSON.stringify(seedData)}`).toBe('success');

   const updateRes = await request.post(`${SIDECAR}/api/tables/updateCell`, {
      data: {
         uid: connUid,
         schema: 'dbo',
         table: tableName,
         field: 'v',
         type: 'INT',
         content: '99',
         id: 1,
         primary: 'id',
         row: { _antares_id: 'r1' }
      }
   });
   const updateData = await updateRes.json();
   expect(updateData.status, `updateCell failed: ${JSON.stringify(updateData)}`).toBe('success');

   const updateCheckRes = await rawQuery(request, connUid, `SELECT COUNT(1) AS c FROM [dbo].[${tableName}] WHERE [v] = 99`);
   const updateCheckData = await updateCheckRes.json();
   expect(updateCheckData.status).toBe('success');
   expect(Number(updateCheckData.response?.rows?.[0]?.c)).toBe(1);

   const deleteRes = await request.post(`${SIDECAR}/api/tables/deleteRows`, {
      data: {
         uid: connUid,
         schema: 'dbo',
         table: tableName,
         primary: 'id',
         rows: [{ id: 1 }, { id: 2 }]
      }
   });
   const deleteData = await deleteRes.json();
   expect(deleteData.status, `deleteRows failed: ${JSON.stringify(deleteData)}`).toBe('success');

   const deleteCheckRes = await rawQuery(request, connUid, `SELECT COUNT(1) AS c FROM [dbo].[${tableName}]`);
   const deleteCheckData = await deleteCheckRes.json();
   expect(deleteCheckData.status).toBe('success');
   expect(Number(deleteCheckData.response?.rows?.[0]?.c)).toBe(1);

   await rawQuery(request, connUid, `IF OBJECT_ID('[dbo].[${tableName}]', 'U') IS NOT NULL DROP TABLE [dbo].[${tableName}]`);
   await disconnect(request, connUid);
});
