/**
 * Smoke tests for the shadcn-vue ContextMenuLabel primitive.
 *
 * ContextMenuLabel must be mounted inside ContextMenuRoot + ContextMenuContent.
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
import ContextMenuLabel from './ContextMenuLabel.vue';

function mountLabel (slotContent = '<span>Group</span>', extraClass = '') {
   const Wrapper = defineComponent({
      components: { ContextMenuRoot, ContextMenuContent, ContextMenuLabel },
      props: {
         extraClass: { type: String, default: '' }
      },
      template: `
         <ContextMenuRoot :open="true">
            <ContextMenuContent>
               <ContextMenuLabel :class="extraClass">${slotContent}</ContextMenuLabel>
            </ContextMenuContent>
         </ContextMenuRoot>
      `
   });
   return mount(Wrapper, { props: { extraClass }, attachTo: document.body });
}

describe('ContextMenuLabel primitive', () => {
   it('mounts without throwing inside open ContextMenu context', () => {
      expect(() => mountLabel()).not.toThrow();
   });

   it('is exported and defined', () => {
      expect(ContextMenuLabel).toBeDefined();
   });
});
