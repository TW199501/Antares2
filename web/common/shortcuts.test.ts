/**
 * Characterization tests for shortcuts.ts.
 *
 * Exports:
 *   - shortcutEvents: Record<eventName, {i18n, i18nParam?, context?}>
 *   - shortcuts: ShortcutRecord[]  (event, isFunction?, keys[], os[])
 * select-tab-1..9 entries are appended at module load time. Note: there can be
 * multiple shortcut records for the same event when the OS coverage differs
 * (e.g. next-tab has a darwin/win32 binding AND a linux/win32 binding); this is
 * intentional and we don't dedupe by event. Modifier tokens use 'CommandOrControl'
 * (Tauri/Electron-flavored) — locked in here.
 */
import { describe, expect, it } from 'vitest';

import { shortcutEvents, ShortcutRecord, shortcuts } from './shortcuts';

const VALID_OS = new Set(['darwin', 'linux', 'win32']);

describe('shortcutEvents map', () => {
   it('is a non-empty plain object', () => {
      expect(typeof shortcutEvents).toBe('object');
      expect(shortcutEvents).not.toBeNull();
      expect(Object.keys(shortcutEvents).length).toBeGreaterThan(0);
   });

   it('every entry has an i18n key (string, non-empty)', () => {
      for (const [eventName, def] of Object.entries(shortcutEvents)) {
         expect(eventName.length).toBeGreaterThan(0);
         expect(def.i18n).toBeTypeOf('string');
         expect(def.i18n.length).toBeGreaterThan(0);
      }
   });

   it('context (when present) is "tab" or "main"', () => {
      for (const def of Object.values(shortcutEvents)) {
         if (def.context !== undefined)
            expect(['tab', 'main']).toContain(def.context);
      }
   });

   it('select-tab-1..9 are registered with i18nParam = 1..9', () => {
      for (let i = 1; i <= 9; i++) {
         const key = `select-tab-${i}`;
         expect(shortcutEvents[key]).toBeDefined();
         expect(shortcutEvents[key].i18n).toBe('application.selectTabNumber');
         expect(shortcutEvents[key].i18nParam).toBe(i);
      }
   });

   it('exposes core known events (run-or-reload, open-new-tab, close-tab, etc.)', () => {
      for (const k of [
         'run-or-reload',
         'open-new-tab',
         'close-tab',
         'format-query',
         'kill-query',
         'query-history',
         'clear-query',
         'next-tab',
         'prev-tab',
         'create-connection',
         'open-settings',
         'setFullScreen',
         'setZoomIn',
         'setZoomOut',
         'setZoomReset'
      ])
         expect(shortcutEvents[k]).toBeDefined();
   });
});

describe('shortcuts list', () => {
   it('is a non-empty array', () => {
      expect(Array.isArray(shortcuts)).toBe(true);
      expect(shortcuts.length).toBeGreaterThan(0);
   });

   it('every record matches the ShortcutRecord shape', () => {
      for (const s of shortcuts) {
         expect(s.event).toBeTypeOf('string');
         expect(s.event.length).toBeGreaterThan(0);
         expect(Array.isArray(s.keys)).toBe(true);
         expect(s.keys.length).toBeGreaterThan(0);
         for (const k of s.keys) {
            expect(k).toBeTypeOf('string');
            expect(k.length).toBeGreaterThan(0);
         }
         expect(Array.isArray(s.os)).toBe(true);
         expect(s.os.length).toBeGreaterThan(0);
         for (const os of s.os) expect(VALID_OS.has(os)).toBe(true);
         if (s.isFunction !== undefined) expect(s.isFunction).toBeTypeOf('boolean');
      }
   });

   it('every shortcut.event maps to an entry in shortcutEvents', () => {
      const known = new Set(Object.keys(shortcutEvents));
      for (const s of shortcuts) expect(known.has(s.event), `unknown event ${s.event}`).toBe(true);
   });

   it('select-tab-1..9 each have a CommandOrControl+<n> binding on all 3 OSes', () => {
      for (let i = 1; i <= 9; i++) {
         const match = shortcuts.find(
            s => s.event === `select-tab-${i}` && s.keys.includes(`CommandOrControl+${i}`)
         );
         expect(match, `select-tab-${i} missing`).toBeDefined();
         expect(match!.os).toEqual(expect.arrayContaining(['darwin', 'linux', 'win32']));
      }
   });

   it('isFunction=true entries are reserved for the four window/zoom system actions', () => {
      const fnEvents = new Set(
         shortcuts.filter(s => s.isFunction === true).map(s => s.event)
      );
      expect(fnEvents).toEqual(new Set(['setFullScreen', 'setZoomIn', 'setZoomOut', 'setZoomReset']));
   });

   it('next-tab / prev-tab each have two distinct OS-coverage records (darwin pair vs linux/win32 pair)', () => {
      const nextTabs = shortcuts.filter(s => s.event === 'next-tab');
      const prevTabs = shortcuts.filter(s => s.event === 'prev-tab');
      expect(nextTabs.length).toBe(2);
      expect(prevTabs.length).toBe(2);
   });

   it('no duplicate (event, keys, os) tuple — each record is unique', () => {
      const seen = new Set<string>();
      for (const s of shortcuts) {
         const key = `${s.event}|${[...s.keys].sort().join(',')}|${[...s.os].sort().join(',')}`;
         expect(seen.has(key), `duplicate ${key}`).toBe(false);
         seen.add(key);
      }
   });

   it('uses CommandOrControl modifier (not Cmd/Ctrl/Meta) for cross-platform combos', () => {
      const cross = shortcuts.filter(s =>
         s.os.includes('darwin') && (s.os.includes('win32') || s.os.includes('linux'))
      );
      // At least one cross-platform binding uses CommandOrControl (sanity check token)
      const usesCoC = cross.some(s => s.keys.some(k => k.includes('CommandOrControl')));
      expect(usesCoC).toBe(true);
      // None of those bindings uses bare 'Cmd+' or 'Ctrl+' as a leading modifier
      for (const s of cross) {
         for (const k of s.keys) {
            expect(k.startsWith('Cmd+'), `bad token in ${k}`).toBe(false);
            expect(k.startsWith('Ctrl+'), `bad token in ${k}`).toBe(false);
         }
      }
   });

   it('ShortcutRecord type is exported (compile-time check via dummy assignment)', () => {
      const sample: ShortcutRecord = {
         event: 'noop',
         keys: ['F1'],
         os: ['win32']
      };
      expect(sample.event).toBe('noop');
   });
});
