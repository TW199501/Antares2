import * as antares from 'common/interfaces/antares';
import { FastifyInstance } from 'fastify';
import * as fs from 'fs';
import { SslOptions } from 'mysql2';

import { ClientsFactory } from '../libs/ClientsFactory';
import { safeErrorMessage } from '../libs/safeError';

const connections: Record<string, antares.Client> = {};
const isAborting: Record<string, boolean> = {};

export function getConnections (): Record<string, antares.Client> {
   return connections;
}

export function requireConnection (uid: string): antares.Client {
   const conn = connections[uid];
   if (!conn) throw new Error(`No active connection for uid "${uid}". The server may have restarted — please reconnect.`);
   return conn;
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
         ssl: undefined as unknown as SslOptions,
         ssh: undefined as unknown as {
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
            key: conn.key ? fs.readFileSync(conn.key).toString() : undefined,
            cert: conn.cert ? fs.readFileSync(conn.cert).toString() : undefined,
            ca: conn.ca ? fs.readFileSync(conn.ca).toString() : undefined,
            ciphers: conn.ciphers,
            rejectUnauthorized: !conn.untrustedConnection
         };
      }

      if (conn.ssh) {
         params.ssh = {
            host: conn.sshHost || '',
            username: conn.sshUser || '',
            password: conn.sshPass || '',
            port: conn.sshPort || 22,
            privateKey: conn.sshKey ? fs.readFileSync(conn.sshKey).toString() : '',
            passphrase: conn.sshPassphrase || '',
            keepaliveInterval: conn.sshKeepAliveInterval ? conn.sshKeepAliveInterval * 1000 : 0
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
            return { status: 'error', response: safeErrorMessage(error) };
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
         ssl: undefined as unknown as SslOptions,
         ssh: undefined as unknown as {
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
            key: conn.key ? fs.readFileSync(conn.key).toString() : undefined,
            cert: conn.cert ? fs.readFileSync(conn.cert).toString() : undefined,
            ca: conn.ca ? fs.readFileSync(conn.ca).toString() : undefined,
            ciphers: conn.ciphers,
            rejectUnauthorized: !conn.untrustedConnection
         };
      }

      if (conn.ssh) {
         params.ssh = {
            host: conn.sshHost || '',
            username: conn.sshUser || '',
            password: conn.sshPass || '',
            port: conn.sshPort || 22,
            privateKey: conn.sshKey ? fs.readFileSync(conn.sshKey).toString() : '',
            passphrase: conn.sshPassphrase || '',
            keepaliveInterval: conn.sshKeepAliveInterval ? conn.sshKeepAliveInterval * 1000 : 0
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

         // Store connection BEFORE getStructure so subsequent calls can find it
         connections[conn.uid] = connection;
         clearInterval(abortChecker);

         let structure: unknown[];
         try {
            structure = await connection.getStructure(new Set());
         }
         catch (structErr) {
            console.error('[connect] getStructure failed:', String(structErr));
            structure = [];
         }

         return { status: 'success', response: structure };
      }
      catch (err) {
         clearInterval(abortChecker);

         if (!isLocalAborted)
            return { status: 'error', response: safeErrorMessage(err) };
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
         return { status: 'error', response: safeErrorMessage(err) };
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
