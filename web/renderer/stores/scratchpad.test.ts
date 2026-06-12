/**
 * scratchpad store — Pinia store tests (T9 / PR5).
 *
 * Tested behaviors:
 *   - Default state: selectedTag='all', connectionNotes=[], _loaded=false
 *   - init() reads modern { connectionNotes: [...] } shape from 'notes' store
 *   - init() migrates legacy { notes: '<plain string>' } → ConnectionNote[]
 *     with uid 'N:LEGACY' (CRITICAL — see source comment "TODO: remove…")
 *   - init() migration also persists the migrated state (drops legacy 'notes' key)
 *   - changeNotes / addNote / editNote mutate state and trigger persistence
 */
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { loadStore, saveStore } from '@/libs/persistStore';

import { type ConnectionNote, useScratchpadStore } from './scratchpad';

const makeNote = (overrides: Partial<ConnectionNote> = {}): ConnectionNote => ({
   uid: 'N:TEST',
   cUid: null,
   isArchived: false,
   type: 'note',
   note: 'hello',
   date: new Date(),
   ...overrides
});

describe('scratchpad store — defaults', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('starts with selectedTag="all", empty notes, _loaded=false', () => {
      const store = useScratchpadStore();
      expect(store.selectedTag).toBe('all');
      expect(store.connectionNotes).toEqual([]);
      expect(store._loaded).toBe(false);
   });
});

describe('scratchpad store — init()', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('hydrates from { connectionNotes: [...] } shape', async () => {
      const seeded = [makeNote({ uid: 'N:A', note: 'a' }), makeNote({ uid: 'N:B', note: 'b' })];
      await saveStore('notes', { connectionNotes: seeded });

      const store = useScratchpadStore();
      await store.init();

      expect(store.connectionNotes).toHaveLength(2);
      expect(store.connectionNotes.map(n => n.uid)).toEqual(['N:A', 'N:B']);
      expect(store._loaded).toBe(true);
   });

   it('leaves connectionNotes empty when storage is missing/empty', async () => {
      const store = useScratchpadStore();
      await store.init();
      expect(store.connectionNotes).toEqual([]);
      expect(store._loaded).toBe(true);
   });

   it('migrates legacy { notes: "<plain string>" } into a single N:LEGACY entry', async () => {
      await saveStore('notes', { notes: 'old plain text' });

      const store = useScratchpadStore();
      await store.init();

      expect(store.connectionNotes).toHaveLength(1);
      expect(store.connectionNotes[0]).toMatchObject({
         uid: 'N:LEGACY',
         cUid: null,
         isArchived: false,
         type: 'note',
         note: 'old plain text'
      });
      expect(store.connectionNotes[0].date).toBeInstanceOf(Date);
   });

   it('migration prepends N:LEGACY in front of existing connectionNotes', async () => {
      await saveStore('notes', {
         notes: 'legacy text',
         connectionNotes: [makeNote({ uid: 'N:A' })]
      });

      const store = useScratchpadStore();
      await store.init();

      expect(store.connectionNotes).toHaveLength(2);
      expect(store.connectionNotes[0].uid).toBe('N:LEGACY');
      expect(store.connectionNotes[1].uid).toBe('N:A');
   });

   it('migration persists the new shape (legacy "notes" string removed)', async () => {
      await saveStore('notes', { notes: 'legacy text' });

      const store = useScratchpadStore();
      await store.init();

      const persisted = await loadStore<{ notes?: string; connectionNotes?: ConnectionNote[] }>(
         'notes',
         {}
      );
      expect(persisted.notes).toBeUndefined();
      expect(persisted.connectionNotes).toHaveLength(1);
      expect(persisted.connectionNotes?.[0].uid).toBe('N:LEGACY');
   });
});

describe('scratchpad store — mutators', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('addNote prepends a note and persists', async () => {
      const store = useScratchpadStore();
      const note = makeNote({ uid: 'N:NEW', note: 'fresh' });
      store.addNote(note);

      expect(store.connectionNotes).toHaveLength(1);
      expect(store.connectionNotes[0].uid).toBe('N:NEW');

      // Wait for the un-awaited persist() to flush, then verify storage.
      await Promise.resolve();
      const persisted = await loadStore<{ connectionNotes: ConnectionNote[] }>('notes', { connectionNotes: [] });
      expect(persisted.connectionNotes).toHaveLength(1);
   });

   it('addNote inserts at the front of an existing list', () => {
      const store = useScratchpadStore();
      store.connectionNotes = [makeNote({ uid: 'N:OLD' })];
      store.addNote(makeNote({ uid: 'N:NEW' }));
      expect(store.connectionNotes.map(n => n.uid)).toEqual(['N:NEW', 'N:OLD']);
   });

   it('editNote replaces the matching uid and leaves others alone', () => {
      const store = useScratchpadStore();
      store.connectionNotes = [
         makeNote({ uid: 'N:A', note: 'a-old' }),
         makeNote({ uid: 'N:B', note: 'b-old' })
      ];
      store.editNote(makeNote({ uid: 'N:A', note: 'a-new' }));

      expect(store.connectionNotes[0].note).toBe('a-new');
      expect(store.connectionNotes[1].note).toBe('b-old');
   });

   it('editNote with an unknown uid is a no-op on contents', () => {
      const store = useScratchpadStore();
      store.connectionNotes = [makeNote({ uid: 'N:A', note: 'a' })];
      store.editNote(makeNote({ uid: 'N:Z', note: 'z' }));
      expect(store.connectionNotes).toHaveLength(1);
      expect(store.connectionNotes[0].note).toBe('a');
   });

   it('changeNotes replaces the entire list and persists', async () => {
      const store = useScratchpadStore();
      const next = [makeNote({ uid: 'N:1' }), makeNote({ uid: 'N:2' })];
      store.changeNotes(next);
      expect(store.connectionNotes.map(n => n.uid)).toEqual(['N:1', 'N:2']);

      await Promise.resolve();
      const persisted = await loadStore<{ connectionNotes: ConnectionNote[] }>('notes', { connectionNotes: [] });
      expect(persisted.connectionNotes).toHaveLength(2);
   });
});
