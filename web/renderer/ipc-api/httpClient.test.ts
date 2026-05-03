/**
 * Characterization tests for httpClient.ts — the renderer's transport layer.
 *
 * httpClient is GLOBALLY MOCKED in tests/setup.ts (the global mock is what every
 * other ipc-api wrapper test consumes via vi.mocked(apiCall)). To test the real
 * implementation here we vi.unmock at module top — this is the recommended
 * pattern for "test the real thing in this one file" per vitest docs.
 *
 * Locked behavior:
 *   - setSidecarPort / getSidecarPort round-trip (module-level ref)
 *   - getToken caches via invoke('get_sidecar_token') in Tauri env
 *   - getToken returns '' in non-Tauri env (no __TAURI_INTERNALS__)
 *   - apiCall POSTs JSON to http://127.0.0.1:<port><path> with X-Sidecar-Token
 *   - apiCall throws "API error <status>" on non-OK
 *   - apiCall triggers noConnectionHandler on error response containing "No active connection"
 *   - apiCall uses port 5555 fallback when sidecarPort unset
 *   - createWebSocket builds ws://127.0.0.1:<port><path>?token=<encoded>
 */
import { invoke } from '@tauri-apps/api/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
   apiCall,
   getSidecarPort,
   setNoConnectionHandler,
   setSidecarPort
} from './httpClient';

// Real httpClient (override the global setup.ts mock for this file only).
// vi.unmock is hoisted by vitest at compile time so its position relative
// to the import statements above does not affect runtime semantics.
vi.unmock('@/ipc-api/httpClient');

describe('httpClient — port management', () => {
   it('setSidecarPort / getSidecarPort round-trip', () => {
      setSidecarPort(7000);
      expect(getSidecarPort()).toBe(7000);
   });

   it('reflects updates across calls (module-level ref)', () => {
      setSidecarPort(8080);
      expect(getSidecarPort()).toBe(8080);
      setSidecarPort(9090);
      expect(getSidecarPort()).toBe(9090);
   });
});

describe('httpClient.apiCall (Tauri env — invokes get_sidecar_token)', () => {
   const originalFetch = globalThis.fetch;

   beforeEach(() => {
      // Simulate Tauri runtime so getToken() actually calls invoke()
      vi.stubGlobal('window', { ...window, __TAURI_INTERNALS__: {} });
      // Reset module-level token cache via a known port
      setSidecarPort(5555);
   });

   afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.unstubAllGlobals();
   });

   it('injects X-Sidecar-Token header from invoke()', async () => {
      vi.mocked(invoke).mockResolvedValueOnce('token-abc-123');
      const fetchSpy = vi.fn().mockResolvedValue({
         ok: true,
         status: 200,
         json: async () => ({ status: 'success', response: 'pong' })
      });
      vi.stubGlobal('fetch', fetchSpy);

      await apiCall('/api/connection/test', { client: 'mssql' });

      expect(fetchSpy).toHaveBeenCalledWith(
         'http://127.0.0.1:5555/api/connection/test',
         expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
               'X-Sidecar-Token': 'token-abc-123',
               'Content-Type': 'application/json'
            }),
            body: JSON.stringify({ client: 'mssql' })
         })
      );
   });

   it('returns the parsed JSON response body', async () => {
      vi.mocked(invoke).mockResolvedValue('tok');
      const expected = { status: 'success', response: { rows: [{ id: 1 }] } };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
         ok: true,
         status: 200,
         json: async () => expected
      }));

      const result = await apiCall('/api/tables/getTableData', { uid: 'u' });
      expect(result).toEqual(expected);
   });

   it('omits body when params undefined', async () => {
      vi.mocked(invoke).mockResolvedValue('tok');
      const fetchSpy = vi.fn().mockResolvedValue({
         ok: true,
         status: 200,
         json: async () => ({ status: 'success' })
      });
      vi.stubGlobal('fetch', fetchSpy);

      await apiCall('/api/schema/abortExport');

      expect(fetchSpy).toHaveBeenCalledWith(
         expect.any(String),
         expect.objectContaining({ body: undefined })
      );
   });

   it('throws "API error <status>" on non-OK response', async () => {
      vi.mocked(invoke).mockResolvedValue('tok');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
         ok: false,
         status: 500,
         text: async () => 'Internal Server Error'
      }));

      await expect(apiCall('/api/x')).rejects.toThrow(/API error 500/);
   });

   it('triggers noConnectionHandler on "No active connection" error response', async () => {
      vi.mocked(invoke).mockResolvedValue('tok');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
         ok: true,
         status: 200,
         json: async () => ({ status: 'error', response: 'No active connection for uid X' })
      }));

      const handler = vi.fn();
      setNoConnectionHandler(handler);

      await apiCall('/api/tables/getTableData', { uid: 'conn-1' });
      expect(handler).toHaveBeenCalledWith('conn-1');

      // Reset handler to avoid leaking into later tests
      setNoConnectionHandler(() => {});
   });

   it('does NOT trigger noConnectionHandler when uid missing from payload', async () => {
      vi.mocked(invoke).mockResolvedValue('tok');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
         ok: true,
         status: 200,
         json: async () => ({ status: 'error', response: 'No active connection' })
      }));

      const handler = vi.fn();
      setNoConnectionHandler(handler);

      await apiCall('/api/x'); // no params at all
      expect(handler).not.toHaveBeenCalled();

      setNoConnectionHandler(() => {});
   });

   it('does NOT trigger noConnectionHandler on success responses', async () => {
      vi.mocked(invoke).mockResolvedValue('tok');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
         ok: true,
         status: 200,
         json: async () => ({ status: 'success', response: { ok: true } })
      }));

      const handler = vi.fn();
      setNoConnectionHandler(handler);

      await apiCall('/api/x', { uid: 'c' });
      expect(handler).not.toHaveBeenCalled();

      setNoConnectionHandler(() => {});
   });
});

describe('httpClient.apiCall (non-Tauri env — empty token, dev sidecar bypass)', () => {
   const originalFetch = globalThis.fetch;

   afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.unstubAllGlobals();
   });

   it('sends empty X-Sidecar-Token when no __TAURI_INTERNALS__ on window', async () => {
      // Plain browser env (Playwright at http://localhost:5173/)
      vi.stubGlobal('window', {});
      setSidecarPort(5555);

      const fetchSpy = vi.fn().mockResolvedValue({
         ok: true,
         status: 200,
         json: async () => ({ status: 'success' })
      });
      vi.stubGlobal('fetch', fetchSpy);

      await apiCall('/api/x');

      const sentHeaders = fetchSpy.mock.calls[0][1].headers;
      expect(sentHeaders['X-Sidecar-Token']).toBe('');
   });
});

describe('httpClient.apiCall — port fallback', () => {
   it('uses port 5555 when sidecarPort is 0 (unset)', async () => {
      setSidecarPort(0);
      vi.stubGlobal('window', {});
      const fetchSpy = vi.fn().mockResolvedValue({
         ok: true,
         status: 200,
         json: async () => ({ status: 'success' })
      });
      vi.stubGlobal('fetch', fetchSpy);

      await apiCall('/api/x');

      expect(fetchSpy.mock.calls[0][0]).toBe('http://127.0.0.1:5555/api/x');
      vi.unstubAllGlobals();
   });
});

describe('httpClient.createWebSocket', () => {
   // sidecarToken is a module-level ref that caches across calls. Each token-
   // sensitive test resets the module so its own invoke() mock takes effect.
   beforeEach(() => {
      vi.resetModules();
   });

   afterEach(() => {
      vi.unstubAllGlobals();
   });

   it('builds ws://127.0.0.1:<port><path>?token=<encoded>', async () => {
      vi.stubGlobal('window', { ...window, __TAURI_INTERNALS__: {} });
      const { invoke: freshInvoke } = await import('@tauri-apps/api/core');
      vi.mocked(freshInvoke).mockResolvedValueOnce('ws-token-xyz');

      const fresh = await import('./httpClient');
      fresh.setSidecarPort(5556);

      const wsCtor = vi.fn();
      vi.stubGlobal('WebSocket', wsCtor);

      await fresh.createWebSocket('/ws/export');
      expect(wsCtor).toHaveBeenCalledWith('ws://127.0.0.1:5556/ws/export?token=ws-token-xyz');
   });

   it('uses port 5555 fallback when sidecarPort unset', async () => {
      vi.stubGlobal('window', {}); // non-Tauri → empty token
      const fresh = await import('./httpClient');
      fresh.setSidecarPort(0);

      const wsCtor = vi.fn();
      vi.stubGlobal('WebSocket', wsCtor);

      await fresh.createWebSocket('/ws/import');
      expect(wsCtor).toHaveBeenCalledWith('ws://127.0.0.1:5555/ws/import?token=');
   });

   it('URL-encodes special chars in token', async () => {
      vi.stubGlobal('window', { ...window, __TAURI_INTERNALS__: {} });
      const { invoke: freshInvoke } = await import('@tauri-apps/api/core');
      vi.mocked(freshInvoke).mockResolvedValueOnce('hex+/=token');

      const fresh = await import('./httpClient');
      fresh.setSidecarPort(5556);

      const wsCtor = vi.fn();
      vi.stubGlobal('WebSocket', wsCtor);

      await fresh.createWebSocket('/ws/export');
      expect(wsCtor).toHaveBeenCalledWith(
         'ws://127.0.0.1:5556/ws/export?token=hex%2B%2F%3Dtoken'
      );
   });
});
