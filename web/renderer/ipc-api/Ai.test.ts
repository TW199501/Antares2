/**
 * Characterization tests for the Ai IPC wrapper (T8 / PR4).
 *
 * Locked behavior (verified against current source):
 *   - Default export is a class with a single static method translateColumn().
 *   - Forwards { columnName, targetLocale } to apiCall('/api/ai/translate-column', params).
 *   - Backend route uses public Google Translate (no API key required) — but
 *     the wrapper itself is a pure pass-through and does not encode that fact.
 */
import { describe, expect, it, vi } from 'vitest';

import { apiCall } from '@/ipc-api/httpClient';

import Ai from './Ai';

describe('Ai.translateColumn', () => {
   it('calls apiCall with /api/ai/translate-column and the params object verbatim', async () => {
      vi.mocked(apiCall).mockResolvedValueOnce({
         status: 'success',
         response: { translation: '客戶編號' }
      });

      await Ai.translateColumn({ columnName: 'customer_id', targetLocale: 'zh-TW' });

      expect(apiCall).toHaveBeenCalledTimes(1);
      expect(apiCall).toHaveBeenCalledWith('/api/ai/translate-column', {
         columnName: 'customer_id',
         targetLocale: 'zh-TW'
      });
   });

   it('returns the IpcResponse from apiCall unchanged on success', async () => {
      const payload = {
         status: 'success' as const,
         response: { translation: '商品名稱' }
      };
      vi.mocked(apiCall).mockResolvedValueOnce(payload);

      const result = await Ai.translateColumn({
         columnName: 'product_name',
         targetLocale: 'zh-TW'
      });

      expect(result).toEqual(payload);
   });

   it('passes through error-status responses without remapping', async () => {
      const payload = { status: 'error' as const, response: 'rate limited' };
      vi.mocked(apiCall).mockResolvedValueOnce(payload);

      const result = await Ai.translateColumn({
         columnName: 'foo',
         targetLocale: 'ja-JP'
      });

      expect(result).toEqual(payload);
   });

   it('propagates apiCall rejection (no try/catch in wrapper)', async () => {
      vi.mocked(apiCall).mockRejectedValueOnce(new Error('sidecar offline'));

      await expect(
         Ai.translateColumn({ columnName: 'x', targetLocale: 'en-US' })
      ).rejects.toThrow('sidecar offline');
   });
});
