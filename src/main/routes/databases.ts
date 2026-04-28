import { FastifyInstance } from 'fastify';

import { safeErrorMessage } from '../libs/safeError';
import { getConnections } from './connection';

export default async function databaseRoutes (app: FastifyInstance) {
   // POST /api/databases/getDatabases
   app.post('/api/databases/getDatabases', async (request) => {
      const connections = getConnections();
      const { uid } = request.body as any;

      try {
         const result = await connections[uid].getDatabases();
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: safeErrorMessage(err) };
      }
   });

   // POST /api/databases/getDatabaseComment
   app.post('/api/databases/getDatabaseComment', async (request) => {
      const connections = getConnections();
      const { uid } = request.body as any;

      try {
         const result = await connections[uid].getDatabaseComment();
         return { status: 'success', response: result };
      }
      catch (_err) {
         return { status: 'error', response: '' };
      }
   });
}
