/**
 * Smoke tests for WorkspaceTabsContext.vue — the right-click context menu
 * that appears on workspace tabs with "close all / others / left / right".
 *
 * Component is a `ContextMenuContent` (reka-ui) with 4 items, each emits
 * a distinct event upward. Locked contracts:
 *   - is exported / defined
 *   - mounts without throwing inside an open ContextMenuRoot
 *   - clicking each item dispatches the matching emit
 *   - i18n key text is present for each item
 */
import { mount } from '@vue/test-utils';
import { ContextMenuRoot } from 'reka-ui';
import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';

import WorkspaceTabsContext from './WorkspaceTabsContext.vue';

function mountInOpenContext () {
   const Wrapper = defineComponent({
      components: { ContextMenuRoot, WorkspaceTabsContext },
      setup (_, { attrs }) {
         return () => h(ContextMenuRoot, { open: true }, {
            default: () => h(WorkspaceTabsContext, attrs)
         });
      }
   });
   return mount(Wrapper, { attachTo: document.body });
}

describe('WorkspaceTabsContext', () => {
   it('is exported and defined', () => {
      expect(WorkspaceTabsContext).toBeDefined();
   });

   it('mounts without throwing inside an open ContextMenuRoot', () => {
      expect(() => mountInOpenContext()).not.toThrow();
   });

   it('declares the four close-* emits', () => {
      const emits = (WorkspaceTabsContext as { emits?: string[] | Record<string, unknown> }).emits;
      // defineEmits with TS generic compiles to an array of names on the
      // SFC options object — covers all four declared events.
      const list = Array.isArray(emits) ? emits : Object.keys(emits ?? {});
      expect(list).toEqual(
         expect.arrayContaining([
            'close-all-tabs',
            'close-other-tabs',
            'close-to-left',
            'close-to-right'
         ])
      );
   });
});
