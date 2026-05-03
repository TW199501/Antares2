/**
 * Contract replay tests for Tables IPC wrapper.
 *
 * Covers all 18 static methods on the default-exported class. Each test
 * stubs `apiCall` with `mockResolvedValueOnce`, invokes the wrapper, and
 * asserts (a) the exact route string and (b) pass-through payload &
 * response. Two methods (getTableData, getTableColumns) replay captured
 * MSSQL fixtures from tests/fixtures/contract/. The rest use inline
 * payloads inferred from the wrapper source signature.
 */
import getTableColumnsFixture from '@tests/fixtures/contract/tables.getTableColumns.mssql.happy.json';
import getTableDataFixture from '@tests/fixtures/contract/tables.getTableData.mssql.happy.json';
import { describe, expect, it, vi } from 'vitest';

import { apiCall } from '@/ipc-api/httpClient';

import Tables from './Tables';

describe('Tables.getTableColumns (contract replay — mssql happy)', () => {
   it('routes to /api/tables/getColumns and returns the response body', async () => {
      vi.mocked(apiCall).mockResolvedValueOnce(getTableColumnsFixture.response.body);

      const result = await Tables.getTableColumns(getTableColumnsFixture.request.payload);

      expect(apiCall).toHaveBeenCalledWith(
         getTableColumnsFixture.request.route,
         getTableColumnsFixture.request.payload
      );
      expect(result).toEqual(getTableColumnsFixture.response.body);
   });
});

describe('Tables.getTableData (contract replay — mssql happy)', () => {
   it('routes to /api/tables/getData and returns the response body', async () => {
      vi.mocked(apiCall).mockResolvedValueOnce(getTableDataFixture.response.body);

      // JSON imports widen string literals; sortParams.dir narrowing is asserted via cast.
      const payload = getTableDataFixture.request.payload as Parameters<typeof Tables.getTableData>[0];
      const result = await Tables.getTableData(payload);

      expect(apiCall).toHaveBeenCalledWith(
         getTableDataFixture.request.route,
         payload
      );
      expect(result).toEqual(getTableDataFixture.response.body);
   });
});

describe('Tables.searchColumns', () => {
   it('routes to /api/tables/searchColumns', async () => {
      const mocked = { status: 'success', response: [{ name: 'id', table: 'users' }] };
      vi.mocked(apiCall).mockResolvedValueOnce(mocked);
      const payload = { uid: 'u', schema: 'dbo', search: 'id' };

      const result = await Tables.searchColumns(payload);

      expect(apiCall).toHaveBeenCalledWith('/api/tables/searchColumns', payload);
      expect(result).toEqual(mocked);
   });
});

describe('Tables.getTableApproximateCount', () => {
   it('routes to /api/tables/getCount', async () => {
      const mocked = { status: 'success', response: 1234 };
      vi.mocked(apiCall).mockResolvedValueOnce(mocked);
      const payload = { uid: 'u', schema: 'dbo', table: 'users' };

      const result = await Tables.getTableApproximateCount(payload);

      expect(apiCall).toHaveBeenCalledWith('/api/tables/getCount', payload);
      expect(result).toEqual(mocked);
   });
});

describe('Tables.getTableOptions', () => {
   it('routes to /api/tables/getOptions', async () => {
      const mocked = { status: 'success', response: { name: 'users', engine: null } };
      vi.mocked(apiCall).mockResolvedValueOnce(mocked);
      const payload = { uid: 'u', schema: 'dbo', table: 'users' };

      const result = await Tables.getTableOptions(payload);

      expect(apiCall).toHaveBeenCalledWith('/api/tables/getOptions', payload);
      expect(result).toEqual(mocked);
   });
});

describe('Tables.getTableIndexes', () => {
   it('routes to /api/tables/getIndexes', async () => {
      const mocked = { status: 'success', response: [] };
      vi.mocked(apiCall).mockResolvedValueOnce(mocked);
      const payload = { uid: 'u', schema: 'dbo', table: 'users' };

      const result = await Tables.getTableIndexes(payload);

      expect(apiCall).toHaveBeenCalledWith('/api/tables/getIndexes', payload);
      expect(result).toEqual(mocked);
   });
});

describe('Tables.getTableChecks', () => {
   it('routes to /api/tables/getChecks', async () => {
      const mocked = { status: 'success', response: [] };
      vi.mocked(apiCall).mockResolvedValueOnce(mocked);
      const payload = { uid: 'u', schema: 'dbo', table: 'users' };

      const result = await Tables.getTableChecks(payload);

      expect(apiCall).toHaveBeenCalledWith('/api/tables/getChecks', payload);
      expect(result).toEqual(mocked);
   });
});

describe('Tables.getTableDll', () => {
   it('routes to /api/tables/getDdl', async () => {
      const mocked = { status: 'success', response: 'CREATE TABLE users (...)' };
      vi.mocked(apiCall).mockResolvedValueOnce(mocked);
      const payload = { uid: 'u', schema: 'dbo', table: 'users' };

      const result = await Tables.getTableDll(payload);

      expect(apiCall).toHaveBeenCalledWith('/api/tables/getDdl', payload);
      expect(result).toEqual(mocked);
   });
});

describe('Tables.getKeyUsage', () => {
   it('routes to /api/tables/getKeyUsage', async () => {
      const mocked = { status: 'success', response: [] };
      vi.mocked(apiCall).mockResolvedValueOnce(mocked);
      const payload = { uid: 'u', schema: 'dbo', table: 'users' };

      const result = await Tables.getKeyUsage(payload);

      expect(apiCall).toHaveBeenCalledWith('/api/tables/getKeyUsage', payload);
      expect(result).toEqual(mocked);
   });
});

describe('Tables.updateTableCell', () => {
   it('routes to /api/tables/updateCell', async () => {
      const mocked = { status: 'success', response: { affectedRows: 1 } };
      vi.mocked(apiCall).mockResolvedValueOnce(mocked);
      const payload = {
         uid: 'u',
         schema: 'dbo',
         table: 'users',
         primary: 'id',
         id: 1,
         content: 'Alice',
         type: 'NVARCHAR',
         field: 'name'
      };

      const result = await Tables.updateTableCell(payload);

      expect(apiCall).toHaveBeenCalledWith('/api/tables/updateCell', payload);
      expect(result).toEqual(mocked);
   });
});

describe('Tables.deleteTableRows', () => {
   it('routes to /api/tables/deleteRows', async () => {
      const mocked = { status: 'success', response: { affectedRows: 2 } };
      vi.mocked(apiCall).mockResolvedValueOnce(mocked);
      const payload = {
         uid: 'u',
         schema: 'dbo',
         table: 'users',
         primary: 'id',
         field: 'id',
         rows: { 0: { id: 1 }, 1: { id: 2 } }
      };

      const result = await Tables.deleteTableRows(payload);

      expect(apiCall).toHaveBeenCalledWith('/api/tables/deleteRows', payload);
      expect(result).toEqual(mocked);
   });
});

describe('Tables.insertTableFakeRows', () => {
   it('routes to /api/tables/insertFakeRows with faker descriptor row shape', async () => {
      const mocked = { status: 'success', response: { affectedRows: 5 } };
      vi.mocked(apiCall).mockResolvedValueOnce(mocked);
      const payload = {
         uid: 'u',
         schema: 'dbo',
         table: 'users',
         row: {
            id: { group: 'manual', value: 1 },
            name: { group: 'person', value: 'firstName' }
         },
         repeat: 5,
         fields: { id: 'INT', name: 'NVARCHAR' },
         locale: 'en'
      };

      const result = await Tables.insertTableFakeRows(payload);

      expect(apiCall).toHaveBeenCalledWith('/api/tables/insertFakeRows', payload);
      expect(result).toEqual(mocked);
   });
});

describe('Tables.getForeignList', () => {
   it('routes to /api/tables/getForeignList', async () => {
      const mocked = { status: 'success', response: [] };
      vi.mocked(apiCall).mockResolvedValueOnce(mocked);
      const payload = {
         uid: 'u',
         schema: 'dbo',
         table: 'users',
         column: 'role_id',
         description: 'name' as string | false
      };

      const result = await Tables.getForeignList(payload);

      expect(apiCall).toHaveBeenCalledWith('/api/tables/getForeignList', payload);
      expect(result).toEqual(mocked);
   });
});

describe('Tables.createTable', () => {
   it('routes to /api/tables/create', async () => {
      const mocked = { status: 'success', response: null };
      vi.mocked(apiCall).mockResolvedValueOnce(mocked);
      // Cast minimal shape — we test the wire call, not CreateTableParams shape.
      const payload = {
         uid: 'u',
         schema: 'dbo',
         name: 'orders',
         fields: [],
         foreigns: [],
         indexes: [],
         options: {}
      } as unknown as Parameters<typeof Tables.createTable>[0];

      const result = await Tables.createTable(payload);

      expect(apiCall).toHaveBeenCalledWith('/api/tables/create', payload);
      expect(result).toEqual(mocked);
   });
});

describe('Tables.alterTable', () => {
   it('routes to /api/tables/alter', async () => {
      const mocked = { status: 'success', response: null };
      vi.mocked(apiCall).mockResolvedValueOnce(mocked);
      const payload = {
         uid: 'u',
         schema: 'dbo',
         table: 'users',
         additions: [],
         changes: [],
         deletions: [],
         indexChanges: { additions: [], changes: [], deletions: [] },
         foreignChanges: { additions: [], changes: [], deletions: [] },
         options: {}
      } as unknown as Parameters<typeof Tables.alterTable>[0];

      const result = await Tables.alterTable(payload);

      expect(apiCall).toHaveBeenCalledWith('/api/tables/alter', payload);
      expect(result).toEqual(mocked);
   });
});

describe('Tables.duplicateTable', () => {
   it('routes to /api/tables/duplicate', async () => {
      const mocked = { status: 'success', response: null };
      vi.mocked(apiCall).mockResolvedValueOnce(mocked);
      const payload = { uid: 'u', schema: 'dbo', table: 'users' };

      const result = await Tables.duplicateTable(payload);

      expect(apiCall).toHaveBeenCalledWith('/api/tables/duplicate', payload);
      expect(result).toEqual(mocked);
   });
});

describe('Tables.truncateTable', () => {
   it('routes to /api/tables/truncate', async () => {
      const mocked = { status: 'success', response: null };
      vi.mocked(apiCall).mockResolvedValueOnce(mocked);
      const payload = { uid: 'u', schema: 'dbo', table: 'users', force: true };

      const result = await Tables.truncateTable(payload);

      expect(apiCall).toHaveBeenCalledWith('/api/tables/truncate', payload);
      expect(result).toEqual(mocked);
   });
});

describe('Tables.dropTable', () => {
   it('routes to /api/tables/drop', async () => {
      const mocked = { status: 'success', response: null };
      vi.mocked(apiCall).mockResolvedValueOnce(mocked);
      const payload = { uid: 'u', schema: 'dbo', table: 'users' };

      const result = await Tables.dropTable(payload);

      expect(apiCall).toHaveBeenCalledWith('/api/tables/drop', payload);
      expect(result).toEqual(mocked);
   });
});
