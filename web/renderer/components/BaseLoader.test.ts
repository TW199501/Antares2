/**
 * Tests for BaseLoader.
 *
 * Trivial spinner primitive — renders a fixed `.empty` wrapper containing
 * a `.loading.loading-lg` indicator. No props, no events, no slots. Tests
 * verify the static DOM structure so the spinner contract isn't silently
 * broken by future refactors (e.g. swapping classes for shadcn-vue Skeleton).
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import BaseLoader from './BaseLoader.vue';

describe('BaseLoader', () => {
   it('mounts without throwing', () => {
      expect(() => mount(BaseLoader)).not.toThrow();
   });

   it('renders the .empty wrapper', () => {
      const wrapper = mount(BaseLoader);
      expect(wrapper.find('.empty').exists()).toBe(true);
   });

   it('renders the .loading.loading-lg indicator inside the wrapper', () => {
      const wrapper = mount(BaseLoader);
      const loader = wrapper.find('.empty .loading');
      expect(loader.exists()).toBe(true);
      expect(loader.classes()).toContain('loading-lg');
   });

   it('renders only a single root element', () => {
      const wrapper = mount(BaseLoader);
      // Wrapper element is the .empty div; should have exactly one child
      expect(wrapper.element.children.length).toBe(1);
   });

   it('accepts no props (props object stays empty)', () => {
      const wrapper = mount(BaseLoader);
      expect(Object.keys(wrapper.props())).toHaveLength(0);
   });
});
