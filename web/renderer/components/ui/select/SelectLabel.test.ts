/**
 * Smoke tests for the shadcn-vue SelectLabel primitive.
 *
 * SelectLabel requires a SelectRoot ancestor context (reka-ui).
 * We use the local Select.vue wrapper as the root.
 *
 * Locked contracts:
 *   - mounts inside SelectRoot without throwing
 *   - renders slot content
 *   - applies default px-2 py-1.5 text-xs font-semibold classes
 *   - merges custom class prop
 *   - is exported and defined
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Select from './Select.vue';
import SelectGroup from './SelectGroup.vue';
import SelectLabel from './SelectLabel.vue';

function mountLabel (extraClass = '', slotContent = 'Group Label') {
   return mount(Select, {
      slots: {
         default: `<SelectGroup><SelectLabel class="${extraClass}">${slotContent}</SelectLabel></SelectGroup>`
      },
      global: { components: { SelectGroup, SelectLabel } }
   });
}

describe('SelectLabel primitive', () => {
   it('mounts inside SelectRoot without throwing', () => {
      expect(() => mountLabel()).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mountLabel('', 'Fruits');
      expect(wrapper.html()).toContain('Fruits');
   });

   it('applies default text-xs and font-semibold classes', () => {
      const wrapper = mountLabel();
      expect(wrapper.html()).toContain('text-xs');
      expect(wrapper.html()).toContain('font-semibold');
   });

   it('merges custom class prop with default classes', () => {
      const wrapper = mountLabel('my-label');
      expect(wrapper.html()).toContain('my-label');
      expect(wrapper.html()).toContain('text-xs');
   });

   it('is exported and defined', () => {
      expect(SelectLabel).toBeDefined();
   });
});
