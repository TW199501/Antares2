# Batch 9 — Notification / EmptyState / Shell（6 個）

**前置依賴**：Batch 0（Sonner / Card / Tooltip）+ Batch 1（BaseSelect）
**估時**：1.5 天
**對應 Plan 段落**：parent-plan §3 Batch 9
**Spec rev**：2026-04-28 against commit `fd44e3a`

---

## 1. Scope

6 個檔（parent-plan 附錄 A.3 #69-#74）— 全 app 視覺化最後一塊。

| # | 檔名 | 用途 |
|---|------|------|
| 69 | `App.vue` | 全 app shell |
| 70 | `Workspace.vue` | Workspace 殼 |
| 71 | `BaseNotification.vue` | 通知系統（**換 Sonner**） |
| 72 | `KeyPressDetector.vue` | 鍵盤事件偵測 |
| 73 | `ForeignKeySelect.vue` | FK select 變體 |
| 74 | `FakerSelect.vue` | Faker select 變體 |

### 1.2 排除清單

- 不動 BaseIcon / BaseLoader / BaseTextEditor / 其他 Tier D 邏輯元件

---

## 2. Pre-flight Drift Check

```bash
cd e:/source/antares2

for f in App Workspace BaseNotification KeyPressDetector ForeignKeySelect FakerSelect; do
   path="src/renderer/$( [ "$f" = "App" ] && echo "App.vue" || echo "components/$f.vue" )"
   c=$(grep -cE "form-input|btn |toast|chip|panel|modal-container" $path 2>/dev/null)
   echo "$f: $c"
done

# 確認 BaseNotification 的 toast / store 用法
grep -rln "BaseNotification\|notificationStore" src/renderer/ --include="*.{vue,ts}" | head -10
```

---

## 3. Primitives Used

- 既有：`Select`（FakerSelect / ForeignKeySelect）
- Batch 0 新加：`Sonner`（取代 BaseNotification）/ `Card`（empty state）/ `Tooltip`

---

## 4. Common Transformations

### 4.1 BaseNotification → Sonner

**舊**：`BaseNotification.vue` 是手刻 `<Teleport>` + `notifications` Pinia store + `<TransitionGroup>`。

**新**：用 `vue-sonner` 的 imperative API：

```ts
// 任何地方需要通知時
import { toast } from '@/components/ui/sonner';

// 成功
toast.success('Connected', {
  description: `Connected to ${connection.name}`
});

// 錯誤
toast.error('Connection failed', {
  description: error.message,
  duration: 8000
});

// 一般 info
toast(t('general.copied'));
```

**App.vue 改動**：
```vue
<script setup>
import { Sonner } from '@/components/ui/sonner';
</script>
<template>
  <div id="wrapper" :class="`theme-${applicationTheme}`">
    ...
    <Sonner />  <!-- 取代 <BaseNotification /> -->
  </div>
</template>
```

**notifications store 處理**：
- 如果 store 只是「保留通知歷史」用 → 保留 store，但 `addNotification` action 改為「同步觸發 `toast(...)` + push 到 history list」
- 如果 store 純為 BaseNotification 渲染所用 → store 可廢，所有 caller 改直接 import `toast`

### 4.2 KeyPressDetector raw input → shadcn Input

```vue
<!-- Before -->
<input
  type="text"
  class="form-input"
  :value="displayKey"
  @keydown.prevent="onKeyDown"
  readonly
/>

<!-- After -->
<Input
  :model-value="displayKey"
  readonly
  class="font-mono text-center"
  @keydown.prevent="onKeyDown"
/>
```

### 4.3 ForeignKeySelect / FakerSelect 整併進 BaseSelect

兩檔目前是 BaseSelect 的特化 wrapper（多了一些 prop normalization）。

**選項 A**：保留兩檔，內部改用新版 BaseSelect。
**選項 B**：把特化邏輯吸進 BaseSelect 的 slot prop，兩檔轉成 inline 用法後刪除。

**Spec 推薦選項 A**：保留檔但內部改寫。減少 caller 端 churn。

```vue
<!-- ForeignKeySelect.vue -->
<template>
  <BaseSelect
    v-model="modelValue"
    :options="formattedOptions"
    :searchable="true"
    :placeholder="t('database.referencedColumn')"
  >
    <template #option="{ option }">
      <BaseIcon icon-name="mdiKey" :size="12" />
      {{ option.label }}
    </template>
  </BaseSelect>
</template>
```

### 4.4 EmptyState 統一 pattern（Workspace.vue 用）

```vue
<Card class="m-auto max-w-[400px] text-center !p-8 !bg-transparent !border-0 shadow-none">
  <CardContent class="space-y-4">
    <BaseIcon icon-name="mdiDatabaseOff" :size="64" class="mx-auto opacity-30" />
    <CardTitle>{{ t('workspace.noConnection') }}</CardTitle>
    <CardDescription>{{ t('workspace.selectConnectionHint') }}</CardDescription>
  </CardContent>
</Card>
```

---

## 5. Per-File Detailed Steps

### 5.1 `BaseNotification.vue` 廢棄計畫（最複雜）

**Step 1**：grep 所有 caller 找 `notificationStore.addNotification` / 等用法：
```bash
grep -rEln "addNotification\|notificationStore" src/renderer/ --include="*.{vue,ts}"
```

**Step 2**：每個 caller 改 import `toast`：
```diff
- import { useNotificationStore } from '@/stores/notifications';
- const notif = useNotificationStore();
- notif.addNotification({ status: 'success', message: 'Connected' });
+ import { toast } from '@/components/ui/sonner';
+ toast.success('Connected');
```

**Step 3**：保留 `notifications` store 但簡化（若仍需 history）：
```ts
// stores/notifications.ts
import { defineStore } from 'pinia';
import { toast } from '@/components/ui/sonner';

export const useNotificationStore = defineStore('notifications', {
  state: () => ({ history: [] as Notification[] }),
  actions: {
    notify(opts) {
      this.history.push({ ...opts, id: crypto.randomUUID(), at: Date.now() });
      // 同時觸發 toast
      const fn = toast[opts.status] || toast;
      fn(opts.message, { description: opts.description });
    }
  }
});
```

**Step 4**：刪 `BaseNotification.vue`。

### 5.2 `App.vue`

**Step 1**：把 `<BaseNotification />` 換 `<Sonner />`。
**Step 2**：根層 `<TooltipProvider :delay-duration="300">` 包整個 app（Batch 0 預留）：
```vue
<TooltipProvider :delay-duration="300">
  <div id="wrapper" :class="`theme-${applicationTheme}`">
    ...
    <Sonner />
  </div>
</TooltipProvider>
```
**Step 3**：grep `App.vue` 內任何 spectre class 拔除。

### 5.3 `Workspace.vue`

**Step 1**：grep spectre class 拔除。
**Step 2**：無連線時的 empty state 套 §4.4。

### 5.4 `KeyPressDetector.vue`

**Step 1**：對照 §4.2 把 raw input 換 `<Input>`。
**Step 2**：保留所有 keydown event handler 不變。

### 5.5 `ForeignKeySelect.vue` + `FakerSelect.vue`

**Step 1**：對照 §4.3 內部改寫。
**Step 2**：caller 端不動。

---

## 6. New Files Created

無（可能修改 `stores/notifications.ts`）。

刪除：
- `src/renderer/components/BaseNotification.vue`

---

## 7. Acceptance Checklist

- [ ] 6 個檔殘留 spectre 為 0
- [ ] `BaseNotification.vue` 已刪
- [ ] 沒有任何 caller 還 import BaseNotification
- [ ] 連線成功 / 失敗 toast 出現
- [ ] toast 顏色對應 status（success 綠 / error 紅 / info 藍）
- [ ] toast 可 manual close（Sonner 內建 X）
- [ ] keyboard shortcut detector 仍捕鍵
- [ ] foreign-key picker / faker picker 行為與 Phase 1 一致
- [ ] Workspace 無連線時顯示 EmptyState
- [ ] §8 grep 全綠

---

## 8. Completion Detection Grep

```bash
cd e:/source/antares2

# 1. 6 個檔殘留 spectre
for entry in "App:src/renderer/App.vue" \
             "Workspace:src/renderer/components/Workspace.vue" \
             "BaseNotification:src/renderer/components/BaseNotification.vue" \
             "KeyPressDetector:src/renderer/components/KeyPressDetector.vue" \
             "ForeignKeySelect:src/renderer/components/ForeignKeySelect.vue" \
             "FakerSelect:src/renderer/components/FakerSelect.vue"; do
   name="${entry%%:*}"; path="${entry##*:}"
   if [ -f "$path" ]; then
      c=$(grep -cE "class=\"[^\"]*\b(form-input|form-label|btn |toast|chip|panel|modal-container)\b" "$path" 2>/dev/null)
      echo "$name: $c"
   else
      echo "$name: (file removed — expected for BaseNotification)"
   fi
done

# 2. BaseNotification.vue 已刪
ls src/renderer/components/BaseNotification.vue 2>&1 | grep -c "cannot access"
# 預期：1（找不到）

# 3. 無 import BaseNotification
grep -rln "BaseNotification" src/renderer/ --include="*.vue" | wc -l
# 預期：0

# 4. App.vue 有 Sonner
grep -c "Sonner" src/renderer/App.vue
# 預期：>= 1

# 5. App.vue 有 TooltipProvider
grep -c "TooltipProvider" src/renderer/App.vue
# 預期：>= 1
```

```bash
# 一鍵總檢
cd e:/source/antares2 && {
  echo -n "BaseNotification file: "; ls src/renderer/components/BaseNotification.vue >/dev/null 2>&1 && echo "STILL EXISTS" || echo "removed ✓"
  echo -n "BaseNotification refs: "; grep -rln "BaseNotification" src/renderer/ --include="*.vue" | wc -l
  echo -n "App.vue Sonner: "; grep -c "Sonner" src/renderer/App.vue
  echo -n "App.vue TooltipProvider: "; grep -c "TooltipProvider" src/renderer/App.vue
}
# 預期：removed ✓ / 0 / 1+ / 1+
```

---

## 9. Manual Smoke Test Plan

- [ ] 連線成功 → 看到綠 toast「Connected」
- [ ] 故意斷網 → 連線失敗 → 看到紅 toast 含錯誤訊息
- [ ] 跑 query 完成 → 看到 info toast「N rows」
- [ ] toast 自動 timeout 消失（4-5 秒）
- [ ] toast 點 X 可手動關
- [ ] 多個 toast 同時出現時不重疊
- [ ] keyboard shortcut detector 在 ModalSettingsShortcuts 可捕鍵
- [ ] FK picker 在 Foreign Key modal 內顯示 + 可選
- [ ] Faker picker 在 ModalFakerRows 顯示 + 可選
- [ ] 沒有連線時打開 app → Workspace 區顯示 EmptyState
- [ ] dark / light theme OK

---

## 10. Rollback

整 batch 回退較複雜（BaseNotification 已刪）：
```bash
git revert <batch-9-commits>...
```

revert 後 BaseNotification 自動回來，Sonner 從 App.vue 移除。

---

## 11. Commit Message

建議拆 3 個 commit：

```
refactor(notifications): migrate BaseNotification to vue-sonner

All callers switched from notificationStore.addNotification to
imperative toast() API. notifications store retained for history.

Per spec: docs/superpowers/specs/shadcn-phase2/batch-09-notif-empty-shell.md
```

```
chore: remove BaseNotification (replaced by Sonner toast)

103-line hand-rolled BaseNotification.vue is no longer referenced.

Per spec: docs/superpowers/specs/shadcn-phase2/batch-09-notif-empty-shell.md
```

```
refactor(shell): migrate App + Workspace + KeyPressDetector + Select variants

Adds TooltipProvider at root. EmptyState pattern used for empty
Workspace. KeyPressDetector internal input switched to shadcn Input.
ForeignKeySelect / FakerSelect internals updated for new BaseSelect.

Per spec: docs/superpowers/specs/shadcn-phase2/batch-09-notif-empty-shell.md
```

---

**End of Batch 9 Spec.** Phase 2 視覺遷移到此完成。Batch 10 進入 spectre 移除終局。
