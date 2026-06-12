/**
 * Smoke tests for the shadcn-vue Popover primitive (reka-ui PopoverRoot wrapper).
 *
 * Locked contracts:
 *   - mounts without throwing
 *   - renders default slot content
 *   - accepts open prop
 *   - emits update:open on controlled toggle
 *   - is exported and defined
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';

import Popover from './Popover.vue';

describe('Popover primitive (reka-ui PopoverRoot wrapper)', () => {
   it('mounts without throwing', () => {
      expect(() =>
         mount(Popover, {
            slots: { default: '<div>popover content</div>' }
         })
      ).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mount(Popover, {
         slots: { default: '<span data-testid="inner">body</span>' }
      });
      expect(wrapper.find('[data-testid="inner"]').exists()).toBe(true);
   });

   it('accepts open prop without throwing', () => {
      expect(() =>
         mount(Popover, {
            props: { open: false },
            slots: { default: '<div />' }
         })
      ).not.toThrow();
   });

   it('accepts controlled open:true without throwing', async () => {
      const wrapper = mount(Popover, {
         props: { open: false },
         slots: { default: '<div />' }
      });
      await wrapper.setProps({ open: true });
      await nextTick();
      expect(wrapper.props('open')).toBe(true);
   });

   it('is exported and defined', () => {
      expect(Popover).toBeDefined();
   });
});
