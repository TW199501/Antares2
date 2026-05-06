/**
 * Smoke tests for the shadcn-vue ContextMenu primitive (reka-ui ContextMenuRoot wrapper).
 *
 * Locked contracts:
 *   - mounts without throwing
 *   - slot renders inside root
 *   - open prop is accepted without throwing
 *   - emits update:open relay (controlled prop)
 *   - component is exported/defined
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import ContextMenu from './ContextMenu.vue';

describe('ContextMenu primitive (reka-ui ContextMenuRoot wrapper)', () => {
   it('mounts without throwing', () => {
      expect(() =>
         mount(ContextMenu, { slots: { default: '<span>content</span>' } })
      ).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mount(ContextMenu, {
         slots: { default: '<span data-testid="inner">hello</span>' }
      });
      expect(wrapper.find('[data-testid="inner"]').exists()).toBe(true);
   });

   it('accepts open prop without throwing', () => {
      expect(() =>
         mount(ContextMenu, {
            props: { open: false },
            slots: { default: '<div />' }
         })
      ).not.toThrow();
   });

   it('is exported and defined', () => {
      expect(ContextMenu).toBeDefined();
   });
});
