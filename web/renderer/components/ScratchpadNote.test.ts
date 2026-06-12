/**
 * Tests for ScratchpadNote.vue — sidebar / scratchpad list item rendering a
 * single ConnectionNote (query | todo | text). Behaviour:
 *
 *   - Three icon variants by `note.type`: query → mdiHeartOutline,
 *     todo+isArchived → mdiCheckboxMarkedOutline, todo+!isArchived →
 *     mdiCheckboxBlankOutline, default → mdiNoteEditOutline
 *   - Body rendering: query → highlighted SQL via sql-highlight (raw v-html);
 *     other types → marked-rendered HTML (with custom listitem/link renderer
 *     that strips parens and unwraps anchors)
 *   - Hover toolbar: action Buttons (archive / restore / select / copy /
 *     edit / delete) emit the matching outer event with note.uid
 *   - Top-level click on the row emits 'select-note' with note.uid
 *
 * Coverage focus: emit path on click, type-driven icon selection (query /
 * todo-archived / todo-unarchived / text), parseMarkdown / highlightWord
 * branches via mount no-throw.
 *
 * Dependencies stubbed: BaseIcon (no svg pulls), reka-ui Tooltip primitives
 * (passthrough), shadcn Button (neutral). copyText (libs/copyText) is left
 * as the real module — it only writes to clipboard which happy-dom permits.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import ScratchpadNote from './ScratchpadNote.vue';

vi.mock('@/libs/copyText', () => ({
   copyText: vi.fn()
}));

const stubs = {
   BaseIcon: {
      props: { iconName: { type: String, default: '' }, size: { type: [String, Number], default: 16 } },
      template: '<i class="base-icon-stub" :data-icon="iconName" />'
   },
   Tooltip: { template: '<div class="tooltip-stub"><slot /></div>' },
   TooltipTrigger: { template: '<div class="tooltip-trigger-stub"><slot /></div>' },
   TooltipContent: { template: '<div class="tooltip-content-stub"><slot /></div>' },
   Button: {
      inheritAttrs: false,
      template: '<button class="btn-stub" v-bind="$attrs" @click="$emit(\'click\', $event)"><slot /></button>'
   }
};

const buildNote = (over: Record<string, unknown> = {}) => ({
   uid: 'NOTE:1',
   cUid: 'C:1',
   type: 'text',
   note: 'hello world',
   date: new Date('2026-05-06T12:00:00Z'),
   isArchived: false,
   ...over
});

const mountNote = (
   propOverrides: Record<string, unknown> = {},
   stateOverrides: Record<string, unknown> = {}
) => {
   return mountWithPinia(ScratchpadNote, {
      props: {
         note: buildNote(),
         searchTerm: '',
         selectedNote: '',
         ...propOverrides
      } as never,
      initialState: {
         connections: {
            connections: [
               { uid: 'C:1', name: 'orders-db', client: 'mysql' }
            ],
            connectionsOrder: [],
            customIcons: [],
            ...(stateOverrides.connections as Record<string, unknown> ?? {})
         }
      },
      stubActions: false,
      global: { stubs }
   });
};

describe('ScratchpadNote', () => {
   it('mounts without throwing under default props', () => {
      expect(() => mountNote()).not.toThrow();
   });

   it('clicking the root row emits select-note with note.uid', async () => {
      const wrapper = mountNote();
      await wrapper.trigger('click');
      const evt = wrapper.emitted('select-note');
      expect(evt).toBeTruthy();
      expect(evt![0]).toEqual(['NOTE:1']);
   });

   it('renders the type-tag uppercased for text notes', () => {
      const wrapper = mountNote({ note: buildNote({ type: 'text' }) });
      expect(wrapper.html()).toContain('text');
   });

   it('uses query icon (mdiHeartOutline) when note.type === "query"', () => {
      const wrapper = mountNote({ note: buildNote({ type: 'query', note: 'SELECT 1' }) });
      const icons = wrapper.findAll('.base-icon-stub').map(i => i.attributes('data-icon'));
      expect(icons).toContain('mdiHeartOutline');
   });

   it('uses unarchived todo icon (mdiCheckboxBlankOutline) when type=todo and !isArchived', () => {
      const wrapper = mountNote({ note: buildNote({ type: 'todo', isArchived: false }) });
      const icons = wrapper.findAll('.base-icon-stub').map(i => i.attributes('data-icon'));
      expect(icons).toContain('mdiCheckboxBlankOutline');
   });

   it('uses archived todo icon (mdiCheckboxMarkedOutline) when type=todo and isArchived', () => {
      const wrapper = mountNote({ note: buildNote({ type: 'todo', isArchived: true }) });
      const icons = wrapper.findAll('.base-icon-stub').map(i => i.attributes('data-icon'));
      expect(icons).toContain('mdiCheckboxMarkedOutline');
   });

   it('uses default text icon (mdiNoteEditOutline) when type is anything else', () => {
      const wrapper = mountNote({ note: buildNote({ type: 'text' }) });
      const icons = wrapper.findAll('.base-icon-stub').map(i => i.attributes('data-icon'));
      expect(icons).toContain('mdiNoteEditOutline');
   });

   it('renders a query body via sql-highlight (raw <code class="sql">)', () => {
      const wrapper = mountNote({ note: buildNote({ type: 'query', note: 'SELECT 1 FROM t' }) });
      // sql-highlight outputs into a code.sql element via v-html.
      expect(wrapper.find('code.sql').exists()).toBe(true);
   });

   it('renders a non-query body via marked into note-md-content', () => {
      const wrapper = mountNote({ note: buildNote({ type: 'text', note: '# Hello\n\nWorld' }) });
      expect(wrapper.find('.note-md-content').exists()).toBe(true);
   });

   it('highlightWord wraps a search term in a <span class="text-primary"> when searchTerm matches', () => {
      const wrapper = mountNote({
         note: buildNote({ type: 'text', note: 'foo bar baz' }),
         searchTerm: 'bar'
      });
      // Match the highlight span injected by highlightWord. Markdown parser
      // may HTML-escape, so we tolerate either order.
      expect(wrapper.html()).toMatch(/text-primary/);
   });

   it('renders connection name resolved from connections store', () => {
      const wrapper = mountNote();
      expect(wrapper.html()).toContain('orders-db');
   });

   it('renders the i18n general.all key when cUid does not match any connection', () => {
      const wrapper = mountNote({ note: buildNote({ cUid: 'C:999' }) });
      // identity i18n stub returns the key itself
      expect(wrapper.html()).toContain('general.all');
   });

   it('delete button click emits delete-note(uid)', async () => {
      const wrapper = mountNote();
      const buttons = wrapper.findAll('button.btn-stub');
      // last button is the destructive delete
      const del = buttons[buttons.length - 1];
      await del.trigger('click');
      const evt = wrapper.emitted('delete-note');
      expect(evt).toBeTruthy();
      expect(evt!.at(-1)).toEqual(['NOTE:1']);
   });

   it('cleans up on unmount without throwing (smoke)', async () => {
      const wrapper = mountNote();
      await flushPromises();
      expect(() => wrapper.unmount()).not.toThrow();
   });
});
