/**
 * Smoke tests for the shadcn-vue CardFooter primitive.
 *
 * Locked contracts:
 *   - mounts without throwing
 *   - renders default slot content
 *   - root element is a <div>
 *   - default class contains 'flex', 'items-center', 'p-6', 'pt-0'
 *   - accepts extra class prop that merges into the element class
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import CardFooter from './CardFooter.vue';

describe('CardFooter primitive', () => {
   it('mounts without throwing', () => {
      expect(() => mount(CardFooter)).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mount(CardFooter, {
         slots: { default: '<button>Action</button>' }
      });
      expect(wrapper.find('button').exists()).toBe(true);
   });

   it('root element is a div', () => {
      const wrapper = mount(CardFooter);
      expect(wrapper.element.tagName.toLowerCase()).toBe('div');
   });

   it('default class includes flex and items-center', () => {
      const wrapper = mount(CardFooter);
      const cls = wrapper.element.className;
      expect(cls).toContain('flex');
      expect(cls).toContain('items-center');
   });

   it('default class includes p-6 and pt-0', () => {
      const wrapper = mount(CardFooter);
      const cls = wrapper.element.className;
      expect(cls).toContain('p-6');
      expect(cls).toContain('pt-0');
   });

   it('accepts extra class prop and merges it', () => {
      const wrapper = mount(CardFooter, { props: { class: 'footer-extra' } });
      expect(wrapper.element.className).toContain('footer-extra');
   });
});
