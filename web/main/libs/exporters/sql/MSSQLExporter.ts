import * as antares from 'common/interfaces/antares';
import * as exporter from 'common/interfaces/exporter';

import { SQLServerClient } from '../../clients/SQLServerClient';
import { SqlExporter } from './SqlExporter';

export default class MSSQLExporter extends SqlExporter {
   protected declare _client: SQLServerClient;

   constructor (client: SQLServerClient, tables: exporter.TableParams[], options: exporter.ExportOptions) {
      super(tables, options);
      this._client = client;
   }

   async getSqlHeader () {
      let dump = await super.getSqlHeader();
      dump += '\n\nSET NOCOUNT ON;\n';
      return dump;
   }

   getDropTable (tableName: string) {
      return `IF OBJECT_ID(N'[${this.schemaName}].[${tableName}]', N'U') IS NOT NULL DROP TABLE [${this.schemaName}].[${tableName}];`;
   }

   async getCreateTable (tableName: string) {
      return await this._client.getTableDll({ schema: this.schemaName, table: tableName });
   }

   async * getTableInsert (tableName: string) {
      const { rows } = await this._client.raw<antares.QueryResult<{ count: number }>>(
         `SELECT COUNT(1) AS count FROM [${this.schemaName}].[${tableName}]`,
         { split: false }
      );
      const rowCount = rows?.[0]?.count || 0;

      if (rowCount <= 0)
         return;

      const columns = await this._client.getTableColumns({ schema: this.schemaName, table: tableName });
      if (!columns.length)
         return;

      const columnNames = columns.map((col) => `[${col.name}]`);
      const hasIdentity = columns.some((col) => col.autoIncrement);
      const maxRowsPerInsert = this._options.sqlInsertDivider === 'rows'
         ? Math.max(1, Math.floor(this._options.sqlInsertAfter || 250))
         : 250;

      if (hasIdentity)
         yield `SET IDENTITY_INSERT [${this.schemaName}].[${tableName}] ON;\n`;

      const pageSize = 500;

      for (let offset = 0; offset < rowCount; offset += pageSize) {
         if (this.isCancelled)
            return;

         const pageQuery = `SELECT ${columnNames.join(', ')} FROM [${this.schemaName}].[${tableName}] ORDER BY (SELECT NULL) OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY`;
         const pageResult = await this._client.raw<antares.QueryResult<Record<string, unknown>>>(pageQuery, { split: false });
         const pageRows = pageResult.rows || [];

         if (!pageRows.length)
            break;

         let currentChunk: string[] = [];

         for (const row of pageRows) {
            const values = columns.map((column) => this.toSqlValue(row[column.name]));
            currentChunk.push(`(${values.join(', ')})`);

            if (currentChunk.length >= maxRowsPerInsert) {
               yield `INSERT INTO [${this.schemaName}].[${tableName}] (${columnNames.join(', ')}) VALUES\n${currentChunk.join(',\n')};\n`;
               currentChunk = [];
            }
         }

         if (currentChunk.length)
            yield `INSERT INTO [${this.schemaName}].[${tableName}] (${columnNames.join(', ')}) VALUES\n${currentChunk.join(',\n')};\n`;
      }

      if (hasIdentity)
         yield `SET IDENTITY_INSERT [${this.schemaName}].[${tableName}] OFF;\n`;
   }

   async getViews () {
      const { rows } = await this._client.raw<antares.QueryResult<{ name: string }>>(
         `SELECT TABLE_NAME AS name FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_SCHEMA = '${this.schemaName.replaceAll('\'', '\'\'')}' ORDER BY TABLE_NAME`,
         { split: false }
      );

      let sql = '';

      for (const row of rows) {
         const viewInfo = await this._client.getViewInformations({ schema: this.schemaName, view: row.name });
         if (!viewInfo?.sql)
            continue;

         sql += `IF OBJECT_ID(N'[${this.schemaName}].[${row.name}]', N'V') IS NOT NULL DROP VIEW [${this.schemaName}].[${row.name}];\n`;
         sql += `CREATE VIEW [${this.schemaName}].[${row.name}] AS\n${viewInfo.sql};\n\n`;
      }

      return sql;
   }

   async getTriggers () {
      const { rows } = await this._client.raw<antares.QueryResult<{ table_name: string; trigger_name: string }>>(
         `
            SELECT OBJECT_NAME(tr.parent_id) AS table_name, tr.name AS trigger_name
            FROM sys.triggers tr
            INNER JOIN sys.tables st ON tr.parent_id = st.object_id
            WHERE SCHEMA_NAME(st.schema_id) = '${this.schemaName.replaceAll('\'', '\'\'')}'
            ORDER BY table_name, trigger_name
         `,
         { split: false }
      );

      let sql = '';

      for (const row of rows) {
         const info = await this._client.getTriggerInformations({
            schema: this.schemaName,
            trigger: `${row.table_name}.${row.trigger_name}`
         });

         if (!info?.sql)
            continue;

         sql += `IF OBJECT_ID(N'[${this.schemaName}].[${row.trigger_name}]', N'TR') IS NOT NULL DROP TRIGGER [${this.schemaName}].[${row.trigger_name}];\n`;
         sql += `${info.sql};\n`;
         if (!info.enabled)
            sql += `DISABLE TRIGGER [${row.trigger_name}] ON [${this.schemaName}].[${row.table_name}];\n`;
         sql += '\n';
      }

      return sql;
   }

   async getFunctions () {
      const { rows } = await this._client.raw<antares.QueryResult<{ name: string }>>(
         `SELECT ROUTINE_NAME AS name FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_SCHEMA = '${this.schemaName.replaceAll('\'', '\'\'')}' AND ROUTINE_TYPE = 'FUNCTION' ORDER BY ROUTINE_NAME`,
         { split: false }
      );

      let sql = '';

      for (const row of rows) {
         const info = await this._client.getFunctionInformations({ schema: this.schemaName, func: row.name });
         if (!info?.sql)
            continue;

         sql += `IF OBJECT_ID(N'[${this.schemaName}].[${row.name}]', N'FN') IS NOT NULL DROP FUNCTION [${this.schemaName}].[${row.name}];\n`;
         sql += `${info.sql};\n\n`;
      }

      return sql;
   }

   async getRoutines () {
      const { rows } = await this._client.raw<antares.QueryResult<{ name: string }>>(
         `SELECT ROUTINE_NAME AS name FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_SCHEMA = '${this.schemaName.replaceAll('\'', '\'\'')}' AND ROUTINE_TYPE = 'PROCEDURE' ORDER BY ROUTINE_NAME`,
         { split: false }
      );

      let sql = '';

      for (const row of rows) {
         const info = await this._client.getRoutineInformations({ schema: this.schemaName, routine: row.name });
         if (!info?.sql)
            continue;

         sql += `IF OBJECT_ID(N'[${this.schemaName}].[${row.name}]', N'P') IS NOT NULL DROP PROCEDURE [${this.schemaName}].[${row.name}];\n`;
         sql += `${info.sql};\n\n`;
      }

      return sql;
   }

   private toSqlValue (value: unknown) {
      if (value === null || value === undefined)
         return 'NULL';

      if (typeof value === 'number')
         return Number.isFinite(value) ? String(value) : 'NULL';

      if (typeof value === 'bigint')
         return value.toString();

      if (typeof value === 'boolean')
         return value ? '1' : '0';

      if (Buffer.isBuffer(value))
         return `0x${value.toString('hex').toUpperCase()}`;

      if (value instanceof Uint8Array)
         return `0x${Buffer.from(value).toString('hex').toUpperCase()}`;

      if (value instanceof Date)
         return `N'${value.toISOString().replace('T', ' ').replace('Z', '')}'`;

      if (typeof value === 'object')
         return `N'${JSON.stringify(value).replaceAll('\'', '\'\'')}'`;

      return `N'${String(value).replaceAll('\'', '\'\'')}'`;
   }
}
