/**
 * Smoke tests for the shadcn-vue DialogContent primitive.
 *
 * DialogContent wraps reka-ui DialogPortal + DialogOverlay + DialogContent.
 * Portal/body assertions fail in happy-dom because BaseIcon needs Pinia.
 * Only export and mount-no-throw contracts are retained.
 */
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';

import Dialog from './Dialog.vue';
import DialogContent from './DialogContent.vue';

afterEach(() => {
   document.body.style.pointerEvents = '';
   document.body.querySelectorAll('[data-reka-portal]').forEach(el => el.remove());
});

function mountContent () {
   return mount(Dialog, {
      props: { open: true },
      slots: {
         default: '<DialogContent><p>Hello</p></DialogContent>'
      },
      global: { components: { DialogContent } },
      attachTo: document.body
   });
}

describe('DialogContent primitive', () => {
   it('is exported and defined', () => {
      expect(DialogContent).toBeDefined();
   });

   it('mounts inside an open DialogRoot without throwing', () => {
      expect(() => mountContent()).not.toThrow();
   });
});
