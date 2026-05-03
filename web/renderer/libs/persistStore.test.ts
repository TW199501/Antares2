/**
 * Characterization tests for persistStore — localStorage-backed key/value store.
 *
 * Locked behavior (despite the legacy `initTauriFs` name, the runtime is localStorage):
 *   - All keys are namespaced as `antares_<name>`.
 *   - loadStore: returns parsed value if present; merges with defaults only when
 *     defaults is a plain object (not array, not null). Arrays are returned as-is.
 *     If JSON.parse fails OR the key is absent, returns the supplied defaults.
 *     The catch is silent (no rethrow) to keep boot resilient against corrupt storage.
 *   - saveStore: JSON.stringify + setItem; never throws (logs and swallows errors).
 *   - initTauriFs: no-op shim kept for backward compatibility with the Tauri-FS era.
 *   - localStorage is cleared between tests by tests/setup.ts.
 */
import { describe, expect, it, vi } from 'vitest';

import { initTauriFs, loadStore, saveStore } from './persistStore';

const PREFIX = 'antares_';

describe('saveStore', () => {
   it('writes JSON.stringify-ed data under the antares_ prefix', async () => {
      await saveStore('settings', { theme: 'dark', fontSize: 14 });
      expect(localStorage.getItem(`${PREFIX}settings`)).toBe(
         JSON.stringify({ theme: 'dark', fontSize: 14 })
      );
   });

   it('overwrites the previous value on subsequent saves', async () => {
      await saveStore('settings', { v: 1 });
      await saveStore('settings', { v: 2 });
      expect(localStorage.getItem(`${PREFIX}settings`)).toBe(JSON.stringify({ v: 2 }));
   });

   it('persists primitive values (number, string, boolean, null)', async () => {
      await saveStore('count', 42);
      await saveStore('name', 'eddie');
      await saveStore('flag', true);
      await saveStore('nullable', null);
      expect(localStorage.getItem(`${PREFIX}count`)).toBe('42');
      expect(localStorage.getItem(`${PREFIX}name`)).toBe('"eddie"');
      expect(localStorage.getItem(`${PREFIX}flag`)).toBe('true');
      expect(localStorage.getItem(`${PREFIX}nullable`)).toBe('null');
   });

   it('persists arrays without converting them to objects', async () => {
      await saveStore('list', [1, 2, 3]);
      expect(localStorage.getItem(`${PREFIX}list`)).toBe('[1,2,3]');
   });

   it('keys are independent across different store names', async () => {
      await saveStore('a', { value: 'AAA' });
      await saveStore('b', { value: 'BBB' });
      expect(localStorage.getItem(`${PREFIX}a`)).toBe('{"value":"AAA"}');
      expect(localStorage.getItem(`${PREFIX}b`)).toBe('{"value":"BBB"}');
   });

   it('swallows setItem errors and logs to console.error', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const setSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
         throw new Error('quota exceeded');
      });

      await expect(saveStore('whatever', { a: 1 })).resolves.toBeUndefined();
      expect(errSpy).toHaveBeenCalled();
      expect(errSpy.mock.calls[0][0]).toContain('Failed to save store "whatever"');

      setSpy.mockRestore();
      errSpy.mockRestore();
   });
});

describe('loadStore', () => {
   it('returns the supplied defaults when the key is absent', async () => {
      const defaults = { theme: 'light', fontSize: 12 };
      const out = await loadStore('settings', defaults);
      expect(out).toEqual(defaults);
   });

   it('returns the parsed value when the key is present (object)', async () => {
      localStorage.setItem(`${PREFIX}settings`, JSON.stringify({ theme: 'dark', fontSize: 14 }));
      const out = await loadStore('settings', { theme: 'light', fontSize: 12 });
      // Defaults merge below stored — stored values win for overlapping keys.
      expect(out).toEqual({ theme: 'dark', fontSize: 14 });
   });

   it('merges defaults with stored object — stored keys override, missing keys backfill', async () => {
      localStorage.setItem(`${PREFIX}settings`, JSON.stringify({ theme: 'dark' }));
      const out = await loadStore('settings', { theme: 'light', fontSize: 12, lang: 'en' });
      expect(out).toEqual({ theme: 'dark', fontSize: 12, lang: 'en' });
   });

   it('returns the parsed array directly without spreading into defaults', async () => {
      localStorage.setItem(`${PREFIX}list`, JSON.stringify([7, 8, 9]));
      const out = await loadStore('list', [] as number[]);
      expect(out).toEqual([7, 8, 9]);
   });

   it('returns parsed primitive (number) when defaults is a primitive', async () => {
      localStorage.setItem(`${PREFIX}count`, '42');
      const out = await loadStore('count', 0);
      expect(out).toBe(42);
   });

   it('returns parsed primitive (string) when defaults is a string', async () => {
      localStorage.setItem(`${PREFIX}name`, JSON.stringify('eddie'));
      const out = await loadStore('name', 'anon');
      expect(out).toBe('eddie');
   });

   it('returns parsed boolean when defaults is a boolean', async () => {
      localStorage.setItem(`${PREFIX}flag`, 'true');
      const out = await loadStore('flag', false);
      expect(out).toBe(true);
   });

   it('returns the defaults when JSON.parse fails on a corrupted value', async () => {
      localStorage.setItem(`${PREFIX}corrupt`, '{not valid json');
      const defaults = { ok: true };
      const out = await loadStore('corrupt', defaults);
      expect(out).toEqual(defaults);
   });

   it('returns defaults when the stored string is empty (falsy short-circuit)', async () => {
      localStorage.setItem(`${PREFIX}empty`, '');
      const defaults = { fallback: 1 };
      const out = await loadStore('empty', defaults);
      expect(out).toEqual(defaults);
   });

   it('treats null defaults as a "primitive return" (no merge attempted)', async () => {
      localStorage.setItem(`${PREFIX}thing`, JSON.stringify({ a: 1 }));
      const out = await loadStore<unknown>('thing', null);
      expect(out).toEqual({ a: 1 });
   });

   it('multiple keys load independently in the same tick', async () => {
      localStorage.setItem(`${PREFIX}a`, JSON.stringify({ value: 'AAA' }));
      localStorage.setItem(`${PREFIX}b`, JSON.stringify({ value: 'BBB' }));
      const [a, b] = await Promise.all([
         loadStore('a', { value: '' }),
         loadStore('b', { value: '' })
      ]);
      expect(a).toEqual({ value: 'AAA' });
      expect(b).toEqual({ value: 'BBB' });
   });

   it('round-trips a nested object via saveStore + loadStore', async () => {
      const nested = { a: 1, b: { c: 2, d: [3, 4] } };
      await saveStore('nested', nested);
      const out = await loadStore('nested', { a: 0, b: { c: 0, d: [] as number[] } });
      expect(out).toEqual(nested);
   });
});

describe('initTauriFs', () => {
   it('resolves without doing anything (legacy no-op)', async () => {
      await expect(initTauriFs()).resolves.toBeUndefined();
   });
});
