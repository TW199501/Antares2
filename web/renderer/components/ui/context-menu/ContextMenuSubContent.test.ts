/**
 * Smoke tests for the shadcn-vue ContextMenuSubContent primitive.
 *
 * ContextMenuSubContent uses ContextMenuPortal and renders only when the sub-menu
 * is open. It must be nested inside ContextMenuRoot → ContextMenuContent →
 * ContextMenuSub. We force both root and sub open to exercise portal rendering.
 *
 * Locked contracts:
 *   - mounts without throwing inside full open context-menu + sub context
 *   - component is exported/defined
 */
import { mount } from '@vue/test-utils';
import { ContextMenuRoot, ContextMenuSubTrigger } from 'reka-ui';
import { describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';

import ContextMenuContent from './ContextMenuContent.vue';
import ContextMenuSub from './ContextMenuSub.vue';
import ContextMenuSubContent from './ContextMenuSubContent.vue';

function mountSubContent (slotContent = '<div data-testid="sub-item">sub item</div>', extraClass = '') {
   const Wrapper = defineComponent({
      components: {
         ContextMenuRoot,
         ContextMenuContent,
         ContextMenuSub,
         ContextMenuSubTrigger,
         ContextMenuSubContent
      },
      props: {
         extraClass: { type: String, default: '' }
      },
      template: `
         <ContextMenuRoot :open="true">
            <ContextMenuContent>
               <ContextMenuSub :open="true">
                  <ContextMenuSubTrigger>More</ContextMenuSubTrigger>
                  <ContextMenuSubContent :class="extraClass">${slotContent}</ContextMenuSubContent>
               </ContextMenuSub>
            </ContextMenuContent>
         </ContextMenuRoot>
      `
   });
   return mount(Wrapper, { props: { extraClass }, attachTo: document.body });
}

describe('ContextMenuSubContent primitive', () => {
   it('mounts without throwing inside fully open context + sub context', () => {
      expect(() => mountSubContent()).not.toThrow();
   });

   it('is exported and defined', () => {
      expect(ContextMenuSubContent).toBeDefined();
   });
});
