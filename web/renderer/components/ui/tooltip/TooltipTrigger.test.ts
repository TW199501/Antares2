/**
 * Smoke tests for the shadcn-vue TooltipTrigger primitive.
 *
 * TooltipTrigger requires TooltipProvider + TooltipRoot ancestors.
 *
 * Locked contracts:
 *   - mounts without throwing inside full tooltip context
 *   - renders slot content
 *   - as-child prop is accepted without throwing
 *   - component is exported/defined
 */
import { mount } from '@vue/test-utils';
import { TooltipProvider, TooltipRoot } from 'reka-ui';
import { describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';

import TooltipTrigger from './TooltipTrigger.vue';

function mountInContext (triggerSlot = '<button>hover</button>', triggerProps: Record<string, unknown> = {}) {
   const Wrapper = defineComponent({
      components: { TooltipProvider, TooltipRoot, TooltipTrigger },
      props: ['triggerProps'],
      template: `
         <TooltipProvider>
            <TooltipRoot>
               <TooltipTrigger v-bind="triggerProps">${triggerSlot}</TooltipTrigger>
            </TooltipRoot>
         </TooltipProvider>
      `
   });
   return mount(Wrapper, { props: { triggerProps } });
}

describe('TooltipTrigger primitive', () => {
   it('mounts without throwing inside full tooltip context', () => {
      expect(() => mountInContext()).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mountInContext('<span data-testid="label">hover me</span>');
      expect(wrapper.find('[data-testid="label"]').exists()).toBe(true);
   });

   it('accepts as-child prop without throwing', () => {
      expect(() =>
         mountInContext('<button>click</button>', { asChild: true })
      ).not.toThrow();
   });

   it('is exported and defined', () => {
      expect(TooltipTrigger).toBeDefined();
   });
});
