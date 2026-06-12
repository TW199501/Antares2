/**
 * Smoke tests for the shadcn-vue CardHeader primitive.
 *
 * Locked contracts:
 *   - mounts without throwing
 *   - renders default slot content
 *   - root element is a <div>
 *   - default class contains 'flex', 'flex-col', 'space-y-1.5', 'p-6'
 *   - accepts extra class prop that merges into the element class
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import CardHeader from './CardHeader.vue';

describe('CardHeader primitive', () => {
   it('mounts without throwing', () => {
      expect(() => mount(CardHeader)).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mount(CardHeader, {
         slots: { default: '<h2>Card Title</h2>' }
      });
      expect(wrapper.find('h2').exists()).toBe(true);
   });

   it('root element is a div', () => {
      const wrapper = mount(CardHeader);
      expect(wrapper.element.tagName.toLowerCase()).toBe('div');
   });

   it('default class includes flex and flex-col', () => {
      const wrapper = mount(CardHeader);
      const cls = wrapper.element.className;
      expect(cls).toContain('flex');
      expect(cls).toContain('flex-col');
   });

   it('default class includes p-6', () => {
      const wrapper = mount(CardHeader);
      expect(wrapper.element.className).toContain('p-6');
   });

   it('default class includes space-y-1.5', () => {
      const wrapper = mount(CardHeader);
      expect(wrapper.element.className).toContain('space-y-1.5');
   });

   it('accepts extra class prop and merges it', () => {
      const wrapper = mount(CardHeader, { props: { class: 'header-custom' } });
      expect(wrapper.element.className).toContain('header-custom');
   });
});
