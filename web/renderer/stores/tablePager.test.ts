/**
 * tablePager store — Pinia store tests (T11 / PR5).
 *
 * Tested behaviors:
 *   - Default state: activePager is null
 *   - setActivePager(): replaces the active pager wholesale
 *   - patchActivePager(): merges a Partial<TablePagerState> into activePager
 *   - patchActivePager() is a no-op when activePager is null
 *   - clearActivePager(): resets activePager to null
 *
 * Why this store exists: bridges per-tab WorkspaceTabTable pagination state
 * to the app-singleton TheFooter, which is a sibling (so provide/inject and
 * prop-drilling don't apply).
 */
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type TablePagerState, useTablePagerStore } from './tablePager';

const makePager = (overrides: Partial<TablePagerState> = {}): TablePagerState => ({
   page: 1,
   hasNext: true,
   hasPrev: false,
   isQuering: false,
   onPrev: vi.fn(),
   onNext: vi.fn(),
   onExport: vi.fn(),
   ...overrides
});

describe('tablePager store', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('starts with activePager === null', () => {
      const store = useTablePagerStore();
      expect(store.activePager).toBeNull();
   });

   it('setActivePager replaces the entire pager state', () => {
      const store = useTablePagerStore();
      const pager = makePager({ page: 5 });
      store.setActivePager(pager);
      expect(store.activePager).not.toBeNull();
      expect(store.activePager?.page).toBe(5);
      expect(store.activePager?.hasNext).toBe(true);
   });

   it('setActivePager called twice replaces the previous handlers (no merge)', () => {
      const store = useTablePagerStore();
      const first = makePager({ page: 1 });
      const second = makePager({ page: 99, hasPrev: true });
      store.setActivePager(first);
      store.setActivePager(second);
      expect(store.activePager?.page).toBe(99);
      expect(store.activePager?.hasPrev).toBe(true);
      expect(store.activePager?.onNext).toBe(second.onNext);
   });

   it('patchActivePager merges partial state without dropping handlers', () => {
      const store = useTablePagerStore();
      const onNext = vi.fn();
      store.setActivePager(makePager({ page: 1, onNext }));
      store.patchActivePager({ page: 2, hasPrev: true });
      expect(store.activePager?.page).toBe(2);
      expect(store.activePager?.hasPrev).toBe(true);
      // unchanged handlers survive
      expect(store.activePager?.onNext).toBe(onNext);
   });

   it('patchActivePager is a no-op when activePager is null', () => {
      const store = useTablePagerStore();
      store.patchActivePager({ page: 99 });
      expect(store.activePager).toBeNull();
   });

   it('clearActivePager resets the pager back to null', () => {
      const store = useTablePagerStore();
      store.setActivePager(makePager());
      store.clearActivePager();
      expect(store.activePager).toBeNull();
   });
});
