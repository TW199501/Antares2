# Batch 7 — Sidebar & Explore（10 個 — 最高風險）

**前置依賴**：Batch 0（ContextMenu / ScrollArea / Accordion / Tooltip / Card）+ Batch 1
**估時**：3 天 + **1 週 review window**
**對應 Plan 段落**：parent-plan §3 Batch 7
**Spec rev**：2026-04-28 against commit `fd44e3a`

---

## 1. Scope

10 個檔（parent-plan 附錄 A.3 #55-#64）— sidebar / explore tree / 全 app 右鍵選單。

| # | 檔名 | 用途 |
|---|------|------|
| 55 | `TheSettingBar.vue` | 左下 cog（settings 入口） |
| 56 | `SettingBarConnections.vue` | 連線清單面板 |
| 57 | `SettingBarConnectionsFolder.vue` | 連線資料夾項 |
| 58 | `WorkspaceExploreBar.vue` | 左側 explore 樹 |
| 59 | `WorkspaceExploreBarSchema.vue` | Schema 群（表/視圖/函式） |
| 60 | `WorkspaceExploreBarTableContext.vue` | 表右鍵選單 |
| 61 | `WorkspaceExploreBarSchemaContext.vue` | Schema 右鍵選單 |
| 62 | `WorkspaceExploreBarMiscContext.vue` | 其他 explore 右鍵 |
| 63 | `SettingBarContext.vue` | Setting bar 右鍵 |
| 64 | `BaseContextMenu.vue` | **被廢的舊 context menu（Batch 7 移除）** |

### 1.2 排除清單

- 不動 sidebar 拖拉重排邏輯（用 vuedraggable）
- 不動 connection store / workspaces store

### 1.3 高風險原因

Sidebar 是全 app 唯一一個整 session 都顯示的元件 — 視覺穩定性最重要。本 batch 開 PR 後**留 review window 1 週**，多人試用。

---

## 2. Pre-flight Drift Check

```bash
cd e:/source/antares2

for f in TheSettingBar SettingBarConnections SettingBarConnectionsFolder \
         WorkspaceExploreBar WorkspaceExploreBarSchema WorkspaceExploreBarTableContext \
         WorkspaceExploreBarSchemaContext WorkspaceExploreBarMiscContext SettingBarContext; do
   c=$(grep -cE "form-input|btn |menu|panel|chip|navbar|accordion" \
       src/renderer/components/$f.vue 2>/dev/null)
   echo "$f: $c"
done

# 確認 BaseContextMenu 還在 + 列出所有 caller
grep -rln "BaseContextMenu" src/renderer/components/ --include="*.vue"
```

---

## 3. Primitives Used

- 既有：`Button` / `Tooltip` / `Dialog`
- Batch 0 新加：`ContextMenu`（取代 `BaseContextMenu`）/ `ScrollArea`（連線清單）/ `Accordion`（schema 群）/ `Card`（連線卡）/ `Badge`（連線狀態）

---

## 4. Common Transformations

### 4.1 連線卡（連線清單一 row）

```vue
<!-- Before：手刻 div 包 spectre -->
<div class="connection-row" :class="{ active: isActive }">
  <span class="chip">{{ driver }}</span>
  <span class="connection-name">{{ name }}</span>
  <button class="btn btn-link" @click="connect">...</button>
</div>

<!-- After：shadcn Card 風格的 row -->
<ContextMenu>
  <ContextMenuTrigger as-child>
    <div
      :class="['flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer',
               'hover:bg-accent/50',
               isActive && 'bg-accent']"
      @click="connect"
    >
      <Badge :variant="isConnected ? 'success' : 'outline'" class="text-[10px]">
        {{ driver }}
      </Badge>
      <Tooltip>
        <TooltipTrigger as-child>
          <span class="flex-1 truncate text-sm">{{ name }}</span>
        </TooltipTrigger>
        <TooltipContent>{{ host }}:{{ port }}</TooltipContent>
      </Tooltip>
    </div>
  </ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem @click="onEdit">Edit</ContextMenuItem>
    <ContextMenuItem @click="onAppearance">Appearance</ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem class="text-destructive" @click="onDelete">Delete</ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

### 4.2 連線清單 ScrollArea + Folder Accordion

```vue
<ScrollArea class="flex-1">
  <Accordion type="multiple" :default-value="folders.map(f => f.id)">
    <AccordionItem v-for="folder in folders" :key="folder.id" :value="folder.id">
      <AccordionTrigger class="!py-1 px-3 text-xs font-medium">
        <BaseIcon
          icon-name="mdiFolder"
          :size="12"
          :style="{ color: folder.color }"
        />
        {{ folder.name }}
      </AccordionTrigger>
      <AccordionContent>
        <ConnectionRow
          v-for="conn in folder.connections"
          :key="conn.uid"
          :connection="conn"
        />
      </AccordionContent>
    </AccordionItem>
  </Accordion>
  <!-- Top-level (no folder) connections -->
  <ConnectionRow
    v-for="conn in topLevelConnections"
    :key="conn.uid"
    :connection="conn"
  />
</ScrollArea>
```

### 4.3 Explore tree（schema 內表/視圖/函式分類）

```vue
<ScrollArea class="flex-1">
  <Accordion type="multiple" :default-value="['tables']">
    <AccordionItem value="tables">
      <AccordionTrigger>
        <BaseIcon icon-name="mdiTable" :style="{ color: 'var(--color-db-table)' }" />
        {{ t('database.tables') }}
        <Badge variant="secondary" class="ml-auto">{{ tables.length }}</Badge>
      </AccordionTrigger>
      <AccordionContent>
        <ContextMenu v-for="t in tables" :key="t.name">
          <ContextMenuTrigger as-child>
            <Button
              variant="ghost"
              size="sm"
              class="w-full justify-start font-normal text-[12px]"
              @click="openTable(t)"
            >
              {{ t.name }}
            </Button>
          </ContextMenuTrigger>
          <ContextMenuContent>...</ContextMenuContent>
        </ContextMenu>
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="views">...</AccordionItem>
    <AccordionItem value="triggers">...</AccordionItem>
    <AccordionItem value="functions">...</AccordionItem>
    <AccordionItem value="procedures">...</AccordionItem>
    <AccordionItem value="schedulers">...</AccordionItem>
  </Accordion>
</ScrollArea>
```

### 4.4 廢 BaseContextMenu

**步驟**：
1. grep 所有 `BaseContextMenu` 用法（從 §2 已得清單）
2. 改用 shadcn `ContextMenu` + `ContextMenuTrigger` + `ContextMenuContent` + `ContextMenuItem`
3. 確認所有 caller 都改完
4. **刪除** `src/renderer/components/BaseContextMenu.vue`

---

## 5. Per-File Detailed Steps

### 5.1 `BaseContextMenu.vue` 廢棄計畫（先做）

**Step 1**：列出 caller（從 §2 grep）。
**Step 2**：每個 caller 換用 shadcn ContextMenu。
**Step 3**：caller 全改完後，刪 BaseContextMenu.vue。

### 5.2 `SettingBarConnections.vue` + `SettingBarConnectionsFolder.vue`

對照 §4.1 + §4.2 改寫。Folder 用 Accordion，Connection row 用 ContextMenu wrapped。

### 5.3 `TheSettingBar.vue`

下方 cog button 用 `<Tooltip>` + `<DropdownMenu>` 或 `<ContextMenu>`。

### 5.4 `WorkspaceExploreBar.vue` + `Schema.vue`

對照 §4.3 改寫。Schema 切換 select 用 shadcn Select（已 Batch 1 完成的 BaseSelect）。

### 5.5 4 個 Context 檔（TableContext / SchemaContext / MiscContext / SettingBarContext）

這些檔以前是「BaseContextMenu 內容定義」— 現在改成「`ContextMenuContent` + `ContextMenuItem` 群」的 SFC：

```vue
<!-- WorkspaceExploreBarTableContext.vue -->
<template>
  <ContextMenuContent>
    <ContextMenuItem @click="onOpen">{{ t('general.open') }}</ContextMenuItem>
    <ContextMenuItem @click="onDuplicate">{{ t('general.duplicate') }}</ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuSub>
      <ContextMenuSubTrigger>Truncate</ContextMenuSubTrigger>
      <ContextMenuSubContent>
        <ContextMenuItem @click="truncateRestart">RESTART IDENTITY</ContextMenuItem>
        <ContextMenuItem @click="truncateContinue">CONTINUE IDENTITY</ContextMenuItem>
      </ContextMenuSubContent>
    </ContextMenuSub>
    <ContextMenuSeparator />
    <ContextMenuItem class="text-destructive" @click="onDelete">
      {{ t('general.delete') }}
    </ContextMenuItem>
  </ContextMenuContent>
</template>
```

caller 端：
```vue
<ContextMenu>
  <ContextMenuTrigger as-child><div>...</div></ContextMenuTrigger>
  <WorkspaceExploreBarTableContext :table="table" />
</ContextMenu>
```

---

## 6. New Files Created

可選：
- `src/renderer/components/sidebar/ConnectionRow.vue`（連線 row 共用元件，§4.1 抽出）

刪除：
- `src/renderer/components/BaseContextMenu.vue`

---

## 7. Acceptance Checklist

- [ ] 10 個檔殘留 spectre 為 0
- [ ] `BaseContextMenu.vue` 已刪
- [ ] 沒有任何 caller 還 import `BaseContextMenu`
- [ ] sidebar 連線增 / 改 / 刪 / 拖拉重排 OK
- [ ] explore bar 點開表 / 視圖 / 函式分組正確
- [ ] 所有右鍵選單（連線 / 表 / 欄位 / scratchpad / setting bar）皆顯示
- [ ] keyboard shortcut（focus connection list、focus explore bar）仍 work
- [ ] **1 週 review window 內無 regression report**
- [ ] §8 grep 全綠

---

## 8. Completion Detection Grep

```bash
cd e:/source/antares2

# 1. 10 個檔殘留為 0
for f in TheSettingBar SettingBarConnections SettingBarConnectionsFolder \
         WorkspaceExploreBar WorkspaceExploreBarSchema WorkspaceExploreBarTableContext \
         WorkspaceExploreBarSchemaContext WorkspaceExploreBarMiscContext SettingBarContext; do
   c=$(grep -cE "class=\"[^\"]*\b(form-input|btn |menu|panel|chip|navbar|accordion)\b" \
       src/renderer/components/$f.vue 2>/dev/null)
   echo "$f: $c"
done

# 2. BaseContextMenu.vue 已刪
ls src/renderer/components/BaseContextMenu.vue 2>&1 | grep -c "cannot access"
# 預期：1（找不到 = 已刪）

# 3. 無 caller 還 import BaseContextMenu
grep -rln "BaseContextMenu" src/renderer/ --include="*.vue" | wc -l
# 預期：0
```

```bash
# 一鍵總檢
cd e:/source/antares2 && {
  echo -n "BaseContextMenu file: "; ls src/renderer/components/BaseContextMenu.vue >/dev/null 2>&1 && echo "STILL EXISTS" || echo "removed ✓"
  echo -n "BaseContextMenu refs: "; grep -rln "BaseContextMenu" src/renderer/ --include="*.vue" | wc -l
  total=0; for f in TheSettingBar SettingBarConnections SettingBarConnectionsFolder WorkspaceExploreBar WorkspaceExploreBarSchema WorkspaceExploreBarTableContext WorkspaceExploreBarSchemaContext WorkspaceExploreBarMiscContext SettingBarContext; do
     c=$(grep -cE "class=\"[^\"]*\b(form-input|btn |menu|panel|chip|navbar)\b" src/renderer/components/$f.vue 2>/dev/null)
     total=$((total + c))
  done
  echo "Total Batch 7 residue: $total"
}
# 預期：removed ✓ / 0 / 0
```

---

## 9. Manual Smoke Test Plan

**這是高風險 batch — smoke test 比其他 batch 更深入**。

- [ ] App 啟動，sidebar 顯示無破版
- [ ] 已存在的連線清單顯示正確（各 driver Badge 顏色）
- [ ] 點連線 → 連線成功 → explore bar 載入 schema
- [ ] 切換 schema（如 PG 多 schema）→ explore bar 對應切換
- [ ] 展/收每個 explore 群（tables / views / triggers / functions / procedures / schedulers）
- [ ] 表/視圖/觸發器/函式/排程器點擊 → 開對應 tab
- [ ] 右鍵 sidebar 連線 → ContextMenu 顯示 → Edit / Appearance / Delete
- [ ] 右鍵 explore 表 → ContextMenu 顯示 → Open / Truncate / Delete
- [ ] 右鍵 explore schema → ContextMenu 顯示 → New Table / Drop schema
- [ ] 拖拉連線到不同 folder → folder 內容更新
- [ ] 拖拉重排連線順序 → 順序更新且持久化
- [ ] 折疊 / 展開 folder → 視覺正確
- [ ] keyboard：Ctrl+Shift+E → focus explore bar
- [ ] keyboard：Ctrl+Shift+C → focus connection list
- [ ] dark / light theme 切換 OK
- [ ] hover 截斷的連線名 → Tooltip 顯示完整 host:port

---

## 10. Rollback

整 batch 回退較複雜，因為 `BaseContextMenu.vue` 已刪：

```bash
git revert <batch-7-commits>...
```

revert 後 `BaseContextMenu.vue` 自動回來。

**個別檔回退**：可以單獨 revert sidebar 檔；如果連 ContextMenu 改動一起 revert，需手動把 caller 端改回 `<BaseContextMenu>`。

---

## 11. Commit Message

建議拆 4 個 commit：

```
feat(ui): use shadcn ContextMenu in 4 explore/sidebar context defs

WorkspaceExploreBarTableContext + WorkspaceExploreBarSchemaContext +
WorkspaceExploreBarMiscContext + SettingBarContext converted to
ContextMenuContent definitions consumed by sidebar callers.

Per spec: docs/superpowers/specs/shadcn-phase2/batch-07-sidebar-explore.md
```

```
refactor(sidebar): migrate connection list to shadcn ContextMenu + Card

SettingBarConnections + SettingBarConnectionsFolder + TheSettingBar.

Per spec: docs/superpowers/specs/shadcn-phase2/batch-07-sidebar-explore.md
```

```
refactor(explore-bar): migrate Explore tree to shadcn Accordion + ContextMenu

WorkspaceExploreBar + WorkspaceExploreBarSchema.

Per spec: docs/superpowers/specs/shadcn-phase2/batch-07-sidebar-explore.md
```

```
chore: remove BaseContextMenu (replaced by shadcn ContextMenu)

All callers migrated in previous Batch 7 commits. The hand-rolled
189-line BaseContextMenu.vue is no longer referenced.

Per spec: docs/superpowers/specs/shadcn-phase2/batch-07-sidebar-explore.md
```

---

**End of Batch 7 Spec.**
