/**
 * Smoke tests for the shadcn-vue DialogHeader primitive.
 *
 * DialogHeader is a pure CSS layout wrapper (no reka-ui dependency),
 * so it can be mounted standalone.
 *
 * Locked contracts:
 *   - mounts without throwing
 *   - renders default slot content
 *   - root element is a <div>
 *   - default class contains 'flex', 'flex-col', 'gap-1.5'
 *   - accepts extra class prop that merges into the element class
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import DialogHeader from './DialogHeader.vue';

describe('DialogHeader primitive', () => {
   it('mounts without throwing', () => {
      expect(() => mount(DialogHeader)).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mount(DialogHeader, {
         slots: { default: '<h2>Dialog Header</h2>' }
      });
      expect(wrapper.find('h2').exists()).toBe(true);
      expect(wrapper.find('h2').text()).toBe('Dialog Header');
   });

   it('root element is a div', () => {
      const wrapper = mount(DialogHeader);
      expect(wrapper.element.tagName.toLowerCase()).toBe('div');
   });

   it('default class includes flex and flex-col', () => {
      const wrapper = mount(DialogHeader);
      const cls = wrapper.element.className;
      expect(cls).toContain('flex');
      expect(cls).toContain('flex-col');
   });

   it('default class includes gap-1.5', () => {
      const wrapper = mount(DialogHeader);
      expect(wrapper.element.className).toContain('gap-1.5');
   });

   it('accepts extra class prop and merges it', () => {
      const wrapper = mount(DialogHeader, { props: { class: 'dialog-header-custom' } });
      expect(wrapper.element.className).toContain('dialog-header-custom');
   });
});
