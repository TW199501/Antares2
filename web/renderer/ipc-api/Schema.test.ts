/**
 * Schema.ts — IPC contract replay tests (T8 / PR4 batch F)
 *
 * 21 static methods. Most are pure pass-through to apiCall.
 * Two notable quirks:
 *   - getStructure converts a Set<string> argument into Array.from(set) before sending
 *     (Sets aren't JSON-serializable). Tests verify the payload reaching apiCall is the array form.
 *   - abortExport / abortImport call apiCall with no second argument (no payload).
 *
 * Fixtures replayed: getStructure, getCollations, getVersion, rawQuery.
 * All other methods use minimal hand-crafted payloads + inline mockResolvedValueOnce.
 */
import getCollationsFixture from '@tests/fixtures/contract/schema.getCollations.mssql.happy.json';
import getStructureFixture from '@tests/fixtures/contract/schema.getStructure.mssql.happy.json';
import getVersionFixture from '@tests/fixtures/contract/schema.getVersion.mssql.happy.json';
import rawQueryFixture from '@tests/fixtures/contract/schema.rawQuery.mssql.happy.json';
import { describe, expect, it, vi } from 'vitest';

import { apiCall } from '@/ipc-api/httpClient';

import Schema from './Schema';

const UID = '00000000-0000-0000-0000-000000000001';
const TAB_UID = '00000000-0000-0000-0000-000000000010';

// ─────────────────────────────────────────────────────────────────
// Fixture-backed tests
// ─────────────────────────────────────────────────────────────────

describe('Schema.getStructure (contract replay + Set→Array transform)', () => {
   it('converts schemas Set into Array before forwarding to apiCall, then returns response verbatim', async () => {
      vi.mocked(apiCall).mockResolvedValueOnce(getStructureFixture.response.body);

      const schemas = new Set<string>(['dbo']);
      const result = await Schema.getStructure({ uid: UID, schemas });

      expect(apiCall).toHaveBeenCalledTimes(1);
      // wrapper does: { ...params, schemas: Array.from(params.schemas) }
      expect(apiCall).toHaveBeenCalledWith('/api/schema/getStructure', {
         uid: UID,
         schemas: ['dbo']
      });
      expect(result).toEqual(getStructureFixture.response.body);
   });

   it('preserves Set insertion order when converting to Array', async () => {
      vi.mocked(apiCall).mockResolvedValueOnce({ status: 'success', response: [] });

      const schemas = new Set<string>(['dbo', 'reporting', 'audit']);
      await Schema.getStructure({ uid: UID, schemas });

      expect(apiCall).toHaveBeenCalledWith('/api/schema/getStructure', {
         uid: UID,
         schemas: ['dbo', 'reporting', 'audit']
      });
   });

   it('handles empty Set as empty Array', async () => {
      vi.mocked(apiCall).mockResolvedValueOnce({ status: 'success', response: [] });

      await Schema.getStructure({ uid: UID, schemas: new Set<string>() });

      expect(apiCall).toHaveBeenCalledWith('/api/schema/getStructure', {
         uid: UID,
         schemas: []
      });
   });
});

describe('Schema.getCollations (contract replay)', () => {
   it('routes to /api/schema/getCollations with { uid }, returns response verbatim', async () => {
      vi.mocked(apiCall).mockResolvedValueOnce(getCollationsFixture.response.body);

      const result = await Schema.getCollations(UID);

      expect(apiCall).toHaveBeenCalledTimes(1);
      expect(apiCall).toHaveBeenCalledWith('/api/schema/getCollations', { uid: UID });
      expect(result).toEqual(getCollationsFixture.response.body);
   });
});

describe('Schema.getVersion (contract replay)', () => {
   it('routes to /api/schema/getVersion with { uid }, returns response verbatim', async () => {
      vi.mocked(apiCall).mockResolvedValueOnce(getVersionFixture.response.body);

      const result = await Schema.getVersion(UID);

      expect(apiCall).toHaveBeenCalledTimes(1);
      expect(apiCall).toHaveBeenCalledWith('/api/schema/getVersion', { uid: UID });
      expect(result).toEqual(getVersionFixture.response.body);
   });
});

describe('Schema.rawQuery (contract replay)', () => {
   it('routes to /api/schema/rawQuery with full payload, returns response verbatim', async () => {
      vi.mocked(apiCall).mockResolvedValueOnce(rawQueryFixture.response.body);

      const result = await Schema.rawQuery(rawQueryFixture.request.payload as Parameters<typeof Schema.rawQuery>[0]);

      expect(apiCall).toHaveBeenCalledTimes(1);
      expect(apiCall).toHaveBeenCalledWith('/api/schema/rawQuery', rawQueryFixture.request.payload);
      expect(result).toEqual(rawQueryFixture.response.body);
   });
});

// ─────────────────────────────────────────────────────────────────
// Inline (no fixture) — schema CRUD
// ─────────────────────────────────────────────────────────────────

describe('Schema.createSchema', () => {
   it('routes to /api/schema/create with full params', async () => {
      const expected = { status: 'success' };
      vi.mocked(apiCall).mockResolvedValueOnce(expected);

      const params = { uid: UID, name: 'newdb', collation: 'SQL_Latin1_General_CP1_CI_AS' };
      const result = await Schema.createSchema(params);

      expect(apiCall).toHaveBeenCalledWith('/api/schema/create', params);
      expect(result).toEqual(expected);
   });
});

describe('Schema.updateSchema', () => {
   it('routes to /api/schema/update with full params', async () => {
      const expected = { status: 'success' };
      vi.mocked(apiCall).mockResolvedValueOnce(expected);

      const params = { uid: UID, name: 'mydb', collation: 'SQL_Latin1_General_CP1_CI_AS' };
      const result = await Schema.updateSchema(params);

      expect(apiCall).toHaveBeenCalledWith('/api/schema/update', params);
      expect(result).toEqual(expected);
   });
});

describe('Schema.getDatabaseCollation', () => {
   it('routes to /api/schema/getCollation with { uid, database }', async () => {
      const expected = { status: 'success', response: 'SQL_Latin1_General_CP1_CI_AS' };
      vi.mocked(apiCall).mockResolvedValueOnce(expected);

      const params = { uid: UID, database: 'mydb' };
      const result = await Schema.getDatabaseCollation(params);

      expect(apiCall).toHaveBeenCalledWith('/api/schema/getCollation', params);
      expect(result).toEqual(expected);
   });
});

describe('Schema.deleteSchema', () => {
   it('routes to /api/schema/delete with { uid, database }', async () => {
      const expected = { status: 'success' };
      vi.mocked(apiCall).mockResolvedValueOnce(expected);

      const params = { uid: UID, database: 'mydb' };
      const result = await Schema.deleteSchema(params);

      expect(apiCall).toHaveBeenCalledWith('/api/schema/delete', params);
      expect(result).toEqual(expected);
   });
});

// ─────────────────────────────────────────────────────────────────
// Inline — single-uid getters
// ─────────────────────────────────────────────────────────────────

describe('Schema.getVariables', () => {
   it('routes to /api/schema/getVariables with { uid }', async () => {
      const expected = { status: 'success', response: [{ name: 'version', value: '16.0' }] };
      vi.mocked(apiCall).mockResolvedValueOnce(expected);

      const result = await Schema.getVariables(UID);

      expect(apiCall).toHaveBeenCalledWith('/api/schema/getVariables', { uid: UID });
      expect(result).toEqual(expected);
   });
});

describe('Schema.getEngines', () => {
   it('routes to /api/schema/getEngines with { uid }', async () => {
      const expected = { status: 'success', response: [] };
      vi.mocked(apiCall).mockResolvedValueOnce(expected);

      const result = await Schema.getEngines(UID);

      expect(apiCall).toHaveBeenCalledWith('/api/schema/getEngines', { uid: UID });
      expect(result).toEqual(expected);
   });
});

describe('Schema.getProcesses', () => {
   it('routes to /api/schema/getProcesses with { uid }', async () => {
      const expected = { status: 'success', response: [] };
      vi.mocked(apiCall).mockResolvedValueOnce(expected);

      const result = await Schema.getProcesses(UID);

      expect(apiCall).toHaveBeenCalledWith('/api/schema/getProcesses', { uid: UID });
      expect(result).toEqual(expected);
   });
});

// ─────────────────────────────────────────────────────────────────
// Inline — process / tab control
// ─────────────────────────────────────────────────────────────────

describe('Schema.killProcess', () => {
   it('routes to /api/schema/killProcess with { uid, pid }', async () => {
      const expected = { status: 'success' };
      vi.mocked(apiCall).mockResolvedValueOnce(expected);

      const params = { uid: UID, pid: 1234 };
      const result = await Schema.killProcess(params);

      expect(apiCall).toHaveBeenCalledWith('/api/schema/killProcess', params);
      expect(result).toEqual(expected);
   });
});

describe('Schema.killTabQuery', () => {
   it('routes to /api/schema/killTabQuery with { uid, tabUid }', async () => {
      const expected = { status: 'success' };
      vi.mocked(apiCall).mockResolvedValueOnce(expected);

      const params = { uid: UID, tabUid: TAB_UID };
      const result = await Schema.killTabQuery(params);

      expect(apiCall).toHaveBeenCalledWith('/api/schema/killTabQuery', params);
      expect(result).toEqual(expected);
   });
});

describe('Schema.commitTab', () => {
   it('routes to /api/schema/commitTab with { uid, tabUid }', async () => {
      const expected = { status: 'success' };
      vi.mocked(apiCall).mockResolvedValueOnce(expected);

      const params = { uid: UID, tabUid: TAB_UID };
      const result = await Schema.commitTab(params);

      expect(apiCall).toHaveBeenCalledWith('/api/schema/commitTab', params);
      expect(result).toEqual(expected);
   });
});

describe('Schema.rollbackTab', () => {
   it('routes to /api/schema/rollbackTab with { uid, tabUid }', async () => {
      const expected = { status: 'success' };
      vi.mocked(apiCall).mockResolvedValueOnce(expected);

      const params = { uid: UID, tabUid: TAB_UID };
      const result = await Schema.rollbackTab(params);

      expect(apiCall).toHaveBeenCalledWith('/api/schema/rollbackTab', params);
      expect(result).toEqual(expected);
   });
});

describe('Schema.destroyConnectionToCommit', () => {
   it('routes to /api/schema/destroyConnectionToCommit with { uid, tabUid }', async () => {
      const expected = { status: 'success' };
      vi.mocked(apiCall).mockResolvedValueOnce(expected);

      const params = { uid: UID, tabUid: TAB_UID };
      const result = await Schema.destroyConnectionToCommit(params);

      expect(apiCall).toHaveBeenCalledWith('/api/schema/destroyConnectionToCommit', params);
      expect(result).toEqual(expected);
   });
});

describe('Schema.useSchema', () => {
   it('routes to /api/schema/useSchema with { uid, schema }', async () => {
      const expected = { status: 'success' };
      vi.mocked(apiCall).mockResolvedValueOnce(expected);

      const params = { uid: UID, schema: 'dbo' };
      const result = await Schema.useSchema(params);

      expect(apiCall).toHaveBeenCalledWith('/api/schema/useSchema', params);
      expect(result).toEqual(expected);
   });
});

// ─────────────────────────────────────────────────────────────────
// Inline — export / import lifecycle (abort* takes NO payload)
// ─────────────────────────────────────────────────────────────────

describe('Schema.export', () => {
   it('routes to /api/schema/export with full ExportOptions payload', async () => {
      const expected = { status: 'success' };
      vi.mocked(apiCall).mockResolvedValueOnce(expected);

      const params = {
         uid: UID,
         type: 'mssql',
         outputFile: '/tmp/dump.sql',
         schema: 'dbo',
         tables: [{ table: 'users', includeStructure: true, includeContent: true, includeDropStatement: true }]
      } as unknown as Parameters<typeof Schema.export>[0];

      const result = await Schema.export(params);

      expect(apiCall).toHaveBeenCalledWith('/api/schema/export', params);
      expect(result).toEqual(expected);
   });
});

describe('Schema.abortExport', () => {
   it('routes to /api/schema/abortExport with NO payload (single-arg apiCall)', async () => {
      const expected = { status: 'success' };
      vi.mocked(apiCall).mockResolvedValueOnce(expected);

      const result = await Schema.abortExport();

      expect(apiCall).toHaveBeenCalledTimes(1);
      expect(apiCall).toHaveBeenCalledWith('/api/schema/abortExport');
      expect(result).toEqual(expected);
   });
});

describe('Schema.import', () => {
   it('routes to /api/schema/importSql with ImportOptions payload', async () => {
      const expected = { status: 'success' };
      vi.mocked(apiCall).mockResolvedValueOnce(expected);

      const params = {
         uid: UID,
         type: 'mssql',
         schema: 'dbo',
         file: '/tmp/dump.sql'
      } as unknown as Parameters<typeof Schema.import>[0];

      const result = await Schema.import(params);

      expect(apiCall).toHaveBeenCalledWith('/api/schema/importSql', params);
      expect(result).toEqual(expected);
   });
});

describe('Schema.abortImport', () => {
   it('routes to /api/schema/abortImportSql with NO payload (single-arg apiCall)', async () => {
      const expected = { status: 'success' };
      vi.mocked(apiCall).mockResolvedValueOnce(expected);

      const result = await Schema.abortImport();

      expect(apiCall).toHaveBeenCalledTimes(1);
      expect(apiCall).toHaveBeenCalledWith('/api/schema/abortImportSql');
      expect(result).toEqual(expected);
   });
});
