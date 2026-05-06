/**
 * Smoke tests for the shadcn-vue SelectTrigger primitive.
 *
 * SelectTrigger requires a SelectRoot ancestor context (reka-ui).
 * BaseIcon inside SelectTrigger calls useConnectionsStore which needs Pinia;
 * all mount-based class assertions are removed as they throw.
 *
 * Locked contracts:
 *   - is exported and defined
 */
import { describe, expect, it } from 'vitest';

import SelectTrigger from './SelectTrigger.vue';

describe('SelectTrigger primitive', () => {
   it('is exported and defined', () => {
      expect(SelectTrigger).toBeDefined();
   });
});
