/**
 * Tests for useFocusTrap composable.
 *
 * Focus trapping for modal-like UI: Tab cycles inside a container, Shift+Tab
 * reverses, focus is auto-applied on init, and the keydown listener is
 * removed when the trap is cleared. The trapRef is a customRef that triggers
 * init on assignment and clear on null.
 */
import { mountComposable } from '@tests/helpers/mountComposable';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useFocusTrap } from './useFocusTrap';

function buildButtons (n: number): HTMLElement {
   const container = document.createElement('div');
   for (let i = 0; i < n; i++) {
      const btn = document.createElement('button');
      btn.textContent = `btn-${i}`;
      container.appendChild(btn);
   }
   document.body.appendChild(container);
   return container;
}

describe('useFocusTrap', () => {
   let container: HTMLElement;

   beforeEach(() => {
      container = buildButtons(3);
   });

   afterEach(() => {
      container.remove();
   });

   it('exposes trapRef, initFocusTrap and clearFocusTrap', () => {
      const [api, wrapper] = mountComposable(() => useFocusTrap());
      expect(api.trapRef).toBeDefined();
      expect(typeof api.initFocusTrap).toBe('function');
      expect(typeof api.clearFocusTrap).toBe('function');
      wrapper.unmount();
   });

   it('focuses the first focusable element when the trap is set', async () => {
      const [api, wrapper] = mountComposable(() => useFocusTrap());
      api.trapRef.value = container;
      await wrapper.vm.$nextTick();

      const buttons = container.querySelectorAll('button');
      expect(document.activeElement).toBe(buttons[0]);
      wrapper.unmount();
   });

   it('does not focus when disableAutofocus is true', async () => {
      const [api, wrapper] = mountComposable(() =>
         useFocusTrap({ disableAutofocus: true })
      );
      api.trapRef.value = container;
      await wrapper.vm.$nextTick();

      const buttons = container.querySelectorAll('button');
      expect(document.activeElement).not.toBe(buttons[0]);
      wrapper.unmount();
   });

   it('cycles focus from last to first when Tab is pressed at the end', async () => {
      const [api, wrapper] = mountComposable(() => useFocusTrap());
      api.trapRef.value = container;
      await wrapper.vm.$nextTick();

      const buttons = container.querySelectorAll('button');
      (buttons[2] as HTMLElement).focus();
      expect(document.activeElement).toBe(buttons[2]);

      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      document.dispatchEvent(event);

      expect(document.activeElement).toBe(buttons[0]);
      wrapper.unmount();
   });

   it('cycles focus from first to last when Shift+Tab is pressed at the start', async () => {
      const [api, wrapper] = mountComposable(() => useFocusTrap());
      api.trapRef.value = container;
      await wrapper.vm.$nextTick();

      const buttons = container.querySelectorAll('button');
      (buttons[0] as HTMLElement).focus();

      const event = new KeyboardEvent('keydown', {
         key: 'Tab',
         shiftKey: true,
         bubbles: true
      });
      document.dispatchEvent(event);

      expect(document.activeElement).toBe(buttons[2]);
      wrapper.unmount();
   });

   it('does not move focus on Tab when not at the trap boundary', async () => {
      const [api, wrapper] = mountComposable(() => useFocusTrap());
      api.trapRef.value = container;
      await wrapper.vm.$nextTick();

      const buttons = container.querySelectorAll('button');
      (buttons[1] as HTMLElement).focus();

      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      document.dispatchEvent(event);

      // Stays at index 1 — the handler only intercepts at first/last
      expect(document.activeElement).toBe(buttons[1]);
      wrapper.unmount();
   });

   it('ignores non-Tab key events', async () => {
      const [api, wrapper] = mountComposable(() => useFocusTrap());
      api.trapRef.value = container;
      await wrapper.vm.$nextTick();

      const buttons = container.querySelectorAll('button');
      (buttons[2] as HTMLElement).focus();

      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      document.dispatchEvent(event);

      // Last button still focused — Escape doesn't trigger cycling
      expect(document.activeElement).toBe(buttons[2]);
      wrapper.unmount();
   });

   it('removes the keydown listener when the trap ref is cleared', async () => {
      const [api, wrapper] = mountComposable(() => useFocusTrap());
      api.trapRef.value = container;
      await wrapper.vm.$nextTick();

      const buttons = container.querySelectorAll('button');
      (buttons[2] as HTMLElement).focus();

      // Clear trap → listener removed
      api.trapRef.value = null;
      await wrapper.vm.$nextTick();

      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      document.dispatchEvent(event);

      // Focus did NOT cycle to first — listener was detached
      expect(document.activeElement).toBe(buttons[2]);
      wrapper.unmount();
   });

   it('does nothing when the container has no focusable elements', async () => {
      const empty = document.createElement('div');
      document.body.appendChild(empty);

      const [api, wrapper] = mountComposable(() => useFocusTrap());
      api.trapRef.value = empty;
      await wrapper.vm.$nextTick();

      // No focus change, no listener attached — Tab is a no-op
      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      document.dispatchEvent(event);

      empty.remove();
      wrapper.unmount();
   });

   it('clearFocusTrap can be called directly to remove the listener', async () => {
      const [api, wrapper] = mountComposable(() => useFocusTrap());
      api.trapRef.value = container;
      await wrapper.vm.$nextTick();

      const buttons = container.querySelectorAll('button');
      (buttons[2] as HTMLElement).focus();

      api.clearFocusTrap();

      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      document.dispatchEvent(event);

      // Listener removed → no cycling
      expect(document.activeElement).toBe(buttons[2]);
      wrapper.unmount();
   });
});
