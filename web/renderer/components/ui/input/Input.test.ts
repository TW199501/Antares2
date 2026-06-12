/**
 * Smoke tests for the shadcn-vue Input primitive.
 *
 * Locked contracts:
 *   - mounts without throwing
 *   - root element is an <input>
 *   - default class contains h-[34px] and text-foreground
 *   - accepts extra class prop and merges it
 *   - v-model / modelValue binding updates internal value
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Input from './Input.vue';

describe('Input primitive', () => {
   it('mounts without throwing', () => {
      expect(() => mount(Input)).not.toThrow();
   });

   it('root element is an input', () => {
      const wrapper = mount(Input);
      expect(wrapper.element.tagName.toLowerCase()).toBe('input');
   });

   it('default class includes h-[34px] and text-foreground', () => {
      const wrapper = mount(Input);
      const cls = wrapper.element.className;
      expect(cls).toContain('h-[34px]');
      expect(cls).toContain('text-foreground');
   });

   it('accepts extra class prop and merges it', () => {
      const wrapper = mount(Input, { props: { class: 'my-input-class' } });
      expect(wrapper.element.className).toContain('my-input-class');
   });

   it('reflects modelValue prop as input value', async () => {
      const wrapper = mount(Input, { props: { modelValue: 'hello' } });
      const el = wrapper.element as HTMLInputElement;
      expect(el.value).toBe('hello');
   });
});
