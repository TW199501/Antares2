/**
 * history store — Pinia store tests (T9 / PR5).
 *
 * Tested behaviors:
 *   - Default state shape (history = {}, favorites = {}, _loaded = false)
 *   - getHistoryByWorkspace(uid) getter
 *   - init(): hydrates from persisted 'history' store; sets _loaded
 *   - persist(): writes both history + favorites under the 'history' key
 *   - saveHistory(): prepends new HistoryRecord, assigns uid 'H:*',
 *     dedupes consecutive identical SQL (same workspace, same query as latest)
 *   - saveHistory(): caps each workspace history at 1000 entries
 *   - deleteQueryFromHistory(): drops the matching uid + persists
 */
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { loadStore, saveStore } from '@/libs/persistStore';

import { type HistoryRecord, useHistoryStore } from './history';

describe('history store — defaults & getters', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('starts with empty history/favorites and _loaded=false', () => {
      const store = useHistoryStore();
      expect(store.history).toEqual({});
      expect(store.favorites).toEqual({});
      expect(store._loaded).toBe(false);
   });

   it('getHistoryByWorkspace returns the workspace bucket or undefined', () => {
      const store = useHistoryStore();
      expect(store.getHistoryByWorkspace('A')).toBeUndefined();
      store.history.A = [
         { uid: 'H:1', sql: 'SELECT 1', date: new Date() }
      ];
      expect(store.getHistoryByWorkspace('A')).toHaveLength(1);
   });
});

describe('history store — init() & persist()', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('init() hydrates from persisted store and flips _loaded=true', async () => {
      await saveStore('history', {
         history: { A: [{ uid: 'H:OLD', sql: 'SELECT 1', date: new Date() }] },
         favorites: { star: true }
      });

      const store = useHistoryStore();
      await store.init();

      expect(store.history.A).toHaveLength(1);
      expect(store.history.A[0].uid).toBe('H:OLD');
      expect(store.favorites).toEqual({ star: true });
      expect(store._loaded).toBe(true);
   });

   it('init() leaves defaults when storage is empty', async () => {
      const store = useHistoryStore();
      await store.init();
      expect(store.history).toEqual({});
      expect(store.favorites).toEqual({});
      expect(store._loaded).toBe(true);
   });

   it('persist() writes both history and favorites under "history" key', async () => {
      const store = useHistoryStore();
      store.history.A = [{ uid: 'H:1', sql: 'SELECT 1', date: new Date() }];
      store.favorites = { x: 1 };
      await store.persist();

      const stored = await loadStore<{ history: Record<string, HistoryRecord[]>; favorites: Record<string, unknown> }>(
         'history',
         { history: {}, favorites: {} }
      );
      expect(stored.history.A).toHaveLength(1);
      expect(stored.favorites).toEqual({ x: 1 });
   });
});

describe('history store — saveHistory()', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('creates the workspace bucket on first save and assigns "H:" uid', () => {
      const store = useHistoryStore();
      store.saveHistory({ uid: 'A', query: 'SELECT 1', schema: 'public', tabUid: 't1' });
      expect(store.history.A).toHaveLength(1);
      expect(store.history.A[0].uid).toMatch(/^H:/);
      expect(store.history.A[0].sql).toBe('SELECT 1');
      expect(store.history.A[0].schema).toBe('public');
   });

   it('prepends successive distinct queries (newest first)', () => {
      const store = useHistoryStore();
      store.saveHistory({ uid: 'A', query: 'SELECT 1', schema: 's', tabUid: 't' });
      store.saveHistory({ uid: 'A', query: 'SELECT 2', schema: 's', tabUid: 't' });
      expect(store.history.A.map(r => r.sql)).toEqual(['SELECT 2', 'SELECT 1']);
   });

   it('dedupes when the latest entry has the same SQL (no-op)', () => {
      const store = useHistoryStore();
      store.saveHistory({ uid: 'A', query: 'SELECT 1', schema: 's', tabUid: 't' });
      store.saveHistory({ uid: 'A', query: 'SELECT 1', schema: 's', tabUid: 't' });
      expect(store.history.A).toHaveLength(1);
   });

   it('does NOT dedupe when an intervening query breaks the run', () => {
      const store = useHistoryStore();
      store.saveHistory({ uid: 'A', query: 'SELECT 1', schema: 's', tabUid: 't' });
      store.saveHistory({ uid: 'A', query: 'SELECT 2', schema: 's', tabUid: 't' });
      store.saveHistory({ uid: 'A', query: 'SELECT 1', schema: 's', tabUid: 't' });
      expect(store.history.A).toHaveLength(3);
      expect(store.history.A.map(r => r.sql)).toEqual(['SELECT 1', 'SELECT 2', 'SELECT 1']);
   });

   it('caps the workspace history at 1000 records', { timeout: 15000 }, () => {
      // 1005 saveHistory calls spread the old array each time (O(n²)).
      // Under parallel test load with Pinia reactivity proxy this can take
      // ~7s on slower workers — default 5s timeout is too tight.
      const store = useHistoryStore();
      for (let i = 0; i < 1005; i++)
         store.saveHistory({ uid: 'A', query: `SELECT ${i}`, schema: 's', tabUid: 't' });
      expect(store.history.A).toHaveLength(1000);
      // newest first → SELECT 1004 at index 0
      expect(store.history.A[0].sql).toBe('SELECT 1004');
   });
});

describe('history store — deleteQueryFromHistory()', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('removes the matching uid from the workspace bucket', () => {
      const store = useHistoryStore();
      store.saveHistory({ uid: 'A', query: 'SELECT 1', schema: 's', tabUid: 't' });
      store.saveHistory({ uid: 'A', query: 'SELECT 2', schema: 's', tabUid: 't' });
      const targetUid = store.history.A[0].uid; // SELECT 2

      store.deleteQueryFromHistory({ workspace: 'A', uid: targetUid });

      expect(store.history.A).toHaveLength(1);
      expect(store.history.A[0].sql).toBe('SELECT 1');
   });
});
