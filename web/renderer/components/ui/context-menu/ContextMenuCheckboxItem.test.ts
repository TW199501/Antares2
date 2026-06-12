/**
 * Smoke tests for the shadcn-vue ContextMenuCheckboxItem primitive.
 *
 * ContextMenuCheckboxItem must live inside a ContextMenuRoot context.
 * Tests use ContextMenu.vue as the parent wrapper.
 *
 * Locked contracts:
 *   - ContextMenuCheckboxItem is exported and defined
 */
import { describe, expect, it } from 'vitest';

import ContextMenuCheckboxItem from './ContextMenuCheckboxItem.vue';

describe('ContextMenuCheckboxItem primitive', () => {
   it('is exported and defined', () => {
      expect(ContextMenuCheckboxItem).toBeDefined();
   });
});
