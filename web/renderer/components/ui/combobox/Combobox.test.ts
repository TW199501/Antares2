/**
 * Smoke tests for the shadcn-vue Combobox primitive (reka-ui ComboboxRoot wrapper).
 *
 * Locked contracts:
 *   - mounts without throwing
 *   - renders default slot content
 *   - applies 'relative' default class
 *   - merges custom class prop
 *   - is exported and defined
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Combobox from './Combobox.vue';

describe('Combobox primitive (reka-ui ComboboxRoot wrapper)', () => {
   it('mounts without throwing', () => {
      expect(() =>
         mount(Combobox, {
            slots: { default: '<div>content</div>' }
         })
      ).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mount(Combobox, {
         slots: { default: '<span data-testid="inner">hello</span>' }
      });
      expect(wrapper.find('[data-testid="inner"]').exists()).toBe(true);
   });

   it('applies relative default class', () => {
      const wrapper = mount(Combobox, {
         slots: { default: '<div />' }
      });
      expect(wrapper.html()).toContain('relative');
   });

   it('merges custom class prop with default classes', () => {
      const wrapper = mount(Combobox, {
         props: { class: 'my-combobox' },
         slots: { default: '<div />' }
      });
      expect(wrapper.html()).toContain('my-combobox');
      expect(wrapper.html()).toContain('relative');
   });

   it('is exported and defined', () => {
      expect(Combobox).toBeDefined();
   });
});
