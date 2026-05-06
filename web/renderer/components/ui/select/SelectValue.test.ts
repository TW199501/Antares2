/**
 * Smoke tests for the shadcn-vue SelectValue primitive.
 *
 * SelectValue requires a SelectRoot context (reka-ui).
 * Tests wrap it with the local Select.vue root.
 *
 * Locked contracts:
 *   - is exported and defined
 *   - mounts inside SelectRoot without throwing
 *   - renders placeholder prop text when no value selected
 *   - renders custom slot content
 *   - mount with modelValue does not throw
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Select from './Select.vue';
import SelectValue from './SelectValue.vue';

function mountInRoot (placeholder = '', slotContent = '') {
   const slotStr = slotContent
      ? `<SelectValue placeholder="${placeholder}">${slotContent}</SelectValue>`
      : `<SelectValue placeholder="${placeholder}" />`;
   return mount(Select, {
      slots: { default: slotStr },
      global: { components: { SelectValue } }
   });
}

describe('SelectValue primitive', () => {
   it('is exported and defined', () => {
      expect(SelectValue).toBeDefined();
   });

   it('mounts inside SelectRoot without throwing', () => {
      expect(() => mountInRoot('Pick one')).not.toThrow();
   });

   it('renders placeholder text when no value selected', () => {
      const wrapper = mountInRoot('Choose option');
      expect(wrapper.html()).toContain('Choose option');
   });

   it('renders custom slot content', () => {
      const wrapper = mountInRoot('', '<span data-testid="val">Selected</span>');
      expect(wrapper.find('[data-testid="val"]').exists()).toBe(true);
   });

   it('mounts inside Select with modelValue without throwing', () => {
      expect(() =>
         mount(Select, {
            props: { modelValue: 'opt1' },
            slots: { default: '<SelectValue />' },
            global: { components: { SelectValue } }
         })
      ).not.toThrow();
   });
});
