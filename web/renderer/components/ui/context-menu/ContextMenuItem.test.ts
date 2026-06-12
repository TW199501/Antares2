/**
 * Smoke tests for the shadcn-vue ContextMenuItem primitive.
 *
 * ContextMenuItem must live inside ContextMenuRoot + ContextMenuContent.
 * We force the root open so the portal renders.
 *
 * Locked contracts:
 *   - mounts without throwing inside open ContextMenu context
 *   - component is exported/defined
 */
import { mount } from '@vue/test-utils';
import { ContextMenuRoot } from 'reka-ui';
import { describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';

import ContextMenuContent from './ContextMenuContent.vue';
import ContextMenuItem from './ContextMenuItem.vue';

function mountItem (slotContent = '<span data-testid="label">Action</span>', extraClass = '') {
   const Wrapper = defineComponent({
      components: { ContextMenuRoot, ContextMenuContent, ContextMenuItem },
      props: {
         extraClass: { type: String, default: '' }
      },
      template: `
         <ContextMenuRoot :open="true">
            <ContextMenuContent>
               <ContextMenuItem :class="extraClass">${slotContent}</ContextMenuItem>
            </ContextMenuContent>
         </ContextMenuRoot>
      `
   });
   return mount(Wrapper, { props: { extraClass }, attachTo: document.body });
}

describe('ContextMenuItem primitive', () => {
   it('mounts without throwing inside open ContextMenu context', () => {
      expect(() => mountItem()).not.toThrow();
   });

   it('is exported and defined', () => {
      expect(ContextMenuItem).toBeDefined();
   });
});
