/**
 * Smoke tests for the shadcn-vue ContextMenuContent primitive.
 *
 * ContextMenuContent uses ContextMenuPortal internally and renders only when
 * the context menu is open. We force open=true via ContextMenuRoot prop.
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

function mountOpenContent (slotContent = '<div data-testid="item">item</div>', extraClass = '') {
   const Wrapper = defineComponent({
      components: { ContextMenuRoot, ContextMenuContent },
      props: {
         extraClass: { type: String, default: '' }
      },
      template: `
         <ContextMenuRoot :open="true">
            <ContextMenuContent :class="extraClass">${slotContent}</ContextMenuContent>
         </ContextMenuRoot>
      `
   });
   return mount(Wrapper, { props: { extraClass }, attachTo: document.body });
}

describe('ContextMenuContent primitive', () => {
   it('mounts without throwing inside open ContextMenu context', () => {
      expect(() => mountOpenContent()).not.toThrow();
   });

   it('is exported and defined', () => {
      expect(ContextMenuContent).toBeDefined();
   });
});
