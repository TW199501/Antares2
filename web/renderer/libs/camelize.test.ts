/**
 * Characterization tests for camelize().
 *
 * Locked behavior (verified against current source):
 *   - Splits on hyphen ONLY (kebab-case). Snake_case is NOT supported and is
 *     returned unchanged.
 *   - First segment is preserved verbatim; every subsequent segment has its
 *     first character uppercased, rest preserved (no lowercasing of the rest).
 *   - Empty input returns empty string.
 *   - Leading hyphen yields a leading-PascalCase segment (e.g. '-foo' -> 'Foo').
 *   - Trailing hyphen yields the original prefix unchanged (final empty segment
 *     contributes '').
 *   - Consecutive hyphens collapse (empty segments contribute '').
 */
import { describe, expect, it } from 'vitest';

import { camelize } from './camelize';

describe('camelize', () => {
   it('returns empty string for empty input', () => {
      expect(camelize('')).toBe('');
   });

   it('returns single word unchanged when there is no hyphen', () => {
      expect(camelize('foo')).toBe('foo');
   });

   it('preserves an already-camelCase string when there is no hyphen', () => {
      expect(camelize('fooBar')).toBe('fooBar');
   });

   it('joins kebab-case into camelCase for two segments', () => {
      expect(camelize('foo-bar')).toBe('fooBar');
   });

   it('joins kebab-case into camelCase for many segments', () => {
      expect(camelize('foo-bar-baz')).toBe('fooBarBaz');
   });

   it('uppercases only the first character of each non-leading segment', () => {
      // 'BAR' stays 'BAR' (no lowercasing of remaining chars), then 'b' -> 'B'
      expect(camelize('foo-BAR-baz')).toBe('fooBARBaz');
   });

   it('handles single-character segments', () => {
      expect(camelize('a-b-c')).toBe('aBC');
   });

   it('does NOT split on snake_case (underscore is preserved)', () => {
      expect(camelize('foo_bar')).toBe('foo_bar');
   });

   it('treats a leading hyphen by uppercasing the next segment (empty first segment)', () => {
      expect(camelize('-foo')).toBe('Foo');
   });

   it('treats a trailing hyphen as a no-op tail (empty trailing segment)', () => {
      expect(camelize('foo-')).toBe('foo');
   });

   it('collapses consecutive hyphens (each empty segment contributes nothing)', () => {
      expect(camelize('foo--bar')).toBe('fooBar');
   });

   it('returns empty for a string of only hyphens', () => {
      expect(camelize('---')).toBe('');
   });
});
