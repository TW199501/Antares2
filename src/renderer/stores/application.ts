import { getVersion } from '@tauri-apps/api/app';
import { Ace } from 'ace-builds';
import { defineStore, storeToRefs } from 'pinia';

import { checkAndDownload, installAndRelaunch } from '@/ipc-api/Updater';
import { loadStore, saveStore } from '@/libs/persistStore';
import { useScratchpadStore } from '@/stores/scratchpad';
import { useSettingsStore } from '@/stores/settings';

export type UpdateStatus = 'noupdate' | 'available' | 'checking' | 'nocheck' | 'downloading' | 'downloaded' | 'disabled' | 'link';

export const useApplicationStore = defineStore('application', {
   state: () => ({
      appName: 'Antares - SQL Client',
      appVersion: '0',
      cachedVersion: '0' as string,
      // Non-persisted state (UI/runtime only)
      isLoading: false,
      isNewModal: false,
      isSettingModal: false,
      isScratchpad: false,
      selectedSettingTab: 'general',
      updateStatus: 'noupdate' as UpdateStatus,
      downloadProgress: 0,
      baseCompleter: [] as Ace.Completer[] // Needed to reset ace editor, due global-only ace completer
   }),
   getters: {
      getBaseCompleter: state => state.baseCompleter,
      getDownloadProgress: state => Number(state.downloadProgress.toFixed(1))
   },
   actions: {
      async init () {
         this.appVersion = await getVersion();
         // Only persist cachedVersion — all other state is runtime/UI only
         const data = await loadStore('settings', {}) as Record<string, any>;
         if (data.cached_version !== undefined) this.cachedVersion = data.cached_version;
      },
      async persistCachedVersion () {
         // Merge into settings store file (same store name as settings.ts uses)
         const existing = await loadStore('settings', {}) as Record<string, any>;
         await saveStore('settings', { ...existing, cached_version: this.cachedVersion });
      },
      checkVersionUpdate () {
         if (this.appVersion !== this.cachedVersion) {
            this.showSettingModal('changelog');
            this.cachedVersion = this.appVersion;
            this.persistCachedVersion();
         }
      },
      setLoadingStatus (payload: boolean) {
         this.isLoading = payload;
      },
      setBaseCompleters (payload: Ace.Completer[]) {
         this.baseCompleter = payload;
      },
      // Modals
      showNewConnModal () {
         this.isNewModal = true;
      },
      hideNewConnModal () {
         this.isNewModal = false;
      },
      showSettingModal (tab: string) {
         this.selectedSettingTab = tab;
         this.isSettingModal = true;
      },
      hideSettingModal () {
         this.isSettingModal = false;
      },
      showScratchpad (tag?: string) {
         this.isScratchpad = true;
         if (!tag) tag = 'all';
         const { selectedTag } = storeToRefs(useScratchpadStore());
         selectedTag.value = tag;
      },
      hideScratchpad () {
         this.isScratchpad = false;
      },
      async checkForUpdates () {
         const { allowPrerelease } = useSettingsStore();
         this.updateStatus = 'checking';
         await checkAndDownload({
            onStatus: (status) => {
               this.updateStatus = status;
            },
            onDownloadProgress: (pct) => {
               this.updateStatus = 'downloading';
               this.downloadProgress = pct;
            },
            onDownloaded: () => {
               this.updateStatus = 'downloaded';
               this.downloadProgress = 100;
            }
         }, { allowPrerelease });
      },
      async installUpdate () {
         try {
            await installAndRelaunch();
         }
         catch (_err) {
            this.updateStatus = 'nocheck';
         }
      }
   }
});
