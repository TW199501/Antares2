/**
 * Smoke tests for the shadcn-vue ComboboxItem primitive.
 *
 * ComboboxItem requires a ComboboxRoot context (reka-ui).
 * Tests wrap it with the local Combobox.vue root.
 *
 * Locked contracts:
 *   - is exported and defined
 *   - mounts inside ComboboxRoot without throwing
 *   - renders slot content
 *   - applies cursor-default select-none default classes
 *   - merges custom class prop
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Combobox from './Combobox.vue';
import ComboboxItem from './ComboboxItem.vue';

function mountInRoot (extraClass = '', slotContent = '<span data-testid="item-label">Option A</span>') {
   return mount(Combobox, {
      slots: {
         default: `<ComboboxItem value="a" class="${extraClass}">${slotContent}</ComboboxItem>`
      },
      global: { components: { ComboboxItem } }
   });
}

describe('ComboboxItem primitive', () => {
   it('is exported and defined', () => {
      expect(ComboboxItem).toBeDefined();
   });

   it('mounts inside ComboboxRoot without throwing', () => {
      expect(() => mountInRoot()).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mountInRoot('', '<span data-testid="item-label">Option A</span>');
      expect(wrapper.find('[data-testid="item-label"]').exists()).toBe(true);
   });

   it('applies cursor-default and select-none default classes', () => {
      const wrapper = mountInRoot();
      const html = wrapper.html();
      expect(html).toContain('cursor-default');
      expect(html).toContain('select-none');
   });

   it('merges custom class with default classes', () => {
      const wrapper = mountInRoot('my-item');
      expect(wrapper.html()).toContain('my-item');
      expect(wrapper.html()).toContain('cursor-default');
   });
});
