/**
 * Smoke tests for the shadcn-vue DialogClose primitive.
 *
 * DialogClose wraps reka-ui's DialogClose and requires a DialogRoot
 * ancestor to function properly (reka-ui uses provide/inject context).
 * Tests wrap the component inside DialogRoot to satisfy the context
 * requirement.
 *
 * Locked contracts:
 *   - module exports a default component
 *   - mounts inside a DialogRoot without throwing
 *   - renders slot content inside the close button
 *   - the close element is present in the DOM
 */
import { mount } from '@vue/test-utils';
import { DialogRoot } from 'reka-ui';
import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';

import DialogClose from './DialogClose.vue';

// Wrapper that provides the required reka-ui DialogRoot context
const WithRoot = defineComponent({
   setup (_, { slots }) {
      return () => h(DialogRoot, { open: true }, slots);
   }
});

describe('DialogClose primitive', () => {
   it('module exports a component', () => {
      expect(DialogClose).toBeDefined();
      expect(typeof DialogClose).toBe('object');
   });

   it('mounts inside DialogRoot without throwing', () => {
      expect(() =>
         mount(WithRoot, {
            slots: {
               default: () => h(DialogClose, null, { default: () => 'Close' })
            }
         })
      ).not.toThrow();
   });

   it('renders slot text inside the close button', () => {
      const wrapper = mount(WithRoot, {
         slots: {
            default: () => h(DialogClose, null, { default: () => 'Close Dialog' })
         }
      });
      expect(wrapper.text()).toContain('Close Dialog');
   });

   it('close element is present in the DOM', () => {
      const wrapper = mount(WithRoot, {
         slots: {
            default: () => h(DialogClose, { asChild: false }, { default: () => 'X' })
         }
      });
      // reka-ui DialogClose renders a <button> by default
      expect(wrapper.find('button').exists()).toBe(true);
   });
});
