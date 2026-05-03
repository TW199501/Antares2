/**
 * Characterization tests for the shadcn-vue `cn()` className helper.
 *
 * Locked behavior:
 *   - cn(...inputs) === twMerge(clsx(inputs))
 *   - clsx flattens arrays/objects and filters falsy (null/undefined/false/0/'')
 *   - tailwind-merge resolves conflicting Tailwind classes (last wins per group)
 *   - Conflict resolution is "smart" (e.g. p-2 vs p-4 collapse, but p-2 + px-4 keep both)
 *   - Empty / no-arg input returns ''
 */
import { describe, expect, it } from 'vitest';

import { cn } from './utils';

describe('cn', () => {
   it('returns an empty string when called with no arguments', () => {
      expect(cn()).toBe('');
   });

   it('joins multiple plain string class names with single spaces', () => {
      expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
   });

   it('drops falsy values (null, undefined, false, 0, empty string)', () => {
      expect(cn('a', null, 'b', undefined, false, 0, '', 'c')).toBe('a b c');
   });

   it('flattens nested arrays of class names (clsx behavior)', () => {
      expect(cn(['a', ['b', ['c']]], 'd')).toBe('a b c d');
   });

   it('treats object keys as classes when their values are truthy', () => {
      expect(cn({ active: true, disabled: false, primary: 1 })).toBe('active primary');
   });

   it('mixes strings, arrays and objects in one call', () => {
      expect(cn('btn', ['rounded', { 'is-active': true }], { hidden: false })).toBe(
         'btn rounded is-active'
      );
   });

   it('resolves conflicting Tailwind padding classes — last one wins', () => {
      // p-2 and p-4 target the same group; tailwind-merge collapses to p-4
      expect(cn('p-2', 'p-4')).toBe('p-4');
   });

   it('keeps non-conflicting Tailwind classes from different groups', () => {
      // padding axis-x and full padding overlap, but text-* is independent
      expect(cn('p-2', 'text-sm')).toBe('p-2 text-sm');
   });

   it('lets a more-specific axis class override the shorthand it conflicts with', () => {
      // Per tailwind-merge rules: px-4 overrides the x-axis portion of p-2,
      // resulting in "p-2 px-4" (p-2 still applies to y-axis).
      expect(cn('p-2', 'px-4')).toBe('p-2 px-4');
   });

   it('resolves conflicting text-color classes — last one wins', () => {
      expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
   });

   it('preserves conditional class via object syntax over a base class', () => {
      const isPrimary = true;
      expect(cn('btn', { 'btn-primary': isPrimary, 'btn-secondary': !isPrimary })).toBe(
         'btn btn-primary'
      );
   });

   it('returns a string type', () => {
      expect(typeof cn('a', 'b')).toBe('string');
   });

   it('deduplicates equal Tailwind tokens via twMerge', () => {
      // twMerge returns the canonical "last occurrence" form, removing the earlier dup
      expect(cn('p-4', 'p-4')).toBe('p-4');
   });

   it('handles deeply nested arrays mixed with conditional objects', () => {
      const result = cn([
         'base',
         [['nested-1', { 'nested-2': true }], 'nested-3'],
         { 'flag-a': false, 'flag-b': true }
      ]);
      expect(result).toBe('base nested-1 nested-2 nested-3 flag-b');
   });
});
