import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { randomBytes } from 'crypto';
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

const SIDECAR_TOKEN = randomBytes(32).toString('hex');

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

   await app.register(cors, {
      origin: ['tauri://localhost', 'http://tauri.localhost', 'http://localhost:5173'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
   });
   await app.register(websocket);

   // Validate secret token on every request except /health
   app.addHook('preHandler', async (request, reply) => {
      if (request.url === '/health') return;

      const isWs = request.headers.upgrade === 'websocket';
      const token = isWs
         ? (request.query as Record<string, string>).token
         : request.headers['x-sidecar-token'] as string;

      if (token !== SIDECAR_TOKEN)
         await reply.code(403).send({ status: 'error', response: 'Forbidden' });
   });

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

   // Signal to Tauri: READY:<port>:<token>
   console.log(`READY:${port}:${SIDECAR_TOKEN}`);
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
