# 屬性頁籤 shadcn-vue Phase 2 — 實作規格

> 配套 plan：[`docs/superpowers/plans/2026-04-26-props-tab-shadcn-phase2-audit.md`](../plans/2026-04-26-props-tab-shadcn-phase2-audit.md)
>
> **範圍鐵律：純樣式遷移，不動任何邏輯。**
>
> - props / emits / slots 公開介面 1:1 保留
> - 內部 reactive shape（`local`/`indexesProxy`/`foreignProxy`/`checksProxy`/`defaultValue`）一字不動
> - handler 函式名與行為（`addIndex`、`toggleField`、`reloadRefFields`、`translateDescription`、`applyChanges`…）原封不動，只改它們綁定的 DOM 結構
> - i18n key 不新增、不重命名（描述 key 已在前一輪完成）
> - 不動 Pinia store / sidecar / customizations / ipc-api
>
> 每個任務的 acceptance 都包含 `pnpm lint` 通過 + 視覺對齊 + 點一輪手動 smoke。

---

## 0. 共用前置：Token / Primitive 對照表

| spectre 類 | shadcn / Tailwind 對應 | 備註 |
|---|---|---|
| `.form-input` | `<Input class="!h-[32px] !text-[14px]" />` | shadcn `Input` 已 patch `text-foreground`，不要拔 |
| `.form-input.input-sm` | `<Input class="!h-[28px] !text-[13px]" />` | inline-edit / 小表單用 |
| `.form-label` | `<Label class="!text-[14px] !text-muted-foreground !font-normal !m-0">` | 配色與 props-table 工具列一致 |
| `.form-group` | `<div class="flex flex-col gap-1">` | 需 horizontal label 時改 `flex items-center gap-2` |
| `.form-group.form-horizontal` + `.col-3 / .column` | `<div class="grid grid-cols-[100px_1fr] items-center gap-2">` | 100px 是觀察 modal 的 label 欄寬 |
| `.form-checkbox` + 內部 `<input type="checkbox">` + `<i class="form-icon">` | `<label class="flex items-center gap-2"><Checkbox :model-value="..." @update:model-value="..." />text</label>` | shadcn `Checkbox` 是 reka-ui，不接 native checked，要轉 v-model |
| `.form-radio` + native radio | 共用一支 `<RadioRow>` 私有元件（見 §B7） | shadcn radio-group 暫不引入 |
| `.btn.btn-sm` / `.btn.btn-dark` | `<Button variant="secondary" size="sm">` 或 `variant="ghost"` | header toolbar 用 `secondary`；icon-only 用 `variant="ghost" size="icon"` |
| `.btn.btn-primary` | `<Button>`（預設 variant） | empty-state CTA |
| `.btn.btn-link.remove-field` | `<Button variant="ghost" size="icon" class="!h-[24px] !w-[24px]">` | tile 右側刪除 X |
| `.modal` / `ConfirmModal` 殼 | **保留** `BaseConfirmModal`（內部已是 shadcn `Dialog`） | 不拆殼，只動 `#body` slot 內結構 |
| `.modal-body` queryable selector | 仍存在於 `BaseConfirmModal` 內部 | `getModalInnerHeight()` 不需改 |
| `.panel` + `.panel-header` + `.panel-body` | `<div class="flex flex-col">` + `<div class="flex items-center gap-2 mb-2">` + `<div class="flex-1 overflow-auto pr-1">` | 高度仍由 `:style="{ height: modalInnerHeight + 'px' }"` 控 |
| `.tile.tile-centered` | `<div class="flex items-center gap-2 px-2 py-1 rounded-md transition-opacity opacity-50 hover:opacity-100 cursor-pointer">` | 選中：`opacity-100 bg-accent` |
| `.tile-icon / .tile-content / .tile-action` | `flex` 子節點直接排，行為對 1:1 |
| `.empty / .empty-icon / .empty-title / .empty-action` | `<div class="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">` |
| `.input-group` + 內 `.btn` | `<div class="flex gap-1">` + `Input` + `Button` |
| `.form-input-hint.text-warning / .text-error` | `<p class="text-[12px] mt-1 text-amber-600">` / `text-destructive` |
| `.columns / .column.col-N / .col-gapless` | `<div class="grid grid-cols-12 gap-0">` + `<div class="col-span-N">` |
| `.d-flex / .align-items-center / .mr-1 / .ml-2 / .pt-0 / .pl-0` | Tailwind `flex items-center mr-1 ml-2 pt-0 pl-0` |

**Z-index 規矩：** sticky cell `z-2`，dropdown / modal `z-50+`（既定 shadcn `Dialog` 用 `z-50`），不打架。

**color-scheme 與 dark：** 既有 `tailwind.css` 已處理。modal 內所有元素用 `text-foreground` / `bg-background` / `bg-card` / `text-muted-foreground` / `border-border`，不要 hard-code 顏色（chip 例外，原本就是直接寫色號維持品牌顏）。

---

## B1. 操作欄 sticky right

**檔案：** `WorkspaceTabPropsTableFields.vue`、`WorkspaceTabPropsTableRow.vue`

**現況：** `.th-ops` / `.td-ops` 寬 110px 固定欄寬，但無 `position: sticky`。

### 實作步驟

1. `WorkspaceTabPropsTableFields.vue` 末段 `.th-ops` SCSS：
   ```scss
   .th-ops {
     width: 110px;
     min-width: 110px;
     max-width: 110px;
     text-align: center;
     position: sticky;
     right: 0;
     z-index: 3;
     background: var(--background);
   }
   ```
2. `WorkspaceTabPropsTableRow.vue` 末段 `.td-ops` SCSS：
   ```scss
   .td-ops {
     /* 既有寬度規則保留 */
     position: sticky;
     right: 0;
     z-index: 2;
     background: var(--background);
   }

   .tr:hover .td-ops {
     background: var(--accent);  /* 跟 row hover 同色，避免反差 */
   }
   ```
3. `.ops-btns` 既有 `opacity: 0` → hover row 顯示的規則保留不動。
4. 確認 `.tr` 父層沒有 `overflow: hidden`，否則 sticky 失效；`.tbody` 也不能。`vscroll` 在 `.table` 父層，OK。

### 風險檢查

- light theme bg = `#ffffff`，dark theme bg = `#08091A` — 都是 `var(--background)` 自動切換
- `.tr:hover` 既有 hover 色已透過 spectre 的 `.table-hover` 類定義（在 `main.scss` 內），需要視覺確認 hover 時 sticky cell 不會出現「色塊邊界」
- 如 hover 色透出有問題，補 `.tr:hover .td-ops { background: var(--accent); }` 或抓 `--secondary` 較淺的 token

### Acceptance

- [ ] 屬性表格欄位拖到水平捲動時，操作欄 4 顆按鈕固定貼右
- [ ] light + dark theme 切換無透色
- [ ] hover row 時 sticky cell 跟著變色
- [ ] hover row 時 `.ops-btns` opacity 0→1 行為仍正常
- [ ] 點任一操作按鈕（上移/下移/編輯/刪除）行為不變

---

## B2. WorkspaceTabPropsTableDdlModal.vue

**現況：** 1 處 spectre 殘留（`d-flex` 在 `<template #header>`）。

### 實作步驟

僅一行：line 11 的 `<div class="d-flex">` → `<div class="flex items-center">`。其餘 `BaseConfirmModal` + `BaseTextEditor` 結構維持。

### Acceptance

- [ ] `grep -E "form-(input|select|label|group|radio)|input-group|btn[^a-z-]|modal[^a-z-]|d-flex|d-inline-block" WorkspaceTabPropsTableDdlModal.vue` 為 0 行
- [ ] 開啟 DDL preview 顯示正常、`read-only` 文字編輯器仍可滾動

---

## B3. WorkspaceTabPropsTableEditModal.vue

**檔案：** `WorkspaceTabPropsTableEditModal.vue`

### 模板改寫（保留邏輯，動 DOM）

**Top 級結構（line 18-19）：**
```vue
<template #body>
   <div class="flex flex-col gap-3 px-1 py-2">
```

**欄位名（line 20-28）：**
```vue
<div class="flex flex-col gap-1">
   <Label class="!text-[14px] !text-muted-foreground !font-normal !m-0">
      {{ t('database.fieldName') }}
   </Label>
   <Input v-model="local.name" type="text" class="!h-[32px] !text-[14px]" />
</div>
```

**資料類型（line 29-41）：** 保留 `BaseSelect`（B8 才動），只改 wrapper：
```vue
<div class="flex flex-col gap-1">
   <Label class="!text-[14px] !text-muted-foreground !font-normal !m-0">
      {{ t('database.type') }}
   </Label>
   <BaseSelect
      v-model="local.type"
      :options="dataTypes"
      group-label="group"
      group-values="types"
      option-label="name"
      option-track-by="name"
      class="form-select uppercase [&_.form-select]:!h-[32px] [&_.form-select]:!text-[14px]"
   />
</div>
```

**長度 / 精度（line 43-66）：**
```vue
<div class="grid grid-cols-2 gap-2">
   <div v-if="currentFieldType?.length" class="flex flex-col gap-1">
      <Label class="!text-[14px] !text-muted-foreground !font-normal !m-0">
         {{ t('database.length') }}
      </Label>
      <Input v-model.number="localLength" type="number" min="0" class="!h-[32px] !text-[14px]" />
   </div>
   <div v-if="currentFieldType?.scale" class="flex flex-col gap-1">
      <Label class="!text-[14px] !text-muted-foreground !font-normal !m-0">
         {{ t('database.precision') }}
      </Label>
      <Input v-model.number="local.numScale" type="number" min="0" class="!h-[32px] !text-[14px]" />
   </div>
</div>
```

**chip row（line 68-101）：** 只動 wrapper，chip 本體已是 Tailwind：
```vue
<div class="flex items-center gap-2">
   <!-- 各 chip 結構照舊 -->
</div>
```
class `edit-chip-label` 改 inline `class="text-[12px] text-muted-foreground"`，原 SCSS 該選擇器可刪。

**預設值（line 102-111）：**
```vue
<div class="flex flex-col gap-1">
   <Label class="!text-[14px] !text-muted-foreground !font-normal !m-0">
      {{ t('database.default') }}
   </Label>
   <Input v-model="local.default" type="text" :placeholder="t('general.none')" class="!h-[32px] !text-[14px]" />
</div>
```

**描述 + AI 翻譯（line 112-138）：**
```vue
<div v-if="customizations.comment" class="flex flex-col gap-1">
   <Label class="!text-[14px] !text-muted-foreground !font-normal !m-0">
      {{ t('database.comment') }}
   </Label>
   <div class="flex gap-1">
      <Input
         v-model="local.comment"
         type="text"
         :placeholder="t('database.commentPlaceholder')"
         class="!h-[32px] !text-[14px] flex-1"
      />
      <Button
         variant="secondary"
         size="sm"
         class="!h-[32px] !w-[36px] !p-0"
         :title="settingsStore.aiApiKey ? t('database.translateWithAi') : t('database.aiKeyRequired')"
         :disabled="isTranslating || !settingsStore.aiApiKey"
         @click.prevent="translateDescription"
      >
         <span v-if="!isTranslating" aria-hidden="true">🌐</span>
         <span v-else class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </Button>
   </div>
   <p v-if="!settingsStore.aiApiKey" class="text-[12px] mt-1 text-amber-600">
      {{ t('database.aiKeyRequired') }}
   </p>
   <p v-if="translateError" class="text-[12px] mt-1 text-destructive">
      {{ translateError }}
   </p>
</div>
```

### Script 改動

- 新增 imports：
  ```ts
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  ```
- 移除 `<style scoped>` 內 `.edit-field-form .form-group / .form-label / .edit-chip-label / .translate-btn / .text-warning / .text-error` 規則
- `.field-chip` 規則**保留**（chip 配色寫死，跟其他地方一致）

### Acceptance

- [ ] `grep -E "form-(input|select|label|group)|input-group|btn[^a-z-]|d-flex|columns|column col-" WorkspaceTabPropsTableEditModal.vue` 為 0 行（`form-select` 行允許保留 1 處給 `BaseSelect` wrapper）
- [ ] 編輯欄位 → 修改任意值 → 確認 → 表格 row 真的更新
- [ ] AI 翻譯按鈕、loading 狀態、翻譯錯誤訊息行為不變
- [ ] AI key 未設定 → 翻譯按鈕 disabled + 警告 hint 顯示
- [ ] PK / AI / NULL 三 chip 切換邏輯不變
- [ ] zh-TW / en-US locale 切換 label 全部正確顯示

---

## B4. WorkspaceTabPropsTableIndexesModal.vue

**檔案：** `WorkspaceTabPropsTableIndexesModal.vue`

### 模板改寫

**外層 columns（line 20）：**
```vue
<div class="grid grid-cols-12 gap-0">
   <div class="col-span-5">
      ...
   </div>
   <div class="col-span-7 pl-2">
      ...
   </div>
</div>
```

**Panel + header（line 23-48）：**
```vue
<div class="flex flex-col" :style="{ height: modalInnerHeight + 'px' }">
   <div class="flex items-center gap-2 mb-2">
      <Button variant="secondary" size="sm" class="!h-[28px]" @click="addIndex">
         <BaseIcon class="mr-1" icon-name="mdiKeyPlus" :size="18" />
         <span>{{ t('general.add') }}</span>
      </Button>
      <Button
         variant="secondary"
         size="sm"
         class="!h-[28px]"
         :title="t('database.clearChanges')"
         :disabled="!isChanged"
         @click.prevent="clearChanges"
      >
         <BaseIcon class="mr-1" icon-name="mdiDeleteSweep" :size="18" />
         <span>{{ t('general.clear') }}</span>
      </Button>
   </div>
```

**Panel body + tile（line 49-87）：** 原 `.tile` SCSS 規則保留，但 class 改：
```vue
<div ref="indexesPanel" class="flex-1 overflow-auto pr-1">
   <div
      v-for="index in indexesProxy"
      :key="index._antares_id"
      class="tile flex items-center gap-2 px-2 py-1 mb-1 rounded-md cursor-pointer"
      :class="{ 'selected-element': selectedIndexID === index._antares_id }"
      @click="selectIndex($event, index._antares_id)"
   >
      <BaseIcon class="column-key shrink-0" icon-name="mdiKey" :class="`key-${index.type}`" :size="22" />
      <div class="flex-1 min-w-0">
         <div class="text-[14px] truncate">{{ index.name }}</div>
         <div class="text-[12px] text-muted-foreground">{{ index.type }} · {{ index.fields.length }} {{ t('database.field', index.fields.length) }}</div>
      </div>
      <Button
         variant="ghost"
         size="icon"
         class="tile-action !h-[24px] !w-[24px] remove-field"
         :title="t('general.delete')"
         @click.prevent="removeIndex(index._antares_id)"
      >
         <BaseIcon icon-name="mdiClose" :size="16" />
      </Button>
   </div>
</div>
```
> `tile-action` class 保留供 `.tile:hover .tile-action { opacity: 1 }` SCSS 用；`remove-field` class 保留給 `selectIndex()` 內 `classList.contains('remove-field')` 邏輯用。

**右側 form（line 91-138）：**
```vue
<div class="col-span-7 pl-2">
   <form
      v-if="selectedIndexObj"
      :style="{ height: modalInnerHeight + 'px' }"
      class="flex flex-col gap-3"
   >
      <div class="grid grid-cols-[100px_1fr] items-center gap-2">
         <Label class="!text-[14px] !text-muted-foreground !font-normal !m-0">{{ t('general.name') }}</Label>
         <Input v-model="selectedIndexObj.name" type="text" class="!h-[32px] !text-[14px]" />
      </div>
      <div class="grid grid-cols-[100px_1fr] items-center gap-2">
         <Label class="!text-[14px] !text-muted-foreground !font-normal !m-0">{{ t('database.type') }}</Label>
         <BaseSelect
            v-model="selectedIndexObj.type"
            :options="indexTypes"
            :option-disabled="(opt: any) => opt === 'PRIMARY' && hasPrimary"
            class="form-select [&_.form-select]:!h-[32px] [&_.form-select]:!text-[14px]"
         />
      </div>
      <div class="grid grid-cols-[100px_1fr] items-start gap-2">
         <Label class="!text-[14px] !text-muted-foreground !font-normal !m-0 mt-1.5">
            {{ t('database.field', fields.length) }}
         </Label>
         <div class="fields-list flex flex-col gap-1 pt-1">
            <label
               v-for="(field, i) in fields"
               :key="`${field.name}-${i}`"
               class="flex items-center gap-2 cursor-pointer text-[14px]"
               @click.prevent="toggleField(field.name)"
            >
               <Checkbox
                  :model-value="selectedIndexObj.fields.some((f: string) => f === field.name)"
                  @update:model-value="toggleField(field.name)"
               />
               <span>{{ field.name }}</span>
            </label>
         </div>
      </div>
   </form>
   <div v-if="!indexesProxy.length" class="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
      <BaseIcon icon-name="mdiKeyOutline" :size="48" />
      <p class="text-[16px]">{{ t('database.thereAreNoIndexes') }}</p>
      <Button @click="addIndex">{{ t('database.createNewIndex') }}</Button>
   </div>
</div>
```

> **double-binding 注意：** `<label @click.prevent>` + `<Checkbox @update:model-value>` 會觸發兩次 `toggleField`。**移除 `<label @click.prevent>`**，只在 `Checkbox @update:model-value` 上呼叫。原邏輯 spectre 是用 `<label @click.prevent>` 攔 native checkbox 的 click → 只走自己的 toggle，這個改 shadcn 後就只能由 Checkbox 自己負責。

修正版：
```vue
<label
   v-for="(field, i) in fields"
   :key="`${field.name}-${i}`"
   class="flex items-center gap-2 cursor-pointer text-[14px]"
>
   <Checkbox
      :model-value="selectedIndexObj.fields.some((f: string) => f === field.name)"
      @update:model-value="toggleField(field.name)"
   />
   <span>{{ field.name }}</span>
</label>
```

### Script 改動

- 新增 imports：`Button`、`Input`、`Label`、`Checkbox`
- `<style scoped>` 內 `.tile / .selected-element / .tile-action` 規則整段保留
- `.tile.selected-element` 補一條 `background: var(--accent);`（原本只有 opacity，selected 視覺要更顯著）

### Acceptance

- [ ] `grep -E "form-(input|label|group|checkbox)|btn[^a-z-]|d-flex|columns col|column col-|panel-|empty[ -]|tile-icon|tile-content|tile-action[^-]" WorkspaceTabPropsTableIndexesModal.vue` 為 0 行（`tile` 本身與 `selected-element`、`tile-action` class 屬性可保留作 SCSS hook）
- [ ] 新增 / 選取 / 刪除 index 流程不變
- [ ] checkbox 多選 columns 行為正確（不會雙觸發）
- [ ] `hasPrimary` 邏輯下 PRIMARY option 仍 disabled

---

## B5. WorkspaceTabPropsTableForeignModal.vue

**檔案：** `WorkspaceTabPropsTableForeignModal.vue`

### 結構策略

完全沿用 B4 的模板（左 panel/tile list + 右 form），ON UPDATE / ON DELETE 仍用 `BaseSelect`（**不引入 shadcn `Select`** — Phase 2 範圍只做樣式遷移）。

### 模板改寫對照

| 既有區塊 | 改寫策略 |
|---|---|
| line 20-46 panel-header | 同 B4：`<Button variant="secondary" size="sm">` + `BaseIcon` |
| line 48-111 panel-body + tile | 同 B4 tile 結構；`fk-details-wrapper` SCSS 保留（其字串截斷邏輯仍要） |
| line 116-119 form-horizontal | `<form class="flex flex-col gap-3">` |
| line 121-132 name 欄 | `grid grid-cols-[100px_1fr] items-center gap-2` + `Label` + `Input` |
| line 133-148 field 多選 | `grid grid-cols-[100px_1fr] items-start gap-2` + checkbox 列表（同 B4 雙觸發修正） |
| line 149-162 refTable | `grid grid-cols-[100px_1fr] items-center gap-2` + `BaseSelect class="[&_.form-select]:!h-[32px] [&_.form-select]:!text-[14px]"` |
| line 164-179 refField 多選 | 同 field 多選 |
| line 180-202 onUpdate / onDelete | 兩個獨立 `grid grid-cols-[100px_1fr]`，BaseSelect 同上 |
| line 206-222 empty | 同 B4 empty |

### 關鍵 caveat

- `selectForeign()` line 280 仍依賴 `event.target.classList.contains('remove-field')` → 刪除按鈕的 wrapper class 必須留 `remove-field`
- `reloadRefFields()` 是 `BaseSelect` 的 `@change` 觸發，不是 `@update:modelValue`，要確認 BaseSelect 仍 emit `change` event（檢查現況）
- field 多選的雙 click handler 同 B4 處理（移除外層 `@click.prevent`，靠 Checkbox 自己 emit）

### Acceptance

- [ ] `grep -E "form-(input|label|group|checkbox)|btn[^a-z-]|d-flex|columns col|column col-|panel-|empty[ -]" WorkspaceTabPropsTableForeignModal.vue` 為 0 行
- [ ] MySQL / PostgreSQL / SQL Server 三家新增 / 編輯 / 刪除 FK 行為不變
- [ ] 切 refTable → refField 列表自動 reload
- [ ] ON UPDATE / ON DELETE 切 CASCADE/SET NULL/RESTRICT/NO ACTION 真的存到 row

---

## B6. WorkspaceTabPropsTableChecksModal.vue

**檔案：** `WorkspaceTabPropsTableChecksModal.vue`

結構同 B4，更簡單（每個 check 只有 name + clause）。

### 重點

- line 112-117 `<textarea class="form-input" rows="5">` → 保留 `<textarea>`，class 改：
  ```vue
  <textarea
     v-model="selectedCheckObj.clause"
     rows="5"
     class="w-full rounded-md border border-input bg-background px-3 py-2 text-[14px] text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
     style="resize: vertical;"
  />
  ```
  （shadcn 沒有 Textarea primitive，hand-roll 一個跟 Input 配色相同的）
- 其他 panel/tile/empty 全部複用 B4 模板

### Acceptance

- [ ] `grep -E "form-(input|label|group)|btn[^a-z-]|d-flex|columns col|column col-|panel-|empty[ -]" WorkspaceTabPropsTableChecksModal.vue` 為 0 行
- [ ] MySQL 8+ / PostgreSQL / MSSQL 三家 CHECK constraint 新增 / 編輯 / 刪除 流程不變
- [ ] textarea resize handle 仍可拉（vertical only）
- [ ] SQLite / Firebird 不受影響（modal 本來就不開）

---

## B7. PropsTableRow inline 預設值彈窗

**檔案：** `WorkspaceTabPropsTableRow.vue` lines 231-337

不引入 shadcn radio-group。在檔內定義一個私有 `RadioRow` 元件，行為跟 spectre `.form-radio.form-inline` 1:1 對齊：

### 私有元件（直接寫在 `<script setup>` 後或檔內 inline 用）

不寫獨立檔案，避免新增檔案。改用 native `<input type="radio">` + 樣式包裝即可，因為 a11y 需求簡單。

### 模板改寫（line 231-337）

```vue
<ConfirmModal
   v-if="isDefaultModal"
   :confirm-text="t('general.confirm')"
   size="400"
   @confirm="editOFF"
   @hide="hideDefaultModal"
>
   <template #header>
      <div class="flex items-center">
         <BaseIcon class="mr-1" icon-name="mdiPlaylistEdit" :size="22" />
         <span class="cut-text">{{ t('database.default') }} "{{ row.name }}"</span>
      </div>
   </template>
   <template #body>
      <form class="flex flex-col gap-2">
         <!-- noval -->
         <label class="flex items-center gap-2 cursor-pointer text-[14px]">
            <input v-model="defaultValue.type" type="radio" name="default" value="noval" class="accent-primary">
            <span>No value</span>
         </label>

         <!-- custom value -->
         <div class="grid grid-cols-[140px_1fr] items-center gap-2">
            <label class="flex items-center gap-2 cursor-pointer text-[14px]">
               <input v-model="defaultValue.type" type="radio" name="default" value="custom" class="accent-primary">
               <span>{{ t('database.customValue') }}</span>
            </label>
            <Input
               v-model="defaultValue.custom"
               :disabled="defaultValue.type !== 'custom'"
               type="text"
               class="!h-[32px] !text-[14px]"
            />
         </div>

         <!-- NULL -->
         <label v-if="customizations.nullable" class="flex items-center gap-2 cursor-pointer text-[14px]">
            <input v-model="defaultValue.type" type="radio" name="default" value="null" class="accent-primary">
            <span>NULL</span>
         </label>

         <!-- AUTO_INCREMENT -->
         <label v-if="customizations.autoIncrement" class="flex items-center gap-2 cursor-pointer text-[14px]" :class="{ 'opacity-50 cursor-not-allowed': !canAutoincrement }">
            <input
               v-model="defaultValue.type"
               type="radio"
               name="default"
               value="autoincrement"
               :disabled="!canAutoincrement"
               class="accent-primary"
            >
            <span>AUTO_INCREMENT</span>
         </label>

         <!-- expression -->
         <div class="grid grid-cols-[140px_1fr] items-center gap-2">
            <label class="flex items-center gap-2 cursor-pointer text-[14px]">
               <input v-model="defaultValue.type" type="radio" name="default" value="expression" class="accent-primary">
               <span>{{ t('database.expression') }}</span>
            </label>
            <Input
               v-model="defaultValue.expression"
               :disabled="defaultValue.type !== 'expression'"
               type="text"
               class="!h-[32px] !text-[14px]"
            />
         </div>

         <!-- ON UPDATE -->
         <div v-if="customizations.onUpdate" class="grid grid-cols-[140px_1fr] items-center gap-2">
            <Label class="!text-[14px] !text-muted-foreground !font-normal !m-0">
               {{ t('database.onUpdate') }}
            </Label>
            <Input v-model="defaultValue.onUpdate" type="text" class="!h-[32px] !text-[14px]" />
         </div>
      </form>
   </template>
</ConfirmModal>
```

### Script 改動

新增 imports：`Input`、`Label`（`Button` 已有）。

### Acceptance

- [ ] 4 種 radio（noval / custom / null / autoincrement / expression）切換正確
- [ ] custom / expression input 在對應 radio 未選時 disabled
- [ ] autoincrement radio 在 `!canAutoincrement` 時 disabled
- [ ] 從預設值欄位 double-click → modal 開 → 改值 → 確認 → row.default 真的寫入

---

## C. 執行順序與 commit 切分

| step | scope | commit message |
|---|---|---|
| 1 | B1 sticky 操作欄 | `feat(props-table): sticky operation column` |
| 2 | B2 DdlModal 收尾 | `refactor(props-table-ddl): drop spectre d-flex` |
| 3 | B3 EditModal | `refactor(props-table-edit): shadcn-vue migration` |
| 4 | B4 IndexesModal | `refactor(props-table-indexes): shadcn-vue migration` |
| 5 | B5 ForeignModal | `refactor(props-table-foreign): shadcn-vue migration` |
| 6 | B6 ChecksModal | `refactor(props-table-checks): shadcn-vue migration` |
| 7 | B7 預設值彈窗 | `refactor(props-table-row): shadcn-vue default-value modal` |

**每 commit 前必跑：**
- `pnpm lint`（pre-commit hook 會跑，但提早跑）
- `git status` 確認沒有 debug-*.png / current-snap.yml 漏進去
- 手動 vite dev 開該 modal smoke 一輪（記憶 `feedback_vue_sfc_needs_runtime_smoke.md`）

---

## D. 邏輯不動清單（自我檢查）

對每個檔案改完，最後跑一次 diff 看下列是否完全沒被動：

- [ ] `defineProps` / `defineEmits` 介面 1:1
- [ ] `ref()` / `reactive()` / `computed()` 宣告與依賴
- [ ] `onMounted` / `onUnmounted` 內部呼叫
- [ ] async handler（`translateDescription` / `getRefFields` / `confirmIndexesChange` / …）函式 body 不變
- [ ] event handler 名稱與綁定 event 一致（@click / @click.prevent / @blur / @dblclick / @change）
- [ ] i18n key 不變

如果上面有任何一項被動到 → **rollback 該動作，回頭只動樣式**。

---

## E. F 區決策回填

使用者「全部都要改掉」一句話即解：

- F1 sticky 背景色 → `var(--background)`，hover row 用 `var(--accent)`（B1 已內定）
- F2 引入 shadcn Select → **不引入**，B5 仍用 `BaseSelect` wrapper（保持 phase 2 純樣式遷移）
- F3 RadioGroup → **不引入**，B7 用 native `<input type="radio">` + Tailwind `accent-primary`
- F4 ChecksModal → **做**（B6 一起遷）
