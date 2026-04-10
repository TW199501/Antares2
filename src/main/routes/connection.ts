import * as antares from 'common/interfaces/antares';
import { FastifyInstance } from 'fastify';
import * as fs from 'fs';
import { SslOptions } from 'mysql2';

import { ClientsFactory } from '../libs/ClientsFactory';

const connections: Record<string, antares.Client> = {};
const isAborting: Record<string, boolean> = {};

export function getConnections (): Record<string, antares.Client> {
   return connections;
}

export default async function connectionRoutes (app: FastifyInstance) {
   // POST /api/connection/test
   app.post('/api/connection/test', async (request) => {
      const conn = request.body as antares.ConnectionParams;

      let isLocalAborted = false;
      const abortChecker = setInterval(() => {
         if (isAborting[conn.uid]) {
            isAborting[conn.uid] = false;
            isLocalAborted = true;
            clearInterval(abortChecker);
         }
      }, 50);

      const params = {
         host: conn.host,
         port: +conn.port,
         user: conn.user,
         password: conn.password,
         readonly: conn.readonly,
         connectionString: conn.connString,
         database: '',
         schema: '',
         databasePath: '',
         ssl: undefined as SslOptions,
         ssh: undefined as {
            host: string;
            username: string;
            password: string;
            port: number;
            privateKey: string;
            passphrase: string;
            keepaliveInterval: number;
         }
      };

      if (conn.database)
         params.database = conn.database;

      if (conn.databasePath)
         params.databasePath = conn.databasePath;

      if (conn.ssl) {
         params.ssl = {
            key: conn.key ? fs.readFileSync(conn.key).toString() : null,
            cert: conn.cert ? fs.readFileSync(conn.cert).toString() : null,
            ca: conn.ca ? fs.readFileSync(conn.ca).toString() : null,
            ciphers: conn.ciphers,
            rejectUnauthorized: !conn.untrustedConnection
         };
      }

      if (conn.ssh) {
         params.ssh = {
            host: conn.sshHost,
            username: conn.sshUser,
            password: conn.sshPass,
            port: conn.sshPort ? conn.sshPort : 22,
            privateKey: conn.sshKey ? fs.readFileSync(conn.sshKey).toString() : undefined,
            passphrase: conn.sshPassphrase,
            keepaliveInterval: conn.sshKeepAliveInterval ? conn.sshKeepAliveInterval * 1000 : undefined
         };
      }

      try {
         const connection = ClientsFactory.getClient({
            uid: conn.uid,
            client: conn.client,
            params
         });

         await connection.connect();
         if (isLocalAborted) {
            connection.destroy();
            return;
         }

         await connection.ping();

         connection.destroy();
         clearInterval(abortChecker);

         return { status: 'success' };
      }
      catch (error) {
         clearInterval(abortChecker);
         if (error instanceof AggregateError)
            throw new Error(error.errors.reduce((acc: string, curr: Error) => acc + ' | ' + curr.message, ''));
         else if (!isLocalAborted)
            return { status: 'error', response: error.toString() };
         else
            return { status: 'abort', response: 'Connection aborted' };
      }
   });

   // POST /api/connection/connect
   app.post('/api/connection/connect', async (request) => {
      const conn = request.body as antares.ConnectionParams;

      let isLocalAborted = false;
      const abortChecker = setInterval(() => {
         if (isAborting[conn.uid]) {
            isAborting[conn.uid] = false;
            isLocalAborted = true;
            clearInterval(abortChecker);
         }
      }, 50);

      const params = {
         host: conn.host,
         port: +conn.port,
         user: conn.user,
         password: conn.password,
         application_name: 'Antares SQL',
         readonly: conn.readonly,
         connectionString: conn.connString,
         database: '',
         schema: '',
         databasePath: '',
         ssl: undefined as SslOptions,
         ssh: undefined as {
            host: string;
            username: string;
            password: string;
            port: number;
            privateKey: string;
            passphrase: string;
            keepaliveInterval: number;
         }
      };

      if (conn.database)
         params.database = conn.database;

      if (conn.databasePath)
         params.databasePath = conn.databasePath;

      if (conn.schema)
         params.schema = conn.schema;

      if (conn.ssl) {
         params.ssl = {
            key: conn.key ? fs.readFileSync(conn.key).toString() : null,
            cert: conn.cert ? fs.readFileSync(conn.cert).toString() : null,
            ca: conn.ca ? fs.readFileSync(conn.ca).toString() : null,
            ciphers: conn.ciphers,
            rejectUnauthorized: !conn.untrustedConnection
         };
      }

      if (conn.ssh) {
         params.ssh = {
            host: conn.sshHost,
            username: conn.sshUser,
            password: conn.sshPass,
            port: conn.sshPort ? conn.sshPort : 22,
            privateKey: conn.sshKey ? fs.readFileSync(conn.sshKey).toString() : null,
            passphrase: conn.sshPassphrase,
            keepaliveInterval: conn.sshKeepAliveInterval ? conn.sshKeepAliveInterval * 1000 : null
         };
      }

      try {
         const connection = ClientsFactory.getClient({
            uid: conn.uid,
            client: conn.client,
            params,
            poolSize: conn.singleConnectionMode ? 0 : 5
         });

         await connection.connect();
         if (isLocalAborted) {
            connection.destroy();
            return { status: 'abort', response: 'Connection aborted' };
         }

         const structure = await connection.getStructure(new Set());
         if (isLocalAborted) {
            connection.destroy();
            return { status: 'abort', response: 'Connection aborted' };
         }

         connections[conn.uid] = connection;
         clearInterval(abortChecker);

         return { status: 'success', response: structure };
      }
      catch (err) {
         clearInterval(abortChecker);

         if (!isLocalAborted)
            return { status: 'error', response: err.toString() };
         else
            return { status: 'abort', response: 'Connection aborted' };
      }
   });

   // POST /api/connection/disconnect
   app.post('/api/connection/disconnect', async (request) => {
      const { uid } = request.body as { uid: string };

      try {
         connections[uid].destroy();
         delete connections[uid];
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: err.toString() };
      }
   });

   // POST /api/connection/abort
   app.post('/api/connection/abort', async (request) => {
      const { uid } = request.body as { uid: string };
      isAborting[uid] = true;
      return { status: 'success' };
   });

   // POST /api/connection/check
   app.post('/api/connection/check', async (request) => {
      const { uid } = request.body as { uid: string };
      return { status: 'success', response: uid in connections };
   });
}
