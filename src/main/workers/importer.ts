import SSHConfig from '@fabio286/ssh2-promise/lib/sshConfig';
import * as antares from 'common/interfaces/antares';
import { ImportOptions } from 'common/interfaces/importer';
import * as mysql from 'mysql2';
import * as pg from 'pg';
import { parentPort } from 'worker_threads';

import { MySQLClient } from '../libs/clients/MySQLClient';
import { PostgreSQLClient } from '../libs/clients/PostgreSQLClient';
import { SQLServerClient } from '../libs/clients/SQLServerClient';
import { ClientsFactory } from '../libs/ClientsFactory';
import MSSQLImporter from '../libs/importers/sql/MSSQLImporter';
import MySQLImporter from '../libs/importers/sql/MySQLlImporter';
import PostgreSQLImporter from '../libs/importers/sql/PostgreSQLImporter';

let importer: antares.Importer | null = null;
let cleanupClient: (() => Promise<void> | void) | null = null;

const cleanup = async () => {
   if (!cleanupClient)
      return;

   try {
      await cleanupClient();
   }
   catch (_) {
      // Ignore cleanup errors
   }
   finally {
      cleanupClient = null;
   }
};

const importHandler = async (data: {
   type: string;
   dbConfig:
      | mysql.ConnectionOptions & { schema: string; ssl?: mysql.SslOptions; ssh?: SSHConfig; readonly: boolean }
      | pg.ClientConfig & { schema: string; ssl?: mysql.SslOptions; ssh?: SSHConfig; readonly: boolean }
      | { databasePath: string; readonly: boolean }
      | Record<string, unknown>;
   options: ImportOptions;
}) => {
   const { type, dbConfig, options } = data;

   if (type === 'init') {
      try {
         switch (options.type) {
            case 'mysql':
            case 'maria': {
               const connection = await ClientsFactory.getClient({
                  client: options.type,
                  params: {
                     ...dbConfig,
                     schema: options.schema
                  } as any,
                  poolSize: 1
               }) as MySQLClient;

               const pool = await connection.getConnectionPool();
               cleanupClient = async () => {
                  await pool.end();
               };
               importer = new MySQLImporter(pool, options);
               break;
            }
            case 'pg': {
               const connection = await ClientsFactory.getClient({
                  client: options.type,
                  params: {
                     ...dbConfig,
                     schema: options.schema
                  } as any,
                  poolSize: 1
               }) as PostgreSQLClient;

               const pool = await connection.getConnectionPool();
               cleanupClient = async () => {
                  await pool.end();
               };
               importer = new PostgreSQLImporter(pool as unknown as pg.PoolClient, options);
               break;
            }
            case 'mssql': {
               const connection = await ClientsFactory.getClient({
                  client: options.type,
                  params: {
                     ...dbConfig,
                     schema: options.schema
                  } as any,
                  poolSize: 1
               }) as SQLServerClient;

               await connection.connect();
               cleanupClient = () => {
                  connection.destroy();
               };
               importer = new MSSQLImporter(connection, options);
               break;
            }
            default:
               parentPort?.postMessage({
                  type: 'error',
                  payload: `"${options.type}" importer not available`
               });
               return;
         }

         importer.once('error', async (err: Error) => {
            await cleanup();
            parentPort?.postMessage({
               type: 'error',
               payload: err.toString()
            });
         });

         importer.once('end', async () => {
            await cleanup();
            parentPort?.postMessage({
               type: 'end',
               payload: { cancelled: importer?.isCancelled }
            });
         });

         importer.once('cancel', async () => {
            await cleanup();
            parentPort?.postMessage({ type: 'cancel' });
         });

         importer.on('progress', (state: unknown) => {
            parentPort?.postMessage({
               type: 'import-progress',
               payload: state
            });
         });

         importer.on('query-error', (state: unknown) => {
            parentPort?.postMessage({
               type: 'query-error',
               payload: state
            });
         });

         await importer.run();
      }
      catch (err) {
         await cleanup();
         parentPort?.postMessage({
            type: 'error',
            payload: (err as Error).toString()
         });
      }
   }
   else if (type === 'cancel' && importer)
      importer.cancel();
};

parentPort?.on('message', importHandler);
