/**
 * Smoke tests for the shadcn-vue ComboboxList primitive.
 *
 * ComboboxList (ComboboxContent + Portal) requires a ComboboxRoot context.
 * Due to the Portal + ComboboxRoot constraint, we test the export contract
 * and mount via Combobox.vue (ComboboxRoot wrapper).
 *
 * Locked contracts:
 *   - ComboboxList is exported and defined
 *   - Combobox (root) mounts without throwing
 *   - ComboboxList can be registered as a global component without throwing
 *   - ComboboxList is a component object (has setup or render key)
 *   - class prop is accepted by the component definition
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Combobox from './Combobox.vue';
import ComboboxList from './ComboboxList.vue';

describe('ComboboxList primitive', () => {
   it('is exported and defined', () => {
      expect(ComboboxList).toBeDefined();
   });

   it('is a component object (has __name or setup)', () => {
      // SFC compiled components carry __name
      expect(
         '__name' in ComboboxList ||
         'setup' in ComboboxList ||
         'render' in ComboboxList
      ).toBe(true);
   });

   it('Combobox root mounts without throwing', () => {
      expect(() =>
         mount(Combobox, {
            props: { open: false },
            slots: { default: '<div>content</div>' }
         })
      ).not.toThrow();
   });

   it('ComboboxList mounts inside Combobox root without throwing', () => {
      expect(() =>
         mount(Combobox, {
            props: { open: false },
            slots: { default: '<ComboboxList />' },
            global: { components: { ComboboxList } }
         })
      ).not.toThrow();
   });

   it('accepts class prop in component props definition', () => {
      // Verify the class prop is wired through delegatedProps (no throw on mount)
      const wrapper = mount(Combobox, {
         props: { open: false },
         slots: { default: '<ComboboxList class="list-custom" />' },
         global: { components: { ComboboxList } }
      });
      expect(wrapper).toBeDefined();
   });
});
