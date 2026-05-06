/**
 * Smoke tests for the shadcn-vue CardTitle primitive.
 *
 * Locked contracts:
 *   - mounts without throwing
 *   - renders default slot content
 *   - root element is an <h3>
 *   - default class contains 'font-semibold', 'leading-none', 'tracking-tight'
 *   - accepts extra class prop that merges into the element class
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import CardTitle from './CardTitle.vue';

describe('CardTitle primitive', () => {
   it('mounts without throwing', () => {
      expect(() => mount(CardTitle)).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mount(CardTitle, {
         slots: { default: 'My Title' }
      });
      expect(wrapper.text()).toBe('My Title');
   });

   it('root element is an h3', () => {
      const wrapper = mount(CardTitle);
      expect(wrapper.element.tagName.toLowerCase()).toBe('h3');
   });

   it('default class includes font-semibold', () => {
      const wrapper = mount(CardTitle);
      expect(wrapper.element.className).toContain('font-semibold');
   });

   it('default class includes leading-none and tracking-tight', () => {
      const wrapper = mount(CardTitle);
      const cls = wrapper.element.className;
      expect(cls).toContain('leading-none');
      expect(cls).toContain('tracking-tight');
   });

   it('accepts extra class prop and merges it', () => {
      const wrapper = mount(CardTitle, { props: { class: 'title-custom' } });
      expect(wrapper.element.className).toContain('title-custom');
   });
});
