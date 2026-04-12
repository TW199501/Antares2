import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import Fastify from 'fastify';
import * as net from 'net';

import applicationRoutes from './routes/application';
import connectionRoutes from './routes/connection';
import databaseRoutes from './routes/databases';
import functionRoutes from './routes/functions';
import routineRoutes from './routes/routines';
import schedulerRoutes from './routes/schedulers';
import schemaRoutes from './routes/schema';
import tableRoutes from './routes/tables';
import triggerRoutes from './routes/triggers';
import userRoutes from './routes/users';
import viewRoutes from './routes/views';

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

   await app.listen({ port, host: '127.0.0.1' });

   // Signal to Tauri that we're ready
   console.log(`READY:${port}`);
};

// Prevent unhandled rejections / uncaught exceptions from crashing the sidecar
process.on('uncaughtException', (err) => {
   console.error('[sidecar] Uncaught exception:', err.message);
});

process.on('unhandledRejection', (reason) => {
   console.error('[sidecar] Unhandled rejection:', reason);
});

start().catch((err) => {
   console.error('Server failed to start:', err);
   process.exit(1);
});
