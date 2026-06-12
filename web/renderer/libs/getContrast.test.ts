/**
 * Characterization tests for getContrast().
 *
 * Locked behavior (verified against current source):
 *   - Returns the literal strings 'dark' or 'light' (NOT hex colors).
 *   - Empty input returns empty string '' (falsy short-circuit).
 *   - Compares parseInt(hex, 16) against 0xffffff / 2 = 8388607.5
 *     (strict greater-than). Brighter than midpoint -> 'dark', else -> 'light'.
 *   - 3-digit hex is parsed as the literal 3-digit value (no expansion), so
 *     '#fff' parses to 4095 -> 'light' (this is a quirk worth locking).
 *   - Strips only the first '#' via String.replace.
 */
import { describe, expect, it } from 'vitest';

import { getContrast } from './getContrast';

describe('getContrast', () => {
   it('returns empty string for empty input (falsy short-circuit)', () => {
      expect(getContrast('')).toBe('');
   });

   it('returns "dark" for pure white (#ffffff above midpoint)', () => {
      expect(getContrast('#ffffff')).toBe('dark');
   });

   it('returns "light" for pure black (#000000 below midpoint)', () => {
      expect(getContrast('#000000')).toBe('light');
   });

   it('accepts hex without leading # (only first # is stripped anyway)', () => {
      expect(getContrast('ffffff')).toBe('dark');
      expect(getContrast('000000')).toBe('light');
   });

   it('returns "light" at the exact integer midpoint 0x7fffff (not strictly greater)', () => {
      // 0x7fffff = 8388607, threshold 8388607.5 -> not greater -> light
      expect(getContrast('#7fffff')).toBe('light');
   });

   it('returns "dark" just above the midpoint at 0x800000', () => {
      // 0x800000 = 8388608 -> > 8388607.5 -> dark
      expect(getContrast('#800000')).toBe('dark');
   });

   it('parses 3-digit hex literally without expansion (#fff -> 4095 -> light)', () => {
      // QUIRK: unlike colorShade/hexToRGBA, this function does not expand 3-digit hex.
      expect(getContrast('#fff')).toBe('light');
   });

   it('parses 3-digit hex without # the same way (literal 0xfff = 4095 -> light)', () => {
      expect(getContrast('fff')).toBe('light');
   });
});
