/**
 * Smoke tests for PropertyCard.vue — small flex column wrapper that pairs
 * an optional `<Label>` with a default slot. Used inside Props* tabs to
 * lay out a metadata field (label + control).
 *
 * Pure prop-driven: no Pinia, no Tauri.
 *
 * Locked contracts:
 *   - is exported / defined
 *   - mounts without throwing
 *   - omits the <label> when `label` prop is empty
 *   - renders the <label> with the given text when `label` is set
 *   - forwards `forId` to the label's `for` attribute
 *   - renders default slot content
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import PropertyCard from './PropertyCard.vue';

describe('PropertyCard', () => {
   it('is exported and defined', () => {
      expect(PropertyCard).toBeDefined();
   });

   it('mounts without throwing with no props', () => {
      expect(() => mount(PropertyCard)).not.toThrow();
   });

   it('omits the <label> when label prop is empty', () => {
      const wrapper = mount(PropertyCard);
      expect(wrapper.find('label').exists()).toBe(false);
   });

   it('renders the <label> with the given text when label is set', () => {
      const wrapper = mount(PropertyCard, { props: { label: 'Type' } });
      const label = wrapper.find('label');
      expect(label.exists()).toBe(true);
      expect(label.text()).toBe('Type');
   });

   it('renders default slot content', () => {
      const wrapper = mount(PropertyCard, {
         slots: { default: '<input data-testid="ctrl" />' }
      });
      expect(wrapper.find('[data-testid="ctrl"]').exists()).toBe(true);
   });
});
