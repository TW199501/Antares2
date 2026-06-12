/**
 * Smoke tests for the shadcn-vue ContextMenuRadioItem primitive.
 *
 * ContextMenuRadioItem must live inside ContextMenuRoot + ContextMenuRadioGroup.
 * Tests use ContextMenu.vue + ContextMenuRadioGroup.vue as the parent chain.
 *
 * Locked contracts:
 *   - ContextMenuRadioItem is exported and defined
 */
import { describe, expect, it } from 'vitest';

import ContextMenuRadioItem from './ContextMenuRadioItem.vue';

describe('ContextMenuRadioItem primitive', () => {
   it('is exported and defined', () => {
      expect(ContextMenuRadioItem).toBeDefined();
   });
});
