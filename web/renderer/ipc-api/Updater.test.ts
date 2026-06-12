/**
 * Characterization tests for the Updater IPC wrapper (T8 / PR4).
 *
 * Locked behavior (verified against current source):
 *   - checkAndDownload() wraps tauri-plugin-updater. It DOES NOT use apiCall;
 *     callbacks (onStatus/onDownloadProgress/onDownloaded) are the only
 *     signal channel.
 *   - When check() resolves null  -> onStatus('noupdate'), early return.
 *   - When check() resolves an Update -> onStatus('available'), then drives
 *     update.download() which emits Started/Progress/Finished events.
 *     'Finished' triggers onDownloaded() (no automatic install).
 *   - Per CLAUDE.md release section: the updater plugin is NOT registered in
 *     src-tauri/src/lib.rs (intentionally — no signing keypair yet). check()
 *     therefore throws at runtime. The wrapper has try/catch that maps any
 *     error to onStatus('nocheck') so the UI stays a graceful no-op.
 *   - installAndRelaunch(): re-runs check(), invokes update.install() if
 *     present, then unconditionally relaunch(). No try/catch here — errors
 *     propagate (caller is expected to gate on updateStatus === 'downloaded').
 */
import { relaunch } from '@tauri-apps/plugin-process';
import { check } from '@tauri-apps/plugin-updater';
import { describe, expect, it, vi } from 'vitest';

import { checkAndDownload, installAndRelaunch } from './Updater';

vi.mock('@tauri-apps/plugin-updater', () => ({
   check: vi.fn()
}));
vi.mock('@tauri-apps/plugin-process', () => ({
   relaunch: vi.fn(async () => {})
}));

describe('Updater.checkAndDownload — graceful fallback', () => {
   it('emits onStatus("nocheck") when the updater plugin is not registered (CLAUDE.md release section)', async () => {
      // Tauri throws something like "plugin updater not registered" when
      // tauri.conf.json has no plugins.updater block.
      vi.mocked(check).mockRejectedValueOnce(new Error('plugin updater not registered'));

      const callbacks = {
         onStatus: vi.fn(),
         onDownloadProgress: vi.fn(),
         onDownloaded: vi.fn()
      };

      await checkAndDownload(callbacks);

      expect(callbacks.onStatus).toHaveBeenCalledTimes(1);
      expect(callbacks.onStatus).toHaveBeenCalledWith('nocheck');
      expect(callbacks.onDownloadProgress).not.toHaveBeenCalled();
      expect(callbacks.onDownloaded).not.toHaveBeenCalled();
   });

   it('also catches non-Error throws (string rejections, undefined) and still emits "nocheck"', async () => {
      vi.mocked(check).mockRejectedValueOnce('boom');

      const callbacks = {
         onStatus: vi.fn(),
         onDownloadProgress: vi.fn(),
         onDownloaded: vi.fn()
      };

      await checkAndDownload(callbacks);

      expect(callbacks.onStatus).toHaveBeenCalledWith('nocheck');
   });
});

describe('Updater.checkAndDownload — no update available', () => {
   it('emits onStatus("noupdate") when check() resolves null', async () => {
      vi.mocked(check).mockResolvedValueOnce(null);

      const callbacks = {
         onStatus: vi.fn(),
         onDownloadProgress: vi.fn(),
         onDownloaded: vi.fn()
      };

      await checkAndDownload(callbacks);

      expect(callbacks.onStatus).toHaveBeenCalledTimes(1);
      expect(callbacks.onStatus).toHaveBeenCalledWith('noupdate');
      expect(callbacks.onDownloadProgress).not.toHaveBeenCalled();
      expect(callbacks.onDownloaded).not.toHaveBeenCalled();
   });
});

describe('Updater.checkAndDownload — update available', () => {
   it('emits onStatus("available") then drives the download progress callback through Started/Progress/Finished', async () => {
      // Stub Update — we only care about the .download(handler) shape.
      const download = vi.fn(async (handler: (e: unknown) => void) => {
         handler({ event: 'Started', data: { contentLength: 1000 } });
         handler({ event: 'Progress', data: { chunkLength: 250 } });
         handler({ event: 'Progress', data: { chunkLength: 500 } });
         handler({ event: 'Finished', data: {} });
      });
      vi.mocked(check).mockResolvedValueOnce({
         download,
         install: vi.fn(),
         version: '9.9.9'
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const callbacks = {
         onStatus: vi.fn(),
         onDownloadProgress: vi.fn(),
         onDownloaded: vi.fn()
      };

      await checkAndDownload(callbacks);

      expect(callbacks.onStatus).toHaveBeenCalledWith('available');
      // 250/1000 = 25%, then (250+500)/1000 = 75%
      expect(callbacks.onDownloadProgress).toHaveBeenNthCalledWith(1, 25);
      expect(callbacks.onDownloadProgress).toHaveBeenNthCalledWith(2, 75);
      expect(callbacks.onDownloaded).toHaveBeenCalledTimes(1);
   });

   it('reports 0% progress when the Started event reports a missing/zero contentLength', async () => {
      const download = vi.fn(async (handler: (e: unknown) => void) => {
         handler({ event: 'Started', data: { contentLength: undefined } });
         handler({ event: 'Progress', data: { chunkLength: 100 } });
      });
      vi.mocked(check).mockResolvedValueOnce({
         download,
         install: vi.fn(),
         version: '9.9.9'
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const callbacks = {
         onStatus: vi.fn(),
         onDownloadProgress: vi.fn(),
         onDownloaded: vi.fn()
      };

      await checkAndDownload(callbacks);

      // Source: `contentLength > 0 ? ... : 0`
      expect(callbacks.onDownloadProgress).toHaveBeenCalledWith(0);
   });

   it('rounds progress percentage to one decimal place via toFixed(1)', async () => {
      const download = vi.fn(async (handler: (e: unknown) => void) => {
         handler({ event: 'Started', data: { contentLength: 333 } });
         handler({ event: 'Progress', data: { chunkLength: 100 } });
      });
      vi.mocked(check).mockResolvedValueOnce({
         download,
         install: vi.fn(),
         version: '9.9.9'
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const callbacks = {
         onStatus: vi.fn(),
         onDownloadProgress: vi.fn(),
         onDownloaded: vi.fn()
      };

      await checkAndDownload(callbacks);

      // 100/333 = 30.030030...% -> Number('30.0') === 30
      expect(callbacks.onDownloadProgress).toHaveBeenCalledWith(30);
   });

   it('treats _options.allowPrerelease as advisory only — never affects the call to check()', async () => {
      vi.mocked(check).mockResolvedValueOnce(null);

      const callbacks = {
         onStatus: vi.fn(),
         onDownloadProgress: vi.fn(),
         onDownloaded: vi.fn()
      };

      await checkAndDownload(callbacks, { allowPrerelease: true });

      // check() takes no args in tauri-plugin-updater v2
      expect(check).toHaveBeenCalledWith();
   });
});

describe('Updater.installAndRelaunch', () => {
   it('calls update.install() and then relaunch() when an update is present', async () => {
      const install = vi.fn(async () => {});
      vi.mocked(check).mockResolvedValueOnce({
         install,
         download: vi.fn(),
         version: '9.9.9'
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      await installAndRelaunch();

      expect(install).toHaveBeenCalledTimes(1);
      expect(relaunch).toHaveBeenCalledTimes(1);
   });

   it('still calls relaunch() even when check() returns null (skips install but always relaunches)', async () => {
      vi.mocked(check).mockResolvedValueOnce(null);

      await installAndRelaunch();

      expect(relaunch).toHaveBeenCalledTimes(1);
   });

   it('propagates errors from check() (no try/catch in installAndRelaunch)', async () => {
      vi.mocked(check).mockRejectedValueOnce(new Error('plugin not registered'));

      await expect(installAndRelaunch()).rejects.toThrow('plugin not registered');
      expect(relaunch).not.toHaveBeenCalled();
   });
});
