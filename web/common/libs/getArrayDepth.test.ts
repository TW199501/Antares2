import { describe, expect, it } from 'vitest';

import { getArrayDepth } from './getArrayDepth';

/**
 * Characterization tests for getArrayDepth.
 *
 * Implementation:
 *   getArrayDepth(x) = isArray(x) ? 1 + max(0, ...x.map(getArrayDepth)) : 0
 *
 * - Non-array → 0.
 * - [] → 1 (the empty list itself is one level — max(0) === 0, plus 1).
 * - [1, 2, 3] → 1 (children are non-arrays → contribute 0; plus 1).
 * - Mixed siblings take the max depth of any child branch.
 *
 * The `max(0, ...)` seed guarantees `[]` returns 1 even with no children.
 */
describe('getArrayDepth', () => {
   it('returns 0 for non-array input', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(getArrayDepth(42 as any)).toBe(0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(getArrayDepth('hello' as any)).toBe(0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(getArrayDepth(null as any)).toBe(0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(getArrayDepth(undefined as any)).toBe(0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(getArrayDepth({ length: 3 } as any)).toBe(0);
   });

   it('returns 1 for an empty array', () => {
      expect(getArrayDepth([])).toBe(1);
   });

   it('returns 1 for a flat array of primitives', () => {
      expect(getArrayDepth([1, 2, 3])).toBe(1);
      expect(getArrayDepth(['a', 'b', null, undefined, 0])).toBe(1);
   });

   it('returns 2 for a singly-nested array', () => {
      expect(getArrayDepth([[1, 2], [3, 4]])).toBe(2);
   });

   it('returns 5 for a 5-deep nested array', () => {
      expect(getArrayDepth([[[[[1]]]]])).toBe(5);
   });

   it('takes the maximum depth among siblings of differing depths', () => {
      // First child is depth-1, second is depth-3 — overall depth is 1 + 3 = 4
      const arr = [
         [1, 2, 3],
         [[[1]]]
      ];
      expect(getArrayDepth(arr)).toBe(4);
   });

   it('treats a sibling that is just a primitive as depth-0 (does not lower the result)', () => {
      // Primitive child contributes 0; deepest array child wins.
      expect(getArrayDepth([1, [[2, 3]], 4])).toBe(3);
   });

   it('handles an array containing only an empty array as depth 2', () => {
      expect(getArrayDepth([[]])).toBe(2);
   });

   it('handles wide arrays without stack issues (1000-wide flat)', () => {
      const wide = Array.from({ length: 1000 }, (_, i) => i);
      expect(getArrayDepth(wide)).toBe(1);
   });
});
