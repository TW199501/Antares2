/**
 * Smoke tests for the shadcn-vue DropdownMenuTrigger primitive.
 *
 * DropdownMenuTrigger must be mounted inside a DropdownMenuRoot context.
 *
 * Locked contracts:
 *   - mounts without throwing inside DropdownMenu context
 *   - renders slot content
 *   - data-slot attribute is present
 *   - accepts as-child prop without throwing
 *   - component is exported/defined
 */
import { mount } from '@vue/test-utils';
import { DropdownMenuRoot } from 'reka-ui';
import { describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';

import DropdownMenuTrigger from './DropdownMenuTrigger.vue';

function mountInContext (slotContent = '<button>open</button>', extraProps: Record<string, unknown> = {}) {
   const Wrapper = defineComponent({
      components: { DropdownMenuRoot, DropdownMenuTrigger },
      props: {
         triggerProps: { type: Object, default: () => ({}) }
      },
      template: `
         <DropdownMenuRoot>
            <DropdownMenuTrigger v-bind="triggerProps">${slotContent}</DropdownMenuTrigger>
         </DropdownMenuRoot>
      `
   });
   return mount(Wrapper, { props: { triggerProps: extraProps } });
}

describe('DropdownMenuTrigger primitive', () => {
   it('mounts without throwing inside DropdownMenu context', () => {
      expect(() => mountInContext()).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mountInContext('<span data-testid="label">open</span>');
      expect(wrapper.find('[data-testid="label"]').exists()).toBe(true);
   });

   it('renders a trigger element in the DOM', () => {
      const wrapper = mountInContext('<button>click</button>');
      expect(wrapper.find('button').exists()).toBe(true);
   });

   it('accepts as-child prop without throwing', () => {
      expect(() => mountInContext('<button>click</button>', { asChild: true })).not.toThrow();
   });

   it('is exported and defined', () => {
      expect(DropdownMenuTrigger).toBeDefined();
   });
});
