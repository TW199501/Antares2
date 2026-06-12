/**
 * Connection.ts — IPC contract replay tests (T8 / PR4 batch F)
 *
 * Tested behaviors:
 *   - makeTest        → POST /api/connection/test         (pass-through)
 *   - connect         → POST /api/connection/connect      (pass-through, fixture replay)
 *   - abortConnection → POST /api/connection/abort        (fire-and-forget; void return, no await)
 *   - checkConnection → POST /api/connection/check        (NOT pass-through: maps response.response === true → boolean)
 *   - disconnect      → POST /api/connection/disconnect   (pass-through, fixture replay)
 *
 * Strategy: the global vi.mock in tests/setup.ts replaces apiCall with vi.fn().
 * Each test overrides per-call via mockResolvedValueOnce, then asserts
 * (a) the route + payload passed to apiCall, and (b) the wrapper's return value.
 */
import connectFixture from '@tests/fixtures/contract/connection.connect.mssql.happy.json';
import disconnectFixture from '@tests/fixtures/contract/connection.disconnect.mssql.happy.json';
import { describe, expect, it, vi } from 'vitest';

import { apiCall } from '@/ipc-api/httpClient';

import Connection from './Connection';

describe('Connection.connect (contract replay)', () => {
   it('routes to /api/connection/connect with payload, returns response body verbatim', async () => {
      vi.mocked(apiCall).mockResolvedValueOnce(connectFixture.response.body);

      const result = await Connection.connect(connectFixture.request.payload as Parameters<typeof Connection.connect>[0]);

      expect(apiCall).toHaveBeenCalledTimes(1);
      expect(apiCall).toHaveBeenCalledWith(
         connectFixture.request.route,
         connectFixture.request.payload
      );
      expect(result).toEqual(connectFixture.response.body);
   });
});

describe('Connection.disconnect (contract replay)', () => {
   it('routes to /api/connection/disconnect with { uid }, returns response body verbatim', async () => {
      vi.mocked(apiCall).mockResolvedValueOnce(disconnectFixture.response.body);

      const uid = disconnectFixture.request.payload.uid;
      const result = await Connection.disconnect(uid);

      expect(apiCall).toHaveBeenCalledTimes(1);
      expect(apiCall).toHaveBeenCalledWith('/api/connection/disconnect', { uid });
      expect(result).toEqual(disconnectFixture.response.body);
   });
});

describe('Connection.makeTest (no fixture — inline)', () => {
   it('routes to /api/connection/test with full ConnectionParams payload', async () => {
      const expectedReturn = { status: 'success', response: 'ok' };
      vi.mocked(apiCall).mockResolvedValueOnce(expectedReturn);

      const payload = {
         uid: '00000000-0000-0000-0000-000000000099',
         name: 'Test connection',
         client: 'mssql',
         host: '127.0.0.1',
         port: 1433,
         user: 'sa',
         password: 'p',
         database: 'master',
         schema: 'dbo',
         ask: false,
         readonly: false,
         singleConnectionMode: false,
         ssl: false,
         untrustedConnection: true,
         ssh: false
      } as Parameters<typeof Connection.makeTest>[0];

      const result = await Connection.makeTest(payload);

      expect(apiCall).toHaveBeenCalledTimes(1);
      expect(apiCall).toHaveBeenCalledWith('/api/connection/test', payload);
      expect(result).toEqual(expectedReturn);
   });

   it('forwards optional connString when provided', async () => {
      vi.mocked(apiCall).mockResolvedValueOnce({ status: 'success' });

      const payload = {
         uid: '00000000-0000-0000-0000-000000000099',
         client: 'mssql',
         connString: 'Server=127.0.0.1;Database=master;User Id=sa;Password=p;'
      } as Parameters<typeof Connection.makeTest>[0];

      await Connection.makeTest(payload);

      expect(apiCall).toHaveBeenCalledWith('/api/connection/test', payload);
   });
});

describe('Connection.abortConnection (fire-and-forget)', () => {
   it('routes to /api/connection/abort with { uid } and returns void', () => {
      vi.mocked(apiCall).mockResolvedValueOnce({ status: 'success' });

      const uid = '00000000-0000-0000-0000-000000000001';
      const result = Connection.abortConnection(uid);

      // fire-and-forget: wrapper does not await, does not return the promise
      expect(result).toBeUndefined();
      expect(apiCall).toHaveBeenCalledTimes(1);
      expect(apiCall).toHaveBeenCalledWith('/api/connection/abort', { uid });
   });
});

describe('Connection.checkConnection (response transform)', () => {
   it('returns true when sidecar response.response === true', async () => {
      vi.mocked(apiCall).mockResolvedValueOnce({ status: 'success', response: true });

      const uid = '00000000-0000-0000-0000-000000000001';
      const result = await Connection.checkConnection(uid);

      expect(apiCall).toHaveBeenCalledWith('/api/connection/check', { uid });
      expect(result).toBe(true);
   });

   it('returns false when sidecar response.response === false', async () => {
      vi.mocked(apiCall).mockResolvedValueOnce({ status: 'success', response: false });

      const result = await Connection.checkConnection('uid-x');

      expect(result).toBe(false);
   });

   it('returns false when sidecar response.response is anything other than strict true', async () => {
      // The wrapper uses === true so truthy non-boolean must NOT be coerced to true
      vi.mocked(apiCall).mockResolvedValueOnce({ status: 'success', response: 'true' });
      expect(await Connection.checkConnection('uid-x')).toBe(false);

      vi.mocked(apiCall).mockResolvedValueOnce({ status: 'success', response: 1 });
      expect(await Connection.checkConnection('uid-x')).toBe(false);

      vi.mocked(apiCall).mockResolvedValueOnce({ status: 'success', response: null });
      expect(await Connection.checkConnection('uid-x')).toBe(false);
   });
});
