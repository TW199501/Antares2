/**
 * Tests for useShortcutDispatcher composable — cross-layer sanity check
 * (T6 sample test). Listens to keydown on window and dispatches
 * `antares:<event>` CustomEvents for matched accelerators (per CLAUDE.md
 * keyboard shortcuts section). Falls back to common/shortcuts defaults
 * when the settings store has no shortcuts persisted.
 *
 * Verifies match logic, modifier mismatches, editable-target skip, ace
 * editor exception, mount/unmount lifecycle, and cross-platform Cmd/Ctrl.
 */
import { mountComposable } from '@tests/helpers/mountComposable';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useShortcutDispatcher } from './useShortcutDispatcher';

/**
 * Dispatch a keydown bubbling from document.body so e.target is a real element
 * (target.classList is read by the handler). Plain window.dispatchEvent leaves
 * e.target undefined under happy-dom.
 */
function fireKey (init: KeyboardEventInit) {
   document.body.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, ...init })
   );
}

describe('useShortcutDispatcher', () => {
   const listeners: Array<{ type: string; fn: EventListener }> = [];

   function on (type: string, fn: EventListener) {
      window.addEventListener(type, fn);
      listeners.push({ type, fn });
   }

   afterEach(() => {
      for (const { type, fn } of listeners.splice(0))
         window.removeEventListener(type, fn);
   });

   it('dispatches antares:save-content for Ctrl+S (default shortcut)', () => {
      const spy = vi.fn();
      on('antares:save-content', spy);

      const [, wrapper] = mountComposable(() => useShortcutDispatcher());
      fireKey({ key: 's', ctrlKey: true });

      expect(spy).toHaveBeenCalledTimes(1);
      wrapper.unmount();
   });

   it('dispatches antares:run-or-reload for F5', () => {
      const spy = vi.fn();
      on('antares:run-or-reload', spy);

      const [, wrapper] = mountComposable(() => useShortcutDispatcher());
      fireKey({ key: 'F5' });

      expect(spy).toHaveBeenCalledTimes(1);
      wrapper.unmount();
   });

   it('treats meta key as a Ctrl substitute (Mac behaviour)', () => {
      const spy = vi.fn();
      on('antares:save-content', spy);

      const [, wrapper] = mountComposable(() => useShortcutDispatcher());
      fireKey({ key: 's', metaKey: true });

      expect(spy).toHaveBeenCalledTimes(1);
      wrapper.unmount();
   });

   it('does not dispatch when modifier mismatches (plain "s" without ctrl)', () => {
      const spy = vi.fn();
      on('antares:save-content', spy);

      const [, wrapper] = mountComposable(() => useShortcutDispatcher());
      fireKey({ key: 's' });

      expect(spy).not.toHaveBeenCalled();
      wrapper.unmount();
   });

   it('does not dispatch save-content when extra Shift modifier is present', () => {
      const ctrlS = vi.fn();
      on('antares:save-content', ctrlS);

      const [, wrapper] = mountComposable(() => useShortcutDispatcher());
      fireKey({ key: 'S', ctrlKey: true, shiftKey: true });

      // Ctrl+Shift+S maps to save-file-as, not save-content
      expect(ctrlS).not.toHaveBeenCalled();
      wrapper.unmount();
   });

   it('dispatches save-file-as for Ctrl+Shift+S', () => {
      const spy = vi.fn();
      on('antares:save-file-as', spy);

      const [, wrapper] = mountComposable(() => useShortcutDispatcher());
      fireKey({ key: 's', ctrlKey: true, shiftKey: true });

      expect(spy).toHaveBeenCalledTimes(1);
      wrapper.unmount();
   });

   it('skips dispatch when target is an INPUT element', () => {
      const spy = vi.fn();
      on('antares:save-content', spy);

      const [, wrapper] = mountComposable(() => useShortcutDispatcher());

      const input = document.createElement('input');
      document.body.appendChild(input);
      input.dispatchEvent(
         new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true })
      );

      expect(spy).not.toHaveBeenCalled();
      input.remove();
      wrapper.unmount();
   });

   it('skips dispatch when target is a TEXTAREA element', () => {
      const spy = vi.fn();
      on('antares:save-content', spy);

      const [, wrapper] = mountComposable(() => useShortcutDispatcher());

      const ta = document.createElement('textarea');
      document.body.appendChild(ta);
      ta.dispatchEvent(
         new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true })
      );

      expect(spy).not.toHaveBeenCalled();
      ta.remove();
      wrapper.unmount();
   });

   it('still dispatches when target is the Ace editor textarea (.ace_text-input)', () => {
      const spy = vi.fn();
      on('antares:save-content', spy);

      const [, wrapper] = mountComposable(() => useShortcutDispatcher());

      const ace = document.createElement('textarea');
      ace.classList.add('ace_text-input');
      document.body.appendChild(ace);
      ace.dispatchEvent(
         new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true })
      );

      expect(spy).toHaveBeenCalledTimes(1);
      ace.remove();
      wrapper.unmount();
   });

   it('removes the keydown listener on unmount (no longer dispatches)', () => {
      const spy = vi.fn();
      on('antares:save-content', spy);

      const [, wrapper] = mountComposable(() => useShortcutDispatcher());
      wrapper.unmount();

      fireKey({ key: 's', ctrlKey: true });
      expect(spy).not.toHaveBeenCalled();
   });

   it('translates ArrowRight via Right token for next-page', () => {
      const next = vi.fn();
      on('antares:next-page', next);

      const [, wrapper] = mountComposable(() => useShortcutDispatcher());
      fireKey({ key: 'ArrowRight', ctrlKey: true });

      expect(next).toHaveBeenCalledTimes(1);
      wrapper.unmount();
   });

   it('translates PageDown token for next-tab', () => {
      const nextTab = vi.fn();
      on('antares:next-tab', nextTab);

      const [, wrapper] = mountComposable(() => useShortcutDispatcher());
      fireKey({ key: 'PageDown', ctrlKey: true });

      expect(nextTab).toHaveBeenCalledTimes(1);
      wrapper.unmount();
   });

   it('matches numeric digit shortcuts (CommandOrControl+1 → select-tab-1)', () => {
      const spy = vi.fn();
      on('antares:select-tab-1', spy);

      const [, wrapper] = mountComposable(() => useShortcutDispatcher());
      fireKey({ key: '1', ctrlKey: true });

      expect(spy).toHaveBeenCalledTimes(1);
      wrapper.unmount();
   });

   it('does not dispatch on Tab key (Tab is not in defaults)', () => {
      const noSpy = vi.fn();
      on('antares:format-query', noSpy);

      const [, wrapper] = mountComposable(() => useShortcutDispatcher());
      fireKey({ key: 'Tab' });

      expect(noSpy).not.toHaveBeenCalled();
      wrapper.unmount();
   });
});

describe('useShortcutDispatcher with overridden settings', () => {
   const listeners: Array<{ type: string; fn: EventListener }> = [];

   afterEach(() => {
      for (const { type, fn } of listeners.splice(0))
         window.removeEventListener(type, fn);
   });

   it('uses settings.shortcuts when non-empty (overrides defaults)', async () => {
      const { useSettingsStore } = await import('@/stores/settings');
      const spy = vi.fn();
      window.addEventListener('antares:custom-evt', spy);
      listeners.push({ type: 'antares:custom-evt', fn: spy });

      const [, wrapper] = mountComposable(() => {
         const store = useSettingsStore();
         store.shortcuts = [
            {
               event: 'custom-evt',
               keys: ['CommandOrControl+J'],
               os: ['win32'] as NodeJS.Platform[]
            }
         ];
         return useShortcutDispatcher();
      });

      document.body.dispatchEvent(
         new KeyboardEvent('keydown', { key: 'j', ctrlKey: true, bubbles: true })
      );
      expect(spy).toHaveBeenCalledTimes(1);
      wrapper.unmount();
   });
});
