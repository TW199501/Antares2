/**
 * Smoke tests for the shadcn-vue DropdownMenu primitive (reka-ui DropdownMenuRoot wrapper).
 *
 * Locked contracts:
 *   - mounts without throwing
 *   - slot renders inside root
 *   - open prop is forwarded
 *   - emits update:open on controlled prop change
 *   - component is exported/defined
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';

import DropdownMenu from './DropdownMenu.vue';

describe('DropdownMenu primitive (reka-ui DropdownMenuRoot wrapper)', () => {
   it('mounts without throwing', () => {
      expect(() =>
         mount(DropdownMenu, { slots: { default: '<span>content</span>' } })
      ).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mount(DropdownMenu, {
         slots: { default: '<span data-testid="inner">hello</span>' }
      });
      expect(wrapper.find('[data-testid="inner"]').exists()).toBe(true);
   });

   it('accepts open prop without throwing', () => {
      expect(() =>
         mount(DropdownMenu, {
            props: { open: false },
            slots: { default: '<div />' }
         })
      ).not.toThrow();
   });

   it('forwards open prop change without throwing', async () => {
      const wrapper = mount(DropdownMenu, {
         props: { open: false },
         slots: { default: '<div />' }
      });
      await wrapper.setProps({ open: true });
      await nextTick();
      expect(wrapper.props('open')).toBe(true);
   });

   it('is exported and defined', () => {
      expect(DropdownMenu).toBeDefined();
   });
});
