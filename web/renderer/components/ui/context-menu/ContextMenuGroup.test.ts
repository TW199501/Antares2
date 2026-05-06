/**
 * Smoke tests for the shadcn-vue ContextMenuGroup primitive.
 *
 * ContextMenuGroup must be mounted inside ContextMenuRoot + ContextMenuContent.
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
import ContextMenuGroup from './ContextMenuGroup.vue';
import ContextMenuItem from './ContextMenuItem.vue';

function mountGroup (slotContent = '<div data-testid="child">child</div>') {
   const Wrapper = defineComponent({
      components: { ContextMenuRoot, ContextMenuContent, ContextMenuGroup, ContextMenuItem },
      template: `
         <ContextMenuRoot :open="true">
            <ContextMenuContent>
               <ContextMenuGroup>${slotContent}</ContextMenuGroup>
            </ContextMenuContent>
         </ContextMenuRoot>
      `
   });
   return mount(Wrapper, { attachTo: document.body });
}

describe('ContextMenuGroup primitive', () => {
   it('mounts without throwing inside open ContextMenu context', () => {
      expect(() => mountGroup()).not.toThrow();
   });

   it('is exported and defined', () => {
      expect(ContextMenuGroup).toBeDefined();
   });
});
