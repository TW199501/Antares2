import { downloadDir } from '@tauri-apps/api/path';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open as tauriOpen, save as tauriSave } from '@tauri-apps/plugin-dialog';
import { ShortcutRecord } from 'common/shortcuts';

import { apiCall } from './httpClient';

export default class {
   static async showOpenDialog (options: {
      properties?: ('openFile' | 'openDirectory' | 'multiSelections')[];
      filters?: { name: string; extensions: string[] }[];
   } = {}): Promise<{ canceled: boolean; filePaths: string[] }> {
      const result = await tauriOpen({
         multiple: options.properties?.includes('multiSelections') ?? false,
         directory: options.properties?.includes('openDirectory') ?? false,
         filters: options.filters
      });
      if (result === null) return { canceled: true, filePaths: [] };
      const filePaths = Array.isArray(result) ? result : [result];
      return { canceled: false, filePaths };
   }

   static async showSaveDialog (options: {
      filters?: { name: string; extensions: string[] }[];
      defaultPath?: string;
   } = {}): Promise<{ canceled: boolean; filePath: string | undefined }> {
      const result = await tauriSave({
         filters: options.filters,
         defaultPath: options.defaultPath
      });
      if (result === null) return { canceled: true, filePath: undefined };
      return { canceled: false, filePath: result };
   }

   static getDownloadPathDirectory (): Promise<string> {
      return downloadDir();
   }

   static async closeApp (): Promise<void> {
      await getCurrentWindow().close();
   }

   // Shortcut methods: global shortcut registration is not implemented in this runtime.
   // Keyboard shortcuts are handled via DOM events in KeyPressDetector.vue.
   // Shortcut settings are persisted via the settings Pinia store (localStorage).
   static reloadShortcuts (): Promise<void> {
      return Promise.resolve();
   }

   static unregisterShortcuts (): Promise<void> {
      return Promise.resolve();
   }

   // eslint-disable-next-line @typescript-eslint/no-unused-vars
   static updateShortcuts (_shortcuts: ShortcutRecord[]): Promise<void> {
      return Promise.resolve();
   }

   static restoreDefaultShortcuts (): Promise<void> {
      return Promise.resolve();
   }

   static readFile (params: {filePath: string; encoding: string}): Promise<string> {
      return apiCall('/api/app/readFile', params);
   }

   static writeFile (filePath: string, content: unknown) {
      return apiCall('/api/app/writeFile', { filePath, content });
   }
}
