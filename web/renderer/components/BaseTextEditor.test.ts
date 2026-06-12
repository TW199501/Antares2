/**
 * Tests for BaseTextEditor.
 *
 * Wraps the Ace editor (`ace-builds`). Ace is heavily DOM-dependent and the
 * `ace-builds/esm-resolver` import has a `URL` constructor in worker resolver
 * code that crashes happy-dom. Therefore both modules are mocked at module
 * scope. Tests cover the wrapper's contract: ace.edit() is called once on
 * mount with the configured mode/value/readOnly, and the session 'change'
 * handler emits 'update:modelValue'. We deliberately do NOT test syntax
 * highlighting, autocomplete, or theme switching — that's lib internals.
 */
import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';
import * as ace from 'ace-builds';
import { describe, expect, it, vi } from 'vitest';

import BaseTextEditor from './BaseTextEditor.vue';

const sessionListeners: Record<string, ((...args: unknown[]) => void)[]> = {};
const editorMock = {
   setValue: vi.fn(),
   getValue: vi.fn(() => 'current value'),
   on: vi.fn(),
   destroy: vi.fn(),
   setTheme: vi.fn(),
   setOptions: vi.fn(),
   focus: vi.fn(),
   resize: vi.fn(),
   commands: { removeCommand: vi.fn() },
   session: {
      setMode: vi.fn(),
      setValue: vi.fn(),
      on: vi.fn((evt: string, cb: (...args: unknown[]) => void) => {
         (sessionListeners[evt] ||= []).push(cb);
      })
   }
};

vi.mock('ace-builds', () => ({
   edit: vi.fn(() => editorMock)
}));
vi.mock('ace-builds/esm-resolver', () => ({}));

function mountEditor (props: Record<string, unknown>) {
   const pinia = createTestingPinia({ stubActions: false, createSpy: vi.fn });
   return mount(BaseTextEditor, {
      props,
      global: { plugins: [pinia] }
   } as Parameters<typeof mount>[1]);
}

describe('BaseTextEditor', () => {
   it('mounts without throwing', () => {
      expect(() => mountEditor({ modelValue: 'hello' })).not.toThrow();
   });

   it('renders the editor wrapper element with the generated id', () => {
      const wrapper = mountEditor({ modelValue: '' });
      const editorEl = wrapper.find('.editor');
      expect(editorEl.exists()).toBe(true);
      expect(editorEl.attributes('id')).toMatch(/^editor-/);
   });

   it('initializes ace with the provided mode and value on mount', () => {
      mountEditor({ modelValue: 'SELECT 1', mode: 'sql' });
      expect(ace.edit).toHaveBeenCalledTimes(1);
      const [, opts] = (ace.edit as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(opts.mode).toBe('ace/mode/sql');
      expect(opts.value).toBe('SELECT 1');
      expect(opts.readOnly).toBe(false);
   });

   it('passes readOnly:true through to ace when prop is set', () => {
      mountEditor({ modelValue: '', readOnly: true });
      const [, opts] = (ace.edit as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(opts.readOnly).toBe(true);
   });

   it('emits update:modelValue when the session change handler fires', async () => {
      // Reset captured listeners
      for (const k of Object.keys(sessionListeners)) sessionListeners[k] = [];
      editorMock.getValue.mockReturnValue('typed text');
      const wrapper = mountEditor({ modelValue: '' });
      // The wrapper subscribes via session.on('change', ...)
      const handlers = sessionListeners.change ?? [];
      expect(handlers.length).toBeGreaterThan(0);
      handlers.forEach(h => h());
      await wrapper.vm.$nextTick();
      const events = wrapper.emitted('update:modelValue');
      expect(events).toBeTruthy();
      expect(events![0]).toEqual(['typed text']);
   });

   it('honors the height prop on the editor element', () => {
      const wrapper = mountEditor({ modelValue: '', height: 400 });
      const editorEl = wrapper.find('.editor');
      expect(editorEl.attributes('style')).toContain('height: 400px');
   });
});
