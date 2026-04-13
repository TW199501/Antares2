import customizations from 'common/customizations';
import { ARRAY, BIT, BLOB, BOOLEAN, DATE, DATETIME, FLOAT, LONG_TEXT, NUMBER, TEXT, TEXT_SEARCH } from 'common/fieldTypes';
import { InsertRowsParams } from 'common/interfaces/tableApis';
import { fakerCustom } from 'common/libs/fakerCustom';
import { formatJsonForSqlWhere, sqlEscaper } from 'common/libs/sqlUtils';
import { FastifyInstance } from 'fastify';
import * as fs from 'fs';
import moment from 'moment';
import * as path from 'path';

import { safeErrorMessage } from '../libs/safeError';
import { getConnections } from './connection';

function assertSafeFilePath (filePath: string): void {
   const resolved = path.resolve(filePath);
   const stat = fs.statSync(resolved);
   if (!stat.isFile())
      throw new Error(`Path is not a regular file: ${resolved}`);
}

function requireConnection (uid: string) {
   const conn = getConnections()[uid];
   if (!conn) throw new Error(`No active connection for uid "${uid}". The server may have restarted ??please reconnect.`);
   return conn;
}

function getAffectedRows (result: unknown): number {
   if (!result || typeof result !== 'object')
      return 0;

   const report = (result as { report?: { affectedRows?: number } }).report;
   return report && typeof report.affectedRows === 'number'
      ? report.affectedRows
      : 0;
}

export default async function tableRoutes (app: FastifyInstance) {
   // POST /api/tables/getColumns
   app.post('/api/tables/getColumns', async (request) => {
      const params = request.body as any;

      try {
         const result = await requireConnection(params.uid).getTableColumns(params);
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: safeErrorMessage(err) };
      }
   });

   // POST /api/tables/getData
   app.post('/api/tables/getData', async (request) => {
      const { uid, schema, table, limit, page, sortParams, where } = request.body as any;

      try {
         const offset = (page - 1) * limit;
         const query = requireConnection(uid)
            .select('*')
            .schema(schema)
            .from(table)
            .limit(limit)
            .offset(offset);

         if (sortParams && sortParams.field && sortParams.dir)
            query.orderBy({ [sortParams.field]: sortParams.dir.toUpperCase() });

         if (where)
            query.where(where);

         const result = await query.run({ details: true, schema });

         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: safeErrorMessage(err) };
      }
   });

   // POST /api/tables/getCount
   app.post('/api/tables/getCount', async (request) => {
      const params = request.body as any;

      try {
         const result = await requireConnection(params.uid).getTableApproximateCount(params);
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: safeErrorMessage(err) };
      }
   });

   // POST /api/tables/getOptions
   app.post('/api/tables/getOptions', async (request) => {
      const params = request.body as any;

      try {
         const result = await requireConnection(params.uid).getTableOptions(params);
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: safeErrorMessage(err) };
      }
   });

   // POST /api/tables/getIndexes
   app.post('/api/tables/getIndexes', async (request) => {
      const params = request.body as any;

      try {
         const result = await requireConnection(params.uid).getTableIndexes(params);
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: safeErrorMessage(err) };
      }
   });

   // POST /api/tables/getChecks
   app.post('/api/tables/getChecks', async (request) => {
      const params = request.body as any;

      try {
         const result = await requireConnection(params.uid).getTableChecks(params);
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: safeErrorMessage(err) };
      }
   });

   // POST /api/tables/getDdl
   app.post('/api/tables/getDdl', async (request) => {
      const params = request.body as any;

      try {
         const result = await requireConnection(params.uid).getTableDll(params);
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: safeErrorMessage(err) };
      }
   });

   // POST /api/tables/getKeyUsage
   app.post('/api/tables/getKeyUsage', async (request) => {
      const params = request.body as any;

      try {
         const result = await requireConnection(params.uid).getKeyUsage(params);
         return { status: 'success', response: result };
      }
      catch (err) {
         return { status: 'error', response: safeErrorMessage(err) };
      }
   });

   // POST /api/tables/updateCell
   app.post('/api/tables/updateCell', async (request) => {
      const params = request.body as any;

      delete params.row._antares_id;
      const { stringsWrapper: sw } = (customizations as any)[requireConnection(params.uid)._client];

      try {
         let escapedParam;
         let reload = false;
         const escapeStrVal = (val: string) => requireConnection(params.uid)._client === 'mssql'
            ? val.replaceAll('\'', '\'\'')
            : sqlEscaper(val);
         const id = typeof params.id === 'number' ? params.id : `${sw}${escapeStrVal(params.id)}${sw}`;

         if ([...NUMBER, ...FLOAT].includes(params.type)) {
            const numVal = Number(params.content);
            escapedParam = isFinite(numVal) ? numVal : 'NULL';
         }
         else if ([...TEXT, ...LONG_TEXT].includes(params.type)) {
            switch (requireConnection(params.uid)._client) {
               case 'mysql':
               case 'maria':
                  escapedParam = `"${sqlEscaper(params.content)}"`;
                  break;
               case 'pg':
               case 'sqlite':
               case 'firebird':
               case 'mssql':
                  escapedParam = `'${params.content.replaceAll('\'', '\'\'')}'`;
                  break;
            }
         }
         else if (ARRAY.includes(params.type))
            escapedParam = `'${params.content}'`;
         else if (TEXT_SEARCH.includes(params.type))
            escapedParam = `'${params.content.replaceAll('\'', '\'\'')}'`;
         else if (BLOB.includes(params.type)) {
            if (params.content) {
               let fileBlob;

               assertSafeFilePath(params.content);
               switch (requireConnection(params.uid)._client) {
                  case 'mysql':
                  case 'maria':
                  case 'mssql':
                     fileBlob = fs.readFileSync(params.content);
                     escapedParam = `0x${fileBlob.toString('hex')}`;
                     break;
                  case 'pg':
                  case 'firebird':
                     fileBlob = fs.readFileSync(params.content);
                     escapedParam = `decode('${fileBlob.toString('hex')}', 'hex')`;
                     break;
                  case 'sqlite':
                     fileBlob = fs.readFileSync(params.content);
                     escapedParam = `X'${fileBlob.toString('hex')}'`;
                     break;
               }
               reload = true;
            }
            else {
               switch (requireConnection(params.uid)._client) {
                  case 'mysql':
                  case 'maria':
                     escapedParam = '\'\'';
                     break;
                  case 'mssql':
                     escapedParam = '0x';
                     break;
                  case 'pg':
                  case 'firebird':
                     escapedParam = 'decode(\'\', \'hex\')';
                     break;
                  case 'sqlite':
                     escapedParam = 'X\'\'';
                     break;
               }
            }
         }
         else if (BIT.includes(params.type)) {
            switch (requireConnection(params.uid)._client) {
               case 'mssql':
                  escapedParam = params.content === 'true' || params.content === '1' ? '1' : '0';
                  break;
               default:
                  escapedParam = `b'${sqlEscaper(params.content)}'`;
                  break;
            }
            reload = true;
         }
         else if (BOOLEAN.includes(params.type)) {
            switch (requireConnection(params.uid)._client) {
               case 'mysql':
               case 'maria':
               case 'pg':
               case 'firebird':
                  escapedParam = params.content;
                  break;
               case 'mssql':
                  escapedParam = params.content === 'true' || params.content === '1' ? '1' : '0';
                  break;
               case 'sqlite':
                  escapedParam = Number(params.content === 'true');
                  break;
            }
         }
         else if (params.content === null)
            escapedParam = 'NULL';
         else
            escapedParam = `'${escapeStrVal(params.content)}'`;

         if (params.primary) {
            const result = await requireConnection(params.uid)
               .update({ [params.field]: `= ${escapedParam}` })
               .schema(params.schema)
               .from(params.table)
               .where({ [params.primary]: `= ${id}` })
               .limit(1)
               .run();

            if (getAffectedRows(result) > 1)
               throw new Error('Unsafe update blocked: expected at most 1 affected row.');
         }
         else {
            const { orgRow } = params;
            if (!orgRow || !Object.keys(orgRow).length)
               throw new Error('Unsafe update blocked: missing WHERE condition.');

            delete orgRow._antares_id;

            reload = true;

            for (const key in orgRow) {
               if (typeof orgRow[key] === 'string')
                  orgRow[key] = ` = '${escapeStrVal(orgRow[key])}'`;
               else if (typeof orgRow[key] === 'object' && orgRow[key] !== null)
                  orgRow[key] = formatJsonForSqlWhere(orgRow[key], requireConnection(params.uid)._client);
               else if (orgRow[key] === null)
                  orgRow[key] = `IS ${orgRow[key]}`;
               else
                  orgRow[key] = `= ${orgRow[key]}`;
            }

            const result = await requireConnection(params.uid)
               .schema(params.schema)
               .update({ [params.field]: `= ${escapedParam}` })
               .from(params.table)
               .where(orgRow)
               .limit(1)
               .run();

            if (getAffectedRows(result) > 1)
               throw new Error('Unsafe update blocked: expected at most 1 affected row.');
         }

         return { status: 'success', response: { reload } };
      }
      catch (err) {
         return { status: 'error', response: safeErrorMessage(err) };
      }
   });

   // POST /api/tables/deleteRows
   app.post('/api/tables/deleteRows', async (request) => {
      const params = request.body as any;

      if (params.primary) {
         const escapeForDelete = (val: string) => requireConnection(params.uid)._client === 'mssql'
            ? val.replaceAll('\'', '\'\'')
            : sqlEscaper(val);

         const idString = params.rows.map((row: Record<string, any>) => {
            const fieldName = Object.keys(row)[0].includes('.') ? `${params.table}.${params.primary}` : params.primary;

            return typeof row[fieldName] === 'string'
               ? `'${escapeForDelete(row[fieldName])}'`
               : row[fieldName];
         }).join(',');

         try {
            const result: unknown = await requireConnection(params.uid)
               .schema(params.schema)
               .delete(params.table)
               .where({ [params.primary]: `IN (${idString})` })
               .limit(params.rows.length)
               .run();

            if (getAffectedRows(result) > params.rows.length)
               throw new Error('Unsafe delete blocked: affected rows exceed expected target size.');

            return { status: 'success', response: result };
         }
         catch (err) {
            return { status: 'error', response: safeErrorMessage(err) };
         }
      }
      else {
         try {
            for (const row of params.rows) {
               if (!Object.keys(row).length)
                  throw new Error('Unsafe delete blocked: missing WHERE condition.');

               for (const key in row) {
                  if (typeof row[key] === 'string')
                     row[key] = `'${sqlEscaper(row[key])}'`;

                  if (row[key] === null)
                     row[key] = 'IS NULL';
                  else
                     row[key] = `= ${row[key]}`;
               }

               const result = await requireConnection(params.uid)
                  .schema(params.schema)
                  .delete(params.table)
                  .where(row)
                  .limit(1)
                  .run();

               if (getAffectedRows(result) > 1)
                  throw new Error('Unsafe delete blocked: expected at most 1 affected row.');
            }

            return { status: 'success', response: [] };
         }
         catch (err) {
            return { status: 'error', response: safeErrorMessage(err) };
         }
      }
   });

   // POST /api/tables/insertFakeRows
   app.post('/api/tables/insertFakeRows', async (request) => {
      const params = request.body as any as InsertRowsParams;

      try {
         const rows: Record<string, string | number | boolean | Date | Buffer>[] = [];

         for (let i = 0; i < +params.repeat; i++) {
            const insertObj: Record<string, string | number | boolean | Date | Buffer> = {};

            for (const key in params.row) {
               const type = params.fields[key];
               let escapedParam;

               if (!('group' in params.row[key]) || params.row[key].group === 'manual') {
                  if (params.row[key].value === null || params.row[key].value === undefined)
                     escapedParam = 'NULL';
                  else if ([...NUMBER, ...FLOAT].includes(type)) {
                     const numVal = Number(params.row[key].value);
                     escapedParam = isFinite(numVal) ? numVal : 'NULL';
                  }
                  else if ([...TEXT, ...LONG_TEXT].includes(type)) {
                     switch (requireConnection(params.uid)._client) {
                        case 'mysql':
                        case 'maria':
                           escapedParam = `"${sqlEscaper(params.row[key].value)}"`;
                           break;
                        case 'pg':
                        case 'sqlite':
                        case 'firebird':
                        case 'mssql':
                           escapedParam = `'${params.row[key].value.replaceAll('\'', '\'\'')}'`;
                           break;
                     }
                  }
                  else if (BLOB.includes(type)) {
                     if (params.row[key].value) {
                        let fileBlob;

                        assertSafeFilePath(params.row[key].value);
                        switch (requireConnection(params.uid)._client) {
                           case 'mysql':
                           case 'maria':
                           case 'mssql':
                              fileBlob = fs.readFileSync(params.row[key].value);
                              escapedParam = `0x${fileBlob.toString('hex')}`;
                              break;
                           case 'pg':
                              fileBlob = fs.readFileSync(params.row[key].value);
                              escapedParam = `decode('${fileBlob.toString('hex')}', 'hex')`;
                              break;
                        }
                     }
                     else {
                        switch (requireConnection(params.uid)._client) {
                           case 'mysql':
                           case 'maria':
                              escapedParam = '""';
                              break;
                           case 'mssql':
                              escapedParam = '0x';
                              break;
                           case 'pg':
                              escapedParam = 'decode(\'\', \'hex\')';
                              break;
                        }
                     }
                  }
                  else if (BIT.includes(type)) {
                     escapedParam = requireConnection(params.uid)._client === 'mssql'
                        ? (params.row[key].value === 'true' || params.row[key].value === '1' ? '1' : '0')
                        : `b'${sqlEscaper(params.row[key].value)}'`;
                  }
                  else {
                     escapedParam = requireConnection(params.uid)._client === 'mssql'
                        ? `'${params.row[key].value.replaceAll('\'', '\'\'')}'`
                        : `'${sqlEscaper(params.row[key].value)}'`;
                  }

                  insertObj[key] = escapedParam ?? '';
               }
               else {
                  const parsedParams: Record<string, string | number | boolean | Date | Buffer> = {};
                  let fakeValue;

                  if (params.locale)
                     fakerCustom.locale = params.locale;

                  if (Object.keys(params.row[key].params).length) {
                     Object.keys(params.row[key].params).forEach(param => {
                        if (!isNaN(params.row[key].params[param]))
                           parsedParams[param] = Number(params.row[key].params[param]);
                     });
                     fakeValue = (fakerCustom as any)[params.row[key].group][params.row[key].method](parsedParams);
                  }
                  else
                     fakeValue = (fakerCustom as any)[params.row[key].group][params.row[key].method]();

                  if (typeof fakeValue === 'string') {
                     if (params.row[key].length)
                        fakeValue = fakeValue.substring(0, params.row[key].length);

                     switch (requireConnection(params.uid)._client) {
                        case 'mysql':
                        case 'maria':
                           fakeValue = `'${sqlEscaper(fakeValue)}'`;
                           break;
                        case 'pg':
                        case 'sqlite':
                        case 'firebird':
                        case 'mssql':
                           fakeValue = `'${fakeValue.replaceAll('\'', '\'\'')}'`;
                           break;
                     }
                  }
                  else if ([...DATE, ...DATETIME].includes(type))
                     fakeValue = `'${moment(fakeValue).format('YYYY-MM-DD HH:mm:ss.SSSSSS')}'`;

                  insertObj[key] = fakeValue;
               }
            }

            rows.push(insertObj);
         }

         await requireConnection(params.uid)
            .schema(params.schema)
            .into(params.table)
            .insert(rows)
            .run();

         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: safeErrorMessage(err) };
      }
   });

   // POST /api/tables/getForeignList
   app.post('/api/tables/getForeignList', async (request) => {
      const { uid, schema, table, column, description } = request.body as any;

      const safeIdentifier = (val: string) => /^[\w.]+$/.test(val);
      if (!safeIdentifier(column) || (description && !safeIdentifier(description)))
         return { status: 'error', response: 'Invalid column identifier' };

      const { elementsWrapper: ew, elementsWrapperEnd: ewEnd = ew } = (customizations as any)[requireConnection(uid)._client];

      try {
         const query = requireConnection(uid)
            .select(`${ew}${column}${ewEnd} AS foreign_column`)
            .schema(schema)
            .from(table)
            .orderBy('foreign_column ASC');

         if (description)
            query.select(`LEFT(${ew}${description}${ewEnd}, 20) AS foreign_description`);

         const results = await query.run() as { rows: Record<string, string>[] };

         const parsedResults: Record<string, string>[] = [];

         for (const row of results.rows) {
            const remappedRow: Record<string, string> = {};

            for (const key in row)
               remappedRow[key.toLowerCase()] = row[key];

            parsedResults.push(remappedRow);
         }

         results.rows = parsedResults;

         return { status: 'success', response: results };
      }
      catch (err) {
         return { status: 'error', response: safeErrorMessage(err) };
      }
   });

   // POST /api/tables/create
   app.post('/api/tables/create', async (request) => {
      const params = request.body as any;

      try {
         await requireConnection(params.uid).createTable(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: safeErrorMessage(err) };
      }
   });

   // POST /api/tables/alter
   app.post('/api/tables/alter', async (request) => {
      const params = request.body as any;

      try {
         await requireConnection(params.uid).alterTable(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: safeErrorMessage(err) };
      }
   });

   // POST /api/tables/duplicate
   app.post('/api/tables/duplicate', async (request) => {
      const params = request.body as any;

      try {
         await requireConnection(params.uid).duplicateTable(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: safeErrorMessage(err) };
      }
   });

   // POST /api/tables/truncate
   app.post('/api/tables/truncate', async (request) => {
      const params = request.body as any;

      try {
         await requireConnection(params.uid).truncateTable(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: safeErrorMessage(err) };
      }
   });

   // POST /api/tables/drop
   app.post('/api/tables/drop', async (request) => {
      const params = request.body as any;

      try {
         await requireConnection(params.uid).dropTable(params);
         return { status: 'success' };
      }
      catch (err) {
         return { status: 'error', response: safeErrorMessage(err) };
      }
   });
}
