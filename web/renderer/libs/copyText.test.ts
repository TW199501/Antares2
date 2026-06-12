/**
 * Characterization tests for copyText().
 *
 * Locked behavior (verified against current source):
 *   - Calls navigator.clipboard.writeText(text). Nothing else.
 *   - Does NOT await the returned Promise — copyText itself returns void
 *     (writeText's resolution is fire-and-forget).
 *   - Has NO fallback path: if navigator.clipboard is undefined, the
 *     property access on `undefined` throws a TypeError synchronously.
 *   - Has NO try/catch: a writeText rejection propagates as an unhandled
 *     promise rejection (we don't assert on that — the function returns
 *     before the promise settles).
 */
import { describe, expect, it, vi } from 'vitest';

import { copyText } from './copyText';

describe('copyText', () => {
   it('calls navigator.clipboard.writeText with the supplied string', () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', { clipboard: { writeText } });

      copyText('hello world');

      expect(writeText).toHaveBeenCalledTimes(1);
      expect(writeText).toHaveBeenCalledWith('hello world');
   });

   it('passes empty strings through unchanged', () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', { clipboard: { writeText } });

      copyText('');

      expect(writeText).toHaveBeenCalledWith('');
   });

   it('passes multi-line strings through unchanged', () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', { clipboard: { writeText } });

      const multiline = 'line1\nline2\nline3';
      copyText(multiline);

      expect(writeText).toHaveBeenCalledWith(multiline);
   });

   it('returns undefined synchronously (does not await the writeText promise)', () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', { clipboard: { writeText } });

      const result = copyText('x');

      expect(result).toBeUndefined();
   });

   it('does NOT swallow writeText rejection (returns void immediately, the rejection floats)', () => {
      // We assert the function returned synchronously without throwing.
      // The unhandled rejection is the source's documented current behavior.
      const writeText = vi.fn().mockRejectedValue(new Error('denied'));
      vi.stubGlobal('navigator', { clipboard: { writeText } });

      expect(() => copyText('x')).not.toThrow();
      expect(writeText).toHaveBeenCalledWith('x');
   });

   it('throws synchronously when navigator.clipboard is undefined (no fallback)', () => {
      vi.stubGlobal('navigator', {});

      expect(() => copyText('x')).toThrow(TypeError);
   });

   it('throws synchronously when navigator.clipboard.writeText is missing', () => {
      vi.stubGlobal('navigator', { clipboard: {} });

      expect(() => copyText('x')).toThrow(TypeError);
   });
});
