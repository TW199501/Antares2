/**
 * Smoke tests for the shadcn-vue ComboboxAnchor primitive.
 *
 * ComboboxAnchor requires a ComboboxRoot context (reka-ui).
 * Tests that can't mount in context fall back to export-defined checks.
 *
 * Locked contracts:
 *   - is exported and defined
 *   - mounts inside ComboboxRoot context without throwing
 *   - renders slot content inside context
 *   - applies 'relative' default class
 *   - merges custom class prop
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Combobox from './Combobox.vue';
import ComboboxAnchor from './ComboboxAnchor.vue';

function mountInRoot (extraClass = '', slotContent = '<div data-testid="child">child</div>') {
   return mount(Combobox, {
      slots: {
         default: `<ComboboxAnchor class="${extraClass}">${slotContent}</ComboboxAnchor>`
      },
      global: { components: { ComboboxAnchor } }
   });
}

describe('ComboboxAnchor primitive', () => {
   it('is exported and defined', () => {
      expect(ComboboxAnchor).toBeDefined();
   });

   it('mounts inside ComboboxRoot without throwing', () => {
      expect(() => mountInRoot()).not.toThrow();
   });

   it('renders slot content inside ComboboxRoot', () => {
      const wrapper = mountInRoot('', '<span data-testid="anchor-child">hi</span>');
      expect(wrapper.find('[data-testid="anchor-child"]').exists()).toBe(true);
   });

   it('applies relative default class', () => {
      const wrapper = mountInRoot();
      expect(wrapper.html()).toContain('relative');
   });

   it('merges custom class prop with default classes', () => {
      const wrapper = mountInRoot('my-anchor');
      expect(wrapper.html()).toContain('my-anchor');
      expect(wrapper.html()).toContain('relative');
   });
});
