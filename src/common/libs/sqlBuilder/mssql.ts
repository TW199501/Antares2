/**
 * SQL Server (mssql) single-table query builder.
 *
 * Mirrors the bracket-quoting + single-quote-escape logic used in
 * src/main/libs/clients/SQLServerClient.ts (_bid / _esc) so that the
 * renderer-side builder produces identifiers compatible with what the
 * sidecar will execute.
 *
 * MVP scope: SELECT only, single table, simple WHERE conditions.
 * No UPDATE/DELETE/INSERT generation here — those flow through the
 * raw-SQL textarea in ModalQueryBuilder, not the visual builder.
 */

export type SqlOperator =
   | '='
   | '<>'
   | '<'
   | '<='
   | '>'
   | '>='
   | 'LIKE'
   | 'NOT LIKE'
   | 'IN'
   | 'NOT IN'
   | 'IS NULL'
   | 'IS NOT NULL'
   | 'BETWEEN';

export type SqlValueKind = 'string' | 'number' | 'datetime' | 'raw';

export interface SqlCondition {
   field: string;
   op: SqlOperator;
   value?: string;
   value2?: string;
   valueKind?: SqlValueKind;
   active?: boolean;
}

export interface SqlOrderBy {
   field: string;
   direction: 'ASC' | 'DESC';
}

export interface BuildSingleTableInput {
   schema?: string;
   table: string;
   fields?: string[];
   conditions?: SqlCondition[];
   orderBy?: SqlOrderBy[];
   limit?: number;
}

export const quoteMssqlIdent = (name: string): string => {
   return '[' + name.replace(/]/g, ']]') + ']';
};

export const escapeMssqlString = (value: string): string => {
   return value.replace(/'/g, '\'\'');
};

const formatValue = (raw: string, kind: SqlValueKind = 'string'): string => {
   switch (kind) {
      case 'number':
         return raw;
      case 'raw':
         return raw;
      case 'datetime':
      case 'string':
      default:
         return `'${escapeMssqlString(raw)}'`;
   }
};

const formatCondition = (cond: SqlCondition): string | null => {
   if (cond.active === false) return null;
   if (!cond.field) return null;

   const col = quoteMssqlIdent(cond.field);
   const kind = cond.valueKind ?? 'string';

   switch (cond.op) {
      case 'IS NULL':
         return `${col} IS NULL`;
      case 'IS NOT NULL':
         return `${col} IS NOT NULL`;
      case 'BETWEEN':
         if (cond.value === undefined || cond.value2 === undefined) return null;
         return `${col} BETWEEN ${formatValue(cond.value, kind)} AND ${formatValue(cond.value2, kind)}`;
      case 'IN':
      case 'NOT IN':
         if (!cond.value) return null;
         // User input expected as comma-separated values; we wrap in (...) and
         // quote each segment based on kind. If kind is 'raw' the user is
         // responsible for the entire list including parentheses.
         if (kind === 'raw')
            return `${col} ${cond.op} ${cond.value}`;
         {
            const parts = cond.value
               .split(',')
               .map(s => s.trim())
               .filter(Boolean)
               .map(v => formatValue(v, kind));
            if (!parts.length) return null;
            return `${col} ${cond.op} (${parts.join(', ')})`;
         }
      case 'LIKE':
      case 'NOT LIKE':
         if (cond.value === undefined) return null;
         // LIKE always quoted; user includes their own % wildcards.
         return `${col} ${cond.op} ${formatValue(cond.value, 'string')}`;
      default:
         if (cond.value === undefined) return null;
         return `${col} ${cond.op} ${formatValue(cond.value, kind)}`;
   }
};

export const buildSingleTableSql = (input: BuildSingleTableInput): string => {
   if (!input.table) throw new Error('table is required');

   const schema = input.schema?.trim() || 'dbo';
   const tableRef = `${quoteMssqlIdent(schema)}.${quoteMssqlIdent(input.table)}`;

   const fieldsSelect = (input.fields && input.fields.length)
      ? input.fields.map(quoteMssqlIdent).join(', ')
      : '*';

   const top = (typeof input.limit === 'number' && input.limit > 0)
      ? `TOP (${Math.floor(input.limit)}) `
      : '';

   let sql = `SELECT ${top}${fieldsSelect}\nFROM ${tableRef}`;

   const whereClauses = (input.conditions ?? [])
      .map(formatCondition)
      .filter((c): c is string => c !== null);

   if (whereClauses.length)
      sql += `\nWHERE ${whereClauses.join('\n  AND ')}`;

   const orderClauses = (input.orderBy ?? [])
      .filter(o => o.field)
      .map(o => `${quoteMssqlIdent(o.field)} ${o.direction}`);

   if (orderClauses.length)
      sql += `\nORDER BY ${orderClauses.join(', ')}`;

   return sql + ';';
};
