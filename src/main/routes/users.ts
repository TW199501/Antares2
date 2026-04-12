import { FastifyInstance } from 'fastify';

import { getConnections } from './connection';

export default async function userRoutes (app: FastifyInstance) {
   // POST /api/users/getUsers
   app.post('/api/users/getUsers', async (request) => {
      const connections = getConnections();
      const { uid } = request.body as any;

      try {
         const result = await connections[uid].getUsers();
         return { status: 'success', response: result };
      }
      catch (err) {
         if ((err as any).code === 'ER_TABLEACCESS_DENIED_ERROR')
            return { status: 'success', response: [] };
         return { status: 'error', response: String(err) };
      }
   });
}
