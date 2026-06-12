import { describe, expect, it } from 'vitest';

import hexToBinary, { type HexChar } from './hexToBinary';

/**
 * Characterization tests for hexToBinary.
 *
 * HexChar union is mixed: digits 0-9 are NUMBER literals, hex letters
 * a-f / A-F are STRING literals (because object literal numeric keys
 * coerce to numbers in JS). So `hexToBinary([0, 'a'])` is the typed form;
 * `['0', 'a']` would work at runtime (key coercion) but fail tsc.
 *
 * Edge cases exercised:
 *   - empty array → ''
 *   - single nibble lookup (digits + letters, lower + upper)
 *   - byte alignment: arrays of any length (odd or even) are accepted
 *   - invalid chars: lookup returns undefined → concatenated "undefined".
 *     Locked in via a cast that mimics a runtime type violation.
 */
describe('hexToBinary', () => {
   it('returns "" for an empty array', () => {
      expect(hexToBinary([])).toBe('');
   });

   it('maps 0 (number) to "0000"', () => {
      expect(hexToBinary([0])).toBe('0000');
   });

   it('maps "f" to "1111"', () => {
      expect(hexToBinary(['f'])).toBe('1111');
   });

   it('maps "F" (uppercase) to "1111"', () => {
      expect(hexToBinary(['F'])).toBe('1111');
   });

   it('expands every nibble correctly (0-9 as numbers, a-f as strings)', () => {
      const allLowercase: HexChar[] = [
         0, 1, 2, 3, 4, 5, 6, 7,
         8, 9, 'a', 'b', 'c', 'd', 'e', 'f'
      ];
      expect(hexToBinary(allLowercase)).toBe(
         '0000000100100011010001010110011110001001101010111100110111101111'
      );
   });

   it('treats uppercase A-F identically to lowercase a-f', () => {
      const upper: HexChar[] = ['A', 'B', 'C', 'D', 'E', 'F'];
      const lower: HexChar[] = ['a', 'b', 'c', 'd', 'e', 'f'];
      expect(hexToBinary(upper)).toBe(hexToBinary(lower));
   });

   it('accepts mixed-case input', () => {
      // 0xDeAdBeEf
      const mixed: HexChar[] = ['D', 'e', 'A', 'd', 'B', 'e', 'E', 'f'];
      expect(hexToBinary(mixed)).toBe('11011110101011011011111011101111');
   });

   it('produces 4 bits per char for arrays of any length (odd length is allowed)', () => {
      expect(hexToBinary([1, 2, 3])).toBe('000100100011');
      expect(hexToBinary([1, 2, 3, 4])).toBe('0001001000110100');
   });

   it('emits the literal "undefined" for chars outside the lookup table', () => {
      // Locks in current behavior: lookup miss yields concatenated "undefined".
      // The function is typed to accept only HexChar; this cast simulates a
      // runtime-violated type to characterize the failure mode.
      const bad = ['z'] as unknown as HexChar[];
      expect(hexToBinary(bad)).toBe('undefined');
   });
});
