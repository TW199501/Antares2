/**
 * Smoke tests for the shadcn-vue ComboboxEmpty primitive.
 *
 * ComboboxEmpty must be mounted inside a ComboboxRoot (reka-ui).
 * Tests wrap it with the local Combobox.vue root.
 *
 * Locked contracts:
 *   - is exported and defined
 *   - mounts inside ComboboxRoot without throwing
 *   - renders slot content
 *   - applies py-6 text-center default classes
 *   - merges custom class prop
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Combobox from './Combobox.vue';
import ComboboxEmpty from './ComboboxEmpty.vue';

function mountInRoot (extraClass = '', slotContent = 'No results.') {
   return mount(Combobox, {
      slots: {
         default: `<ComboboxEmpty class="${extraClass}">${slotContent}</ComboboxEmpty>`
      },
      global: { components: { ComboboxEmpty } }
   });
}

describe('ComboboxEmpty primitive', () => {
   it('is exported and defined', () => {
      expect(ComboboxEmpty).toBeDefined();
   });

   it('mounts inside ComboboxRoot without throwing', () => {
      expect(() => mountInRoot()).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mountInRoot('', 'Nothing found');
      expect(wrapper.html()).toContain('Nothing found');
   });

   it('applies py-6 and text-center default classes', () => {
      const wrapper = mountInRoot();
      expect(wrapper.html()).toContain('py-6');
      expect(wrapper.html()).toContain('text-center');
   });

   it('merges custom class with default classes', () => {
      const wrapper = mountInRoot('my-empty');
      expect(wrapper.html()).toContain('my-empty');
      expect(wrapper.html()).toContain('py-6');
   });
});
