import { FastifyInstance } from 'fastify';

import { requireConnection } from './connection';

export default async function schedulerRoutes (app: FastifyInstance) {
   // POST /api/schedulers/getInformations
   app.post('/api/schedulers/getInformations', async (request) => {
      const params = request.body as any;

      try {
         const result = await requireConnection(params.uid).getEventInformations(params);
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: err.toString() };
      }
   });

   // POST /api/schedulers/drop
   app.post('/api/schedulers/drop', async (request) => {
      const params = request.body as any;

      try {
         await requireConnection(params.uid).dropEvent(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: err.toString() };
      }
   });

   // POST /api/schedulers/alter
   app.post('/api/schedulers/alter', async (request) => {
      const params = request.body as any;

      try {
         await requireConnection(params.uid).alterEvent(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: err.toString() };
      }
   });

   // POST /api/schedulers/create
   app.post('/api/schedulers/create', async (request) => {
      const params = request.body as any;

      try {
         await requireConnection(params.uid).createEvent(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: err.toString() };
      }
   });

   // POST /api/schedulers/toggle
   app.post('/api/schedulers/toggle', async (request) => {
      const params = request.body as any;

      try {
         if (!params.enabled)
            await requireConnection(params.uid).enableEvent({ ...params });
         else
            await requireConnection(params.uid).disableEvent({ ...params });
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: err.toString() };
      }
   });
}
