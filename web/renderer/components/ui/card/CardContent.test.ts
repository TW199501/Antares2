/**
 * Smoke tests for the shadcn-vue CardContent primitive.
 *
 * Locked contracts:
 *   - mounts without throwing
 *   - renders default slot content
 *   - root element is a <div>
 *   - default class contains 'p-6' and 'pt-0'
 *   - accepts extra class prop that merges into the element class
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import CardContent from './CardContent.vue';

describe('CardContent primitive', () => {
   it('mounts without throwing', () => {
      expect(() => mount(CardContent)).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mount(CardContent, {
         slots: { default: '<span data-testid="slot">hello</span>' }
      });
      expect(wrapper.find('[data-testid="slot"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="slot"]').text()).toBe('hello');
   });

   it('root element is a div', () => {
      const wrapper = mount(CardContent);
      expect(wrapper.element.tagName.toLowerCase()).toBe('div');
   });

   it('default class includes p-6 and pt-0', () => {
      const wrapper = mount(CardContent);
      const cls = wrapper.element.className;
      expect(cls).toContain('p-6');
      expect(cls).toContain('pt-0');
   });

   it('accepts extra class prop and merges it', () => {
      const wrapper = mount(CardContent, { props: { class: 'custom-test-class' } });
      expect(wrapper.element.className).toContain('custom-test-class');
   });
});
