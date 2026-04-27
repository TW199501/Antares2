# Batch 5 — Workspace Props 系列（13 個）

**前置依賴**：Batch 0 + Batch 1 + Batch 2
**估時**：3 天
**對應 Plan 段落**：parent-plan §3 Batch 5
**Spec rev**：2026-04-28 against commit `fd44e3a`

---

## 1. Scope

13 個檔（parent-plan 附錄 A.3 #33-#45）— 「**檢視 DB 物件屬性**」的所有 tab。

| # | 檔名 | DB 物件 |
|---|------|---------|
| 33 | `WorkspaceTabPropsView.vue` | View |
| 34 | `WorkspaceTabPropsTrigger.vue` | Trigger |
| 35 | `WorkspaceTabPropsTriggerFunction.vue` | Trigger Function (PG) |
| 36 | `WorkspaceTabPropsScheduler.vue` | Event/Scheduler |
| 37 | `WorkspaceTabPropsRoutine.vue` | Stored Procedure |
| 38 | `WorkspaceTabPropsMaterializedView.vue` | Materialized View (PG) |
| 39 | `WorkspaceTabPropsFunction.vue` | Function |
| 40 | `WorkspaceTabPropsTableContext.vue` | Table 右鍵選單 |
| 41 | `WorkspaceTabPropsTableDdlModal.vue` | Table DDL 顯示 |
| 42 | `WorkspaceTabPropsTableFields.vue` | Table 欄位列表 |
| 43 | `WorkspaceTabPropsSchedulerTimingModal.vue` | Scheduler 時間設定 |
| 44 | `WorkspaceTabPropsRoutineParamsModal.vue` | Procedure 參數 |
| 45 | `WorkspaceTabPropsFunctionParamsModal.vue` | Function 參數 |

### 1.2 排除清單

- 不動 `WorkspaceTabPropsTable.vue` 等 Tier B 檔（Batch 2 已收尾）
- 不動 BaseTextEditor（DDL view 內嵌）

---

## 2. Pre-flight Drift Check

```bash
cd e:/source/antares2

for f in WorkspaceTabPropsView WorkspaceTabPropsTrigger WorkspaceTabPropsTriggerFunction \
         WorkspaceTabPropsScheduler WorkspaceTabPropsRoutine WorkspaceTabPropsMaterializedView \
         WorkspaceTabPropsFunction WorkspaceTabPropsTableContext WorkspaceTabPropsTableDdlModal \
         WorkspaceTabPropsTableFields WorkspaceTabPropsSchedulerTimingModal \
         WorkspaceTabPropsRoutineParamsModal WorkspaceTabPropsFunctionParamsModal; do
   c=$(grep -cE "form-input|form-select|form-label|form-checkbox|btn |modal-container|tab-block|panel|chip|menu" \
       src/renderer/components/$f.vue 2>/dev/null)
   echo "$f: $c"
done
```

---

## 3. Primitives Used

- 既有：`Tabs` / `Dialog` / `FormField` / `Input` / `Label` / `Select` / `Checkbox` / `Button`
- Batch 0 新加：`Switch` / `Textarea`（DDL view）/ `Card`（每個 prop 區塊）/ `ContextMenu`（TableContext）/ `Tooltip`

---

## 4. Common Transformations

### 4.1 共通結構：Props tab 殼

每個 Props tab 的標準長相：

```vue
<template>
  <div class="flex flex-col h-full">
    <!-- Toolbar：Save / Refresh / 切到 Data -->
    <div class="flex items-center gap-2 px-4 py-2 border-b">
      <Button variant="default" size="sm" @click="save">
        <BaseIcon icon-name="mdiContentSave" :size="14" /> Save
      </Button>
      <Button variant="outline" size="sm" @click="refresh">
        <BaseIcon icon-name="mdiRefresh" :size="14" />
      </Button>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button variant="ghost" size="icon" @click="showDdl">
            <BaseIcon icon-name="mdiCodeTags" :size="14" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>DDL</TooltipContent>
      </Tooltip>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle class="text-sm">{{ t('database.basicInfo') }}</CardTitle>
        </CardHeader>
        <CardContent class="grid grid-cols-2 gap-4">
          <FormField name="name">
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl><Input v-model="props.name" /></FormControl>
            </FormItem>
          </FormField>
          ...
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{{ t('database.body') }}</CardTitle></CardHeader>
        <CardContent>
          <BaseTextEditor v-model="props.body" mode="sql" />
        </CardContent>
      </Card>
    </div>
  </div>
</template>
```

### 4.2 DDL Modal（read-only SQL）

```vue
<Dialog :open="true" @update:open="(v) => !v && hideModal()">
  <DialogContent class="max-w-[800px] !p-0 [&>button.absolute]:!hidden">
    <DialogHeader class="px-6 py-3 border-b flex items-center justify-between">
      <DialogTitle>DDL — {{ tableName }}</DialogTitle>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button variant="ghost" size="icon" @click="copyDdl">
            <BaseIcon icon-name="mdiContentCopy" :size="14" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ t('general.copy') }}</TooltipContent>
      </Tooltip>
    </DialogHeader>
    <div class="p-4">
      <Textarea
        v-model="ddl"
        readonly
        rows="20"
        class="font-mono text-[12px] bg-muted/30"
      />
    </div>
  </DialogContent>
</Dialog>
```

### 4.3 Params Modal（procedure / function 參數）

```vue
<Dialog :open="true" @update:open="(v) => !v && hideModal()">
  <DialogContent class="max-w-[600px]">
    <DialogHeader>
      <DialogTitle>{{ t('database.parameters') }}</DialogTitle>
    </DialogHeader>
    <div class="space-y-3">
      <Card v-for="(param, idx) in params" :key="param.id" class="!p-3">
        <div class="grid grid-cols-[1fr_120px_80px_auto] gap-2 items-center">
          <Input v-model="param.name" placeholder="Name" />
          <Select v-model="param.type">...</Select>
          <Select v-model="param.context">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="IN">IN</SelectItem>
              <SelectItem value="OUT">OUT</SelectItem>
              <SelectItem value="INOUT">INOUT</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" @click="removeParam(idx)">
            <BaseIcon icon-name="mdiClose" :size="14" />
          </Button>
        </div>
      </Card>
      <Button variant="outline" @click="addParam">
        <BaseIcon icon-name="mdiPlus" :size="14" /> Add parameter
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

### 4.4 ContextMenu（TableContext 右鍵選單）

```vue
<ContextMenu>
  <ContextMenuTrigger as-child>
    <slot />  <!-- 包住表 row -->
  </ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem @click="onOpen">
      <BaseIcon icon-name="mdiTableEye" :size="14" /> {{ t('general.open') }}
    </ContextMenuItem>
    <ContextMenuItem @click="onTruncate" class="text-warning">
      <BaseIcon icon-name="mdiBroom" :size="14" /> Truncate
    </ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem @click="onDelete" class="text-destructive">
      <BaseIcon icon-name="mdiDelete" :size="14" /> {{ t('general.delete') }}
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

---

## 5. Per-File Detailed Steps

### 5.1 先做 1 個範本檔（建議：`WorkspaceTabPropsView.vue`）

把 §4.1 pattern 完整套用，建立 13 個檔的模板。中間如有抽象元件需求，建在 `src/renderer/components/workspace/props/`：

可能抽出：
- `PropsTabShell.vue`（toolbar + content area 共用 layout）
- `PropertyCard.vue`（每個 Card<Header,Content,...> 的薄包裝，預設 spacing）

### 5.2 然後 6 個物件 Props tab（View / Trigger / TriggerFn / Scheduler / Routine / MaterializedView / Function）

套 §4.1 / §5.1 抽象。每個檔都有：
- name input
- definer / character set / collation 等 metadata FormField
- definition textarea（用 BaseTextEditor）
- save / refresh / DDL toolbar

特殊：
- Trigger 多 timing（BEFORE/AFTER）+ event（INSERT/UPDATE/DELETE）→ RadioGroup
- Scheduler 多 schedule type → 觸發 SchedulerTimingModal
- Function/Routine 多 params → 觸發 ParamsModal

### 5.3 `WorkspaceTabPropsTableContext.vue`

對照 §4.4 套 ContextMenu。

### 5.4 `WorkspaceTabPropsTableDdlModal.vue`

對照 §4.2。Spec 要記得：DDL textarea **readonly** + font-mono + 複製按鈕。

### 5.5 `WorkspaceTabPropsTableFields.vue`

這檔顯示表所有欄位的 read-only 預覽（不是編輯器，編輯器是 PropsTable）。

**Step 1**：用 `<Card>` 包，每個 field 一 row。
**Step 2**：column type 用 `<Badge variant="outline">`，nullable 用 `<Badge variant="secondary">`，PK 用 `<Badge variant="success">`。

### 5.6 `WorkspaceTabPropsSchedulerTimingModal.vue`

Scheduler 排程設定有兩種：one-time（datetime input）、recurring（cron-like fields）。

**Step 1**：用 RadioGroup 切 type。
**Step 2**：Datetime 用 `<Input type="datetime-local">`（暫保留 native，shadcn-vue 沒提供 DateTime primitive）。
**Step 3**：Recurring：interval Select + start/end datetime。

### 5.7 `WorkspaceTabPropsRoutineParamsModal.vue` + `FunctionParamsModal.vue`

對照 §4.3。

---

## 6. New Files Created

可選：
- `src/renderer/components/workspace/props/PropsTabShell.vue`
- `src/renderer/components/workspace/props/PropertyCard.vue`

或直接 inline 在每個 Props tab 內也可以（spec 不強制抽象）。

---

## 7. Acceptance Checklist

- [ ] 13 個檔殘留 spectre 為 0
- [ ] 連到 PostgreSQL 跟 MariaDB 各打開一個 view / trigger / function / scheduler 看畫面
- [ ] Edit 改一個屬性 → save → refresh → 看 SQL 正確
- [ ] DDL modal 複製按鈕 OK
- [ ] readonly textarea 不可編
- [ ] ParamsModal 加/刪參數 OK
- [ ] SchedulerTimingModal 兩種 type 切換 OK
- [ ] Right-click table → ContextMenu 出現 → 點選項 OK
- [ ] §8 grep 全綠

---

## 8. Completion Detection Grep

```bash
cd e:/source/antares2

for f in WorkspaceTabPropsView WorkspaceTabPropsTrigger WorkspaceTabPropsTriggerFunction \
         WorkspaceTabPropsScheduler WorkspaceTabPropsRoutine WorkspaceTabPropsMaterializedView \
         WorkspaceTabPropsFunction WorkspaceTabPropsTableContext WorkspaceTabPropsTableDdlModal \
         WorkspaceTabPropsTableFields WorkspaceTabPropsSchedulerTimingModal \
         WorkspaceTabPropsRoutineParamsModal WorkspaceTabPropsFunctionParamsModal; do
   c=$(grep -cE "class=\"[^\"]*\b(form-input|form-select|form-label|form-checkbox|form-group|btn |modal-container|tab-block|panel|chip|menu)\b" \
       src/renderer/components/$f.vue 2>/dev/null)
   echo "$f: $c"
done
# 預期：每行 0
```

```bash
# 一鍵總檢
cd e:/source/antares2 && total=0 && for f in WorkspaceTabPropsView WorkspaceTabPropsTrigger WorkspaceTabPropsTriggerFunction WorkspaceTabPropsScheduler WorkspaceTabPropsRoutine WorkspaceTabPropsMaterializedView WorkspaceTabPropsFunction WorkspaceTabPropsTableContext WorkspaceTabPropsTableDdlModal WorkspaceTabPropsTableFields WorkspaceTabPropsSchedulerTimingModal WorkspaceTabPropsRoutineParamsModal WorkspaceTabPropsFunctionParamsModal; do
   c=$(grep -cE "class=\"[^\"]*\b(form-input|form-select|form-label|btn |modal-container|panel|chip)\b" src/renderer/components/$f.vue 2>/dev/null)
   total=$((total + c))
done && echo "Total Batch 5 residue: $total"
# 預期：0
```

---

## 9. Manual Smoke Test Plan

連到 MariaDB + PostgreSQL 各一份：

- [ ] MariaDB → 開一個 view → Props tab → 改 definition → save
- [ ] MariaDB → 開一個 trigger → Props → 改 timing → save
- [ ] MariaDB → 開一個 function → Props → 加 param → save
- [ ] MariaDB → 開一個 procedure → Props → 加 param → save
- [ ] MariaDB → 開一個 event → Props → 改 schedule → save
- [ ] PostgreSQL → 開一個 trigger function → Props → 改 → save
- [ ] PostgreSQL → 開一個 materialized view → Props → refresh → save
- [ ] 任一表 → 右鍵 → ContextMenu 顯示 → Truncate / Delete OK
- [ ] 任一表 → DDL → 看 SQL → 複製
- [ ] 任一表 → Fields → 欄位列表 + Badge 顏色 OK
- [ ] dark / light theme OK

---

## 10. Rollback

每檔獨立 revert。

---

## 11. Commit Message

建議拆 4 個 commit（按物件類別）：

```
refactor(workspace-props): migrate View/MaterializedView props tabs to shadcn

WorkspaceTabPropsView + WorkspaceTabPropsMaterializedView.

Per spec: docs/superpowers/specs/shadcn-phase2/batch-05-workspace-props.md
```

```
refactor(workspace-props): migrate Trigger/TriggerFunction/Scheduler props tabs

Plus SchedulerTimingModal.

Per spec: docs/superpowers/specs/shadcn-phase2/batch-05-workspace-props.md
```

```
refactor(workspace-props): migrate Routine/Function props tabs and ParamsModals

WorkspaceTabPropsRoutine + WorkspaceTabPropsFunction +
WorkspaceTabPropsRoutineParamsModal + WorkspaceTabPropsFunctionParamsModal.

Per spec: docs/superpowers/specs/shadcn-phase2/batch-05-workspace-props.md
```

```
refactor(workspace-props): migrate Table-related props (DDL, Fields, Context)

WorkspaceTabPropsTableContext + WorkspaceTabPropsTableDdlModal +
WorkspaceTabPropsTableFields.

Per spec: docs/superpowers/specs/shadcn-phase2/batch-05-workspace-props.md
```

---

**End of Batch 5 Spec.**
