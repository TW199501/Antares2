import { relaunch } from '@tauri-apps/plugin-process';
import { check } from '@tauri-apps/plugin-updater';

export type UpdaterCallbacks = {
   onStatus: (status: 'noupdate' | 'available' | 'nocheck') => void;
   onDownloadProgress: (percentage: number) => void;
   onDownloaded: () => void;
};

/**
 * Checks for an update and, if found, downloads it automatically.
 * Calls the appropriate callback at each stage.
 */
export async function checkAndDownload (callbacks: UpdaterCallbacks): Promise<void> {
   try {
      const update = await check();

      if (!update) {
         callbacks.onStatus('noupdate');
         return;
      }

      callbacks.onStatus('available');

      let downloaded = 0;
      let contentLength = 0;

      await update.download((event) => {
         switch (event.event) {
            case 'Started':
               contentLength = event.data.contentLength ?? 0;
               break;
            case 'Progress': {
               downloaded += event.data.chunkLength;
               const pct = contentLength > 0
                  ? Number(((downloaded / contentLength) * 100).toFixed(1))
                  : 0;
               callbacks.onDownloadProgress(pct);
               break;
            }
            case 'Finished':
               callbacks.onDownloaded();
               break;
         }
      });
   }
   catch (_err) {
      callbacks.onStatus('nocheck');
   }
}

/**
 * Installs the downloaded update and relaunches the app.
 * Call only when updateStatus === 'downloaded'.
 */
export async function installAndRelaunch (): Promise<void> {
   const update = await check();
   if (update) await update.install();
   await relaunch();
}
