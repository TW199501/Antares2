/**
 * Tests for TheScratchpad — modal dialog with the user's notes/todos/queries.
 *
 * The component is a Reka UI Dialog with virtualized note list, search box,
 * tag filter, and connection filter. We mount it with a seeded scratchpad
 * store (3 notes) and stub the heavy children (Dialog, BaseSelect,
 * BaseVirtualScroll, ScratchpadNote, the new/edit modals). Tests cover:
 *   - mounts without throwing
 *   - renders the empty-state placeholder when no notes
 *   - renders ScratchpadNote children when notes exist
 *   - close button invokes applicationStore.hideScratchpad
 *   - tag filter buttons mutate scratchpadStore.selectedTag
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { describe, expect, it } from 'vitest';

import { useApplicationStore } from '@/stores/application';
import { useScratchpadStore } from '@/stores/scratchpad';

import TheScratchpad from './TheScratchpad.vue';

const baseStubs = {
   BaseIcon: true,
   BaseSelect: true,
   BaseVirtualScroll: {
      template: '<div><slot :items="items" /></div>',
      props: ['items'],
      methods: { updateWindow () { /* no-op stub */ } }
   },
   ScratchpadNote: true,
   ModalNoteNew: true,
   ModalNoteEdit: true,
   Dialog: { template: '<div><slot /></div>' },
   DialogContent: { template: '<div><slot /></div>' },
   DialogHeader: { template: '<div><slot /></div>' },
   DialogTitle: { template: '<div><slot /></div>' },
   DialogDescription: { template: '<div><slot /></div>' },
   Tooltip: { template: '<div><slot /></div>' },
   TooltipTrigger: { template: '<div><slot /></div>' },
   TooltipContent: { template: '<div><slot /></div>' },
   Button: { template: '<button @click="$emit(\'click\', $event)"><slot /></button>' },
   Input: true
};

const mountScratchpad = (initialState: Record<string, unknown> = {}, opts: { stubActions?: boolean } = {}) =>
   mountWithPinia(TheScratchpad, {
      initialState,
      stubActions: opts.stubActions ?? false,
      global: {
         stubs: baseStubs
      }
   });

describe('TheScratchpad', () => {
   it('mounts without throwing under empty scratchpad state', () => {
      expect(() => mountScratchpad()).not.toThrow();
   });

   it('renders the empty-state when there are no notes', () => {
      const wrapper = mountScratchpad();
      expect(wrapper.text()).toContain('application.thereAreNoNotesYet');
   });

   it('renders the dialog title with the notes label', () => {
      const wrapper = mountScratchpad();
      expect(wrapper.text()).toContain('application.note');
   });

   it('renders ScratchpadNote stubs when notes exist', () => {
      const wrapper = mountScratchpad({
         scratchpad: {
            connectionNotes: [
               { uid: 'N:1', cUid: null, type: 'note', note: 'first', isArchived: false, date: new Date() },
               { uid: 'N:2', cUid: null, type: 'todo', note: 'second', isArchived: false, date: new Date() }
            ],
            selectedTag: 'all'
         }
      });
      expect(wrapper.html()).toContain('scratchpad-note-stub');
   });

   it('clicking the tag filter changes selectedTag in the scratchpad store', async () => {
      const wrapper = mountScratchpad();
      const scratchpadStore = useScratchpadStore();
      // First button is "all"; the second is "note"
      const tagButtons = wrapper.findAll('button.text-xs');
      expect(tagButtons.length).toBeGreaterThan(1);
      await tagButtons[1].trigger('click');
      expect(scratchpadStore.selectedTag).toBe('note');
   });

   it('clicking the close (X) button hides the scratchpad', async () => {
      const wrapper = mountScratchpad({}, { stubActions: true });
      const applicationStore = useApplicationStore();
      // The first stubbed Button in the header is the close-X
      const closeBtn = wrapper.findAll('button')[0];
      expect(closeBtn.exists()).toBe(true);
      await closeBtn.trigger('click');
      expect(applicationStore.hideScratchpad).toHaveBeenCalled();
   });
});
