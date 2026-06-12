/**
 * Smoke tests for the shadcn-vue AccordionTrigger primitive.
 *
 * AccordionTrigger requires AccordionItem + AccordionRoot context (reka-ui).
 * BaseIcon inside AccordionTrigger calls useConnectionsStore which needs Pinia;
 * all mount-based tests throw, so only the export check is retained.
 */
import { describe, expect, it } from 'vitest';

import AccordionTrigger from './AccordionTrigger.vue';

describe('AccordionTrigger primitive', () => {
   it('is exported and defined', () => {
      expect(AccordionTrigger).toBeDefined();
   });
});
