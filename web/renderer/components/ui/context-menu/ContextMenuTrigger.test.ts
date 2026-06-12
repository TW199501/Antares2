/**
 * Smoke tests for the shadcn-vue ContextMenuTrigger primitive.
 *
 * ContextMenuTrigger must be mounted inside a ContextMenuRoot context.
 *
 * Locked contracts:
 *   - mounts without throwing inside ContextMenu context
 *   - renders slot content
 *   - renders an element in the DOM
 *   - accepts as-child prop without throwing
 *   - component is exported/defined
 */
import { mount } from '@vue/test-utils';
import { ContextMenuRoot } from 'reka-ui';
import { describe, expect, it } from 'vitest';
import { defineComponent } from 'vue';

import ContextMenuTrigger from './ContextMenuTrigger.vue';

function mountInContext (slotContent = '<div>right-click me</div>', extraProps: Record<string, unknown> = {}) {
   const Wrapper = defineComponent({
      components: { ContextMenuRoot, ContextMenuTrigger },
      props: {
         triggerProps: { type: Object, default: () => ({}) }
      },
      template: `
         <ContextMenuRoot>
            <ContextMenuTrigger v-bind="triggerProps">${slotContent}</ContextMenuTrigger>
         </ContextMenuRoot>
      `
   });
   return mount(Wrapper, { props: { triggerProps: extraProps } });
}

describe('ContextMenuTrigger primitive', () => {
   it('mounts without throwing inside ContextMenu context', () => {
      expect(() => mountInContext()).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mountInContext('<span data-testid="area">zone</span>');
      expect(wrapper.find('[data-testid="area"]').exists()).toBe(true);
   });

   it('renders an element in the DOM', () => {
      const wrapper = mountInContext('<div data-testid="trigger-el">area</div>');
      expect(wrapper.find('[data-testid="trigger-el"]').exists()).toBe(true);
   });

   it('accepts as-child prop without throwing', () => {
      expect(() => mountInContext('<div>area</div>', { asChild: true })).not.toThrow();
   });

   it('is exported and defined', () => {
      expect(ContextMenuTrigger).toBeDefined();
   });
});
