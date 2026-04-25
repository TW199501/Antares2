# 屬性頁籤 shadcn-vue 遷移：Phase 1（純視覺對齊）

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` when implementing task-by-task. Checkboxes (`- [ ]`) track progress. **不寫程式之前先逐一確認 Out-of-Scope 清單沒有踩到。**

**Goal:** 把屬性（Properties / 表結構）頁籤的視覺從 spectre.css 對齊到 shadcn-vue + Tailwind v4 設計語言，**只動樣式、不動行為、不動文字**。對齊基準是使用者 2026-04-26 提供的截圖（`code_items` / `allowance_items` 表結構畫面）。

**Scope:** 三個檔案的 `<template>` class、`<style>` 區塊（如有 SCSS 殘留則只保留 inline-edit 必要的，其餘一律改 Tailwind utilities）：

*   `src/renderer/components/WorkspaceTabPropsTable.vue` — toolbar + table-level form group（名稱 / 註釋 / 自增 / 排序規則）
*   `src/renderer/components/WorkspaceTabPropsTableFields.vue` — 表頭 thead 文字樣式
*   `src/renderer/components/WorkspaceTabPropsTableRow.vue` — fields table 每一列的 cell 樣式 + chip 樣式 + inline edit input 樣式

**Tech Stack:** Vue 3 `<script setup>` 原檔不變 + Tailwind v4 utilities + 既有 shadcn primitives (`@/components/ui/{button,input,label}`)。**不**改變 i18n key、**不**改 emit / props / computed / watcher，**不**動 Pinia state shape。

---

## 使用者決策（2026-04-26 已確認）

*   **Q0｜遷移範圍** = **小到不能再小**。只做樣式對齊，按下任何按鈕之後的行為（包含彈出 modal）保持原邏輯。
*   **Q1｜文字** = **不動**。任何 i18n key 的字面（保存/清除/新增/索引/外鍵/資料定義語言/排序/欄位名/類型/主鍵/自增/可空/長度/精度/FK/UQ/預設/註釋/排序規則/操作）這輪都不改，第二輪再說。
*   **Q2｜彈窗（Indexes / Foreign Keys / Table Checks / DDL / Edit Field / New Field Modal）** = **不動**。這輪只把「打開彈窗的入口按鈕」換樣式，彈窗內部留待後續輪次。
*   **Q3｜業務邏輯** = **完全不動**。dirty-check (`isChanged`) 比對流程、`localFields` ↔ `originalFields` 的 JSON.stringify 比對、inline edit 三件式狀態（`editingField` / `editingContent` / `originalContent`）、drag-drop、context-menu、autoIncrement / nullable toggle 互動，全部維持原狀。
*   **Q4｜shadcn primitive 取用範圍** = 限於 `Button` / `Input` / `Label`。**不**引入 `Select`（會與 inline edit 用的 `BaseSelect` 衝突，那是另一輪事）、**不**引入 `Checkbox`（屬性頁籤沒用）。

---

## Out-of-Scope（這輪明文不動）

*   ❌ **任何 i18n 文字** — `database.*` / `general.*` 的中英文字面不改
*   ❌ **按鈕 click 行為** — 保存 / 清除 / 新增 / 索引 / 外鍵 / 資料定義語言 / 編輯欄位 / 上下移欄位 / 刪除欄位的 handler 一行不動
*   ❌ **彈出視窗** — `WorkspaceTabPropsTableIndexesModal` / `ForeignModal` / `ChecksModal` / `DdlModal` / `WorkspaceTabPropsTableEditModal` / `ConfirmModal` 內部不動，這輪只動「打開它們的入口」
*   ❌ `**BaseSelect**` **元件** — 排序規則 (collation) / 引擎 (engine) / 類型 (type) 三處仍用 `BaseSelect`，本輪只調 wrapper class 不換 component
*   ❌ **drag-drop (**`**vuedraggable**`**) / 右鍵 context menu** — handle、event 鏈不動
*   ❌ **欄位刪除確認流程** — `removeFieldById` 行為與 modal 不動
*   ❌ **後端路由 / customizations / Pinia store** — sidecar、`/alterTable`、`workspace.customizations.*` 一行不動
*   ❌ `**WorkspaceTabPropsTableContext.vue**`**（右鍵選單）** — 內部不動
*   ❌ **欄位「預設值」彈窗（**`**isDefaultModal**`**）** — `WorkspaceTabPropsTableRow.vue` 內嵌的 default value modal，這輪不動

---

## 視覺對齊規則（寫死、以後爭議看這邊）

對齊基準：CLAUDE.md 的 ui-spec + ModalFakerRows 已建立的 32px row / 14px text 規範。

### R1｜Toolbar 按鈕（`WorkspaceTabPropsTable.vue` 上方）

| 來源樣式 | 目標 |
| --- | --- |
| `btn btn-primary btn-sm` (保存) | `<Button variant="default" size="sm" class="h-[32px] !text-[14px]">` |
| `btn btn-link btn-sm` (清除) | `<Button variant="outline" size="sm" class="h-[32px] !text-[14px]">` |
| `btn btn-dark btn-sm` (新增 / 索引 / 外鍵 / 資料定義語言) | `<Button variant="secondary" size="sm" class="h-[32px] !text-[14px]">` |
| `BaseIcon size=24` | `BaseIcon size=16`（與 ModalFakerRows 的 close-X / Insert 按鈕一致；`mdiKey` 的 `:rotate="45"` prop 保留） |
| `class="loading"` (保存按鈕的旋轉狀態) | 不動行為，外觀走 `:disabled` + 既有 `class="loading"` 暫留（spectre 的 loading SVG 仍會顯示，不破壞流程；後續輪次再換 shadcn spinner） |
| `divider-vert py-3` | `class="mx-1 h-[20px] w-px bg-border"` |
| 右側 schema 顯示 `d-flex` + `mdiDatabase` | `class="ml-auto flex items-center gap-1 text-[13px] text-muted-foreground"` |

### R2｜Table-level form group（名稱 / 註釋 / 自增 / 排序規則）

| 來源 | 目標 |
| --- | --- |
| `<div class="container ...">` 外層 | `<div class="px-4 pt-2 pb-3">` — 拿掉 `.container [&_...]:!text-[14px]` 那串 specificity hack（spectre `.form-input` 字級會被新 `<Input>` 取代後不再需要） |
| `<div class="columns mb-4">` | `<div class="flex flex-wrap items-end gap-3 mb-3">` |
| `<div class="column col-auto">` 包欄位 | `<div class="flex flex-col gap-1">`（auto 寬度照欄位內容自然撐） |
| `<div class="column">` 包註釋（占滿剩餘） | `<div class="flex flex-col gap-1 flex-1 min-w-[240px]">` |
| `<label class="form-label">` | `<Label class="!text-[12px] !text-muted-foreground !font-normal !m-0">` — 對齊截圖那種「灰色小字 label 在 input 上方」的視覺 |
| `<input class="form-input">` | `<Input class="!h-[32px] !text-[14px]">` — 用 shadcn `Input`，但用 `!h-[32px]` 蓋掉預設 34px 對齊 ModalFakerRows |
| `<BaseSelect class="form-select" />` (collation / engine) | \*\*保留 `BaseSelect`\*\*，wrapper 加 `class="[&_.form-select]:!h-[32px] [&_.form-select]:!text-[14px]"` 蓋掉 spectre 高度與字級 |
| `<input type="number">` 自增欄位的 `:disabled="...autoIncrement === null"` 邏輯 | **保留**，只換 class |

### R3｜Fields table 表頭（`WorkspaceTabPropsTableFields.vue` thead）

| 來源 | 目標 |
| --- | --- |
| `<div class="thead">` / `<div class="tr">` / `<div class="th ...">` | **DOM 結構不變**（drag/scroll/column-resize 都靠這些 class，現在改了會炸）。只改 cell 內 `<div class="table-column-title">` 的字級 → 加 `class="!text-[12px] !font-medium !text-muted-foreground !uppercase tracking-wide"` |
| `text-right` 那格（排序） | 維持 `text-right` |
| `column-resizable min-100` / `min-120` | 維持 — column resize 行為靠這些 SCSS class |
| 欄位文字（i18n） | **不動** |

### R4｜Fields table row（`WorkspaceTabPropsTableRow.vue` 每一列）

| 來源 | 目標 |
| --- | --- |
| `<div class="tr">` / `<div class="td p-0 ...">` | **DOM 結構不變**。row 高度從 spectre 的 `1.8rem (=36px)` 透過 SCSS `.tr { min-height: 32px }` 統一壓到 32px |
| `<span class="cell-content">` | 加 `class="text-[14px]"` 統一字級 |
| 字段名 / 默認值 / 描述 / 排序規則 cell 的 `class="form-input input-sm px-1"` (inline edit input) | 改用 ModalFakerRows 同款 `inputClass` 概念：`class="h-[28px] w-full rounded-md border border-input bg-background px-1 text-[14px] text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"`。**注意 row inline edit 用 28px 不是 32px** — 必須在 row 內留 padding，不會撐爆 td 高度 |
| 類型 / 排序規則 cell 的 `BaseSelect class="form-select editable-field pl-1 pr-4 small-select"` | \*\*保留 `BaseSelect`\*\*，wrapper / class 維持，僅 wrapper td 加 `class="[&_.form-select]:!h-[28px] [&_.form-select]:!text-[14px]"` |
| `field-chip` (主鍵/自增/可空/UQ/FK 的「是/否」膠囊) — 5 種色態：`chip-key-primary` (藍是) / `chip-active` (綠是) / `chip-null-active` (綠是) / `chip-inactive` (橘紅否) / `chip-disabled` (灰禁) / `chip-key-unique` (綠 UQ) / `chip-key-fk` (橘 FK) | **顏色語義保留** — 截圖那套「藍是 / 綠 UQ / 橘紅否」是 antares2 的視覺識別。SCSS class 留著但把對應規則用 Tailwind 重寫的 `:class` 表達式直接寫在 element： |
| `<span :class="['inline-flex items-center justify-center h-[20px] min-w-[28px] px-1.5 rounded text-[11px] font-medium', isPrimaryKey ? 'bg-blue-100 text-blue-700' : 'bg-orange-50 text-orange-600']">是/否</span>` |   |
| **這是這輪唯一允許新建的 styling pattern**，因為截圖 chip 視覺是核心識別元素，必須對齊 |   |
| `op-btn` (上移/下移/編輯/刪除) | `<Button variant="ghost" size="icon" class="h-[24px] w-[24px]">` + `BaseIcon size=14` 維持 |
| `cell-readonly` (長度欄位當 type 不支援 length 時的灰態) | 加 `class="text-muted-foreground cursor-not-allowed"` 即可 |

### R5｜不要做的事

*   ❌ 把 `<div class="tr/td">` 改成 `<table><tr><td>` — drag-drop 與 column-resize 會壞
*   ❌ 把 `BaseSelect` 換成 shadcn `Select` — Phase 2 才做
*   ❌ 把 inline edit 改成「點一下開 popover」— 雙擊直接編輯這個 affordance 不能變
*   ❌ 拿掉 `class="loading"` / `class="form-input"` 等 spectre class **如果它們還被 SCSS 樣式或 JS 程式碼引用** — 一律先 grep 確認沒人用才能拆
*   ❌ 動任何 emit / props / `defineExpose`

---

## 實作步驟（建議 commit 切法）

每一步完成後先用 `pnpm tauri:dev` 在屬性頁籤手動驗收（開一張表 → 切到屬性頁籤 → 雙擊欄位編輯 → 改完按保存或清除）才進下一步。

### Step 1｜Toolbar 按鈕對齊

*   在 `WorkspaceTabPropsTable.vue` 把 8 顆 `btn btn-*` 換成 `<Button variant="..." size="sm">`
*   `BaseIcon size=24` → `size=16`
*   `divider-vert py-3` → `<div class="mx-1 h-[20px] w-px bg-border" />`
*   右側 schema 區塊 class 改 Tailwind
*   驗收：所有按鈕 click 仍走原 handler；保存按鈕 disabled 邏輯仍然在；外觀與 ModalFakerRows footer 按鈕同一視覺密度

### Step 2｜Table-level form group 對齊

*   `WorkspaceTabPropsTable.vue` 中 `<div class="container ...">` 外層 → Tailwind utilities
*   `<div class="columns mb-4">` → `flex flex-wrap items-end gap-3 mb-3`
*   4 個 `column` cell（名稱 / 註釋 / 自增 / 排序規則）→ shadcn `<Label>` + `<Input>`，`BaseSelect` 留著只加 wrapper class
*   自增欄位 `:disabled` 邏輯保留
*   驗收：value v-model 仍會更新 `localOptions`；`isChanged` computed 仍能感應變化

### Step 3｜Fields table thead 文字對齊

*   `WorkspaceTabPropsTableFields.vue` 每個 `<div class="table-column-title">` 加 `!text-[12px] !font-medium !text-muted-foreground !uppercase tracking-wide`
*   DOM 結構與 i18n 文字維持原狀
*   驗收：column resize 仍然能拖；表頭與 row 對齊不偏

### Step 4｜Fields table row cell 樣式對齊（除 chip 外）

*   `WorkspaceTabPropsTableRow.vue` 每個 `cell-content` `<span>` 加 `text-[14px]`
*   4 處 inline edit `<input>` 的 class（字段名 / 長度 / 精度 / 註釋）改 ModalFakerRows 風格但高度 28px
*   2 處 `BaseSelect` (類型 / 排序規則) wrapper 加 `[&_.form-select]:!h-[28px] [&_.form-select]:!text-[14px]`
*   `cell-readonly` 加 `text-muted-foreground cursor-not-allowed`
*   驗收：雙擊任一 cell 仍能進入編輯態；blur 仍能 commit；Esc 仍能取消（或維持原行為）

### Step 5｜Fields table chip 對齊（這輪最關鍵的視覺改變）

*   `WorkspaceTabPropsTableRow.vue` 5 處 `field-chip` 用 Tailwind 重寫 `:class`：
    *   主鍵 chip：`isPrimaryKey ? 'bg-blue-100 text-blue-700' : 'bg-orange-50 text-orange-600'`
    *   自增 chip：`localRow.autoIncrement ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-50 text-orange-600'` (+ `chip-disabled` 樣式對應 `!canAutoincrement`)
    *   可空 chip：`localRow.nullable ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-50 text-orange-600'` (+ disabled 同上)
    *   UQ chip：`bg-emerald-100 text-emerald-700`
    *   FK chip：`bg-orange-100 text-orange-700`
    *   共用底樣：`inline-flex items-center justify-center h-[20px] min-w-[28px] px-1.5 rounded text-[11px] font-medium`
    *   disabled 態：`opacity-50 cursor-not-allowed`
*   `<style scoped>` 內若有未被引用的 `.field-chip*` SCSS 規則一律刪除
*   驗收：截圖那 4 列（id PK 是、allowance\_id UQ、可空 否/是、自增 否）視覺與舊版完全對得上；點擊 toggle 行為不變

### Step 6｜Action 按鈕（上下移/編輯/刪除）對齊

*   `op-btn` 的 4 顆 `<button class="btn btn-link btn-sm op-btn">` 換 `<Button variant="ghost" size="icon" class="h-[24px] w-[24px]">`
*   `BaseIcon size=14` 維持
*   驗收：點擊行為（emit move-up/down、開 EditModal、emit remove-field-row）一行不動

### Step 7｜SCSS 清理

*   grep 確認哪些 `.field-chip*` / `.op-btn` / `.cell-content` SCSS 規則被新 class 取代後孤兒化，刪除
*   保留：`.column-resizable` (column resize 必要)、`.vscroll`、`.min-100/120`、`.th-order/chip/num/scale/ops` (表頭固定寬度)、`.editable-field` (如還有 selector 引用)
*   驗收：拉動 column 邊界仍能 resize；表頭寬度仍與 row 對齊

---

## 驗收 checklist（Phase 1 完成判準）

*   截圖比對：toolbar 按鈕視覺密度、字級、icon 尺寸與 ModalFakerRows footer 一致
*   截圖比對：table-level 4 個 form group 字級 14px、label 12px 灰色，與 ModalFakerRows 內 grid label 視覺風格一致
*   截圖比對：fields table 表頭文字小寫灰色、row cell 字級 14px、chip 顏色語義保留
*   行為驗收：開一張既有表（如 `allowance_items`）→ 雙擊欄位名 → 改 → blur → 「保存」按鈕亮起 → 按下 → 後端確實收到 alter
*   行為驗收：點「索引 / 外鍵 / 資料定義語言」→ 對應 modal 仍開啟、內容正常
*   行為驗收：drag 欄位排序仍能拖動
*   行為驗收：右鍵 context menu 仍開啟
*   行為驗收：「自增」「可空」chip 點擊仍能 toggle
*   `pnpm exec vue-tsc --noEmit` 無 error
*   `pnpm lint` 無 new error

---

## Phase 2 預告（這輪不做）

*   文字 i18n 重新檢視（你說「第二輪再改文字」）
*   `BaseSelect` → shadcn `Select` 遷移（影響 collation / engine / type 三處 + 全 app）
*   5 個 modal（Indexes / Foreign / Checks / DDL / EditField）內部 spectre → shadcn 遷移
*   inline-edit 三件式狀態能否化簡（`editingField` / `editingContent` / `originalContent` → 單一 `editing` ref）
*   chip 是否值得抽成 `<Chip variant="...">` 共用元件