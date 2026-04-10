import { apiCall } from './httpClient';

export default class {
   // TODO: Replace with @tauri-apps/plugin-dialog
   // static showOpenDialog (options: OpenDialogOptions): Promise<OpenDialogReturnValue> {
   //    return ipcRenderer.invoke('show-open-dialog', options);
   // }

   // TODO: Replace with @tauri-apps/plugin-dialog
   // static showSaveDialog (options: OpenDialogOptions): Promise<OpenDialogReturnValue> {
   //    return ipcRenderer.invoke('show-save-dialog', options);
   // }

   // TODO: Replace with Tauri implementation (no backend route available)
   // static getDownloadPathDirectory (): Promise<string> {
   //    return ipcRenderer.invoke('get-download-dir-path');
   // }

   // TODO: Replace with Tauri implementation
   // static reloadShortcuts () {
   //    return ipcRenderer.invoke('reload-shortcuts');
   // }

   // TODO: Replace with Tauri implementation
   // static updateShortcuts (shortcuts: ShortcutRecord[]) {
   //    return ipcRenderer.invoke('update-shortcuts', shortcuts);
   // }

   // TODO: Replace with Tauri implementation
   // static restoreDefaultShortcuts () {
   //    return ipcRenderer.invoke('resotre-default-shortcuts');
   // }

   // TODO: Replace with Tauri implementation
   // static unregisterShortcuts () {
   //    return ipcRenderer.invoke('unregister-shortcuts');
   // }

   static readFile (params: {filePath: string; encoding: string}): Promise<string> {
      return apiCall('/api/app/readFile', params);
   }

   static writeFile (filePath: string, content: unknown) {
      return apiCall('/api/app/writeFile', { filePath, content });
   }

   // TODO: Replace with @tauri-apps/api/window
   // static closeApp () {
   //    return ipcRenderer.invoke('close-app');
   // }
}
