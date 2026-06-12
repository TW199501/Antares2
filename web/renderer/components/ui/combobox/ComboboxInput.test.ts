/**
 * Smoke tests for the shadcn-vue ComboboxInput primitive.
 *
 * ComboboxInput requires a ComboboxRoot context (reka-ui).
 * Tests wrap it with the local Combobox.vue root.
 *
 * Locked contracts:
 *   - is exported and defined
 *   - mounts inside ComboboxRoot without throwing
 *   - renders an input element
 *   - applies h-9 w-full default classes
 *   - merges custom class prop
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Combobox from './Combobox.vue';
import ComboboxInput from './ComboboxInput.vue';

function mountInRoot (extraClass = '') {
   return mount(Combobox, {
      slots: {
         default: `<ComboboxInput placeholder="Search…" class="${extraClass}" />`
      },
      global: { components: { ComboboxInput } }
   });
}

describe('ComboboxInput primitive', () => {
   it('is exported and defined', () => {
      expect(ComboboxInput).toBeDefined();
   });

   it('mounts inside ComboboxRoot without throwing', () => {
      expect(() => mountInRoot()).not.toThrow();
   });

   it('renders an input element', () => {
      const wrapper = mountInRoot();
      expect(wrapper.find('input').exists()).toBe(true);
   });

   it('applies h-9 and w-full default classes', () => {
      const wrapper = mountInRoot();
      const html = wrapper.html();
      expect(html).toContain('h-9');
      expect(html).toContain('w-full');
   });

   it('merges custom class with default classes', () => {
      const wrapper = mountInRoot('my-input');
      expect(wrapper.html()).toContain('my-input');
      expect(wrapper.html()).toContain('h-9');
   });
});
