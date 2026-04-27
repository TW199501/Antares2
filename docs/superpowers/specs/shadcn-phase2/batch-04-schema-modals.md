# Batch 4 — Schema / 連線管理 Modal（8 個）

**前置依賴**：Batch 0 + Batch 1
**估時**：2 天
**對應 Plan 段落**：parent-plan §3 Batch 4
**Spec rev**：2026-04-28 against commit `fd44e3a`

---

## 1. Scope

8 個檔（parent-plan 附錄 A.3 #25-#32）：

| # | 檔名 | 用途 |
|---|------|------|
| 25 | `ModalAllConnections.vue` | 全連線清單 + 搜尋 |
| 26 | `ModalAskCredentials.vue` | 密碼輸入 |
| 27 | `ModalAskParameters.vue` | Stored procedure 參數輸入 |
| 28 | `ModalNewSchema.vue` | 建 schema 表單 |
| 29 | `ModalEditSchema.vue` | 改 schema 表單 |
| 30 | `ModalImportSchema.vue` | 匯入 schema 檔 |
| 31 | `ModalExportSchema.vue` | 匯出 schema 設定 |
| 32 | `ModalHistory.vue` | Query history 清單 |

### 1.2 排除清單

- `BaseConfirmModal` 不動（已純 shadcn）
- BaseTextEditor / BaseVirtualScroll 不動（不在 scope）

---

## 2. Pre-flight Drift Check

```bash
cd e:/source/antares2

for f in ModalAllConnections ModalAskCredentials ModalAskParameters \
         ModalNewSchema ModalEditSchema ModalImportSchema ModalExportSchema \
         ModalHistory; do
   c=$(grep -cE "form-input|form-select|form-label|form-checkbox|btn |modal-container|panel" \
       src/renderer/components/$f.vue 2>/dev/null)
   echo "$f: $c"
done
```

---

## 3. Primitives Used

- 既有：`Dialog` / `FormField` / `Input` / `Label` / `Select` / `Checkbox` / `Button`
- Batch 0 新加：`ScrollArea`（AllConnections / History 長清單）/ `Tooltip`（圖示 button）/ `Badge`（連線狀態 chip）

---

## 4. Common Transformations

### 4.1 簡單 ask-style modal（只有幾個欄位 + confirm/cancel）

直接用 `BaseConfirmModal` 包：

```vue
<BaseConfirmModal
  :title="t('connection.askCredentials')"
  :confirm-text="t('general.confirm')"
  @confirm="onConfirm"
  @cancel="hideModal"
>
  <FormField name="password">
    <FormItem>
      <FormLabel>{{ t('connection.password') }}</FormLabel>
      <FormControl>
        <Input v-model="password" type="password" autocomplete="current-password" />
      </FormControl>
    </FormItem>
  </FormField>
</BaseConfirmModal>
```

### 4.2 長清單 modal（AllConnections / History）

```vue
<Dialog :open="true" @update:open="(v) => !v && hideModal()">
  <DialogContent class="max-w-[700px] max-h-[80vh] !p-0 [&>button.absolute]:!hidden">
    <DialogHeader class="px-6 py-3 border-b">
      <DialogTitle>{{ t('connection.allConnections') }}</DialogTitle>
    </DialogHeader>
    <div class="px-6 py-3 border-b">
      <Input v-model="filter" placeholder="Search..." />
    </div>
    <ScrollArea class="flex-1 max-h-[60vh]">
      <div v-for="conn in filteredConnections" :key="conn.uid"
           class="px-6 py-2 hover:bg-muted/50 cursor-pointer flex items-center gap-3"
           @dblclick="onSelect(conn)">
        <Badge :variant="conn.connected ? 'success' : 'outline'">
          {{ conn.driver }}
        </Badge>
        <span class="flex-1 text-sm">{{ conn.name }}</span>
      </div>
    </ScrollArea>
  </DialogContent>
</Dialog>
```

### 4.3 File picker button（Import/Export）

```vue
<!-- Before -->
<button class="btn" @click="selectFile">Choose file</button>
<span class="form-input">{{ filePath || 'No file selected' }}</span>

<!-- After -->
<div class="flex gap-2 items-center">
  <Button variant="outline" @click="selectFile">
    <BaseIcon icon-name="mdiFileOutline" :size="14" />
    Choose file
  </Button>
  <code class="flex-1 text-xs text-muted-foreground truncate">
    {{ filePath || t('general.noFileSelected') }}
  </code>
</div>
```

---

## 5. Per-File Detailed Steps

### 5.1 `ModalAskCredentials.vue` + `ModalAskParameters.vue`（最簡單）

**Step 1**：用 `BaseConfirmModal` 包（§4.1 pattern）。
**Step 2**：密碼欄位 `<Input type="password" autocomplete="current-password">`。
**Step 3**：參數欄位依 type 動態 render 不同 control（Input / Select / Checkbox）。

### 5.2 `ModalDiscardChanges.vue`（已純 BaseConfirmModal — 只 audit 殘留）

實際上這檔可能已是純 BaseConfirmModal — 確認後跳過。

### 5.3 `ModalNewSchema.vue` + `ModalEditSchema.vue`

**Step 1**：用 `BaseConfirmModal`。
**Step 2**：表單：name input + collation Select + charset Select。
**Step 3**：Edit 多一個 readonly `currentName`。

### 5.4 `ModalImportSchema.vue` + `ModalExportSchema.vue`

**Step 1**：`<Dialog>` 殼（不用 BaseConfirmModal — 內容較多）。
**Step 2**：Import：file picker + preview area（用 `<Card>` 包 `<Textarea readonly>`）。
**Step 3**：Export：Schema 多選 Checkbox + options（include data / structure / triggers）。

### 5.5 `ModalAllConnections.vue`

**Step 1**：對照 §4.2 寫長清單 modal。
**Step 2**：Search input → filter computed。
**Step 3**：每 row 顯示 Badge（driver type）+ name + last used time。
**Step 4**：右鍵 ContextMenu 留位置（Batch 7 才接）。

### 5.6 `ModalHistory.vue`

**Step 1**：`<Dialog>` 殼。
**Step 2**：時間軸保留現有渲染（如 BaseVirtualScroll）— 只動殼與 toolbar。
**Step 3**：limit Select / clear all Button（destructive variant）。

---

## 6. New Files Created

無。

---

## 7. Acceptance Checklist

- [ ] 8 個檔殘留 spectre class 為 0
- [ ] 從 sidebar 觸發 New/Edit/Delete schema 全流程 OK
- [ ] AllConnections 開啟、搜尋、選擇、雙擊連線 OK
- [ ] 密碼 input 遮罩、貼上、autofill OK
- [ ] Import/Export schema 檔案選擇正常（Tauri FS dialog）
- [ ] History 顯示、limit 切換、clear OK
- [ ] §8 grep 全綠

---

## 8. Completion Detection Grep

```bash
cd e:/source/antares2

for f in ModalAllConnections ModalAskCredentials ModalAskParameters \
         ModalNewSchema ModalEditSchema ModalImportSchema ModalExportSchema \
         ModalHistory; do
   c=$(grep -cE "class=\"[^\"]*\b(form-input|form-select|form-label|form-checkbox|form-group|btn |modal-container|panel)\b" \
       src/renderer/components/$f.vue 2>/dev/null)
   echo "$f: $c"
done
# 預期：每行 0
```

```bash
# 一鍵總檢
cd e:/source/antares2 && total=0 && for f in ModalAllConnections ModalAskCredentials ModalAskParameters ModalNewSchema ModalEditSchema ModalImportSchema ModalExportSchema ModalHistory; do
   c=$(grep -cE "class=\"[^\"]*\b(form-input|form-select|form-label|btn |modal-container)\b" src/renderer/components/$f.vue 2>/dev/null)
   total=$((total + c))
done && echo "Total Batch 4 residue: $total"
# 預期：0
```

---

## 9. Manual Smoke Test Plan

- [ ] 連到一個 DB → 右鍵 schema → New schema → 填名稱 → save
- [ ] 同上 → Edit schema → 改 collation → save
- [ ] 開 All Connections（cog → All Connections） → 搜尋 → 雙擊連線
- [ ] 連到需密碼的 DB → 觸發 ask credentials → 輸入 → confirm
- [ ] 跑 stored procedure → 觸發 ask parameters → 填值 → confirm
- [ ] Import schema：選 .sql 檔 → 預覽 → import
- [ ] Export schema：選表 → 設定 options → export
- [ ] History modal：看歷史 → 雙擊一條 → 該 query 進 query tab
- [ ] dark / light theme 切換 OK

---

## 10. Rollback

每檔獨立 revert。

---

## 11. Commit Message

```
refactor(modal-schema): migrate schema CRUD modals to shadcn

ModalNewSchema + ModalEditSchema + ModalImportSchema + ModalExportSchema.

Per spec: docs/superpowers/specs/shadcn-phase2/batch-04-schema-modals.md
```

```
refactor(modal-connection): migrate connection-related modals to shadcn

ModalAllConnections + ModalAskCredentials + ModalAskParameters + ModalHistory.

Per spec: docs/superpowers/specs/shadcn-phase2/batch-04-schema-modals.md
```

---

**End of Batch 4 Spec.**
