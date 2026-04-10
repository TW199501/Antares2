import { defineStore } from 'pinia';

import { loadStore, saveStore } from '@/libs/persistStore';

export type TagCode = 'all' | 'note' | 'todo' | 'query'

export interface ConnectionNote {
   uid: string;
   cUid: string | null;
   title?: string;
   isArchived: boolean;
   type: TagCode;
   note: string;
   date: Date;
}

export const useScratchpadStore = defineStore('scratchpad', {
   state: () => ({
      selectedTag: 'all',
      /** Connection specific notes */
      connectionNotes: [] as ConnectionNote[],
      _loaded: false
   }),
   actions: {
      async init () {
         const data = await loadStore('notes', {}) as Record<string, any>;

         // Migrate old scratchpad (plain string) to new connectionNotes format
         // TODO: remove in future releases
         if (data.notes && typeof data.notes === 'string') {
            const legacyNote: ConnectionNote = {
               uid: 'N:LEGACY',
               cUid: null,
               isArchived: false,
               type: 'note',
               note: data.notes,
               date: new Date()
            };
            const notes: ConnectionNote[] = data.connectionNotes ? [legacyNote, ...data.connectionNotes] : [legacyNote];
            this.connectionNotes = notes;
            // Save migrated state (without the old 'notes' key)
            await saveStore('notes', { connectionNotes: notes });
         }
         else {
            this.connectionNotes = data.connectionNotes ?? [];
         }

         this._loaded = true;
      },
      async persist () {
         await saveStore('notes', {
            connectionNotes: this.connectionNotes
         });
      },
      changeNotes (notes: ConnectionNote[]) {
         this.connectionNotes = notes;
         this.persist();
      },
      addNote (note: ConnectionNote) {
         this.connectionNotes = [
            note,
            ...this.connectionNotes
         ];
         this.persist();
      },
      editNote (note: ConnectionNote) {
         this.connectionNotes = (this.connectionNotes as ConnectionNote[]).map(n => {
            if (n.uid === note.uid)
               n = note;

            return n;
         });
         this.persist();
      }
   }
});
