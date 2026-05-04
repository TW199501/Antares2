/**
 * settings store — Pinia store tests (T9 / PR5).
 *
 * Tested behaviors:
 *   - Default state shape (locale, theme, font size, timeouts, etc.)
 *   - init(): pulls 'settings' AND 'shortcuts' separately
 *   - init(): performs snake_case → camelCase migration for every persisted
 *     field (allow_prerelease, explorebar_size, notifications_timeout, ...)
 *   - init(): clamps table_auto_refresh_interval (0 stays 0; 1..59 → 60; cap 3600)
 *   - persistSettings() writes the full snake_case payload under 'settings'
 *   - persistShortcuts() writes shortcuts under its own key
 *   - changeLocale() also writes through to i18n.global.locale.value
 *   - changeTableAutoRefreshInterval() applies the same clamp at runtime
 *   - Smaller setters update state and call persistSettings (sampled)
 */
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { i18n } from '@/i18n';
import { loadStore, saveStore } from '@/libs/persistStore';

import { useSettingsStore } from './settings';

describe('settings store — defaults', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('starts with documented defaults', () => {
      const store = useSettingsStore();
      expect(store.locale).toBe('en-US');
      expect(store.allowPrerelease).toBe(false);
      expect(store.explorebarSize).toBeNull();
      expect(store.notificationsTimeout).toBe(5);
      expect(store.showTableSize).toBe(false);
      expect(store.dataTabLimit).toBe(1000);
      expect(store.autoComplete).toBe(true);
      expect(store.lineWrap).toBe(true);
      expect(store.executeSelected).toBe(true);
      expect(store.editorFontSize).toBe('medium');
      expect(store.restoreTabs).toBe(true);
      expect(store.disableBlur).toBe(false);
      expect(store.shortcuts).toEqual([]);
      expect(store.defaultCopyType).toBe('cell');
      expect(store.aiApiKey).toBe('');
      expect(store.tableAutoRefreshInterval).toBe(0);
      expect(store.tableQueryAreaHeight).toBe(300);
      expect(store._loaded).toBe(false);
   });

   it('default theme follows matchMedia (mock returns matches=false → light)', () => {
      // tests/setup.ts stubs matchMedia to always return matches=false.
      const store = useSettingsStore();
      expect(store.applicationTheme).toBe('light');
      expect(store.editorTheme).toBe('sqlserver');
   });
});

describe('settings store — init()', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('migrates the full snake_case payload from the persisted "settings" store', async () => {
      await saveStore('settings', {
         locale: 'zh-TW',
         allow_prerelease: true,
         explorebar_size: 320,
         notifications_timeout: 10,
         show_table_size: true,
         data_tab_limit: 500,
         auto_complete: false,
         line_wrap: false,
         execute_selected: false,
         application_theme: 'dark',
         editor_theme: 'twilight',
         editor_font_size: 'large',
         restore_tabs: false,
         disable_blur: true,
         default_copy_type: 'row',
         ai_api_key: 'sk-test',
         table_auto_refresh_interval: 120,
         table_query_area_height: 450
      });
      await saveStore('shortcuts', {
         shortcuts: [{ event: 'run-or-reload', keys: ['F5'], os: ['win32'] }]
      });

      const store = useSettingsStore();
      await store.init();

      expect(store.locale).toBe('zh-TW');
      expect(store.allowPrerelease).toBe(true);
      expect(store.explorebarSize).toBe(320);
      expect(store.notificationsTimeout).toBe(10);
      expect(store.showTableSize).toBe(true);
      expect(store.dataTabLimit).toBe(500);
      expect(store.autoComplete).toBe(false);
      expect(store.lineWrap).toBe(false);
      expect(store.executeSelected).toBe(false);
      expect(store.applicationTheme).toBe('dark');
      expect(store.editorTheme).toBe('twilight');
      expect(store.editorFontSize).toBe('large');
      expect(store.restoreTabs).toBe(false);
      expect(store.disableBlur).toBe(true);
      expect(store.defaultCopyType).toBe('row');
      expect(store.aiApiKey).toBe('sk-test');
      expect(store.tableAutoRefreshInterval).toBe(120);
      expect(store.tableQueryAreaHeight).toBe(450);
      expect(store.shortcuts).toHaveLength(1);
      expect(store.shortcuts[0].event).toBe('run-or-reload');
      expect(store._loaded).toBe(true);
   });

   it('init() leaves defaults when storage is empty (still flips _loaded)', async () => {
      const store = useSettingsStore();
      await store.init();
      expect(store.locale).toBe('en-US');
      expect(store.shortcuts).toEqual([]);
      expect(store._loaded).toBe(true);
   });

   it('init() clamps table_auto_refresh_interval: 0 stays 0', async () => {
      await saveStore('settings', { table_auto_refresh_interval: 0 });
      const store = useSettingsStore();
      await store.init();
      expect(store.tableAutoRefreshInterval).toBe(0);
   });

   it('init() clamps table_auto_refresh_interval: values 1..59 are floored to 60', async () => {
      await saveStore('settings', { table_auto_refresh_interval: 30 });
      const store = useSettingsStore();
      await store.init();
      expect(store.tableAutoRefreshInterval).toBe(60);
   });

   it('init() clamps table_auto_refresh_interval: values > 3600 are capped to 3600', async () => {
      await saveStore('settings', { table_auto_refresh_interval: 99999 });
      const store = useSettingsStore();
      await store.init();
      expect(store.tableAutoRefreshInterval).toBe(3600);
   });

   it('init() clamps table_auto_refresh_interval: negative values become 0', async () => {
      await saveStore('settings', { table_auto_refresh_interval: -5 });
      const store = useSettingsStore();
      await store.init();
      expect(store.tableAutoRefreshInterval).toBe(0);
   });
});

describe('settings store — persistSettings() & persistShortcuts()', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('persistSettings writes the full snake_case payload under "settings"', async () => {
      const store = useSettingsStore();
      store.locale = 'ja-JP';
      store.allowPrerelease = true;
      store.dataTabLimit = 250;
      await store.persistSettings();

      const persisted = await loadStore<Record<string, unknown>>('settings', {});
      expect(persisted.locale).toBe('ja-JP');
      expect(persisted.allow_prerelease).toBe(true);
      expect(persisted.data_tab_limit).toBe(250);
      // confirm camelCase keys are NOT used in storage:
      expect(persisted.allowPrerelease).toBeUndefined();
   });

   it('persistShortcuts writes shortcuts under "shortcuts" key only', async () => {
      const store = useSettingsStore();
      store.shortcuts = [{ event: 'foo', keys: ['F2'], os: ['win32'] }];
      await store.persistShortcuts();

      const persisted = await loadStore<{ shortcuts: unknown[] }>('shortcuts', { shortcuts: [] });
      expect(persisted.shortcuts).toHaveLength(1);
   });
});

describe('settings store — setters', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('changeLocale updates state AND propagates to i18n.global.locale', () => {
      const store = useSettingsStore();
      store.changeLocale('zh-CN');
      expect(store.locale).toBe('zh-CN');
      expect(i18n.global.locale.value).toBe('zh-CN');
   });

   it('changePageSize updates dataTabLimit', () => {
      const store = useSettingsStore();
      store.changePageSize(750);
      expect(store.dataTabLimit).toBe(750);
   });

   it('changeAllowPrerelease toggles the flag', () => {
      const store = useSettingsStore();
      store.changeAllowPrerelease(true);
      expect(store.allowPrerelease).toBe(true);
   });

   it('updateNotificationsTimeout sets the timeout', () => {
      const store = useSettingsStore();
      store.updateNotificationsTimeout(15);
      expect(store.notificationsTimeout).toBe(15);
   });

   it('changeApplicationTheme / changeEditorTheme / changeEditorFontSize update state', () => {
      const store = useSettingsStore();
      store.changeApplicationTheme('dark');
      store.changeEditorTheme('twilight');
      store.changeEditorFontSize('xlarge');
      expect(store.applicationTheme).toBe('dark');
      expect(store.editorTheme).toBe('twilight');
      expect(store.editorFontSize).toBe('xlarge');
   });

   it('boolean toggles: changeAutoComplete / changeLineWrap / changeExecuteSelected / changeRestoreTabs / changeDisableBlur / changeShowTableSize', () => {
      const store = useSettingsStore();
      store.changeAutoComplete(false);
      store.changeLineWrap(false);
      store.changeExecuteSelected(false);
      store.changeRestoreTabs(false);
      store.changeDisableBlur(true);
      store.changeShowTableSize(true);
      expect(store.autoComplete).toBe(false);
      expect(store.lineWrap).toBe(false);
      expect(store.executeSelected).toBe(false);
      expect(store.restoreTabs).toBe(false);
      expect(store.disableBlur).toBe(true);
      expect(store.showTableSize).toBe(true);
   });

   it('changeExplorebarSize / setTableQueryAreaHeight / changeDefaultCopyType / changeAiApiKey update state', () => {
      const store = useSettingsStore();
      store.changeExplorebarSize(400);
      store.setTableQueryAreaHeight(800);
      store.changeDefaultCopyType('row');
      store.changeAiApiKey('sk-foo');
      expect(store.explorebarSize).toBe(400);
      expect(store.tableQueryAreaHeight).toBe(800);
      expect(store.defaultCopyType).toBe('row');
      expect(store.aiApiKey).toBe('sk-foo');
   });

   it('updateShortcuts replaces the array and persists under shortcuts key', async () => {
      const store = useSettingsStore();
      store.updateShortcuts([{ event: 'x', keys: ['Ctrl+X'], os: ['win32'] }]);
      expect(store.shortcuts).toHaveLength(1);

      const persisted = await loadStore<{ shortcuts: unknown[] }>('shortcuts', { shortcuts: [] });
      expect(persisted.shortcuts).toHaveLength(1);
   });

   it('changeTableAutoRefreshInterval applies the clamp at runtime', () => {
      const store = useSettingsStore();
      store.changeTableAutoRefreshInterval(30);
      expect(store.tableAutoRefreshInterval).toBe(60);

      store.changeTableAutoRefreshInterval(0);
      expect(store.tableAutoRefreshInterval).toBe(0);

      store.changeTableAutoRefreshInterval(9999);
      expect(store.tableAutoRefreshInterval).toBe(3600);
   });
});
