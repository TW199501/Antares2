/**
 * Characterization tests for SQL Server single-table query builder.
 *
 * Locks the .NET 10 contract:
 *  - quoteMssqlIdent: wraps in [brackets]; ']' inside name is doubled to ']]'.
 *  - escapeMssqlString: doubles single quotes, leaves other chars alone.
 *  - buildSingleTableSql: SELECT-only, "<schema>.<table>" with default schema=dbo,
 *    TOP (n) for limit, fields joined as bracket-quoted CSV (or '*'),
 *    WHERE clauses joined by '\n  AND ' with op-specific formatting,
 *    ORDER BY joined with ', ', trailing ';'.
 *  - Empty / undefined value on common ops → condition skipped (form-cleared = inactive).
 *  - 'raw' valueKind passes through verbatim (no quoting).
 *  - active === false skips the condition; field falsy skips the condition.
 */
import { describe, expect, it } from 'vitest';

import {
   buildSingleTableSql,
   escapeMssqlString,
   quoteMssqlIdent,
   type SqlCondition
} from './mssql';

describe('quoteMssqlIdent', () => {
   it('wraps simple identifiers in brackets', () => {
      expect(quoteMssqlIdent('Users')).toBe('[Users]');
   });

   it('preserves spaces inside identifier', () => {
      expect(quoteMssqlIdent('Order Details')).toBe('[Order Details]');
   });

   it('preserves reserved-word-looking identifiers', () => {
      expect(quoteMssqlIdent('Order')).toBe('[Order]');
   });

   it('escapes a single closing bracket as ]]', () => {
      expect(quoteMssqlIdent('weird]name')).toBe('[weird]]name]');
   });

   it('escapes multiple closing brackets', () => {
      expect(quoteMssqlIdent('a]b]c')).toBe('[a]]b]]c]');
   });

   it('leaves opening brackets alone', () => {
      expect(quoteMssqlIdent('a[b')).toBe('[a[b]');
   });

   it('handles empty string identifier (degenerate but well-defined)', () => {
      expect(quoteMssqlIdent('')).toBe('[]');
   });

   it('preserves Unicode (CJK) identifiers', () => {
      expect(quoteMssqlIdent('使用者')).toBe('[使用者]');
   });
});

describe('escapeMssqlString', () => {
   it('doubles single quotes', () => {
      expect(escapeMssqlString('O\'Brien')).toBe('O\'\'Brien');
   });

   it('doubles every single quote', () => {
      expect(escapeMssqlString('a\'b\'c')).toBe('a\'\'b\'\'c');
   });

   it('does not touch double quotes', () => {
      expect(escapeMssqlString('say "hi"')).toBe('say "hi"');
   });

   it('does not touch backticks, semicolons, dashes', () => {
      expect(escapeMssqlString('`a`;b--c')).toBe('`a`;b--c');
   });

   it('does not touch backslashes (T-SQL is not C-style)', () => {
      expect(escapeMssqlString('a\\b')).toBe('a\\b');
   });

   it('handles empty string', () => {
      expect(escapeMssqlString('')).toBe('');
   });

   it('preserves CJK', () => {
      expect(escapeMssqlString('王二麻子')).toBe('王二麻子');
   });
});

describe('buildSingleTableSql — basics', () => {
   it('throws when table is missing', () => {
      expect(() => buildSingleTableSql({ table: '' })).toThrow(/table is required/);
   });

   it('defaults schema to dbo, fields to *', () => {
      expect(buildSingleTableSql({ table: 'Users' }))
         .toBe('SELECT *\nFROM [dbo].[Users];');
   });

   it('uses the provided schema (trims whitespace)', () => {
      expect(buildSingleTableSql({ schema: '  sales  ', table: 'Orders' }))
         .toBe('SELECT *\nFROM [sales].[Orders];');
   });

   it('falls back to dbo when schema is whitespace-only', () => {
      expect(buildSingleTableSql({ schema: '   ', table: 'T' }))
         .toBe('SELECT *\nFROM [dbo].[T];');
   });

   it('quotes each field and joins with ", "', () => {
      expect(buildSingleTableSql({ table: 'Users', fields: ['Id', 'Name'] }))
         .toBe('SELECT [Id], [Name]\nFROM [dbo].[Users];');
   });

   it('uses * when fields array is empty', () => {
      expect(buildSingleTableSql({ table: 'Users', fields: [] }))
         .toBe('SELECT *\nFROM [dbo].[Users];');
   });

   it('escapes ] inside table / schema / field identifiers', () => {
      const sql = buildSingleTableSql({
         schema: 's]1',
         table: 't]2',
         fields: ['c]3']
      });
      expect(sql).toBe('SELECT [c]]3]\nFROM [s]]1].[t]]2];');
   });
});

describe('buildSingleTableSql — TOP / limit', () => {
   it('adds TOP (n) when limit > 0', () => {
      expect(buildSingleTableSql({ table: 'T', limit: 10 }))
         .toBe('SELECT TOP (10) *\nFROM [dbo].[T];');
   });

   it('floors fractional limits', () => {
      expect(buildSingleTableSql({ table: 'T', limit: 10.9 }))
         .toBe('SELECT TOP (10) *\nFROM [dbo].[T];');
   });

   it('omits TOP when limit is 0', () => {
      expect(buildSingleTableSql({ table: 'T', limit: 0 }))
         .toBe('SELECT *\nFROM [dbo].[T];');
   });

   it('omits TOP when limit is negative', () => {
      expect(buildSingleTableSql({ table: 'T', limit: -5 }))
         .toBe('SELECT *\nFROM [dbo].[T];');
   });

   it('omits TOP when limit is undefined', () => {
      expect(buildSingleTableSql({ table: 'T' }))
         .toBe('SELECT *\nFROM [dbo].[T];');
   });
});

describe('buildSingleTableSql — WHERE conditions', () => {
   it('emits = with quoted string by default', () => {
      const conds: SqlCondition[] = [{ field: 'Name', op: '=', value: 'O\'Brien' }];
      expect(buildSingleTableSql({ table: 'Users', conditions: conds }))
         .toBe('SELECT *\nFROM [dbo].[Users]\nWHERE [Name] = \'O\'\'Brien\';');
   });

   it('emits number kind un-quoted', () => {
      const conds: SqlCondition[] = [{ field: 'Age', op: '>=', value: '18', valueKind: 'number' }];
      expect(buildSingleTableSql({ table: 'Users', conditions: conds }))
         .toBe('SELECT *\nFROM [dbo].[Users]\nWHERE [Age] >= 18;');
   });

   it('emits raw kind verbatim', () => {
      const conds: SqlCondition[] = [
         { field: 'CreatedAt', op: '>', value: 'GETDATE()', valueKind: 'raw' }
      ];
      expect(buildSingleTableSql({ table: 'T', conditions: conds }))
         .toBe('SELECT *\nFROM [dbo].[T]\nWHERE [CreatedAt] > GETDATE();');
   });

   it('emits datetime kind quoted (string-style)', () => {
      const conds: SqlCondition[] = [
         { field: 'CreatedAt', op: '=', value: '2026-05-03', valueKind: 'datetime' }
      ];
      expect(buildSingleTableSql({ table: 'T', conditions: conds }))
         .toBe('SELECT *\nFROM [dbo].[T]\nWHERE [CreatedAt] = \'2026-05-03\';');
   });

   it('IS NULL / IS NOT NULL emit no value', () => {
      const conds: SqlCondition[] = [
         { field: 'A', op: 'IS NULL' },
         { field: 'B', op: 'IS NOT NULL' }
      ];
      expect(buildSingleTableSql({ table: 'T', conditions: conds }))
         .toBe('SELECT *\nFROM [dbo].[T]\nWHERE [A] IS NULL\n  AND [B] IS NOT NULL;');
   });

   it('BETWEEN with string kind quotes both bounds', () => {
      const conds: SqlCondition[] = [
         { field: 'Name', op: 'BETWEEN', value: 'a', value2: 'm' }
      ];
      expect(buildSingleTableSql({ table: 'T', conditions: conds }))
         .toBe('SELECT *\nFROM [dbo].[T]\nWHERE [Name] BETWEEN \'a\' AND \'m\';');
   });

   it('BETWEEN with number kind leaves bounds un-quoted', () => {
      const conds: SqlCondition[] = [
         { field: 'Age', op: 'BETWEEN', value: '18', value2: '65', valueKind: 'number' }
      ];
      expect(buildSingleTableSql({ table: 'T', conditions: conds }))
         .toBe('SELECT *\nFROM [dbo].[T]\nWHERE [Age] BETWEEN 18 AND 65;');
   });

   it('BETWEEN skips when either bound is empty (form-cleared = inactive)', () => {
      const a: SqlCondition[] = [{ field: 'X', op: 'BETWEEN', value: '', value2: '5' }];
      const b: SqlCondition[] = [{ field: 'X', op: 'BETWEEN', value: '5', value2: '' }];
      expect(buildSingleTableSql({ table: 'T', conditions: a }))
         .toBe('SELECT *\nFROM [dbo].[T];');
      expect(buildSingleTableSql({ table: 'T', conditions: b }))
         .toBe('SELECT *\nFROM [dbo].[T];');
   });

   it('IN splits on comma, trims, drops blanks, quotes each', () => {
      const conds: SqlCondition[] = [
         { field: 'Status', op: 'IN', value: 'active,  inactive , ,pending' }
      ];
      expect(buildSingleTableSql({ table: 'T', conditions: conds }))
         .toBe('SELECT *\nFROM [dbo].[T]\nWHERE [Status] IN (\'active\', \'inactive\', \'pending\');');
   });

   it('IN with number kind un-quotes each part', () => {
      const conds: SqlCondition[] = [
         { field: 'Id', op: 'IN', value: '1,2,3', valueKind: 'number' }
      ];
      expect(buildSingleTableSql({ table: 'T', conditions: conds }))
         .toBe('SELECT *\nFROM [dbo].[T]\nWHERE [Id] IN (1, 2, 3);');
   });

   it('NOT IN raw kind passes the entire value through verbatim', () => {
      const conds: SqlCondition[] = [
         { field: 'Id', op: 'NOT IN', value: '(SELECT Id FROM Banned)', valueKind: 'raw' }
      ];
      expect(buildSingleTableSql({ table: 'T', conditions: conds }))
         .toBe('SELECT *\nFROM [dbo].[T]\nWHERE [Id] NOT IN (SELECT Id FROM Banned);');
   });

   it('IN skips when value is empty', () => {
      const conds: SqlCondition[] = [{ field: 'X', op: 'IN', value: '' }];
      expect(buildSingleTableSql({ table: 'T', conditions: conds }))
         .toBe('SELECT *\nFROM [dbo].[T];');
   });

   it('IN skips when value parses to no usable parts (only commas)', () => {
      const conds: SqlCondition[] = [{ field: 'X', op: 'IN', value: ' , , ' }];
      expect(buildSingleTableSql({ table: 'T', conditions: conds }))
         .toBe('SELECT *\nFROM [dbo].[T];');
   });

   it('LIKE always quotes (forces string kind)', () => {
      const conds: SqlCondition[] = [
         { field: 'Name', op: 'LIKE', value: 'A%', valueKind: 'number' as const }
      ];
      expect(buildSingleTableSql({ table: 'T', conditions: conds }))
         .toBe('SELECT *\nFROM [dbo].[T]\nWHERE [Name] LIKE \'A%\';');
   });

   it('NOT LIKE escapes single-quotes in the pattern', () => {
      const conds: SqlCondition[] = [
         { field: 'Name', op: 'NOT LIKE', value: 'O\'%' }
      ];
      expect(buildSingleTableSql({ table: 'T', conditions: conds }))
         .toBe('SELECT *\nFROM [dbo].[T]\nWHERE [Name] NOT LIKE \'O\'\'%\';');
   });

   it('LIKE skips when value is empty', () => {
      const conds: SqlCondition[] = [{ field: 'X', op: 'LIKE', value: '' }];
      expect(buildSingleTableSql({ table: 'T', conditions: conds }))
         .toBe('SELECT *\nFROM [dbo].[T];');
   });

   it('default-branch ops skip when value is empty', () => {
      const conds: SqlCondition[] = [{ field: 'X', op: '=', value: '' }];
      expect(buildSingleTableSql({ table: 'T', conditions: conds }))
         .toBe('SELECT *\nFROM [dbo].[T];');
   });

   it('skips conditions where active === false', () => {
      const conds: SqlCondition[] = [
         { field: 'A', op: '=', value: '1', active: false },
         { field: 'B', op: '=', value: '2', active: true }
      ];
      expect(buildSingleTableSql({ table: 'T', conditions: conds }))
         .toBe('SELECT *\nFROM [dbo].[T]\nWHERE [B] = \'2\';');
   });

   it('skips conditions with empty / falsy field', () => {
      const conds: SqlCondition[] = [{ field: '', op: '=', value: 'x' }];
      expect(buildSingleTableSql({ table: 'T', conditions: conds }))
         .toBe('SELECT *\nFROM [dbo].[T];');
   });

   it('joins multiple WHERE clauses with newline + 2-space AND', () => {
      const conds: SqlCondition[] = [
         { field: 'A', op: '=', value: '1', valueKind: 'number' },
         { field: 'B', op: '<>', value: '2', valueKind: 'number' },
         { field: 'C', op: 'IS NULL' }
      ];
      expect(buildSingleTableSql({ table: 'T', conditions: conds }))
         .toBe('SELECT *\nFROM [dbo].[T]\nWHERE [A] = 1\n  AND [B] <> 2\n  AND [C] IS NULL;');
   });

   it('escapes ] inside the field identifier of a condition', () => {
      const conds: SqlCondition[] = [{ field: 'we]ird', op: '=', value: 'x' }];
      expect(buildSingleTableSql({ table: 'T', conditions: conds }))
         .toBe('SELECT *\nFROM [dbo].[T]\nWHERE [we]]ird] = \'x\';');
   });
});

describe('buildSingleTableSql — ORDER BY', () => {
   it('emits a single ORDER BY column with direction', () => {
      expect(buildSingleTableSql({
         table: 'T',
         orderBy: [{ field: 'Name', direction: 'ASC' }]
      }))
         .toBe('SELECT *\nFROM [dbo].[T]\nORDER BY [Name] ASC;');
   });

   it('joins multiple ORDER BY columns with ", "', () => {
      expect(buildSingleTableSql({
         table: 'T',
         orderBy: [
            { field: 'A', direction: 'ASC' },
            { field: 'B', direction: 'DESC' }
         ]
      }))
         .toBe('SELECT *\nFROM [dbo].[T]\nORDER BY [A] ASC, [B] DESC;');
   });

   it('skips order-by entries with empty field', () => {
      expect(buildSingleTableSql({
         table: 'T',
         orderBy: [
            { field: '', direction: 'ASC' },
            { field: 'B', direction: 'DESC' }
         ]
      }))
         .toBe('SELECT *\nFROM [dbo].[T]\nORDER BY [B] DESC;');
   });

   it('emits no ORDER BY clause when all entries are skipped', () => {
      expect(buildSingleTableSql({
         table: 'T',
         orderBy: [{ field: '', direction: 'ASC' }]
      }))
         .toBe('SELECT *\nFROM [dbo].[T];');
   });
});

describe('buildSingleTableSql — full composition', () => {
   it('composes schema + fields + TOP + WHERE + ORDER BY in correct order', () => {
      const sql = buildSingleTableSql({
         schema: 'sales',
         table: 'Orders',
         fields: ['Id', 'Customer', 'Total'],
         limit: 50,
         conditions: [
            { field: 'Total', op: '>=', value: '100', valueKind: 'number' },
            { field: 'Customer', op: 'LIKE', value: '%Inc%' }
         ],
         orderBy: [
            { field: 'Total', direction: 'DESC' },
            { field: 'Id', direction: 'ASC' }
         ]
      });
      expect(sql).toBe(
         'SELECT TOP (50) [Id], [Customer], [Total]\n' +
         'FROM [sales].[Orders]\n' +
         'WHERE [Total] >= 100\n  AND [Customer] LIKE \'%Inc%\'\n' +
         'ORDER BY [Total] DESC, [Id] ASC;'
      );
   });
});
