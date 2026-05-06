/**
 * Smoke tests for the shadcn-vue RadioGroupItem primitive.
 *
 * RadioGroupItem requires a RadioGroupRoot ancestor context (reka-ui).
 * We use the local RadioGroup.vue wrapper as the root.
 *
 * Locked contracts:
 *   - mounts inside RadioGroup context without throwing
 *   - renders a button element with radio role
 *   - applies default aspect-square, rounded-full, border classes
 *   - merges custom class prop
 *   - is exported and defined
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import RadioGroup from './RadioGroup.vue';
import RadioGroupItem from './RadioGroupItem.vue';

function mountItem (extraClass = '') {
   return mount(RadioGroup, {
      slots: {
         default: `<RadioGroupItem value="opt1" class="${extraClass}" />`
      },
      global: { components: { RadioGroupItem } }
   });
}

describe('RadioGroupItem primitive', () => {
   it('mounts inside RadioGroup context without throwing', () => {
      expect(() => mountItem()).not.toThrow();
   });

   it('renders a button element with radio role', () => {
      const wrapper = mountItem();
      const btn = wrapper.find('button');
      expect(btn.exists()).toBe(true);
      expect(btn.attributes('role')).toBe('radio');
   });

   it('applies default aspect-square, rounded-full, border classes', () => {
      const wrapper = mountItem();
      const cls = wrapper.find('button').element.className;
      expect(cls).toContain('aspect-square');
      expect(cls).toContain('rounded-full');
      expect(cls).toContain('border');
   });

   it('merges custom class prop with default classes', () => {
      const wrapper = mountItem('my-radio-item');
      const cls = wrapper.find('button').element.className;
      expect(cls).toContain('my-radio-item');
      expect(cls).toContain('rounded-full');
   });

   it('is exported and defined', () => {
      expect(RadioGroupItem).toBeDefined();
   });
});
