# T13 — Base\* primitives 測試（15-25 個）

**對應 PR**：PR6
**前置**：T1 + T2
**目標覆蓋率**：lines ≥ 40% / branches ≥ 25%（warn-only，元件層不追求高覆蓋）

## 執行配置（**啟動前必讀**）

| 項目 | 值 |
|------|-----|
| 主 skill | `superpowers:test-driven-development` |
| 副 skill | `superpowers:subagent-driven-development`（20+ 個 Base\* 並行） + `vuejs-typescript-best-practices` |
| 模型 | **Opus 4.7**（含 subagent dispatch） |
| Worktree | **禁用** |
| 並行 subagent | **是** —— 4-5 批每批 5 個元件 |
| 詳細政策 | 見 [README 全域執行政策](../../README.md) |

## 範圍

從 `web/renderer/components/Base*.vue` 篩出，**先盤點再寫**。預期清單（執行時 read 後校準）：

- `BaseIcon.vue` — mdi icon wrapper
- `BaseLoader.vue` — spinner
- `BaseSelect.vue` — 下拉選擇（antares 自定，非 shadcn Combobox）
- `BaseTextEditor.vue` — Ace editor wrapper
- `BaseToast.vue` — toast wrapper（若還用，新版可能改 Sonner）
- `BaseUploadButton.vue`
- `BaseGrid.vue` — table grid 基礎
- `BaseConfirm.vue` — confirm dialog
- 其他

## 觸碰檔案

每個 `Base*.vue` 旁加一個 `Base*.test.ts`。

## 測試重點（per primitive）

```ts
// web/renderer/components/BaseIcon.test.ts
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import BaseIcon from './BaseIcon.vue';

describe('BaseIcon', () => {
   it('renders mdi path for given name', () => {
      const wrapper = mount(BaseIcon, {
         props: { name: 'mdi-account', size: 24 }
      });
      expect(wrapper.find('svg').exists()).toBe(true);
      // 不 snapshot SVG path（mdi 升級會破）
      // 改驗：data-testid="icon" 存在、aria-label 含 name
      expect(wrapper.attributes('aria-label')).toMatch(/account/);
   });

   it('applies size prop as width / height', () => {
      const wrapper = mount(BaseIcon, { props: { name: 'mdi-x', size: 32 } });
      const svg = wrapper.find('svg');
      expect(svg.attributes('width')).toBe('32');
      expect(svg.attributes('height')).toBe('32');
   });

   it('falls back to default when name is missing path', () => {
      const wrapper = mount(BaseIcon, { props: { name: 'mdi-nonexistent' } });
      // 不 throw，且 svg 仍渲染（可能空 path）
      expect(wrapper.find('svg').exists()).toBe(true);
   });
});
```

## 通用測試項目（每個 Base\* 都驗）

- **props 驗證**：必填 / 預設值 / 型別
- **emits**：互動觸發 emit、payload shape
- **slots**：default slot 渲染、named slot 切換
- **a11y**：role / aria-label / aria-describedby（依元件）
- **disabled state**：點擊不觸發 emit、視覺有 disabled 樣式
- **不寫**：rendered text snapshot（i18n key 改名會破）；SVG path snapshot（mdi 升級會破）

## BaseTextEditor 特殊

Ace editor 在 happy-dom 可能有問題（依賴 Canvas / contenteditable）：
- 測 mount 不 throw
- 測 `v-model` 雙向綁定（透過 emit `update:modelValue`）
- 不測 syntax highlighting / autocomplete（那是 Ace 自己的事，且 happy-dom 跑不了）
- 若 Ace 在 happy-dom 直接爆，stub 整個 Ace（`vi.mock('ace-builds')`）然後測 wrapper 邏輯

## 驗收

```bash
pnpm test:unit:run web/renderer/components/Base*.test.ts
pnpm test:coverage --coverage.include='web/renderer/components/Base*.vue'
# 預期：≥ 40% lines（元件層門檻 warn-only）
```

## 風險

- **Base\* 數量需先盤點**：spec 執行時 `Glob 'web/renderer/components/Base*.vue'`，可能 15 也可能 30。預估 ~20。
- **某些 Base\* 重度依賴外部 lib**（Ace、Leaflet、faker）：測試需要 mock 這些，否則 happy-dom 跑不動。

## User 批准語法

「**T13 OK**」
