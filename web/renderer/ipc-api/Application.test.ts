/**
 * Characterization tests for the Application IPC wrapper (T8 / PR4).
 *
 * Locked behavior (verified against current source):
 *   - showOpenDialog: maps the legacy properties[] flags to Tauri open() args
 *     (multiSelections -> multiple, openDirectory -> directory). null result
 *     => { canceled: true, filePaths: [] }; non-null => array-wrap if scalar.
 *   - showSaveDialog: forwards filters + defaultPath. null => canceled.
 *   - getDownloadPathDirectory: pure delegate to @tauri-apps/api/path.downloadDir.
 *   - closeApp: awaits getCurrentWindow().close() — fire-and-forget void.
 *   - reloadShortcuts / unregisterShortcuts / updateShortcuts /
 *     restoreDefaultShortcuts: ALL no-ops (Promise.resolve()) — global shortcut
 *     registration is intentionally not implemented. Shortcuts run via DOM
 *     events, see useShortcutDispatcher.
 *   - readFile / writeFile: pass-through to apiCall.
 */
import { downloadDir } from '@tauri-apps/api/path';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { open as tauriOpen, save as tauriSave } from '@tauri-apps/plugin-dialog';
import { describe, expect, it, vi } from 'vitest';

import { apiCall } from '@/ipc-api/httpClient';

import Application from './Application';

vi.mock('@tauri-apps/plugin-dialog', () => ({
   open: vi.fn(),
   save: vi.fn()
}));

vi.mock('@tauri-apps/api/path', () => ({
   downloadDir: vi.fn(async () => 'C:/Users/Tester/Downloads')
}));

describe('Application.showOpenDialog', () => {
   it('maps multiSelections + openDirectory flags onto tauriOpen and forwards filters', async () => {
      vi.mocked(tauriOpen).mockResolvedValueOnce(['a.sql', 'b.sql']);

      const result = await Application.showOpenDialog({
         properties: ['openFile', 'multiSelections'],
         filters: [{ name: 'SQL', extensions: ['sql'] }]
      });

      expect(tauriOpen).toHaveBeenCalledTimes(1);
      expect(tauriOpen).toHaveBeenCalledWith({
         multiple: true,
         directory: false,
         filters: [{ name: 'SQL', extensions: ['sql'] }]
      });
      expect(result).toEqual({ canceled: false, filePaths: ['a.sql', 'b.sql'] });
   });

   it('treats openDirectory in properties as directory: true', async () => {
      vi.mocked(tauriOpen).mockResolvedValueOnce('/var/data');

      const result = await Application.showOpenDialog({ properties: ['openDirectory'] });

      expect(tauriOpen).toHaveBeenCalledWith({
         multiple: false,
         directory: true,
         filters: undefined
      });
      // scalar string is wrapped in single-element array
      expect(result).toEqual({ canceled: false, filePaths: ['/var/data'] });
   });

   it('returns canceled:true with empty filePaths when tauriOpen resolves null', async () => {
      vi.mocked(tauriOpen).mockResolvedValueOnce(null);

      const result = await Application.showOpenDialog();

      expect(result).toEqual({ canceled: true, filePaths: [] });
   });

   it('defaults multiple/directory to false when no options are provided', async () => {
      vi.mocked(tauriOpen).mockResolvedValueOnce(null);

      await Application.showOpenDialog();

      expect(tauriOpen).toHaveBeenCalledWith({
         multiple: false,
         directory: false,
         filters: undefined
      });
   });
});

describe('Application.showSaveDialog', () => {
   it('forwards filters + defaultPath to tauriSave and returns the picked path', async () => {
      vi.mocked(tauriSave).mockResolvedValueOnce('/tmp/out.csv');

      const result = await Application.showSaveDialog({
         filters: [{ name: 'CSV', extensions: ['csv'] }],
         defaultPath: '/tmp/out.csv'
      });

      expect(tauriSave).toHaveBeenCalledTimes(1);
      expect(tauriSave).toHaveBeenCalledWith({
         filters: [{ name: 'CSV', extensions: ['csv'] }],
         defaultPath: '/tmp/out.csv'
      });
      expect(result).toEqual({ canceled: false, filePath: '/tmp/out.csv' });
   });

   it('returns canceled:true with undefined filePath when tauriSave resolves null', async () => {
      vi.mocked(tauriSave).mockResolvedValueOnce(null);

      const result = await Application.showSaveDialog();

      expect(result).toEqual({ canceled: true, filePath: undefined });
   });
});

describe('Application.getDownloadPathDirectory', () => {
   it('returns whatever @tauri-apps/api/path.downloadDir resolves with', async () => {
      vi.mocked(downloadDir).mockResolvedValueOnce('/home/user/Downloads');

      const result = await Application.getDownloadPathDirectory();

      expect(downloadDir).toHaveBeenCalledTimes(1);
      expect(result).toBe('/home/user/Downloads');
   });
});

describe('Application.closeApp', () => {
   it('awaits getCurrentWindow().close()', async () => {
      const close = vi.fn(async () => {});
      vi.mocked(getCurrentWindow).mockReturnValueOnce({
         close,
         minimize: vi.fn(),
         maximize: vi.fn(),
         unmaximize: vi.fn(),
         isMaximized: vi.fn(async () => false),
         onResized: vi.fn(async () => () => {})
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      await Application.closeApp();

      expect(close).toHaveBeenCalledTimes(1);
   });
});

describe('Application shortcut stubs (intentionally no-ops)', () => {
   it('reloadShortcuts resolves to undefined without side effects', async () => {
      await expect(Application.reloadShortcuts()).resolves.toBeUndefined();
   });

   it('unregisterShortcuts resolves to undefined without side effects', async () => {
      await expect(Application.unregisterShortcuts()).resolves.toBeUndefined();
   });

   it('updateShortcuts ignores its argument and resolves to undefined', async () => {
      // Pass an arbitrary record-shaped value; the wrapper drops it on the floor.
      await expect(
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         Application.updateShortcuts([{ event: 'run-query', keys: ['Ctrl+Enter'] } as any])
      ).resolves.toBeUndefined();
   });

   it('restoreDefaultShortcuts resolves to undefined without side effects', async () => {
      await expect(Application.restoreDefaultShortcuts()).resolves.toBeUndefined();
   });
});

describe('Application.readFile', () => {
   it('forwards the params object to apiCall(/api/app/readFile)', async () => {
      vi.mocked(apiCall).mockResolvedValueOnce({
         status: 'success',
         response: 'SELECT 1'
      });

      const result = await Application.readFile({ filePath: '/x.sql', encoding: 'utf-8' });

      expect(apiCall).toHaveBeenCalledWith('/api/app/readFile', {
         filePath: '/x.sql',
         encoding: 'utf-8'
      });
      // pass-through return value
      expect(result).toEqual({ status: 'success', response: 'SELECT 1' });
   });
});

describe('Application.writeFile', () => {
   it('builds { filePath, content } and forwards to apiCall(/api/app/writeFile)', async () => {
      vi.mocked(apiCall).mockResolvedValueOnce({ status: 'success', response: null });

      await Application.writeFile('/tmp/dump.sql', 'CREATE TABLE t(id INT);');

      expect(apiCall).toHaveBeenCalledWith('/api/app/writeFile', {
         filePath: '/tmp/dump.sql',
         content: 'CREATE TABLE t(id INT);'
      });
   });

   it('passes non-string content (e.g. Buffer-like) through unchanged', async () => {
      vi.mocked(apiCall).mockResolvedValueOnce({ status: 'success', response: null });

      const blob = { type: 'binary', bytes: [1, 2, 3] };
      await Application.writeFile('/tmp/bin.dat', blob);

      expect(apiCall).toHaveBeenCalledWith('/api/app/writeFile', {
         filePath: '/tmp/bin.dat',
         content: blob
      });
   });
});
