/**
 * Smoke tests for the shadcn-vue DropdownMenuContent primitive.
 *
 * DropdownMenuContent uses DropdownMenuPortal internally and must be mounted
 * inside a DropdownMenuRoot. We test with open=true to ensure the portal renders.
 *
 * Locked contracts:
 *   - mounts without throwing inside DropdownMenu context (open=true)
 *   - component is exported/defined
 */
import { mount } from '@vue/test-utils';
import { DropdownMenuRoot } from 'reka-ui';
import { describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';

import DropdownMenuContent from './DropdownMenuContent.vue';

function mountOpenContent (slotContent = '<div data-testid="item">item</div>', extraClass = '') {
   const Wrapper = defineComponent({
      components: { DropdownMenuRoot, DropdownMenuContent },
      props: {
         extraClass: { type: String, default: '' }
      },
      template: `
         <DropdownMenuRoot :open="true">
            <DropdownMenuContent :class="extraClass">${slotContent}</DropdownMenuContent>
         </DropdownMenuRoot>
      `
   });
   return mount(Wrapper, { props: { extraClass }, attachTo: document.body });
}

describe('DropdownMenuContent primitive', () => {
   it('mounts without throwing inside open DropdownMenu context', () => {
      expect(() => mountOpenContent()).not.toThrow();
   });

   it('is exported and defined', () => {
      expect(DropdownMenuContent).toBeDefined();
   });
});
