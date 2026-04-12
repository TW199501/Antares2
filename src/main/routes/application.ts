import { FastifyInstance } from 'fastify';
import * as fs from 'fs';

export default async function applicationRoutes (app: FastifyInstance) {
   // POST /api/app/readFile
   app.post('/api/app/readFile', async (request) => {
      const { filePath, encoding } = request.body as any;

      try {
         const content = fs.readFileSync(filePath, encoding);
         return content;
      }
      catch (error) {
         return { status: 'error', response: String(error) };
      }
   });

   // POST /api/app/writeFile
   app.post('/api/app/writeFile', async (request) => {
      const { filePath, content } = request.body as any;

      try {
         fs.writeFileSync(filePath, content, 'utf-8');
         return { status: 'success' };
      }
      catch (error) {
         return { status: 'error', response: String(error) };
      }
   });
}
