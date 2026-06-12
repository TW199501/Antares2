/**
 * Smoke tests for the shadcn-vue DialogTrigger primitive.
 *
 * DialogTrigger wraps reka-ui's DialogTrigger and requires a DialogRoot
 * ancestor to function properly (reka-ui uses provide/inject context).
 * Tests wrap the component inside DialogRoot to satisfy the context
 * requirement.
 *
 * Locked contracts:
 *   - module exports a default component
 *   - mounts inside a DialogRoot without throwing
 *   - renders slot content inside the trigger
 *   - the trigger element is present in the DOM
 */
import { mount } from '@vue/test-utils';
import { DialogRoot } from 'reka-ui';
import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';

import DialogTrigger from './DialogTrigger.vue';

// Wrapper that provides the required reka-ui DialogRoot context
const WithRoot = defineComponent({
   setup (_, { slots }) {
      return () => h(DialogRoot, { open: false }, slots);
   }
});

describe('DialogTrigger primitive', () => {
   it('module exports a component', () => {
      expect(DialogTrigger).toBeDefined();
      expect(typeof DialogTrigger).toBe('object');
   });

   it('mounts inside DialogRoot without throwing', () => {
      expect(() =>
         mount(WithRoot, {
            slots: {
               default: () => h(DialogTrigger, null, { default: () => 'Open' })
            }
         })
      ).not.toThrow();
   });

   it('renders slot text inside the trigger', () => {
      const wrapper = mount(WithRoot, {
         slots: {
            default: () => h(DialogTrigger, null, { default: () => 'Open Dialog' })
         }
      });
      expect(wrapper.text()).toContain('Open Dialog');
   });

   it('trigger element is present in the DOM', () => {
      const wrapper = mount(WithRoot, {
         slots: {
            default: () => h(DialogTrigger, { asChild: false }, { default: () => 'Trigger' })
         }
      });
      // reka-ui DialogTrigger renders a <button> by default
      expect(wrapper.find('button').exists()).toBe(true);
   });
});
