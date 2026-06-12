/**
 * Smoke tests for the shadcn-vue DialogDescription primitive.
 *
 * DialogDescription requires a DialogRoot ancestor context (reka-ui).
 * We use the local Dialog.vue wrapper as the root.
 *
 * Locked contracts:
 *   - mounts inside DialogRoot without throwing
 *   - renders slot content
 *   - applies default text-sm text-muted-foreground classes
 *   - merges custom class prop
 *   - is exported and defined
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Dialog from './Dialog.vue';
import DialogDescription from './DialogDescription.vue';

function mountDesc (extraClass = '', slotContent = 'Describe the action here.') {
   return mount(Dialog, {
      props: { open: true },
      slots: {
         default: `<DialogDescription class="${extraClass}">${slotContent}</DialogDescription>`
      },
      global: { components: { DialogDescription } }
   });
}

describe('DialogDescription primitive', () => {
   it('mounts inside DialogRoot without throwing', () => {
      expect(() => mountDesc()).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mountDesc('', 'Are you sure?');
      expect(wrapper.html()).toContain('Are you sure?');
   });

   it('applies default text-sm and text-muted-foreground classes', () => {
      const wrapper = mountDesc();
      expect(wrapper.html()).toContain('text-sm');
      expect(wrapper.html()).toContain('text-muted-foreground');
   });

   it('merges custom class prop with default classes', () => {
      const wrapper = mountDesc('my-desc');
      expect(wrapper.html()).toContain('my-desc');
      expect(wrapper.html()).toContain('text-sm');
   });

   it('is exported and defined', () => {
      expect(DialogDescription).toBeDefined();
   });
});
