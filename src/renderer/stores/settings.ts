import { ShortcutRecord } from 'common/shortcuts';
import { defineStore } from 'pinia';

import { AvailableLocale, i18n } from '@/i18n';
import { loadStore, saveStore } from '@/libs/persistStore';

export type EditorFontSize = 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge';
export type ApplicationTheme = 'light' | 'dark';

const isDarkTheme = window.matchMedia('(prefers-color-scheme: dark)');
const defaultAppTheme = isDarkTheme.matches ? 'dark' : 'light';
const defaultEditorTheme = isDarkTheme.matches ? 'twilight' : 'sqlserver';

export const useSettingsStore = defineStore('settings', {
   state: () => ({
      locale: 'en-US' as AvailableLocale,
      allowPrerelease: false as boolean,
      explorebarSize: null as number,
      notificationsTimeout: 5 as number,
      showTableSize: false as boolean,
      dataTabLimit: 1000 as number,
      autoComplete: true as boolean,
      lineWrap: true as boolean,
      executeSelected: true as boolean,
      applicationTheme: defaultAppTheme as ApplicationTheme,
      editorTheme: defaultEditorTheme as string,
      editorFontSize: 'medium' as EditorFontSize,
      restoreTabs: true as boolean,
      disableBlur: false as boolean,
      shortcuts: [] as ShortcutRecord[],
      defaultCopyType: 'cell' as string,
      aiApiKey: '' as string,
      tableAutoRefreshInterval: 0 as number,
      _loaded: false
   }),
   actions: {
      async init () {
         const settings = await loadStore('settings', {}) as Record<string, any>;
         const shortcuts = await loadStore('shortcuts', {}) as Record<string, any>;

         if (settings.locale !== undefined) this.locale = settings.locale;
         if (settings.allow_prerelease !== undefined) this.allowPrerelease = settings.allow_prerelease;
         if (settings.explorebar_size !== undefined) this.explorebarSize = settings.explorebar_size;
         if (settings.notifications_timeout !== undefined) this.notificationsTimeout = settings.notifications_timeout;
         if (settings.show_table_size !== undefined) this.showTableSize = settings.show_table_size;
         if (settings.data_tab_limit !== undefined) this.dataTabLimit = settings.data_tab_limit;
         if (settings.auto_complete !== undefined) this.autoComplete = settings.auto_complete;
         if (settings.line_wrap !== undefined) this.lineWrap = settings.line_wrap;
         if (settings.execute_selected !== undefined) this.executeSelected = settings.execute_selected;
         if (settings.application_theme !== undefined) this.applicationTheme = settings.application_theme;
         if (settings.editor_theme !== undefined) this.editorTheme = settings.editor_theme;
         if (settings.editor_font_size !== undefined) this.editorFontSize = settings.editor_font_size;
         if (settings.restore_tabs !== undefined) this.restoreTabs = settings.restore_tabs;
         if (settings.disable_blur !== undefined) this.disableBlur = settings.disable_blur;
         if (settings.default_copy_type !== undefined) this.defaultCopyType = settings.default_copy_type;
         if (settings.ai_api_key !== undefined) this.aiApiKey = settings.ai_api_key;
         if (settings.table_auto_refresh_interval !== undefined) this.tableAutoRefreshInterval = settings.table_auto_refresh_interval;
         if (shortcuts.shortcuts !== undefined) this.shortcuts = shortcuts.shortcuts;

         this._loaded = true;
      },
      async persistSettings () {
         await saveStore('settings', {
            locale: this.locale,
            allow_prerelease: this.allowPrerelease,
            explorebar_size: this.explorebarSize,
            notifications_timeout: this.notificationsTimeout,
            show_table_size: this.showTableSize,
            data_tab_limit: this.dataTabLimit,
            auto_complete: this.autoComplete,
            line_wrap: this.lineWrap,
            execute_selected: this.executeSelected,
            application_theme: this.applicationTheme,
            editor_theme: this.editorTheme,
            editor_font_size: this.editorFontSize,
            restore_tabs: this.restoreTabs,
            disable_blur: this.disableBlur,
            default_copy_type: this.defaultCopyType,
            ai_api_key: this.aiApiKey,
            table_auto_refresh_interval: this.tableAutoRefreshInterval
         });
      },
      async persistShortcuts () {
         await saveStore('shortcuts', { shortcuts: this.shortcuts });
      },
      changeLocale (locale: AvailableLocale) {
         this.locale = locale;
         i18n.global.locale.value = locale;
         this.persistSettings();
      },
      changePageSize (limit: number) {
         this.dataTabLimit = limit;
         this.persistSettings();
      },
      changeAllowPrerelease (allow: boolean) {
         this.allowPrerelease = allow;
         this.persistSettings();
      },
      updateNotificationsTimeout (timeout: number) {
         this.notificationsTimeout = timeout;
         this.persistSettings();
      },
      changeShowTableSize (show: boolean) {
         this.showTableSize = show;
         this.persistSettings();
      },
      changeExplorebarSize (size: number) {
         this.explorebarSize = size;
         this.persistSettings();
      },
      changeAutoComplete (val: boolean) {
         this.autoComplete = val;
         this.persistSettings();
      },
      changeLineWrap (val: boolean) {
         this.lineWrap = val;
         this.persistSettings();
      },
      changeExecuteSelected (val: boolean) {
         this.executeSelected = val;
         this.persistSettings();
      },
      changeApplicationTheme (theme: string) {
         this.applicationTheme = theme;
         this.persistSettings();
      },
      changeEditorTheme (theme: string) {
         this.editorTheme = theme;
         this.persistSettings();
      },
      changeEditorFontSize (size: EditorFontSize) {
         this.editorFontSize = size;
         this.persistSettings();
      },
      changeRestoreTabs (val: boolean) {
         this.restoreTabs = val;
         this.persistSettings();
      },
      changeDisableBlur (val: boolean) {
         this.disableBlur = val;
         this.persistSettings();
      },
      updateShortcuts (shortcuts: ShortcutRecord[]) {
         this.shortcuts = shortcuts;
         this.persistShortcuts();
      },
      changeDefaultCopyType (type: string) {
         this.defaultCopyType = type;
         this.persistSettings();
      },
      changeAiApiKey (key: string) {
         this.aiApiKey = key;
         this.persistSettings();
      },
      changeTableAutoRefreshInterval (value: number) {
         this.tableAutoRefreshInterval = Math.max(0, Math.min(3600, value));
         this.persistSettings();
      }
   }
});
