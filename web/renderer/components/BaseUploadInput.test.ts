/**
 * Tests for BaseUploadInput.
 *
 * Renders a label-styled file picker that delegates to Tauri's
 * `@tauri-apps/plugin-dialog` `open()` (NOT a real <input type="file">).
 * Click on the label triggers `tauriOpen({ filters })` and emits 'select'
 * with the resolved path string. The clear (X) icon emits 'clear'. The
 * `lastPart` filter truncates display text. All Tauri APIs are stubbed via
 * tests/setup.ts; we mock `plugin-dialog` locally to control the resolved
 * path per-test.
 */
import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import BaseUploadInput from './BaseUploadInput.vue';

const { tauriOpenMock } = vi.hoisted(() => ({ tauriOpenMock: vi.fn() }));
vi.mock('@tauri-apps/plugin-dialog', () => ({
   open: tauriOpenMock
}));

function mountInput (props: Record<string, unknown> = {}) {
   const pinia = createTestingPinia({ stubActions: false, createSpy: vi.fn });
   return mount(BaseUploadInput, {
      props,
      global: { plugins: [pinia] }
   } as Parameters<typeof mount>[1]);
}

describe('BaseUploadInput', () => {
   it('mounts without throwing', () => {
      expect(() => mountInput()).not.toThrow();
   });

   it('renders the browse message slot label', () => {
      const wrapper = mountInput({ message: 'Pick a file' });
      expect(wrapper.text()).toContain('Pick a file');
   });

   it('falls back to the i18n key when no message prop is provided', () => {
      const wrapper = mountInput();
      // Stubbed i18n returns the key as-is
      expect(wrapper.text()).toContain('general.browse');
   });

   it('emits "select" with the resolved path when the dialog returns a string', async () => {
      tauriOpenMock.mockResolvedValueOnce('/tmp/data.sql');
      const wrapper = mountInput({ filters: [{ name: 'SQL', extensions: ['sql'] }] });
      await wrapper.find('label').trigger('click');
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(tauriOpenMock).toHaveBeenCalledWith({ filters: [{ name: 'SQL', extensions: ['sql'] }] });
      expect(wrapper.emitted('select')).toBeTruthy();
      expect(wrapper.emitted('select')![0]).toEqual(['/tmp/data.sql']);
   });

   it('does NOT emit "select" when the dialog is cancelled (returns null)', async () => {
      tauriOpenMock.mockResolvedValueOnce(null);
      const wrapper = mountInput();
      await wrapper.find('label').trigger('click');
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(wrapper.emitted('select')).toBeFalsy();
   });

   it('emits "clear" when the X icon is clicked (visible only when modelValue set)', async () => {
      const wrapper = mountInput({ modelValue: '/tmp/data.sql' });
      const clearIcon = wrapper.find('.file-upload-icon-clear');
      expect(clearIcon.exists()).toBe(true);
      await clearIcon.trigger('click');
      expect(wrapper.emitted('clear')).toBeTruthy();
      expect(wrapper.emitted('clear')!.length).toBe(1);
   });

   it('hides the clear icon when modelValue is empty', () => {
      const wrapper = mountInput({ modelValue: '' });
      expect(wrapper.find('.file-upload-icon-clear').exists()).toBe(false);
   });
});
