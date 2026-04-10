import { FastifyInstance } from 'fastify';

import { getConnections } from './connection';

export default async function schedulerRoutes (app: FastifyInstance) {
   // POST /api/schedulers/getInformations
   app.post('/api/schedulers/getInformations', async (request) => {
      const connections = getConnections();
      const params = request.body as any;

      try {
         const result = await connections[params.uid].getEventInformations(params);
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: err.toString() };
      }
   });

   // POST /api/schedulers/drop
   app.post('/api/schedulers/drop', async (request) => {
      const connections = getConnections();
      const params = request.body as any;

      try {
         await connections[params.uid].dropEvent(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: err.toString() };
      }
   });

   // POST /api/schedulers/alter
   app.post('/api/schedulers/alter', async (request) => {
      const connections = getConnections();
      const params = request.body as any;

      try {
         await connections[params.uid].alterEvent(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: err.toString() };
      }
   });

   // POST /api/schedulers/create
   app.post('/api/schedulers/create', async (request) => {
      const connections = getConnections();
      const params = request.body as any;

      try {
         await connections[params.uid].createEvent(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: err.toString() };
      }
   });

   // POST /api/schedulers/toggle
   app.post('/api/schedulers/toggle', async (request) => {
      const connections = getConnections();
      const params = request.body as any;

      try {
         if (!params.enabled)
            await connections[params.uid].enableEvent({ ...params });
         else
            await connections[params.uid].disableEvent({ ...params });
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: err.toString() };
      }
   });
}
