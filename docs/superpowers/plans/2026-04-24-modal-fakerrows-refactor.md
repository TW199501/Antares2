# ModalFakerRows 重構計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` when implementing task-by-task. Checkboxes (`- [ ]`) track progress. **Do NOT start coding until each [Open question] has a confirmed answer from the user.**

**Goal:** 重構 `src/renderer/components/ModalFakerRows.vue`（「插入資料」Modal），統一字級、強化 UX、把系統資料庫新增功能鎖起來，以及在欄位標籤顯示中文 comment。

**Scope:** 只動這一個 Modal 元件 + 觸發按鈕的 `v-if` 條件 + 需要的 customizations flag。不動 sidecar、後端 insert 邏輯、也不動 Table data 顯示元件。

**Tech Stack:** Vue 3 `<script setup>` + Tailwind v4 + **shadcn-vue `Dialog`**（`@/components/ui/dialog`）+ 既有 i18n。不使用 spectre `.modal-container`——本元件完整遷移到 shadcn。

## 使用者決策（2026-04-24 已確認）

- **Q1 = b**：移除批次 `nInserts`，純做 1 筆
- **Q2 = b**：disabled + tooltip
- **Q3 = 要看效果**：先實作方案 B（雙層堆疊），完成後由使用者視覺驗收，若不合格再切 A 或 C
- **Q4 = 強制走 shadcn Dialog**：專案既定方向，不列為選項

---

## 問題背景（為什麼重構）

使用者 2026-04-24 用 SpecSnap 量測 Modal 三個元素，回報三個 UI 問題 + 一個權限問題：

| # | 現況 | 期望 |
|---|------|------|
| 1 | Modal 內字級 **16px**（SpecSnap 三個 frame 都 `font-size: 16px`，來自 spectre `.form-label` / `.form-input` 的 `0.8rem`，以 20px root 換算=16px） | **14px** 全面統一 |
| 2 | 標題固定顯示 `t('database.insertRow', 2)` → 「插入多行」，但使用者實際用法是「一次 1 筆」 | 標題語意要跟實際行為對齊（見 Open Q1） |
| 3 | 欄位 label 只顯示英文欄位名（`field.name`），comment 看不到 | 右邊/旁邊帶上中文 comment（見 Open Q3） |
| 4 | 系統資料庫（SQL Server 的 `master` / `msdb` / `model` / `tempdb` 等）也能按「新增」 | 系統庫應該**完全禁止 insert**，按鈕 disabled 或隱藏 |

---

## 規則定義（寫死、以後爭議看這邊）

### R1｜字級（Typography）

| 元素 | 字級 | Tailwind 寫法 |
|------|------|---------------|
| Modal 標題（`.modal-title`） | **14px** | `!text-[14px]` |
| 表單 label（欄位名 + comment） | **14px** | wrapper 加 `[&_.form-label]:!text-[14px]` |
| 表單 input / select | **14px** | wrapper 加 `[&_.form-input]:!text-[14px] [&_.form-select]:!text-[14px]` |
| 欄位類型 tag（`.field-type`） | **12px** | `text-[12px]`（原本 `0.6rem`=12px，視覺上要比 label 小） |
| Footer 按鈕 | **14px** | 跟 Toolbar Button 一致 |

**Why 用 `!` 跟 `[&_…]`：** 依 `CLAUDE.md`「Beating spectre class specificity」規則，`.form-label` / `.form-input` 有 literal-px font-size 會贏過 Tailwind utility。用祖先 wrapper 的 attribute-selector arbitrary variant 一次搞定整個 Modal。

### R2｜形狀（Radius）

依 `docs/ui-spec.md`:
- 表單 input / select / checkbox：`rounded-md`（6px）
- 按鈕：沿用 shadcn Button 內建 `rounded-md`
- Dialog container：shadcn `DialogContent` 預設 `rounded-lg`（8px），不 override

### R-UI｜整個 Modal 走 shadcn，不用 spectre

強制全面使用 `@/components/ui/dialog` 的 shadcn 元件組：

| 原 spectre | 新 shadcn |
|-----------|----------|
| `<div class="modal active">` + `<div class="modal-overlay">` + `<div class="modal-container">` | `<Dialog>` + `<DialogContent>` |
| `<div class="modal-header">` + `<div class="modal-title h6">` | `<DialogHeader>` + `<DialogTitle>` |
| `<div class="modal-body">` | DialogContent 的 body slot（直接放內容，不需專屬 class） |
| `<div class="modal-footer">` | `<DialogFooter>` |
| `<a class="btn btn-clear">` 關閉叉叉 | `<DialogClose>`（內建） |
| `<form class="form-horizontal">` | 保留 `<form>`，但移除 spectre `form-horizontal`，用 Tailwind grid/flex 控版面 |
| `<button class="btn btn-primary">` | `@/components/ui/button` 的 `<Button variant="default">` |
| `<button class="btn btn-link">` | `<Button variant="ghost">` 或 `variant="link">` |
| `<input class="form-input">` | `@/components/ui/input` 的 `<Input>`（注意 Input.vue 本地已補 `text-foreground`——CLAUDE.md 規則） |
| `<label class="form-label">` | `@/components/ui/label` 的 `<Label>` |
| `<label class="form-checkbox">` + `<input type="checkbox">` | `@/components/ui/checkbox` 的 `<Checkbox>` |
| `<BaseSelect>`（spectre） | `@/components/ui/select` 的 `<Select>`（確認元件存在；不在則保留 BaseSelect 但視為 tech debt） |
| 移除 `<Teleport to="#window-content">` | shadcn Dialog 內建 Teleport，不需手動包 |

`FakerSelect.vue` 內部若還用 spectre class 不在本計畫 scope——單元件遷移另起 PR，本計畫維持「包在外面一層 Tailwind wrapper 把字級壓到 14」的做法。

### R3｜高度（Height）

- Input / select：**32px**（`!h-[32px]`）— 對齊 `ui-spec.md` 的「Standard form control」慣例
- Footer 按鈕：**32px**
- Modal 最大寬：維持 `max-width: 800px`

### R4｜系統資料庫偵測

新增 `common/customizations/*.ts` 的 `systemSchemas: string[]` 欄位，每個 client 定義自己的保留名：

| Client | `systemSchemas` |
|--------|----------------|
| `mssql` | `['master', 'model', 'msdb', 'tempdb']` |
| `mysql` / `maria` | `['mysql', 'information_schema', 'performance_schema', 'sys']` |
| `pg` | `['postgres', 'template0', 'template1']`（＋ schema 層 `information_schema`, `pg_catalog`） |
| `sqlite` | `[]`（單檔，不適用） |
| `firebird` | `[]`（待確認） |

比對規則：`customizations.systemSchemas.includes(props.schema)`（大小寫敏感；SQL Server 大小寫不敏感但名字都是 lowercase，先不特別處理，若有人改連線 server collation 再補）。

### R5｜Comment 顯示格式

Modal 標籤格式（見 Open Q3，三個方案）：

**方案 A — 括號並列：** `xserver_name (伺服器名稱)`
- 優點：一行搞定，緊湊
- 缺點：comment 長就擠

**方案 B — 雙層堆疊：**
```
xserver_name
伺服器名稱           ← 12px, muted-foreground
```
- 優點：長 comment 不擠
- 缺點：Modal 每一列變高，總高度變大

**方案 C — 依 `useCommentHeader` 狀態切換（跟 Table 頁面一致）：**
- 預設顯示英文欄位名
- 使用者按下 A/中 toggle（或 Modal 裡放一個小切換）後 label 變中文 comment
- 跟 `WorkspaceTabQueryTable.headerLabel()` 邏輯呼應

→ **推薦方案 B**（一次看到兩個資訊、長 comment 不擠），但等使用者確認。

### R6｜按鈕 `@click` 的 `v-if` 規則

`src/renderer/components/WorkspaceTabTable.vue` 第 43 行目前：

```vue
<Button v-if="isTable && !connection.readonly" ...>
```

改為：

```vue
<Button v-if="isTable && !connection.readonly && !isSystemSchema" ...>
```

其中 `isSystemSchema` = `computed(() => (customizations.value.systemSchemas ?? []).includes(props.schema))`

額外：若 button 被隱藏，可考慮顯示 tooltip「系統資料庫不可新增資料」提示使用者（見 Open Q2）。

---

## 待視覺驗收項目

Q3 使用者要求「要看效果」→ 實作方案 **B（雙層堆疊）** 後讓使用者視覺驗收。若不合格再切 A（括號）或 C（toggle）。

---

## Implementation

### Task 1 — 新增 systemSchemas customization

- [ ] 修 `src/common/interfaces/customizations.ts`：加 `systemSchemas?: string[]`
- [ ] 修 `src/common/customizations/defaults.ts`：加 `systemSchemas: []`
- [ ] 修 `src/common/customizations/sqlserver.ts`：`systemSchemas: ['master', 'model', 'msdb', 'tempdb']`
- [ ] 修 `src/common/customizations/mysql.ts`：`systemSchemas: ['mysql', 'information_schema', 'performance_schema', 'sys']`
- [ ] 修 `src/common/customizations/postgresql.ts`：`systemSchemas: ['postgres', 'template0', 'template1']`
- [ ] `sqlite.ts`、`firebird.ts` 不加（用 defaults 的空陣列）

### Task 2 — Toolbar Add 按鈕 disabled + tooltip（Q2=b）

- [ ] 修 `WorkspaceTabTable.vue`：加 `isSystemSchema` computed
- [ ] 按鈕從 `v-if` 改 `:disabled="isQuering || isSystemSchema"`（保留按鈕、灰掉）
- [ ] 加 `:title` / tooltip 顯示「系統資料庫不可新增資料」（系統庫時）
- [ ] i18n key：`application.systemSchemaReadonly` = 「系統資料庫不可新增資料」、`en-US.json` 先，再 `pnpm translation:check` 補其他 locales

### Task 3 — 把 Modal 完整改寫為 shadcn Dialog（R-UI）

參考專案既有 shadcn Dialog 使用範例（`src/renderer/components/` 下 Phase 1 已遷移的 Modal）。

- [ ] import `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter`, `DialogClose` from `@/components/ui/dialog`
- [ ] import `Button` from `@/components/ui/button`
- [ ] import `Input`, `Label`, `Checkbox`（確認元件存在）
- [ ] 完整重寫 template（移除 `.modal-container`, `.modal-header`, `.modal-body`, `.modal-footer`, `.btn btn-primary`, `.form-input`, `.form-label`, `.form-checkbox` 全部）
- [ ] 移除 `<Teleport to="#window-content">`（shadcn Dialog 內建）
- [ ] 移除 `useFocusTrap`（shadcn DialogContent 內建）
- [ ] Dialog 開關 binding 到外層的 `isFakerModal` — shadcn Dialog 用 `v-model:open`，對應 `WorkspaceTabTable.vue` 需要微調 `@hide` 改 `@update:open`
- [ ] 加 `class="max-w-[800px]"` 維持寬度
- [ ] 字級 14px 全面套到 DialogContent：`class="max-w-[800px] !text-[14px]"`，不需要 `[&_.form-label]:...` hack 因為全 shadcn 元件內建 `text-sm`

### Task 4 — 移除批次 nInserts（Q1=b）

- [ ] 移除 template 第 60–85 行的 `nInserts` input group 連同 tooltip 跟 faker locale select
- [ ] 移除 `const nInserts = ref(1)` + 對應 `watch`
- [ ] `insertRows()` 內 `repeat: nInserts.value` 改成 `repeat: 1`（或乾脆後端 default=1，移除 param——依後端支援情況）
- [ ] Dialog 標題：`<DialogTitle>{{ t('general.insert') }}{{ t('database.row', 1) }}</DialogTitle>` → 「插入資料」
- [ ] `hasFakes` / `fakerLocale` 若完全沒地方用了（因為 locale select 被移除）也一起清掉；若後端仍讀 locale 則保留 ref 但介面不露出

### Task 5 — Comment 顯示方案 B（雙層堆疊）

- [ ] 欄位 Label 結構：
  ```vue
  <Label :for="field.name" class="flex flex-col gap-0.5 !text-[14px]">
    <span>{{ field.name }}</span>
    <span
      v-if="field.comment"
      class="text-[12px] text-muted-foreground font-normal"
    >{{ field.comment }}</span>
  </Label>
  ```
- [ ] 相對應的欄位 grid/flex 版面若因 label 變高而歪掉，調整 `items-start` 讓 label top-align

### Task 6 — 視覺驗收（使用者 + SpecSnap）

- [ ] `pnpm vite:dev` 起來
- [ ] 連線 SQL Server，進入 `master` DB：Add 按鈕應該 disabled，hover tooltip 顯示「系統資料庫不可新增資料」
- [ ] 切到使用者建的 DB（如 `AdminNET`）→ 開一張有中文 comment 的表 → 按 Add
- [ ] 用 SpecSnap 量測三個元素：Dialog 標題、Label 英文列、Input
  - 預期：`font-size: 14px`（英文欄位名 + Dialog 標題）、`12px`（中文 comment）
  - 預期：Label 雙層顯示 name 上、comment 下
  - 預期：單筆行為（footer 只剩 Insert + Close 兩顆按鈕，無 nInserts、無 faker locale）
- [ ] 使用者視覺確認 Q3 方案 B 是否合意；若不合再切方案 A/C（快速改動）
- [ ] 截圖貼回本 plan「Verification」段落

### Task 7 — lint + 提交

- [ ] `pnpm vue-tsc --noEmit`（型別安全）
- [ ] `pnpm lint:fix`
- [ ] Commit 拆分建議：
  1. `feat(customizations): add systemSchemas to prevent inserts on reserved DBs`
  2. `refactor(modal-insert): migrate ModalFakerRows from spectre to shadcn Dialog`
  3. `feat(modal-insert): show Chinese comment beside field name` + `feat(modal-insert): simplify to single-row insert`（可合併到 (2)）

---

## Verification（實作後補）

**[ ] Task 6 完成後把 SpecSnap 量測截圖或 markdown 貼這裡**

---

## 非目標（out of scope）

- **不**改 Table Header comment 顯示邏輯（`WorkspaceTabQueryTable` 已有 A/中 toggle）
- **不**改後端 `insertTableFakeRows` API
- **不**改 SQLite / Firebird 的 customizations（暫無系統庫概念）
- **不**換成 shadcn Dialog（見 Q4）
- **不**碰 spectre → tailwind 大遷移；這次只在 Modal 範圍內用 `!` 蓋字級
