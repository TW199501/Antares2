import * as workers from 'common/interfaces/workers';
import { FastifyInstance } from 'fastify';
import { Worker } from 'worker_threads';

import { requireConnection } from './connection';

export default async function schemaRoutes (app: FastifyInstance) {
   let exporter: Worker | null = null;
   let importer: Worker | null = null;

   // POST /api/schema/create
   app.post('/api/schema/create', async (request) => {
      const params = request.body as any;

      try {
         await requireConnection(params.uid).createSchema(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: String(err) };
      }
   });

   // POST /api/schema/update
   app.post('/api/schema/update', async (request) => {
      const params = request.body as any;

      try {
         await requireConnection(params.uid).alterSchema(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: String(err) };
      }
   });

   // POST /api/schema/delete
   app.post('/api/schema/delete', async (request) => {
      const params = request.body as any;

      try {
         await requireConnection(params.uid).dropSchema(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: String(err) };
      }
   });

   // POST /api/schema/getCollation
   app.post('/api/schema/getCollation', async (request) => {
      const params = request.body as any;

      try {
         const collation = await requireConnection(params.uid).getDatabaseCollation(params);
         return { status: 'success', response: collation };
      }
      catch (err) {
         return { status: 'error', response: String(err) };
      }
   });

   // POST /api/schema/getStructure
   app.post('/api/schema/getStructure', async (request) => {
      const params = request.body as any;

      try {
         const schemas = new Set(params.schemas as string[]);
         const structure: unknown = await requireConnection(params.uid).getStructure(schemas);
         return { status: 'success', response: structure };
      }
      catch (err) {
         return { status: 'error', response: String(err) };
      }
   });

   // POST /api/schema/getCollations
   app.post('/api/schema/getCollations', async (request) => {
      const { uid } = request.body as any;

      try {
         const result = await requireConnection(uid).getCollations();
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: String(err) };
      }
   });

   // POST /api/schema/getVariables
   app.post('/api/schema/getVariables', async (request) => {
      const { uid } = request.body as any;

      try {
         const result = await requireConnection(uid).getVariables();
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: String(err) };
      }
   });

   // POST /api/schema/getEngines
   app.post('/api/schema/getEngines', async (request) => {
      const { uid } = request.body as any;

      try {
         const result: unknown = await requireConnection(uid).getEngines();
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: String(err) };
      }
   });

   // POST /api/schema/getVersion
   app.post('/api/schema/getVersion', async (request) => {
      const { uid } = request.body as any;

      try {
         const result = await requireConnection(uid).getVersion();
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: String(err) };
      }
   });

   // POST /api/schema/getProcesses
   app.post('/api/schema/getProcesses', async (request) => {
      const { uid } = request.body as any;

      try {
         const result = await requireConnection(uid).getProcesses();
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: String(err) };
      }
   });

   // POST /api/schema/killProcess
   app.post('/api/schema/killProcess', async (request) => {
      const { uid, pid } = request.body as any;

      try {
         const result = await requireConnection(uid).killProcess(pid);
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: String(err) };
      }
   });

   // POST /api/schema/useSchema
   app.post('/api/schema/useSchema', async (request) => {
      const { uid, schema } = request.body as any;

      if (!schema) return;

      try {
         await requireConnection(uid).use(schema);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: String(err) };
      }
   });

   // POST /api/schema/rawQuery
   app.post('/api/schema/rawQuery', async (request) => {
      const { uid, query, schema, tabUid, autocommit } = request.body as any;

      if (!query) return;

      try {
         const result = await requireConnection(uid).raw(query, {
            nest: true,
            details: true,
            comments: false,
            schema,
            tabUid,
            autocommit
         });

         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: String(err) };
      }
   });

   // POST /api/schema/export
   app.post('/api/schema/export', async (request) => {
      const { uid, type, tables, ...rest } = request.body as any;

      if (exporter !== null) {
         exporter.terminate();
         return { status: 'error', response: 'Exporter already running, terminated' };
      }

      return new Promise((resolve) => {
         (async () => {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            exporter = new Worker(require.resolve('../workers/exporter'));

            exporter.postMessage({
               type: 'init',
               client: {
                  name: type,
                  config: await requireConnection(uid).getDbConfig()
               },
               tables,
               options: rest
            });

            exporter.on('message', (message: workers.WorkerIpcMessage) => {
               const { type, payload } = message;

               switch (type) {
                  case 'end':
                     setTimeout(() => {
                        exporter?.terminate();
                        exporter = null;
                     }, 500);
                     resolve({ status: 'success', response: payload });
                     break;
                  case 'cancel':
                     exporter?.terminate();
                     exporter = null;
                     resolve({ status: 'error', response: 'Operation cancelled' });
                     break;
                  case 'error':
                     exporter?.terminate();
                     exporter = null;
                     resolve({ status: 'error', response: payload });
                     break;
               }
            });

            exporter.on('close', code => {
               exporter = null;
               resolve({ status: 'error', response: `Operation ended with code: ${code}` });
            });
         })();
      });
   });

   // POST /api/schema/abortExport
   app.post('/api/schema/abortExport', async () => {
      let willAbort = false;

      if (exporter) {
         willAbort = true;
         exporter.postMessage({ type: 'cancel' });
      }

      return { status: 'success', response: { willAbort } };
   });

   // POST /api/schema/importSql
   app.post('/api/schema/importSql', async (request) => {
      const options = request.body as any;

      if (importer !== null) {
         importer.terminate();
         return { status: 'error', response: 'Importer already running, terminated' };
      }

      return new Promise((resolve) => {
         (async () => {
            const dbConfig = await requireConnection(options.uid).getDbConfig();

            // eslint-disable-next-line @typescript-eslint/no-var-requires
            importer = new Worker(require.resolve('../workers/importer'));

            importer.postMessage({
               type: 'init',
               dbConfig,
               options
            });

            importer.on('message', (message: workers.WorkerIpcMessage) => {
               const { type, payload } = message;

               switch (type) {
                  case 'end':
                     setTimeout(() => {
                        importer?.terminate();
                        importer = null;
                     }, 2000);
                     resolve({ status: 'success', response: payload });
                     break;
                  case 'cancel':
                     importer?.terminate();
                     importer = null;
                     resolve({ status: 'error', response: 'Operation cancelled' });
                     break;
                  case 'error':
                     importer?.terminate();
                     importer = null;
                     resolve({ status: 'error', response: payload });
                     break;
               }
            });

            importer.on('close', code => {
               importer = null;
               resolve({ status: 'error', response: `Operation ended with code: ${code}` });
            });
         })();
      });
   });

   // POST /api/schema/abortImportSql
   app.post('/api/schema/abortImportSql', async () => {
      let willAbort = false;

      if (importer) {
         willAbort = true;
         importer.postMessage({ type: 'cancel' });
      }

      return { status: 'success', response: { willAbort } };
   });

   // POST /api/schema/killTabQuery
   app.post('/api/schema/killTabQuery', async (request) => {
      const { uid, tabUid } = request.body as any;

      if (!tabUid) return;

      try {
         await requireConnection(uid).killTabQuery(tabUid);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: String(err) };
      }
   });

   // POST /api/schema/commitTab
   app.post('/api/schema/commitTab', async (request) => {
      const { uid, tabUid } = request.body as any;

      if (!tabUid) return;

      try {
         await requireConnection(uid).commitTab(tabUid);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: String(err) };
      }
   });

   // POST /api/schema/rollbackTab
   app.post('/api/schema/rollbackTab', async (request) => {
      const { uid, tabUid } = request.body as any;

      if (!tabUid) return;

      try {
         await requireConnection(uid).rollbackTab(tabUid);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: String(err) };
      }
   });

   // POST /api/schema/destroyConnectionToCommit
   app.post('/api/schema/destroyConnectionToCommit', async (request) => {
      const { uid, tabUid } = request.body as any;

      if (!tabUid) return;

      try {
         await requireConnection(uid).destroyConnectionToCommit(tabUid);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: String(err) };
      }
   });

   // WebSocket channels for export/import progress streaming
   app.register(async function wsRoutes (fastify) {
      // GET /ws/export — streams export progress from worker thread
      fastify.get('/ws/export', { websocket: true }, (socket) => {
         socket.on('message', async (rawMsg: Buffer) => {
            const msg = JSON.parse(rawMsg.toString());
            if (msg.type === 'start') {
               try {
                  const { Worker } = await import('worker_threads');
                  const workerPath = require.resolve('../workers/exporter');
                  const exportWorker = new Worker(workerPath);

                  exportWorker.postMessage({
                     type: 'init',
                     ...msg.params
                  });

                  exportWorker.on('message', (workerMsg: any) => {
                     if (socket.readyState === 1)
                        socket.send(JSON.stringify(workerMsg));
                  });

                  exportWorker.on('error', (err: Error) => {
                     if (socket.readyState === 1)
                        socket.send(JSON.stringify({ type: 'error', payload: err.message }));
                  });

                  socket.on('message', (controlMsg: Buffer) => {
                     const parsed = JSON.parse(controlMsg.toString());
                     if (parsed.type === 'abort') {
                        exportWorker.terminate();
                        if (socket.readyState === 1)
                           socket.send(JSON.stringify({ type: 'aborted' }));
                     }
                  });
               }
               catch (err) {
                  socket.send(JSON.stringify({ type: 'error', payload: (err as Error).message }));
               }
            }
         });
      });

      // GET /ws/import — streams import progress from worker thread
      fastify.get('/ws/import', { websocket: true }, (socket) => {
         socket.on('message', async (rawMsg: Buffer) => {
            const msg = JSON.parse(rawMsg.toString());
            if (msg.type === 'start') {
               try {
                  const { Worker } = await import('worker_threads');
                  const workerPath = require.resolve('../workers/importer');
                  const importWorker = new Worker(workerPath);

                  importWorker.postMessage({
                     type: 'init',
                     ...msg.params
                  });

                  importWorker.on('message', (workerMsg: any) => {
                     if (socket.readyState === 1)
                        socket.send(JSON.stringify(workerMsg));
                  });

                  importWorker.on('error', (err: Error) => {
                     if (socket.readyState === 1)
                        socket.send(JSON.stringify({ type: 'error', payload: err.message }));
                  });

                  socket.on('message', (controlMsg: Buffer) => {
                     const parsed = JSON.parse(controlMsg.toString());
                     if (parsed.type === 'abort') {
                        importWorker.terminate();
                        if (socket.readyState === 1)
                           socket.send(JSON.stringify({ type: 'aborted' }));
                     }
                  });
               }
               catch (err) {
                  socket.send(JSON.stringify({ type: 'error', payload: (err as Error).message }));
               }
            }
         });
      });
   });
}
