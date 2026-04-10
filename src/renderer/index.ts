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

// Initialize sidecar, then mount app
const pinia = createPinia();

function mountApp () {
   const app = createApp(App);
   app.directive('mask', vMaskV3);
   app.use(pinia);
   app.use(i18n);
   app.use(FloatingVue);
   app.mount('#app');

   // Set locale from persisted settings
   const { locale } = useSettingsStore();
   i18n.global.locale = locale;
}

initSidecar()
   .then(() => mountApp())
   .catch((err) => {
      console.error('Failed to initialize sidecar:', err);
      mountApp(); // Mount anyway so UI is visible
   });
