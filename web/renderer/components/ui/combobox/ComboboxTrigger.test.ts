/**
 * Smoke tests for the shadcn-vue ComboboxTrigger primitive.
 *
 * ComboboxTrigger must be mounted inside a ComboboxRoot context.
 * Tests use Combobox.vue (ComboboxRoot wrapper) as the parent.
 *
 * Locked contracts:
 *   - ComboboxTrigger is exported and defined
 *   - mounts inside Combobox without throwing
 *   - rendered html includes inline-flex and h-9
 *   - renders slot content
 *   - accepts extra class prop and merges it
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Combobox from './Combobox.vue';
import ComboboxTrigger from './ComboboxTrigger.vue';

function mountTrigger (extraClass = '', slotContent = '') {
   return mount(Combobox, {
      props: { open: false },
      slots: {
         default: `<ComboboxTrigger class="${extraClass}">${slotContent || 'Select'}</ComboboxTrigger>`
      },
      global: { components: { ComboboxTrigger } }
   });
}

describe('ComboboxTrigger primitive', () => {
   it('is exported and defined', () => {
      expect(ComboboxTrigger).toBeDefined();
   });

   it('mounts inside Combobox without throwing', () => {
      expect(() => mountTrigger()).not.toThrow();
   });

   it('rendered html includes inline-flex and h-9', () => {
      const wrapper = mountTrigger();
      expect(wrapper.html()).toContain('inline-flex');
      expect(wrapper.html()).toContain('h-9');
   });

   it('renders slot content', () => {
      const wrapper = mountTrigger('', '<span data-testid="trig-inner">Pick</span>');
      expect(wrapper.find('[data-testid="trig-inner"]').exists()).toBe(true);
   });

   it('accepts extra class prop and merges it', () => {
      const wrapper = mountTrigger('trigger-custom');
      expect(wrapper.html()).toContain('trigger-custom');
   });
});
