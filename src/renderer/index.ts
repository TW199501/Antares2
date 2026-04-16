'use strict';
import 'floating-vue/dist/style.css';
import 'leaflet/dist/leaflet.css';
import '@/scss/main.scss';

import { Buffer } from 'buffer';
import * as FloatingVue from 'floating-vue';
import { createPinia } from 'pinia';
import { VueMaskDirective } from 'v-mask';
import { createApp } from 'vue';

import App from '@/App.vue';
import { i18n } from '@/i18n';
import { setNoConnectionHandler, setSidecarPort } from '@/ipc-api/httpClient';
import { initTauriFs } from '@/libs/persistStore';
import { useConnectionsStore } from '@/stores/connections';
import { useSettingsStore } from '@/stores/settings';
globalThis.Buffer = Buffer;

// Sidecar port initialization
async function initSidecar () {
   try {
      // Try Tauri environment
      const { invoke } = await import('@tauri-apps/api/core');
      const { listen } = await import('@tauri-apps/api/event');

      // Check if sidecar already started
      const existingPort = await invoke<number>('get_sidecar_port');
      if (existingPort > 0) setSidecarPort(existingPort);

      let isFirstSidecarReady = existingPort === 0;

      // Listen for future sidecar-ready events (also fires on sidecar restart)
      await listen<number>('sidecar-ready', async (event) => {
         setSidecarPort(event.payload);

         // Skip the very first ready event (handled by existingPort above)
         if (isFirstSidecarReady) {
            isFirstSidecarReady = false;
            return;
         }

         // Sidecar restarted — reconnect any workspaces that were connected
         const { useWorkspacesStore } = await import('@/stores/workspaces');
         const { useConnectionsStore } = await import('@/stores/connections');
         const workspacesStore = useWorkspacesStore();
         const connectionsStore = useConnectionsStore();

         const connectedUids = workspacesStore.workspaces
            .filter((w: { connectionStatus: string }) => ['connected', 'failed', 'connecting'].includes(w.connectionStatus))
            .map((w: { uid: string }) => w.uid);

         for (const uid of connectedUids) {
            const connection = connectionsStore.getConnectionByUid(uid);
            if (connection)
               workspacesStore.connectWorkspace(connection);
         }
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

// https://github.com/probil/v-mask/issues/498#issuecomment-827027834
const vMaskV2 = VueMaskDirective;
const vMaskV3 = {
   beforeMount: vMaskV2.bind,
   updated: vMaskV2.componentUpdated,
   unmounted: vMaskV2.unbind
};

// Initialize sidecar, then mount app
const pinia = createPinia();

async function mountApp () {
   const app = createApp(App);
   app.directive('mask', vMaskV3);
   app.use(pinia);
   app.use(i18n);
   app.use(FloatingVue);

   // Load persisted data before mounting
   const connectionsStore = useConnectionsStore();
   const settingsStore = useSettingsStore();
   await Promise.all([
      connectionsStore.init(),
      settingsStore.init()
   ]);

   app.mount('#app');

   // Set locale from persisted settings
   i18n.global.locale.value = settingsStore.locale;

   // Auto-reconnect when sidecar loses a connection (e.g. after restart)
   const { useWorkspacesStore } = await import('@/stores/workspaces');
   const workspacesStore = useWorkspacesStore();
   setNoConnectionHandler((uid: string) => {
      const connection = connectionsStore.getConnectionByUid(uid);
      const workspace = workspacesStore.getWorkspace(uid);
      if (connection && workspace?.connectionStatus === 'connected')
         workspacesStore.connectWorkspace(connection);
   });
}

initSidecar()
   .then(() => mountApp())
   .catch((err) => {
      console.error('Failed to initialize sidecar:', err);
      mountApp(); // Mount anyway so UI is visible
   });
