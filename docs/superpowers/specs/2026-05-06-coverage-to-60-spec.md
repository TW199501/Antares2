# 補足測試覆蓋率到 60% — Spec（技術細節）

> **配套 plan**: [`2026-05-06-coverage-to-60.md`](../plans/2026-05-06-coverage-to-60.md)
> 本 spec 為 plan 的執行細節：mount 樣板、mock helper、subagent prompt 樣板、雷區指南。

## 1. Mount 樣板分類

業務元件的測試難度由「依賴的外部上下文」決定。三類：

### 1.A 純 prop-driven（最簡）
不依賴 Pinia store / Tauri API / vue-i18n / 子元件 context。
直接 `mount(Component, { props: {...}, slots: {...} })`。

**判別法**：grep `useI18n|useStore|invoke|emit\(`、無→純 prop-driven。
**範例**：`KeyPressDetector.vue`, `WorkspaceTabQueryEmptyState.vue`, `WorkspaceEmptyState.vue`。

### 1.B Pinia store 依賴（中等）
用 `useNotificationsStore()` / `useWorkspacesStore()` / `useSettingsStore()` 等。
用 `mountWithPinia` helper（[tests/helpers/mountWithPinia.ts](../../../tests/helpers/mountWithPinia.ts)）。

**判別法**：grep `from '@/stores/'`。
**範例**：`ModalSettings.vue`, `ModalFakerRows.vue`, `Workspace.vue`。

### 1.C 多重依賴（最複雜）
Pinia + i18n + Tauri API + 子元件 + async data + portal。
深度 mount 拋錯機率高、改測 export-defined + smoke render（最少 it 配對）。

**判別法**：grep `Tables\.|Schema\.|Connection\.|invoke|listen`。
**範例**：`WorkspaceTabQueryTable.vue`, `WorkspaceTabPropsTable.vue`, `WorkspaceExploreBarSchema.vue`。

## 2. Mock 樣板

### 2.A 全域 mock（已在 [tests/setup.ts](../../../tests/setup.ts)）

- `vue-i18n` 的 `t()` mock 為 identity（`t('foo') === 'foo'`）
- `IntersectionObserver` / `ResizeObserver` / `matchMedia` stub
- `KeyboardEvent.getModifierState` stub

不必再寫。直接 import 元件就會走這些 mock。

### 2.B Tauri API mock 樣板

```ts
import { vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
   invoke: vi.fn().mockResolvedValue({})
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
   readTextFile: vi.fn().mockResolvedValue(''),
   writeTextFile: vi.fn().mockResolvedValue(undefined),
   exists: vi.fn().mockResolvedValue(false)
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
   open: vi.fn().mockResolvedValue(null),
   save: vi.fn().mockResolvedValue(null)
}));
```

### 2.C ipc-api wrapper mock 樣板

```ts
vi.mock('@/ipc-api/Tables', () => ({
   default: {
      getTableData: vi.fn().mockResolvedValue({ status: 'success', response: { rows: [], fields: [] } }),
      getTableColumns: vi.fn().mockResolvedValue({ status: 'success', response: [] }),
      getTableOptions: vi.fn().mockResolvedValue({ status: 'success', response: {} })
   }
}));

vi.mock('@/ipc-api/Schema', () => ({
   default: {
      getStructure: vi.fn().mockResolvedValue({ status: 'success', response: [] }),
      rawQuery: vi.fn().mockResolvedValue({ status: 'success', response: { rows: [] } })
   }
}));
```

### 2.D Pinia store mock（用 `createTestingPinia`）

`mountWithPinia` 已內建 `createTestingPinia({ createSpy: vi.fn })`。store action 自動變成 spy。讀 store 用 `storeToRefs(store).{getter}.value = ...` 設初始值。

## 3. Subagent prompt 樣板

每個 subagent 用此 prompt 結構（替換 `{{...}}`）：

```text
寫 {{N}} 個 Vue business component 的 .test.ts 檔。**不修 source**、**不 commit**、**不跑 lint/test**（supervisor 統一驗）。

## Repo
- antares2 (e:\source\antares2), Vue 3 + vitest 4.1.5 + happy-dom
- aliases: `@/` → `web/renderer/`, `common/` → `web/common/`, `@tests/` → `tests/`
- Helpers: `@tests/helpers/mountWithPinia.ts`, `@tests/helpers/mountComposable.ts`
- setup file (已 mock vue-i18n / IntersectionObserver / ResizeObserver): `tests/setup.ts`
- Path: 測試檔放 component 同目錄、命名 `<Name>.test.ts`

## 範圍（{{N}} 檔）
{{LIST}}

## 動工前必看
1. 先 Read 每個 .vue 檔（template + script setup）抓 props / emits / store usage / async data
2. 看現有 business component test pattern：
   - `web/renderer/components/SettingBarConnections.test.ts` (Pinia 樣板)
   - `web/renderer/components/TheTitleBar.test.ts` (i18n + store)
   - `web/renderer/components/ModalAskCredentials.test.ts` (modal + form)
3. 看 spec [docs/superpowers/specs/2026-05-06-coverage-to-60-spec.md](docs/superpowers/specs/2026-05-06-coverage-to-60-spec.md) §2 mock 樣板

## Test pattern
每個元件 test 5-8 個 it()：
- mount no-throw（用 mountWithPinia + 必要 ipc-api mock）
- props 驗證（each prop accept + default）
- slot render 驗證
- emit 驗證（trigger user interaction → flushPromises → expect emit fired）
- async data flow（mock ipc-api wrapper return → trigger fetch → assert state）
- conditional render（v-if 切換、status 變化）

## Lint rules
- 不要 `props: ['name']` array form（觸發 vue/require-prop-types warning）
- 用 `props: { name: { type: ..., default: ... } }`
- 或 inline template

## Mount 失敗 fallback
如 mount 拋錯（Pinia 沒 mock 對 / Tauri API 沒 mock / portal / async init）：
1. 加 mock 直到 mount 過
2. 若 30 分鐘還過不了，改 export-defined-only + 1 個 minimal smoke：
   ```ts
   it('is exported and defined', () => {
      expect(Component).toBeDefined();
   });
   ```

## 回報 < 200 字
1. {{N}} test path
2. mount 拋錯的元件 + 已試的 mock + 結論
3. 每檔 it 個數
```

## 4. Supervisor 驗收檢核

每個 phase 結束 supervisor 跑：

```bash
# 必須全綠（exit 0）
pnpm test:unit:run

# 必須 0 errors（warning OK）
pnpm lint
pnpm type-check

# 量 phase 目標（lines % 提升）
pnpm test:coverage

# hard gate 不退（lines + branches ≥ 60）
pnpm test:coverage:check
```

任何一條失敗：
1. revert 該 subagent 的 commit、找哪個 file 引發
2. 重 dispatch 該 subagent（給更明確的 mock context）
3. 或 supervisor 手動修

## 5. 雷區（subagent 必避）

### 5.A `data-slot` / `data-state` assertion
reka-ui 渲染這些屬性的 timing 不一致、happy-dom + reka-ui 組合下常 race。
→ **不要用 `wrapper.attributes('data-slot')`** 當 contract、改測 wrapper 本身存在 + class 不會誤刪。

### 5.B portal 內容檢查
`<DialogContent>`/`<PopoverContent>` 用 reka-ui Teleport 到 `document.body`。
`wrapper.html()` 不含 portal 內容。
→ 用 `document.body.innerHTML.toContain('xxx')`、`afterEach` 清空 body 避免 cross-test 污染。

### 5.C async store fetch
許多 modal 的 `mounted` hook 跑 `await Tables.getTableData(...)`。Mock return 後仍要 `await flushPromises()` 才 trigger 後續 reactive update。
→ test:
```ts
import { flushPromises } from '@vue/test-utils';
const wrapper = mountWithPinia(Modal);
await flushPromises();  // 等 mounted hook 的 async 跑完
expect(...).toBe(...);
```

### 5.D Tauri-only API
`useDraggable` / `getCurrentWindow` 等只在 Tauri runtime 有。
→ mock：
```ts
vi.mock('@tauri-apps/api/window', () => ({
   getCurrentWindow: vi.fn().mockReturnValue({
      label: 'main', listen: vi.fn(), emit: vi.fn()
   })
}));
```

### 5.E `useFocusTrap` / `useShortcutDispatcher`
這兩個 composable 跑 `keydown` event listener、需 happy-dom dispatch。
→ 已有 setup.ts mock；不必再 mock。

### 5.F BaseTextEditor / BaseMap
這些是 ace-editor / leaflet 包裝、mount 慢且常 race。
→ stub 掉：
```ts
mountWithPinia(Component, {
   global: {
      stubs: { BaseTextEditor: true, BaseMap: true }
   }
});
```

## 6. Coverage 量化期待

每個 business 元件 deep test 預期：

| 元件大小 | source lines | 預期 covered (40-50%) |
|---|---|---|
| > 800 | 800-1200 | 320-600 |
| 500-800 | 500-800 | 200-400 |
| 300-500 | 300-500 | 120-250 |
| < 300 | < 300 | 60-150 |

如果 phase 結束實測 covered % 比上表低 30% 以上 → mount 沒成功 / mock 沒對齊、檢查 lcov 細節。

## 7. 已知無法測的元件（直接 export-defined）

這些元件深度 mount 風險高、effort vs return 不划算：
- `BaseTextEditor.vue`（ace-editor lazy load）— 已存在 export-defined test
- `BaseMap.vue`（leaflet）— 已存在 export-defined test
- `BaseVirtualScroll.vue`（IntersectionObserver-heavy）— 已存在
- 任何含 `dynamic import` + 動態 component 的 modal

## 8. 與其他 plan 的同步

- **PR1 fixture 採集**（user 端）：本 plan 不依賴、可並行
- **PR3 Part B common-and-libs zone**：Phase D 同步達成
- **.NET sidecar migration v5**：本 plan 完成才動 Phase 0

## 9. Plan 檔位置 & 流程

- Plan: [docs/superpowers/plans/2026-05-06-coverage-to-60.md](../plans/2026-05-06-coverage-to-60.md)
- 此 spec: [docs/superpowers/specs/2026-05-06-coverage-to-60-spec.md](2026-05-06-coverage-to-60-spec.md)
- 每 phase 結束：supervisor commit + push 一個 commit
- 任何 phase 不過：先 revert 後重來，不留 red 在 origin/dev
