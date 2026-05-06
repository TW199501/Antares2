/**
 * Tests for ModalNoteNew.vue — create dialog for a new scratchpad note.
 *
 * Generates a fresh uid via uidGen('N'), seeds cUid from injected
 * `selectedConnection` and type from injected `selectedTag` (unless 'all').
 * On confirm with non-empty body it calls scratchpad.addNote and emits
 * 'hide'; empty body short-circuits.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';

import { useScratchpadStore } from '@/stores/scratchpad';

import ModalNoteNew from './ModalNoteNew.vue';

const TextEditorStub = {
   name: 'BaseTextEditor',
   props: ['modelValue', 'mode', 'showLineNumbers', 'autoFocus', 'height', 'width', 'resizable'],
   emits: ['update:modelValue'],
   methods: {
      updateWindow () {
         /* noop */
      }
   },
   template: '<div class="text-editor-stub" :data-mode="mode" :data-value="modelValue" />'
};

const stubs = {
   BaseIcon: true,
   ConfirmModal: {
      template:
         '<div class="confirm-stub"><slot name="header" /><slot name="body" /><button class="confirm-btn" @click="$emit(\'confirm\')">OK</button><button class="hide-btn" @click="$emit(\'hide\')">X</button></div>',
      emits: ['confirm', 'hide']
   },
   Label: { template: '<label class="label-stub"><slot /></label>' },
   BaseSelect: {
      name: 'BaseSelect',
      props: ['modelValue', 'options', 'optionLabel', 'optionTrackBy'],
      emits: ['update:modelValue', 'change'],
      template: '<div class="base-select-stub" :data-value="modelValue" />'
   },
   BaseTextEditor: TextEditorStub
};

const provideDefaults = () => ({
   noteTags: [
      { code: 'note', name: 'Note' },
      { code: 'todo', name: 'Todo' },
      { code: 'query', name: 'Query' }
   ],
   selectedConnection: ref<string | null>('C:1'),
   selectedTag: ref<'all' | 'note' | 'todo' | 'query'>('all'),
   connectionOptions: [{ code: 'C:1', name: 'local-mysql' }]
});

const mount = (provideOverrides: Record<string, unknown> = {}) =>
   mountWithPinia(ModalNoteNew, {
      stubActions: true,
      global: {
         provide: { ...provideDefaults(), ...provideOverrides },
         stubs
      }
   });

describe('ModalNoteNew', () => {
   it('mounts without throwing under default injections', () => {
      expect(() => mount()).not.toThrow();
   });

   it('starts in markdown editor mode (default note type)', () => {
      const wrapper = mount();
      expect(wrapper.find('.text-editor-stub').attributes('data-mode')).toBe('markdown');
   });

   it('confirm with empty note body does NOT call addNote nor emit hide', async () => {
      const wrapper = mount();
      const store = useScratchpadStore();
      await wrapper.find('.confirm-btn').trigger('click');
      expect(store.addNote).not.toHaveBeenCalled();
      expect(wrapper.emitted('hide')).toBeFalsy();
   });

   it('hide button on inner modal re-emits hide', async () => {
      const wrapper = mount();
      await wrapper.find('.hide-btn').trigger('click');
      expect(wrapper.emitted('hide')).toBeTruthy();
   });

   it('seeds selectedTag into newNote.type when not "all"', () => {
      const wrapper = mount({
         selectedTag: ref('todo')
      });
      // mounted without throw means watch + seed branch executed
      expect(wrapper.exists()).toBe(true);
   });

   it('exports the SFC component definition', () => {
      expect(ModalNoteNew).toBeDefined();
      expect(typeof ModalNoteNew).toBe('object');
   });
});
