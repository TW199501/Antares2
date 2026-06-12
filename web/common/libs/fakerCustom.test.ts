/**
 * Characterization tests for fakerCustom.
 *
 * fakerCustom is a Proxy that delegates to a rebuilt @faker-js/faker instance,
 * adding `setLocale(name)`, `seed(n)`, a `date.now()` moment formatter, and a
 * `time` namespace (`now`, `random`). Locale change is non-throwing for unknown
 * locales — it falls back to the default faker. Seeding is forwarded so output
 * is reproducible across rebuilds. Tests assert types/formats only (per T3
 * guidance — no exact-value assertions on faker output).
 */
import { describe, expect, it } from 'vitest';

import { fakerCustom } from './fakerCustom';

describe('fakerCustom', () => {
   it('exposes setLocale function', () => {
      expect(fakerCustom.setLocale).toBeTypeOf('function');
   });

   it('exposes seed function', () => {
      expect(fakerCustom.seed).toBeTypeOf('function');
   });

   it('exposes date namespace with custom now() returning YYYY-MM-DD HH:mm:ss', () => {
      const value = fakerCustom.date.now();
      expect(value).toBeTypeOf('string');
      expect(value).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
   });

   it('exposes time.now() returning HH:mm:ss', () => {
      const value = fakerCustom.time.now();
      expect(value).toBeTypeOf('string');
      expect(value).toMatch(/^\d{2}:\d{2}:\d{2}$/);
   });

   it('exposes time.random() returning HH:mm:ss', () => {
      const value = fakerCustom.time.random();
      expect(value).toBeTypeOf('string');
      expect(value).toMatch(/^\d{2}:\d{2}:\d{2}$/);
   });

   it('forwards faker namespaces (person/internet/lorem) through the Proxy', () => {
      expect(fakerCustom.person).toBeTypeOf('object');
      expect(fakerCustom.internet).toBeTypeOf('object');
      expect(fakerCustom.lorem).toBeTypeOf('object');
   });

   it('produces a reproducible value for the same seed', () => {
      fakerCustom.seed(42);
      const first = fakerCustom.person.firstName();
      fakerCustom.seed(42);
      const second = fakerCustom.person.firstName();
      expect(first).toBe(second);
   });

   it('produces different values across consecutive un-reseeded calls (smoke)', () => {
      fakerCustom.seed(1);
      const collected = new Set<string>();
      for (let i = 0; i < 5; i++) collected.add(fakerCustom.lorem.word());
      expect(collected.size).toBeGreaterThan(1);
   });

   it('supports `in` checks via the Proxy `has` trap', () => {
      expect('setLocale' in fakerCustom).toBe(true);
      expect('seed' in fakerCustom).toBe(true);
      expect('time' in fakerCustom).toBe(true);
      expect('person' in fakerCustom).toBe(true);
   });

   it('setLocale("") resets to default faker without throwing', () => {
      expect(() => fakerCustom.setLocale('')).not.toThrow();
      // After reset, namespaces are still available
      expect(fakerCustom.person).toBeTypeOf('object');
   });

   it('setLocale with a known locale (en) does not throw and keeps namespaces', () => {
      expect(() => fakerCustom.setLocale('en')).not.toThrow();
      const name = fakerCustom.person.firstName();
      expect(name).toBeTypeOf('string');
      expect(name.length).toBeGreaterThan(0);
   });

   it('setLocale with an unknown locale falls back silently (no throw)', () => {
      expect(() => fakerCustom.setLocale('this-locale-does-not-exist')).not.toThrow();
      // Default faker is restored — basic generators still work
      const word = fakerCustom.lorem.word();
      expect(word).toBeTypeOf('string');
      expect(word.length).toBeGreaterThan(0);
   });

   it('setLocale caches per-locale Faker instances (calling twice with same name is safe)', () => {
      expect(() => {
         fakerCustom.setLocale('en');
         fakerCustom.setLocale('en');
      }).not.toThrow();
   });

   it('time.now() and date.now() return current-time formatted strings (length sanity)', () => {
      // HH:mm:ss is exactly 8 chars; YYYY-MM-DD HH:mm:ss is 19 chars
      expect(fakerCustom.time.now().length).toBe(8);
      expect(fakerCustom.date.now().length).toBe(19);
   });
});
