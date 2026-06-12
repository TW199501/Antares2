/**
 * Characterization tests for the Functions IPC wrapper (DDL — functions).
 *
 * Locked behavior (PR3.A confirmed pure pass-through):
 *   - Each static method calls apiCall(<route>, params) exactly once.
 *   - Returns whatever apiCall resolves to — no shape transformation.
 *   - Routes are stable strings under /api/functions/* and must not drift.
 *   - Includes Postgres-specific trigger-function variants which route to
 *     /alterTriggerFunction and /createTriggerFunction (not /alter or /create).
 *
 * Mocking model: tests/setup.ts globally mocks @/ipc-api/httpClient so
 * apiCall is a vi.fn(); we assert call args + return identity per method.
 */
import { describe, expect, it, vi } from 'vitest';

import { apiCall } from '@/ipc-api/httpClient';

import Functions from './Functions';

describe('Functions IPC wrapper', () => {
   describe('getFunctionInformations', () => {
      it('routes to /api/functions/getInformations and returns the apiCall result', async () => {
         const mocked = {
            status: 'success',
            response: { sql: 'CREATE FUNCTION f', name: 'f' }
         };
         vi.mocked(apiCall).mockResolvedValueOnce(mocked);
         const params = { uid: 'u1', schema: 'sch', func: 'f1' };

         const result = await Functions.getFunctionInformations(params);

         expect(apiCall).toHaveBeenCalledTimes(1);
         expect(apiCall).toHaveBeenCalledWith('/api/functions/getInformations', params);
         expect(result).toBe(mocked);
      });
   });

   describe('dropFunction', () => {
      it('routes to /api/functions/drop and returns the apiCall result', async () => {
         const mocked = { status: 'success', response: null };
         vi.mocked(apiCall).mockResolvedValueOnce(mocked);
         const params = { uid: 'u1', schema: 'sch', func: 'f1' };

         const result = await Functions.dropFunction(params);

         expect(apiCall).toHaveBeenCalledTimes(1);
         expect(apiCall).toHaveBeenCalledWith('/api/functions/drop', params);
         expect(result).toBe(mocked);
      });
   });

   describe('alterFunction', () => {
      it('routes to /api/functions/alter and returns the apiCall result', async () => {
         const mocked = { status: 'success', response: null };
         vi.mocked(apiCall).mockResolvedValueOnce(mocked);
         const params = {
            func: {
               name: 'f1',
               oldName: 'f1',
               parameters: [],
               body: 'BEGIN END',
               returns: 'INT'
            } as unknown as Parameters<typeof Functions.alterFunction>[0]['func']
         };

         const result = await Functions.alterFunction(params);

         expect(apiCall).toHaveBeenCalledTimes(1);
         expect(apiCall).toHaveBeenCalledWith('/api/functions/alter', params);
         expect(result).toBe(mocked);
      });
   });

   describe('alterTriggerFunction', () => {
      it('routes to /api/functions/alterTriggerFunction and returns the apiCall result', async () => {
         const mocked = { status: 'success', response: null };
         vi.mocked(apiCall).mockResolvedValueOnce(mocked);
         const params = {
            uid: 'u1',
            func: {
               name: 'tf1',
               oldName: 'tf1',
               parameters: [],
               body: 'BEGIN END',
               returns: 'TRIGGER'
            } as unknown as Parameters<typeof Functions.alterTriggerFunction>[0]['func']
         };

         const result = await Functions.alterTriggerFunction(params);

         expect(apiCall).toHaveBeenCalledTimes(1);
         expect(apiCall).toHaveBeenCalledWith('/api/functions/alterTriggerFunction', params);
         expect(result).toBe(mocked);
      });
   });

   describe('createFunction', () => {
      it('routes to /api/functions/create and returns the apiCall result', async () => {
         const mocked = { status: 'success', response: null };
         vi.mocked(apiCall).mockResolvedValueOnce(mocked);
         const params = {
            uid: 'u1',
            name: 'f1',
            parameters: [],
            body: 'BEGIN END',
            returns: 'INT'
         } as unknown as Parameters<typeof Functions.createFunction>[0];

         const result = await Functions.createFunction(params);

         expect(apiCall).toHaveBeenCalledTimes(1);
         expect(apiCall).toHaveBeenCalledWith('/api/functions/create', params);
         expect(result).toBe(mocked);
      });
   });

   describe('createTriggerFunction', () => {
      it('routes to /api/functions/createTriggerFunction and returns the apiCall result', async () => {
         const mocked = { status: 'success', response: null };
         vi.mocked(apiCall).mockResolvedValueOnce(mocked);
         const params = {
            uid: 'u1',
            name: 'tf1',
            parameters: [],
            body: 'BEGIN END',
            returns: 'TRIGGER'
         } as unknown as Parameters<typeof Functions.createTriggerFunction>[0];

         const result = await Functions.createTriggerFunction(params);

         expect(apiCall).toHaveBeenCalledTimes(1);
         expect(apiCall).toHaveBeenCalledWith('/api/functions/createTriggerFunction', params);
         expect(result).toBe(mocked);
      });
   });
});
