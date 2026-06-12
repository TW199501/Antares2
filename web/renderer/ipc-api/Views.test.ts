/**
 * Contract replay tests for Views IPC wrapper.
 *
 * Covers all 8 static methods on the default-exported class — both
 * regular and materialized view variants. No fixtures available, so each
 * test mocks `apiCall` inline. Asserts that the wrapper is a pure
 * pass-through: exact route string + payload identity + returned body.
 */
import { describe, expect, it, vi } from 'vitest';

import { apiCall } from '@/ipc-api/httpClient';

import Views from './Views';

describe('Views.getViewInformations', () => {
   it('routes to /api/views/getInformations', async () => {
      const mocked = { status: 'success', response: { name: 'v_users', sql: 'SELECT * FROM users' } };
      vi.mocked(apiCall).mockResolvedValueOnce(mocked);
      const payload = { uid: 'u', schema: 'dbo', view: 'v_users' };

      const result = await Views.getViewInformations(payload);

      expect(apiCall).toHaveBeenCalledWith('/api/views/getInformations', payload);
      expect(result).toEqual(mocked);
   });
});

describe('Views.dropView', () => {
   it('routes to /api/views/drop', async () => {
      const mocked = { status: 'success', response: null };
      vi.mocked(apiCall).mockResolvedValueOnce(mocked);
      const payload = { uid: 'u', schema: 'dbo', view: 'v_users' };

      const result = await Views.dropView(payload);

      expect(apiCall).toHaveBeenCalledWith('/api/views/drop', payload);
      expect(result).toEqual(mocked);
   });
});

describe('Views.alterView', () => {
   it('routes to /api/views/alter', async () => {
      const mocked = { status: 'success', response: null };
      vi.mocked(apiCall).mockResolvedValueOnce(mocked);
      const payload = {
         view: {
            uid: 'u',
            schema: 'dbo',
            oldName: 'v_users',
            name: 'v_users',
            sql: 'SELECT id, name FROM users',
            algorithm: '',
            definer: '',
            security: '',
            updateOption: ''
         }
      } as unknown as Parameters<typeof Views.alterView>[0];

      const result = await Views.alterView(payload);

      expect(apiCall).toHaveBeenCalledWith('/api/views/alter', payload);
      expect(result).toEqual(mocked);
   });
});

describe('Views.createView', () => {
   it('routes to /api/views/create', async () => {
      const mocked = { status: 'success', response: null };
      vi.mocked(apiCall).mockResolvedValueOnce(mocked);
      const payload = {
         uid: 'u',
         schema: 'dbo',
         name: 'v_users',
         sql: 'SELECT * FROM users',
         algorithm: '',
         definer: '',
         security: '',
         updateOption: ''
      } as unknown as Parameters<typeof Views.createView>[0];

      const result = await Views.createView(payload);

      expect(apiCall).toHaveBeenCalledWith('/api/views/create', payload);
      expect(result).toEqual(mocked);
   });
});

describe('Views.createMaterializedView', () => {
   it('routes to /api/views/createMaterialized', async () => {
      const mocked = { status: 'success', response: null };
      vi.mocked(apiCall).mockResolvedValueOnce(mocked);
      const payload = {
         uid: 'u',
         schema: 'public',
         name: 'mv_users',
         sql: 'SELECT * FROM users',
         algorithm: '',
         definer: '',
         security: '',
         updateOption: ''
      } as unknown as Parameters<typeof Views.createMaterializedView>[0];

      const result = await Views.createMaterializedView(payload);

      expect(apiCall).toHaveBeenCalledWith('/api/views/createMaterialized', payload);
      expect(result).toEqual(mocked);
   });
});

describe('Views.getMaterializedViewInformations', () => {
   it('routes to /api/views/getMaterializedInformations', async () => {
      const mocked = { status: 'success', response: { name: 'mv_users', sql: 'SELECT 1' } };
      vi.mocked(apiCall).mockResolvedValueOnce(mocked);
      const payload = { uid: 'u', schema: 'public', view: 'mv_users' };

      const result = await Views.getMaterializedViewInformations(payload);

      expect(apiCall).toHaveBeenCalledWith('/api/views/getMaterializedInformations', payload);
      expect(result).toEqual(mocked);
   });
});

describe('Views.dropMaterializedView', () => {
   it('routes to /api/views/dropMaterialized', async () => {
      const mocked = { status: 'success', response: null };
      vi.mocked(apiCall).mockResolvedValueOnce(mocked);
      const payload = { uid: 'u', schema: 'public', view: 'mv_users' };

      const result = await Views.dropMaterializedView(payload);

      expect(apiCall).toHaveBeenCalledWith('/api/views/dropMaterialized', payload);
      expect(result).toEqual(mocked);
   });
});

describe('Views.alterMaterializedView', () => {
   it('routes to /api/views/alterMaterialized', async () => {
      const mocked = { status: 'success', response: null };
      vi.mocked(apiCall).mockResolvedValueOnce(mocked);
      const payload = {
         view: {
            uid: 'u',
            schema: 'public',
            oldName: 'mv_users',
            name: 'mv_users',
            sql: 'SELECT id, name FROM users',
            algorithm: '',
            definer: '',
            security: '',
            updateOption: ''
         }
      } as unknown as Parameters<typeof Views.alterMaterializedView>[0];

      const result = await Views.alterMaterializedView(payload);

      expect(apiCall).toHaveBeenCalledWith('/api/views/alterMaterialized', payload);
      expect(result).toEqual(mocked);
   });
});
