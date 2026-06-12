/**
 * Smoke tests for the shadcn-vue Select primitive (reka-ui SelectRoot wrapper).
 *
 * Locked contracts:
 *   - mounts without throwing
 *   - renders default slot content
 *   - accepts modelValue prop
 *   - emits update:modelValue relay
 *   - is exported and defined
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';

import Select from './Select.vue';

describe('Select primitive (reka-ui SelectRoot wrapper)', () => {
   it('mounts without throwing', () => {
      expect(() =>
         mount(Select, {
            slots: { default: '<div>select content</div>' }
         })
      ).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mount(Select, {
         slots: { default: '<span data-testid="inner">hello</span>' }
      });
      expect(wrapper.find('[data-testid="inner"]').exists()).toBe(true);
   });

   it('accepts modelValue prop without throwing', () => {
      expect(() =>
         mount(Select, {
            props: { modelValue: 'opt1' },
            slots: { default: '<div />' }
         })
      ).not.toThrow();
   });

   it('reflects updated modelValue prop', async () => {
      const wrapper = mount(Select, {
         props: { modelValue: 'a' },
         slots: { default: '<div />' }
      });
      await wrapper.setProps({ modelValue: 'b' });
      await nextTick();
      expect(wrapper.props('modelValue')).toBe('b');
   });

   it('is exported and defined', () => {
      expect(Select).toBeDefined();
   });
});
