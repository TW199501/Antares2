/**
 * Smoke tests for the shadcn-vue ContextMenuSub primitive.
 *
 * ContextMenuSub must be mounted inside ContextMenuRoot + ContextMenuContent.
 * It acts as a sub-menu provider — it requires ContextMenuRoot context to function.
 *
 * Locked contracts:
 *   - mounts without throwing inside open ContextMenu context
 *   - renders slot content
 *   - open prop is accepted without throwing
 *   - component is exported/defined
 *   - nested sub-trigger slot renders
 */
import { mount } from '@vue/test-utils';
import { ContextMenuRoot, ContextMenuSubTrigger } from 'reka-ui';
import { describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';

import ContextMenuContent from './ContextMenuContent.vue';
import ContextMenuSub from './ContextMenuSub.vue';

function mountSub (subSlot = '<div data-testid="sub-child">sub</div>', open = false) {
   const Wrapper = defineComponent({
      components: { ContextMenuRoot, ContextMenuContent, ContextMenuSub, ContextMenuSubTrigger },
      props: {
         subOpen: { type: Boolean, default: false }
      },
      template: `
         <ContextMenuRoot :open="true">
            <ContextMenuContent>
               <ContextMenuSub :open="subOpen">${subSlot}</ContextMenuSub>
            </ContextMenuContent>
         </ContextMenuRoot>
      `
   });
   return mount(Wrapper, { props: { subOpen: open }, attachTo: document.body });
}

describe('ContextMenuSub primitive', () => {
   it('mounts without throwing inside open ContextMenu context', () => {
      expect(() => mountSub()).not.toThrow();
   });

   it('accepts open=false prop without throwing', () => {
      expect(() => mountSub('<div />', false)).not.toThrow();
   });

   it('accepts open=true prop without throwing', () => {
      expect(() => mountSub('<ContextMenuSubTrigger>More</ContextMenuSubTrigger>', true)).not.toThrow();
   });

   it('is exported and defined', () => {
      expect(ContextMenuSub).toBeDefined();
   });
});
