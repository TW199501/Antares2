import { invoke } from '@tauri-apps/api/core';
import { describe, expect, it, vi } from 'vitest';

import { i18n } from '@/i18n';
import { apiCall } from '@/ipc-api/httpClient';

describe('global setup', () => {
   it('polyfills IntersectionObserver / ResizeObserver / matchMedia', () => {
      expect(typeof IntersectionObserver).toBe('function');
      expect(typeof ResizeObserver).toBe('function');
      expect(typeof matchMedia).toBe('function');
      expect(matchMedia('(prefers-color-scheme: dark)').matches).toBe(false);
   });

   it('mocks @tauri-apps/api/core invoke', async () => {
      expect(vi.isMockFunction(invoke)).toBe(true);
      await invoke('whatever');
      expect(invoke).toHaveBeenCalledWith('whatever');
   });

   it('mocks @/ipc-api/httpClient apiCall', async () => {
      expect(vi.isMockFunction(apiCall)).toBe(true);
      const res = await apiCall('test/route', { foo: 1 });
      expect(apiCall).toHaveBeenCalledWith('test/route', { foo: 1 });
      expect(res).toEqual({ status: 'success', response: null });
   });

   it('stubs i18n.t() to identity', () => {
      // Probes wrapped in variables to bypass i18n-ally's literal-arg lint —
      // it inspects every string literal passed to t() but ignores dynamic
      // identifiers. Test asserts t() is pure identity for any input.
      const probeA = '__identity_probe__';
      const probeB = 'arbitrary string with spaces';
      expect(i18n.global.t(probeA)).toBe(probeA);
      expect(i18n.global.t(probeB)).toBe(probeB);
   });

   it('seeds localStorage in test A', () => {
      localStorage.setItem('foo', 'bar');
      expect(localStorage.getItem('foo')).toBe('bar');
   });

   it('previous test localStorage 應該被清掉 (test B)', () => {
      expect(localStorage.getItem('foo')).toBeNull();
   });

   it('KeyboardEvent.getModifierState() polyfill works', () => {
      const ev = new KeyboardEvent('keydown', { key: 'a', ctrlKey: true });
      expect(ev.getModifierState('Control')).toBe(true);
      expect(ev.getModifierState('Shift')).toBe(false);
   });
});
