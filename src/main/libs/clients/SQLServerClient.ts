import SSH2Promise = require('@fabio286/ssh2-promise');
import SSHConfig from '@fabio286/ssh2-promise/lib/sshConfig';
import dataTypes from 'common/data-types/sqlserver';
import * as antares from 'common/interfaces/antares';
import { removeComments } from 'common/libs/sqlUtils';
import * as mssql from 'mssql';

import { BaseClient } from './BaseClient';

export class SQLServerClient extends BaseClient {
   private _schema?: string;
   private _runningConnections: Map<string, mssql.Request>;
   private _connectionsToCommit: Map<string, mssql.Transaction>;
   protected _connection?: mssql.ConnectionPool;

   constructor (args: antares.ClientParams) {
      super(args);

      this._schema = 'dbo';
      this._runningConnections = new Map();
      this._connectionsToCommit = new Map();
   }

   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   _reducer (acc: string[], curr: any) {
      const type = typeof curr;

      switch (type) {
         case 'number':
         case 'string':
            return [...acc, curr];
         case 'object':
            if (Array.isArray(curr))
               return [...acc, ...curr];
            else {
               const clausoles = [];
               for (const key in curr)
                  clausoles.push(`[${key}] ${curr[key]}`);

               return clausoles;
            }
      }
   }

   getTypeInfo (type: string): antares.TypeInformations {
      return dataTypes
         .reduce((acc, group) => [...acc, ...group.types], [])
         .filter(_type => _type.name === type.toUpperCase())[0];
   }

   async getDbConfig () {
      const dbConfig: mssql.config = {
         server: this._params.host,
         port: this._params.port,
         user: this._params.user,
         password: this._params.password,
         database: this._params.database || 'master',
         options: {
            encrypt: false,
            trustServerCertificate: true,
            enableArithAbort: true
         },
         pool: {
            max: this._poolSize || 10,
            min: 0,
            idleTimeoutMillis: 30000
         }
      };

      if (this._params.ssh) {
         try {
            this._ssh = new SSH2Promise({
               ...this._params.ssh,
               reconnect: true,
               reconnectTries: 3,
               debug: process.env.NODE_ENV !== 'production' ? (s) => console.log(s) : null
            });

            const tunnel = await this._ssh.addTunnel({
               remoteAddr: this._params.host,
               remotePort: this._params.port
            });

            dbConfig.server = '127.0.0.1';
            dbConfig.port = tunnel.localPort;
         }
         catch (err) {
            if (this._ssh) {
               this._ssh.close();
               this._ssh.closeTunnel();
            }
            throw err;
         }
      }

      return dbConfig;
   }

   async connect () {
      const dbConfig = await this.getDbConfig();
      this._connection = await new mssql.ConnectionPool(dbConfig).connect();
   }

   async ping () {
      await this._connection.request().query('SELECT 1');
   }

   destroy () {
      if (this._connection)
         this._connection.close();
      if (this._ssh) {
         this._ssh.close();
         this._ssh.closeTunnel();
      }
   }

   use (schema: string) {
      this._schema = schema;
   }

   async getDatabases () {
      const { rows } = await this.raw<antares.QueryResult>('SELECT name FROM sys.databases ORDER BY name');
      if (rows)
         return rows.map(row => row.name);
      return [];
   }

   async getStructure (schemas: Set<string>) {
      /* eslint-disable camelcase */
      interface ShowTableResult {
         table_schema: string;
         table_name: string;
         table_type: string;
         data_length: number;
         table_rows: number;
         comment: string;
      }

      interface ShowTriggersResult {
         table_name: string;
         trigger_name: string;
         is_disabled: boolean;
      }
      /* eslint-enable camelcase */

      const { rows: databases } = await this.raw<antares.QueryResult<{ schema_name: string }>>('SELECT schema_name FROM information_schema.schemata ORDER BY schema_name');
      const { rows: functions } = await this.raw<antares.QueryResult>(`
         SELECT routine_name, routine_schema, routine_type
         FROM information_schema.routines
         WHERE routine_type = 'FUNCTION'
      `);
      const { rows: procedures } = await this.raw<antares.QueryResult>(`
         SELECT routine_name, routine_schema, routine_type
         FROM information_schema.routines
         WHERE routine_type = 'PROCEDURE'
      `);

      const tablesArr: ShowTableResult[] = [];
      const triggersArr: ShowTriggersResult[] = [];

      for (const db of databases) {
         if (!schemas.has(db.schema_name)) continue;

         const { rows: tables } = await this.raw<antares.QueryResult<ShowTableResult>>(`
            SELECT
               t.TABLE_SCHEMA AS table_schema,
               t.TABLE_NAME AS table_name,
               t.TABLE_TYPE AS table_type,
               ISNULL(p.rows, 0) AS table_rows,
               ISNULL(SUM(a.total_pages) * 8 * 1024, 0) AS data_length,
               ISNULL(ep.value, '') AS comment
            FROM INFORMATION_SCHEMA.TABLES t
            LEFT JOIN sys.tables st ON st.name = t.TABLE_NAME AND SCHEMA_NAME(st.schema_id) = t.TABLE_SCHEMA
            LEFT JOIN sys.partitions p ON p.object_id = st.object_id AND p.index_id IN (0, 1)
            LEFT JOIN sys.allocation_units a ON a.container_id = p.partition_id
            LEFT JOIN sys.extended_properties ep ON ep.major_id = st.object_id AND ep.minor_id = 0 AND ep.name = 'MS_Description'
            WHERE t.TABLE_SCHEMA = '${db.schema_name}'
            GROUP BY t.TABLE_SCHEMA, t.TABLE_NAME, t.TABLE_TYPE, p.rows, ep.value
            ORDER BY t.TABLE_NAME
         `);

         if (tables.length)
            tablesArr.push(...tables);

         const { rows: triggers } = await this.raw<antares.QueryResult<ShowTriggersResult>>(`
            SELECT
               OBJECT_NAME(tr.parent_id) AS table_name,
               tr.name AS trigger_name,
               tr.is_disabled
            FROM sys.triggers tr
            INNER JOIN sys.tables st ON tr.parent_id = st.object_id
            WHERE SCHEMA_NAME(st.schema_id) = '${db.schema_name}'
            ORDER BY table_name
         `);

         if (triggers.length) {
            triggersArr.push(...triggers.map(t => ({ ...t, table_schema: db.schema_name })));
         }
      }

      return databases.map(db => {
         if (schemas.has(db.schema_name)) {
            const remappedTables = tablesArr
               .filter(table => table.table_schema === db.schema_name)
               .map(table => {
                  return {
                     name: table.table_name,
                     type: table.table_type === 'VIEW' ? 'view' : 'table',
                     rows: table.table_rows,
                     size: Number(table.data_length),
                     collation: '',
                     comment: table.comment || '',
                     engine: ''
                  };
               });

            const remappedProcedures = procedures
               .filter(p => p.routine_schema === db.schema_name)
               .map(p => ({
                  name: p.routine_name,
                  type: p.routine_type,
                  security: ''
               }));

            const remappedFunctions = functions
               .filter(f => f.routine_schema === db.schema_name)
               .map(f => ({
                  name: f.routine_name,
                  type: f.routine_type,
                  security: ''
               }));

            const remappedTriggers = triggersArr
               .filter((trigger: ShowTriggersResult & { table_schema?: string }) => trigger.table_schema === db.schema_name)
               .map(trigger => ({
                  name: `${trigger.table_name}.${trigger.trigger_name}`,
                  orgName: trigger.trigger_name,
                  definer: '',
                  table: trigger.table_name,
                  sqlMode: '',
                  enabled: !trigger.is_disabled
               }));

            return {
               name: db.schema_name,
               size: remappedTables.reduce((acc, t) => acc + t.size, 0),
               tables: remappedTables,
               functions: remappedFunctions,
               procedures: remappedProcedures,
               triggers: remappedTriggers,
               triggerFunctions: [],
               schedulers: []
            };
         }
         else {
            return {
               name: db.schema_name,
               size: 0,
               tables: [],
               functions: [],
               procedures: [],
               triggers: [],
               triggerFunctions: [],
               schedulers: []
            };
         }
      });
   }

   async getTableColumns ({ schema, table }: { schema: string; table: string }) {
      /* eslint-disable camelcase */
      interface TableColumnsResult {
         column_name: string;
         data_type: string;
         character_maximum_length: number;
         numeric_precision: number;
         numeric_scale: number;
         datetime_precision: number;
         is_nullable: string;
         column_default: string;
         ordinal_position: number;
         collation_name: string;
         is_identity: number;
         column_comment: string;
      }
      /* eslint-enable camelcase */

      const { rows } = await this.raw<antares.QueryResult<TableColumnsResult>>(`
         SELECT
            c.COLUMN_NAME AS column_name,
            c.DATA_TYPE AS data_type,
            c.CHARACTER_MAXIMUM_LENGTH AS character_maximum_length,
            c.NUMERIC_PRECISION AS numeric_precision,
            c.NUMERIC_SCALE AS numeric_scale,
            c.DATETIME_PRECISION AS datetime_precision,
            c.IS_NULLABLE AS is_nullable,
            c.COLUMN_DEFAULT AS column_default,
            c.ORDINAL_POSITION AS ordinal_position,
            c.COLLATION_NAME AS collation_name,
            COLUMNPROPERTY(OBJECT_ID('${schema}.${table}'), c.COLUMN_NAME, 'IsIdentity') AS is_identity,
            ISNULL(ep.value, '') AS column_comment
         FROM INFORMATION_SCHEMA.COLUMNS c
         LEFT JOIN sys.columns sc ON sc.name = c.COLUMN_NAME
            AND sc.object_id = OBJECT_ID('${schema}.${table}')
         LEFT JOIN sys.extended_properties ep ON ep.major_id = sc.object_id
            AND ep.minor_id = sc.column_id
            AND ep.name = 'MS_Description'
         WHERE c.TABLE_SCHEMA = '${schema}'
         AND c.TABLE_NAME = '${table}'
         ORDER BY c.ORDINAL_POSITION ASC
      `);

      return rows.map(field => {
         let charLength = field.character_maximum_length;
         // SQL Server uses -1 for MAX types (nvarchar(max), varchar(max), varbinary(max))
         if (charLength === -1) charLength = null;

         return {
            name: field.column_name,
            key: null as null,
            type: field.data_type.toUpperCase(),
            schema: schema,
            table: table,
            numScale: field.numeric_scale,
            numPrecision: field.numeric_precision,
            datePrecision: field.datetime_precision,
            charLength: charLength,
            nullable: field.is_nullable === 'YES',
            unsigned: null as null,
            zerofill: null as null,
            order: field.ordinal_position,
            default: field.column_default,
            charset: null as null,
            collation: field.collation_name,
            autoIncrement: field.is_identity === 1,
            onUpdate: null as null,
            comment: field.column_comment || ''
         };
      });
   }

   async getTableApproximateCount ({ schema, table }: { schema: string; table: string }): Promise<number> {
      const { rows } = await this.raw(`
         SELECT SUM(p.rows) AS [count]
         FROM sys.partitions p
         INNER JOIN sys.tables t ON p.object_id = t.object_id
         WHERE t.name = '${table}'
         AND SCHEMA_NAME(t.schema_id) = '${schema}'
         AND p.index_id IN (0, 1)
      `);

      return rows.length ? rows[0].count : 0;
   }

   async getTableOptions ({ schema, table }: { schema: string; table: string }) {
      const { rows } = await this.raw(`
         SELECT
            t.TABLE_NAME AS table_name,
            t.TABLE_TYPE AS table_type,
            ISNULL(p.rows, 0) AS table_rows,
            ISNULL(SUM(a.total_pages) * 8 * 1024, 0) AS data_length,
            ISNULL(ep.value, '') AS comment,
            ISNULL(col.collation_name, '') AS collation
         FROM INFORMATION_SCHEMA.TABLES t
         LEFT JOIN sys.tables st ON st.name = t.TABLE_NAME AND SCHEMA_NAME(st.schema_id) = t.TABLE_SCHEMA
         LEFT JOIN sys.partitions p ON p.object_id = st.object_id AND p.index_id IN (0, 1)
         LEFT JOIN sys.allocation_units a ON a.container_id = p.partition_id
         LEFT JOIN sys.extended_properties ep ON ep.major_id = st.object_id AND ep.minor_id = 0 AND ep.name = 'MS_Description'
         LEFT JOIN (
            SELECT object_id, MIN(collation_name) AS collation_name
            FROM sys.columns WHERE collation_name IS NOT NULL
            GROUP BY object_id
         ) col ON col.object_id = st.object_id
         WHERE t.TABLE_SCHEMA = '${schema}'
         AND t.TABLE_NAME = '${table}'
         GROUP BY t.TABLE_NAME, t.TABLE_TYPE, p.rows, ep.value, col.collation_name
      `);

      if (rows.length) {
         return {
            name: rows[0].table_name,
            type: rows[0].table_type === 'VIEW' ? 'view' : 'table',
            rows: rows[0].table_rows,
            size: Number(rows[0].data_length),
            collation: rows[0].collation,
            comment: rows[0].comment || '',
            engine: ''
         };
      }
      return {};
   }

   async getTableIndexes ({ schema, table }: { schema: string; table: string }) {
      const { rows } = await this.raw(`
         SELECT
            i.name AS index_name,
            COL_NAME(ic.object_id, ic.column_id) AS column_name,
            CASE
               WHEN i.is_primary_key = 1 THEN 'PRIMARY'
               WHEN i.is_unique = 1 THEN 'UNIQUE'
               ELSE 'INDEX'
            END AS index_type
         FROM sys.indexes i
         INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
         WHERE i.object_id = OBJECT_ID('${schema}.${table}')
         AND i.name IS NOT NULL
         ORDER BY i.name, ic.key_ordinal
      `);

      return rows.map(row => {
         return {
            name: row.index_name,
            column: row.column_name,
            type: row.index_type
         };
      });
   }

   async getTableChecks ({ schema, table }: { schema: string; table: string }): Promise<antares.TableCheck[]> {
      const { rows } = await this.raw(`
         SELECT
            cc.name AS name,
            cc.definition AS clause
         FROM sys.check_constraints cc
         INNER JOIN sys.tables t ON cc.parent_object_id = t.object_id
         WHERE SCHEMA_NAME(t.schema_id) = '${schema}'
         AND t.name = '${table}'
      `);

      return rows.map(row => ({
         name: row.name,
         clause: row.clause
      }));
   }

   async getTableDll ({ schema, table }: { schema: string; table: string }) {
      let createSql = '';
      const columnsSql: string[] = [];

      // Table columns
      const { rows } = await this.raw(`
         SELECT
            c.COLUMN_NAME,
            c.DATA_TYPE,
            c.CHARACTER_MAXIMUM_LENGTH,
            c.NUMERIC_PRECISION,
            c.NUMERIC_SCALE,
            c.IS_NULLABLE,
            c.COLUMN_DEFAULT,
            COLUMNPROPERTY(OBJECT_ID('${schema}.${table}'), c.COLUMN_NAME, 'IsIdentity') AS is_identity
         FROM INFORMATION_SCHEMA.COLUMNS c
         WHERE c.TABLE_SCHEMA = '${schema}'
         AND c.TABLE_NAME = '${table}'
         ORDER BY c.ORDINAL_POSITION ASC
      `);

      if (!rows.length) return '';

      const indexes = await this.getTableIndexes({ schema, table });
      const primaryKey = indexes
         .filter(i => i.type === 'PRIMARY')
         .reduce((acc, cur) => {
            if (!Object.keys(acc).length) {
               acc = { name: cur.name, column: `[${cur.column}]`, type: cur.type };
            }
            else
               acc.column += `, [${cur.column}]`;
            return acc;
         }, {} as { name: string; column: string; type: string });

      for (const column of rows) {
         let colType = column.DATA_TYPE.toUpperCase();

         // Add length/precision
         if (column.CHARACTER_MAXIMUM_LENGTH) {
            colType += column.CHARACTER_MAXIMUM_LENGTH === -1
               ? '(MAX)'
               : `(${column.CHARACTER_MAXIMUM_LENGTH})`;
         }
         else if (column.NUMERIC_PRECISION !== null && column.NUMERIC_SCALE !== null &&
                  !['INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'BIT', 'MONEY', 'SMALLMONEY', 'FLOAT', 'REAL'].includes(column.DATA_TYPE.toUpperCase())) {
            colType += `(${column.NUMERIC_PRECISION}, ${column.NUMERIC_SCALE})`;
         }

         const columnArr = [
            `[${column.COLUMN_NAME}]`,
            colType
         ];

         if (column.is_identity)
            columnArr.push('IDENTITY(1,1)');

         if (column.IS_NULLABLE === 'NO')
            columnArr.push('NOT NULL');
         else
            columnArr.push('NULL');

         if (column.COLUMN_DEFAULT)
            columnArr.push(`DEFAULT ${column.COLUMN_DEFAULT}`);

         columnsSql.push(columnArr.join(' '));
      }

      if (Object.keys(primaryKey).length)
         columnsSql.push(`CONSTRAINT [${primaryKey.name}] PRIMARY KEY (${primaryKey.column})`);

      createSql = `CREATE TABLE [${schema}].[${table}] (\n   ${columnsSql.join(',\n   ')}\n);\n`;

      // Non-primary indexes
      const remappedIndexes = indexes
         .filter(i => i.type !== 'PRIMARY')
         .reduce((acc, cur) => {
            const existingIndex = acc.findIndex(i => i.name === cur.name);
            if (existingIndex >= 0)
               acc[existingIndex].column += `, [${cur.column}]`;
            else
               acc.push({ name: cur.name, column: `[${cur.column}]`, type: cur.type });
            return acc;
         }, [] as { name: string; column: string; type: string }[]);

      for (const index of remappedIndexes) {
         if (index.type === 'UNIQUE')
            createSql += `\nCREATE UNIQUE INDEX [${index.name}] ON [${schema}].[${table}] (${index.column});`;
         else
            createSql += `\nCREATE INDEX [${index.name}] ON [${schema}].[${table}] (${index.column});`;
      }

      return createSql;
   }

   async getKeyUsage ({ schema, table }: { schema: string; table: string }) {
      const { rows } = await this.raw(`
         SELECT
            kcu.TABLE_SCHEMA AS table_schema,
            kcu.TABLE_NAME AS table_name,
            kcu.COLUMN_NAME AS column_name,
            kcu.ORDINAL_POSITION AS ordinal_position,
            kcu.CONSTRAINT_NAME AS constraint_name,
            ccu.TABLE_SCHEMA AS foreign_table_schema,
            ccu.TABLE_NAME AS foreign_table_name,
            ccu.COLUMN_NAME AS foreign_column_name,
            rc.UPDATE_RULE AS update_rule,
            rc.DELETE_RULE AS delete_rule
         FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
         INNER JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
            ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
            AND kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
         INNER JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu
            ON rc.UNIQUE_CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
            AND rc.UNIQUE_CONSTRAINT_SCHEMA = ccu.CONSTRAINT_SCHEMA
         WHERE kcu.TABLE_SCHEMA = '${schema}'
         AND kcu.TABLE_NAME = '${table}'
      `);

      return rows.map(field => {
         return {
            schema: field.table_schema,
            table: field.table_name,
            field: field.column_name,
            position: field.ordinal_position,
            constraintPosition: null as null,
            constraintName: field.constraint_name,
            refSchema: field.foreign_table_schema,
            refTable: field.foreign_table_name,
            refField: field.foreign_column_name,
            onUpdate: field.update_rule,
            onDelete: field.delete_rule
         };
      });
   }

   async getCollations () {
      const { rows } = await this.raw('SELECT name, description FROM sys.fn_helpcollations() ORDER BY name');
      return rows.map(row => ({
         charset: '',
         collation: row.name,
         compiled: true,
         default: false,
         id: row.name,
         sortLen: 0
      }));
   }

   async getVariables () {
      const variables = [
         { name: '@@VERSION', sql: 'SELECT @@VERSION AS value' },
         { name: '@@SERVERNAME', sql: 'SELECT @@SERVERNAME AS value' },
         { name: '@@SERVICENAME', sql: 'SELECT @@SERVICENAME AS value' },
         { name: '@@LANGUAGE', sql: 'SELECT @@LANGUAGE AS value' },
         { name: '@@SPID', sql: 'SELECT @@SPID AS value' },
         { name: '@@MAX_CONNECTIONS', sql: 'SELECT @@MAX_CONNECTIONS AS value' },
         { name: '@@LOCK_TIMEOUT', sql: 'SELECT @@LOCK_TIMEOUT AS value' },
         { name: '@@NESTLEVEL', sql: 'SELECT @@NESTLEVEL AS value' }
      ];

      const results = [];
      for (const v of variables) {
         try {
            const { rows } = await this.raw(v.sql);
            if (rows.length)
               results.push({ name: v.name, value: String(rows[0].value) });
         }
         catch (_) {
            // Skip variables that fail
         }
      }

      return results;
   }

   async getEngines () {
      return {
         name: 'SQL Server',
         support: 'YES',
         comment: '',
         isDefault: true
      };
   }

   async getVersion () {
      const { rows } = await this.raw('SELECT @@VERSION AS version, SERVERPROPERTY(\'ProductVersion\') AS number, SERVERPROPERTY(\'Edition\') AS edition');
      const version = rows[0]?.version || '';

      return {
         number: rows[0]?.number || '',
         name: 'SQL Server',
         arch: rows[0]?.edition || '',
         os: version.includes('Windows') ? 'Windows' : version.includes('Linux') ? 'Linux' : ''
      };
   }

   async createSchema (params: { name: string }) {
      return await this.raw(`CREATE SCHEMA [${params.name}]`);
   }

   // eslint-disable-next-line @typescript-eslint/no-unused-vars
   async alterSchema (params: { name: string }): Promise<void> {
      return null;
   }

   async dropSchema (params: { database: string }) {
      return await this.raw(`DROP SCHEMA [${params.database}]`);
   }

   async createTable (params: antares.CreateTableParams) {
      const {
         schema,
         fields,
         foreigns,
         indexes,
         options
      } = params;
      const newColumns: string[] = [];
      const newIndexes: string[] = [];
      const manageIndexes: string[] = [];
      const newForeigns: string[] = [];

      let sql = `CREATE TABLE [${schema}].[${options.name}]`;

      // ADD FIELDS
      fields.forEach(field => {
         const typeInfo = this.getTypeInfo(field.type);
         const length = typeInfo && typeInfo.length
            ? field.numLength || field.charLength || field.datePrecision
            : false;

         newColumns.push(`[${field.name}]
            ${field.type.toUpperCase()}${length ? `(${length}${field.numScale !== null ? `,${field.numScale}` : ''})` : ''}
            ${field.autoIncrement ? 'IDENTITY(1,1)' : ''}
            ${field.nullable ? 'NULL' : 'NOT NULL'}
            ${field.default !== null ? `DEFAULT ${field.default || '\'\''}` : ''}`);
      });

      // ADD INDEX
      indexes.forEach(index => {
         const fields = index.fields.map(field => `[${field}]`).join(',');
         const type = index.type;

         if (type === 'PRIMARY')
            newIndexes.push(`CONSTRAINT [${index.name}] PRIMARY KEY (${fields})`);
         else if (type === 'UNIQUE')
            newIndexes.push(`CONSTRAINT [${index.name}] UNIQUE (${fields})`);
         else
            manageIndexes.push(`CREATE INDEX [${index.name}] ON [${schema}].[${options.name}] (${fields})`);
      });

      // ADD FOREIGN KEYS
      foreigns.forEach(foreign => {
         newForeigns.push(`CONSTRAINT [${foreign.constraintName}] FOREIGN KEY ([${foreign.field}]) REFERENCES [${schema}].[${foreign.refTable}] ([${foreign.refField}]) ON UPDATE ${foreign.onUpdate} ON DELETE ${foreign.onDelete}`);
      });

      sql = `${sql} (${[...newColumns, ...newIndexes, ...newForeigns].join(', ')}); `;
      if (manageIndexes.length) sql = `${sql} ${manageIndexes.join(';')}; `;

      // TABLE COMMENT
      if (options.comment) {
         sql += `EXEC sp_addextendedproperty @name=N'MS_Description', @value=N'${options.comment}', @level0type=N'SCHEMA', @level0name=N'${schema}', @level1type=N'TABLE', @level1name=N'${options.name}'; `;
      }

      return await this.raw(sql);
   }

   async alterTable (params: antares.AlterTableParams) {
      const {
         table,
         schema,
         additions,
         deletions,
         changes,
         indexChanges,
         foreignChanges,
         options
      } = params;

      let sql = '';
      const alterColumns: string[] = [];
      const manageIndexes: string[] = [];

      // ADD FIELDS
      additions.forEach(addition => {
         const typeInfo = this.getTypeInfo(addition.type);
         const length = typeInfo && typeInfo.length
            ? addition.numLength || addition.charLength || addition.datePrecision
            : false;

         alterColumns.push(`ADD [${addition.name}]
            ${addition.type.toUpperCase()}${length ? `(${length}${addition.numScale !== null ? `,${addition.numScale}` : ''})` : ''}
            ${addition.autoIncrement ? 'IDENTITY(1,1)' : ''}
            ${addition.nullable ? 'NULL' : 'NOT NULL'}
            ${addition.default !== null ? `DEFAULT ${addition.default || '\'\''}` : ''}`);

         if (addition.comment) {
            sql += `EXEC sp_addextendedproperty @name=N'MS_Description', @value=N'${addition.comment}', @level0type=N'SCHEMA', @level0name=N'${schema}', @level1type=N'TABLE', @level1name=N'${table}', @level2type=N'COLUMN', @level2name=N'${addition.name}'; `;
         }
      });

      // ADD INDEX
      indexChanges.additions.forEach(addition => {
         const fields = addition.fields.map(field => `[${field}]`).join(',');
         const type = addition.type;

         if (type === 'PRIMARY')
            alterColumns.push(`ADD CONSTRAINT [${addition.name}] PRIMARY KEY (${fields})`);
         else if (type === 'UNIQUE')
            alterColumns.push(`ADD CONSTRAINT [${addition.name}] UNIQUE (${fields})`);
         else
            manageIndexes.push(`CREATE INDEX [${addition.name}] ON [${schema}].[${table}] (${fields})`);
      });

      // ADD FOREIGN KEYS
      foreignChanges.additions.forEach(addition => {
         alterColumns.push(`ADD CONSTRAINT [${addition.constraintName}] FOREIGN KEY ([${addition.field}]) REFERENCES [${schema}].[${addition.refTable}] ([${addition.refField}]) ON UPDATE ${addition.onUpdate} ON DELETE ${addition.onDelete}`);
      });

      // CHANGE FIELDS
      changes.forEach(change => {
         const typeInfo = this.getTypeInfo(change.type);
         const length = typeInfo && typeInfo.length
            ? change.numLength || change.charLength || change.datePrecision
            : false;

         alterColumns.push(`ALTER COLUMN [${change.name}] ${change.type.toUpperCase()}${length ? `(${length}${change.numScale ? `,${change.numScale}` : ''})` : ''} ${change.nullable ? 'NULL' : 'NOT NULL'}`);

         if (change.orgName !== change.name) {
            sql += `EXEC sp_rename '[${schema}].[${table}].[${change.orgName}]', '${change.name}', 'COLUMN'; `;
         }

         if (change.comment != null) {
            // Try to update existing, add if not exists
            sql += `
               IF EXISTS (SELECT 1 FROM sys.extended_properties ep
                  INNER JOIN sys.columns c ON ep.major_id = c.object_id AND ep.minor_id = c.column_id
                  WHERE ep.name = 'MS_Description' AND c.object_id = OBJECT_ID('[${schema}].[${table}]') AND c.name = '${change.name}')
                  EXEC sp_updateextendedproperty @name=N'MS_Description', @value=N'${change.comment}', @level0type=N'SCHEMA', @level0name=N'${schema}', @level1type=N'TABLE', @level1name=N'${table}', @level2type=N'COLUMN', @level2name=N'${change.name}'
               ELSE
                  EXEC sp_addextendedproperty @name=N'MS_Description', @value=N'${change.comment}', @level0type=N'SCHEMA', @level0name=N'${schema}', @level1type=N'TABLE', @level1name=N'${table}', @level2type=N'COLUMN', @level2name=N'${change.name}'; `;
         }
      });

      // CHANGE INDEX
      indexChanges.changes.forEach(change => {
         if (['PRIMARY', 'UNIQUE'].includes(change.oldType))
            alterColumns.push(`DROP CONSTRAINT [${change.oldName}]`);
         else
            manageIndexes.push(`DROP INDEX [${change.oldName}] ON [${schema}].[${table}]`);

         const fields = change.fields.map(field => `[${field}]`).join(',');
         const type = change.type;

         if (type === 'PRIMARY')
            alterColumns.push(`ADD CONSTRAINT [${change.name}] PRIMARY KEY (${fields})`);
         else if (type === 'UNIQUE')
            alterColumns.push(`ADD CONSTRAINT [${change.name}] UNIQUE (${fields})`);
         else
            manageIndexes.push(`CREATE INDEX [${change.name}] ON [${schema}].[${table}] (${fields})`);
      });

      // CHANGE FOREIGN KEYS
      foreignChanges.changes.forEach(change => {
         alterColumns.push(`DROP CONSTRAINT [${change.oldName}]`);
         alterColumns.push(`ADD CONSTRAINT [${change.constraintName}] FOREIGN KEY ([${change.field}]) REFERENCES [${schema}].[${change.refTable}] ([${change.refField}]) ON UPDATE ${change.onUpdate} ON DELETE ${change.onDelete}`);
      });

      // DROP FIELDS
      deletions.forEach(deletion => {
         alterColumns.push(`DROP COLUMN [${deletion.name}]`);
      });

      // DROP INDEX
      indexChanges.deletions.forEach(deletion => {
         if (['PRIMARY', 'UNIQUE'].includes(deletion.type))
            alterColumns.push(`DROP CONSTRAINT [${deletion.name}]`);
         else
            manageIndexes.push(`DROP INDEX [${deletion.name}] ON [${schema}].[${table}]`);
      });

      // DROP FOREIGN KEYS
      foreignChanges.deletions.forEach(deletion => {
         alterColumns.push(`DROP CONSTRAINT [${deletion.constraintName}]`);
      });

      if (manageIndexes.length) sql = `${manageIndexes.join('; ')}; ${sql}`;
      if (alterColumns.length) sql += `ALTER TABLE [${schema}].[${table}] ${alterColumns.join(', ')}; `;

      // TABLE COMMENT
      if (options.comment != null) {
         sql += `
            IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('[${schema}].[${table}]') AND minor_id = 0 AND name = 'MS_Description')
               EXEC sp_updateextendedproperty @name=N'MS_Description', @value=N'${options.comment}', @level0type=N'SCHEMA', @level0name=N'${schema}', @level1type=N'TABLE', @level1name=N'${table}'
            ELSE
               EXEC sp_addextendedproperty @name=N'MS_Description', @value=N'${options.comment}', @level0type=N'SCHEMA', @level0name=N'${schema}', @level1type=N'TABLE', @level1name=N'${table}'; `;
      }

      // RENAME TABLE
      if (options.name && options.name !== table)
         sql += `EXEC sp_rename '[${schema}].[${table}]', '${options.name}'; `;

      return await this.raw(sql);
   }

   async duplicateTable (params: { schema: string; table: string }) {
      const sql = `SELECT * INTO [${params.schema}].[${params.table}_copy] FROM [${params.schema}].[${params.table}] WHERE 1 = 0`;
      return await this.raw(sql);
   }

   async truncateTable (params: { schema: string; table: string }) {
      const sql = `TRUNCATE TABLE [${params.schema}].[${params.table}]`;
      return await this.raw(sql);
   }

   async dropTable (params: { schema: string; table: string }) {
      const sql = `DROP TABLE [${params.schema}].[${params.table}]`;
      return await this.raw(sql);
   }

   async getViewInformations ({ schema, view }: { schema: string; view: string }) {
      const sql = `SELECT OBJECT_DEFINITION(OBJECT_ID('[${schema}].[${view}]')) AS definition`;
      const results = await this.raw(sql);

      if (results.rows.length && results.rows[0].definition) {
         // Extract the SELECT part from the CREATE VIEW statement
         const definition = results.rows[0].definition;
         const asIndex = definition.toUpperCase().indexOf('\nAS\n');
         const selectPart = asIndex >= 0 ? definition.substring(asIndex + 4) : definition;

         return {
            algorithm: '',
            definer: '',
            security: '',
            updateOption: '',
            sql: selectPart.trim(),
            name: view
         };
      }

      return {
         algorithm: '',
         definer: '',
         security: '',
         updateOption: '',
         sql: '',
         name: view
      };
   }

   async dropView (params: { schema: string; view: string }) {
      const sql = `DROP VIEW [${params.schema}].[${params.view}]`;
      return await this.raw(sql);
   }

   async alterView ({ view }: { view: antares.AlterViewParams }) {
      let sql = `ALTER VIEW [${view.schema}].[${view.oldName}] AS ${view.sql}`;

      if (view.name !== view.oldName)
         sql += `; EXEC sp_rename '[${view.schema}].[${view.oldName}]', '${view.name}'`;

      return await this.raw(sql);
   }

   async createView (params: antares.CreateViewParams) {
      const sql = `CREATE VIEW [${params.schema}].[${params.name}] AS ${params.sql}`;
      return await this.raw(sql);
   }

   async getTriggerInformations ({ schema, trigger }: { schema: string; trigger: string }) {
      const [table, triggerName] = trigger.split('.');

      const { rows } = await this.raw(`
         SELECT
            tr.name AS trigger_name,
            OBJECT_NAME(tr.parent_id) AS table_name,
            OBJECT_DEFINITION(tr.object_id) AS definition,
            tr.is_disabled,
            CASE WHEN tr.is_instead_of_trigger = 1 THEN 'INSTEAD OF' ELSE 'AFTER' END AS activation,
            STUFF((
               SELECT ',' + type_desc
               FROM sys.trigger_events te
               WHERE te.object_id = tr.object_id
               FOR XML PATH('')
            ), 1, 1, '') AS events
         FROM sys.triggers tr
         INNER JOIN sys.tables st ON tr.parent_id = st.object_id
         WHERE SCHEMA_NAME(st.schema_id) = '${schema}'
         AND tr.name = '${triggerName}'
         AND OBJECT_NAME(tr.parent_id) = '${table}'
      `);

      if (rows.length) {
         return {
            sql: rows[0].definition || '',
            name: rows[0].trigger_name,
            table: rows[0].table_name,
            event: rows[0].events ? rows[0].events.split(',') : [],
            activation: rows[0].activation,
            enabled: !rows[0].is_disabled
         };
      }

      return null;
   }

   async dropTrigger (params: { schema: string; trigger: string }) {
      const triggerParts = params.trigger.split('.');
      const sql = `DROP TRIGGER [${params.schema}].[${triggerParts[1]}]`;
      return await this.raw(sql);
   }

   async alterTrigger ({ trigger }: { trigger: antares.AlterTriggerParams }) {
      // SQL Server supports ALTER TRIGGER directly
      const sql = trigger.sql.replace(/^CREATE\s+TRIGGER/i, 'ALTER TRIGGER');
      return await this.raw(sql, { split: false });
   }

   async createTrigger (params: antares.CreateTriggerParams) {
      const sql = params.sql || `CREATE TRIGGER [${params.schema}].[${params.name}] ON [${params.schema}].[${params.table}] ${params.activation} ${params.event} AS BEGIN END`;
      return await this.raw(sql, { split: false });
   }

   async enableTrigger ({ schema, trigger }: { schema: string; trigger: string }) {
      const [table, triggerName] = trigger.split('.');
      const sql = `ENABLE TRIGGER [${triggerName}] ON [${schema}].[${table}]`;
      return await this.raw(sql, { split: false });
   }

   async disableTrigger ({ schema, trigger }: { schema: string; trigger: string }) {
      const [table, triggerName] = trigger.split('.');
      const sql = `DISABLE TRIGGER [${triggerName}] ON [${schema}].[${table}]`;
      return await this.raw(sql, { split: false });
   }

   async getRoutineInformations ({ schema, routine }: { schema: string; routine: string }) {
      const { rows } = await this.raw(`
         SELECT
            OBJECT_DEFINITION(OBJECT_ID('[${schema}].[${routine}]')) AS definition,
            r.ROUTINE_NAME,
            r.ROUTINE_SCHEMA
         FROM INFORMATION_SCHEMA.ROUTINES r
         WHERE r.ROUTINE_SCHEMA = '${schema}'
         AND r.ROUTINE_NAME = '${routine}'
         AND r.ROUTINE_TYPE = 'PROCEDURE'
      `);

      if (!rows.length) {
         return {
            definer: null as null,
            sql: '',
            parameters: [],
            name: routine,
            comment: '',
            security: 'DEFINER',
            deterministic: false,
            dataAccess: 'CONTAINS SQL'
         };
      }

      // Get parameters
      const { rows: paramRows } = await this.raw(`
         SELECT
            PARAMETER_NAME AS parameter_name,
            PARAMETER_MODE AS parameter_mode,
            DATA_TYPE AS data_type
         FROM INFORMATION_SCHEMA.PARAMETERS
         WHERE SPECIFIC_SCHEMA = '${schema}'
         AND SPECIFIC_NAME = '${routine}'
         ORDER BY ORDINAL_POSITION
      `);

      const parameters = paramRows.map(row => ({
         name: row.parameter_name || '',
         type: row.data_type ? row.data_type.toUpperCase() : '',
         length: '',
         context: row.parameter_mode || 'IN'
      }));

      return {
         definer: '',
         sql: rows[0].definition || '',
         parameters,
         name: routine,
         comment: '',
         security: 'INVOKER',
         deterministic: null as null,
         dataAccess: null as null,
         language: 'T-SQL'
      };
   }

   async dropRoutine (params: { schema: string; routine: string }) {
      const sql = `DROP PROCEDURE [${params.schema}].[${params.routine}]`;
      return await this.raw(sql);
   }

   async alterRoutine ({ routine }: { routine: antares.AlterRoutineParams }) {
      // SQL Server supports ALTER PROCEDURE directly
      const sql = routine.sql.replace(/^CREATE\s+PROC(EDURE)?/i, 'ALTER PROCEDURE');
      return await this.raw(sql, { split: false });
   }

   async createRoutine (routine: antares.CreateRoutineParams) {
      const parameters = 'parameters' in routine
         ? routine.parameters.reduce((acc, curr) => {
            acc.push(`${curr.name} ${curr.type}`);
            return acc;
         }, []).join(', ')
         : '';

      const sql = routine.sql || `CREATE PROCEDURE [${routine.schema}].[${routine.name}] ${parameters ? `(${parameters})` : ''}\nAS\nBEGIN\n\nEND`;
      return await this.raw(sql, { split: false });
   }

   async getFunctionInformations ({ schema, func }: { schema: string; func: string }) {
      const { rows } = await this.raw(`
         SELECT
            OBJECT_DEFINITION(OBJECT_ID('[${schema}].[${func}]')) AS definition,
            r.ROUTINE_NAME,
            r.ROUTINE_SCHEMA,
            r.DATA_TYPE AS returns_type
         FROM INFORMATION_SCHEMA.ROUTINES r
         WHERE r.ROUTINE_SCHEMA = '${schema}'
         AND r.ROUTINE_NAME = '${func}'
         AND r.ROUTINE_TYPE = 'FUNCTION'
      `);

      if (!rows.length) {
         return {
            definer: null as null,
            sql: '',
            parameters: [],
            name: func,
            comment: '',
            security: 'DEFINER',
            deterministic: false,
            dataAccess: 'CONTAINS SQL'
         };
      }

      // Get parameters
      const { rows: paramRows } = await this.raw(`
         SELECT
            PARAMETER_NAME AS parameter_name,
            PARAMETER_MODE AS parameter_mode,
            DATA_TYPE AS data_type
         FROM INFORMATION_SCHEMA.PARAMETERS
         WHERE SPECIFIC_SCHEMA = '${schema}'
         AND SPECIFIC_NAME = '${func}'
         AND ORDINAL_POSITION > 0
         ORDER BY ORDINAL_POSITION
      `);

      const parameters = paramRows.map(row => ({
         name: row.parameter_name || '',
         type: row.data_type ? row.data_type.toUpperCase() : '',
         length: '',
         context: row.parameter_mode || 'IN'
      }));

      return {
         definer: '',
         sql: rows[0].definition || '',
         parameters,
         name: func,
         comment: '',
         security: 'INVOKER',
         deterministic: null as null,
         dataAccess: null as null,
         language: 'T-SQL',
         returns: rows[0].returns_type ? rows[0].returns_type.toUpperCase() : ''
      };
   }

   async dropFunction (params: { schema: string; func: string }) {
      const sql = `DROP FUNCTION [${params.schema}].[${params.func}]`;
      return await this.raw(sql);
   }

   async alterFunction ({ func }: { func: antares.AlterFunctionParams }) {
      // SQL Server supports ALTER FUNCTION directly
      const sql = func.sql.replace(/^CREATE\s+FUNCTION/i, 'ALTER FUNCTION');
      return await this.raw(sql, { split: false });
   }

   async createFunction (func: antares.CreateFunctionParams) {
      const parameters = 'parameters' in func
         ? func.parameters.reduce((acc, curr) => {
            acc.push(`${curr.name} ${curr.type}`);
            return acc;
         }, []).join(', ')
         : '';

      const sql = func.sql || `CREATE FUNCTION [${func.schema}].[${func.name}] (${parameters})\nRETURNS ${func.returns || 'INT'}\nAS\nBEGIN\n  RETURN 0\nEND`;
      return await this.raw(sql, { split: false });
   }

   async getUsers () {
      const { rows } = await this.raw('SELECT name AS user FROM sys.database_principals WHERE type IN (\'S\',\'U\',\'G\') ORDER BY name');
      return rows.map((row: any) => ({ user: row.user }));
   }

   async getProcesses () {
      const sql = `
         SELECT
            s.session_id AS pid,
            s.login_name AS usename,
            c.client_net_address AS client_addr,
            DB_NAME(s.database_id) AS datname,
            s.program_name AS application_name,
            DATEDIFF(SECOND, s.last_request_start_time, GETDATE()) AS elapsed_seconds,
            s.status,
            t.text AS query
         FROM sys.dm_exec_sessions s
         LEFT JOIN sys.dm_exec_connections c ON s.session_id = c.session_id
         OUTER APPLY sys.dm_exec_sql_text(c.most_recent_sql_handle) t
         WHERE s.is_user_process = 1
      `;

      const { rows } = await this.raw(sql);

      return rows.map(row => {
         return {
            id: row.pid,
            user: row.usename,
            host: row.client_addr,
            database: row.datname,
            application: row.application_name,
            time: row.elapsed_seconds,
            state: row.status,
            info: row.query || ''
         };
      });
   }

   async killProcess (id: number) {
      return await this.raw(`KILL ${id}`);
   }

   async destroyConnectionToCommit (tabUid: string) {
      const transaction = this._connectionsToCommit.get(tabUid);
      if (transaction) {
         try { await transaction.rollback(); } catch (_) {}
         this._connectionsToCommit.delete(tabUid);
      }
   }

   async getDatabaseCollation (database: string) {
      const { rows } = await this.raw(`SELECT DATABASEPROPERTYEX('${database}', 'Collation') AS collation`);
      return rows.length ? rows[0].collation : '';
   }

   async getMaterializedViewInformations () {
      return { rows: [] };
   }

   async dropMaterializedView () {
      throw new Error('Materialized views are not supported in SQL Server');
   }

   async createMaterializedView () {
      throw new Error('Materialized views are not supported in SQL Server');
   }

   async alterMaterializedView () {
      throw new Error('Materialized views are not supported in SQL Server');
   }

   async alterTriggerFunction () {
      throw new Error('Trigger functions are not supported in SQL Server');
   }

   async createTriggerFunction () {
      throw new Error('Trigger functions are not supported in SQL Server');
   }

   async getEventInformations () {
      return { rows: [] };
   }

   async dropEvent () {
      throw new Error('Events/schedulers are not supported in SQL Server');
   }

   async alterEvent () {
      throw new Error('Events/schedulers are not supported in SQL Server');
   }

   async createEvent () {
      throw new Error('Events/schedulers are not supported in SQL Server');
   }

   async enableEvent () {
      throw new Error('Events/schedulers are not supported in SQL Server');
   }

   async disableEvent () {
      throw new Error('Events/schedulers are not supported in SQL Server');
   }

   async killTabQuery (tabUid: string) {
      const request = this._runningConnections.get(tabUid);
      if (request) {
         request.cancel();
         this._runningConnections.delete(tabUid);
      }
   }

   async commitTab (tabUid: string) {
      const transaction = this._connectionsToCommit.get(tabUid);
      if (transaction) {
         await transaction.commit();
         this._connectionsToCommit.delete(tabUid);
      }
   }

   async rollbackTab (tabUid: string) {
      const transaction = this._connectionsToCommit.get(tabUid);
      if (transaction) {
         await transaction.rollback();
         this._connectionsToCommit.delete(tabUid);
      }
   }

   getSQL () {
      // SELECT
      const selectArray = this._query.select.reduce(this._reducer, []);
      let selectRaw = '';

      if (selectArray.length)
         selectRaw = selectArray.length ? `SELECT ${selectArray.join(', ')} ` : 'SELECT * ';

      // FROM
      let fromRaw = '';

      if (!this._query.update.length && !Object.keys(this._query.insert).length && !!this._query.from)
         fromRaw = 'FROM';
      else if (Object.keys(this._query.insert).length)
         fromRaw = 'INTO';

      fromRaw += this._query.from ? ` ${this._query.schema ? `[${this._query.schema}].` : ''}[${this._query.from}] ` : '';

      // WHERE
      const whereArray = this._query.where.reduce(this._reducer, []);
      const whereRaw = whereArray.length ? `WHERE ${whereArray.join(' AND ')} ` : '';

      // UPDATE
      const updateArray = this._query.update.reduce(this._reducer, []);
      const updateRaw = updateArray.length ? `SET ${updateArray.join(', ')} ` : '';

      // INSERT
      let insertRaw = '';

      if (this._query.insert.length) {
         const fieldsList = Object.keys(this._query.insert[0]).map(f => `[${f}]`);
         const rowsList = this._query.insert.map(el => `(${Object.values(el).join(', ')})`);

         insertRaw = `(${fieldsList.join(', ')}) VALUES ${rowsList.join(', ')} `;
      }

      // GROUP BY
      const groupByArray = this._query.groupBy.reduce(this._reducer, []);
      const groupByRaw = groupByArray.length ? `GROUP BY ${groupByArray.join(', ')} ` : '';

      // ORDER BY
      const orderByArray = this._query.orderBy.reduce(this._reducer, []);
      const orderByRaw = orderByArray.length ? `ORDER BY ${orderByArray.join(', ')} ` : '';

      // LIMIT + OFFSET (SQL Server uses OFFSET ... FETCH NEXT ... ROWS ONLY, requires ORDER BY)
      let limitOffsetRaw = '';
      if (selectArray.length && this._query.limit) {
         // SQL Server requires ORDER BY for OFFSET/FETCH
         const needsOrderBy = !orderByRaw;
         if (needsOrderBy)
            limitOffsetRaw += 'ORDER BY (SELECT NULL) ';

         limitOffsetRaw += `OFFSET ${this._query.offset || 0} ROWS FETCH NEXT ${this._query.limit} ROWS ONLY `;
      }
      else if (selectArray.length && this._query.offset) {
         const needsOrderBy = !orderByRaw;
         if (needsOrderBy)
            limitOffsetRaw += 'ORDER BY (SELECT NULL) ';

         limitOffsetRaw += `OFFSET ${this._query.offset} ROWS `;
      }

      return `${selectRaw}${updateRaw ? 'UPDATE' : ''}${insertRaw ? 'INSERT ' : ''}${this._query.delete ? 'DELETE ' : ''}${fromRaw}${updateRaw}${whereRaw}${groupByRaw}${orderByRaw}${limitOffsetRaw}${insertRaw}`;
   }

   async raw<T = antares.QueryResult> (sql: string, args?: antares.QueryParams) {
      this._logger({ cUid: this._cUid, content: sql, level: 'query' });

      args = {
         nest: false,
         details: false,
         split: true,
         comments: true,
         autocommit: true,
         ...args
      };

      if (!args.comments)
         sql = removeComments(sql);

      const resultsArr: antares.QueryResult[] = [];
      const queries = args.split
         ? this._querySplitter(sql, 'mssql')
         : [sql];

      let request: mssql.Request;

      if (!args.autocommit && args.tabUid) {
         // autocommit OFF — use transaction
         let transaction = this._connectionsToCommit.get(args.tabUid);
         if (!transaction) {
            transaction = new mssql.Transaction(this._connection);
            await transaction.begin();
            this._connectionsToCommit.set(args.tabUid, transaction);
         }
         request = new mssql.Request(transaction);
      }
      else {
         request = new mssql.Request(this._connection);
      }

      if (args.tabUid)
         this._runningConnections.set(args.tabUid, request);

      for (const query of queries) {
         if (!query) continue;

         const timeStart = new Date();
         let keysArr: antares.QueryForeign[] = [];

         try {
            const res = await request.query(query);
            const timeStop = new Date();

            const queryResult = res.recordset || [];
            let remappedFields: antares.TableField[] = [];

            if (res.recordset && res.recordset.columns) {
               const columns = res.recordset.columns;
               remappedFields = Object.keys(columns).map(colName => {
                  const col = columns[colName];
                  return {
                     name: colName,
                     alias: colName,
                     schema: this._schema || '',
                     table: '',
                     orgTable: '',
                     tableAlias: '',
                     type: (col.type?.declaration || col.type?.name || '').toUpperCase(),
                     length: col.length || undefined,
                     key: undefined
                  } as antares.TableField;
               });
            }

            if (args.details && remappedFields.length) {
               // Try to extract table info from query for field details
               const fromMatch = query.match(/FROM\s+\[?(\w+)\]?\.\[?(\w+)\]?/i);
               if (fromMatch) {
                  const paramObj = { schema: fromMatch[1], table: fromMatch[2] };

                  try {
                     const columns = await this.getTableColumns(paramObj);
                     const indexes = await this.getTableIndexes(paramObj);

                     remappedFields = remappedFields.map(field => {
                        const detailedField = columns.find(f => f.name === field.name);
                        const fieldIndex = indexes.find(i => i.column === field.name);

                        if (detailedField) {
                           const length = detailedField.numPrecision || detailedField.charLength || detailedField.datePrecision || null;
                           field = { ...field, ...detailedField, length };
                        }

                        if (fieldIndex) {
                           const key = fieldIndex.type === 'PRIMARY' ? 'pri' : fieldIndex.type === 'UNIQUE' ? 'uni' : 'mul';
                           field = { ...field, key } as antares.TableField;
                        }

                        return field;
                     });

                     try {
                        const response = await this.getKeyUsage(paramObj);
                        keysArr = [...keysArr, ...response];
                     }
                     catch (_) { /* ignore */ }
                  }
                  catch (_) { /* ignore */ }
               }
            }

            resultsArr.push({
               rows: queryResult,
               report: { affectedRows: res.rowsAffected?.[0] || 0 },
               fields: remappedFields,
               keys: keysArr,
               duration: timeStop.getTime() - timeStart.getTime()
            });
         }
         catch (err) {
            if (args.tabUid)
               this._runningConnections.delete(args.tabUid);
            throw err;
         }
      }

      if (args.tabUid)
         this._runningConnections.delete(args.tabUid);

      const result = resultsArr.length === 1 ? resultsArr[0] : resultsArr;
      return result as unknown as T;
   }
}
