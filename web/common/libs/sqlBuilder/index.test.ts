/**
 * Characterization tests for sqlBuilder/index.ts dispatcher.
 *
 * Locks current behavior:
 *  - Only 'mssql' is implemented; output matches mssql.buildSingleTableSql.
 *  - All other ClientCode values throw NotImplementedError with message format:
 *      `SQL builder mode '<mode>' is not yet implemented for client '<client>'.`
 *  - NotImplementedError extends Error and has name === 'NotImplementedError'.
 */
import { describe, expect, it } from 'vitest';

import { buildSingleTableSql, NotImplementedError } from './index';
import { buildSingleTableSql as buildMssqlSingleTable } from './mssql';

describe('sqlBuilder/index — buildSingleTableSql', () => {
   it('routes mssql to the SQL Server implementation', () => {
      const input = { table: 'Users', fields: ['Id'] };
      expect(buildSingleTableSql('mssql', input)).toBe(buildMssqlSingleTable(input));
   });

   it('mssql route produces real bracket-quoted SQL', () => {
      expect(buildSingleTableSql('mssql', { table: 'Users' }))
         .toBe('SELECT *\nFROM [dbo].[Users];');
   });

   it.each(['mysql', 'maria', 'pg', 'sqlite', 'firebird'] as const)(
      'throws NotImplementedError for %s',
      (client) => {
         expect(() => buildSingleTableSql(client, { table: 'X' }))
            .toThrow(NotImplementedError);
      }
   );

   it('error message identifies mode and client', () => {
      try {
         buildSingleTableSql('mysql', { table: 'X' });
         throw new Error('should have thrown');
      }
      catch (e) {
         expect(e).toBeInstanceOf(NotImplementedError);
         expect((e as Error).message).toBe(
            'SQL builder mode \'single-table\' is not yet implemented for client \'mysql\'.'
         );
         expect((e as Error).name).toBe('NotImplementedError');
      }
   });
});

describe('NotImplementedError', () => {
   it('extends Error', () => {
      const err = new NotImplementedError('pg', 'foo');
      expect(err).toBeInstanceOf(Error);
   });

   it('sets name = NotImplementedError', () => {
      expect(new NotImplementedError('pg', 'foo').name).toBe('NotImplementedError');
   });

   it('formats message with client + mode', () => {
      expect(new NotImplementedError('sqlite', 'multi-table').message)
         .toBe('SQL builder mode \'multi-table\' is not yet implemented for client \'sqlite\'.');
   });
});
