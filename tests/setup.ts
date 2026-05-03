/**
 * Vitest global setup — loaded by every test via vitest.config.ts setupFiles.
 *
 * Responsibilities:
 *   1. DOM polyfills (defense-in-depth — happy-dom 20.x has these built-in,
 *      but we re-stub so a downgrade or jsdom fallback keeps tests green)
 *   2. Module-level mocks for: @tauri-apps/api/*, @/ipc-api/httpClient, @/i18n
 *   3. Per-test cleanup: clearAllMocks + restoreAllMocks + storage.clear()
 */
import { afterEach, beforeEach, vi } from 'vitest';

// ─────────────────────────────────────────────────────────────────
// 1. DOM polyfills (Reka UI Popover/Combobox/Dialog/Tooltip require these)
// ─────────────────────────────────────────────────────────────────
class MockResizeObserver {
   observe = vi.fn();
   unobserve = vi.fn();
   disconnect = vi.fn();
}

class MockIntersectionObserver {
   readonly root = null;
   readonly rootMargin = '';
   readonly thresholds: ReadonlyArray<number> = [];
   observe = vi.fn();
   unobserve = vi.fn();
   disconnect = vi.fn();
   takeRecords = vi.fn(() => []);
}

vi.stubGlobal('ResizeObserver', MockResizeObserver);
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
vi.stubGlobal(
   'matchMedia',
   vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
   }))
);

// happy-dom KeyboardEvent.getModifierState() polyfill (idempotent)
if (
   typeof KeyboardEvent !== 'undefined' &&
   !KeyboardEvent.prototype.getModifierState
) {
   (
      KeyboardEvent.prototype as unknown as {
         getModifierState: (k: string) => boolean;
      }
   ).getModifierState = function (this: KeyboardEvent, key: string) {
      if (key === 'Control') return this.ctrlKey;
      if (key === 'Alt') return this.altKey;
      if (key === 'Shift') return this.shiftKey;
      if (key === 'Meta') return this.metaKey;
      return false;
   };
}

// ─────────────────────────────────────────────────────────────────
// 2. Module mocks
// ─────────────────────────────────────────────────────────────────

// 2a. @tauri-apps/api/* — 5 renderer files import from these surfaces
vi.mock('@tauri-apps/api/core', () => ({
   invoke: vi.fn(async (_cmd: string) => undefined)
}));
vi.mock('@tauri-apps/api/event', () => ({
   listen: vi.fn(async () => () => {}),
   emit: vi.fn(async () => {}),
   once: vi.fn(async () => () => {})
}));
vi.mock('@tauri-apps/api/window', () => ({
   getCurrentWindow: vi.fn(() => ({
      minimize: vi.fn(),
      maximize: vi.fn(),
      unmaximize: vi.fn(),
      close: vi.fn(),
      isMaximized: vi.fn(async () => false),
      onResized: vi.fn(async () => () => {})
   }))
}));
vi.mock('@tauri-apps/plugin-fs', () => ({
   readTextFile: vi.fn(async () => ''),
   writeTextFile: vi.fn(async () => {}),
   exists: vi.fn(async () => false)
}));
vi.mock('@tauri-apps/plugin-os', () => ({
   platform: vi.fn(async () => 'windows'),
   version: vi.fn(async () => '10.0.26100')
}));

// 2b. @/ipc-api/httpClient — 15 files import this
vi.mock('@/ipc-api/httpClient', () => ({
   apiCall: vi.fn(async () => ({ status: 'success', response: null })),
   createWebSocket: vi.fn(() => ({
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
      readyState: 1
   })),
   getSidecarPort: vi.fn(() => 5555),
   setSidecarPort: vi.fn(),
   setNoConnectionHandler: vi.fn()
}));

// 2c. @/i18n — identity stub so component snapshots don't depend on locale JSON
vi.mock('@/i18n', () => ({
   i18n: {
      global: {
         t: (k: string) => k,
         locale: { value: 'en-US' },
         availableLocales: ['en-US', 'ja-JP', 'zh-CN', 'zh-TW', 'ko-KR']
      }
   }
}));

// 2d. vue-i18n useI18n() — also identity for components using composition API
vi.mock('vue-i18n', async (orig) => {
   const actual = await orig<typeof import('vue-i18n')>();
   return {
      ...actual,
      useI18n: () => ({
         t: (k: string) => k,
         locale: { value: 'en-US' },
         availableLocales: ['en-US', 'ja-JP', 'zh-CN', 'zh-TW', 'ko-KR']
      })
   };
});

// ─────────────────────────────────────────────────────────────────
// 3. Per-test cleanup
// ─────────────────────────────────────────────────────────────────
beforeEach(() => {
   vi.clearAllMocks();
   localStorage.clear();
   sessionStorage.clear();
});

afterEach(() => {
   vi.restoreAllMocks();
});
