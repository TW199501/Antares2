# T9 — Pinia store 第一批（4 個純資料 store）

**對應 PR**：PR5
**前置**：T1 + T2（mock infra）
**目標覆蓋率**：lines ≥ 80% / branches ≥ 65%（warn-only）

## 執行配置（**啟動前必讀**）

| 項目 | 值 |
|------|-----|
| 主 skill | `superpowers:test-driven-development` |
| 副 skill | `vuejs-typescript-best-practices`（Pinia testing patterns） |
| 模型 | **Opus 4.7** |
| Worktree | **禁用** |
| 並行 subagent | 否（4 個 store 互相影響少不值得 dispatch） |
| 詳細政策 | 見 [README 全域執行政策](../../README.md) |

## 範圍

`web/renderer/stores/`：
- `settings.ts`（store id `'settings'`）
- `notifications.ts`（store id `'notifications'`）
- `history.ts`（store id `'history'`）
- `scratchpad.ts`（store id `'scratchpad'`）

這 4 個是「不 call ipc-api」的純資料 store，最容易測。

## 觸碰檔案

### 新增（co-located）
- `web/renderer/stores/settings.test.ts`
- `web/renderer/stores/notifications.test.ts`
- `web/renderer/stores/history.test.ts`
- `web/renderer/stores/scratchpad.test.ts`

## 通用模板

```ts
// web/renderer/stores/settings.test.ts
import { describe, expect, it, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSettingsStore } from './settings';

describe('settings store', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('initializes with defaults', () => {
      const store = useSettingsStore();
      expect(store.applicationTheme).toBeOneOf(['light', 'dark', 'system']);
      expect(store.locale).toBe('en-US'); // 或預設值
   });

   it('persistStore round-trip via localStorage', () => {
      const store = useSettingsStore();
      store.changeTheme('dark');
      // 驗 localStorage 寫入
      const persisted = JSON.parse(localStorage.getItem('settings') ?? '{}');
      expect(persisted.applicationTheme).toBe('dark');

      // 模擬 reload：新 pinia + 新 store
      setActivePinia(createPinia());
      const reloaded = useSettingsStore();
      expect(reloaded.applicationTheme).toBe('dark');
   });

   it('updateShortcut overrides default', () => {
      const store = useSettingsStore();
      store.updateShortcut('run-query', { ctrl: true, key: 'F5' });
      expect(store.shortcuts['run-query']).toEqual({ ctrl: true, key: 'F5' });
   });

   it('resetShortcuts restores defaults', () => {
      const store = useSettingsStore();
      store.updateShortcut('run-query', { ctrl: true, key: 'X' });
      store.resetShortcuts();
      // 驗 shortcuts 回到 common/shortcuts.ts 的預設
   });
});
```

## 各 store 測試重點

### settings
- theme 切換、locale 切換
- shortcuts 自訂與重設
- pageSize / autoComplete / 等 user preferences
- persistStore round-trip
- **不測** `applicationTheme` 對 `<html>` class 的副作用（那在 App.vue 元件測，T14）

### notifications
- add / dismiss / clear
- 數量上限（若有 cap）
- type 分類（info / warn / error）

### history
- query history append、最大長度截斷
- search 過濾
- clear

### scratchpad
- save / load 內容
- multi-tab（若支援）
- 持久化

## 驗收

```bash
pnpm test:unit:run web/renderer/stores/settings.test.ts \
                   web/renderer/stores/notifications.test.ts \
                   web/renderer/stores/history.test.ts \
                   web/renderer/stores/scratchpad.test.ts

pnpm test:coverage --coverage.include='web/renderer/stores/{settings,notifications,history,scratchpad}.ts'
# 目標：≥ 80% lines
```

## 風險

- **store 之間隱性依賴**：例如 settings.shortcuts 被 useShortcutDispatcher 用，但這 4 個 store 之間應該互不依賴。若爆 NPE，spec 執行時 read 後揭露。
- **persistStore 在每個 store 載入時 sync read localStorage**：要在 `beforeEach` 確保 localStorage 已清，T2 setup 已做。

## User 批准語法

「**T9 OK**」
