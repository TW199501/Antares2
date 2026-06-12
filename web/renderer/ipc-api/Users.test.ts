/**
 * Characterization tests for the Users IPC wrapper (T8 / PR4).
 *
 * Locked behavior (verified against current source):
 *   - Default export is a class with a single static method getUsers(uid).
 *   - getUsers forwards to apiCall('/api/users/getUsers', { uid }) untouched.
 *   - Pure pass-through: whatever apiCall resolves with is returned verbatim.
 */
import { describe, expect, it, vi } from 'vitest';

import { apiCall } from '@/ipc-api/httpClient';

import Users from './Users';

describe('Users.getUsers', () => {
   it('calls apiCall with the canonical /api/users/getUsers route and the uid argument', async () => {
      vi.mocked(apiCall).mockResolvedValueOnce({ status: 'success', response: [] });

      await Users.getUsers('connection-uid-1');

      expect(apiCall).toHaveBeenCalledTimes(1);
      expect(apiCall).toHaveBeenCalledWith('/api/users/getUsers', { uid: 'connection-uid-1' });
   });

   it('returns the apiCall response unchanged on success', async () => {
      const payload = {
         status: 'success' as const,
         response: [
            { user: 'root', host: 'localhost' },
            { user: 'app', host: '%' }
         ]
      };
      vi.mocked(apiCall).mockResolvedValueOnce(payload);

      const result = await Users.getUsers('uid-2');

      expect(result).toEqual(payload);
   });

   it('passes empty-string uid through verbatim (no validation)', async () => {
      vi.mocked(apiCall).mockResolvedValueOnce({ status: 'success', response: [] });

      await Users.getUsers('');

      expect(apiCall).toHaveBeenCalledWith('/api/users/getUsers', { uid: '' });
   });

   it('propagates rejection from apiCall (no try/catch wrapping)', async () => {
      vi.mocked(apiCall).mockRejectedValueOnce(new Error('network down'));

      await expect(Users.getUsers('uid-3')).rejects.toThrow('network down');
   });
});
