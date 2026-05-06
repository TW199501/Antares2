/**
 * Smoke tests for the shadcn-vue DialogFooter primitive.
 *
 * DialogFooter is a pure CSS layout wrapper (no reka-ui dependency),
 * so it can be mounted standalone.
 *
 * Locked contracts:
 *   - mounts without throwing
 *   - renders default slot content
 *   - root element is a <div>
 *   - default class contains 'flex', 'flex-col-reverse'
 *   - accepts extra class prop that merges into the element class
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import DialogFooter from './DialogFooter.vue';

describe('DialogFooter primitive', () => {
   it('mounts without throwing', () => {
      expect(() => mount(DialogFooter)).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mount(DialogFooter, {
         slots: { default: '<button>Confirm</button><button>Cancel</button>' }
      });
      const buttons = wrapper.findAll('button');
      expect(buttons).toHaveLength(2);
   });

   it('root element is a div', () => {
      const wrapper = mount(DialogFooter);
      expect(wrapper.element.tagName.toLowerCase()).toBe('div');
   });

   it('default class includes flex and flex-col-reverse', () => {
      const wrapper = mount(DialogFooter);
      const cls = wrapper.element.className;
      expect(cls).toContain('flex');
      expect(cls).toContain('flex-col-reverse');
   });

   it('accepts extra class prop and merges it', () => {
      const wrapper = mount(DialogFooter, { props: { class: 'dialog-footer-custom' } });
      expect(wrapper.element.className).toContain('dialog-footer-custom');
   });
});
