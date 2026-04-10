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
