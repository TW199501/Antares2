/**
 * Tests for useFilters composable.
 *
 * Filter helpers used throughout the renderer for display formatting:
 * cutText, lastPart, formatDate, localeString, wrapNumber, parseKeys.
 *
 * wrapNumber is exercised across the full union widened in commit 9db642c
 * (number | string | null | undefined | false) — every falsy branch must
 * return '' and every truthy value must wrap as `(value)`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useFilters } from './useFilters';

describe('useFilters', () => {
   describe('cutText', () => {
      it('truncates long strings with ellipsis', () => {
         const { cutText } = useFilters();
         expect(cutText('hello world', 5)).toBe('hello...');
      });

      it('returns the original string when shorter than the limit', () => {
         const { cutText } = useFilters();
         expect(cutText('hi', 10)).toBe('hi');
      });

      it('collapses consecutive whitespace when escape is true', () => {
         const { cutText } = useFilters();
         expect(cutText('a    b   c', 100, true)).toBe('a b c');
      });

      it('returns non-string input unchanged', () => {
         const { cutText } = useFilters();
         expect(cutText(123 as unknown as string, 5)).toBe(123);
      });
   });

   describe('lastPart', () => {
      it('returns empty string for empty input', () => {
         const { lastPart } = useFilters();
         expect(lastPart('', 10)).toBe('');
      });

      it('returns the final path segment when shorter than the limit', () => {
         const { lastPart } = useFilters();
         expect(lastPart('a/b/file.sql', 50)).toBe('file.sql');
      });

      it('truncates the final segment with leading ellipsis when over the limit', () => {
         const { lastPart } = useFilters();
         expect(lastPart('a/b/very-long-file-name.sql', 5)).toBe('...e.sql');
      });

      it('handles backslash-separated paths (Windows)', () => {
         const { lastPart } = useFilters();
         expect(lastPart('C:\\Users\\foo\\bar.txt', 50)).toBe('bar.txt');
      });
   });

   describe('formatDate', () => {
      it('formats a valid Date with HH:mm:ss - YYYY/MM/DD', () => {
         const { formatDate } = useFilters();
         const out = formatDate(new Date('2026-05-03T12:34:56'));
         expect(out).toMatch(/^\d{2}:\d{2}:\d{2} - 2026\/05\/03$/);
      });

      it('returns the original value when Date is invalid', () => {
         const { formatDate } = useFilters();
         const invalid = new Date('not-a-date');
         expect(formatDate(invalid)).toBe(invalid);
      });
   });

   describe('localeString', () => {
      it('formats a number with locale grouping', () => {
         const { localeString } = useFilters();
         expect(localeString(1234567)).toBe((1234567).toLocaleString());
      });

      it('returns undefined for null', () => {
         const { localeString } = useFilters();
         expect(localeString(null)).toBeUndefined();
      });

      it('formats zero as "0" (zero is not null)', () => {
         const { localeString } = useFilters();
         expect(localeString(0)).toBe((0).toLocaleString());
      });
   });

   describe('wrapNumber (full union widened in 9db642c)', () => {
      it('wraps a positive number in parentheses', () => {
         const { wrapNumber } = useFilters();
         expect(wrapNumber(42)).toBe('(42)');
      });

      it('wraps a non-empty string', () => {
         const { wrapNumber } = useFilters();
         expect(wrapNumber('255')).toBe('(255)');
      });

      it('returns empty string for 0 (falsy)', () => {
         const { wrapNumber } = useFilters();
         expect(wrapNumber(0)).toBe('');
      });

      it('returns empty string for empty string', () => {
         const { wrapNumber } = useFilters();
         expect(wrapNumber('')).toBe('');
      });

      it('returns empty string for null', () => {
         const { wrapNumber } = useFilters();
         expect(wrapNumber(null)).toBe('');
      });

      it('returns empty string for undefined', () => {
         const { wrapNumber } = useFilters();
         expect(wrapNumber(undefined)).toBe('');
      });

      it('returns empty string for false', () => {
         const { wrapNumber } = useFilters();
         expect(wrapNumber(false)).toBe('');
      });
   });

   describe('parseKeys', () => {
      const originalPlatform = navigator.platform;

      beforeEach(() => {
         Object.defineProperty(navigator, 'platform', {
            value: 'Win32',
            configurable: true
         });
      });

      afterEach(() => {
         Object.defineProperty(navigator, 'platform', {
            value: originalPlatform,
            configurable: true
         });
      });

      it('wraps each key segment in <code> with bold class', () => {
         const { parseKeys } = useFilters();
         // Cast: actual signature accepts Record<number, string>[] but the impl
         // re-casts to string[] internally — we mirror that by passing strings.
         const out = parseKeys(['Ctrl+S'] as unknown as Record<number, string>[]);
         expect(out).toBe('<code class="text-bold">Ctrl</code>+<code class="text-bold">S</code>');
      });

      it('replaces CommandOrControl with Control on non-Mac platforms', () => {
         const { parseKeys } = useFilters();
         const out = parseKeys(['CommandOrControl+B'] as unknown as Record<number, string>[]);
         expect(out).toContain('Control');
         expect(out).not.toContain('CommandOrControl');
         expect(out).not.toContain('Command<');
      });

      it('replaces CommandOrControl with Command on Mac platforms', () => {
         vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
         const { parseKeys } = useFilters();
         const out = parseKeys(['CommandOrControl+B'] as unknown as Record<number, string>[]);
         expect(out).toContain('>Command<');
         expect(out).not.toContain('Control');
      });

      it('joins multiple shortcut entries with ", "', () => {
         const { parseKeys } = useFilters();
         const out = parseKeys(['F5', 'F6'] as unknown as Record<number, string>[]);
         expect(out.split(', ')).toHaveLength(2);
      });
   });
});
