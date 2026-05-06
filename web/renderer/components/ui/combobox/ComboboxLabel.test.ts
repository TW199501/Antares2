/**
 * Smoke tests for the shadcn-vue ComboboxLabel primitive.
 *
 * ComboboxLabel must be mounted inside a ComboboxRoot (reka-ui).
 * Tests wrap it with the local Combobox.vue root.
 *
 * Locked contracts:
 *   - is exported and defined
 *   - mounts inside ComboboxRoot without throwing
 *   - renders slot content
 *   - applies px-2 py-1.5 text-xs default classes
 *   - merges custom class prop
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Combobox from './Combobox.vue';
import ComboboxLabel from './ComboboxLabel.vue';

function mountInRoot (extraClass = '', slotContent = 'Group Header') {
   return mount(Combobox, {
      slots: {
         default: `<ComboboxLabel class="${extraClass}">${slotContent}</ComboboxLabel>`
      },
      global: { components: { ComboboxLabel } }
   });
}

describe('ComboboxLabel primitive', () => {
   it('is exported and defined', () => {
      expect(ComboboxLabel).toBeDefined();
   });

   it('mounts inside ComboboxRoot without throwing', () => {
      expect(() => mountInRoot()).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mountInRoot('', 'My Label');
      expect(wrapper.html()).toContain('My Label');
   });

   it('applies px-2 and text-xs default classes', () => {
      const wrapper = mountInRoot();
      expect(wrapper.html()).toContain('px-2');
      expect(wrapper.html()).toContain('text-xs');
   });

   it('merges custom class with default classes', () => {
      const wrapper = mountInRoot('my-label');
      expect(wrapper.html()).toContain('my-label');
      expect(wrapper.html()).toContain('px-2');
   });
});
