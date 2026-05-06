/**
 * Smoke tests for the shadcn-vue Separator primitive.
 *
 * Locked contracts:
 *   - mounts without throwing
 *   - default orientation is horizontal: class includes h-[1px] and w-full
 *   - vertical orientation: class includes h-full and w-[1px]
 *   - default class includes bg-border and shrink-0
 *   - accepts extra class prop and merges it
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Separator from './Separator.vue';

describe('Separator primitive', () => {
   it('mounts without throwing', () => {
      expect(() => mount(Separator)).not.toThrow();
   });

   it('horizontal orientation includes h-[1px] and w-full', () => {
      const wrapper = mount(Separator, { props: { orientation: 'horizontal' } });
      expect(wrapper.html()).toContain('h-[1px]');
      expect(wrapper.html()).toContain('w-full');
   });

   it('vertical orientation includes h-full and w-[1px]', () => {
      const wrapper = mount(Separator, { props: { orientation: 'vertical' } });
      expect(wrapper.html()).toContain('h-full');
      expect(wrapper.html()).toContain('w-[1px]');
   });

   it('default class includes bg-border and shrink-0', () => {
      const wrapper = mount(Separator);
      expect(wrapper.html()).toContain('bg-border');
      expect(wrapper.html()).toContain('shrink-0');
   });

   it('accepts extra class prop and merges it', () => {
      const wrapper = mount(Separator, { props: { class: 'sep-custom' } });
      expect(wrapper.html()).toContain('sep-custom');
   });
});
