/**
 * Smoke tests for the shadcn-vue ScrollArea primitive.
 *
 * Locked contracts:
 *   - mounts without throwing
 *   - renders slot content
 *   - root element class includes relative and overflow-hidden
 *   - accepts extra class prop and merges it
 *   - is exported and defined
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import ScrollArea from './ScrollArea.vue';

describe('ScrollArea primitive', () => {
   it('mounts without throwing', () => {
      expect(() => mount(ScrollArea)).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mount(ScrollArea, {
         slots: { default: '<div data-testid="sa-child">content</div>' }
      });
      expect(wrapper.find('[data-testid="sa-child"]').exists()).toBe(true);
   });

   it('root html includes relative and overflow-hidden', () => {
      const wrapper = mount(ScrollArea);
      expect(wrapper.html()).toContain('relative');
      expect(wrapper.html()).toContain('overflow-hidden');
   });

   it('accepts extra class prop and merges it', () => {
      const wrapper = mount(ScrollArea, { props: { class: 'scroll-custom' } });
      expect(wrapper.html()).toContain('scroll-custom');
   });

   it('is exported and defined', () => {
      expect(ScrollArea).toBeDefined();
   });
});
