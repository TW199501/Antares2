# 屬性頁籤 shadcn-vue 遷移：Phase 2 audit + 工作清單

> **For agentic workers:** 這份是 audit + plan，**不**直接 implement。每個小節結束有「驗收條件」，做之前先列一輪 Out-of-Scope。

**Goal:** 接 Phase 1（commit `ad146df`，2026-04-25）完成的 parent / table / row 視覺對齊之後，列出剩餘**未遷移**的 spectre 殘留 + 新需求（操作欄 sticky）。輸入是這次對話補修的 5 處 input/select 白底、定序唯讀、描述欄寬等已 done 的小調，以及使用者本次截圖指出的「操作欄要固定顯示、按鈕要 shadcn」。

**Audit 範圍（已掃過）:**

```
src/renderer/components/WorkspaceTabPropsTable.vue            (parent)
src/renderer/components/WorkspaceTabPropsTableFields.vue      (table header)
src/renderer/components/WorkspaceTabPropsTableRow.vue         (row + inline edit + 預設值彈窗)
src/renderer/components/WorkspaceTabPropsTableEditModal.vue   (欄位編輯 modal)
src/renderer/components/WorkspaceTabPropsTableForeignModal.vue (外鍵 modal)
src/renderer/components/WorkspaceTabPropsTableIndexesModal.vue (索引 modal)
src/renderer/components/WorkspaceTabPropsTableChecksModal.vue  (table check modal)
src/renderer/components/WorkspaceTabPropsTableDdlModal.vue     (DDL preview modal)
```

---

## A. 已完成（背景紀錄，不再動）

| 項目 | 狀態 |
|---|---|
| Toolbar 按鈕（Save/Clear/Add/Indexes/ForeignKeys/TableChecks/DDL） | ✅ shadcn `Button` + Teleport 到上方工具列（本次對話完成） |
| Form group（名稱/描述/自增/定序/引擎） | ✅ shadcn `Input` + `Label`，全部 32px、同白底（本次對話完成） |
| 「定序」欄位 | ✅ disabled + 200px + 白底 + 隱藏箭頭（本次對話完成） |
| 「描述」i18n | ✅ 5 locales 全改 `Comment → Description`（本次對話完成） |
| 表頭（thead）字級 + 顏色 | ✅ `!text-[12px]` + `!text-muted-foreground` + uppercase（Phase 1） |
| 操作欄 4 個按鈕（上移/下移/編輯/刪除） | ✅ shadcn `Button variant="ghost" size="icon"`（Phase 1） |

---

## B. 未遷移項目（按優先級）

### B1. 操作欄 sticky right（**最優先 / 本次使用者明確要求**）

**現況:** `WorkspaceTabPropsTableFields.vue:326` 的 `.th-ops` 與 `WorkspaceTabPropsTableRow.vue:619` 的 `.td-ops` 都是 `width: 110px` 固定欄寬，但**沒有** `position: sticky`。當欄位數多到水平捲動時，操作按鈕會被推出視窗右側。

**改動範圍:**
- `WorkspaceTabPropsTableFields.vue` SCSS 區塊 `.th-ops`：加 `position: sticky; right: 0; z-index: 2; background: var(--card)` 或 themed bg
- `WorkspaceTabPropsTableRow.vue` SCSS 區塊 `.td-ops`：同上（z-index 比 th 低 1）
- 注意 `.ops-btns` 預設 `opacity: 0` hover 才顯示（line 630）— sticky 後在固定位置仍要保留這個 hover 行為

**風險:**
- sticky 元素的背景色需配合 light/dark theme，不能是透明（不然底下 cell 會透出來）
- 與 row hover 的 `background: rgba(...)` 互動：sticky cell 的 bg 會蓋掉 hover bg，需要 hover 時也同步改 sticky cell bg
- sticky 元素 z-index 太高會蓋到 dropdown / modal — 限制 z-index 在 row 內（≤ 2）

**驗收:**
- [ ] 表格欄位多到水平捲動時，操作欄維持貼右
- [ ] light + dark theme 兩種背景色都跟 row 一致（無透明）
- [ ] hover row 時，sticky cell 跟著變色
- [ ] `.ops-btns` opacity 0→1 hover 行為保留

---

### B2. WorkspaceTabPropsTableDdlModal.vue（**最低工作量收尾**）

**現況:** `grep -c` 顯示僅 1 處 spectre class 殘留。Phase 1 期間幾乎已遷移完。

**改動範圍:**
- 找出剩 1 處 `form-input` / `btn` / `modal` 改成 shadcn 對應元件
- 結構應該已經是 shadcn `Dialog`，只剩內部一兩個 leaf 元素

**驗收:**
- [ ] `grep -E "form-(input|select|label|group|radio)|input-group|btn[^a-z-]|modal[^a-z-]" WorkspaceTabPropsTableDdlModal.vue` 為 0 行

---

### B3. WorkspaceTabPropsTableEditModal.vue（**使用者高頻使用**）

**現況:** 25 處 spectre class。是欄位編輯詳細彈窗，包含：
- form-input / form-label / form-group（基本表單欄位）
- form-select（type 選擇）
- input-group + btn（描述欄位旁的「翻譯」按鈕）
- form-input-hint（AI key 未設定 / 翻譯錯誤的 hint）

**改動範圍:**
- Dialog 結構（如果還沒）→ shadcn `Dialog` from `@/components/ui/dialog`
- form-input → shadcn `Input`
- form-label → shadcn `Label`
- form-group → 自訂 `<div class="flex flex-col gap-1">` 或 `<div class="grid gap-2">`
- form-select → 仍用 `BaseSelect`（B7 才動），但 wrapper class 改 Tailwind
- input-group + btn 翻譯按鈕 → `<div class="flex">` + shadcn `Button`
- form-input-hint → `<p class="text-[12px] text-warning mt-1">` 之類

**Out-of-Scope（這輪不動）:**
- AI 翻譯邏輯（`translateField` handler）
- ai-tools store 的 `aiApiKey` 取用流程
- 「預設值」嵌套 modal（B6 才動）

**驗收:**
- [ ] `grep -c` 為 0
- [ ] 開啟編輯彈窗 → 修改任意欄位 → 保存 → 結構真的有更新
- [ ] AI 翻譯按鈕點擊行為不變
- [ ] AI key 未設定的警告 hint 仍會顯示

---

### B4. WorkspaceTabPropsTableIndexesModal.vue（**結構類似 B5，可同 PR 一起做**）

**現況:** 20 處 spectre class。索引管理 modal（新增/編輯/刪除索引）。

**改動範圍:**
- Dialog 結構 → shadcn `Dialog`
- 索引列表（通常是 table）→ 保留 div + flex 結構，只改 padding / font 對齊 ui-spec
- 新增索引表單區（columns 多選 / 索引類型 / unique flag）→ shadcn `Input` / `BaseSelect` wrapper / `Checkbox`（要先確認 `@/components/ui/` 有沒有 Checkbox — Phase 1 invariant 寫有）
- 刪除確認 → 用既有 `BaseConfirmModal`

**驗收:**
- [ ] `grep -c` 為 0
- [ ] 新增 / 編輯 / 刪除 index 流程行為不變
- [ ] 多選 columns 的 UI 仍可操作

---

### B5. WorkspaceTabPropsTableForeignModal.vue（**最大工作量**）

**現況:** 29 處 spectre class — 全 audit 中最多。外鍵管理 modal（同時要選 FK 欄位、ref table、ref column、ON UPDATE / ON DELETE 行為）。

**改動範圍:**
- 同 B4 結構，但欄位更多
- ON UPDATE / ON DELETE 兩個 dropdown（CASCADE / SET NULL / RESTRICT / NO ACTION）→ shadcn `Select` 比 `BaseSelect` 適合（option 數固定）
  - **但** 引入 shadcn Select 是 Phase 1 明文 Out-of-Scope 的事項，做這項前要使用者點頭

**驗收:**
- [ ] `grep -c` 為 0
- [ ] 新增 / 編輯 / 刪除 FK 流程行為不變
- [ ] 跨資料庫 client（MySQL / PostgreSQL / MSSQL）皆測過

---

### B6. WorkspaceTabPropsTableChecksModal.vue（**DB-specific，最後做**）

**現況:** 17 處 spectre class。Table CHECK constraint 管理 modal。只 MySQL 8+ / PostgreSQL / MSSQL 有此功能（受 `customizations.tableCheck` gate）。

**改動範圍:** 同 B4，比較單純（每個 check 就是 name + clause）。

**驗收:**
- [ ] `grep -c` 為 0
- [ ] MySQL / PG / MSSQL 三家行為不變
- [ ] SQLite / Firebird（沒此功能）不影響

---

### B7. WorkspaceTabPropsTableRow.vue 內嵌「預設值編輯彈窗」（`isDefaultModal`）

**現況:** Lines 250-340。Phase 1 明文 Out-of-Scope。包含：
- 3 處 `form-radio form-inline`（noval / NULL / 自訂值 / 表達式 三選一）
- 3 處 `form-input`（自訂值 input、表達式 input、ON UPDATE input）
- 1 處 `form-group` + `form-label`（ON UPDATE 區塊）

**改動範圍:**
- Radio group → 需要新增 `@/components/ui/radio-group/`（shadcn-vue 有這個 primitive，CLAUDE.md 既定 invariant：CLI 不能進 repo，需要在 scratch 目錄複製過來再手 port）
- form-input → shadcn `Input`
- 3-way radio 的 disabled 邏輯（選 NULL 時 input 自動 disable）保留

**Out-of-Scope（這輪不動）:**
- `defaultValue` reactive 物件 shape（type / custom / expression / onUpdate）
- 預設值寫回 row 的時機（current: select radio 時即時寫回 `localRow.default`）

**驗收:**
- [ ] 3 種 radio 切換正常，相關 input 自動 enable/disable
- [ ] 從預設值欄位 double click 開啟此彈窗 → 改值 → 確認 → row 真的更新

---

### B8. WorkspaceTabPropsTableRow.vue 類型編輯 BaseSelect（**結構性，建議 Phase 3+**）

**現況:** Line 27 + 45。inline edit 的「類型」cell 用 `BaseSelect` 包 spectre `.form-select`。Phase 1 明文不動。

**改動範圍（如果要做）:**
- 拆掉 `BaseSelect`，改用 shadcn `Select` + `SelectTrigger` + `SelectContent`
- 但 inline edit 的 absolute positioning + autofocus + blur 流程跟 BaseSelect 高度耦合
- 影響面：定序 / 引擎 / 類型 三處 BaseSelect 全要一起評估

**前置決策:**
- 先決定整個專案 BaseSelect 是否退場（影響至少 5+ 個元件，不只屬性頁籤）
- 若退場：另開 `2026-XX-XX-baseselect-retirement-plan.md` 作整體規劃
- 若保留：本項永久 Out-of-Scope

---

### B9. 表格 structural（**最大破壞性，建議不做**）

**現況:** `WorkspaceTabPropsTableFields.vue` 用 `<div class="table">` + `<div class="tr">` + `<div class="th/td">` 模擬表格，**不是** HTML `<table>` 也**不是** shadcn `Table` primitive。

**為何不建議遷移:**
- 既有結構支援 column-resizable（line 269-275 SCSS） + Draggable header（vuedraggable）
- shadcn `Table` 是純 HTML `<table>` + Tailwind utilities，沒有原生 column-resize
- 改動會牽動 sticky header、column resize、drag-drop 三個獨立邏輯

**結論:** **保留結構**，繼續用 div-based table。只調 cell padding / border / font 對齊 ui-spec。

---

## C. 建議執行順序

| 順序 | 項目 | 理由 |
|---|---|---|
| 1 | **B1 sticky 操作欄** | 使用者本次明確要求；純 CSS；風險小 |
| 2 | **B2 DdlModal** | 1 處 class；最快結案；提升 audit grep 整潔度 |
| 3 | **B3 EditModal** | 使用者最常開；單檔範圍清晰 |
| 4 | **B4 IndexesModal** | 與 B5 結構類似，先做簡單的 |
| 5 | **B5 ForeignModal** | 配合 B4 的學習；shadcn `Select` 引入決策點 |
| 6 | **B6 ChecksModal** | DB-specific，最後做不影響其他 client |
| 7 | **B7 預設值彈窗** | 需先 port shadcn radio-group；獨立做 |
| 8 | （延後）**B8 BaseSelect 退場** | 全專案層級，獨立規劃 |
| 9 | （不做）**B9 表格結構** | 破壞性過大，明文不做 |

---

## D. 跨輪保留的 invariants（CLAUDE.md 既定）

- shadcn-vue CLI **絕不**進 repo（避免覆蓋本地 `BaseIcon` swap 與 dark-glass tokens）
- 不裝 `lucide-vue-next`（用 `BaseIcon` + `mdi*` icon name）
- spectre.css **不**從 `main.scss` 移除（仍有未遷移元件依賴）
- vue-i18n `legacy: false` 不動
- 所有遷移元件**保持 props/emits/slots 公開 API 一致**，避免 caller 同 PR 連帶改動
- **整個遷移過程不動 sidecar / Pinia store / customizations / 後端路由**
- shadcn primitive 想引入新的（`Select` / `Checkbox` / `RadioGroup`）→ 先放進 `@/components/ui/` 並按 [docs/superpowers/rules/shadcn-vue-migration-recipe.md](../rules/shadcn-vue-migration-recipe.md) 處理 icon swap 與 token 對齊

---

## E. 驗收 checklist（每項做完都要過）

- [ ] `pnpm lint` 通過
- [ ] `pnpm translation:check zh-TW` 100%（如果動了文字）
- [ ] 視覺對齊 `pencil-new.pen`（用 pencil MCP 抓最新 spec）
- [ ] dirty-check / inline edit / drag-drop / context menu 行為不變
- [ ] 改完手動跑一次「保存 + 重新載入確認 schema」流程
- [ ] commit message 用 `refactor(props-table-{name})` 或 `feat(props-table)` scope
- [ ] 不 commit debug screenshots / current-snap.yml / e2e-results/

---

## F. 開始 Phase 2 之前的決策題

寫實作 PR 之前要使用者點頭的事：

1. **B1 sticky 操作欄背景色** — 用 `var(--card)` / `var(--background)` / 跟 row hover 一樣的色？three options 都需要使用者選一個視覺風格
2. **B5 引入 shadcn Select** — Phase 1 明文不引入，B5 開始可能要破例。要不要破例？破例的話 B8 是不是也順便提前做？
3. **B7 引入 shadcn RadioGroup** — 需要從 scratch dir 複製過來，工作量約 30 分鐘 port + 測試
4. **B6 ChecksModal 是否值得做** — 使用率低（只 3 家 DB），可考慮只 grep 改 class 不重構結構
