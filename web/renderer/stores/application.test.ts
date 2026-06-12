/**
 * application store — Pinia store tests (T10 / PR5).
 *
 * Tested behaviors:
 *   - Default state shape (modal flags off, updateStatus 'noupdate', etc.)
 *   - init() pulls cached_version from the persisted 'settings' store
 *   - checkVersionUpdate() opens the changelog modal exactly when appVersion != cachedVersion
 *   - Modal/UI flag setters: showSettingModal / hideSettingModal / showSpecsnap / hideSpecsnap
 *   - checkForUpdates(): drives Updater callbacks → updateStatus + downloadProgress
 *   - checkForUpdates() graceful fallback: when plugin is not registered, the
 *     Updater wrapper internally maps the error to onStatus('nocheck') (per
 *     CLAUDE.md release section). Store stays a graceful no-op.
 *   - installUpdate() sets updateStatus='nocheck' on error (try/catch on store)
 */
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { checkAndDownload, installAndRelaunch, type UpdaterCallbacks } from '@/ipc-api/Updater';
import { saveStore } from '@/libs/persistStore';

import { useApplicationStore } from './application';

vi.mock('@tauri-apps/api/app', () => ({
   getVersion: vi.fn(async () => '1.2.3')
}));

vi.mock('@/ipc-api/Updater', () => ({
   checkAndDownload: vi.fn(),
   installAndRelaunch: vi.fn()
}));

describe('application store — defaults & getters', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('starts with the documented default state', () => {
      const store = useApplicationStore();
      expect(store.appName).toBe('Antares - SQL Client');
      expect(store.appVersion).toBe('0');
      expect(store.cachedVersion).toBe('0');
      expect(store.isLoading).toBe(false);
      expect(store.isNewModal).toBe(false);
      expect(store.isSettingModal).toBe(false);
      expect(store.isScratchpad).toBe(false);
      expect(store.isSpecsnap).toBe(false);
      expect(store.selectedSettingTab).toBe('general');
      expect(store.updateStatus).toBe('noupdate');
      expect(store.downloadProgress).toBe(0);
      expect(store.baseCompleter).toEqual([]);
   });

   it('getDownloadProgress rounds via toFixed(1)', () => {
      const store = useApplicationStore();
      store.downloadProgress = 33.3333;
      expect(store.getDownloadProgress).toBe(33.3);
   });

   it('getBaseCompleter reflects the array set via setBaseCompleters', () => {
      const store = useApplicationStore();
      const fn = () => {};
      const completers = [{ getCompletions: fn }] as unknown as typeof store.baseCompleter;
      store.setBaseCompleters(completers);
      // Pinia reactivity wraps the array in a Proxy; identity checks fail by design.
      expect(store.getBaseCompleter).toHaveLength(1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((store.getBaseCompleter[0] as any).getCompletions).toBe(fn);
   });
});

describe('application store — init() & version persistence', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
      vi.clearAllMocks();
   });

   it('loads cached_version from the persisted settings store', async () => {
      await saveStore('settings', { cached_version: '1.0.0' });
      const store = useApplicationStore();
      await store.init();
      expect(store.appVersion).toBe('1.2.3');
      expect(store.cachedVersion).toBe('1.0.0');
   });

   it('keeps cachedVersion default when storage is empty', async () => {
      const store = useApplicationStore();
      await store.init();
      expect(store.cachedVersion).toBe('0');
   });
});

describe('application store — checkVersionUpdate()', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('opens the changelog modal and persists the new version when versions differ', () => {
      const store = useApplicationStore();
      store.appVersion = '1.2.3';
      store.cachedVersion = '1.1.0';

      store.checkVersionUpdate();

      expect(store.isSettingModal).toBe(true);
      expect(store.selectedSettingTab).toBe('changelog');
      expect(store.cachedVersion).toBe('1.2.3');
   });

   it('does not open the modal when versions match (idempotent)', () => {
      const store = useApplicationStore();
      store.appVersion = '1.2.3';
      store.cachedVersion = '1.2.3';

      store.checkVersionUpdate();

      expect(store.isSettingModal).toBe(false);
   });
});

describe('application store — modal & UI flag setters', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('showSettingModal sets the tab and flips the flag, hideSettingModal flips it back', () => {
      const store = useApplicationStore();
      store.showSettingModal('shortcuts');
      expect(store.isSettingModal).toBe(true);
      expect(store.selectedSettingTab).toBe('shortcuts');

      store.hideSettingModal();
      expect(store.isSettingModal).toBe(false);
   });

   it('showNewConnModal / hideNewConnModal toggle isNewModal', () => {
      const store = useApplicationStore();
      store.showNewConnModal();
      expect(store.isNewModal).toBe(true);
      store.hideNewConnModal();
      expect(store.isNewModal).toBe(false);
   });

   it('showSpecsnap / hideSpecsnap toggle isSpecsnap', () => {
      const store = useApplicationStore();
      store.showSpecsnap();
      expect(store.isSpecsnap).toBe(true);
      store.hideSpecsnap();
      expect(store.isSpecsnap).toBe(false);
   });

   it('setLoadingStatus mirrors its boolean argument', () => {
      const store = useApplicationStore();
      store.setLoadingStatus(true);
      expect(store.isLoading).toBe(true);
      store.setLoadingStatus(false);
      expect(store.isLoading).toBe(false);
   });
});

describe('application store — checkForUpdates()', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
      vi.clearAllMocks();
   });

   it('happy path: drives onStatus("available") then onDownloadProgress then onDownloaded', async () => {
      vi.mocked(checkAndDownload).mockImplementationOnce(async (cbs: UpdaterCallbacks) => {
         cbs.onStatus('available');
         cbs.onDownloadProgress(42);
         cbs.onDownloaded();
      });

      const store = useApplicationStore();
      await store.checkForUpdates();

      // Final state observed after all callbacks fire:
      expect(store.updateStatus).toBe('downloaded');
      expect(store.downloadProgress).toBe(100);
   });

   it('flips updateStatus="checking" before delegating to the wrapper', async () => {
      let observedStatus: string | undefined;
      vi.mocked(checkAndDownload).mockImplementationOnce(async () => {
         // Read the store status as observed by the wrapper at invocation time.
         const store = useApplicationStore();
         observedStatus = store.updateStatus;
      });

      const store = useApplicationStore();
      await store.checkForUpdates();

      expect(observedStatus).toBe('checking');
   });

   it('graceful fallback: wrapper emits onStatus("nocheck") when updater plugin is not registered', async () => {
      vi.mocked(checkAndDownload).mockImplementationOnce(async (cbs: UpdaterCallbacks) => {
         // Per CLAUDE.md: the wrapper's try/catch maps any check() error to 'nocheck'.
         cbs.onStatus('nocheck');
      });

      const store = useApplicationStore();
      await store.checkForUpdates();

      expect(store.updateStatus).toBe('nocheck');
   });

   it('progress callback flips status to "downloading" while updating downloadProgress', async () => {
      vi.mocked(checkAndDownload).mockImplementationOnce(async (cbs: UpdaterCallbacks) => {
         cbs.onDownloadProgress(25);
      });

      const store = useApplicationStore();
      await store.checkForUpdates();

      expect(store.updateStatus).toBe('downloading');
      expect(store.downloadProgress).toBe(25);
   });
});

describe('application store — installUpdate()', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
      vi.clearAllMocks();
   });

   it('delegates to installAndRelaunch on the happy path (no status change)', async () => {
      vi.mocked(installAndRelaunch).mockResolvedValueOnce();

      const store = useApplicationStore();
      store.updateStatus = 'downloaded';
      await store.installUpdate();

      expect(installAndRelaunch).toHaveBeenCalledTimes(1);
      // Source has no success-path mutation; status stays 'downloaded'.
      expect(store.updateStatus).toBe('downloaded');
   });

   it('flips updateStatus to "nocheck" when installAndRelaunch throws', async () => {
      vi.mocked(installAndRelaunch).mockRejectedValueOnce(new Error('plugin not registered'));

      const store = useApplicationStore();
      store.updateStatus = 'downloaded';
      await store.installUpdate();

      expect(store.updateStatus).toBe('nocheck');
   });
});
