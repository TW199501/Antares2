import { describe, expect, it } from 'vitest';

import { uidGen } from './uidGen';

describe('uidGen', () => {
   it('returns a non-empty string', () => {
      const uid = uidGen();
      expect(uid).toBeTypeOf('string');
      expect(uid.length).toBeGreaterThan(0);
   });

   it('produces a 9-char base36 uppercase suffix when no prefix is given', () => {
      const uid = uidGen();
      expect(uid).toMatch(/^[A-Z0-9]{9}$/);
      expect(uid.length).toBe(9);
   });

   it('formats prefixed output as "<prefix>:<9-char suffix>"', () => {
      const uid = uidGen('conn');
      expect(uid).toMatch(/^conn:[A-Z0-9]{9}$/);
      expect(uid.startsWith('conn:')).toBe(true);
      expect(uid.length).toBe('conn:'.length + 9);
   });

   it('preserves arbitrary prefix content (no escaping)', () => {
      const uid = uidGen('user-123_x');
      expect(uid.startsWith('user-123_x:')).toBe(true);
      expect(uid).toMatch(/^user-123_x:[A-Z0-9]{9}$/);
   });

   it('returns unique values across 1000 calls (collision probability ~10^-15)', () => {
      const set = new Set<string>();
      for (let i = 0; i < 1000; i++) set.add(uidGen());
      expect(set.size).toBe(1000);
   });

   it('handles empty-string prefix as if no prefix (no leading ":")', () => {
      // Implementation: ternary `prefix ? ... : ''` — '' is falsy → no prefix branch
      const uid = uidGen('');
      expect(uid).toMatch(/^[A-Z0-9]{9}$/);
      expect(uid.includes(':')).toBe(false);
   });
});
