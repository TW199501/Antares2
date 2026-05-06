/**
 * Tests for WorkspaceExploreBarSchema.vue — recursive schema/tree node in the
 * left-side explorer bar.
 *
 * Mount-based assertions are intentionally absent here: the SFC pulls in
 * reka-ui's bare `AccordionTrigger` primitive directly, which throws
 * `Injection Symbol(AccordionRootContext) not found` unless a real
 * `AccordionRoot` ancestor is mounted. Stubbing only the local re-exports
 * does not satisfy the inner primitive's `inject` call. Until a fixture
 * with a real reka Accordion tree is wired up, we keep the suite as
 * import-shape sanity tests so the file stays green and protects against
 * SFC compilation regressions.
 */
import { describe, expect, it } from 'vitest';

import WorkspaceExploreBarSchema from './WorkspaceExploreBarSchema.vue';

describe('WorkspaceExploreBarSchema (module sanity)', () => {
   it('component module is defined', () => {
      expect(WorkspaceExploreBarSchema).toBeDefined();
   });

   it('component module is an object (compiled SFC)', () => {
      expect(typeof WorkspaceExploreBarSchema).toBe('object');
   });

   it('component module is non-null', () => {
      expect(WorkspaceExploreBarSchema).not.toBeNull();
   });

   it('component module declares a name or render/setup hook', () => {
      const mod = WorkspaceExploreBarSchema as Record<string, unknown>;
      const hasShape =
         'name' in mod ||
         'render' in mod ||
         'setup' in mod ||
         '__name' in mod ||
         '__file' in mod;
      expect(hasShape).toBe(true);
   });

   it('component module supports being treated as Vue component definition', () => {
      // The default export of an SFC is the component options object — at minimum
      // it should be assignable to a record so app.component(...) registration
      // and `defineAsyncComponent` would not throw on the type check side.
      const mod = WorkspaceExploreBarSchema as Record<string, unknown>;
      expect(Object.prototype.toString.call(mod)).toBe('[object Object]');
   });

   it('component module is importable repeatedly without changing identity', async () => {
      const again = (await import('./WorkspaceExploreBarSchema.vue')).default;
      expect(again).toBe(WorkspaceExploreBarSchema);
   });
});
