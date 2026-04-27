# shadcn-vue Phase 2 — Full Renderer Migration Plan

**日期**：2026-04-28  
**狀態**：Planning（尚未執行）  
**前置**：[2026-04-17-shadcn-vue-migration-phase1.md](2026-04-17-shadcn-vue-migration-phase1.md) / [2026-04-26-props-tab-shadcn-phase2-audit.md](2026-04-26-props-tab-shadcn-phase2-audit.md)  
**最終目標**：移除 `spectre.css` 依賴，整個 renderer 由 shadcn-vue + Tailwind v4 主導；`html { font-size: 20px }` workaround 解除。

---

## 0\. 現況基線（2026-04-28 audit 結果）

| Tier | 數量 | 說明 |
| --- | --- | --- |
| A 純 shadcn | 2 | `BaseConfirmModal`、`ModalFakerRows` |
| B 部分遷移（shadcn + spectre 混用） | 11 | 需收尾 |
| C 全 spectre 未遷移 | 61 | Phase 2 主要工作 |
| D 邏輯元件 / 無 UI surface | 23 | n/a，但 `BaseSelect` 例外 |
| **總計** | **97** |   |

**完整檔案清單**（按批次分組）見 §3。

**spectre.css 入口**：`src/renderer/scss/main.scss` 共 59 個 `@import "~spectre.css/src/..."`，最終目標是把這個 import 鏈整段刪除。

**已存在的 shadcn-vue primitives**：`Button / Checkbox / Dialog / DropdownMenu / FormField / Input / Label / Select / Tabs`（9 個，位於 `src/renderer/components/ui/`）。

**需要新增的 primitives**（§1 詳列）：`Switch / Textarea / Tooltip / Sonner (toast) / ContextMenu / ScrollArea / Separator / Badge / Card / Popover / RadioGroup / Accordion`（12 個）。

---

## 1\. 不可協商的約束（Invariants）

每個批次都必須遵守，違反就 reject PR。

1.  **遷移時保留元件公開 API**：props / emits / slots 簽名不變；callers **同 PR 內不應該需要動**。Phase 1 的 `BaseConfirmModal` 就是這樣做的（16 callers 零修改）。
2.  **shadcn-vue CLI 絕不在 repo 內跑**。新 primitive 走「scratch dir 跑 CLI → 手抄到 `src/renderer/components/ui/<name>/` → 套用本 repo 的圖示 / 設計 token / 中文字型」流程，遵照 [docs/superpowers/rules/shadcn-vue-migration-recipe.md](../rules/shadcn-vue-migration-recipe.md)。
3.  \*\*不安裝 `lucide-vue-next`\*\*。所有圖示走 `BaseIcon` + `mdi*`。
4.  **設計 token 一律用 hex CSS variable**（`--background` 等），不要 `hsl(var(--background))`；遵照 `src/renderer/assets/tailwind.css` 的 `@theme inline` 規範。
5.  `**html { font-size: 20px }**` **還沒拔掉前**：用 `text-[12px]` / `text-[11px]` 等 arbitrary token 對齊 spectre-era 字級，**不要**用 `text-xs / text-sm`（會被 ×1.25 放大）。第 10 批 spectre 拔除後一次回收所有 arbitrary token。
6.  \*\*不直接編 `main.scss`\*\*。要打贏 spectre specificity 用 `[&_.form-input]:!text-[14px]` 這種 attribute selector + `!` 在 wrapper 上覆寫。
7.  **每個批次必須跑過** `**pnpm tauri:dev**` **實機測試**，不只 `vue-tsc`。Vue SFC 的 SCSS 變數 / Teleport / async import 不被 type check 抓。
8.  \*\*每批次更新 `docs/ui-spec.md`\*\*：新增的 primitive 用法、新發現的 token 用法。
9.  **commit 規範**：每批次至少一個 `refactor:` commit + 一個 `docs:` commit（spec 更新）。Single-scope commits 是 release notes 的依據。
10.  **i18n 不改 source of truth**：英文 string 改字面（如 `Add Field`）是允許的，但**不要**動 `en-US.json` 的 key 結構，避免 `pnpm translation:check` 跑出大批 diff。

---

## 2\. 前置工作（必做，**Batch 0**）

在進入 Batch 1 之前必須完成。所有後續批次依賴這些 primitive。

### 2.1 新增 12 個 shadcn-vue primitives

每個都遵守 §1 規則 5（hex token）/ 規則 3（BaseIcon swap）：

| Primitive | 用途 | 對應的 spectre 模式 |
| --- | --- | --- |
| `Switch` | Settings 布林切換 | `<input type="checkbox">` + `.form-switch` |
| `Textarea` | Note body / DDL view / query body | `<textarea>` + `.form-input` |
| `Tooltip` | 大量 icon button / 截斷文字 | spectre `data-tooltip` + `tooltip-bottom` 屬性 |
| `Sonner`（toast） | `BaseNotification` 替換 | spectre `.toast` |
| `ContextMenu` | 右鍵選單 | `BaseContextMenu` 自刻 + `.menu` |
| `ScrollArea` | 連線清單 / Explore bar 樹 | `overflow-y: auto` 手刻 |
| `Separator` | 分隔線 | spectre `.divider` / `.divider-vert` |
| `Badge` | 連線狀態 / 表 / 欄位 chip | spectre `.chip` |
| `Card` | 連線卡 / 設定卡 | spectre `.card` |
| `Popover` | 顏色選 / 細節彈出 | spectre `.popover` |
| `RadioGroup` | 設定群組 | `<input type="radio">` + `.form-radio` |
| `Accordion` | 設定區塊 / Explore tree | spectre `.accordion` |

**驗收**：每個 primitive 寫一個 `<!-- @usage -->` 範例 commit 在 `src/renderer/components/ui/<name>/<Name>.vue` 上，並且能在 `pnpm tauri:dev` 啟動時不爆 console error。

### 2.2 設計 token 補齊

對照 `pencil-new.pen`（透過 pencil MCP 開）盤點以下 token 是否在 `src/renderer/assets/tailwind.css` 的 `@theme inline { … }` 已宣告：

*   狀態色：`--success`、`--warning`、`--info`、`--danger` + 對應 `-foreground`
*   連線顏色 ↔ `application.color.*` 應該對應到 token（目前是 inline hex）
*   表 / 視圖 / 觸發器 / 函式等 db-icon 顏色，目前在 `_db-icons.scss`，spectre 拔除前要先轉成 token

### 2.3 ui-spec.md 擴充

新增「Phase 2 primitive coverage table」段落，把上面 12 個新 primitive 的「該用 / 不該用」場景寫清楚。這是給未來 Claude 的 contract — 沒寫進 spec 的 primitive 等於不存在。

### Batch 0 驗收 checklist

*   12 個 primitive 都建好且 `pnpm vue-tsc --noEmit` 過
*   `pnpm tauri:dev` 啟動正常，沒有 BaseIcon 或 token 解析錯誤
*   `tailwind.css` 補上缺的 token
*   `docs/ui-spec.md` 新增「Phase 2 primitive coverage」段落
*   commit message：`feat(ui): add Phase 2 shadcn-vue primitives` + `docs(ui-spec): document Phase 2 primitive coverage`

---

## 3\. 批次規劃（10 個 Batch）

每個 Batch 設計成獨立可 ship 的 PR，內部子任務有先後但不超過 1-2 天工作量。

---

### Batch 1 — `BaseSelect` 換 shadcn `Select`（53 callers 一次到位）

**目標**：把全 app 最高 leverage 的下拉選單統一。

**檔案**：`src/renderer/components/BaseSelect.vue`（單檔，但 53 個 callers 受惠）

**改法**：

*   保留外部 API（`v-model` / `options` / `placeholder` 等 props）。
*   內部 `<div>` 手刻替換為 `Select` + `SelectTrigger` + `SelectContent` + `SelectItem`。
*   注意 callers 傳 options 結構：可能有 `{ value, label }` 也可能有純字串陣列 — 需在內部 normalize。
*   shadcn-vue Select 的 keyboard a11y、search-as-you-type 是免費送的，要驗收。

**特殊風險**：

*   53 callers 中有些可能依賴 `BaseSelect` 的特殊 prop（如 `searchable`、`group-by`）— 先 grep 全部 props 用法。
*   Workspace tab 內的 column-type select（`WorkspaceTabPropsTableEditModal` 用）字段量可能上百，要驗證效能。

**驗收**：

*   grep 確認 53 callers 0 個需要改 prop
*   連線 panel + props-table 的 driver / type 下拉手測，鍵盤導覽 + 搜尋 OK
*   dark mode + light mode 視覺對齊 pencil 規格
*   Playwright e2e 全綠

**commits**：`refactor(base-select): migrate BaseSelect to shadcn-vue Select`

---

### Batch 2 — Tier B 11 個元件收尾

**目標**：把已經半路的元件 spectre 殘留拔乾淨。

**檔案**（11 個）：

*   `WorkspaceTabPropsTable.vue`、`WorkspaceTabPropsTableRow.vue`、`WorkspaceTabPropsTableEditModal.vue`
*   `WorkspaceTabPropsTableForeignModal.vue`、`WorkspaceTabPropsTableChecksModal.vue`、`WorkspaceTabPropsTableIndexesModal.vue`
*   `WorkspaceTabTable.vue`
*   `TheFooter.vue`
*   `WorkspaceEditConnectionPanel.vue`、`WorkspaceAddConnectionPanel.vue`
*   `WorkspaceTabQuery.vue`

**改法**：

*   把所有 `class="form-*"` 換成 `<FormField><Input/></FormField>` 或 `<Select>` 結構。
*   殘留的 `.modal` 換 `<Dialog>`（在 ChecksModal / ForeignModal / IndexesModal 已部分用 Dialog，要拔掉殘留的 `.modal-container` 等 spectre 殼）。
*   `TheFooter` 的 `.btn` 換 shadcn `Button`。
*   過程中發現的 inline spectre class 全部清掉。

**驗收（per file）**：

*   該檔內 `grep "btn\|form-\|modal\|tab-block"` 為 0
*   該檔仍 `import` 至少一個 `@/components/ui/`
*   dev mode 跑該功能（編表 / 加 foreign / 開 query / footer click）視覺與行為對齊 Phase 1

**commits**：每 2-3 個檔一個 `refactor(<area>): drop spectre residue from <files>` commit。

---

### Batch 3 — Settings & 系統 modal（10 個）

**目標**：設定相關 modal 全部換 shadcn。

**檔案**：

*   `ModalSettings.vue`（殼）
*   `ModalSettingsUpdate.vue`、`ModalSettingsData.vue`、`ModalSettingsDataImport.vue`、`ModalSettingsDataExport.vue`、`ModalSettingsShortcuts.vue`
*   `ModalConnectionAppearance.vue`、`ModalFolderAppearance.vue`
*   `DebugConsole.vue`、`ModalProcessesList.vue`

**改法**：

*   殼：`Dialog` + `Tabs`（settings 內部 6 個 tab）。
*   內部 form：`FormField` + `Input` / `Switch` / `Select` / `RadioGroup`。
*   ProcessesList 的表格保持當前實作（有自己的 virtual scroll），只換外殼。
*   DebugConsole 的 console 區用 `Card` + `Textarea` (readonly)。

**特殊風險**：

*   `ModalSettingsShortcuts` 用 `KeyPressDetector` — 確認 KeyPressDetector 仍可被 mount 在 shadcn `FormField` 內。
*   Settings 的「Apply」按鈕在 Sticky footer，用 `DialogFooter` + Tailwind sticky。

**驗收**：

*   所有設定切換、儲存、reset 流程 OK
*   dark / light theme 切換不破畫面
*   keyboard shortcut detection 在 ModalSettingsShortcuts 內仍可用
*   CJK 字型在所有 label / input 顯示正常

**commits**：3 個 commit — `refactor(modal-settings): shell` / `refactor(modal-settings): tabs` / `refactor(modal-settings): aux modals`。

---

### Batch 4 — Schema / 連線管理 modal（8 個）

**目標**：連線 + schema CRUD 流程全 shadcn。

**檔案**：

*   `ModalAllConnections.vue`（一個比較複雜的搜尋 + 表）
*   `ModalAskCredentials.vue`、`ModalAskParameters.vue`
*   `ModalNewSchema.vue`、`ModalEditSchema.vue`
*   `ModalImportSchema.vue`、`ModalExportSchema.vue`
*   `ModalHistory.vue`

**改法**：

*   殼一律 `Dialog`。
*   AllConnections 用 `Input`（搜尋）+ 自訂列表（不需 ScrollArea，因為已經用 BaseVirtualScroll）。
*   Ask\* 的「給密碼」/「給參數」流程用 `FormField` + `Input` + `BaseConfirmModal` 模式（cancel / confirm 兩鈕）。
*   Import/Export Schema 的檔案選擇按鈕用 `Button variant="outline"`。
*   ModalHistory 的時間軸保留現有渲染、外殼換掉。

**特殊風險**：

*   `ModalAskCredentials` 涉及密碼欄位，`Input type="password"` 要驗證 autofill / 手機輸入法行為。
*   Tauri FS 對話開啟（選 schema 檔）的事件鏈要在 dev + build 兩個模式都驗。

**驗收**：

*   從 sidebar 觸發 Add/Edit/Delete schema 的全流程 OK
*   AllConnections 開啟、搜尋、選擇、雙擊連線 OK
*   密碼輸入框遮罩、清空、貼上正常

---

### Batch 5 — Workspace Props 系列（13 個）

**目標**：所有「檢視 DB 物件屬性」的 tab 統一 shadcn。

**檔案**：

*   `WorkspaceTabPropsView.vue`、`WorkspaceTabPropsTrigger.vue`、`WorkspaceTabPropsTriggerFunction.vue`
*   `WorkspaceTabPropsScheduler.vue`、`WorkspaceTabPropsRoutine.vue`
*   `WorkspaceTabPropsMaterializedView.vue`、`WorkspaceTabPropsFunction.vue`
*   `WorkspaceTabPropsTableContext.vue`、`WorkspaceTabPropsTableDdlModal.vue`、`WorkspaceTabPropsTableFields.vue`
*   `WorkspaceTabPropsSchedulerTimingModal.vue`
*   `WorkspaceTabPropsRoutineParamsModal.vue`、`WorkspaceTabPropsFunctionParamsModal.vue`

**改法**：

*   共通結構：`Tabs`（屬性 / SQL / 等）+ `FormField` 群 + 底部 `Button` 列。
*   DDL view 用 `Card` + `Textarea readonly` + 複製按鈕。
*   ParamsModal 用 `Dialog` + `Card`（每個參數一張）+ 加 / 移按鈕。

**遷移策略**：先做 1 個（建議 `WorkspaceTabPropsView`），把 pattern 立起來，把抽象出來的小元件（如 `PropertyRow`、`SqlBlock`）放到 `src/renderer/components/workspace/props/`，然後其他 12 個套用同 pattern。

**特殊風險**：

*   每個 DB 物件的欄位差異大（trigger 有 timing / event，function 有 params / return），不要硬抽象成單一 Form。
*   Materialized view 的 refresh 按鈕視覺要區分（destructive variant）。

**驗收**：

*   連到 PostgreSQL 跟 MariaDB 各打開一個 view / trigger / function / scheduler 看畫面
*   Edit 改一個屬性、save、refresh，看 SQL 是否正確
*   DDL modal 複製按鈕 OK，readonly textarea 不可編

---

### Batch 6 — Workspace New 系列（9 個）

**目標**：建立 DB 物件的 tab 全部換掉。結構與 Batch 5 高度對稱。

**檔案**：

*   `WorkspaceTabNewView.vue`、`WorkspaceTabNewRoutine.vue`、`WorkspaceTabNewTriggerFunction.vue`
*   `WorkspaceTabNewMaterializedView.vue`、`WorkspaceTabNewTrigger.vue`
*   `WorkspaceTabNewFunction.vue`、`WorkspaceTabNewTable.vue`、`WorkspaceTabNewScheduler.vue`
*   `WorkspaceTabNewTableEmptyState.vue`

**改法**：

*   直接套 Batch 5 確立的 pattern。
*   `EmptyState` 用 `Card` + 中央圖示 + CTA `Button`。

**特殊風險**：

*   `WorkspaceTabNewTable` 的「新增欄位」流程已經在 Phase 2 audit commit `f6aac23` / `d3dd7e1` 之前的 modal 統一裡處理過，這次主要是把外殼 spectre 拔掉。
*   各 New tab 之間應該共享 `BaseTextEditor`（SQL body 編輯）— 不要每個都自己 wrap，沿用現有 BaseTextEditor instance 但外層 `Card` 包起來。

**驗收**：同 Batch 5。

---

### Batch 7 — Sidebar & Explore（10 個）

**目標**：左側 sidebar、設定 sidebar、Explore tree、context menu 全 shadcn。

**檔案**：

*   `TheSettingBar.vue`（左下角 cog）
*   `SettingBarConnections.vue`、`SettingBarConnectionsFolder.vue`
*   `WorkspaceExploreBar.vue`、`WorkspaceExploreBarSchema.vue`
*   `WorkspaceExploreBarTableContext.vue`、`WorkspaceExploreBarSchemaContext.vue`、`WorkspaceExploreBarMiscContext.vue`
*   `SettingBarContext.vue`
*   `BaseContextMenu.vue`（換成 shadcn `ContextMenu`）

**改法**：

*   連線清單用 `Card` + `ScrollArea` + Tooltip 顯示完整連線字串。
*   Folder 群組用 `Accordion`（可摺收連線群）。
*   所有右鍵選單統一走 `ContextMenu` primitive，把 `BaseContextMenu` 廢掉（標記 `@deprecated` 留 1 個 release 後刪）。
*   Explore tree 表 / 視圖 / 函式分組仍用 `Accordion` + 巢狀 `Button variant="ghost"`。

**特殊風險**：

*   Sidebar 是全 app 唯一一個整 session 都顯示的元件，視覺穩定性最重要 — Batch 7 開 PR 後**留 review window 1 週**，多人試用。
*   `BaseContextMenu` 廢掉前要 grep 所有 caller 確認都移到 `ContextMenu`。

**驗收**：

*   sidebar 連線增 / 改 / 刪 / 拖拉重排 OK
*   explore bar 點開表 / 視圖 / 函式分組正確
*   所有右鍵選單（連線、表、欄位、scratchpad note）皆顯示
*   keyboard shortcut（focus connection list、focus explore bar）仍 work

---

### Batch 8 — Scratchpad / Notes（4 個）

**目標**：scratchpad 區塊全 shadcn。

**檔案**：

*   `TheScratchpad.vue`（殼）
*   `ScratchpadNote.vue`（note 卡）
*   `ModalNoteNew.vue`、`ModalNoteEdit.vue`

**改法**：

*   殼用 `Card` + `ScrollArea`。
*   每個 note 卡用 `Card` + `Tooltip`（hover 顯示完整內容）。
*   Modal 用 `Dialog` + `Textarea`。

**驗收**：

*   加 / 改 / 刪 note OK
*   note 排序持久化

---

### Batch 9 — Notification / EmptyState / Shell（6 個）

**目標**：全 app 視覺化最後一塊。

**檔案**：

*   `App.vue`（全 app shell — 主要是把 inline spectre class 拔掉）
*   `Workspace.vue`
*   `BaseNotification.vue`（換 `Sonner`）
*   `KeyPressDetector.vue`（內部 input 換 shadcn `Input`）
*   `ForeignKeySelect.vue`、`FakerSelect.vue`（兩個 select 變體）

**改法**：

*   `BaseNotification` 整體換 `<Toaster />` + `toast.success(...)` 等 imperative API，廢掉 Pinia notification store 的 DOM 渲染（store 仍保留事件來源）。
*   兩個 Select 變體合併進 `BaseSelect`（已是 shadcn）的 `slot` 系統。

**驗收**：

*   連線成功 / 失敗 toast 出來
*   keyboard shortcut detector 仍捕鍵
*   foreign-key picker / faker picker 行為與 Phase 1 一致

---

### Batch 10 — Spectre 移除 + rem 解放

**目標**：刪 spectre，解除 `font-size: 20px` workaround，所有 arbitrary token 回收。

**步驟**：

1.  **驗證沒有殘留 spectre class**：`grep -rn "form-input\|form-select\|btn\|modal-container\|toast\|chip\|panel" src/renderer/components/*.vue` 應該為 0（除了 ui/ 內部的 Toggle 等專有名詞）。
2.  **刪除 main.scss 內 59 個 spectre import**，只留下：
    *   `_variables.scss`、`_transitions.scss`、`_data-types.scss`、`_table-keys.scss`、`_fake-tables.scss`、`_editor-icons.scss`、`_db-icons.scss`、`themes/*`
    *   確認 `data-types` / `table-keys` / `fake-tables` / `editor-icons` / `db-icons` 內**沒有**間接用到 spectre mixin / variable。如果有，把它們轉成 Tailwind utility 或 CSS custom property。
3.  \*\*解除 `html { font-size: 20px }`\*\*：刪掉 `main.scss` 內這條規則（如果沒有自訂則來自 spectre `_base.scss`，自動跟著消失）。
4.  **批次回收 arbitrary token**：grep `text-\[1[012]px\]` / `h-\[2[0-4]px\]` / `p-\[3px\]` 等 arbitrary 寫法，能對應到原生 Tailwind token 的（`text-xs`、`h-5`、`p-1`）批次替換。**不能對應到原生 token 的留著**（如 `text-[13px]` 沒有原生對應）。
5.  **package.json 移除**：`spectre.css` 從 dependencies 拔掉，`pnpm install` 重生 lockfile。
6.  **重 build sidecar bundle 測試一輪**：確認 `pnpm tauri:build` 出來的 installer 視覺正常、無 console error。
7.  **CLAUDE.md 改寫「UI stack」段落**：移除「shadcn-vue + spectre coexistence」整節，改成「全 shadcn-vue + Tailwind v4」單一段。同步更新 `docs/ui-spec.md`。

**驗收**：

*   `grep -rn "spectre" src/` 為 0（除 historical comments）
*   `pnpm vue-tsc --noEmit` 過
*   `pnpm test:e2e` 全綠
*   dark / light theme 切換無破畫面
*   Antares2 全功能 smoke test（連線 → 開表 → 改欄 → 跑 query → 看 history → 改 settings → 改 shortcut）OK
*   CHANGELOG 加上「removed spectre.css; html font-size restored to 16px」note

**commits**：

*   `refactor(scss): remove spectre.css imports`
*   `refactor(tailwind): reclaim arbitrary tokens to native tailwind`
*   `chore(deps): drop spectre.css`
*   `docs(claude-md): document migration completion`

---

## 4\. 驗收 Gate（每個 Batch 共用）

每個 PR 在 merge 前要過：

| Gate | 檢查 |
| --- | --- |
| 靜態 | `pnpm lint` + `pnpm vue-tsc --noEmit` |
| 翻譯 | `pnpm translation:check zh-TW` 與 `zh-CN` / `ja-JP` / `ko-KR`（不應出現新的 missing key） |
| Smoke | `pnpm tauri:dev` 跑該批次涉及的功能至少一輪 |
| e2e | `pnpm test:e2e`（如果該功能在 `tests/app.spec.ts` 內有覆蓋） |
| 視覺 | dark + light theme 兩種至少各看一次 |
| Spec 對齊 | 開 SpecSnap inspector 對量過去的元件 → 對齊 pencil-new.pen |
| CI | dev push 觸發 `test-build.yml` 4 平台全綠 |

---

## 5\. 風險登錄（Risk Register）

| # | 風險 | 觸發點 | 緩解 |
| --- | --- | --- | --- |
| R1 | `BaseSelect` 53 callers 行為不一致 | Batch 1 | 先 grep 全 props 用法、寫 5-6 個典型 caller smoke test |
| R2 | spectre 移除後某個畫面崩潰 | Batch 10 | 開 PR 後留 1 週 review window，多人試用 |
| R3 | `font-size: 20px` 解除影響非 Tailwind 的硬編字級 | Batch 10 | 全 grep `font-size:` / `\d+px` 找硬編，計畫內收掉 |
| R4 | shadcn-vue Dialog 與 Tauri window resize 互動異常 | Batch 3-4 | Phase 1 Dialog 已驗過 baseline；新 Modal 出現問題回退用 BaseConfirmModal |
| R5 | ContextMenu 在 Tauri webview 內鍵盤 nav 失效 | Batch 7 | 早期在 Batch 0 prep 時就驗，不要等 Batch 7 才發現 |
| R6 | i18n locale 漏字導致按鈕為空 | 各批次 | 每批次跑 translation:check，CI 也跑 |
| R7 | sidecar bundle 因 Vue chunk 大小破 500KB 警告變實質 OOM | 全程 | Batch 1 / 5 / 6 後跑一次 `pnpm tauri:build` 確認 dist 可載入 |
| R8 | 老 Pinia store（如 notification）改 toast 後事件序遺失 | Batch 9 | 改之前先用 SpecSnap 錄目前事件序當 baseline |

---

## 6\. 工作量估算

| Batch | 估時 | 備註 |
| --- | --- | --- |
| 0 prep | 2 天 | 12 個 primitive + token + spec |
| 1 BaseSelect | 1 天 | 單檔但驗 53 callers |
| 2 Tier B 收尾 | 1.5 天 | 11 檔，已有 baseline |
| 3 Settings | 2.5 天 | 10 檔，shell 結構複雜 |
| 4 Schema modal | 2 天 | 8 檔，多數結構簡單 |
| 5 Props 系列 | 3 天 | 13 檔，但 pattern 一致 |
| 6 New 系列 | 2 天 | 9 檔，沿用 Batch 5 pattern |
| 7 Sidebar | 3 天 | 10 檔，最高風險 |
| 8 Scratchpad | 1 天 | 4 檔，孤立 |
| 9 Notif/Empty | 1.5 天 | 6 檔 |
| 10 Spectre 移除 | 2 天 | 連同視覺對齊回歸 |
| **總計** | **~21.5 天** | 1 人 full-time |

並行化機會：Batch 4 / 5 / 6 / 8 互不相關，2 人可同步。

---

## 7\. 完成定義（Definition of Done）

整個 Phase 2 完成的硬性條件：

1.  `grep -rn "spectre" src/renderer/` 為 0（除 historical comments）
2.  `package.json` 不再有 `spectre.css` 依賴
3.  `html { font-size: 20px }` 不存在於任何 .scss / .css
4.  全部 97 → 74 可遷移元件（13 已遷 + 61 全未遷）皆狀態為「shadcn-vue migrated」
5.  CLAUDE.md 「UI stack」段落改寫，移除「coexistence」表述
6.  CHANGELOG 紀錄 spectre 移除 + breaking visual change（如果有）
7.  一個全功能 smoke test PR 文件（`docs/superpowers/specs/2026-XX-XX-shadcn-phase2-completion.md`）記錄所有驗收結果
8.  CI 4 平台全綠

---

## 8\. 回退（Rollback）策略

每個 Batch 都是獨立 PR、可獨立回退。

最壞情況：

*   Batch 10（spectre 移除）若引發大規模視覺問題，回退方法 = `git revert <commit>` 把 spectre 重新 import 回 main.scss，剩餘 Tailwind 樣式繼續存在不衝突。
*   個別元件若回退（如 Batch 7 sidebar），只需 revert 該檔，spectre class 還在 main.scss 所以視覺自動回歸。

**不可回退的點**：Batch 0 新增的 12 個 primitive 不應回退（後續批次依賴）；Batch 1 BaseSelect 不應回退（callers 太多）。

---

## 9\. 與其他工作的相依

*   **不能**與「`pencil-new.pen` 全面改版」並行（會造成設計依據浮動）
*   **可以**與「i18n 補翻譯」「sidecar 後端 feature」並行（不同 codepath）
*   **CI 必須先穩定**（已於 2026-04-28 commit `ee416f7` 修復 cross-platform build），否則每個批次的 4 平台驗證會卡住

---

## 10\. 附錄 A — 完整元件分類索引（74 個 in-scope）

### A.1 已純 shadcn（2，不在 scope）

1.  `BaseConfirmModal.vue`
2.  `ModalFakerRows.vue`

### A.2 Tier B 收尾（11，Batch 2）

1.  `WorkspaceTabPropsTable.vue`
2.  `WorkspaceTabPropsTableRow.vue`
3.  `WorkspaceTabPropsTableEditModal.vue`
4.  `WorkspaceTabPropsTableForeignModal.vue`
5.  `WorkspaceTabPropsTableChecksModal.vue`
6.  `WorkspaceTabPropsTableIndexesModal.vue`
7.  `WorkspaceTabTable.vue`
8.  `TheFooter.vue`
9.  `WorkspaceEditConnectionPanel.vue`
10.  `WorkspaceAddConnectionPanel.vue`
11.  `WorkspaceTabQuery.vue`

### A.3 Tier C 全未遷移（61）

#### Batch 1（1）

1.  `BaseSelect.vue`

#### Batch 3 — Settings & 系統（10）

1.  `ModalSettings.vue`
2.  `ModalSettingsUpdate.vue`
3.  `ModalSettingsData.vue`
4.  `ModalSettingsDataImport.vue`
5.  `ModalSettingsDataExport.vue`
6.  `ModalSettingsShortcuts.vue`
7.  `ModalConnectionAppearance.vue`
8.  `ModalFolderAppearance.vue`
9.  `DebugConsole.vue`
10.  `ModalProcessesList.vue`

#### Batch 4 — Schema / 連線 modal（8）

1.  `ModalAllConnections.vue`
2.  `ModalAskCredentials.vue`
3.  `ModalAskParameters.vue`
4.  `ModalNewSchema.vue`
5.  `ModalEditSchema.vue`
6.  `ModalImportSchema.vue`
7.  `ModalExportSchema.vue`
8.  `ModalHistory.vue`

#### Batch 5 — Workspace Props 系列（13）

1.  `WorkspaceTabPropsView.vue`
2.  `WorkspaceTabPropsTrigger.vue`
3.  `WorkspaceTabPropsTriggerFunction.vue`
4.  `WorkspaceTabPropsScheduler.vue`
5.  `WorkspaceTabPropsRoutine.vue`
6.  `WorkspaceTabPropsMaterializedView.vue`
7.  `WorkspaceTabPropsFunction.vue`
8.  `WorkspaceTabPropsTableContext.vue`
9.  `WorkspaceTabPropsTableDdlModal.vue`
10.  `WorkspaceTabPropsTableFields.vue`
11.  `WorkspaceTabPropsSchedulerTimingModal.vue`
12.  `WorkspaceTabPropsRoutineParamsModal.vue`
13.  `WorkspaceTabPropsFunctionParamsModal.vue`

#### Batch 6 — Workspace New 系列（9）

1.  `WorkspaceTabNewView.vue`
2.  `WorkspaceTabNewRoutine.vue`
3.  `WorkspaceTabNewTriggerFunction.vue`
4.  `WorkspaceTabNewMaterializedView.vue`
5.  `WorkspaceTabNewTrigger.vue`
6.  `WorkspaceTabNewFunction.vue`
7.  `WorkspaceTabNewTable.vue`
8.  `WorkspaceTabNewScheduler.vue`
9.  `WorkspaceTabNewTableEmptyState.vue`

#### Batch 7 — Sidebar & Explore（10）

1.  `TheSettingBar.vue`
2.  `SettingBarConnections.vue`
3.  `SettingBarConnectionsFolder.vue`
4.  `WorkspaceExploreBar.vue`
5.  `WorkspaceExploreBarSchema.vue`
6.  `WorkspaceExploreBarTableContext.vue`
7.  `WorkspaceExploreBarSchemaContext.vue`
8.  `WorkspaceExploreBarMiscContext.vue`
9.  `SettingBarContext.vue`
10.  `BaseContextMenu.vue`

#### Batch 8 — Scratchpad / Notes（4）

1.  `TheScratchpad.vue`
2.  `ScratchpadNote.vue`
3.  `ModalNoteNew.vue`
4.  `ModalNoteEdit.vue`

#### Batch 9 — Notification / Empty / Shell（6）

1.  `App.vue`
2.  `Workspace.vue`
3.  `BaseNotification.vue`
4.  `KeyPressDetector.vue`
5.  `ForeignKeySelect.vue`
6.  `FakerSelect.vue`

### A.4 邏輯元件 / 無 UI surface（不在 scope，僅供查照）

*   `BaseIcon.vue`、`BaseLoader.vue`、`BaseTextEditor.vue`、`BaseSplitV.vue`、`BaseUploadInput.vue`、`BaseVirtualScroll.vue`、`BaseMap.vue`
*   `TheNotifications.vue`、`TheTitleBar.vue`、`TheUpdateInfo.vue`、`TheSpecSnapInspector.vue`、`TheRouterMain.vue`
*   `WorkspaceTabQueryTable.vue`、`WorkspaceTabQueryTableRow.vue`、`WorkspaceTabTableFilters.vue`、`WorkspaceTabPropsSettingTab.vue` 等次要 wrapper

> 部分名稱以實際 `find` 結果為準；本附錄根據 2026-04-28 audit。

---

## 11\. 附錄 B — Primitive 對照速查表

| 場景 | spectre 寫法 | shadcn-vue 寫法 |
| --- | --- | --- |
| 主按鈕 | `class="btn btn-primary"` | `<Button>...</Button>` |
| 危險按鈕 | `class="btn btn-error"` | `<Button variant="destructive">` |
| 次按鈕 | `class="btn"` | `<Button variant="outline">` |
| 文字按鈕 | `class="btn btn-link"` | `<Button variant="ghost">` |
| 表單輸入 | `class="form-input"` | `<Input />` |
| 大段輸入 | `<textarea class="form-input">` | `<Textarea />` |
| 選擇器 | `<select class="form-select">` | `<Select><SelectTrigger>...` |
| Checkbox | `<input type="checkbox" class="form-checkbox">` | `<Checkbox />` |
| Switch | `class="form-switch"` | `<Switch />` |
| Radio | `class="form-radio"` | `<RadioGroup>` |
| Label | `class="form-label"` | `<Label />` |
| 單行錯誤訊息 | `class="form-input-hint"` | `<FormFieldMessage />` |
| Modal | `class="modal modal-sm active"` | `<Dialog>` + `<DialogContent>` |
| 確認 modal | 自刻 | `<BaseConfirmModal>` |
| Tab | `class="tab tab-block"` | `<Tabs>` + `<TabsTrigger>` |
| Card | `class="card"` | `<Card>` |
| Chip / 標籤 | `class="chip"` | `<Badge>` |
| Toast | `class="toast"` + Pinia store | `toast.success(...)` + `<Toaster />` |
| Tooltip | `data-tooltip="..."` | `<Tooltip>` + `<TooltipTrigger>` |
| Context menu | `BaseContextMenu` 自刻 | `<ContextMenu>` |
| Dropdown | `class="dropdown"` 手控 | `<DropdownMenu>` |
| Accordion | `class="accordion"` | `<Accordion>` |
| Divider | `class="divider"` | `<Separator />` |
| Popover | `class="popover"` | `<Popover>` |
| Empty state | `class="empty"` | `<Card>` + 自訂 layout |
| 表格 | `class="table table-striped"` | Tailwind utilities，無對應 primitive |

> 表格沒有 shadcn-vue primitive — 需要自己用 Tailwind 寫，但可參考 shadcn-vue Data Table 範例。

---

## 12\. 附錄 C — 用 Pencil 對齊的工作流

每個 Batch 開始前：

1.  用 pencil MCP `get_screenshot` 取出該批次涉及畫面的設計稿
2.  用 SpecSnap inspector 量現況元件的 padding / height / font-size / color
3.  寫進該 Batch 的 spec 檔（`docs/superpowers/specs/2026-XX-XX-batch-N-spec.md`），對照表格列「設計值 vs 現況值 vs 目標值」
4.  該 Batch PR 的描述連結到 spec 檔

每個 Batch 結束後：

1.  在 `docs/ui-spec.md` 補上該 Batch 確立的新規範（如 ScrollArea 用法、Sonner toast 用法）
2.  如果發現 pencil 設計與實作偏差，在 spec 檔記錄並回頭請設計改 pencil（不要默默改 code 對齊舊 pencil）

---

**End of Plan.**