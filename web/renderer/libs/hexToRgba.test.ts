/**
 * Characterization tests for hexToRGBA().
 *
 * Locked behavior (verified against current source):
 *   - Function name is hexToRGBA (uppercase RGBA), even though the file is
 *     hexToRgba.ts.
 *   - Strips only the FIRST '#' via String.replace (not replaceAll).
 *   - Expands 3-digit hex by doubling each character.
 *   - Default opacity is 1.
 *   - Whole-number opacity backward-compat: if opacity > 1 AND <= 100,
 *     it is divided by 100. So 50 -> 0.5, 100 -> 1, but 1.5 -> 0.015 (quirk).
 *   - Output format is the literal template `rgba(${r},${g},${b},${opacity})`
 *     with no spaces between commas.
 */
import { describe, expect, it } from 'vitest';

import { hexToRGBA } from './hexToRgba';

describe('hexToRGBA', () => {
   it('uses opacity 1 by default', () => {
      expect(hexToRGBA('#ff0000')).toBe('rgba(255,0,0,1)');
   });

   it('formats output with no spaces between commas', () => {
      expect(hexToRGBA('#000000', 0)).toBe('rgba(0,0,0,0)');
   });

   it('accepts hex without leading #', () => {
      expect(hexToRGBA('00ff00', 1)).toBe('rgba(0,255,0,1)');
   });

   it('expands 3-digit hex by doubling each character', () => {
      expect(hexToRGBA('#f00', 1)).toBe('rgba(255,0,0,1)');
      expect(hexToRGBA('#0f0', 1)).toBe('rgba(0,255,0,1)');
      expect(hexToRGBA('#00f', 1)).toBe('rgba(0,0,255,1)');
   });

   it('expands 3-digit hex without # the same way', () => {
      expect(hexToRGBA('abc', 1)).toBe('rgba(170,187,204,1)');
   });

   it('accepts opacity 0 (fully transparent)', () => {
      expect(hexToRGBA('#ffffff', 0)).toBe('rgba(255,255,255,0)');
   });

   it('accepts opacity 0.5 (half transparent)', () => {
      expect(hexToRGBA('#ffffff', 0.5)).toBe('rgba(255,255,255,0.5)');
   });

   it('accepts opacity 1 (fully opaque) without modification', () => {
      expect(hexToRGBA('#ffffff', 1)).toBe('rgba(255,255,255,1)');
   });

   it('treats whole-number opacity in (1, 100] as percentage (50 -> 0.5)', () => {
      expect(hexToRGBA('#ff0000', 50)).toBe('rgba(255,0,0,0.5)');
   });

   it('treats whole-number opacity 100 as 1', () => {
      expect(hexToRGBA('#ff0000', 100)).toBe('rgba(255,0,0,1)');
   });

   it('does NOT scale opacity values above 100 (passes through verbatim)', () => {
      // 200 > 100 fails the "<= 100" guard, so it's passed straight to the template
      expect(hexToRGBA('#ff0000', 200)).toBe('rgba(255,0,0,200)');
   });

   it('also scales fractional opacity values in (1, 100] (1.5 -> 0.015 quirk)', () => {
      // QUIRK: the guard is opacity > 1 && opacity <= 100, so 1.5 is divided by 100.
      expect(hexToRGBA('#ff0000', 1.5)).toBe('rgba(255,0,0,0.015)');
   });

   it('parses uppercase hex correctly', () => {
      expect(hexToRGBA('#FFAABB', 1)).toBe('rgba(255,170,187,1)');
   });

   it('parses mixed-case hex correctly', () => {
      expect(hexToRGBA('#aAbBcC', 1)).toBe('rgba(170,187,204,1)');
   });

   it('produces correct channels for a non-trivial 6-digit hex', () => {
      // 0xaa=170, 0xbb=187, 0xcc=204
      expect(hexToRGBA('#aabbcc', 0.25)).toBe('rgba(170,187,204,0.25)');
   });
});
