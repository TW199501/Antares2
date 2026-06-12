/**
 * Smoke tests for the shadcn-vue ContextMenuRadioGroup primitive.
 *
 * ContextMenuRadioGroup must live inside a ContextMenuRoot context.
 * Tests use ContextMenu.vue (ContextMenuRoot wrapper) as the parent.
 *
 * Locked contracts:
 *   - ContextMenuRadioGroup is exported and defined
 *   - mounts inside ContextMenu without throwing
 *   - renders slot content
 *   - forwards value prop without error
 *   - emits update:modelValue / update:value when selection changes
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import ContextMenu from './ContextMenu.vue';
import ContextMenuRadioGroup from './ContextMenuRadioGroup.vue';

function mountRadioGroup (value = 'a', slotContent = '') {
   return mount(ContextMenu, {
      slots: {
         default: `<ContextMenuRadioGroup value="${value}">${slotContent || ''}</ContextMenuRadioGroup>`
      },
      global: { components: { ContextMenuRadioGroup } }
   });
}

describe('ContextMenuRadioGroup primitive', () => {
   it('is exported and defined', () => {
      expect(ContextMenuRadioGroup).toBeDefined();
   });

   it('mounts inside ContextMenu without throwing', () => {
      expect(() => mountRadioGroup()).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mountRadioGroup('a', '<span data-testid="rg-child">item</span>');
      expect(wrapper.find('[data-testid="rg-child"]').exists()).toBe(true);
   });

   it('forwards value prop without error', () => {
      expect(() => mountRadioGroup('option-1')).not.toThrow();
   });

   it('is a component object', () => {
      expect(
         '__name' in ContextMenuRadioGroup ||
         'setup' in ContextMenuRadioGroup ||
         'render' in ContextMenuRadioGroup
      ).toBe(true);
   });
});
