/**
 * Smoke tests for the shadcn-vue RadioGroup primitive (reka-ui RadioGroupRoot wrapper).
 *
 * Locked contracts:
 *   - mounts without throwing
 *   - renders slot content
 *   - applies default grid gap-2 classes
 *   - merges custom class prop
 *   - accepts modelValue prop
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import RadioGroup from './RadioGroup.vue';

describe('RadioGroup primitive (reka-ui RadioGroupRoot wrapper)', () => {
   it('mounts without throwing', () => {
      expect(() =>
         mount(RadioGroup, {
            slots: { default: '<div>content</div>' }
         })
      ).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mount(RadioGroup, {
         slots: { default: '<span data-testid="item">item</span>' }
      });
      expect(wrapper.find('[data-testid="item"]').exists()).toBe(true);
   });

   it('applies default grid and gap-2 classes', () => {
      const wrapper = mount(RadioGroup, {
         slots: { default: '<div />' }
      });
      const html = wrapper.html();
      expect(html).toContain('grid');
      expect(html).toContain('gap-2');
   });

   it('merges custom class prop with default classes', () => {
      const wrapper = mount(RadioGroup, {
         props: { class: 'my-radio-group' },
         slots: { default: '<div />' }
      });
      const html = wrapper.html();
      expect(html).toContain('my-radio-group');
      expect(html).toContain('grid');
   });

   it('accepts modelValue prop without throwing', () => {
      expect(() =>
         mount(RadioGroup, {
            props: { modelValue: 'opt1' },
            slots: { default: '<div />' }
         })
      ).not.toThrow();
   });
});
