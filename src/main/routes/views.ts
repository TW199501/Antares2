import { FastifyInstance } from 'fastify';

import { getConnections } from './connection';

export default async function viewRoutes (app: FastifyInstance) {
   // POST /api/views/getInformations
   app.post('/api/views/getInformations', async (request) => {
      const connections = getConnections();
      const params = request.body as any;

      try {
         const result = await connections[params.uid].getViewInformations(params);
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: err.toString() };
      }
   });

   // POST /api/views/drop
   app.post('/api/views/drop', async (request) => {
      const connections = getConnections();
      const params = request.body as any;

      try {
         await connections[params.uid].dropView(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: err.toString() };
      }
   });

   // POST /api/views/alter
   app.post('/api/views/alter', async (request) => {
      const connections = getConnections();
      const params = request.body as any;

      try {
         await connections[params.uid].alterView(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: err.toString() };
      }
   });

   // POST /api/views/create
   app.post('/api/views/create', async (request) => {
      const connections = getConnections();
      const params = request.body as any;

      try {
         await connections[params.uid].createView(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: err.toString() };
      }
   });

   // POST /api/views/getMaterializedInformations
   app.post('/api/views/getMaterializedInformations', async (request) => {
      const connections = getConnections();
      const params = request.body as any;

      try {
         const result = await connections[params.uid].getMaterializedViewInformations(params);
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: err.toString() };
      }
   });

   // POST /api/views/dropMaterialized
   app.post('/api/views/dropMaterialized', async (request) => {
      const connections = getConnections();
      const params = request.body as any;

      try {
         await connections[params.uid].dropMaterializedView(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: err.toString() };
      }
   });

   // POST /api/views/alterMaterialized
   app.post('/api/views/alterMaterialized', async (request) => {
      const connections = getConnections();
      const params = request.body as any;

      try {
         await connections[params.uid].alterView(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: err.toString() };
      }
   });

   // POST /api/views/createMaterialized
   app.post('/api/views/createMaterialized', async (request) => {
      const connections = getConnections();
      const params = request.body as any;

      try {
         await connections[params.uid].createMaterializedView(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: err.toString() };
      }
   });
}
