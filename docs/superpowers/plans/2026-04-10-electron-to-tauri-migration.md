# Antares SQL: Electron → Tauri v2 Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Antares SQL Client from Electron 30 to Tauri v2 with a Node.js sidecar HTTP server, preserving all existing DB drivers, and adding SQL Server support.

**Architecture:** Tauri Rust shell (~200 lines) manages window + spawns a Node.js Fastify sidecar (packaged via pkg). Frontend stays Vue 3 + Pinia, served by Vite instead of Webpack. All 87 IPC handlers become HTTP routes. Electron-specific APIs replaced by Tauri plugins.

**Tech Stack:** Tauri v2, Rust, Vue 3, Pinia, Vite, Fastify, TypeScript, pkg, esbuild

**Spec:** `docs/superpowers/specs/2026-04-10-electron-to-tauri-migration-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|---|---|
| `src-tauri/src/main.rs` | Tauri entry: plugins, sidecar spawn, window config |
| `src-tauri/src/sidecar.rs` | Sidecar lifecycle: spawn, health check, kill |
| `src-tauri/Cargo.toml` | Rust dependencies |
| `src-tauri/tauri.conf.json` | Tauri app config, permissions, sidecar declaration |
| `src-tauri/capabilities/default.json` | Tauri v2 permission capabilities |
| `src/main/server.ts` | Fastify HTTP server entry point |
| `src/main/routes/connection.ts` | HTTP routes for connection management |
| `src/main/routes/schema.ts` | HTTP routes for schema operations |
| `src/main/routes/tables.ts` | HTTP routes for table operations |
| `src/main/routes/views.ts` | HTTP routes for view operations |
| `src/main/routes/routines.ts` | HTTP routes for routine operations |
| `src/main/routes/functions.ts` | HTTP routes for function operations |
| `src/main/routes/triggers.ts` | HTTP routes for trigger operations |
| `src/main/routes/schedulers.ts` | HTTP routes for scheduler operations |
| `src/main/routes/databases.ts` | HTTP routes for database listing |
| `src/main/routes/users.ts` | HTTP routes for user listing |
| `src/main/routes/application.ts` | HTTP routes for file I/O, shortcuts |
| `src/renderer/ipc-api/httpClient.ts` | Fetch wrapper replacing ipcRenderer |
| `src/renderer/libs/persistStore.ts` | Tauri fs-based persistence replacing electron-store |
| `vite.config.ts` | Vite config for renderer |
| `index.html` | Vite entry HTML |
| `src/main/libs/clients/SQLServerClient.ts` | SQL Server BaseClient implementation |
| `src/common/data-types/sqlserver.ts` | SQL Server type definitions |
| `src/common/customizations/sqlserver.ts` | SQL Server feature flags |

### Modified Files

| File | Change |
|---|---|
| `src/renderer/ipc-api/*.ts` (11 files) | `ipcRenderer.invoke` → `httpClient.apiCall` |
| `src/renderer/stores/*.ts` (6 stores) | `electron-store` → `persistStore` |
| `src/renderer/components/TheTitleBar.vue` | `@electron/remote` → `@tauri-apps/api/window` |
| `src/renderer/components/BaseContextMenu.vue` | `@electron/remote.Menu` → custom Vue menu |
| `src/main/libs/ClientsFactory.ts` | Add SQLServerClient case |
| `src/common/interfaces/antares.ts` | Add 'mssql' to client type union |
| `package.json` | Update dependencies |
| `tsconfig.json` | Update for Vite compatibility |

### Files to Delete (after migration complete)

| File | Reason |
|---|---|
| `webpack.main.config.js` | Replaced by esbuild |
| `webpack.renderer.config.js` | Replaced by Vite |
| `webpack.workers.config.js` | Workers bundled into sidecar |
| `scripts/devRunner.js` | Replaced by cargo tauri dev |
| `scripts/devtoolsInstaller.js` | Not needed with Tauri |

---

## Phase 1: Sidecar HTTP Server (Node.js Backend)

### Task 1: Initialize Fastify Server

**Files:**
- Create: `src/main/server.ts`

- [ ] **Step 1: Install Fastify**

```bash
cd E:/source/antares
npm install fastify @fastify/websocket @fastify/cors
```

- [ ] **Step 2: Create server entry point**

Create `src/main/server.ts`:

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import * as net from 'net';

const findFreePort = (): Promise<number> => {
   return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.listen(0, () => {
         const port = (server.address() as net.AddressInfo).port;
         server.close(() => resolve(port));
      });
      server.on('error', reject);
   });
};

const start = async () => {
   const port = process.argv.includes('--port')
      ? parseInt(process.argv[process.argv.indexOf('--port') + 1])
      : await findFreePort();

   const app = Fastify({ logger: false });

   await app.register(cors, { origin: true });
   await app.register(websocket);

   app.get('/health', async () => ({ status: 'ok', port }));

   await app.listen({ port, host: '127.0.0.1' });

   // Signal to Tauri that we're ready
   console.log(`READY:${port}`);
};

start().catch((err) => {
   console.error('Server failed to start:', err);
   process.exit(1);
});
```

- [ ] **Step 3: Test the server starts**

```bash
npx tsx src/main/server.ts --port 5555
# Expected output: READY:5555
# In another terminal:
curl http://localhost:5555/health
# Expected: {"status":"ok","port":5555}
```

- [ ] **Step 4: Commit**

```bash
git add src/main/server.ts package.json package-lock.json
git commit -m "feat: add Fastify HTTP server entry point for Tauri sidecar"
```

---

### Task 2: Connection Routes

**Files:**
- Create: `src/main/routes/connection.ts`
- Modify: `src/main/server.ts`
- Reference: `src/main/ipc-handlers/connection.ts`

- [ ] **Step 1: Create connection routes**

Create `src/main/routes/connection.ts`:

```typescript
import { FastifyInstance } from 'fastify';
import * as antares from 'common/interfaces/antares';
import * as fs from 'fs';
import { SslOptions } from 'mysql2';
import { ClientsFactory } from '../libs/ClientsFactory';

const connections: Record<string, antares.Client> = {};
const isAborting: Record<string, boolean> = {};

export function getConnections () {
   return connections;
}

export default async function connectionRoutes (app: FastifyInstance) {
   app.post('/api/connection/test', async (request) => {
      const conn = request.body as antares.ConnectionParams;

      const params: antares.ClientParams = {
         host: conn.host,
         port: +conn.port,
         user: conn.user,
         password: conn.password,
         readonly: conn.readonly,
         connectionString: conn.connString,
         database: conn.database || '',
         schema: conn.schema || '',
         databasePath: conn.databasePath || '',
         ssl: undefined as SslOptions,
         ssh: undefined as antares.SSH
      };

      if (conn.ssl) {
         params.ssl = {
            key: conn.key ? fs.readFileSync(conn.key).toString() : null,
            cert: conn.cert ? fs.readFileSync(conn.cert).toString() : null,
            ca: conn.ca ? fs.readFileSync(conn.ca).toString() : null,
            ciphers: conn.ciphers,
            rejectUnauthorized: !conn.untrustedConnection
         };
      }

      if (conn.ssh) {
         params.ssh = {
            host: conn.sshHost,
            username: conn.sshUser,
            password: conn.sshPassword,
            port: +conn.sshPort,
            privateKey: conn.sshKey ? fs.readFileSync(conn.sshKey).toString() : null,
            passphrase: conn.sshPassphrase,
            keepaliveInterval: conn.sshKeepAliveInterval || 10000
         };
      }

      try {
         const testClient = ClientsFactory.getClient({
            client: conn.client,
            params,
            poolSize: 1
         });
         await testClient.connect();
         testClient.destroy();
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: (err as Error).message };
      }
   });

   app.post('/api/connection/connect', async (request) => {
      const conn = request.body as antares.ConnectionParams;

      const params: antares.ClientParams = {
         host: conn.host,
         port: +conn.port,
         user: conn.user,
         password: conn.password,
         readonly: conn.readonly,
         connectionString: conn.connString,
         database: conn.database || '',
         schema: conn.schema || '',
         databasePath: conn.databasePath || '',
         ssl: undefined as SslOptions,
         ssh: undefined as antares.SSH
      };

      if (conn.ssl) {
         params.ssl = {
            key: conn.key ? fs.readFileSync(conn.key).toString() : null,
            cert: conn.cert ? fs.readFileSync(conn.cert).toString() : null,
            ca: conn.ca ? fs.readFileSync(conn.ca).toString() : null,
            ciphers: conn.ciphers,
            rejectUnauthorized: !conn.untrustedConnection
         };
      }

      if (conn.ssh) {
         params.ssh = {
            host: conn.sshHost,
            username: conn.sshUser,
            password: conn.sshPassword,
            port: +conn.sshPort,
            privateKey: conn.sshKey ? fs.readFileSync(conn.sshKey).toString() : null,
            passphrase: conn.sshPassphrase,
            keepaliveInterval: conn.sshKeepAliveInterval || 10000
         };
      }

      try {
         const client = ClientsFactory.getClient({
            client: conn.client,
            params,
            poolSize: conn.poolSize || 5
         });
         await client.connect();
         connections[conn.uid] = client;
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: (err as Error).message };
      }
   });

   app.post('/api/connection/disconnect', async (request) => {
      const { uid } = request.body as { uid: string };
      if (connections[uid]) {
         connections[uid].destroy();
         delete connections[uid];
      }
      return { status: 'success' };
   });

   app.post('/api/connection/abort', async (request) => {
      const { uid } = request.body as { uid: string };
      isAborting[uid] = true;
      return { status: 'success' };
   });

   app.post('/api/connection/check', async (request) => {
      const { uid } = request.body as { uid: string };
      const isConnected = !!connections[uid];
      return { status: 'success', response: isConnected };
   });
}
```

- [ ] **Step 2: Register routes in server.ts**

Add to `src/main/server.ts` before `app.listen`:

```typescript
import connectionRoutes from './routes/connection';

// ... inside start():
await app.register(connectionRoutes);
```

- [ ] **Step 3: Test connection route**

```bash
npx tsx src/main/server.ts --port 5555
# In another terminal:
curl -X POST http://localhost:5555/api/connection/check \
  -H "Content-Type: application/json" \
  -d '{"uid":"test"}'
# Expected: {"status":"success","response":false}
```

- [ ] **Step 4: Commit**

```bash
git add src/main/routes/connection.ts src/main/server.ts
git commit -m "feat: add connection HTTP routes for sidecar"
```

---

### Task 3: Table Routes

**Files:**
- Create: `src/main/routes/tables.ts`
- Modify: `src/main/server.ts`
- Reference: `src/main/ipc-handlers/tables.ts`

- [ ] **Step 1: Create table routes**

Create `src/main/routes/tables.ts`. This file follows the same pattern as connection routes — each IPC handler becomes a POST route. The `connections` object is imported from the connection routes module.

```typescript
import { FastifyInstance } from 'fastify';
import { getConnections } from './connection';

export default async function tableRoutes (app: FastifyInstance) {
   const connections = getConnections();

   app.post('/api/tables/columns', async (request) => {
      const { uid, schema, table } = request.body as { uid: string; schema: string; table: string };
      try {
         const result = await connections[uid].getTableColumns({ schema, table });
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: (err as Error).message };
      }
   });

   app.post('/api/tables/data', async (request) => {
      const params = request.body as {
         uid: string; schema: string; table: string;
         limit: number; page: number;
         sortParams: { field: string; dir: 'asc' | 'desc' };
         where: unknown;
      };
      try {
         const result = await connections[params.uid]
            .select('*')
            .schema(params.schema)
            .from(params.table)
            .limit(params.limit)
            .offset((params.page - 1) * params.limit)
            .orderBy(params.sortParams)
            .run();
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: (err as Error).message };
      }
   });

   app.post('/api/tables/count', async (request) => {
      const { uid, schema, table } = request.body as { uid: string; schema: string; table: string };
      try {
         const result = await connections[uid].getTableApproximateCount({ schema, table });
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: (err as Error).message };
      }
   });

   app.post('/api/tables/options', async (request) => {
      const { uid, schema, table } = request.body as { uid: string; schema: string; table: string };
      try {
         const result = await connections[uid].getTableOptions({ schema, table });
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: (err as Error).message };
      }
   });

   app.post('/api/tables/indexes', async (request) => {
      const { uid, schema, table } = request.body as { uid: string; schema: string; table: string };
      try {
         const result = await connections[uid].getTableIndexes({ schema, table });
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: (err as Error).message };
      }
   });

   app.post('/api/tables/checks', async (request) => {
      const { uid, schema, table } = request.body as { uid: string; schema: string; table: string };
      try {
         const result = await connections[uid].getTableChecks({ schema, table });
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: (err as Error).message };
      }
   });

   app.post('/api/tables/ddl', async (request) => {
      const { uid, schema, table } = request.body as { uid: string; schema: string; table: string };
      try {
         const result = await connections[uid].getTableDll({ schema, table });
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: (err as Error).message };
      }
   });

   app.post('/api/tables/key-usage', async (request) => {
      const { uid, schema, table } = request.body as { uid: string; schema: string; table: string };
      try {
         const result = await connections[uid].getKeyUsage({ schema, table });
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: (err as Error).message };
      }
   });

   app.post('/api/tables/update-cell', async (request) => {
      const params = request.body as {
         uid: string; schema: string; table: string;
         primary?: string; id: number | string;
         content: unknown; type: string; field: string;
      };
      try {
         const result = await connections[params.uid].updateTableCell(params);
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: (err as Error).message };
      }
   });

   app.post('/api/tables/delete-rows', async (request) => {
      const params = request.body as {
         uid: string; schema: string; table: string;
         primary?: string; field: string; rows: unknown;
      };
      try {
         const result = await connections[params.uid].deleteTableRows(params);
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: (err as Error).message };
      }
   });

   app.post('/api/tables/insert-fake-rows', async (request) => {
      const params = request.body as {
         uid: string; schema: string; table: string;
         row: unknown; repeat: number; fields: unknown; locale: string;
      };
      try {
         const result = await connections[params.uid].insertTableFakeRows(params);
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: (err as Error).message };
      }
   });

   app.post('/api/tables/foreign-list', async (request) => {
      const params = request.body as {
         uid: string; schema: string; table: string;
         column: string; description: string | false;
      };
      try {
         const result = await connections[params.uid].getForeignList(params);
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: (err as Error).message };
      }
   });

   app.post('/api/tables/create', async (request) => {
      const params = request.body as { uid: string; [key: string]: unknown };
      try {
         const result = await connections[params.uid].createTable(params as any);
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: (err as Error).message };
      }
   });

   app.post('/api/tables/alter', async (request) => {
      const params = request.body as { uid: string; [key: string]: unknown };
      try {
         const result = await connections[params.uid].alterTable(params as any);
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: (err as Error).message };
      }
   });

   app.post('/api/tables/duplicate', async (request) => {
      const { uid, schema, table } = request.body as { uid: string; schema: string; table: string };
      try {
         const result = await connections[uid].duplicateTable({ schema, table });
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: (err as Error).message };
      }
   });

   app.post('/api/tables/truncate', async (request) => {
      const { uid, schema, table, force } = request.body as { uid: string; schema: string; table: string; force: boolean };
      try {
         const result = await connections[uid].truncateTable({ schema, table, force });
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: (err as Error).message };
      }
   });

   app.post('/api/tables/drop', async (request) => {
      const { uid, schema, table } = request.body as { uid: string; schema: string; table: string };
      try {
         const result = await connections[uid].dropTable({ schema, table });
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: (err as Error).message };
      }
   });
}
```

- [ ] **Step 2: Register table routes in server.ts**

Add to `src/main/server.ts`:

```typescript
import tableRoutes from './routes/tables';
// ... inside start():
await app.register(tableRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add src/main/routes/tables.ts src/main/server.ts
git commit -m "feat: add table HTTP routes for sidecar"
```

---

### Task 4: Remaining Routes (schema, views, triggers, routines, functions, schedulers, databases, users, application)

**Files:**
- Create: `src/main/routes/schema.ts`
- Create: `src/main/routes/views.ts`
- Create: `src/main/routes/triggers.ts`
- Create: `src/main/routes/routines.ts`
- Create: `src/main/routes/functions.ts`
- Create: `src/main/routes/schedulers.ts`
- Create: `src/main/routes/databases.ts`
- Create: `src/main/routes/users.ts`
- Create: `src/main/routes/application.ts`
- Modify: `src/main/server.ts`
- Reference: `src/main/ipc-handlers/schema.ts`, `views.ts`, `triggers.ts`, `routines.ts`, `functions.ts`, `schedulers.ts`, `database.ts`, `users.ts`, `application.ts`

Each file follows the exact same pattern as Task 2-3: read the corresponding `ipc-handlers/*.ts`, replace `ipcMain.handle('channel-name', handler)` with `app.post('/api/{group}/{action}', handler)`, import `getConnections()` from `./connection`, wrap responses in `{ status, response }`.

- [ ] **Step 1: Create all remaining route files**

Follow the pattern established in Tasks 2-3. For each IPC handler file:
1. Read the original `src/main/ipc-handlers/{name}.ts`
2. Convert each `ipcMain.handle(...)` to `app.post('/api/{group}/{action}', ...)`
3. Replace `connections[uid]` references with `getConnections()[uid]`
4. Remove `validateSender` checks (not needed for localhost HTTP)
5. Keep all `try/catch` blocks, return `{ status: 'error', response: err.message }` on error

Key differences by route file:
- **schema.ts** (21 routes): Includes `raw-query` → `POST /api/schema/raw-query` which is the most heavily used endpoint. Also includes export/import which will need WebSocket (Task 5).
- **application.ts** (4 routes): Only file I/O and shortcuts. Dialog routes (`show-open-dialog`, `show-save-dialog`) and `close-app` are NOT converted — they move to Tauri Rust side.

- [ ] **Step 2: Register all routes in server.ts**

```typescript
import connectionRoutes from './routes/connection';
import tableRoutes from './routes/tables';
import schemaRoutes from './routes/schema';
import viewRoutes from './routes/views';
import triggerRoutes from './routes/triggers';
import routineRoutes from './routes/routines';
import functionRoutes from './routes/functions';
import schedulerRoutes from './routes/schedulers';
import databaseRoutes from './routes/databases';
import userRoutes from './routes/users';
import applicationRoutes from './routes/application';

// Inside start():
await app.register(connectionRoutes);
await app.register(tableRoutes);
await app.register(schemaRoutes);
await app.register(viewRoutes);
await app.register(triggerRoutes);
await app.register(routineRoutes);
await app.register(functionRoutes);
await app.register(schedulerRoutes);
await app.register(databaseRoutes);
await app.register(userRoutes);
await app.register(applicationRoutes);
```

- [ ] **Step 3: Test server starts with all routes**

```bash
npx tsx src/main/server.ts --port 5555
curl http://localhost:5555/health
# Expected: {"status":"ok","port":5555}
```

- [ ] **Step 4: Commit**

```bash
git add src/main/routes/ src/main/server.ts
git commit -m "feat: add all remaining HTTP routes for sidecar"
```

---

### Task 5: WebSocket Channels for Export/Import

**Files:**
- Modify: `src/main/routes/schema.ts`
- Reference: `src/main/ipc-handlers/schema.ts` (export/import handlers)
- Reference: `src/main/workers/exporter.ts`, `src/main/workers/importer.ts`

- [ ] **Step 1: Add WebSocket export endpoint**

In `src/main/routes/schema.ts`, add WebSocket route for export progress:

```typescript
app.register(async function wsRoutes (app) {
   app.get('/ws/export', { websocket: true }, (socket, request) => {
      socket.on('message', async (rawMsg) => {
         const msg = JSON.parse(rawMsg.toString());
         if (msg.type === 'start') {
            const { Worker } = await import('worker_threads');
            const exportWorker = new Worker(
               new URL('../workers/exporter.ts', import.meta.url)
            );

            exportWorker.postMessage({
               type: 'init',
               ...msg.params
            });

            exportWorker.on('message', (workerMsg: { type: string; payload: unknown }) => {
               socket.send(JSON.stringify(workerMsg));
            });

            exportWorker.on('error', (err) => {
               socket.send(JSON.stringify({ type: 'error', payload: err.message }));
            });

            socket.on('message', (controlMsg) => {
               const parsed = JSON.parse(controlMsg.toString());
               if (parsed.type === 'abort') {
                  exportWorker.terminate();
                  socket.send(JSON.stringify({ type: 'aborted' }));
               }
            });
         }
      });
   });

   // Same pattern for import
   app.get('/ws/import', { websocket: true }, (socket, request) => {
      socket.on('message', async (rawMsg) => {
         const msg = JSON.parse(rawMsg.toString());
         if (msg.type === 'start') {
            const { Worker } = await import('worker_threads');
            const importWorker = new Worker(
               new URL('../workers/importer.ts', import.meta.url)
            );

            importWorker.postMessage({
               type: 'init',
               ...msg.params
            });

            importWorker.on('message', (workerMsg: { type: string; payload: unknown }) => {
               socket.send(JSON.stringify(workerMsg));
            });

            importWorker.on('error', (err) => {
               socket.send(JSON.stringify({ type: 'error', payload: err.message }));
            });

            socket.on('message', (controlMsg) => {
               const parsed = JSON.parse(controlMsg.toString());
               if (parsed.type === 'abort') {
                  importWorker.terminate();
                  socket.send(JSON.stringify({ type: 'aborted' }));
               }
            });
         }
      });
   });
});
```

- [ ] **Step 2: Commit**

```bash
git add src/main/routes/schema.ts
git commit -m "feat: add WebSocket channels for export/import progress"
```

---

## Phase 2: Frontend Migration

### Task 6: HTTP Client Utility

**Files:**
- Create: `src/renderer/ipc-api/httpClient.ts`

- [ ] **Step 1: Create the HTTP client**

```typescript
import { ref } from 'vue';

const sidecarPort = ref<number>(0);

export function setSidecarPort (port: number) {
   sidecarPort.value = port;
}

export function getSidecarPort (): number {
   return sidecarPort.value;
}

export async function apiCall<T = unknown> (path: string, params?: unknown): Promise<T> {
   const baseUrl = `http://127.0.0.1:${sidecarPort.value}`;
   const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: params ? JSON.stringify(params) : undefined
   });

   if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error ${res.status}: ${text}`);
   }

   return res.json();
}

export function createWebSocket (path: string): WebSocket {
   const baseUrl = `ws://127.0.0.1:${sidecarPort.value}`;
   return new WebSocket(`${baseUrl}${path}`);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/ipc-api/httpClient.ts
git commit -m "feat: add HTTP client utility for sidecar communication"
```

---

### Task 7: Convert IPC API Modules to HTTP

**Files:**
- Modify: `src/renderer/ipc-api/Tables.ts` (and all 10 other ipc-api files)

- [ ] **Step 1: Convert Tables.ts**

Replace the entire file:

```typescript
import { AlterTableParams, CreateTableParams, IpcResponse } from 'common/interfaces/antares';
import { apiCall } from './httpClient';

export default class {
   static getTableColumns (params: { schema: string; table: string }): Promise<IpcResponse> {
      return apiCall('/api/tables/columns', params);
   }

   static getTableData (params: {
      uid: string;
      schema: string;
      table: string;
      limit: number;
      page: number;
      sortParams: { field: string; dir: 'asc' | 'desc' };
      where: any;
   }): Promise<IpcResponse> {
      return apiCall('/api/tables/data', params);
   }

   static getTableApproximateCount (params: { uid: string; schema: string; table: string }): Promise<IpcResponse<number>> {
      return apiCall('/api/tables/count', params);
   }

   static getTableOptions (params: { uid: string; schema: string; table: string }): Promise<IpcResponse> {
      return apiCall('/api/tables/options', params);
   }

   static getTableIndexes (params: { uid: string; schema: string; table: string }): Promise<IpcResponse> {
      return apiCall('/api/tables/indexes', params);
   }

   static getTableChecks (params: { uid: string; schema: string; table: string }): Promise<IpcResponse> {
      return apiCall('/api/tables/checks', params);
   }

   static getTableDll (params: { uid: string; schema: string; table: string }): Promise<IpcResponse<string>> {
      return apiCall('/api/tables/ddl', params);
   }

   static getKeyUsage (params: { uid: string; schema: string; table: string }): Promise<IpcResponse> {
      return apiCall('/api/tables/key-usage', params);
   }

   static updateTableCell (params: {
      uid: string; schema: string; table: string;
      primary?: string; id: number | string;
      content: number | string | boolean | Date | Blob | null;
      type: string; field: string;
   }): Promise<IpcResponse> {
      return apiCall('/api/tables/update-cell', params);
   }

   static deleteTableRows (params: {
      uid: string; schema: string; table: string;
      primary?: string; field: string;
      rows: Record<string, any>;
   }): Promise<IpcResponse> {
      return apiCall('/api/tables/delete-rows', params);
   }

   static insertTableFakeRows (params: {
      uid: string; schema: string; table: string;
      row: Record<string, string | number | boolean | Date | Buffer>;
      repeat: number; fields: Record<string, string>; locale: string;
   }): Promise<IpcResponse> {
      return apiCall('/api/tables/insert-fake-rows', params);
   }

   static getForeignList (params: {
      uid: string; schema: string; table: string;
      column: string; description: string | false;
   }): Promise<IpcResponse> {
      return apiCall('/api/tables/foreign-list', params);
   }

   static createTable (params: CreateTableParams): Promise<IpcResponse> {
      return apiCall('/api/tables/create', params);
   }

   static alterTable (params: AlterTableParams): Promise<IpcResponse> {
      return apiCall('/api/tables/alter', params);
   }

   static duplicateTable (params: { uid: string; schema: string; table: string }): Promise<IpcResponse> {
      return apiCall('/api/tables/duplicate', params);
   }

   static truncateTable (params: { uid: string; schema: string; table: string; force: boolean }): Promise<IpcResponse> {
      return apiCall('/api/tables/truncate', params);
   }

   static dropTable (params: { uid: string; schema: string; table: string }): Promise<IpcResponse> {
      return apiCall('/api/tables/drop', params);
   }
}
```

- [ ] **Step 2: Convert all other IPC API modules**

Apply the same pattern to all remaining files in `src/renderer/ipc-api/`:
- `Connection.ts` → `apiCall('/api/connection/{action}', params)`
- `Schema.ts` → `apiCall('/api/schema/{action}', params)`
- `Views.ts` → `apiCall('/api/views/{action}', params)`
- `Triggers.ts` → `apiCall('/api/triggers/{action}', params)`
- `Routines.ts` → `apiCall('/api/routines/{action}', params)`
- `Functions.ts` → `apiCall('/api/functions/{action}', params)`
- `Schedulers.ts` → `apiCall('/api/schedulers/{action}', params)`
- `Databases.ts` → `apiCall('/api/databases/{action}', params)`
- `Users.ts` → `apiCall('/api/users/{action}', params)`
- `Application.ts` → split: file I/O goes to `apiCall`, dialogs go to `@tauri-apps/plugin-dialog`

For each file: remove `import { ipcRenderer } from 'electron'` and `import { unproxify }`, add `import { apiCall } from './httpClient'`, replace `ipcRenderer.invoke('channel', unproxify(params))` with `apiCall('/api/group/action', params)`.

- [ ] **Step 3: Remove unproxify dependency**

`unproxify` was needed to strip Vue Proxy objects before Electron IPC serialization. `JSON.stringify` (used by `fetch`) handles this automatically, so `unproxify` calls are no longer needed.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/ipc-api/
git commit -m "feat: convert all IPC API modules from ipcRenderer to HTTP fetch"
```

---

### Task 8: Persist Store Utility

**Files:**
- Create: `src/renderer/libs/persistStore.ts`

- [ ] **Step 1: Install Tauri plugins**

```bash
npm install @tauri-apps/api @tauri-apps/plugin-fs @tauri-apps/plugin-dialog @tauri-apps/plugin-os @tauri-apps/plugin-window-state
```

- [ ] **Step 2: Create persistStore utility**

```typescript
import { BaseDirectory, exists, mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

const STORE_DIR = 'antares-data';

async function ensureDir (): Promise<void> {
   const dirExists = await exists(STORE_DIR, { baseDir: BaseDirectory.AppData });
   if (!dirExists)
      await mkdir(STORE_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
}

export async function loadStore<T> (name: string, defaults: T): Promise<T> {
   try {
      await ensureDir();
      const text = await readTextFile(`${STORE_DIR}/${name}.json`, { baseDir: BaseDirectory.AppData });
      return { ...defaults, ...JSON.parse(text) };
   }
   catch {
      return defaults;
   }
}

export async function saveStore (name: string, data: unknown): Promise<void> {
   await ensureDir();
   await writeTextFile(
      `${STORE_DIR}/${name}.json`,
      JSON.stringify(data, null, 2),
      { baseDir: BaseDirectory.AppData }
   );
}

export function loadStoreValue<T> (storeData: Record<string, unknown>, key: string, defaultValue: T): T {
   return (storeData[key] as T) ?? defaultValue;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/libs/persistStore.ts package.json package-lock.json
git commit -m "feat: add Tauri fs-based persistence utility"
```

---

### Task 9: Convert Pinia Stores

**Files:**
- Modify: `src/renderer/stores/settings.ts`
- Modify: `src/renderer/stores/connections.ts`
- Modify: `src/renderer/stores/workspaces.ts`
- Modify: `src/renderer/stores/history.ts`
- Modify: `src/renderer/stores/scratchpad.ts`
- Modify: `src/renderer/stores/application.ts`

- [ ] **Step 1: Convert settings store**

In `src/renderer/stores/settings.ts`:
1. Remove `import * as Store from 'electron-store'` and the two `new Store(...)` lines
2. Add `import { loadStore, saveStore } from '../libs/persistStore'`
3. Change state initialization to use defaults (loaded async in `actions.init()`)
4. Add an `init` action that calls `loadStore('settings', defaults)` and populates state
5. Add a `persist` action that calls `saveStore('settings', this.$state)` — call it in each mutation

Pattern for each store:

```typescript
// Before:
const settingsStore = new Store({ name: 'settings' });
// state: () => ({ locale: settingsStore.get('locale', 'en-US') as string })

// After:
// state: () => ({ locale: 'en-US' as string, _loaded: false })
// actions: {
//   async init() {
//     const data = await loadStore('settings', {});
//     this.locale = data.locale ?? 'en-US';
//     this._loaded = true;
//   },
//   async persist() { await saveStore('settings', { locale: this.locale, ... }); }
// }
```

- [ ] **Step 2: Convert all 6 stores following the same pattern**

For `connections.ts`: the encryption key handling changes — instead of `electron.safeStorage`, use a key stored by the sidecar. For now, store connections without encryption (add encryption in a follow-up task via sidecar endpoint `POST /api/app/encrypt`).

- [ ] **Step 3: Update app initialization to call store.init()**

In `src/renderer/index.ts`, after creating the Pinia instance, call `init()` on each store that uses persistence.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/stores/ src/renderer/index.ts
git commit -m "feat: convert Pinia stores from electron-store to Tauri fs persistence"
```

---

### Task 10: Replace @electron/remote in Components

**Files:**
- Modify: `src/renderer/components/TheTitleBar.vue`
- Modify: all components using `@electron/remote` (~11 files)

- [ ] **Step 1: Convert TheTitleBar.vue window controls**

Replace:
```typescript
import { getCurrentWindow } from '@electron/remote';
const mainWindow = getCurrentWindow();
// mainWindow.minimize(), mainWindow.maximize(), mainWindow.close()
```

With:
```typescript
import { getCurrentWindow } from '@tauri-apps/api/window';
const appWindow = getCurrentWindow();
// appWindow.minimize(), appWindow.maximize(), appWindow.close()
```

The API is nearly identical. Key differences:
- Tauri's `maximize()` is async (returns Promise)
- `isMaximized()` is async in Tauri
- Use `appWindow.onResized()` instead of listening to window events

- [ ] **Step 2: Replace process.platform checks**

In all files using `process.platform`:
```typescript
// Before:
const isMacOS = process.platform === 'darwin';

// After:
import { platform } from '@tauri-apps/plugin-os';
const isMacOS = platform() === 'macos';  // Note: Tauri uses 'macos' not 'darwin'
```

- [ ] **Step 3: Replace process.env references**

```typescript
// Before:
process.env.NODE_ENV !== 'production'
process.env.PACKAGE_VERSION

// After:
import.meta.env.MODE !== 'production'
import.meta.env.PACKAGE_VERSION  // defined in vite.config.ts
```

- [ ] **Step 4: Remove all remaining electron imports from renderer**

Search for and remove:
- `import { ipcRenderer } from 'electron'` (should be gone after Task 7)
- `import ... from '@electron/remote'`
- `const { ... } = require('electron')`

- [ ] **Step 5: Commit**

```bash
git add src/renderer/
git commit -m "feat: replace @electron/remote and process globals with Tauri APIs"
```

---

## Phase 3: Build System Migration

### Task 11: Vite Configuration

**Files:**
- Create: `vite.config.ts`
- Create: `index.html`
- Modify: `tsconfig.json`
- Modify: `package.json`

- [ ] **Step 1: Install Vite and plugins**

```bash
npm install -D vite @vitejs/plugin-vue @tauri-apps/cli
```

- [ ] **Step 2: Create vite.config.ts**

```typescript
import vue from '@vitejs/plugin-vue';
import { readFileSync } from 'fs';
import path from 'path';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
   plugins: [vue()],
   resolve: {
      alias: {
         '@': path.resolve(__dirname, 'src/renderer'),
         'common': path.resolve(__dirname, 'src/common')
      }
   },
   define: {
      'import.meta.env.PACKAGE_VERSION': JSON.stringify(pkg.version),
      'import.meta.env.APP_CONTRIBUTORS': JSON.stringify(pkg.contributors || [])
   },
   css: {
      preprocessorOptions: {
         scss: {
            additionalData: '' // Add global SCSS imports if needed
         }
      }
   },
   server: {
      port: 5173,
      strictPort: true
   },
   build: {
      outDir: 'dist',
      target: 'esnext'
   }
});
```

- [ ] **Step 3: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
   <meta charset="UTF-8">
   <meta name="viewport" content="width=device-width, initial-scale=1.0">
   <title>Antares SQL</title>
</head>
<body>
   <div id="app"></div>
   <script type="module" src="/src/renderer/index.ts"></script>
</body>
</html>
```

- [ ] **Step 4: Update tsconfig.json for Vite**

```jsonc
{
   "compilerOptions": {
      "target": "ESNext",
      "module": "ESNext",
      "moduleResolution": "bundler",
      "allowSyntheticDefaultImports": true,
      "esModuleInterop": true,
      "resolveJsonModule": true,
      "sourceMap": true,
      "noImplicitAny": true,
      "paths": {
         "common/*": ["./src/common/*"],
         "@/*": ["./src/renderer/*"]
      },
      "types": ["vite/client"]
   },
   "include": ["src/renderer/**/*", "src/common/**/*"],
   "exclude": ["node_modules"]
}
```

Add a separate `tsconfig.server.json` for the sidecar:

```jsonc
{
   "compilerOptions": {
      "target": "ES2021",
      "module": "CommonJS",
      "moduleResolution": "node",
      "esModuleInterop": true,
      "resolveJsonModule": true,
      "sourceMap": true,
      "noImplicitAny": true,
      "outDir": "dist-server",
      "paths": {
         "common/*": ["./src/common/*"]
      }
   },
   "include": ["src/main/**/*", "src/common/**/*"],
   "exclude": ["node_modules"]
}
```

- [ ] **Step 5: Update package.json scripts**

```jsonc
{
   "scripts": {
      "vite:dev": "vite",
      "vite:build": "vite build",
      "sidecar:dev": "tsx watch src/main/server.ts --port 5555",
      "build:sidecar": "esbuild src/main/server.ts --bundle --platform=node --outfile=sidecar/bundle.js && pkg sidecar/bundle.js -t node20-win-x64 -o src-tauri/binaries/antares-server-x86_64-pc-windows-msvc.exe",
      "tauri:dev": "tauri dev",
      "tauri:build": "npm run build:sidecar && tauri build",
      "lint": "eslint . --ext .js,.ts,.vue",
      "lint:fix": "eslint . --ext .js,.ts,.vue --fix"
   }
}
```

- [ ] **Step 6: Test Vite dev server starts**

```bash
npm run vite:dev
# Expected: Vite dev server on http://localhost:5173
# May have import errors — that's expected, we fix them in subsequent tasks
```

- [ ] **Step 7: Commit**

```bash
git add vite.config.ts index.html tsconfig.json tsconfig.server.json package.json
git commit -m "feat: add Vite build config replacing Webpack"
```

---

## Phase 4: Tauri Rust Shell

### Task 12: Initialize Tauri Project

**Files:**
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/src/sidecar.rs`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/capabilities/default.json`

- [ ] **Step 1: Initialize Tauri**

```bash
cd E:/source/antares
npm install -D @tauri-apps/cli
npx tauri init
# Answer prompts:
# App name: Antares SQL
# Window title: Antares SQL
# Frontend dev URL: http://localhost:5173
# Frontend dist: ../dist
# Frontend dev command: npm run vite:dev
# Frontend build command: npm run vite:build
```

- [ ] **Step 2: Add Tauri plugins to Cargo.toml**

Edit `src-tauri/Cargo.toml` dependencies:

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
tauri-plugin-shell = "2"
tauri-plugin-window-state = "2"
tauri-plugin-updater = "2"
tauri-plugin-os = "2"
tauri-plugin-global-shortcut = "2"
tauri-plugin-clipboard-manager = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
```

- [ ] **Step 3: Write sidecar.rs**

Create `src-tauri/src/sidecar.rs`:

```rust
use std::sync::Mutex;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};

static SIDECAR_CHILD: Mutex<Option<CommandChild>> = Mutex::new(None);
static SIDECAR_PORT: Mutex<u16> = Mutex::new(0);

pub fn get_port() -> u16 {
    *SIDECAR_PORT.lock().unwrap()
}

pub fn spawn_server(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let sidecar = app.shell().sidecar("antares-server")?;
    let (mut rx, child) = sidecar.spawn()?;

    *SIDECAR_CHILD.lock().unwrap() = Some(child);

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let line_str = String::from_utf8_lossy(&line);
                    if line_str.starts_with("READY:") {
                        if let Ok(port) = line_str.trim_start_matches("READY:").trim().parse::<u16>() {
                            *SIDECAR_PORT.lock().unwrap() = port;
                            let _ = app_handle.emit("sidecar-ready", port);
                        }
                    }
                }
                CommandEvent::Stderr(line) => {
                    eprintln!("sidecar stderr: {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Error(err) => {
                    eprintln!("sidecar error: {}", err);
                }
                CommandEvent::Terminated(status) => {
                    eprintln!("sidecar terminated: {:?}", status);
                }
                _ => {}
            }
        }
    });

    Ok(())
}

pub fn kill_server() {
    if let Some(child) = SIDECAR_CHILD.lock().unwrap().take() {
        let _ = child.kill();
    }
}
```

- [ ] **Step 4: Write main.rs**

Create `src-tauri/src/main.rs`:

```rust
mod sidecar;

use tauri::Manager;

#[tauri::command]
fn get_sidecar_port() -> u16 {
    sidecar::get_port()
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_window_state::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_global_shortcut::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![get_sidecar_port])
        .setup(|app| {
            let handle = app.handle().clone();
            sidecar::spawn_server(&handle)?;
            Ok(())
        })
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                sidecar::kill_server();
            }
        })
        .run(tauri::generate_context!())
        .expect("error running Antares SQL");
}
```

- [ ] **Step 5: Configure tauri.conf.json**

Ensure `src-tauri/tauri.conf.json` contains:

```jsonc
{
   "productName": "Antares SQL",
   "version": "0.8.0",
   "identifier": "com.fabio286.antares",
   "build": {
      "beforeDevCommand": "npm run vite:dev",
      "devUrl": "http://localhost:5173",
      "beforeBuildCommand": "npm run vite:build",
      "frontendDist": "../dist"
   },
   "bundle": {
      "active": true,
      "targets": ["nsis"],
      "externalBin": ["binaries/antares-server"],
      "icon": ["icons/icon.ico", "icons/icon.png"]
   },
   "app": {
      "windows": [{
         "title": "Antares SQL",
         "width": 1024,
         "height": 800,
         "minWidth": 900,
         "minHeight": 550
      }],
      "security": {
         "csp": "default-src 'self'; connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:*; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:"
      }
   }
}
```

- [ ] **Step 6: Create capabilities/default.json**

```json
{
   "identifier": "default",
   "description": "Default capabilities for Antares SQL",
   "windows": ["main"],
   "permissions": [
      "core:default",
      "dialog:default",
      "fs:default",
      "shell:default",
      "window-state:default",
      "os:default",
      "global-shortcut:default",
      "clipboard-manager:default"
   ]
}
```

- [ ] **Step 7: Test Tauri compiles**

```bash
cd src-tauri && cargo check
# Expected: compiles without errors (warnings OK)
```

- [ ] **Step 8: Commit**

```bash
git add src-tauri/
git commit -m "feat: add Tauri v2 Rust shell with sidecar management"
```

---

### Task 13: Frontend Sidecar Integration

**Files:**
- Modify: `src/renderer/index.ts`

- [ ] **Step 1: Add sidecar port listener**

In `src/renderer/index.ts`, add initialization that waits for the sidecar to be ready:

```typescript
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { setSidecarPort } from './ipc-api/httpClient';

// Try to get port if sidecar already started
const existingPort = await invoke<number>('get_sidecar_port');
if (existingPort > 0) {
   setSidecarPort(existingPort);
}

// Listen for future sidecar-ready events (e.g., after restart)
await listen<number>('sidecar-ready', (event) => {
   setSidecarPort(event.payload);
});
```

This code should run before the Vue app mounts, so that all API calls have the correct port.

- [ ] **Step 2: Commit**

```bash
git add src/renderer/index.ts
git commit -m "feat: integrate sidecar port discovery in frontend"
```

---

## Phase 5: SQL Server Support

### Task 14: SQL Server Type Definitions

**Files:**
- Create: `src/common/data-types/sqlserver.ts`

- [ ] **Step 1: Create type definitions**

```typescript
import { TypesGroup } from 'common/interfaces/antares';

export default [
   {
      group: 'integer',
      types: [
         { name: 'BIT', length: false, collation: false, unsigned: false, zerofill: false },
         { name: 'TINYINT', length: false, collation: false, unsigned: false, zerofill: false },
         { name: 'SMALLINT', length: false, collation: false, unsigned: false, zerofill: false },
         { name: 'INT', length: false, collation: false, unsigned: false, zerofill: false },
         { name: 'BIGINT', length: false, collation: false, unsigned: false, zerofill: false }
      ]
   },
   {
      group: 'float',
      types: [
         { name: 'DECIMAL', length: true, collation: false, unsigned: false, zerofill: false },
         { name: 'NUMERIC', length: true, collation: false, unsigned: false, zerofill: false },
         { name: 'FLOAT', length: true, collation: false, unsigned: false, zerofill: false },
         { name: 'REAL', length: false, collation: false, unsigned: false, zerofill: false },
         { name: 'MONEY', length: false, collation: false, unsigned: false, zerofill: false },
         { name: 'SMALLMONEY', length: false, collation: false, unsigned: false, zerofill: false }
      ]
   },
   {
      group: 'string',
      types: [
         { name: 'CHAR', length: true, collation: true, unsigned: false, zerofill: false },
         { name: 'VARCHAR', length: true, collation: true, unsigned: false, zerofill: false },
         { name: 'TEXT', length: false, collation: true, unsigned: false, zerofill: false },
         { name: 'NCHAR', length: true, collation: true, unsigned: false, zerofill: false },
         { name: 'NVARCHAR', length: true, collation: true, unsigned: false, zerofill: false },
         { name: 'NTEXT', length: false, collation: true, unsigned: false, zerofill: false }
      ]
   },
   {
      group: 'binary',
      types: [
         { name: 'BINARY', length: true, collation: false, unsigned: false, zerofill: false },
         { name: 'VARBINARY', length: true, collation: false, unsigned: false, zerofill: false },
         { name: 'IMAGE', length: false, collation: false, unsigned: false, zerofill: false }
      ]
   },
   {
      group: 'time',
      types: [
         { name: 'DATE', length: false, collation: false, unsigned: false, zerofill: false },
         { name: 'TIME', length: true, collation: false, unsigned: false, zerofill: false },
         { name: 'DATETIME', length: false, collation: false, unsigned: false, zerofill: false },
         { name: 'DATETIME2', length: true, collation: false, unsigned: false, zerofill: false },
         { name: 'DATETIMEOFFSET', length: true, collation: false, unsigned: false, zerofill: false },
         { name: 'SMALLDATETIME', length: false, collation: false, unsigned: false, zerofill: false }
      ]
   },
   {
      group: 'other',
      types: [
         { name: 'UNIQUEIDENTIFIER', length: false, collation: false, unsigned: false, zerofill: false },
         { name: 'XML', length: false, collation: false, unsigned: false, zerofill: false },
         { name: 'SQL_VARIANT', length: false, collation: false, unsigned: false, zerofill: false },
         { name: 'HIERARCHYID', length: false, collation: false, unsigned: false, zerofill: false },
         { name: 'GEOGRAPHY', length: false, collation: false, unsigned: false, zerofill: false },
         { name: 'GEOMETRY', length: false, collation: false, unsigned: false, zerofill: false }
      ]
   }
] as TypesGroup[];
```

- [ ] **Step 2: Commit**

```bash
git add src/common/data-types/sqlserver.ts
git commit -m "feat: add SQL Server data type definitions"
```

---

### Task 15: SQL Server Customizations

**Files:**
- Create: `src/common/customizations/sqlserver.ts`

- [ ] **Step 1: Create feature flags**

```typescript
import { Customizations } from 'common/interfaces/customizations';
import { defaults } from './defaults';
import sqlServerTypes from '../data-types/sqlserver';

export const customizations: Customizations = {
   ...defaults,
   // Core
   defaultPort: 1433,
   defaultUser: 'sa',
   defaultDatabase: 'master',
   dataTypes: sqlServerTypes,
   indexTypes: ['PRIMARY', 'INDEX', 'UNIQUE'],
   foreignActions: ['RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT', 'NO ACTION'],
   // Connection
   database: true,
   collations: true,
   sslConnection: false,
   sshConnection: true,
   cancelQueries: true,
   // Tools
   processesList: true,
   variables: false,
   // Structure
   schemas: true,
   tables: true,
   views: true,
   triggers: true,
   routines: true,
   functions: true,
   schedulers: false,
   // Misc
   elementsWrapper: '[',
   stringsWrapper: '\'',
   tableAdd: true,
   tableDdl: true,
   viewAdd: true,
   triggerAdd: true,
   routineAdd: true,
   functionAdd: true,
   databaseEdit: false,
   schemaEdit: false,
   schemaExport: true,
   schemaImport: true,
   tableSettings: true,
   tableRealCount: true,
   tableDuplicate: true,
   viewSettings: true,
   triggerSettings: true,
   routineSettings: true,
   functionSettings: true,
   indexes: true,
   foreigns: true,
   sortableFields: true,
   nullable: true,
   autoIncrement: true,
   comment: true,
   collation: true,
   definer: false,
   triggerSql: 'T-SQL',
   procedureSql: 'T-SQL',
   functionSql: 'T-SQL',
   procedureContext: false,
   functionContext: false
};
```

- [ ] **Step 2: Commit**

```bash
git add src/common/customizations/sqlserver.ts
git commit -m "feat: add SQL Server feature flags"
```

---

### Task 16: SQL Server Client

**Files:**
- Create: `src/main/libs/clients/SQLServerClient.ts`
- Modify: `src/main/libs/ClientsFactory.ts`
- Modify: `src/common/interfaces/antares.ts`

This is the largest single task. The `SQLServerClient` extends `BaseClient` and implements all required methods using the `mssql` npm package.

- [ ] **Step 1: Install mssql**

```bash
npm install mssql
npm install -D @types/mssql
```

- [ ] **Step 2: Create SQLServerClient.ts**

Create `src/main/libs/clients/SQLServerClient.ts`. This file implements the BaseClient interface for SQL Server. Key methods:

- `connect()` / `destroy()`: Use `mssql.ConnectionPool`
- `raw(sql)`: Execute raw T-SQL via `pool.request().query(sql)`
- `getSQL()`: Generate T-SQL from the query builder state
- `getDatabases()`: `SELECT name FROM sys.databases`
- `getTableColumns()`: Query `INFORMATION_SCHEMA.COLUMNS` + `sys.extended_properties` for comments
- `getTableData()`: Standard SELECT with TOP/OFFSET-FETCH pagination
- `getTableIndexes()`: Query `sys.indexes` + `sys.index_columns`
- `getTableChecks()`: Query `sys.check_constraints`
- `getKeyUsage()`: Query `INFORMATION_SCHEMA.KEY_COLUMN_USAGE` + `REFERENTIAL_CONSTRAINTS`
- `getTableDll()`: Build CREATE TABLE DDL from column/index/FK metadata
- `createTable()` / `alterTable()` / `dropTable()`: T-SQL DDL generation
- `getCollations()`: `SELECT name FROM sys.fn_helpcollations()`
- `getRoutineInformations()` / `getFunctionInformations()`: Query `sys.procedures` / `sys.objects`
- Schema operations: `sys.schemas` queries

The full implementation (~1,500 lines) follows the pattern of `PostgreSQLClient.ts` but with T-SQL syntax. The worker implementing this should reference `PostgreSQLClient.ts` as the template and adapt SQL queries for SQL Server's system catalog views.

- [ ] **Step 3: Register in ClientsFactory**

In `src/main/libs/ClientsFactory.ts`, add:

```typescript
import { SQLServerClient } from './clients/SQLServerClient';

// In the switch/if chain:
case 'mssql':
   return new SQLServerClient(args);
```

- [ ] **Step 4: Add to interface types**

In `src/common/interfaces/antares.ts`, add `'mssql'` to the client type union wherever `'mysql'`, `'pg'`, `'sqlite'`, `'firebird'` appear.

- [ ] **Step 5: Commit**

```bash
git add src/main/libs/clients/SQLServerClient.ts src/main/libs/ClientsFactory.ts src/common/interfaces/antares.ts package.json package-lock.json
git commit -m "feat: add SQL Server client implementation"
```

---

## Phase 6: Integration & Cleanup

### Task 17: End-to-End Test

- [ ] **Step 1: Start sidecar in dev mode**

```bash
npx tsx src/main/server.ts --port 5555
```

- [ ] **Step 2: Test health check**

```bash
curl http://localhost:5555/health
# Expected: {"status":"ok","port":5555}
```

- [ ] **Step 3: Start Tauri dev**

```bash
npm run tauri:dev
# Expected: Vite dev server starts, Tauri window opens
# Frontend should connect to sidecar and display the connection screen
```

- [ ] **Step 4: Test database connection through the UI**

Connect to a local MySQL/PostgreSQL/SQLite/SQL Server database through the Antares UI. Verify:
- Connection form shows all 5 DB types
- Can connect and see tables
- Can query data
- Can view table structure

- [ ] **Step 5: Document any issues found**

Create `docs/superpowers/migration-issues.md` with any bugs or incomplete features found during testing.

---

### Task 18: Remove Electron Files

Only after Task 17 confirms everything works.

**Files to delete:**
- `webpack.main.config.js`
- `webpack.renderer.config.js`
- `webpack.workers.config.js`
- `scripts/devRunner.js`
- `scripts/devtoolsInstaller.js`

**Dependencies to remove from package.json:**
- `electron`, `@electron/remote`, `electron-store`, `electron-updater`, `electron-window-state`, `electron-builder`, `electron-log`

- [ ] **Step 1: Delete webpack configs and scripts**

```bash
rm webpack.main.config.js webpack.renderer.config.js webpack.workers.config.js
rm scripts/devRunner.js scripts/devtoolsInstaller.js
```

- [ ] **Step 2: Remove Electron dependencies**

```bash
npm uninstall electron @electron/remote electron-store electron-updater electron-window-state electron-builder electron-log
```

- [ ] **Step 3: Clean up package.json**

Remove the `"build"` section (electron-builder config) and old scripts (`debug`, `compile:*`, `build`, `rebuild:electron`, `devtools:install`, `postinstall`).

- [ ] **Step 4: Verify Tauri dev still works**

```bash
npm run tauri:dev
# Expected: still works without Electron dependencies
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove Electron files and dependencies"
```

---

## Summary

| Phase | Tasks | Description |
|---|---|---|
| Phase 1 | Tasks 1-5 | Node.js sidecar HTTP server |
| Phase 2 | Tasks 6-10 | Frontend migration (IPC → HTTP, stores, components) |
| Phase 3 | Task 11 | Vite build system |
| Phase 4 | Tasks 12-13 | Tauri Rust shell |
| Phase 5 | Tasks 14-16 | SQL Server support |
| Phase 6 | Tasks 17-18 | Integration testing & cleanup |
