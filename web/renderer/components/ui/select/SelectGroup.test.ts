/**
 * Smoke tests for the shadcn-vue SelectGroup primitive.
 *
 * SelectGroup must be mounted inside a SelectRoot context (reka-ui).
 * Tests wrap it with the local Select.vue root.
 *
 * Locked contracts:
 *   - is exported and defined
 *   - mounts inside SelectRoot without throwing
 *   - renders slot content
 *   - applies p-1 w-full default classes
 *   - merges custom class prop
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Select from './Select.vue';
import SelectGroup from './SelectGroup.vue';

function mountInRoot (extraClass = '', slotContent = '<div data-testid="group-item">item</div>') {
   return mount(Select, {
      slots: {
         default: `<SelectGroup class="${extraClass}">${slotContent}</SelectGroup>`
      },
      global: { components: { SelectGroup } }
   });
}

describe('SelectGroup primitive', () => {
   it('is exported and defined', () => {
      expect(SelectGroup).toBeDefined();
   });

   it('mounts inside SelectRoot without throwing', () => {
      expect(() => mountInRoot()).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mountInRoot('', '<span data-testid="sg-child">item</span>');
      expect(wrapper.find('[data-testid="sg-child"]').exists()).toBe(true);
   });

   it('applies p-1 and w-full default classes', () => {
      const wrapper = mountInRoot();
      const html = wrapper.html();
      expect(html).toContain('p-1');
      expect(html).toContain('w-full');
   });

   it('merges custom class with default classes', () => {
      const wrapper = mountInRoot('my-group');
      expect(wrapper.html()).toContain('my-group');
      expect(wrapper.html()).toContain('p-1');
   });
});
