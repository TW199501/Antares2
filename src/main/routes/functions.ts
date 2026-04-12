import { FastifyInstance } from 'fastify';

import { requireConnection } from './connection';

export default async function functionRoutes (app: FastifyInstance) {
   // POST /api/functions/getInformations
   app.post('/api/functions/getInformations', async (request) => {
      const params = request.body as any;

      try {
         const result = await requireConnection(params.uid).getFunctionInformations(params);
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: String(err) };
      }
   });

   // POST /api/functions/drop
   app.post('/api/functions/drop', async (request) => {
      const params = request.body as any;

      try {
         await requireConnection(params.uid).dropFunction(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: String(err) };
      }
   });

   // POST /api/functions/alter
   app.post('/api/functions/alter', async (request) => {
      const params = request.body as any;

      try {
         await requireConnection(params.uid).alterFunction(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: String(err) };
      }
   });

   // POST /api/functions/alterTriggerFunction
   app.post('/api/functions/alterTriggerFunction', async (request) => {
      const params = request.body as any;

      try {
         await requireConnection(params.uid).alterTriggerFunction(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: String(err) };
      }
   });

   // POST /api/functions/create
   app.post('/api/functions/create', async (request) => {
      const params = request.body as any;

      try {
         await requireConnection(params.uid).createFunction(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: String(err) };
      }
   });

   // POST /api/functions/createTriggerFunction
   app.post('/api/functions/createTriggerFunction', async (request) => {
      const params = request.body as any;

      try {
         await requireConnection(params.uid).createTriggerFunction(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: String(err) };
      }
   });
}
