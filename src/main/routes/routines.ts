import { FastifyInstance } from 'fastify';

import { requireConnection } from './connection';

export default async function routineRoutes (app: FastifyInstance) {
   // POST /api/routines/getInformations
   app.post('/api/routines/getInformations', async (request) => {
      const params = request.body as any;

      try {
         const result = await requireConnection(params.uid).getRoutineInformations(params);
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: err.toString() };
      }
   });

   // POST /api/routines/drop
   app.post('/api/routines/drop', async (request) => {
      const params = request.body as any;

      try {
         await requireConnection(params.uid).dropRoutine(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: err.toString() };
      }
   });

   // POST /api/routines/alter
   app.post('/api/routines/alter', async (request) => {
      const params = request.body as any;

      try {
         await requireConnection(params.uid).alterRoutine(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: err.toString() };
      }
   });

   // POST /api/routines/create
   app.post('/api/routines/create', async (request) => {
      const params = request.body as any;

      try {
         await requireConnection(params.uid).createRoutine(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: err.toString() };
      }
   });
}
