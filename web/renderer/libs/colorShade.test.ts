/**
 * Characterization tests for colorShade().
 *
 * Locked behavior (verified against current source):
 *   - Strips ALL '#' chars via replaceAll (so '##fff' is treated as 'fff').
 *   - Expands 3-digit hex to 6-digit by character doubling.
 *   - Adds `amount` to each channel; clamps each result to [0, 255] independently.
 *   - Returns lowercase 6-digit hex prefixed with a single '#' (uses toString(16)
 *     which always emits lowercase, and zero-pads channels < 0x10).
 *   - Negative amounts darken; positive amounts lighten.
 */
import { describe, expect, it } from 'vitest';

import { colorShade } from './colorShade';

describe('colorShade', () => {
   it('returns the same color when amount is 0 (6-digit input with #)', () => {
      expect(colorShade('#abcdef', 0)).toBe('#abcdef');
   });

   it('accepts hex without leading # and still prefixes # in output', () => {
      expect(colorShade('abcdef', 0)).toBe('#abcdef');
   });

   it('expands 3-digit hex by doubling each character', () => {
      // '#fa3' -> 'ffaa33'; amount 0 keeps it
      expect(colorShade('#fa3', 0)).toBe('#ffaa33');
   });

   it('lowercases uppercase hex via toString(16)', () => {
      expect(colorShade('#FFAABB', 0)).toBe('#ffaabb');
   });

   it('strips multiple # characters via replaceAll', () => {
      // replaceAll strips both, leaves 'fff' (3-digit), expands to 'ffffff'
      expect(colorShade('##fff', 0)).toBe('#ffffff');
   });

   it('clamps each channel at 255 when adding past upper bound', () => {
      expect(colorShade('#ffffff', 255)).toBe('#ffffff');
   });

   it('clamps each channel at 0 when subtracting past lower bound', () => {
      expect(colorShade('#000000', -255)).toBe('#000000');
   });

   it('darkens with a negative amount', () => {
      // 0xff - 0x10 = 0xef across all channels
      expect(colorShade('#ffffff', -16)).toBe('#efefef');
   });

   it('lightens with a positive amount', () => {
      // 0x00 + 0x10 = 0x10 across all channels
      expect(colorShade('#000000', 16)).toBe('#101010');
   });

   it('zero-pads single-digit channel values', () => {
      // 0x00 + 1 = 1 -> toString(16) = '1' -> padded to '01'
      expect(colorShade('#000000', 1)).toBe('#010101');
   });

   it('clamps each channel independently', () => {
      // r=0xff (clamped from 0xff+10), g=0x10, b=0x00
      expect(colorShade('#ff0000', 16)).toBe('#ff1010');
   });

   it('produces a lowercase mixed-channel result for a non-trivial shade', () => {
      // 0xaa + 0x11 = 0xbb, 0xbb + 0x11 = 0xcc, 0xcc + 0x11 = 0xdd
      expect(colorShade('#aabbcc', 17)).toBe('#bbccdd');
   });
});
