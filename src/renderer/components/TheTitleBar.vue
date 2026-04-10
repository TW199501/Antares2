<template>
   <div
      id="titlebar"
      @dblclick="toggleFullScreen"
   >
      <div class="titlebar-resizer" />
      <div class="titlebar-elements">
         <img
            v-if="!isMacOS"
            class="titlebar-logo"
            :src="appIcon"
         >
      </div>
      <div class="titlebar-elements titlebar-title">
         {{ windowTitle }}
      </div>
      <div class="titlebar-elements">
         <div
            v-if="isDevelopment"
            class="titlebar-element"
            @click="openDevTools"
         >
            <BaseIcon icon-name="mdiBugPlayOutline" :size="18" />
         </div>
         <div
            v-if="isDevelopment"
            class="titlebar-element"
            @click="reload"
         >
            <BaseIcon icon-name="mdiRefresh" :size="18" />
         </div>
         <div v-if="isWindows" :style="'width: 140px;'" />
         <div v-if="isLinux" class="d-flex">
            <div class="titlebar-element" @click="minimize">
               <BaseIcon icon-name="mdiWindowMinimize" :size="18" />
            </div>
            <div class="titlebar-element" @click="toggleFullScreen">
               <BaseIcon :icon-name="isMaximized ? 'mdiWindowRestore' : 'mdiWindowMaximize'" :size="18" />
            </div>
            <div class="titlebar-element" @click="closeApp">
               <BaseIcon icon-name="mdiClose" :size="18" />
            </div>
         </div>
      </div>
   </div>
</template>

<script setup lang="ts">
// TODO: Replace with @tauri-apps/api/window when Tauri is set up
// import { getCurrentWindow } from '@electron/remote';
// TODO: Replace with Tauri event system when Tauri is set up
// import { ipcRenderer } from 'electron';

// Stub getCurrentWindow for Tauri migration
import { storeToRefs } from 'pinia';
import { computed, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import { useConnectionsStore } from '@/stores/connections';
import { useWorkspacesStore } from '@/stores/workspaces';
const getCurrentWindow = () => ({
   minimize: () => {},
   maximize: () => {},
   unmaximize: () => {},
   close: () => {},
   isMaximized: () => false,
   isFullScreen: () => false,
   setFullScreen: (_flag: boolean) => {},
   on: (_event: string, _cb: Function) => {},
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   webContents: { openDevTools: () => {} } as any,
   reload: () => {}
});

// Stub ipcRenderer for Tauri migration
const ipcRenderer = {
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   on: (_channel: string, _listener: (...args: any[]) => void) => {},
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   send: (_channel: string, ..._args: any[]) => {},
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   removeListener: (_channel: string, _listener: (...args: any[]) => void) => {},
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   off: (_channel: string, _listener: (...args: any[]) => void) => {}
};

const { t } = useI18n();

const { getConnectionName } = useConnectionsStore();
const workspacesStore = useWorkspacesStore();

const { getSelected: selectedWorkspace } = storeToRefs(workspacesStore);

const { getWorkspace } = workspacesStore;

const appIcon = new URL('@/images/logo.svg', import.meta.url).href;
const w = ref(getCurrentWindow());
const isMaximized = ref(getCurrentWindow().isMaximized());
// TODO: Replace with import.meta.env.DEV when Vite is configured
const isDevelopment = ref(typeof import.meta !== 'undefined' ? import.meta.env?.MODE === 'development' : false);
// Platform detection using browser-compatible navigator API
const isMacOS = navigator.platform.startsWith('Mac');
const isWindows = navigator.platform.startsWith('Win');
const isLinux = navigator.platform.startsWith('Linux');

const windowTitle = computed(() => {
   if (!selectedWorkspace.value) return '';
   if (selectedWorkspace.value === 'NEW') return t('connection.createNewConnection');

   const connectionName = getConnectionName(selectedWorkspace.value);
   const workspace = getWorkspace(selectedWorkspace.value);
   const breadcrumbs = workspace ? Object.values(workspace.breadcrumbs).filter(breadcrumb => breadcrumb) || [workspace.client] : [];

   return [connectionName, ...breadcrumbs].join(' • ');
});

const openDevTools = () => {
   w.value.webContents.openDevTools();
};

const reload = () => {
   w.value.reload();
};

const minimize = () => {
   w.value.minimize();
};

const toggleFullScreen = () => {
   if (isMaximized.value)
      w.value.unmaximize();
   else
      w.value.maximize();
};

const closeApp = () => {
   ipcRenderer.send('close-app');
};

const onResize = () => {
   isMaximized.value = w.value.isMaximized();
};

watch(windowTitle, (val) => {
   ipcRenderer.send('change-window-title', val);
});

window.addEventListener('resize', onResize);

onUnmounted(() => {
   window.removeEventListener('resize', onResize);
});
</script>

<style lang="scss">
  #titlebar {
    display: flex;
    position: relative;
    justify-content: space-between;
    align-items: center;
    height: $titlebar-height;
    -webkit-app-region: drag;
    user-select: none;
    z-index: 9999;

    .titlebar-resizer {
      position: absolute;
      top: 0;
      width: 100%;
      height: 4px;
      z-index: 999;
      -webkit-app-region: no-drag;
    }

    .titlebar-elements {
      display: flex;
      align-items: center;

      &.titlebar-title {
        position: absolute;
        left: 0;
        right: 0;
        text-align: center;
        display: block;
        pointer-events: none;
      }

      .titlebar-logo {
        height: $titlebar-height;
        padding: 0.3rem 0.4rem;
      }

      .titlebar-element {
        display: flex;
        align-items: center;
        height: $titlebar-height;
        line-height: 0;
        padding: 0 0.7rem;
        opacity: 0.9;
        transition: opacity 0.2s;
        -webkit-app-region: no-drag;

        &:hover {
          opacity: 1;
        }
      }
    }
  }
</style>
