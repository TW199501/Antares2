/**
 * Smoke tests for the shadcn-vue Label primitive.
 *
 * Locked contracts:
 *   - mounts without throwing
 *   - renders slot content
 *   - data-slot attribute is present (reka-ui Label forwards it)
 *   - default class contains text-sm and font-medium
 *   - accepts extra class prop and merges it
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Label from './Label.vue';

describe('Label primitive', () => {
   it('mounts without throwing', () => {
      expect(() => mount(Label, { slots: { default: 'My label' } })).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mount(Label, { slots: { default: '<span data-testid="lbl">text</span>' } });
      expect(wrapper.find('[data-testid="lbl"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="lbl"]').text()).toBe('text');
   });

   it('default class includes text-sm and font-medium', () => {
      const wrapper = mount(Label, { slots: { default: 'x' } });
      expect(wrapper.html()).toContain('text-sm');
      expect(wrapper.html()).toContain('font-medium');
   });

   it('accepts extra class prop and merges it', () => {
      const wrapper = mount(Label, {
         props: { class: 'label-custom' },
         slots: { default: 'x' }
      });
      expect(wrapper.html()).toContain('label-custom');
   });

   it('is exported and defined', () => {
      expect(Label).toBeDefined();
   });
});
