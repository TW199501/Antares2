/**
 * Tauri IPC shim for browser-based Playwright runs.
 *
 * The renderer calls `invoke('get_sidecar_token')` at boot via the Tauri
 * Internals bridge. In a plain browser that bridge is missing and the
 * renderer fails to register HTTP auth headers. This shim resolves the
 * token to '' (the sidecar's DEV_MODE skips token enforcement) so the
 * renderer can finish booting against `pnpm vite:dev` or `pnpm tauri:dev`.
 */
import type { Page } from '@playwright/test';

export async function installTauriShim (page: Page): Promise<void> {
   await page.addInitScript(() => {
      (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {
         metadata: {
            currentWindow: { label: 'main' },
            currentWebview: { label: 'main', windowLabel: 'main' },
            windows: [{ label: 'main' }],
            webviews: [{ label: 'main', windowLabel: 'main' }]
         },
         invoke: (cmd: string) => {
            if (cmd === 'get_sidecar_token') return Promise.resolve('');
            return Promise.resolve(null);
         },
         transformCallback: (cb: unknown) => cb,
         convertFileSrc: (p: string) => p
      };
   });
}
