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
import { getCurrentWindow } from '@tauri-apps/api/window';
import { storeToRefs } from 'pinia';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import Application from '@/ipc-api/Application';
import { useConnectionsStore } from '@/stores/connections';
import { useWorkspacesStore } from '@/stores/workspaces';

const { t } = useI18n();
const { getConnectionName } = useConnectionsStore();
const workspacesStore = useWorkspacesStore();
const { getSelected: selectedWorkspace } = storeToRefs(workspacesStore);
const { getWorkspace } = workspacesStore;

const appIcon = new URL('@/images/logo.svg', import.meta.url).href;
const isDevelopment = ref(import.meta.env?.MODE === 'development');
const isMacOS = navigator.platform.startsWith('Mac');
const isWindows = navigator.platform.startsWith('Win');
const isLinux = navigator.platform.startsWith('Linux');
const isMaximized = ref(false);

const appWindow = getCurrentWindow();

const windowTitle = computed(() => {
   if (!selectedWorkspace.value) return '';
   if (selectedWorkspace.value === 'NEW') return t('connection.createNewConnection');
   const connectionName = getConnectionName(selectedWorkspace.value);
   const workspace = getWorkspace(selectedWorkspace.value);
   const breadcrumbs = workspace
      ? Object.values(workspace.breadcrumbs).filter(Boolean)
      : [];
   return [connectionName, ...breadcrumbs].join(' • ');
});

const openDevTools = () => {
   // DevTools are auto-opened in debug builds by lib.rs; no JS API in Tauri v2
};

const reload = () => {
   location.reload();
};

const minimize = () => {
   appWindow.minimize();
};

const toggleFullScreen = () => {
   if (isMaximized.value)
      appWindow.unmaximize();
   else
      appWindow.maximize();
};

const closeApp = () => {
   Application.closeApp();
};

const onResize = async () => {
   isMaximized.value = await appWindow.isMaximized();
};

watch(windowTitle, (val) => {
   document.title = val || 'Antares2';
});

onMounted(async () => {
   isMaximized.value = await appWindow.isMaximized();
   window.addEventListener('resize', onResize);
});

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
    overflow: hidden;
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
