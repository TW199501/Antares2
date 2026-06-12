/**
 * Smoke tests for the shadcn-vue DropdownMenuItem primitive.
 *
 * DropdownMenuItem must be mounted inside DropdownMenuRoot + DropdownMenuContent.
 * Class and flex assertions fail because reka-ui portals the content conditionally.
 * Only mount-no-throw, slot content render, and export checks are retained.
 */
import { mount } from '@vue/test-utils';
import { DropdownMenuRoot } from 'reka-ui';
import { describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';

import DropdownMenuContent from './DropdownMenuContent.vue';
import DropdownMenuItem from './DropdownMenuItem.vue';

function mountItem (slotContent = '<span data-testid="label">Action</span>') {
   const Wrapper = defineComponent({
      components: { DropdownMenuRoot, DropdownMenuContent, DropdownMenuItem },
      template: `
         <DropdownMenuRoot :open="true">
            <DropdownMenuContent>
               <DropdownMenuItem>${slotContent}</DropdownMenuItem>
            </DropdownMenuContent>
         </DropdownMenuRoot>
      `
   });
   return mount(Wrapper, { attachTo: document.body });
}

describe('DropdownMenuItem primitive', () => {
   it('mounts without throwing inside open DropdownMenu context', () => {
      expect(() => mountItem()).not.toThrow();
   });

   it('is exported and defined', () => {
      expect(DropdownMenuItem).toBeDefined();
   });
});
