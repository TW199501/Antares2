'use strict';
import 'floating-vue/dist/style.css';
import 'leaflet/dist/leaflet.css';
import '@/scss/main.scss';

import { setSidecarPort } from '@/ipc-api/httpClient';
import { initTauriFs } from '@/libs/persistStore';

// Sidecar port initialization
async function initSidecar () {
   try {
      // Try Tauri environment
      const { invoke } = await import('@tauri-apps/api/core');
      const { listen } = await import('@tauri-apps/api/event');

      // Check if sidecar already started
      const existingPort = await invoke<number>('get_sidecar_port');
      if (existingPort > 0) setSidecarPort(existingPort);

      // Listen for future sidecar-ready events
      await listen<number>('sidecar-ready', (event) => {
         setSidecarPort(event.payload);
      });
   }
   catch {
      // Not in Tauri — use dev mode port
      const devPort = 5555;
      setSidecarPort(devPort);
      console.log(`Dev mode: using sidecar port ${devPort}`);
   }

   // Initialize Tauri fs for persistence
   await initTauriFs();
}

// Stub ipcRenderer (will be removed once all listeners are migrated)
const ipcRenderer = {
   on: (_channel: string, _listener: (...args: any[]) => void) => {},
   send: (_channel: string, ..._args: any[]) => {},
   removeListener: (_channel: string, _listener: (...args: any[]) => void) => {},
   off: (_channel: string, _listener: (...args: any[]) => void) => {}
};
import * as FloatingVue from 'floating-vue';
import { createPinia } from 'pinia';
import { VueMaskDirective } from 'v-mask';
import { createApp } from 'vue';

import App from '@/App.vue';
import { i18n } from '@/i18n';
import { useApplicationStore } from '@/stores/application';
import { QueryLog, useConsoleStore } from '@/stores/console';
import { useNotificationsStore } from '@/stores/notifications';
import { useSettingsStore } from '@/stores/settings';

// https://github.com/probil/v-mask/issues/498#issuecomment-827027834
const vMaskV2 = VueMaskDirective;
const vMaskV3 = {
   beforeMount: vMaskV2.bind,
   updated: vMaskV2.componentUpdated,
   unmounted: vMaskV2.unbind
};

// Initialize sidecar connection before mounting
initSidecar().then(() => {
   createApp(App)
      .directive('mask', vMaskV3)
      .use(createPinia())
      .use(i18n)
      .use(FloatingVue)
      .mount('#app');
}).catch((err) => {
   console.error('Failed to initialize sidecar:', err);
   // Mount app anyway so UI is visible
   createApp(App)
      .directive('mask', vMaskV3)
      .use(createPinia())
      .use(i18n)
      .use(FloatingVue)
      .mount('#app');
});

const { locale } = useSettingsStore();
i18n.global.locale = locale;

// IPC exceptions
ipcRenderer.on('unhandled-exception', (event, error) => {
   useNotificationsStore().addNotification({ status: 'error', message: error.message });
   useConsoleStore().putLog('debug', {
      level: 'error',
      process: 'main',
      message: error.message,
      date: new Date()
   });
});
ipcRenderer.on('non-blocking-exception', (event, error) => {
   useNotificationsStore().addNotification({ status: 'error', message: error.message });
   useConsoleStore().putLog('debug', {
      level: 'error',
      process: 'main',
      message: error.message,
      date: new Date()
   });
});

// IPC query logs
ipcRenderer.on('query-log', (event, logRecord: QueryLog) => {
   useConsoleStore().putLog('query', logRecord);
});

ipcRenderer.on('toggle-console', () => {
   useConsoleStore().toggleConsole();
});

// IPC app updates
ipcRenderer.on('checking-for-update', () => {
   useApplicationStore().updateStatus = 'checking';
});

ipcRenderer.on('update-available', () => {
   useApplicationStore().updateStatus = 'available';
});

ipcRenderer.on('update-not-available', () => {
   useApplicationStore().updateStatus = 'noupdate';
});

ipcRenderer.on('check-failed', () => {
   useApplicationStore().updateStatus = 'nocheck';
});

ipcRenderer.on('no-auto-update', () => {
   useApplicationStore().updateStatus = 'disabled';
});

ipcRenderer.on('download-progress', (event, data) => {
   useApplicationStore().updateStatus = 'downloading';
   useApplicationStore().downloadProgress = data.percent;
});

ipcRenderer.on('update-downloaded', () => {
   useApplicationStore().updateStatus = 'downloaded';
});

ipcRenderer.on('link-to-download', () => {
   useApplicationStore().updateStatus = 'link';
});

// IPC shortcuts
ipcRenderer.on('toggle-preferences', () => {
   useApplicationStore().showSettingModal('general');
});

ipcRenderer.on('open-updates-preferences', () => {
   useApplicationStore().showSettingModal('update');
   ipcRenderer.send('check-for-updates');
});

ipcRenderer.on('update-shortcuts', (event, shortcuts) => {
   useSettingsStore().updateShortcuts(shortcuts);
});
