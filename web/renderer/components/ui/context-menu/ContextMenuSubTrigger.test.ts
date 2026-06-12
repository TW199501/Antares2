/**
 * Smoke tests for the shadcn-vue ContextMenuSubTrigger primitive.
 *
 * ContextMenuSubTrigger must live inside ContextMenuRoot + ContextMenuSub.
 * Tests use ContextMenu.vue + ContextMenuSub.vue as the parent chain.
 *
 * Locked contracts:
 *   - ContextMenuSubTrigger is exported and defined
 */
import { describe, expect, it } from 'vitest';

import ContextMenuSubTrigger from './ContextMenuSubTrigger.vue';

describe('ContextMenuSubTrigger primitive', () => {
   it('is exported and defined', () => {
      expect(ContextMenuSubTrigger).toBeDefined();
   });
});
