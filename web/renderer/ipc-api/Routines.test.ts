/**
 * Characterization tests for the Routines IPC wrapper (DDL — stored procs).
 *
 * Locked behavior (PR3.A confirmed pure pass-through):
 *   - Each static method calls apiCall(<route>, params) exactly once.
 *   - Returns whatever apiCall resolves to — no shape transformation.
 *   - Routes are stable strings under /api/routines/* and must not drift.
 *
 * Mocking model: tests/setup.ts globally mocks @/ipc-api/httpClient so
 * apiCall is a vi.fn(); we assert call args + return identity per method.
 */
import { describe, expect, it, vi } from 'vitest';

import { apiCall } from '@/ipc-api/httpClient';

import Routines from './Routines';

describe('Routines IPC wrapper', () => {
   describe('getRoutineInformations', () => {
      it('routes to /api/routines/getInformations and returns the apiCall result', async () => {
         const mocked = {
            status: 'success',
            response: { sql: 'CREATE PROCEDURE p', name: 'p' }
         };
         vi.mocked(apiCall).mockResolvedValueOnce(mocked);
         const params = { uid: 'u1', schema: 'sch', routine: 'r1' };

         const result = await Routines.getRoutineInformations(params);

         expect(apiCall).toHaveBeenCalledTimes(1);
         expect(apiCall).toHaveBeenCalledWith('/api/routines/getInformations', params);
         expect(result).toBe(mocked);
      });
   });

   describe('dropRoutine', () => {
      it('routes to /api/routines/drop and returns the apiCall result', async () => {
         const mocked = { status: 'success', response: null };
         vi.mocked(apiCall).mockResolvedValueOnce(mocked);
         const params = { uid: 'u1', schema: 'sch', routine: 'r1' };

         const result = await Routines.dropRoutine(params);

         expect(apiCall).toHaveBeenCalledTimes(1);
         expect(apiCall).toHaveBeenCalledWith('/api/routines/drop', params);
         expect(result).toBe(mocked);
      });
   });

   describe('alterRoutine', () => {
      it('routes to /api/routines/alter and returns the apiCall result', async () => {
         const mocked = { status: 'success', response: null };
         vi.mocked(apiCall).mockResolvedValueOnce(mocked);
         const params = {
            uid: 'u1',
            routine: {
               name: 'r1',
               oldName: 'r1',
               parameters: [],
               body: 'BEGIN END'
            } as unknown as Parameters<typeof Routines.alterRoutine>[0]['routine']
         };

         const result = await Routines.alterRoutine(params);

         expect(apiCall).toHaveBeenCalledTimes(1);
         expect(apiCall).toHaveBeenCalledWith('/api/routines/alter', params);
         expect(result).toBe(mocked);
      });
   });

   describe('createRoutine', () => {
      it('routes to /api/routines/create and returns the apiCall result', async () => {
         const mocked = { status: 'success', response: null };
         vi.mocked(apiCall).mockResolvedValueOnce(mocked);
         const params = {
            routine: {
               uid: 'u1',
               name: 'r1',
               parameters: [],
               body: 'BEGIN END'
            } as unknown as Parameters<typeof Routines.createRoutine>[0]['routine']
         };

         const result = await Routines.createRoutine(params);

         expect(apiCall).toHaveBeenCalledTimes(1);
         expect(apiCall).toHaveBeenCalledWith('/api/routines/create', params);
         expect(result).toBe(mocked);
      });
   });
});
