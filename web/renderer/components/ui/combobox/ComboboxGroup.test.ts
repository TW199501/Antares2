/**
 * Smoke tests for the shadcn-vue ComboboxGroup primitive.
 *
 * ComboboxGroup must be mounted inside a ComboboxRoot (reka-ui).
 * Tests wrap it with the local Combobox.vue root.
 *
 * Locked contracts:
 *   - is exported and defined
 *   - mounts inside ComboboxRoot without throwing
 *   - renders slot content
 *   - applies overflow-hidden p-1 default classes
 *   - merges custom class prop
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Combobox from './Combobox.vue';
import ComboboxGroup from './ComboboxGroup.vue';

function mountInRoot (extraClass = '', slotContent = '<div data-testid="group-child">item</div>') {
   return mount(Combobox, {
      slots: {
         default: `<ComboboxGroup class="${extraClass}">${slotContent}</ComboboxGroup>`
      },
      global: { components: { ComboboxGroup } }
   });
}

describe('ComboboxGroup primitive', () => {
   it('is exported and defined', () => {
      expect(ComboboxGroup).toBeDefined();
   });

   it('mounts inside ComboboxRoot without throwing', () => {
      expect(() => mountInRoot()).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mountInRoot('', '<span data-testid="g-child">item</span>');
      expect(wrapper.find('[data-testid="g-child"]').exists()).toBe(true);
   });

   it('applies overflow-hidden and p-1 default classes', () => {
      const wrapper = mountInRoot();
      expect(wrapper.html()).toContain('overflow-hidden');
      expect(wrapper.html()).toContain('p-1');
   });

   it('merges custom class with default classes', () => {
      const wrapper = mountInRoot('my-group');
      expect(wrapper.html()).toContain('my-group');
      expect(wrapper.html()).toContain('overflow-hidden');
   });
});
