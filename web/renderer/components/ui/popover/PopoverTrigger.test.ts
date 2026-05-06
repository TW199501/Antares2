/**
 * Smoke tests for the shadcn-vue PopoverTrigger primitive.
 *
 * PopoverTrigger must be mounted inside a PopoverRoot context (reka-ui).
 * Tests wrap it with the local Popover.vue root.
 *
 * Locked contracts:
 *   - is exported and defined
 *   - mounts inside PopoverRoot without throwing
 *   - renders slot content (button child)
 *   - renders a button element by default
 *   - as-child prop forwarded without throwing
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Popover from './Popover.vue';
import PopoverTrigger from './PopoverTrigger.vue';

function mountTriggerInRoot (slotContent = '<button data-testid="btn">Open</button>') {
   return mount(Popover, {
      slots: {
         default: `<PopoverTrigger>${slotContent}</PopoverTrigger>`
      },
      global: { components: { PopoverTrigger } }
   });
}

describe('PopoverTrigger primitive', () => {
   it('is exported and defined', () => {
      expect(PopoverTrigger).toBeDefined();
   });

   it('mounts inside PopoverRoot without throwing', () => {
      expect(() => mountTriggerInRoot()).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mountTriggerInRoot('<span data-testid="trigger-child">click me</span>');
      expect(wrapper.find('[data-testid="trigger-child"]').exists()).toBe(true);
   });

   it('renders a button element by default', () => {
      const wrapper = mountTriggerInRoot('Open');
      expect(wrapper.find('button').exists()).toBe(true);
   });

   it('as-child prop mounts without throwing', () => {
      expect(() =>
         mount(Popover, {
            slots: {
               default: '<PopoverTrigger as-child><button>Open</button></PopoverTrigger>'
            },
            global: { components: { PopoverTrigger } }
         })
      ).not.toThrow();
   });
});
