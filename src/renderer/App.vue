<template>
   <TooltipProvider :delay-duration="300">
      <div id="wrapper" :class="[`theme-${applicationTheme}`, !disableBlur || 'no-blur']">
         <TheTitleBar />
         <div id="window-content">
            <TheSettingBar @show-connections-modal="isAllConnectionsModal = true" />
            <div id="main-content">
               <div class="flex">
                  <Workspace
                     v-for="connection in connections"
                     :key="connection.uid"
                     :connection="connection"
                  />
                  <WorkspaceAddConnectionPanel v-if="selectedWorkspace === 'NEW'" />
               </div>
               <TheFooter />
               <TheScratchpad v-if="isScratchpad" />
               <TheSpecSnapInspector v-if="isSpecsnap" />
               <ModalSettings v-if="isSettingModal" />
               <BaseTextEditor class="d-none" value="" />
            </div>
         </div>
         <ModalAllConnections
            v-if="isAllConnectionsModal"
            @close="isAllConnectionsModal = false"
         />

         <ModalExportSchema
            v-if="isExportSchemaModal"
            @close="hideExportModal"
         />

         <Sonner />
      </div>
   </TooltipProvider>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { defineAsyncComponent, onMounted, onUnmounted, Ref, ref } from 'vue';

import ModalExportSchema from '@/components/ModalExportSchema.vue';
import TheSettingBar from '@/components/TheSettingBar.vue';
import { Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useShortcutDispatcher } from '@/composables/useShortcutDispatcher';
import { useApplicationStore } from '@/stores/application';
import { useConnectionsStore } from '@/stores/connections';
import { useConsoleStore } from '@/stores/console';
import { useSchemaExportStore } from '@/stores/schemaExport';
import { useSettingsStore } from '@/stores/settings';
import { useWorkspacesStore } from '@/stores/workspaces';

const TheTitleBar = defineAsyncComponent(() => import(/* webpackChunkName: "TheTitleBar" */'@/components/TheTitleBar.vue'));
const TheFooter = defineAsyncComponent(() => import(/* webpackChunkName: "TheFooter" */'@/components/TheFooter.vue'));
const Workspace = defineAsyncComponent(() => import(/* webpackChunkName: "Workspace" */'@/components/Workspace.vue'));
const WorkspaceAddConnectionPanel = defineAsyncComponent(() => import(/* webpackChunkName: "WorkspaceAddConnectionPanel" */'@/components/WorkspaceAddConnectionPanel.vue'));
const ModalSettings = defineAsyncComponent(() => import(/* webpackChunkName: "ModalSettings" */'@/components/ModalSettings.vue'));
const ModalAllConnections = defineAsyncComponent(() => import(/* webpackChunkName: "ModalAllConnections" */'@/components/ModalAllConnections.vue'));
const TheScratchpad = defineAsyncComponent(() => import(/* webpackChunkName: "TheScratchpad" */'@/components/TheScratchpad.vue'));
const TheSpecSnapInspector = defineAsyncComponent(() => import(/* webpackChunkName: "TheSpecSnapInspector" */'@/components/TheSpecSnapInspector.vue'));
const BaseTextEditor = defineAsyncComponent(() => import(/* webpackChunkName: "BaseTextEditor" */'@/components/BaseTextEditor.vue'));

const applicationStore = useApplicationStore();
const connectionsStore = useConnectionsStore();
const settingsStore = useSettingsStore();
const workspacesStore = useWorkspacesStore();

const {
   isSettingModal,
   isScratchpad,
   isSpecsnap
} = storeToRefs(applicationStore);
const { connections } = storeToRefs(connectionsStore);
const { applicationTheme, disableBlur } = storeToRefs(settingsStore);
const { getSelected: selectedWorkspace } = storeToRefs(workspacesStore);

const { changeApplicationTheme } = settingsStore;

const schemaExportStore = useSchemaExportStore();
const { hideExportModal } = schemaExportStore;
const { isExportModal: isExportSchemaModal } = storeToRefs(schemaExportStore);

const consoleStore = useConsoleStore();

const isAllConnectionsModal: Ref<boolean> = ref(false);

useShortcutDispatcher();

document.addEventListener('DOMContentLoaded', () => {
   setTimeout(() => {
      changeApplicationTheme(applicationTheme.value);// Forces persistentStore to save on file and mail process
   }, 1000);
});

const onOpenAllConnections = () => {
   isAllConnectionsModal.value = true;
};
const onOpenScratchpad = () => {
   isScratchpad.value = true;
};
const onOpenSettings = () => {
   isSettingModal.value = true;
};
const onCreateConnection = () => {
   workspacesStore.selectWorkspace('NEW');
};

onMounted(() => {
   window.addEventListener('antares:open-all-connections', onOpenAllConnections);
   window.addEventListener('antares:open-scratchpad', onOpenScratchpad);
   window.addEventListener('antares:open-settings', onOpenSettings);
   window.addEventListener('antares:create-connection', onCreateConnection);

   applicationStore.checkVersionUpdate();
   applicationStore.checkForUpdates();

   document.addEventListener('keydown', e => {
      if (e.altKey && e.key === 'Alt') { // Prevent Alt key to trigger hidden shortcut menu
         e.preventDefault();
      }
   });
});

onUnmounted(() => {
   window.removeEventListener('antares:open-all-connections', onOpenAllConnections);
   window.removeEventListener('antares:open-scratchpad', onOpenScratchpad);
   window.removeEventListener('antares:open-settings', onOpenSettings);
   window.removeEventListener('antares:create-connection', onCreateConnection);
});

// Console messages
const oldLog = console.log;
const oldWarn = console.warn;
const oldInfo = console.info;
const oldError = console.error;

console.log = function (...args) {
   consoleStore.putLog('debug', {
      level: 'log',
      process: 'renderer',
      message: args.join(' '),
      date: new Date()
   });
   oldLog.apply(this, args);
};

console.info = function (...args) {
   consoleStore.putLog('debug', {
      level: 'info',
      process: 'renderer',
      message: args.join(' '),
      date: new Date()
   });
   oldInfo.apply(this, args);
};

console.warn = function (...args) {
   consoleStore.putLog('debug', {
      level: 'warn',
      process: 'renderer',
      message: args.join(' '),
      date: new Date()
   });
   oldWarn.apply(this, args);
};

console.error = function (...args) {
   consoleStore.putLog('debug', {
      level: 'error',
      process: 'renderer',
      message: args.join(' '),
      date: new Date()
   });
   oldError.apply(this, args);
};

window.addEventListener('unhandledrejection', (event) => {
   console.error(event.reason);
});

window.addEventListener('error', (event) => {
   console.error(event.error, '| File name:', event.filename.split('/').pop().split('?')[0]);
});
</script>

<style lang="scss">
  html,
  body {
    height: 100%;
  }

  #wrapper {
    height: 100vh;
    position: relative;
    background-color: var(--background);
    color: var(--foreground);
  }

  #window-content {
    display: flex;
    position: relative;
    overflow: hidden;
  }

  #main-content {
    padding: 0;
    justify-content: flex-start;
    height: calc(100vh - #{$excluding-size});
    width: calc(100% - #{$settingbar-width});

    > .columns {
      height: calc(100vh - #{$footer-height});
    }

    .connection-panel-wrapper {
      height: calc(100vh - #{$excluding-size});
      width: 100%;
      padding-top: 0;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      overflow: auto;
    }
  }
</style>
