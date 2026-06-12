/**
 * Smoke tests for the shadcn-vue TooltipProvider primitive.
 *
 * TooltipProvider wraps reka-ui's TooltipProvider with a default delayDuration.
 *
 * Locked contracts:
 *   - mounts without throwing
 *   - renders default slot content
 *   - default delayDuration is 300 (from withDefaults)
 *   - accepts custom delayDuration prop
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import TooltipProvider from './TooltipProvider.vue';

describe('TooltipProvider primitive', () => {
   it('mounts without throwing', () => {
      expect(() =>
         mount(TooltipProvider, {
            slots: { default: '<div>child</div>' }
         })
      ).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mount(TooltipProvider, {
         slots: { default: '<span data-testid="inner">content</span>' }
      });
      expect(wrapper.find('[data-testid="inner"]').exists()).toBe(true);
   });

   it('accepts default delayDuration of 300', () => {
      const wrapper = mount(TooltipProvider, {
         slots: { default: '<div />' }
      });
      // Default from withDefaults — prop value resolves to 300
      expect(wrapper.props('delayDuration')).toBe(300);
   });

   it('accepts custom delayDuration prop', () => {
      const wrapper = mount(TooltipProvider, {
         props: { delayDuration: 700 },
         slots: { default: '<div />' }
      });
      expect(wrapper.props('delayDuration')).toBe(700);
   });

   it('is defined as a component', () => {
      expect(TooltipProvider).toBeDefined();
   });
});
