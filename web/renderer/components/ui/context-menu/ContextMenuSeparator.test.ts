/**
 * Smoke tests for the shadcn-vue ContextMenuSeparator primitive.
 *
 * ContextMenuSeparator must be mounted inside ContextMenuRoot + ContextMenuContent.
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
import ContextMenuSeparator from './ContextMenuSeparator.vue';

function mountSeparator (extraClass = '') {
   const Wrapper = defineComponent({
      components: { ContextMenuRoot, ContextMenuContent, ContextMenuSeparator },
      props: {
         extraClass: { type: String, default: '' }
      },
      template: `
         <ContextMenuRoot :open="true">
            <ContextMenuContent>
               <ContextMenuSeparator :class="extraClass" />
            </ContextMenuContent>
         </ContextMenuRoot>
      `
   });
   return mount(Wrapper, { props: { extraClass }, attachTo: document.body });
}

describe('ContextMenuSeparator primitive', () => {
   it('mounts without throwing inside open ContextMenu context', () => {
      expect(() => mountSeparator()).not.toThrow();
   });

   it('is exported and defined', () => {
      expect(ContextMenuSeparator).toBeDefined();
   });
});
