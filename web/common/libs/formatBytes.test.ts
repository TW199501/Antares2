import { describe, expect, it } from 'vitest';

import { formatBytes } from './formatBytes';

/**
 * Characterization tests for formatBytes.
 *
 * Implementation:
 *   - Special-cases bytes === 0 → "0 Bytes"
 *   - Otherwise picks unit index i = floor(log(bytes) / log(1024))
 *   - Returns parseFloat((bytes / 1024^i).toFixed(decimals)) + ' ' + sizes[i]
 *
 * Notable behavior locked in:
 *   - Uses 1024 (binary), not 1000 (decimal). 1 KB = 1024 B.
 *   - parseFloat strips trailing zeros: 1024 → "1 KB" (not "1.00 KB").
 *   - decimals defaults to 2; negative decimals are clamped to 0.
 *   - Negative inputs fall through (Math.log of negative = NaN); behavior is
 *     "NaN undefined" — undocumented but exercised here so any change shows up.
 *   - NaN / Infinity are also exercised to lock current behavior.
 */
describe('formatBytes', () => {
   it('returns "0 Bytes" for 0', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
   });

   it('formats 1 byte using the "Bytes" unit', () => {
      expect(formatBytes(1)).toBe('1 Bytes');
   });

   it('formats sub-KB values using the "Bytes" unit', () => {
      expect(formatBytes(512)).toBe('512 Bytes');
      expect(formatBytes(1023)).toBe('1023 Bytes');
   });

   it('formats exactly 1 KB', () => {
      expect(formatBytes(1024)).toBe('1 KB');
   });

   it('formats fractional KB with default 2 decimals (parseFloat strips trailing zeros)', () => {
      // 1536 / 1024 = 1.5 → "1.5 KB" (parseFloat drops the trailing zero)
      expect(formatBytes(1536)).toBe('1.5 KB');
   });

   it('formats exactly 1 MB', () => {
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
   });

   it('formats fractional MB rounded to 2 decimals', () => {
      // 1.234 MB ≈ 1293942.784 bytes → "1.23 MB"
      const bytes = Math.round(1.234 * 1024 * 1024);
      expect(formatBytes(bytes)).toBe('1.23 MB');
   });

   it('formats exactly 1 GB', () => {
      expect(formatBytes(1024 ** 3)).toBe('1 GB');
   });

   it('formats exactly 1 TB', () => {
      expect(formatBytes(1024 ** 4)).toBe('1 TB');
   });

   it('formats exactly 1 PB', () => {
      expect(formatBytes(1024 ** 5)).toBe('1 PB');
   });

   it('respects a custom decimals argument', () => {
      // 1536 / 1024 = 1.5 → with decimals=4 still "1.5" (parseFloat strips zeros)
      expect(formatBytes(1536, 4)).toBe('1.5 KB');
      // 1500 / 1024 ≈ 1.4648 → "1.4648 KB" with decimals=4
      expect(formatBytes(1500, 4)).toBe('1.4648 KB');
   });

   it('rounds to 0 decimals when decimals=0', () => {
      // 1536 / 1024 = 1.5 → rounds to 2 with toFixed(0); parseFloat → 2
      expect(formatBytes(1536, 0)).toBe('2 KB');
   });

   it('clamps negative decimals to 0', () => {
      // dm = decimals < 0 ? 0 : decimals. So formatBytes(1536, -3) === formatBytes(1536, 0).
      expect(formatBytes(1536, -3)).toBe(formatBytes(1536, 0));
   });

   it('returns "NaN undefined" for negative input (Math.log of negative is NaN, sizes[NaN] is undefined)', () => {
      // Locks in current behavior. If formatBytes is ever fixed to handle
      // negatives, this test should be updated alongside the source change.
      expect(formatBytes(-1)).toBe('NaN undefined');
   });

   it('returns "NaN undefined" for NaN input', () => {
      expect(formatBytes(Number.NaN)).toBe('NaN undefined');
   });

   it('returns "Infinity undefined" for Infinity input', () => {
      // Math.log(Infinity) / Math.log(1024) = Infinity → sizes[Infinity] = undefined
      // Infinity / Math.pow(1024, Infinity) = NaN, but parseFloat(NaN.toFixed(...))
      // throws because NaN.toFixed is fine, returns "NaN" → parseFloat → NaN.
      // Result therefore lands as "NaN undefined".
      expect(formatBytes(Number.POSITIVE_INFINITY)).toBe('NaN undefined');
   });
});
