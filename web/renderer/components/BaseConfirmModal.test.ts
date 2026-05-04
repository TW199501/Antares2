/**
 * Tests for BaseConfirmModal.
 *
 * Wraps shadcn Dialog (reka-ui DialogRoot) with header / body / footer slots
 * and emits 'confirm' / 'hide'. DialogContent renders inside a Teleport portal
 * so selectors target document.body, NOT wrapper.find(). Reka-ui needs at
 * least one nextTick + microtask flush after mount before its DialogPortal
 * children are committed to the DOM. closeOnConfirm=false suppresses the
 * follow-up emit('hide'). DOM button order in the open dialog is
 * [0]=Cancel, [1]=Confirm, [2]=Close-X (the reka-ui auto-DialogClose).
 */
import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import BaseConfirmModal from './BaseConfirmModal.vue';

async function flush () {
   await new Promise(resolve => setTimeout(resolve, 0));
   await new Promise(resolve => setTimeout(resolve, 0));
}

function mountModal (
   props: Record<string, unknown> = {},
   slots: Record<string, string> = {}
) {
   const pinia = createTestingPinia({ stubActions: false, createSpy: vi.fn });
   return mount(BaseConfirmModal, {
      props,
      slots,
      attachTo: document.body,
      global: { plugins: [pinia] }
   } as Parameters<typeof mount>[1]);
}

afterEach(() => {
   while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
});

describe('BaseConfirmModal', () => {
   it('mounts without throwing', () => {
      expect(() => mountModal()).not.toThrow();
   });

   it('emits "hide" once when the cancel button is clicked', async () => {
      const wrapper = mountModal({}, { default: 'Are you sure?' });
      await flush();
      const buttons = document.body.querySelectorAll('button');
      const cancelButton = buttons[0]; // Cancel
      cancelButton.dispatchEvent(new Event('click', { bubbles: true }));
      await wrapper.vm.$nextTick();
      expect(wrapper.emitted('hide')).toBeTruthy();
      expect(wrapper.emitted('hide')!.length).toBe(1);
   });

   it('emits "confirm" then "hide" by default when the confirm button is clicked', async () => {
      const wrapper = mountModal({}, { default: 'Are you sure?' });
      await flush();
      const buttons = document.body.querySelectorAll('button');
      const confirmButton = buttons[1]; // Confirm
      confirmButton.dispatchEvent(new Event('click', { bubbles: true }));
      await wrapper.vm.$nextTick();
      expect(wrapper.emitted('confirm')).toBeTruthy();
      expect(wrapper.emitted('confirm')!.length).toBe(1);
      // closeOnConfirm defaults to true => hide also emitted
      expect(wrapper.emitted('hide')).toBeTruthy();
   });

   it('does NOT emit "hide" on confirm when closeOnConfirm=false', async () => {
      const wrapper = mountModal({ closeOnConfirm: false }, { default: 'Are you sure?' });
      await flush();
      const buttons = document.body.querySelectorAll('button');
      const confirmButton = buttons[1];
      confirmButton.dispatchEvent(new Event('click', { bubbles: true }));
      await wrapper.vm.$nextTick();
      expect(wrapper.emitted('confirm')).toBeTruthy();
      expect(wrapper.emitted('hide')).toBeFalsy();
   });

   it('hides the footer when hideFooter=true (no Confirm/Cancel buttons rendered)', async () => {
      mountModal({ hideFooter: true }, { default: 'Heads up' });
      await flush();
      // Only the reka-ui auto-generated DialogClose 'X' remains
      const buttons = document.body.querySelectorAll('button');
      expect(buttons.length).toBe(1);
   });

   it('renders custom confirm/cancel labels when provided', async () => {
      mountModal(
         { confirmText: 'Yes please', cancelText: 'No thanks' },
         { default: 'Confirm action?' }
      );
      await flush();
      const buttons = Array.from(document.body.querySelectorAll('button'));
      const labels = buttons.map(b => (b.textContent ?? '').trim());
      expect(labels).toContain('Yes please');
      expect(labels).toContain('No thanks');
   });

   it('applies the size class corresponding to the size prop', async () => {
      mountModal({ size: 'large' }, { default: 'Wide modal' });
      await flush();
      const content = document.body.querySelector('[role="dialog"]');
      expect(content).toBeTruthy();
      expect(content!.className).toContain('max-w-2xl');
   });
});
