# T6 — composables 測試（5 個）

**對應 PR**：PR2
**前置**：T1 + T2
**目標覆蓋率**：lines ≥ 85% / branches ≥ 70%（warn-only）

## 執行配置（**啟動前必讀**）

| 項目 | 值 |
|------|-----|
| 主 skill | `superpowers:test-driven-development` |
| 副 skill | `vuejs-typescript-best-practices`（composition API testing patterns） |
| 模型 | **Opus 4.7** |
| Worktree | **禁用** |
| 並行 subagent | 否（5 個太少且彼此可能共享 mock setup） |
| 詳細政策 | 見 [README 全域執行政策](../../README.md) |

## 範圍

`web/renderer/composables/`：
- `useFocusTrap.ts`
- `useFilters.ts`
- `useResultTables.ts`
- `useShortcutDispatcher.ts`（**跨層 sample，最重要**）
- `useQueryExecution.ts`

## 共通：用 `mountComposable` helper

```ts
import { mountComposable } from '../../tests/helpers/mountComposable';
import { useCounter } from './useCounter';

const [{ count, increment }] = mountComposable(() => useCounter());
expect(count.value).toBe(0);
increment();
expect(count.value).toBe(1);
```

## 重點 1：useShortcutDispatcher（跨層）

這支同時依賴 `settings` store + `common/shortcuts`，是整個測試底盤的「跨層連通驗證」。

```ts
// web/renderer/composables/useShortcutDispatcher.test.ts
import { describe, expect, it, vi } from 'vitest';
import { useShortcutDispatcher } from './useShortcutDispatcher';
import { mountComposable } from '../../tests/helpers/mountComposable';

describe('useShortcutDispatcher', () => {
   it('dispatches antares:run-query on Ctrl+R', () => {
      const spy = vi.fn();
      window.addEventListener('antares:run-query', spy);

      mountComposable(() => useShortcutDispatcher());
      window.dispatchEvent(new KeyboardEvent('keydown', {
         key: 'r',
         code: 'KeyR',
         ctrlKey: true,
         bubbles: true
      }));

      expect(spy).toHaveBeenCalledTimes(1);
      window.removeEventListener('antares:run-query', spy);
   });

   it('respects user-customized shortcut from settings store', () => {
      const spy = vi.fn();
      window.addEventListener('antares:run-query', spy);

      mountComposable(() => useShortcutDispatcher());
      // 假設 user 把 run-query 改成 F5（用 testingPinia initialState 灌入）
      // 此測試需 mountComposable 接受 initialState；helper 已設計支援
      // 詳細做法 spec 執行時 read store 結構後決定

      // dispatchEvent F5 → spy 被叫
   });

   it('ignores keydown when modifier mismatch', () => {
      const spy = vi.fn();
      window.addEventListener('antares:run-query', spy);

      mountComposable(() => useShortcutDispatcher());
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' /* 沒 ctrl */ }));

      expect(spy).not.toHaveBeenCalled();
   });

   it('cleans up window listener on unmount', () => {
      const [, wrapper] = mountComposable(() => useShortcutDispatcher());
      const spy = vi.fn();
      window.addEventListener('antares:run-query', spy);

      wrapper.unmount();
      window.dispatchEvent(new KeyboardEvent('keydown', {
         key: 'r', ctrlKey: true
      }));

      expect(spy).not.toHaveBeenCalled();
   });
});
```

## 重點 2：useFocusTrap

```ts
describe('useFocusTrap', () => {
   it('traps Tab inside container', async () => {
      // 建一個有 3 個 button 的容器，啟用 focus trap
      // Tab 從第三個按下去 → focus 應回到第一個
      // Shift+Tab 從第一個 → focus 應到第三個
   });

   it('releases trap on disable / unmount', async () => {
      // disable 後 Tab 行為恢復正常
   });
});
```

## 重點 3：useFilters

純資料邏輯，預期測 filter chain combine、edge case：

```ts
describe('useFilters', () => {
   it('combines AND filters', () => { /* */ });
   it('combines OR filters', () => { /* */ });
   it('handles empty filter list', () => { /* */ });
   it('serializes to URL query string', () => { /* */ });
});
```

## 重點 4：useResultTables / useQueryExecution

這兩支會 call `apiCall`（已在 T2 全域 mock），測重點：
- 正常 query → 解 result rows / columns
- error → 顯示 error 狀態
- cancel mid-query → 不更新結果
- pagination 交互

具體測試列表 spec 執行時 read 實作後給。

## 驗收

```bash
pnpm test:unit:run web/renderer/composables/
pnpm test:coverage --coverage.include='web/renderer/composables/**'
# 目標：≥ 85% lines
```

## 風險

- **happy-dom KeyboardEvent.code 缺**：`useShortcutDispatcher` 若用 `event.code`（KeyR）而非 `event.key`（r），happy-dom 可能不填。**驗收**：T2 setup 已加 polyfill；若仍爆，加 `code: 'KeyR'` 在 KeyboardEvent init。
- **`document.activeElement` 在 happy-dom**：useFocusTrap 依賴此 API；happy-dom 應支援，若爆 fallback 用 `wrapper.find().element` 直接呼叫 `.focus()` 並斷言 `document.activeElement === el`。

## User 批准語法

「**T6 OK**」
