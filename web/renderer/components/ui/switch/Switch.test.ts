/**
 * Smoke tests for the shadcn-vue Switch primitive (reka-ui SwitchRoot wrapper).
 *
 * Locked contracts:
 *   - mounts without throwing
 *   - renders the reka-ui switch role element
 *   - applies default inline-flex + rounded-full classes
 *   - merges custom class prop
 *   - is exported and defined
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Switch from './Switch.vue';

describe('Switch primitive (reka-ui SwitchRoot wrapper)', () => {
   it('mounts without throwing', () => {
      expect(() => mount(Switch)).not.toThrow();
   });

   it('renders a button element with switch role', () => {
      const wrapper = mount(Switch);
      // reka-ui SwitchRoot renders as <button role="switch">
      const btn = wrapper.find('button');
      expect(btn.exists()).toBe(true);
      expect(btn.attributes('role')).toBe('switch');
   });

   it('applies default classes (inline-flex, rounded-full)', () => {
      const wrapper = mount(Switch);
      const cls = wrapper.find('button').element.className;
      expect(cls).toContain('inline-flex');
      expect(cls).toContain('rounded-full');
   });

   it('merges custom class prop with default classes', () => {
      const wrapper = mount(Switch, { props: { class: 'my-switch' } });
      const cls = wrapper.find('button').element.className;
      expect(cls).toContain('my-switch');
      expect(cls).toContain('inline-flex');
   });

   it('is exported and defined', () => {
      expect(Switch).toBeDefined();
   });
});
