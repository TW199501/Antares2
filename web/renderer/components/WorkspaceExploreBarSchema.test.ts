/**
 * Tests for WorkspaceExploreBarSchema — the recursive schema/tree node in the
 * left-side explorer bar.
 *
 * NOTE: This component depends on reka-ui's AccordionTrigger which uses
 * provide/inject through AccordionRoot. happy-dom + stubbed Accordion roots
 * cannot satisfy that injection, so live mount throws
 * `Injection Symbol(AccordionRootContext) not found`.
 *
 * Until a richer stub for the reka-ui Accordion family is wired up, this
 * spec is reduced to module-import + shape sanity checks. The DOM-level
 * assertions (mount, click, watcher narrowing) are owned by the e2e suite.
 */
import { describe, expect, it } from 'vitest';

import WorkspaceExploreBarSchema from './WorkspaceExploreBarSchema.vue';

describe('WorkspaceExploreBarSchema', () => {
   it('module exports a defined component', () => {
      expect(WorkspaceExploreBarSchema).toBeDefined();
   });

   it('component is an object (Vue SFC)', () => {
      expect(typeof WorkspaceExploreBarSchema).toBe('object');
      expect(WorkspaceExploreBarSchema).not.toBeNull();
   });

   it('component has a name or __name marker', () => {
      const comp = WorkspaceExploreBarSchema as Record<string, unknown>;
      // Compiled SFCs expose either `name` or `__name` (script-setup default).
      const hasName = typeof comp.name === 'string' || typeof comp.__name === 'string';
      expect(hasName).toBe(true);
   });
});
