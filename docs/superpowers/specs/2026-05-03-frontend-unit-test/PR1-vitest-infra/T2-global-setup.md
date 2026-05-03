# T2 — 全域 setup + helpers

**對應 PR**：PR1
**前置**：T1（vitest config 已建）
**後置阻擋**：T3 sample 起所有測試
**風險等級**：低（純 test infra；mock 邊界錯了會在 T3 sample 立刻發現）

## 執行配置（**啟動前必讀**）

| 項目 | 值 |
|------|-----|
| 主 skill | `superpowers:test-driven-development` |
| 副 skill | — |
| 模型 | **Opus 4.7** |
| Worktree | **禁用** |
| 並行 subagent | 否 |
| 詳細政策 | 見 [README 全域執行政策](../../README.md) |

## 動作摘要

新增 `tests/setup.ts` 全域 mock 底座 + 兩個 helper（`mountWithPinia` / `mountComposable`）。所有測試自動繼承 setup（vitest.config.ts 已指 `setupFiles: ['tests/setup.ts']`）。

## 觸碰檔案清單

### 新增
- `tests/setup.ts`
- `tests/setup.test.ts`（驗 setup 自身）
- `tests/helpers/mountWithPinia.ts`
- `tests/helpers/mountComposable.ts`

### 不變
- 任何 source code

## 具體內容

### 1. `tests/setup.ts`（完整內容）

```ts
import { afterEach, beforeEach, vi } from 'vitest';

// ─────────────────────────────────────
// Polyfills (Reka UI 必需)
// ─────────────────────────────────────
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
vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
   matches: false,
   media: query,
   onchange: null,
   addListener: vi.fn(),
   removeListener: vi.fn(),
   addEventListener: vi.fn(),
   removeEventListener: vi.fn(),
   dispatchEvent: vi.fn()
})));

// happy-dom KeyboardEvent 缺 getModifierState() 的 fallback
if (typeof KeyboardEvent !== 'undefined' && !KeyboardEvent.prototype.getModifierState) {
   (KeyboardEvent.prototype as unknown as { getModifierState: (k: string) => boolean })
      .getModifierState = function (this: KeyboardEvent, key: string) {
         if (key === 'Control') return this.ctrlKey;
         if (key === 'Alt') return this.altKey;
         if (key === 'Shift') return this.shiftKey;
         if (key === 'Meta') return this.metaKey;
         return false;
      };
}

// ─────────────────────────────────────
// Mock @tauri-apps/api/* (5 檔引用)
// ─────────────────────────────────────
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

// ─────────────────────────────────────
// Mock @/ipc-api/httpClient (15 檔引用)
// ─────────────────────────────────────
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

// ─────────────────────────────────────
// Mock @/i18n (identity stub — 不全載 JSON)
// ─────────────────────────────────────
vi.mock('@/i18n', () => ({
   i18n: {
      global: {
         t: (k: string) => k,
         locale: { value: 'en-US' },
         availableLocales: ['en-US', 'ja-JP', 'zh-CN', 'zh-TW', 'ko-KR']
      }
   }
}));

// vue-i18n 在 component 中用 useI18n() 也要 mock
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

// ─────────────────────────────────────
// 每個測試前重置狀態
// ─────────────────────────────────────
beforeEach(() => {
   vi.clearAllMocks();
   localStorage.clear();
   sessionStorage.clear();
});

afterEach(() => {
   vi.restoreAllMocks();
});
```

### 2. `tests/helpers/mountWithPinia.ts`（完整內容）

```ts
import { mount, type MountingOptions } from '@vue/test-utils';
import { createTestingPinia, type TestingPinia } from '@pinia/testing';
import type { Component } from 'vue';
import { vi } from 'vitest';

export interface MountWithPiniaOptions<T> extends Omit<MountingOptions<T>, 'global'> {
   /** 灌相依 store 預設值，避免 cross-store 初始化 race */
   initialState?: Record<string, unknown>;
   /** 是否 stub actions（預設 false：actions 真跑）*/
   stubActions?: boolean;
   /** 額外 global plugins / provide / mocks */
   global?: MountingOptions<T>['global'];
}

export function mountWithPinia<T extends Component> (
   component: T,
   options: MountWithPiniaOptions<T> = {}
) {
   const { initialState, stubActions = false, global, ...rest } = options;

   const pinia: TestingPinia = createTestingPinia({
      initialState,
      stubActions,
      createSpy: vi.fn
   });

   return mount(component, {
      ...rest,
      global: {
         ...global,
         plugins: [pinia, ...(global?.plugins ?? [])]
      }
   });
}
```

### 3. `tests/helpers/mountComposable.ts`（完整內容）

```ts
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { vi } from 'vitest';

/**
 * 把 composable 包進 dummy component 跑，回傳 (composableResult, wrapper)
 * 用法：
 *   const [{ count, increment }, wrapper] = mountComposable(() => useCounter())
 */
export function mountComposable<T> (setup: () => T): [T, ReturnType<typeof mount>] {
   let result: T = undefined as unknown as T;
   const Comp = defineComponent({
      setup () {
         result = setup();
         return () => h('div');
      }
   });
   const wrapper = mount(Comp, {
      global: {
         plugins: [createTestingPinia({ createSpy: vi.fn })]
      }
   });
   return [result, wrapper];
}
```

### 4. `tests/setup.test.ts`（smoke 驗 setup 自身）

```ts
import { describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { apiCall } from '@/ipc-api/httpClient';
import { i18n } from '@/i18n';

describe('global setup', () => {
   it('polyfills IntersectionObserver / ResizeObserver / matchMedia', () => {
      expect(typeof IntersectionObserver).toBe('function');
      expect(typeof ResizeObserver).toBe('function');
      expect(typeof matchMedia).toBe('function');
      expect(matchMedia('(prefers-color-scheme: dark)').matches).toBe(false);
   });

   it('mocks @tauri-apps/api/core invoke', async () => {
      expect(vi.isMockFunction(invoke)).toBe(true);
      await invoke('whatever');
      expect(invoke).toHaveBeenCalledWith('whatever');
   });

   it('mocks @/ipc-api/httpClient apiCall', async () => {
      expect(vi.isMockFunction(apiCall)).toBe(true);
      const res = await apiCall('test/route', { foo: 1 });
      expect(apiCall).toHaveBeenCalledWith('test/route', { foo: 1 });
      expect(res).toEqual({ status: 'success', response: null });
   });

   it('stubs i18n.t() to identity', () => {
      expect(i18n.global.t('connection.add')).toBe('connection.add');
   });

   it('clears localStorage between tests', () => {
      localStorage.setItem('foo', 'bar');
      expect(localStorage.getItem('foo')).toBe('bar');
      // beforeEach 會清掉，下個 it 開始時 localStorage 應該空
   });

   it('previous test localStorage 應該被清掉', () => {
      expect(localStorage.getItem('foo')).toBeNull();
   });

   it('KeyboardEvent.getModifierState() polyfill works', () => {
      const ev = new KeyboardEvent('keydown', { key: 'a', ctrlKey: true });
      expect(ev.getModifierState('Control')).toBe(true);
      expect(ev.getModifierState('Shift')).toBe(false);
   });
});
```

## 驗收命令

```bash
# 1. 跑 setup smoke
pnpm test:unit:run tests/setup.test.ts
# 預期：7 個 test 全綠

# 2. 跑全部單元測試（此時只有 setup.test.ts）
pnpm test:unit:run

# 3. helper 自身能 import（type-check）
pnpm type-check
```

## 風險與 rollback

### 風險
- **`vi.mock` 順序問題**：vi.mock 是 hoisted；在 `tests/setup.ts` 寫的 mock 會 override 任何 source code 的 import。若 setup.ts 內有 syntax error，**所有測試都會掛**。**驗收**：`tests/setup.test.ts` 跑得起來 = setup.ts 沒 syntax error。
- **vue-i18n mock 與真實 createI18n 衝突**：若有測試需要真實 i18n（不太可能），要在該測試內 `vi.unmock('vue-i18n')`。
- **`@pinia/testing` peer dep**：對 pinia@3.x 的支援，若 pnpm 安裝爆 peer warning，加 `pnpm.overrides`。
- **happy-dom 對 `<dialog>` element 支援不完整**：Reka Dialog 在 happy-dom 可能渲染不對。T12 若遇到，fallback 改 jsdom 或用 modal-only 模式。

### Rollback
```bash
git checkout -- tests/
rm -rf tests/
git checkout -- vitest.config.ts  # 還原 setupFiles 設定
```

## Out of scope

- 不寫任何 source 旁的 .test.ts（在 T3 之後）
- 不寫 `tests/fixtures/`（在 T7）
- 不寫 generator helper（在 T11/T12 spec 還沒拆 generator，本 plan 已砍）

## User 批准語法

「**T2 OK**」/「**T2 改成 XXX**」（特別注意：mock 對象清單、polyfill 範圍、beforeEach 清理時機）
