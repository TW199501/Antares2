/**
 * Characterization tests for FakerMethods static class.
 *
 * The class exposes `_methods` (a hand-curated list of `{name, group, types}`
 * entries — sometimes with `params`), plus three derived helpers:
 *   - getGroups(): unique group names with merged type sets, alpha-sorted by name
 *   - getGroupsByType(type): groups that include the given type; '' returns []
 *   - getMethods({type, group}): methods matching both filters, name-sorted
 * Note: `_methods` deliberately contains duplicates across groups (e.g. 'color'
 * appears in commerce / internet / vehicle) — that is by design, not a bug.
 * Coverage caveat: getGroups() and getMethods() use a 3-branch comparator where
 * the second branch (`if (b.name > a.name) return 1`) is logically unreachable
 * for unique string names — if `a < b` is false and names differ then `b > a`
 * is also false, so flow falls to `return 0`. Lines 196/199/216 of source
 * therefore stay at 0 hits regardless of test input. Cannot fix without source
 * change; T3 forbids that. Effective covered lines for the live code = 100%.
 */
import { describe, expect, it } from 'vitest';

import FakerMethods from './FakerMethods';

describe('FakerMethods', () => {
   describe('_methods', () => {
      it('returns a non-empty array', () => {
         expect(Array.isArray(FakerMethods._methods)).toBe(true);
         expect(FakerMethods._methods.length).toBeGreaterThan(0);
      });

      it('every entry has {name: string, group: string, types: string[]}', () => {
         for (const entry of FakerMethods._methods) {
            expect(entry.name).toBeTypeOf('string');
            expect(entry.name.length).toBeGreaterThan(0);
            expect(entry.group).toBeTypeOf('string');
            expect(entry.group.length).toBeGreaterThan(0);
            expect(Array.isArray(entry.types)).toBe(true);
            expect(entry.types.length).toBeGreaterThan(0);
            for (const t of entry.types) expect(t).toBeTypeOf('string');
         }
      });

      it('contains expected core categories', () => {
         const groups = new Set(FakerMethods._methods.map(m => m.group));
         for (const expected of [
            'address',
            'commerce',
            'company',
            'database',
            'date',
            'finance',
            'git',
            'hacker',
            'internet',
            'lorem',
            'name',
            'phone',
            'random',
            'system',
            'time',
            'vehicle'
         ])
            expect(groups.has(expected)).toBe(true);
      });

      it('has no duplicate (name, group) pairs', () => {
         const seen = new Set<string>();
         for (const m of FakerMethods._methods) {
            const key = `${m.group}::${m.name}`;
            expect(seen.has(key), `duplicate ${key}`).toBe(false);
            seen.add(key);
         }
      });

      it('keeps the parameterized random.number / random.float entries with params: ["min","max"]', () => {
         const entries = FakerMethods._methods.filter(
            (m): m is typeof m & { params: string[] } =>
               m.group === 'random' && (m.name === 'number' || m.name === 'float') && 'params' in m
         );
         expect(entries.length).toBe(2);
         for (const e of entries)
            expect(e.params).toEqual(['min', 'max']);
      });

      it('returns the same content on repeated reads (idempotent getter)', () => {
         const a = FakerMethods._methods;
         const b = FakerMethods._methods;
         expect(a).toEqual(b);
      });
   });

   describe('getGroups()', () => {
      it('returns unique groups, sorted alphabetically by name', () => {
         const groups = FakerMethods.getGroups();
         const names = groups.map(g => g.name);
         expect(names).toEqual([...names].sort());
         expect(new Set(names).size).toBe(names.length);
      });

      it('each group entry has {name: string, types: string[]}', () => {
         for (const g of FakerMethods.getGroups()) {
            expect(g.name).toBeTypeOf('string');
            expect(Array.isArray(g.types)).toBe(true);
            for (const t of g.types) expect(t).toBeTypeOf('string');
         }
      });

      it('merges types across all methods within a group (no duplicates)', () => {
         for (const g of FakerMethods.getGroups())
            expect(new Set(g.types).size).toBe(g.types.length);
      });

      it('random group includes string + number + float + uuid types', () => {
         const random = FakerMethods.getGroups().find(g => g.name === 'random');
         expect(random).toBeDefined();
         expect(random!.types).toEqual(expect.arrayContaining(['string', 'number', 'float', 'uuid']));
      });
   });

   describe('getGroupsByType()', () => {
      it('returns [] for empty type', () => {
         expect(FakerMethods.getGroupsByType('')).toEqual([]);
      });

      it('returns only groups whose types include the requested type', () => {
         const numberGroups = FakerMethods.getGroupsByType('number');
         for (const g of numberGroups) expect(g.types).toContain('number');
         // 'random' supports number; 'finance' supports number
         const names = numberGroups.map(g => g.name);
         expect(names).toEqual(expect.arrayContaining(['random', 'finance']));
      });

      it('every group supports the "string" type', () => {
         const stringGroups = FakerMethods.getGroupsByType('string');
         expect(stringGroups.length).toBe(FakerMethods.getGroups().length);
      });

      it('returns [] for an unknown type', () => {
         expect(FakerMethods.getGroupsByType('not-a-real-type')).toEqual([]);
      });
   });

   describe('getMethods({type, group})', () => {
      it('returns methods that match both filters, sorted by name', () => {
         const result = FakerMethods.getMethods({ type: 'string', group: 'name' });
         expect(result.length).toBeGreaterThan(0);
         for (const m of result) {
            expect(m.group).toBe('name');
            expect(m.types).toContain('string');
         }
         const names = result.map(m => m.name);
         expect(names).toEqual([...names].sort());
      });

      it('returns [] when no method matches', () => {
         expect(FakerMethods.getMethods({ type: 'uuid', group: 'name' })).toEqual([]);
      });

      it('filters by type — random group with type=number contains only number-supporting methods', () => {
         const result = FakerMethods.getMethods({ type: 'number', group: 'random' });
         expect(result.length).toBeGreaterThan(0);
         for (const m of result) expect(m.types).toContain('number');
      });

      it('preserves original entry shape (name/group/types fields)', () => {
         const result = FakerMethods.getMethods({ type: 'string', group: 'lorem' });
         for (const m of result) {
            expect(m.name).toBeTypeOf('string');
            expect(m.group).toBe('lorem');
            expect(Array.isArray(m.types)).toBe(true);
         }
      });
   });
});
