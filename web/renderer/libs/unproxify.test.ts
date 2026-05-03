/**
 * Characterization tests for `unproxify` — Vue Proxy/ref/reactive -> POJO.
 *
 * Locked behavior:
 *   - Default mode (`json=true`): `JSON.parse(JSON.stringify(val))` — deep clone, drops
 *     undefined / functions / symbols, converts Date to ISO string, strips reactivity.
 *   - `json=false`:
 *       * Array  -> toRaw(val)  (single-shot unwrap; nested proxies remain proxies)
 *       * Object -> shallow copy: new plain object whose own keys are toRaw'd one level
 *       * Primitive -> toRaw(val)  (which returns the value itself)
 *   - Generic <T> is type-passthrough only; runtime never inspects T.
 */
import { describe, expect, it } from 'vitest';
import { isProxy, reactive, ref } from 'vue';

import { unproxify } from './unproxify';

describe('unproxify (default json=true mode)', () => {
   it('deep-clones a reactive object into a plain JS object', () => {
      const proxy = reactive({ a: 1, b: { c: 2 } });
      const plain = unproxify(proxy);
      expect(plain).toEqual({ a: 1, b: { c: 2 } });
      expect(isProxy(plain)).toBe(false);
      expect(isProxy(plain.b)).toBe(false);
   });

   it('returns a structurally equal but distinct object reference', () => {
      const src = { x: 1, y: { z: [1, 2, 3] } };
      const out = unproxify(src);
      expect(out).toEqual(src);
      expect(out).not.toBe(src);
      expect(out.y).not.toBe(src.y);
      expect(out.y.z).not.toBe(src.y.z);
   });

   it('converts a ref<object>.value via JSON round-trip when wrapped object is passed', () => {
      const r = ref({ count: 5, nested: { ok: true } });
      // Real-world callsite passes r.value (the proxy), not the ref itself.
      const out = unproxify(r.value);
      expect(out).toEqual({ count: 5, nested: { ok: true } });
   });

   it('returns primitive numbers unchanged', () => {
      expect(unproxify(42)).toBe(42);
   });

   it('returns primitive strings unchanged', () => {
      expect(unproxify('hello')).toBe('hello');
   });

   it('returns booleans unchanged', () => {
      expect(unproxify(true)).toBe(true);
      expect(unproxify(false)).toBe(false);
   });

   it('returns null unchanged', () => {
      expect(unproxify(null)).toBe(null);
   });

   it('serializes arrays into a fresh plain array', () => {
      const proxyArr = reactive([1, 2, 3, { nested: true }]);
      const out = unproxify(proxyArr) as unknown as Array<number | { nested: boolean }>;
      expect(out).toEqual([1, 2, 3, { nested: true }]);
      expect(Array.isArray(out)).toBe(true);
      expect(isProxy(out)).toBe(false);
   });

   it('converts Date instances to ISO strings (JSON.stringify behavior)', () => {
      const d = new Date('2026-05-03T00:00:00.000Z');
      const out = unproxify({ when: d } as { when: Date }) as unknown as { when: string };
      expect(typeof out.when).toBe('string');
      expect(out.when).toBe('2026-05-03T00:00:00.000Z');
   });

   it('drops undefined / function / symbol values inside an object', () => {
      const src = {
         keep: 1,
         dropUndef: undefined,
         dropFn: () => 'noop',
         dropSym: Symbol('s')
      };
      const out = unproxify(src) as Record<string, unknown>;
      expect(out).toEqual({ keep: 1 });
      expect('dropUndef' in out).toBe(false);
      expect('dropFn' in out).toBe(false);
      expect('dropSym' in out).toBe(false);
   });

   it('throws on circular references (JSON.stringify limitation)', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a: any = { name: 'a' };
      a.self = a;
      expect(() => unproxify(a)).toThrow();
   });

   it('handles Map/Set by serializing them to {} (JSON.stringify default)', () => {
      // JSON.stringify(new Map()) === '{}'; locked because callers shouldn't use unproxify for these.
      const m = new Map([['k', 'v']]);
      const s = new Set([1, 2, 3]);
      expect(unproxify(m)).toEqual({});
      expect(unproxify(s)).toEqual({});
   });

   it('handles arrays of nested reactive children (deep unwrap)', () => {
      const items = reactive([reactive({ id: 1 }), reactive({ id: 2 })]);
      const out = unproxify(items) as unknown as Array<{ id: number }>;
      expect(out).toEqual([{ id: 1 }, { id: 2 }]);
      out.forEach((row) => expect(isProxy(row)).toBe(false));
   });
});

describe('unproxify (json=false mode)', () => {
   it('returns toRaw of an array (single-level unwrap)', () => {
      const proxy = reactive([1, 2, 3]);
      const out = unproxify(proxy, false);
      expect(isProxy(out)).toBe(false);
      expect(Array.isArray(out)).toBe(true);
      expect(out).toEqual([1, 2, 3]);
   });

   it('returns a shallow copy of an object with toRaw applied per key', () => {
      const inner = reactive({ x: 1 });
      const proxy = reactive({ a: 1, b: inner });
      const out = unproxify(proxy, false) as Record<string, unknown>;
      expect(isProxy(out)).toBe(false);
      // Top-level keys are toRaw'd; primitive values come back as-is.
      expect(out.a).toBe(1);
      // b was a proxy of inner — toRaw resolves it to the underlying raw object.
      expect(isProxy(out.b)).toBe(false);
      expect(out.b).toEqual({ x: 1 });
   });

   it('returns the primitive itself when given a non-object value', () => {
      expect(unproxify(123, false)).toBe(123);
      expect(unproxify('abc', false)).toBe('abc');
      expect(unproxify(true, false)).toBe(true);
   });

   it('returns null unchanged in non-json mode', () => {
      // null is `typeof 'object'` so falls into the object branch; for-in over null
      // iterates zero keys, producing an empty object — locked behavior.
      const out = unproxify<unknown>(null, false);
      expect(out).toEqual({});
   });

   it('returns undefined via toRaw in non-json mode', () => {
      // typeof undefined === 'undefined', not 'object' → falls into primitive branch.
      expect(unproxify<unknown>(undefined, false)).toBe(undefined);
   });

   it('does not deep-unwrap — nested object keys are toRaw of the raw object key', () => {
      // Locked: only own enumerable keys are processed; deep nesting is left intact.
      const proxy = reactive({ outer: { inner: { deep: 1 } } });
      const out = unproxify(proxy, false) as { outer: { inner: { deep: number } } };
      expect(out.outer.inner.deep).toBe(1);
   });
});
