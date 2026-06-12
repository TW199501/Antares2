/**
 * Smoke tests for the shadcn-vue Card primitive.
 *
 * Locked contracts:
 *   - mounts without throwing
 *   - renders slot content
 *   - root element is a <div>
 *   - default class includes rounded-lg, border-border, bg-card, shadow-sm
 *   - accepts extra class prop and merges it
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Card from './Card.vue';

describe('Card primitive', () => {
   it('mounts without throwing', () => {
      expect(() => mount(Card)).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mount(Card, {
         slots: { default: '<span data-testid="card-child">inner</span>' }
      });
      expect(wrapper.find('[data-testid="card-child"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="card-child"]').text()).toBe('inner');
   });

   it('root element is a div', () => {
      const wrapper = mount(Card);
      expect(wrapper.element.tagName.toLowerCase()).toBe('div');
   });

   it('default class includes rounded-lg and bg-card and shadow-sm', () => {
      const wrapper = mount(Card);
      const cls = wrapper.element.className;
      expect(cls).toContain('rounded-lg');
      expect(cls).toContain('bg-card');
      expect(cls).toContain('shadow-sm');
   });

   it('accepts extra class prop and merges it', () => {
      const wrapper = mount(Card, { props: { class: 'card-custom' } });
      expect(wrapper.element.className).toContain('card-custom');
   });
});
