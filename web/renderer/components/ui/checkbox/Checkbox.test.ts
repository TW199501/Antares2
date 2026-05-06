/**
 * Smoke tests for the shadcn-vue Checkbox primitive (reka-ui CheckboxRoot wrapper).
 *
 * Locked contracts:
 *   - mounts without throwing
 *   - renders a button element with checkbox role
 *   - applies default size-4 + rounded-sm + border classes
 *   - merges custom class prop
 *   - is exported and defined
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Checkbox from './Checkbox.vue';

describe('Checkbox primitive (reka-ui CheckboxRoot wrapper)', () => {
   it('mounts without throwing', () => {
      expect(() => mount(Checkbox)).not.toThrow();
   });

   it('renders a button element with checkbox role', () => {
      const wrapper = mount(Checkbox);
      const btn = wrapper.find('button');
      expect(btn.exists()).toBe(true);
      expect(btn.attributes('role')).toBe('checkbox');
   });

   it('applies default size-4, rounded-sm, border classes', () => {
      const wrapper = mount(Checkbox);
      const cls = wrapper.find('button').element.className;
      expect(cls).toContain('size-4');
      expect(cls).toContain('rounded-sm');
      expect(cls).toContain('border');
   });

   it('merges custom class prop with default classes', () => {
      const wrapper = mount(Checkbox, { props: { class: 'my-checkbox' } });
      const cls = wrapper.find('button').element.className;
      expect(cls).toContain('my-checkbox');
      expect(cls).toContain('rounded-sm');
   });

   it('is exported and defined', () => {
      expect(Checkbox).toBeDefined();
   });
});
