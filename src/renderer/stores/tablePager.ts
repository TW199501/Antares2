import { defineStore } from 'pinia';

// Bridge between WorkspaceTabTable (per-tab) and TheFooter (app-singleton).
// The currently-selected table tab populates `state` on activation and clears
// on deactivation; TheFooter reads it to render pagination + export controls.
//
// Why store handlers as state: Vue refs don't cross sibling component boundaries
// without prop drilling or provide/inject (won't work — footer is sibling, not
// descendant). A tiny dedicated store with handler closures keeps the API
// minimal and reactive without rebuilding pagination state inside the footer.

export type ExportFormat = 'json' | 'csv' | 'php' | 'sql';

export interface TablePagerState {
   page: number;
   hasNext: boolean;
   hasPrev: boolean;
   isQuering: boolean;
   onPrev: () => void;
   onNext: () => void;
   onExport: (format: ExportFormat) => void;
}

export const useTablePagerStore = defineStore('tablePager', {
   state: () => ({
      activePager: null as TablePagerState | null
   }),
   actions: {
      setActivePager (pager: TablePagerState) {
         this.activePager = pager;
      },
      patchActivePager (patch: Partial<TablePagerState>) {
         if (this.activePager)
            this.activePager = { ...this.activePager, ...patch };
      },
      clearActivePager () {
         this.activePager = null;
      }
   }
});
