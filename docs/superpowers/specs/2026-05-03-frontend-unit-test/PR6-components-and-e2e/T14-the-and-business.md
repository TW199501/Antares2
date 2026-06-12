# T14 — The\* layout + 業務元件高 ROI（5-10 個）

**對應 PR**：PR6
**前置**：T1 + T2 + T9-T11（store mock 已建）
**目標覆蓋率**：lines ≥ 40% / branches ≥ 25%（warn-only）

## 執行配置（**啟動前必讀**）

| 項目 | 值 |
|------|-----|
| 主 skill | `superpowers:test-driven-development` |
| 副 skill | `vuejs-typescript-best-practices` |
| 模型 | **Opus 4.7** |
| Worktree | **禁用** |
| 並行 subagent | 否（業務元件耦合 store / composable 多，序列做） |
| 詳細政策 | 見 [README 全域執行政策](../../README.md) |

## 範圍

### The\* layout（單例）— 6 個
- `TheTitleBar.vue` — Tauri 視窗控制
- `TheScratchpad.vue` — 全域筆記
- `TheFooter.vue` — 狀態列
- `TheNotificationsBoard.vue` — 通知中心
- `TheSettingBar.vue` — 設定側欄
- `TheSpecSnapInspector.vue` — 已是 90 行 shell（CLAUDE.md 描述），測 mount + open/close

### 業務元件高 ROI（5 個）
- `WorkspaceTabTable.vue` — 表格資料展示（user 最近改過）
- `WorkspaceTabQuery.vue` — query editor
- `ModalEditCell.vue` — 編輯儲存格
- `ModalNewConnection.vue` — 新增連線
- `SettingBarConnections.vue` — 連線管理側欄
- `PropsTable.vue` — 結構檢視

### App.vue（**主要 root**）
- `applicationTheme` toggle → `#wrapper` class 變化（驗 settings store 的 DOM 副作用）

## 觸碰檔案

co-located 加 `.test.ts`，從上述 ~12 個元件挑高 ROI 寫，總計 5-10 個 test 檔。

## 測試重點

### TheTitleBar
- `getCurrentWindow().minimize / maximize / close` 被呼叫（已在 T2 mock）
- 雙擊標題列 → maximize toggle
- platform === 'darwin' 時 traffic-light 不渲染（Tauri 內建）

### TheSpecSnapInspector
- mount 時 wrapper.open() 被呼叫（CLAUDE.md 提到）
- close event → applicationStore.hideSpecsnap()

### WorkspaceTabTable（最近改過的元件）
- mount 時依 `workspaces.activeTab` 渲染 table
- 切 tab 時資料切換
- 雙擊 cell → emit edit event
- columns 自訂（隱藏 / reorder）

### App.vue 主測試
```ts
// web/renderer/App.test.ts
import { mount, flushPromises } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { createTestingPinia } from '@pinia/testing';
import App from './App.vue';

describe('App.vue', () => {
   it.each([
      ['light', 'theme-light'],
      ['dark', 'theme-dark']
   ])('applies theme-%s class on #wrapper', async (theme, expected) => {
      const wrapper = mount(App, {
         global: {
            plugins: [createTestingPinia({
               initialState: { settings: { applicationTheme: theme } }
            })]
         }
      });
      await flushPromises();
      expect(wrapper.find('#wrapper').classes()).toContain(expected);
   });
});
```

## 不寫的元件（依賴 Playwright e2e 覆蓋）

剩 ~70 個業務元件（ResultTable\*、ModalManagement\*、Workspace\* 大部分子件）**不寫 unit test**，理由：
- mount 後行為複雜、需要真實 DB 連線才有意義
- Playwright e2e 跑整個 app，自然覆蓋這些 component 的「裝起來不爆」
- unit test 寫了 maintenance 成本 > 收益

## 驗收

```bash
pnpm test:unit:run web/renderer/components/The*.test.ts \
                   web/renderer/components/WorkspaceTabTable.test.ts \
                   web/renderer/App.test.ts
pnpm test:coverage --coverage.include='web/renderer/components/{The*,WorkspaceTab*,Modal*,SettingBarConnections,PropsTable}.vue'
```

## 風險

- **業務元件耦合 store / composable / DB 連線**：需要灌大量 initialState；spec 執行時 read 元件的 `<script setup>` 看 imports + provide / inject 後決定 mount 設定。
- **Modal 元件用 Reka Dialog**：跟 T12 共用 Dialog mocking 邊界。

## User 批准語法

「**T14 OK**」
