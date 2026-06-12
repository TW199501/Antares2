/**
 * Smoke tests for the shadcn-vue CardDescription primitive.
 *
 * Locked contracts:
 *   - mounts without throwing
 *   - renders default slot content
 *   - root element is a <p>
 *   - default class contains 'text-muted-foreground'
 *   - accepts extra class prop that merges into the element class
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import CardDescription from './CardDescription.vue';

describe('CardDescription primitive', () => {
   it('mounts without throwing', () => {
      expect(() => mount(CardDescription)).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mount(CardDescription, {
         slots: { default: 'A card description' }
      });
      expect(wrapper.text()).toBe('A card description');
   });

   it('root element is a p', () => {
      const wrapper = mount(CardDescription);
      expect(wrapper.element.tagName.toLowerCase()).toBe('p');
   });

   it('default class includes text-muted-foreground', () => {
      const wrapper = mount(CardDescription);
      expect(wrapper.element.className).toContain('text-muted-foreground');
   });

   it('accepts extra class prop and merges it', () => {
      const wrapper = mount(CardDescription, { props: { class: 'extra-desc-class' } });
      expect(wrapper.element.className).toContain('extra-desc-class');
   });
});
