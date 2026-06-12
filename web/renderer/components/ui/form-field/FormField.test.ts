/**
 * Smoke tests for the shadcn-vue FormField primitive.
 *
 * FormField is a plain Vue component (no reka-ui root needed) that wraps a
 * label, a default slot, and an optional error message.
 *
 * Locked contracts:
 *   - mounts without throwing
 *   - renders slot content
 *   - renders <Label> when label prop is provided
 *   - renders error message when error prop is provided
 *   - merges custom class prop
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import FormField from './FormField.vue';

describe('FormField primitive', () => {
   it('mounts without throwing', () => {
      expect(() =>
         mount(FormField, {
            slots: { default: '<input data-testid="inp" />' }
         })
      ).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mount(FormField, {
         slots: { default: '<input data-testid="inp" />' }
      });
      expect(wrapper.find('[data-testid="inp"]').exists()).toBe(true);
   });

   it('renders a <label> when label prop is provided', () => {
      const wrapper = mount(FormField, {
         props: { label: 'Email address' },
         slots: { default: '<input />' }
      });
      expect(wrapper.find('label').text()).toContain('Email address');
   });

   it('renders error message when error prop is provided', () => {
      const wrapper = mount(FormField, {
         props: { error: 'Required field' },
         slots: { default: '<input />' }
      });
      expect(wrapper.html()).toContain('Required field');
   });

   it('merges custom class prop onto the wrapper div', () => {
      const wrapper = mount(FormField, {
         props: { class: 'my-field' },
         slots: { default: '<input />' }
      });
      expect(wrapper.find('div').element.className).toContain('my-field');
   });
});
