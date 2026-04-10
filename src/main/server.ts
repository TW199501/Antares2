import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import * as net from 'net';

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

start().catch((err) => {
   console.error('Server failed to start:', err);
   process.exit(1);
});
