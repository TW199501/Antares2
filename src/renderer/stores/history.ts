import { uidGen } from 'common/libs/uidGen';
import { defineStore } from 'pinia';

import { loadStore, saveStore } from '@/libs/persistStore';

const historySize = 1000;

export interface HistoryRecord {
   uid: string;
   sql: string;
   date: Date;
   schema?: string;
}

export const useHistoryStore = defineStore('history', {
   state: () => ({
      history: {} as Record<string, HistoryRecord[]>,
      favorites: {} as Record<string, unknown>,
      _loaded: false
   }),
   getters: {
      getHistoryByWorkspace: state => (uid: string) => state.history[uid]
   },
   actions: {
      async init () {
         const data = await loadStore('history', {}) as Record<string, any>;
         if (data.history !== undefined) this.history = data.history;
         if (data.favorites !== undefined) this.favorites = data.favorites;
         this._loaded = true;
      },
      async persist () {
         await saveStore('history', {
            history: this.history,
            favorites: this.favorites
         });
      },
      saveHistory (args: { uid: string; query: string; schema: string; tabUid: string }) {
         if (this.getHistoryByWorkspace(args.uid) &&
            this.getHistoryByWorkspace(args.uid).length &&
            this.getHistoryByWorkspace(args.uid)[0].sql === args.query
         ) return;

         if (!(args.uid in this.history))
            this.history[args.uid] = [];

         this.history[args.uid] = [
            {
               uid: uidGen('H'),
               sql: args.query,
               date: new Date(),
               schema: args.schema
            },
            ...this.history[args.uid]
         ];

         if (this.history[args.uid].length > historySize)
            this.history[args.uid] = this.history[args.uid].slice(0, historySize);

         this.persist();
      },
      deleteQueryFromHistory (query: Partial<HistoryRecord> & { workspace: string}) {
         this.history[query.workspace] = (this.history[query.workspace] as HistoryRecord[]).filter(q => q.uid !== query.uid);
         this.persist();
      }
   }
});
