/**
 * Databases.ts — IPC contract replay tests (T8 / PR4 batch F)
 *
 * Tested behaviors:
 *   - getDatabases       → POST /api/databases/getDatabases       (pass-through, fixture replay)
 *   - getDatabaseComment → POST /api/databases/getDatabaseComment (pass-through, inline)
 *
 * Both methods take a single `uid: string` argument and forward it as `{ uid }`.
 * No transformations — wrapper returns apiCall's resolved value verbatim.
 */
import getDatabasesFixture from '@tests/fixtures/contract/databases.getDatabases.mssql.happy.json';
import { describe, expect, it, vi } from 'vitest';

import { apiCall } from '@/ipc-api/httpClient';

import Databases from './Databases';

describe('Databases.getDatabases (contract replay)', () => {
   it('routes to /api/databases/getDatabases with { uid }, returns response body verbatim', async () => {
      vi.mocked(apiCall).mockResolvedValueOnce(getDatabasesFixture.response.body);

      const uid = getDatabasesFixture.request.payload.uid;
      const result = await Databases.getDatabases(uid);

      expect(apiCall).toHaveBeenCalledTimes(1);
      expect(apiCall).toHaveBeenCalledWith('/api/databases/getDatabases', { uid });
      expect(result).toEqual(getDatabasesFixture.response.body);
   });
});

describe('Databases.getDatabaseComment (no fixture — inline)', () => {
   it('routes to /api/databases/getDatabaseComment with { uid }, returns response verbatim', async () => {
      const expectedReturn = { status: 'success', response: 'fixture comment' };
      vi.mocked(apiCall).mockResolvedValueOnce(expectedReturn);

      const uid = '00000000-0000-0000-0000-000000000001';
      const result = await Databases.getDatabaseComment(uid);

      expect(apiCall).toHaveBeenCalledTimes(1);
      expect(apiCall).toHaveBeenCalledWith('/api/databases/getDatabaseComment', { uid });
      expect(result).toEqual(expectedReturn);
   });

   it('returns empty-string comment passthrough (real-world MSSQL case)', async () => {
      const expectedReturn = { status: 'success', response: '' };
      vi.mocked(apiCall).mockResolvedValueOnce(expectedReturn);

      const result = await Databases.getDatabaseComment('uid-x');

      expect(result).toEqual(expectedReturn);
   });
});
