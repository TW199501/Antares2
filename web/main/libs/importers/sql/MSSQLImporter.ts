import * as importer from 'common/interfaces/importer';
import { querySplitter } from 'common/libs/sqlUtils';
import * as fs from 'fs/promises';

import { SQLServerClient } from '../../clients/SQLServerClient';
import { BaseImporter } from '../BaseImporter';

type ParsedBatch = {
   sql: string;
   repeat: number;
   processedBytes: number;
};

export default class MSSQLImporter extends BaseImporter {
   protected _client: SQLServerClient;

   constructor (client: SQLServerClient, options: importer.ImportOptions) {
      super(options);
      this._client = client;
   }

   async import (): Promise<void> {
      const fileContent = await fs.readFile(this._options.file, 'utf8');
      const totalFileSize = Buffer.byteLength(fileContent, 'utf8');
      const batches = this.splitByGo(fileContent);

      let queryCount = 0;

      this.emitUpdate({
         fileSize: totalFileSize,
         readPosition: 0,
         percentage: 0,
         queryCount: 0
      });

      for (const batch of batches) {
         if (this.isCancelled)
            return;

         const statements = querySplitter(batch.sql, 'mssql').filter(Boolean);

         for (const statement of statements) {
            if (this.isCancelled)
               return;

            for (let i = 0; i < batch.repeat; i++) {
               if (this.isCancelled)
                  return;

               queryCount++;

               try {
                  await this._client.raw(statement, { split: false });
               }
               catch (error) {
                  this.emit('query-error', {
                     sql: statement,
                     // eslint-disable-next-line @typescript-eslint/no-explicit-any
                     message: (error as any)?.message || String(error),
                     // eslint-disable-next-line @typescript-eslint/no-explicit-any
                     sqlSnippet: (error as any)?.sql,
                     time: new Date().getTime()
                  });
               }

               this.emitUpdate({
                  queryCount,
                  readPosition: Math.min(batch.processedBytes, totalFileSize),
                  percentage: totalFileSize > 0
                     ? Math.min(batch.processedBytes / totalFileSize * 100, 100)
                     : 0
               });
            }
         }
      }
   }

   private splitByGo (sqlText: string): ParsedBatch[] {
      const lines = sqlText.split(/\r?\n/);
      const batches: ParsedBatch[] = [];

      let current: string[] = [];
      let processedBytes = 0;

      lines.forEach((line, index) => {
         const goMatch = line.match(/^\s*GO(?:\s+(\d+))?\s*$/i);
         const lineBytes = Buffer.byteLength(index < lines.length - 1 ? `${line}\n` : line, 'utf8');
         processedBytes += lineBytes;

         if (goMatch) {
            const sql = current.join('\n').trim();
            if (sql) {
               batches.push({
                  sql,
                  repeat: Number(goMatch[1] || 1),
                  processedBytes
               });
            }
            current = [];
            return;
         }

         current.push(line);
      });

      const remainingSql = current.join('\n').trim();
      if (remainingSql) {
         batches.push({
            sql: remainingSql,
            repeat: 1,
            processedBytes: Buffer.byteLength(sqlText, 'utf8')
         });
      }

      return batches;
   }
}
