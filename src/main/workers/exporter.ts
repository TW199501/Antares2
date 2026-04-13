import * as antares from 'common/interfaces/antares';
import * as fs from 'fs';
import { parentPort } from 'worker_threads';

import { MySQLClient } from '../libs/clients/MySQLClient';
import { PostgreSQLClient } from '../libs/clients/PostgreSQLClient';
import { SQLServerClient } from '../libs/clients/SQLServerClient';
import { ClientsFactory } from '../libs/ClientsFactory';
import MSSQLExporter from '../libs/exporters/sql/MSSQLExporter';
import MysqlExporter from '../libs/exporters/sql/MysqlExporter';
import PostgreSQLExporter from '../libs/exporters/sql/PostgreSQLExporter';

let exporter: antares.Exporter | null = null;
let activeClient: antares.Client | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const exportHandler = async (data: any) => {
   const { type, client, tables, options } = data;

   if (type === 'init') {
      try {
         const connection = await ClientsFactory.getClient({
            client: client.name,
            params: client.config,
            poolSize: 5
         }) as MySQLClient | PostgreSQLClient | SQLServerClient;

         activeClient = connection;
         await connection.connect();

         switch (client.name) {
            case 'mysql':
            case 'maria':
               exporter = new MysqlExporter(connection as MySQLClient, tables, options);
               break;
            case 'pg':
               exporter = new PostgreSQLExporter(connection as PostgreSQLClient, tables, options);
               break;
            case 'mssql':
               exporter = new MSSQLExporter(connection as SQLServerClient, tables, options);
               break;
            default:
               parentPort?.postMessage({
                  type: 'error',
                  payload: `"${client.name}" exporter not available`
               });
               return;
         }

         exporter.once('error', (err: Error) => {
            parentPort?.postMessage({
               type: 'error',
               payload: err.toString()
            });
         });

         exporter.once('end', () => {
            activeClient?.destroy();
            activeClient = null;
            parentPort?.postMessage({
               type: 'end',
               payload: { cancelled: exporter?.isCancelled }
            });
         });

         exporter.once('cancel', () => {
            if (exporter?.outputFileExists()) {
               try {
                  fs.unlinkSync(exporter.outputFile);
               }
               catch (_) {
                  // Ignore cleanup errors on cancel
               }
            }
            activeClient?.destroy();
            activeClient = null;
            parentPort?.postMessage({ type: 'cancel' });
         });

         exporter.on('progress', (state: unknown) => {
            parentPort?.postMessage({
               type: 'export-progress',
               payload: state
            });
         });

         await exporter.run();
      }
      catch (err) {
         activeClient?.destroy();
         activeClient = null;
         parentPort?.postMessage({
            type: 'error',
            payload: (err as Error).toString()
         });
      }
   }
   else if (type === 'cancel' && exporter)
      exporter.cancel();
};

parentPort?.on('message', exportHandler);
