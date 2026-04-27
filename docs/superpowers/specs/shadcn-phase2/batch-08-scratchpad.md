# Batch 8 — Scratchpad / Notes（4 個）

**前置依賴**：Batch 0（Card / Tooltip / Textarea）+ Batch 1
**估時**：1 天
**對應 Plan 段落**：parent-plan §3 Batch 8
**Spec rev**：2026-04-28 against commit `fd44e3a`

---

## 1. Scope

4 個檔（parent-plan 附錄 A.3 #65-#68）— scratchpad / 筆記功能。

| # | 檔名 | 用途 |
|---|------|------|
| 65 | `TheScratchpad.vue` | Scratchpad 殼（右側面板） |
| 66 | `ScratchpadNote.vue` | Note 卡 |
| 67 | `ModalNoteNew.vue` | 新增 note modal |
| 68 | `ModalNoteEdit.vue` | 編輯 note modal |

### 1.2 排除清單

- 不動 scratchpad store（持久化邏輯）

---

## 2. Pre-flight Drift Check

```bash
cd e:/source/antares2

for f in TheScratchpad ScratchpadNote ModalNoteNew ModalNoteEdit; do
   c=$(grep -cE "form-input|form-label|btn |modal-container|panel|card" \
       src/renderer/components/$f.vue 2>/dev/null)
   echo "$f: $c"
done
```

---

## 3. Primitives Used

- 既有：`Dialog` / `FormField` / `Input` / `Button`
- Batch 0 新加：`Card`（note 卡）/ `Tooltip`（hover 顯示完整內容）/ `Textarea`（note body）/ `ScrollArea`（scratchpad 列表）

---

## 4. Common Transformations

### 4.1 Scratchpad 殼

```vue
<template>
  <aside class="flex flex-col w-[280px] border-l bg-card/50 backdrop-blur-sm">
    <header class="flex items-center justify-between px-3 py-2 border-b">
      <h3 class="text-sm font-medium">{{ t('scratchpad.title') }}</h3>
      <Button variant="ghost" size="icon" @click="addNote">
        <BaseIcon icon-name="mdiPlus" :size="14" />
      </Button>
    </header>
    <ScrollArea class="flex-1">
      <ScratchpadNote
        v-for="note in notes"
        :key="note.id"
        :note="note"
        @edit="editNote(note)"
        @delete="deleteNote(note)"
      />
    </ScrollArea>
  </aside>
</template>
```

### 4.2 Note 卡

```vue
<Tooltip>
  <TooltipTrigger as-child>
    <Card
      class="!p-3 m-2 cursor-pointer hover:bg-accent/30"
      @click="$emit('edit')"
    >
      <CardContent class="!p-0 space-y-1">
        <div class="text-sm font-medium truncate">{{ note.title }}</div>
        <div class="text-xs text-muted-foreground line-clamp-2">{{ note.body }}</div>
      </CardContent>
    </Card>
  </TooltipTrigger>
  <TooltipContent class="max-w-[300px]">
    <pre class="whitespace-pre-wrap text-xs">{{ note.body }}</pre>
  </TooltipContent>
</Tooltip>
```

### 4.3 Note Modal（New / Edit 共用 pattern）

```vue
<Dialog :open="true" @update:open="(v) => !v && hideModal()">
  <DialogContent class="max-w-[600px]">
    <DialogHeader>
      <DialogTitle>{{ isEdit ? t('scratchpad.editNote') : t('scratchpad.newNote') }}</DialogTitle>
    </DialogHeader>
    <div class="space-y-4">
      <FormField name="title">
        <FormItem>
          <FormLabel>{{ t('general.title') }}</FormLabel>
          <FormControl><Input v-model="note.title" autofocus /></FormControl>
        </FormItem>
      </FormField>
      <FormField name="body">
        <FormItem>
          <FormLabel>{{ t('general.content') }}</FormLabel>
          <FormControl>
            <Textarea v-model="note.body" rows="10" />
          </FormControl>
        </FormItem>
      </FormField>
    </div>
    <DialogFooter>
      <Button variant="outline" @click="hideModal">Cancel</Button>
      <Button @click="save">Save</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## 5. Per-File Detailed Steps

### 5.1 `TheScratchpad.vue`

對照 §4.1。`<aside>` 寬度 280px、border-l、bg-card 半透明。

### 5.2 `ScratchpadNote.vue`

對照 §4.2。包 `Tooltip` 顯示完整內容、`Card` 為 row 殼。`@click` 觸發 edit、右鍵改 delete。

### 5.3 `ModalNoteNew.vue` + `ModalNoteEdit.vue`

兩個共用 §4.3 pattern。可考慮抽出 `ScratchpadNoteForm.vue` 共用元件（spec 不強制）。

---

## 6. New Files Created

可選：`src/renderer/components/scratchpad/ScratchpadNoteForm.vue`（共用 form）。

---

## 7. Acceptance Checklist

- [ ] 4 個檔殘留 spectre 為 0
- [ ] 加 / 改 / 刪 note OK
- [ ] note 排序持久化（重啟後保留順序）
- [ ] hover note 卡 → Tooltip 顯示完整內容
- [ ] §8 grep 全綠

---

## 8. Completion Detection Grep

```bash
cd e:/source/antares2

for f in TheScratchpad ScratchpadNote ModalNoteNew ModalNoteEdit; do
   c=$(grep -cE "class=\"[^\"]*\b(form-input|form-label|btn |modal-container|panel|chip)\b" \
       src/renderer/components/$f.vue 2>/dev/null)
   echo "$f: $c"
done
# 預期：每行 0
```

---

## 9. Manual Smoke Test Plan

- [ ] 開 scratchpad（右側面板顯示）
- [ ] 點 + 加 note → ModalNoteNew 出現 → 填 → save → 出現在清單
- [ ] 點 note 卡 → ModalNoteEdit 出現 → 改 → save → 卡內容更新
- [ ] hover 卡 → Tooltip 顯示完整 body
- [ ] 右鍵卡 → delete → 確認 → 消失
- [ ] 重啟 app → 順序與內容保留
- [ ] dark / light OK

---

## 10. Rollback

每檔獨立 revert。

---

## 11. Commit Message

```
refactor(scratchpad): migrate scratchpad + note modals to shadcn

TheScratchpad + ScratchpadNote + ModalNoteNew + ModalNoteEdit.

Per spec: docs/superpowers/specs/shadcn-phase2/batch-08-scratchpad.md
```

---

**End of Batch 8 Spec.**
