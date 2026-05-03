/**
 * Characterization tests for the Triggers IPC wrapper (DDL — triggers).
 *
 * Locked behavior (PR3.A confirmed pure pass-through):
 *   - Each static method calls apiCall(<route>, params) exactly once.
 *   - Returns whatever apiCall resolves to — no shape transformation.
 *   - Routes are stable strings under /api/triggers/* and must not drift.
 *
 * Mocking model: tests/setup.ts globally mocks @/ipc-api/httpClient so
 * apiCall is a vi.fn(); we assert call args + return identity per method.
 */
import { describe, expect, it, vi } from 'vitest';

import { apiCall } from '@/ipc-api/httpClient';

import Triggers from './Triggers';

describe('Triggers IPC wrapper', () => {
   describe('getTriggerInformations', () => {
      it('routes to /api/triggers/getInformations and returns the apiCall result', async () => {
         const mocked = {
            status: 'success',
            response: { sql: 'CREATE TRIGGER t', name: 't' }
         };
         vi.mocked(apiCall).mockResolvedValueOnce(mocked);
         const params = { uid: 'u1', schema: 'sch', trigger: 'trg' };

         const result = await Triggers.getTriggerInformations(params);

         expect(apiCall).toHaveBeenCalledTimes(1);
         expect(apiCall).toHaveBeenCalledWith('/api/triggers/getInformations', params);
         expect(result).toBe(mocked);
      });
   });

   describe('dropTrigger', () => {
      it('routes to /api/triggers/drop and returns the apiCall result', async () => {
         const mocked = { status: 'success', response: null };
         vi.mocked(apiCall).mockResolvedValueOnce(mocked);
         const params = { uid: 'u1', schema: 'sch', trigger: 'trg' };

         const result = await Triggers.dropTrigger(params);

         expect(apiCall).toHaveBeenCalledTimes(1);
         expect(apiCall).toHaveBeenCalledWith('/api/triggers/drop', params);
         expect(result).toBe(mocked);
      });
   });

   describe('alterTrigger', () => {
      it('routes to /api/triggers/alter and returns the apiCall result', async () => {
         const mocked = { status: 'success', response: null };
         vi.mocked(apiCall).mockResolvedValueOnce(mocked);
         const params = {
            trigger: {
               uid: 'u1',
               name: 'trg',
               table: 'tbl',
               statement: 'BEGIN END',
               event: 'BEFORE',
               activation: 'INSERT'
            } as unknown as Parameters<typeof Triggers.alterTrigger>[0]['trigger']
         };

         const result = await Triggers.alterTrigger(params);

         expect(apiCall).toHaveBeenCalledTimes(1);
         expect(apiCall).toHaveBeenCalledWith('/api/triggers/alter', params);
         expect(result).toBe(mocked);
      });
   });

   describe('createTrigger', () => {
      it('routes to /api/triggers/create and returns the apiCall result', async () => {
         const mocked = { status: 'success', response: null };
         vi.mocked(apiCall).mockResolvedValueOnce(mocked);
         const params = {
            uid: 'u1',
            name: 'new_trg',
            table: 'tbl',
            statement: 'BEGIN END'
         } as unknown as Parameters<typeof Triggers.createTrigger>[0];

         const result = await Triggers.createTrigger(params);

         expect(apiCall).toHaveBeenCalledTimes(1);
         expect(apiCall).toHaveBeenCalledWith('/api/triggers/create', params);
         expect(result).toBe(mocked);
      });
   });

   describe('toggleTrigger', () => {
      it('routes to /api/triggers/toggle and returns the apiCall result', async () => {
         const mocked = { status: 'success', response: null };
         vi.mocked(apiCall).mockResolvedValueOnce(mocked);
         const params = { uid: 'u1', schema: 'sch', trigger: 'trg', enabled: true };

         const result = await Triggers.toggleTrigger(params);

         expect(apiCall).toHaveBeenCalledTimes(1);
         expect(apiCall).toHaveBeenCalledWith('/api/triggers/toggle', params);
         expect(result).toBe(mocked);
      });

      it('passes enabled:false through unchanged', async () => {
         const mocked = { status: 'success', response: null };
         vi.mocked(apiCall).mockResolvedValueOnce(mocked);
         const params = { uid: 'u1', schema: 'sch', trigger: 'trg', enabled: false };

         await Triggers.toggleTrigger(params);

         expect(apiCall).toHaveBeenCalledWith('/api/triggers/toggle', params);
      });
   });
});
