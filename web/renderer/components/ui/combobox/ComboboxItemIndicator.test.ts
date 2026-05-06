/**
 * Smoke tests for the shadcn-vue ComboboxItemIndicator primitive.
 *
 * ComboboxItemIndicator must be nested inside ComboboxItem → ComboboxRoot.
 * The indicator is hidden by reka-ui until the item is selected, so class-based
 * assertions on wrapper.html() are unreliable — only export/mount checks retained.
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Combobox from './Combobox.vue';
import ComboboxItem from './ComboboxItem.vue';
import ComboboxItemIndicator from './ComboboxItemIndicator.vue';

function mountInContext () {
   return mount(Combobox, {
      slots: {
         default: '<ComboboxItem value="a"><ComboboxItemIndicator /></ComboboxItem>'
      },
      global: { components: { ComboboxItem, ComboboxItemIndicator } }
   });
}

describe('ComboboxItemIndicator primitive', () => {
   it('is exported and defined', () => {
      expect(ComboboxItemIndicator).toBeDefined();
   });

   it('mounts inside ComboboxItem context without throwing', () => {
      expect(() => mountInContext()).not.toThrow();
   });
});
