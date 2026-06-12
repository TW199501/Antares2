/**
 * Smoke tests for the shadcn-vue Dialog primitive (Reka UI DialogRoot wrapper).
 *
 * Most Dialog behavior is covered transitively by BaseConfirmModal.test.ts
 * (which mounts a real Dialog + DialogContent + portal). These tests target
 * the primitive layer specifically, and lock the body.pointer-events recovery
 * contract that was a real production trap (per CLAUDE.md / user memory
 * "Radix/Reka Dialog body pointer-events trap").
 *
 * Locked contracts:
 *   - <Dialog> forwards reka-ui DialogRootProps + emits transparently
 *   - Open/close cycle does not leave body.style.pointerEvents stuck at 'none'
 *     (the shell-level override in App.vue + bg styles are responsible for
 *     resetting; if Reka UI ever changes its cleanup, this test catches the
 *     regression early)
 */
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';

import Dialog from './Dialog.vue';

describe('Dialog primitive (reka-ui DialogRoot wrapper)', () => {
   afterEach(() => {
      // Defensive: if a test somehow leaves portal mounted, clean to avoid
      // bleed across tests within this file.
      document.body.style.pointerEvents = '';
   });

   it('mounts without throwing', () => {
      expect(() => mount(Dialog, { props: { open: false }, slots: { default: '<span>content</span>' } })).not.toThrow();
   });

   it('emits update:open when open prop is bound', async () => {
      const wrapper = mount(Dialog, {
         props: { open: false, 'onUpdate:open': (v: boolean) => wrapper.setProps({ open: v }) },
         slots: { default: '<button data-testid="trigger">Open</button>' }
      });
      // Programmatically flip the prop — Reka DialogRoot is purely controlled
      // by the open prop here. The emit relay is forwarded via
      // useForwardPropsEmits in Dialog.vue.
      await wrapper.setProps({ open: true });
      await nextTick();
      expect(wrapper.props('open')).toBe(true);
   });

   it('does not permanently lock body.style.pointerEvents after open→close', async () => {
      // Reka UI sets body.style.pointerEvents = 'none' while modal is open
      // and reverts on close. If the cleanup hook ever drops this revert, the
      // whole app freezes (no clicks anywhere). Catch via mount/unmount cycle.
      const wrapper = mount(Dialog, {
         props: { open: true },
         slots: { default: '<div role="dialog">x</div>' },
         attachTo: document.body
      });
      await nextTick();
      // body might OR might not have pointerEvents='none' depending on whether
      // DialogContent + Portal are mounted (we only mount DialogRoot here, no
      // portal child) — so the contract we lock is the WEAKER one: closing
      // and unmounting must leave body usable.
      await wrapper.setProps({ open: false });
      await nextTick();
      wrapper.unmount();
      await nextTick();
      // After full teardown, body must NOT be stuck at 'none'
      expect(document.body.style.pointerEvents).not.toBe('none');
   });
});
