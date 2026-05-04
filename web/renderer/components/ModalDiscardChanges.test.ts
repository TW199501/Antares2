/**
 * Tests for ModalDiscardChanges — confirm dialog shown before discarding
 * unsaved changes.
 *
 * The component is a thin wrapper around BaseConfirmModal that re-emits the
 * confirm/close events and registers a window keydown listener for Escape.
 * Tests cover:
 *   - mounts without throwing
 *   - registers + tears down the keydown listener (Escape → close)
 *   - confirm event from the inner ConfirmModal re-emits 'confirm' to parent
 *   - Escape on window emits 'close' to parent
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { describe, expect, it, vi } from 'vitest';

import ModalDiscardChanges from './ModalDiscardChanges.vue';

const mount = () =>
   mountWithPinia(ModalDiscardChanges, {
      global: {
         stubs: {
            BaseIcon: true,
            ConfirmModal: {
               template: '<div class="confirm-modal-stub"><slot name="header" /><slot name="body" /><button class="confirm-btn" @click="$emit(\'confirm\')">Confirm</button><button class="cancel-btn" @click="$emit(\'hide\')">Cancel</button></div>',
               emits: ['confirm', 'hide']
            }
         }
      }
   });

describe('ModalDiscardChanges', () => {
   it('mounts without throwing', () => {
      expect(() => mount()).not.toThrow();
   });

   it('renders the unsavedChanges header label', () => {
      const wrapper = mount();
      expect(wrapper.text()).toContain('application.unsavedChanges');
   });

   it('renders the discardUnsavedChanges body copy', () => {
      const wrapper = mount();
      expect(wrapper.text()).toContain('application.discardUnsavedChanges');
   });

   it('confirm button on inner ConfirmModal re-emits confirm to parent', async () => {
      const wrapper = mount();
      await wrapper.find('.confirm-btn').trigger('click');
      expect(wrapper.emitted('confirm')).toBeTruthy();
   });

   it('cancel/hide on inner ConfirmModal re-emits close to parent', async () => {
      const wrapper = mount();
      await wrapper.find('.cancel-btn').trigger('click');
      expect(wrapper.emitted('close')).toBeTruthy();
   });

   it('Escape keydown on window emits close', async () => {
      const wrapper = mount();
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      window.dispatchEvent(event);
      await wrapper.vm.$nextTick();
      expect(wrapper.emitted('close')).toBeTruthy();
   });

   it('non-Escape keydown does not emit close', async () => {
      const wrapper = mount();
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      window.dispatchEvent(event);
      await wrapper.vm.$nextTick();
      expect(wrapper.emitted('close')).toBeFalsy();
   });

   it('removes the keydown listener when unmounted', async () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      const wrapper = mount();
      wrapper.unmount();
      const calls = removeSpy.mock.calls.filter(c => c[0] === 'keydown');
      expect(calls.length).toBeGreaterThan(0);
   });
});
