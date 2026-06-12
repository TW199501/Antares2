/**
 * Tests for ModalNoteEdit.vue — edit dialog for a scratchpad note.
 *
 * Receives a `note` prop, deep-copies it to localNote on beforeMount, swaps
 * editor mode between 'sql' and 'markdown' when type changes, and on
 * confirm calls scratchpad store.editNote then emits 'hide'. If the body
 * is empty the action is skipped (close-on-confirm gating).
 *
 * BaseTextEditor is stubbed per spec §5.F (ace lazy load) with an
 * updateWindow method to satisfy any ref calls.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { describe, expect, it } from 'vitest';

import { useScratchpadStore } from '@/stores/scratchpad';

import ModalNoteEdit from './ModalNoteEdit.vue';

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

const baseNote = {
   uid: 'N:1',
   cUid: 'C:1',
   title: 'first',
   note: 'hello world',
   date: new Date('2024-01-01T00:00:00Z'),
   type: 'note' as const,
   isArchived: false
};

const mount = (
   noteOverrides: Record<string, unknown> = {}
) =>
   mountWithPinia(ModalNoteEdit, {
      props: {
         note: { ...baseNote, ...noteOverrides }
      } as never,
      stubActions: true,
      global: {
         provide: {
            noteTags: [
               { code: 'note', name: 'Note' },
               { code: 'todo', name: 'Todo' },
               { code: 'query', name: 'Query' }
            ],
            connectionOptions: [{ code: 'C:1', name: 'local-mysql' }]
         },
         stubs
      }
   });

describe('ModalNoteEdit', () => {
   it('mounts without throwing under default props', () => {
      expect(() => mount()).not.toThrow();
   });

   it('initializes localNote from a deep copy of the note prop', () => {
      const wrapper = mount();
      // editor seeded with the note body
      const editor = wrapper.find('.text-editor-stub');
      expect(editor.attributes('data-value')).toBe('hello world');
   });

   it('confirm calls editNote and emits hide when note has content', async () => {
      const wrapper = mount();
      const store = useScratchpadStore();
      await wrapper.find('.confirm-btn').trigger('click');
      expect(store.editNote).toHaveBeenCalled();
      expect(wrapper.emitted('hide')).toBeTruthy();
   });

   it('confirm with empty note body does NOT call editNote nor emit hide', async () => {
      const wrapper = mount({ note: '' });
      const store = useScratchpadStore();
      await wrapper.find('.confirm-btn').trigger('click');
      expect(store.editNote).not.toHaveBeenCalled();
      expect(wrapper.emitted('hide')).toBeFalsy();
   });

   it('hide button on inner modal re-emits hide', async () => {
      const wrapper = mount();
      await wrapper.find('.hide-btn').trigger('click');
      expect(wrapper.emitted('hide')).toBeTruthy();
   });

   it('starts in markdown editor mode for default note type', () => {
      const wrapper = mount();
      expect(wrapper.find('.text-editor-stub').attributes('data-mode')).toBe('markdown');
   });
});
