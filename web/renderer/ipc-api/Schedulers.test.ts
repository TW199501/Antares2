/**
 * Characterization tests for the Schedulers IPC wrapper (DDL — events).
 *
 * Locked behavior (PR3.A confirmed pure pass-through):
 *   - Each static method calls apiCall(<route>, params) exactly once.
 *   - Returns whatever apiCall resolves to — no shape transformation.
 *   - Routes are stable strings under /api/schedulers/* and must not drift.
 *
 * Mocking model: tests/setup.ts globally mocks @/ipc-api/httpClient so
 * apiCall is a vi.fn(); we assert call args + return identity per method.
 */
import { describe, expect, it, vi } from 'vitest';

import { apiCall } from '@/ipc-api/httpClient';

import Schedulers from './Schedulers';

describe('Schedulers IPC wrapper', () => {
   describe('getSchedulerInformations', () => {
      it('routes to /api/schedulers/getInformations and returns the apiCall result', async () => {
         const mocked = {
            status: 'success',
            response: { sql: 'CREATE EVENT e', name: 'e' }
         };
         vi.mocked(apiCall).mockResolvedValueOnce(mocked);
         const params = { uid: 'u1', schema: 'sch', scheduler: 'e1' };

         const result = await Schedulers.getSchedulerInformations(params);

         expect(apiCall).toHaveBeenCalledTimes(1);
         expect(apiCall).toHaveBeenCalledWith('/api/schedulers/getInformations', params);
         expect(result).toBe(mocked);
      });
   });

   describe('dropScheduler', () => {
      it('routes to /api/schedulers/drop and returns the apiCall result', async () => {
         const mocked = { status: 'success', response: null };
         vi.mocked(apiCall).mockResolvedValueOnce(mocked);
         const params = { uid: 'u1', schema: 'sch', scheduler: 'e1' };

         const result = await Schedulers.dropScheduler(params);

         expect(apiCall).toHaveBeenCalledTimes(1);
         expect(apiCall).toHaveBeenCalledWith('/api/schedulers/drop', params);
         expect(result).toBe(mocked);
      });
   });

   describe('alterScheduler', () => {
      it('routes to /api/schedulers/alter and returns the apiCall result', async () => {
         const mocked = { status: 'success', response: null };
         vi.mocked(apiCall).mockResolvedValueOnce(mocked);
         const params = {
            uid: 'u1',
            scheduler: {
               name: 'e1',
               oldName: 'e1',
               body: 'BEGIN END',
               execution: 'EVERY',
               every: ['1', 'HOUR']
            } as unknown as Parameters<typeof Schedulers.alterScheduler>[0]['scheduler']
         };

         const result = await Schedulers.alterScheduler(params);

         expect(apiCall).toHaveBeenCalledTimes(1);
         expect(apiCall).toHaveBeenCalledWith('/api/schedulers/alter', params);
         expect(result).toBe(mocked);
      });
   });

   describe('createScheduler', () => {
      it('routes to /api/schedulers/create and returns the apiCall result', async () => {
         const mocked = { status: 'success', response: null };
         vi.mocked(apiCall).mockResolvedValueOnce(mocked);
         const params = {
            uid: 'u1',
            name: 'e1',
            body: 'BEGIN END',
            execution: 'EVERY',
            every: ['1', 'HOUR']
         } as unknown as Parameters<typeof Schedulers.createScheduler>[0];

         const result = await Schedulers.createScheduler(params);

         expect(apiCall).toHaveBeenCalledTimes(1);
         expect(apiCall).toHaveBeenCalledWith('/api/schedulers/create', params);
         expect(result).toBe(mocked);
      });
   });

   describe('toggleScheduler', () => {
      it('routes to /api/schedulers/toggle and returns the apiCall result', async () => {
         const mocked = { status: 'success', response: null };
         vi.mocked(apiCall).mockResolvedValueOnce(mocked);
         const params = { uid: 'u1', schema: 'sch', scheduler: 'e1', enabled: true };

         const result = await Schedulers.toggleScheduler(params);

         expect(apiCall).toHaveBeenCalledTimes(1);
         expect(apiCall).toHaveBeenCalledWith('/api/schedulers/toggle', params);
         expect(result).toBe(mocked);
      });

      it('passes enabled:false through unchanged', async () => {
         const mocked = { status: 'success', response: null };
         vi.mocked(apiCall).mockResolvedValueOnce(mocked);
         const params = { uid: 'u1', schema: 'sch', scheduler: 'e1', enabled: false };

         await Schedulers.toggleScheduler(params);

         expect(apiCall).toHaveBeenCalledWith('/api/schedulers/toggle', params);
      });
   });
});
