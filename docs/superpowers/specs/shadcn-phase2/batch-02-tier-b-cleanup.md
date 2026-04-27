# Batch 2 — Tier B 11 個元件 spectre 殘留收尾

**前置依賴**：Batch 0 + Batch 1
**估時**：1.5 天
**對應 Plan 段落**：parent-plan §3 Batch 2
**Spec rev**：2026-04-28 against commit `fd44e3a`

---

## 1. Scope

把 11 個「已部分遷移但仍混 spectre」的元件殘留 class 拔乾淨。這 11 個檔已 import shadcn-vue primitives，本批只清 form-* / btn / modal 等殘留。

### 1.1 涵蓋的 11 個檔（parent-plan 附錄 A.2）

| # | 檔名 | 殘留 spectre 類別 |
|---|------|------------------|
| 3 | `WorkspaceTabPropsTable.vue` | `form-*` |
| 4 | `WorkspaceTabPropsTableRow.vue` | `form-*` |
| 5 | `WorkspaceTabPropsTableEditModal.vue` | `form-*` |
| 6 | `WorkspaceTabPropsTableForeignModal.vue` | `form-*` + `.modal` |
| 7 | `WorkspaceTabPropsTableChecksModal.vue` | `.modal` |
| 8 | `WorkspaceTabPropsTableIndexesModal.vue` | `form-*` + `.modal` |
| 9 | `WorkspaceTabTable.vue` | spectre 殘留少量 |
| 10 | `TheFooter.vue` | `btn` |
| 11 | `WorkspaceEditConnectionPanel.vue` | `form-*` |
| 12 | `WorkspaceAddConnectionPanel.vue` | `form-*` |
| 13 | `WorkspaceTabQuery.vue` | `form-*` |

### 1.2 排除清單

- 不動其他 Workspace 系列（那是 Batch 5 / 6）
- 不動 ConnectionPanel 的 BaseSelect 用法（Batch 1 已處理）

---

## 2. Pre-flight Drift Check

```bash
cd e:/source/antares2

# 拍照 11 個檔的 spectre 殘留量
for f in WorkspaceTabPropsTable WorkspaceTabPropsTableRow WorkspaceTabPropsTableEditModal \
         WorkspaceTabPropsTableForeignModal WorkspaceTabPropsTableChecksModal \
         WorkspaceTabPropsTableIndexesModal WorkspaceTabTable TheFooter \
         WorkspaceEditConnectionPanel WorkspaceAddConnectionPanel WorkspaceTabQuery; do
   c=$(grep -cE "form-input|form-select|form-label|form-checkbox|form-group|btn |modal-container|modal-overlay|tab-block|tab-item" \
       src/renderer/components/$f.vue 2>/dev/null)
   echo "$f: $c"
done
```

每個檔的數字會在改完後**降到 0**。

---

## 3. Primitives Used

全部已存在（Phase 1）：`Button` / `Checkbox` / `Dialog` / `FormField` / `Input` / `Label` / `Select` / `Tabs`

---

## 4. Common Transformations

### 4.1 `<div class="form-group">` → `<FormField>`

```vue
<!-- Before -->
<div class="form-group">
  <label class="form-label" for="host">Host</label>
  <input id="host" v-model="host" class="form-input" />
</div>

<!-- After -->
<FormField name="host">
  <FormItem>
    <FormLabel>Host</FormLabel>
    <FormControl>
      <Input v-model="host" />
    </FormControl>
  </FormItem>
</FormField>
```

### 4.2 `<button class="btn btn-primary">` → `<Button>`

```vue
<!-- Before -->
<button class="btn btn-primary" @click="save">Save</button>
<button class="btn btn-error" @click="delete">Delete</button>
<button class="btn" @click="cancel">Cancel</button>
<button class="btn btn-link" @click="reset">Reset</button>

<!-- After -->
<Button @click="save">Save</Button>
<Button variant="destructive" @click="delete">Delete</Button>
<Button variant="outline" @click="cancel">Cancel</Button>
<Button variant="ghost" @click="reset">Reset</Button>
```

### 4.3 `.modal-container` 殘留拔除

ChecksModal / ForeignModal / IndexesModal 已用 `<Dialog>` + `<DialogContent>`，但內部還包了一層 `.modal-container`：

```vue
<!-- Before -->
<Dialog :open="true">
  <DialogContent>
    <div class="modal-container">  <!-- ← 拔掉 -->
      <div class="modal-header">  <!-- ← 換 DialogHeader -->
        <h5 class="modal-title">Title</h5>  <!-- ← 換 DialogTitle -->
      </div>
      <div class="modal-body">  <!-- ← 拔掉 wrapper -->
        ...content...
      </div>
    </div>
  </DialogContent>
</Dialog>

<!-- After -->
<Dialog :open="true">
  <DialogContent class="...">
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
    </DialogHeader>
    ...content...
  </DialogContent>
</Dialog>
```

**參考**：`src/renderer/components/ModalFakerRows.vue` 是純 shadcn 黃金範本。

---

## 5. Per-File Detailed Steps

### 5.1 `TheFooter.vue`（最簡單）

殘留：footer 圖示按鈕用 `class="btn btn-link"`。

**Step 1**：開檔，找所有 `btn` class，改 `<Button variant="ghost" size="icon">`。
**Step 2**：圖示 wrap 在 `<BaseIcon icon-name="..." />` 內。

### 5.2 `WorkspaceEditConnectionPanel.vue` + `WorkspaceAddConnectionPanel.vue`（雙胞胎）

殘留：`form-group` / `form-label` / `form-input` 多處。

**Step 1**：兩檔結構幾乎一樣 — 先做 Edit，再 diff 套到 Add。
**Step 2**：每個 `<div class="form-group">` 改 `<FormField>` + `<FormItem>`。
**Step 3**：所有 `<input class="form-input">` 改 `<Input>`（已 patch text-foreground）。
**Step 4**：保留 `BaseSelect` 用法不變（Batch 1 已處理）。
**Step 5**：tab 殼如有 `class="tab tab-block"` 改 `<Tabs>` + `<TabsList>`。

### 5.3 `WorkspaceTabPropsTable.vue` + `Row.vue` + `EditModal.vue`

這 3 個是 props-table 已遷移 80%，只剩 form-* 殘留。

**Step 1**：grep 該檔內所有 `class="form-*"`，逐個換。
**Step 2**：Row 的 inline 編輯改用 `<Input>` / `<Select>` / `<Checkbox>`。
**Step 3**：EditModal 已用 `<Dialog>`，只清 form-* 殘留。

### 5.4 ChecksModal / ForeignModal / IndexesModal

殘留：殘留的 `.modal-container` / `.modal-header` 等 spectre modal 殼。

**Step 1**：對照 §4.3 把 `.modal-*` wrapper 拔掉。
**Step 2**：`<DialogHeader>` / `<DialogTitle>` / `<DialogDescription>` 補齊（後者用 `sr-only` 哨兵 — 否則 reka-ui 會 warn）。

### 5.5 `WorkspaceTabTable.vue`

殘留量少，主要是 Tabs 切換按鈕還有 spectre `tab-item` class。

**Step 1**：找出 Tabs 結構，改 shadcn `<Tabs>` + `<TabsList>` + `<TabsTrigger>`。
**Step 2**：保留 BaseSelect / 其他元件用法。

### 5.6 `WorkspaceTabQuery.vue`

殘留：query options 區的 form-input。

**Step 1**：limit / 自動執行 toggle 等改 shadcn 元件。
**Step 2**：BaseTextEditor 不動（不在 scope）。

---

## 6. New Files Created

無。本批只改現有檔。

---

## 7. Acceptance Checklist

- [ ] 11 個檔的 spectre 殘留 class 為 0
- [ ] 每檔仍 `import` 至少一個 `@/components/ui/` primitive
- [ ] dev mode 跑該功能（編連線 / 編表 / 加 foreign / 開 query / footer click）視覺與 Phase 1 一致
- [ ] Tab 切換、表單驗證、modal 開關都正常
- [ ] dark / light theme OK
- [ ] §8 grep 全綠

---

## 8. Completion Detection Grep

```bash
cd e:/source/antares2

# 11 個檔內 spectre form-* / btn / modal-* 為 0
for f in WorkspaceTabPropsTable WorkspaceTabPropsTableRow WorkspaceTabPropsTableEditModal \
         WorkspaceTabPropsTableForeignModal WorkspaceTabPropsTableChecksModal \
         WorkspaceTabPropsTableIndexesModal WorkspaceTabTable TheFooter \
         WorkspaceEditConnectionPanel WorkspaceAddConnectionPanel WorkspaceTabQuery; do
   c=$(grep -cE "class=\"[^\"]*\b(form-input|form-select|form-label|form-checkbox|form-group|modal-container|modal-header|modal-body|modal-overlay|tab-block|tab-item)\b" \
       src/renderer/components/$f.vue 2>/dev/null)
   btn_c=$(grep -cE "class=\"[^\"]*\bbtn\b" src/renderer/components/$f.vue 2>/dev/null)
   echo "$f: spectre=$c, btn=$btn_c"
done
# 預期：每行都是 spectre=0, btn=0
```

```bash
# 一鍵總檢
cd e:/source/antares2 && total=0 && for f in WorkspaceTabPropsTable WorkspaceTabPropsTableRow WorkspaceTabPropsTableEditModal WorkspaceTabPropsTableForeignModal WorkspaceTabPropsTableChecksModal WorkspaceTabPropsTableIndexesModal WorkspaceTabTable TheFooter WorkspaceEditConnectionPanel WorkspaceAddConnectionPanel WorkspaceTabQuery; do
   c=$(grep -cE "class=\"[^\"]*\b(form-input|form-select|form-label|form-checkbox|form-group|modal-container|btn)\b" src/renderer/components/$f.vue 2>/dev/null)
   total=$((total + c))
done && echo "Total Tier B residue: $total"
# 預期：0
```

---

## 9. Manual Smoke Test Plan

- [ ] 編輯既有連線 → 改 host → save → 連線
- [ ] 新增連線 → 各種 driver 都試 → save
- [ ] 開一個 MariaDB 表 → Props tab → 加欄位 → 改 type → save
- [ ] 同表 → Foreign Keys → 加 FK → save
- [ ] 同表 → Indexes → 加 index → save
- [ ] 同表 → Checks → 加 check 約束 → save（如該 DB 支援）
- [ ] Workspace Tab 切換（Data / Props / DDL）OK
- [ ] Footer 圖示 click（process list / scratchpad / settings）OK
- [ ] Query tab → 寫 SQL → run → 看結果
- [ ] dark / light 切換 OK

---

## 10. Rollback

每檔獨立可 revert：
```bash
git checkout HEAD~1 -- src/renderer/components/<file>.vue
```

副作用：spectre 殘留回來，但功能不變（畢竟只是視覺 class）。

---

## 11. Commit Message

建議拆 3 個 commit（按功能群）：

```
refactor(workspace-tab-props-table): drop spectre residue from props-table cluster

Cleans form-* / modal-* residue from:
- WorkspaceTabPropsTable.vue
- WorkspaceTabPropsTableRow.vue
- WorkspaceTabPropsTableEditModal.vue
- WorkspaceTabPropsTableForeignModal.vue
- WorkspaceTabPropsTableChecksModal.vue
- WorkspaceTabPropsTableIndexesModal.vue
- WorkspaceTabTable.vue

Per spec: docs/superpowers/specs/shadcn-phase2/batch-02-tier-b-cleanup.md
```

```
refactor(connection-panel): drop spectre residue from connection panels

WorkspaceEditConnectionPanel.vue + WorkspaceAddConnectionPanel.vue.

Per spec: docs/superpowers/specs/shadcn-phase2/batch-02-tier-b-cleanup.md
```

```
refactor(footer-query): drop spectre residue from TheFooter and WorkspaceTabQuery

Per spec: docs/superpowers/specs/shadcn-phase2/batch-02-tier-b-cleanup.md
```

---

**End of Batch 2 Spec.**
