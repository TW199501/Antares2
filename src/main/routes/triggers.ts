import { FastifyInstance } from 'fastify';

import { safeErrorMessage } from '../libs/safeError';
import { requireConnection } from './connection';

export default async function triggerRoutes (app: FastifyInstance) {
   // POST /api/triggers/getInformations
   app.post('/api/triggers/getInformations', async (request) => {
      const params = request.body as any;

      try {
         const result = await requireConnection(params.uid).getTriggerInformations(params);
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: safeErrorMessage(err) };
      }
   });

   // POST /api/triggers/drop
   app.post('/api/triggers/drop', async (request) => {
      const params = request.body as any;

      try {
         await requireConnection(params.uid).dropTrigger(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: safeErrorMessage(err) };
      }
   });

   // POST /api/triggers/alter
   app.post('/api/triggers/alter', async (request) => {
      const params = request.body as any;

      try {
         await requireConnection(params.uid).alterTrigger(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: safeErrorMessage(err) };
      }
   });

   // POST /api/triggers/create
   app.post('/api/triggers/create', async (request) => {
      const params = request.body as any;

      try {
         await requireConnection(params.uid).createTrigger(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: safeErrorMessage(err) };
      }
   });

   // POST /api/triggers/toggle
   app.post('/api/triggers/toggle', async (request) => {
      const params = request.body as any;

      try {
         if (!params.enabled)
            await requireConnection(params.uid).enableTrigger(params);
         else
            await requireConnection(params.uid).disableTrigger(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: safeErrorMessage(err) };
      }
   });
}
