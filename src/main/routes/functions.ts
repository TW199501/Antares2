import { FastifyInstance } from 'fastify';

import { getConnections } from './connection';

export default async function functionRoutes (app: FastifyInstance) {
   // POST /api/functions/getInformations
   app.post('/api/functions/getInformations', async (request) => {
      const connections = getConnections();
      const params = request.body as any;

      try {
         const result = await connections[params.uid].getFunctionInformations(params);
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: err.toString() };
      }
   });

   // POST /api/functions/drop
   app.post('/api/functions/drop', async (request) => {
      const connections = getConnections();
      const params = request.body as any;

      try {
         await connections[params.uid].dropFunction(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: err.toString() };
      }
   });

   // POST /api/functions/alter
   app.post('/api/functions/alter', async (request) => {
      const connections = getConnections();
      const params = request.body as any;

      try {
         await connections[params.uid].alterFunction(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: err.toString() };
      }
   });

   // POST /api/functions/alterTriggerFunction
   app.post('/api/functions/alterTriggerFunction', async (request) => {
      const connections = getConnections();
      const params = request.body as any;

      try {
         await connections[params.uid].alterTriggerFunction(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: err.toString() };
      }
   });

   // POST /api/functions/create
   app.post('/api/functions/create', async (request) => {
      const connections = getConnections();
      const params = request.body as any;

      try {
         await connections[params.uid].createFunction(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: err.toString() };
      }
   });

   // POST /api/functions/createTriggerFunction
   app.post('/api/functions/createTriggerFunction', async (request) => {
      const connections = getConnections();
      const params = request.body as any;

      try {
         await connections[params.uid].createTriggerFunction(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: err.toString() };
      }
   });
}
