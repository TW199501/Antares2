# T12 — shadcn primitive 互動測試（5-7 個關鍵元件）

**對應 PR**：PR6
**前置**：T1 + T2
**取代**：v1 plan 的「97 個 shadcn primitive snapshot」（已砍）
**目標**：抓 a11y / interaction regression，**不**追求覆蓋率

## 執行配置（**啟動前必讀**）

| 項目 | 值 |
|------|-----|
| 主 skill | `superpowers:test-driven-development` |
| 副 skill | `shadcn-vue` + `vuejs-typescript-best-practices` |
| 模型 | **Opus 4.7** |
| Worktree | **禁用** |
| 並行 subagent | 否（7 個元件互相獨立但量太少，序列做即可） |
| 詳細政策 | 見 [README 全域執行政策](../../README.md) |

## 為什麼只測 5-7 個

- 90 個 primitive 的「mount 後 HTML 字串」snapshot 對抓 bug 沒用，反而被 Reka UI `data-state` / mdi SVG 升級隨機破壞
- 真正會壞的是「整合到 antares 後 a11y / focus / keyboard interaction」
- 選最容易壞、最關鍵的 7 個深度測，其餘 90 個信任上游 + Playwright e2e 抽查

## 對象清單（co-located 在 primitive 旁）

| 元件 | 檔案位置 | 測試重點 |
|------|---------|---------|
| `Dialog` | `web/renderer/components/ui/dialog/Dialog.test.ts` | focus trap、ESC、open 後 body `pointer-events` reset |
| `Combobox` | `web/renderer/components/ui/combobox/Combobox.test.ts` | 箭頭鍵 nav、Enter 選取、ESC、search filter |
| `Popover` | `web/renderer/components/ui/popover/Popover.test.ts` | ESC、click outside、Teleport z-index |
| `Tooltip` | `web/renderer/components/ui/tooltip/Tooltip.test.ts` | hover delay、aria-describedby |
| `Sonner (Toast)` | `web/renderer/components/ui/sonner/Sonner.test.ts` | queue 順序、auto-dismiss、手動 close |
| `DropdownMenu` | `web/renderer/components/ui/dropdown-menu/DropdownMenu.test.ts` | keyboard nav、submenu open |
| `ContextMenu` | `web/renderer/components/ui/context-menu/ContextMenu.test.ts` | right-click trigger、ESC dismiss |

## 重點 1：Dialog body pointer-events 修補（關鍵！）

per user memory `feedback_radix_body_pointer_events_trap.md`：Reka Dialog 開啟會把 `body.pointerEvents = 'none'`，antares 在 shell 層覆寫成 `auto`。**這個修補不能退化** —— T12 要驗。

```ts
// web/renderer/components/ui/dialog/Dialog.test.ts
import { describe, expect, it, nextTick } from 'vitest';
import { mount } from '@vue/test-utils';
import Dialog from './Dialog.vue';
// 視 antares 對 Dialog 的 wrapper 結構而定

describe('Dialog (Reka UI integration)', () => {
   it('traps focus inside dialog when open', async () => {
      const wrapper = mount({
         template: `
            <Dialog open>
               <DialogContent>
                  <button data-testid="b1">First</button>
                  <button data-testid="b2">Last</button>
               </DialogContent>
            </Dialog>`,
         components: { Dialog }
      });
      await nextTick();
      // Tab 從 b2 → 應回 b1
      // Shift+Tab 從 b1 → 應到 b2
   });

   it('closes on ESC', async () => {
      const wrapper = mount(/* dialog with v-model:open */);
      await nextTick();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await nextTick();
      // 驗 onUpdate:open=false 被 emit
   });

   it('does NOT leave body.pointerEvents = none after close', async () => {
      const wrapper = mount(/* dialog with toggle */);
      // 開
      await wrapper.find('[data-testid=open-btn]').trigger('click');
      await nextTick();
      // 關
      await wrapper.find('[data-testid=close-btn]').trigger('click');
      await nextTick();
      expect(document.body.style.pointerEvents).not.toBe('none');
      // 或：expect getComputedStyle(document.body).pointerEvents).toBe('auto');
   });
});
```

## 重點 2：Combobox keyboard navigation

```ts
describe('Combobox keyboard nav', () => {
   it('arrow down moves highlight, Enter selects', async () => {
      const wrapper = mount(/* Combobox with 3 items */);
      const input = wrapper.find('input');
      await input.trigger('keydown', { key: 'ArrowDown' });
      await input.trigger('keydown', { key: 'ArrowDown' });
      await input.trigger('keydown', { key: 'Enter' });
      // 驗第二項被選中
   });

   it('search filter narrows visible options', async () => {
      // type 'foo' → 只顯示含 'foo' 的 option
   });
});
```

## 重點 3：Tooltip / Popover ESC

```ts
describe('Popover ESC dismisses', () => {
   it('closes on ESC', async () => {
      const wrapper = mount(/* Popover open */);
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await nextTick();
      // 驗 closed
   });
});
```

## 為什麼這些測試會抓 regression

- Dialog body pointer-events bug 是真實踩過的雷（user memory）
- Reka UI 升級若改了 keyboard handling，這 7 個測試會立即紅
- shadcn-vue CLI 升級覆蓋本地檔案（CLAUDE.md 嚴禁），若有人不小心跑了，這層測試保命

## 驗收

```bash
pnpm test:unit:run web/renderer/components/ui/

# 視覺驗收（補強）：
pnpm vite:dev &
# 手開 settings dialog、按 ESC、確認 body pointer-events 沒鎖
```

## 風險

- **happy-dom 對 `<dialog>` 元素支援不完整**：Reka Dialog 用的是 div + role="dialog"，不是 native `<dialog>`，應該 OK；若爆 fallback 到 jsdom（成本：vitest 速度降）。
- **focus trap 測試容易 flaky**：focus 切換有時序，要用 `await nextTick()` + `await flushPromises()` 雙保險。
- **Sonner toast 用了 `setTimeout` 自動消失**：用 `vi.useFakeTimers()` 控時間流。

## User 批准語法

「**T12 OK**」
