/**
 * Smoke tests for the shadcn-vue DialogTitle primitive.
 *
 * DialogTitle wraps reka-ui's DialogTitle and requires a DialogRoot
 * ancestor to function properly (reka-ui uses provide/inject context).
 * Also accepts an optional `class` prop merged via cn().
 *
 * Locked contracts:
 *   - module exports a default component
 *   - mounts inside a DialogRoot without throwing
 *   - renders slot content
 *   - default class contains 'font-semibold', 'leading-none', 'tracking-tight'
 *   - accepts extra class prop that merges into the element class
 */
import { mount } from '@vue/test-utils';
import { DialogRoot } from 'reka-ui';
import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';

import DialogTitle from './DialogTitle.vue';

// Wrapper that provides the required reka-ui DialogRoot context
const WithRoot = defineComponent({
   props: {
      titleClass: { type: String, default: undefined }
   },
   setup (props, { slots }) {
      return () =>
         h(DialogRoot, { open: true }, {
            default: () =>
               h(DialogTitle, { class: props.titleClass }, slots.default)
         });
   }
});

describe('DialogTitle primitive', () => {
   it('module exports a component', () => {
      expect(DialogTitle).toBeDefined();
      expect(typeof DialogTitle).toBe('object');
   });

   it('mounts inside DialogRoot without throwing', () => {
      expect(() =>
         mount(WithRoot, {
            slots: { default: () => 'My Dialog Title' }
         })
      ).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mount(WithRoot, {
         slots: { default: () => 'Rendered Title' }
      });
      expect(wrapper.text()).toContain('Rendered Title');
   });

   it('default class includes font-semibold', () => {
      const wrapper = mount(WithRoot, {
         slots: { default: () => 'Title' }
      });
      // reka-ui renders a <h2> for DialogTitle by default
      const title = wrapper.find('h2');
      expect(title.exists()).toBe(true);
      expect(title.element.className).toContain('font-semibold');
   });

   it('default class includes leading-none and tracking-tight', () => {
      const wrapper = mount(WithRoot, {
         slots: { default: () => 'Title' }
      });
      const cls = wrapper.find('h2').element.className;
      expect(cls).toContain('leading-none');
      expect(cls).toContain('tracking-tight');
   });

   it('accepts extra class prop and merges it', () => {
      const wrapper = mount(WithRoot, {
         props: { titleClass: 'dialog-title-custom' },
         slots: { default: () => 'Title' }
      });
      const cls = wrapper.find('h2').element.className;
      expect(cls).toContain('dialog-title-custom');
   });
});
