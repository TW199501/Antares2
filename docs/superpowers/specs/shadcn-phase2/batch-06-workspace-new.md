# Batch 6 — Workspace New 系列（9 個）

**前置依賴**：Batch 0 + Batch 1 + Batch 5（沿用 PropsTabShell / PropertyCard 抽象）
**估時**：2 天
**對應 Plan 段落**：parent-plan §3 Batch 6
**Spec rev**：2026-04-28 against commit `fd44e3a`

---

## 1. Scope

9 個檔（parent-plan 附錄 A.3 #46-#54）— 「**建立 DB 物件**」的所有 tab，與 Batch 5 對稱。

| # | 檔名 | DB 物件 |
|---|------|---------|
| 46 | `WorkspaceTabNewView.vue` | New View |
| 47 | `WorkspaceTabNewRoutine.vue` | New Stored Procedure |
| 48 | `WorkspaceTabNewTriggerFunction.vue` | New Trigger Function (PG) |
| 49 | `WorkspaceTabNewMaterializedView.vue` | New Materialized View (PG) |
| 50 | `WorkspaceTabNewTrigger.vue` | New Trigger |
| 51 | `WorkspaceTabNewFunction.vue` | New Function |
| 52 | `WorkspaceTabNewTable.vue` | New Table |
| 53 | `WorkspaceTabNewScheduler.vue` | New Event/Scheduler |
| 54 | `WorkspaceTabNewTableEmptyState.vue` | New Table 空狀態 |

### 1.2 排除清單

- 不動 BaseTextEditor（內嵌 SQL 編輯器）
- 不動 Tier B 已收尾的 PropsTable* 檔

---

## 2. Pre-flight Drift Check

```bash
cd e:/source/antares2

for f in WorkspaceTabNewView WorkspaceTabNewRoutine WorkspaceTabNewTriggerFunction \
         WorkspaceTabNewMaterializedView WorkspaceTabNewTrigger WorkspaceTabNewFunction \
         WorkspaceTabNewTable WorkspaceTabNewScheduler WorkspaceTabNewTableEmptyState; do
   c=$(grep -cE "form-input|form-select|form-label|btn |modal-container|tab-block|panel|empty" \
       src/renderer/components/$f.vue 2>/dev/null)
   echo "$f: $c"
done
```

---

## 3. Primitives Used

- 同 Batch 5（`Tabs` / `Dialog` / `FormField` / `Input` / `Select` / `Switch` / `Button` / `Card`）
- 額外：empty state 用 `<Card>` + `<BaseIcon>` + `<Button>`

---

## 4. Common Transformations

### 4.1 New tab 殼（與 Batch 5 §4.1 PropsTabShell 共用）

```vue
<template>
  <PropsTabShell>
    <template #toolbar>
      <Button variant="default" size="sm" @click="create">
        <BaseIcon icon-name="mdiPlus" :size="14" /> Create
      </Button>
      <Button variant="outline" size="sm" @click="discard">
        <BaseIcon icon-name="mdiClose" :size="14" /> Discard
      </Button>
    </template>
    <template #content>
      <PropertyCard :title="t('database.basicInfo')">
        <FormField name="name">
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl><Input v-model="newObject.name" autofocus /></FormControl>
          </FormItem>
        </FormField>
        ...
      </PropertyCard>
    </template>
  </PropsTabShell>
</template>
```

### 4.2 Empty state（建表的空狀態）

```vue
<Card class="m-auto max-w-[400px] text-center !p-8">
  <CardContent class="space-y-4">
    <BaseIcon icon-name="mdiTablePlus" :size="48" class="mx-auto opacity-40" />
    <CardTitle>{{ t('database.newTable') }}</CardTitle>
    <CardDescription>
      {{ t('database.newTableEmptyHint') }}
    </CardDescription>
    <Button @click="addFirstField">
      <BaseIcon icon-name="mdiPlus" :size="14" /> {{ t('database.addFirstField') }}
    </Button>
  </CardContent>
</Card>
```

---

## 5. Per-File Detailed Steps

### 5.1 套 Batch 5 模板

每檔依其物件特殊欄位填內容。多數沿用 Batch 5 § 5.2 同樣 pattern。

### 5.2 `WorkspaceTabNewTable.vue`（最複雜）

**Step 1**：殼用 `PropsTabShell`。
**Step 2**：欄位編輯區用既有 `WorkspaceTabPropsTable` 元件（複用，避免重寫）。
**Step 3**：toolbar 加 Save / Discard / Add Field 按鈕。
**Step 4**：欄位為空時顯示 §4.2 EmptyState。

### 5.3 `WorkspaceTabNewTableEmptyState.vue`

對照 §4.2 直接套用。

---

## 6. New Files Created

無（沿用 Batch 5 抽出的 PropsTabShell / PropertyCard）。

---

## 7. Acceptance Checklist

- [ ] 9 個檔殘留 spectre 為 0
- [ ] MariaDB / PostgreSQL 各建一個 view / trigger / function / procedure / table OK
- [ ] EmptyState 顯示在建表時欄位為空
- [ ] Discard 按鈕關 tab + 確認 dialog
- [ ] §8 grep 全綠

---

## 8. Completion Detection Grep

```bash
cd e:/source/antares2

for f in WorkspaceTabNewView WorkspaceTabNewRoutine WorkspaceTabNewTriggerFunction \
         WorkspaceTabNewMaterializedView WorkspaceTabNewTrigger WorkspaceTabNewFunction \
         WorkspaceTabNewTable WorkspaceTabNewScheduler WorkspaceTabNewTableEmptyState; do
   c=$(grep -cE "class=\"[^\"]*\b(form-input|form-select|form-label|btn |modal-container|panel|empty)\b" \
       src/renderer/components/$f.vue 2>/dev/null)
   echo "$f: $c"
done
# 預期：每行 0
```

---

## 9. Manual Smoke Test Plan

- [ ] MariaDB：右鍵 schema → New Table → 加 3 欄 → save → 看 SQL → confirm
- [ ] MariaDB：New View / Trigger / Function / Procedure / Event 各一個
- [ ] PostgreSQL：New View / Trigger / Trigger Function / Materialized View / Function 各一個
- [ ] New Table 開啟時欄位為空 → 顯示 EmptyState → 點 Add → 出現第一個 field row
- [ ] Discard 按鈕 → 觸發 ModalDiscardChanges → cancel / confirm
- [ ] dark / light OK

---

## 10. Rollback

每檔獨立 revert。

---

## 11. Commit Message

```
refactor(workspace-new): migrate all New-* tabs to shadcn

9 files migrated using Batch 5's PropsTabShell + PropertyCard abstraction.

Per spec: docs/superpowers/specs/shadcn-phase2/batch-06-workspace-new.md
```

或拆成 2-3 個 commit 按物件類型。

---

**End of Batch 6 Spec.**
