/**
 * console store — Pinia store tests (T11 / PR5).
 *
 * Tested behaviors:
 *   - Default state: console closed, height 0, query/debug log buffers empty
 *   - putLog('query'): appends to queryLogs; cap = 1000 (slice on overflow)
 *   - putLog('debug'): appends to debugLogs; cap = 1000 (slice on overflow)
 *   - openConsole(): flips flag + sets height 250
 *   - closeConsole(): flips flag + clears height
 *   - resizeConsole(): closes if < 30; otherwise updates height
 *   - toggleConsole(): toggles the open/close pair
 *   - getLogsByWorkspace(uid): filters queryLogs by cUid
 */
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { type DebugLog, type QueryLog, useConsoleStore } from './console';

const makeQueryLog = (cUid: string, sql = 'SELECT 1'): QueryLog => ({
   cUid,
   sql,
   date: new Date()
});

const makeDebugLog = (level: DebugLog['level'] = 'info'): DebugLog => ({
   level,
   process: 'renderer',
   message: 'hello',
   date: new Date()
});

describe('console store — defaults & getters', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('starts with empty buffers and console closed', () => {
      const store = useConsoleStore();
      expect(store.isConsoleOpen).toBe(false);
      expect(store.consoleHeight).toBe(0);
      expect(store.queryLogs).toEqual([]);
      expect(store.debugLogs).toEqual([]);
      expect(store.selectedTab).toBe('query');
   });

   it('getLogsByWorkspace filters queryLogs by cUid', () => {
      const store = useConsoleStore();
      store.putLog('query', makeQueryLog('A', 'SELECT 1'));
      store.putLog('query', makeQueryLog('B', 'SELECT 2'));
      store.putLog('query', makeQueryLog('A', 'SELECT 3'));

      const aLogs = store.getLogsByWorkspace('A');
      expect(aLogs).toHaveLength(2);
      expect(aLogs.map(l => l.sql)).toEqual(['SELECT 1', 'SELECT 3']);
      expect(store.getLogsByWorkspace('B')).toHaveLength(1);
      expect(store.getLogsByWorkspace('Z')).toEqual([]);
   });
});

describe('console store — putLog', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('appends a query log to queryLogs', () => {
      const store = useConsoleStore();
      store.putLog('query', makeQueryLog('A', 'SELECT 1'));
      expect(store.queryLogs).toHaveLength(1);
      expect(store.queryLogs[0].sql).toBe('SELECT 1');
      expect(store.debugLogs).toHaveLength(0);
   });

   it('appends a debug log to debugLogs', () => {
      const store = useConsoleStore();
      store.putLog('debug', makeDebugLog('warn'));
      expect(store.debugLogs).toHaveLength(1);
      expect(store.debugLogs[0].level).toBe('warn');
      expect(store.queryLogs).toHaveLength(0);
   });

   it('caps queryLogs at 1000 entries (slice on overflow)', () => {
      const store = useConsoleStore();
      // Push 1001 entries — the cap kicks in only when length > 1000.
      for (let i = 0; i < 1001; i++)
         store.putLog('query', makeQueryLog('A', `q${i}`));
      expect(store.queryLogs).toHaveLength(1000);
   });

   it('caps debugLogs at 1000 entries (slice on overflow)', () => {
      const store = useConsoleStore();
      for (let i = 0; i < 1001; i++)
         store.putLog('debug', makeDebugLog());
      expect(store.debugLogs).toHaveLength(1000);
   });
});

describe('console store — open/close/resize/toggle', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('openConsole sets the flag and a default height of 250', () => {
      const store = useConsoleStore();
      store.openConsole();
      expect(store.isConsoleOpen).toBe(true);
      expect(store.consoleHeight).toBe(250);
   });

   it('closeConsole clears the flag and resets height to 0', () => {
      const store = useConsoleStore();
      store.openConsole();
      store.closeConsole();
      expect(store.isConsoleOpen).toBe(false);
      expect(store.consoleHeight).toBe(0);
   });

   it('resizeConsole(< 30) closes the console', () => {
      const store = useConsoleStore();
      store.openConsole();
      store.resizeConsole(10);
      expect(store.isConsoleOpen).toBe(false);
      expect(store.consoleHeight).toBe(0);
   });

   it('resizeConsole(>= 30) updates height without flipping the open flag', () => {
      const store = useConsoleStore();
      store.openConsole();
      store.resizeConsole(400);
      expect(store.isConsoleOpen).toBe(true);
      expect(store.consoleHeight).toBe(400);
   });

   it('toggleConsole flips between open and closed', () => {
      const store = useConsoleStore();
      store.toggleConsole();
      expect(store.isConsoleOpen).toBe(true);
      expect(store.consoleHeight).toBe(250);

      store.toggleConsole();
      expect(store.isConsoleOpen).toBe(false);
      expect(store.consoleHeight).toBe(0);
   });
});
