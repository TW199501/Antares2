# Batch 1 — `BaseSelect` 換 shadcn `Select`（53 callers 一次到位）

**前置依賴**：Batch 0 完成（Select primitive 已存在於 `ui/select/`）
**估時**：1 天
**對應 Plan 段落**：parent-plan §3 Batch 1
**Spec rev**：2026-04-28 against commit `fd44e3a`

---

## 1. Scope

把全 app 最高 leverage 的下拉選單元件 `src/renderer/components/BaseSelect.vue`（477 行手刻 `<div>`）內部換成 shadcn-vue `Select` primitive，**外部 API 完全保留** — 53 個 callers 不需動。

### 1.1 涵蓋的修改

- `src/renderer/components/BaseSelect.vue`（單檔，全內部重寫）

### 1.2 排除清單

- **不**改任何 caller 檔（53 個檔的 `<BaseSelect>` 用法保留）
- **不**遷移 `ForeignKeySelect.vue` / `FakerSelect.vue`（那是 Batch 9）
- **不**動 `src/renderer/components/ui/select/`（Phase 1 已建好）

---

## 2. Pre-flight Drift Check

```bash
cd e:/source/antares2

# 1. 確認 shadcn Select 在
ls src/renderer/components/ui/select/
# 預期：Select.vue SelectContent.vue SelectGroup.vue SelectItem.vue SelectLabel.vue SelectScrollDownButton.vue SelectScrollUpButton.vue SelectSeparator.vue SelectTrigger.vue SelectValue.vue index.ts

# 2. 確認 BaseSelect 行數（基準）
wc -l src/renderer/components/BaseSelect.vue
# 預期：477（如果差太多 → 已被改過，要 re-audit）

# 3. 列出所有 caller，數一次
grep -rl "BaseSelect" src/renderer/components/ --include="*.vue" | wc -l
# 預期：53

# 4. Audit 每個 caller 用到的 BaseSelect props（避免漏掉特殊用法）
grep -rEh "<BaseSelect[^>]*" src/renderer/ --include="*.vue" | \
   grep -oE ":[a-z-]+|@[a-z-]+" | sort -u
# 預期看到 :modelValue / :value / :options / :option-track-by / :option-label /
#         :option-disabled / :group-label / :group-values / :searchable /
#         :preserve-search / :tabindex / :close-on-select / :animation /
#         :dropdown-offsets / :dropdown-class / :disabled / :max-visible-options /
#         :dropdown-match-parent / @select / @open / @close / @update:modelValue /
#         @change / @blur

# 5. 列出用 slot 自訂渲染的 caller（這些是高風險）
grep -rEln "<BaseSelect[^>]*>[^<]*<template[^>]*name=\"option\"" src/renderer/ --include="*.vue"
# 找出來的 caller 必須個別驗收
```

---

## 3. Primitives Used

- `Select` / `SelectTrigger` / `SelectValue` / `SelectContent` / `SelectGroup` / `SelectLabel` / `SelectItem` / `SelectSeparator`（全 shadcn-vue 既有）
- 內部視需要可 import `mdiChevronDown`（trigger 圖示）、`mdiCheck`（已選項標示）

---

## 4. Common Transformations

### 4.1 BaseSelect 18 個 props 的對映

| BaseSelect prop | shadcn Select 對應 | 處理方式 |
|-----------------|---------------------|----------|
| `modelValue` / `value` | `Select` 的 `model-value` | 直接傳 |
| `options: Array` | `SelectItem` v-for | normalize 為統一格式後渲染 |
| `optionTrackBy: string \| function` | 自己實作 normalize | 內部 `getOptionValue()` |
| `optionLabel: string \| function` | 自己實作 normalize | 內部 `getOptionLabel()` |
| `optionDisabled: function` | `SelectItem :disabled` | 直接 bind |
| `groupLabel` / `groupValues` | `SelectGroup` + `SelectLabel` | 巢狀 group 結構 |
| `searchable: boolean` | shadcn Select **不支援**搜尋 | **看 §4.2 fallback** |
| `preserveSearch: boolean` | n/a | 如果 §4.2 採用 fallback，此 prop 才有意義 |
| `tabindex: number` | `SelectTrigger :tabindex` | 直接傳 |
| `closeOnSelect: boolean` | shadcn 預設關 | 預設行為對齊；不對齊則自訂 |
| `animation: string` | reka-ui 內建動畫 | 忽略（用 reka 預設） |
| `dropdownOffsets` | `SelectContent :side-offset` | 部分對應 |
| `dropdownClass: string` | `SelectContent :class` | 直接傳 |
| `disabled: boolean` | `Select :disabled` | 直接傳 |
| `maxVisibleOptions: 100` | n/a | 移除（reka 自有 viewport 處理） |
| `dropdownMatchParent` | `SelectContent` 的 `:position="popper"` + class | 內部處理 |

### 4.2 Searchable 處理 — Combobox 還是 Select？

`shadcn-vue` 的 `Select` primitive **不**支援搜尋輸入。但 53 個 callers 中有許多 column-type select（百級選項）需要 `:searchable="true"`。

**兩個方案**：

#### 方案 A：用 reka-ui 的 `Combobox`（推薦）
shadcn-vue 有獨立 `Combobox` primitive，支援搜尋 + 鍵盤導覽。Phase 2 Batch 0 沒列入但**現在加進去** — 這是 Phase 2 才發現的需求。

```
src/renderer/components/ui/combobox/
├── Combobox.vue
├── ComboboxContent.vue
├── ComboboxInput.vue
├── ComboboxItem.vue
├── ComboboxTrigger.vue
└── index.ts
```

`BaseSelect.vue` 的 template 改為：
```vue
<Combobox v-if="searchable" v-model="internalValue" :options="normalizedOptions">...
<Select v-else v-model="internalValue" :disabled="disabled">...
```

兩個 primitive 都用，根據 prop 切換。

#### 方案 B：用 Select + 手刻 SearchInput
保持 shadcn-vue Combobox 不引入，自己在 `SelectContent` 上方塞 `<Input v-model="searchText" />` + filter `SelectItem` 的渲染。

**spec 推薦方案 A**：Combobox 是 reka 既有，少自刻幾百行邏輯，且 a11y 自動正確（aria-expanded / aria-controls / aria-activedescendant）。

### 4.3 Group options 處理

```vue
<!-- Before：BaseSelect -->
<BaseSelect
  v-model="schema"
  :options="groupedSchemas"
  group-label="database"
  group-values="schemas"
  option-label="name"
  option-track-by="name"
/>

<!-- After：shadcn Select 內部 -->
<Select v-model="modelValue">
  <SelectTrigger>
    <SelectValue :placeholder="placeholder" />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup v-for="group in normalizedOptions" :key="group.id">
      <SelectLabel v-if="group.$type === 'group'">{{ group.label }}</SelectLabel>
      <SelectItem
        v-for="opt in group.children"
        :key="opt.id"
        :value="opt.value"
        :disabled="opt.disabled"
      >
        <slot name="option" :option="opt" :index="opt.index">
          {{ opt.label }}
        </slot>
      </SelectItem>
    </SelectGroup>
  </SelectContent>
</Select>
```

### 4.4 完整重寫範本

```vue
<!-- src/renderer/components/BaseSelect.vue（重寫後） -->
<template>
  <Combobox
    v-if="searchable"
    v-model="internalValue"
    :default-value="internalValue"
    :disabled="disabled"
    @update:model-value="onUpdate"
  >
    <ComboboxTrigger
      :tabindex="tabindex"
      class="select-trigger w-full"
      :class="{ 'opacity-60 cursor-not-allowed': disabled }"
    >
      <ComboboxInput
        :placeholder="currentOptionLabel || placeholder"
        :default-value="searchText"
        @input="(e) => searchText = e.target.value"
      />
      <BaseIcon icon-name="mdiChevronDown" :size="16" class="opacity-60" />
    </ComboboxTrigger>
    <ComboboxContent :class="dropdownClass">
      <ComboboxEmpty>{{ t('general.noResults') }}</ComboboxEmpty>
      <ComboboxGroup v-for="group in filteredOptions" :key="group.id">
        <ComboboxLabel v-if="group.$type === 'group'">{{ group.label }}</ComboboxLabel>
        <ComboboxItem
          v-for="opt in group.children"
          :key="opt.id"
          :value="opt.value"
          :disabled="opt.disabled"
        >
          <slot name="option" :option="opt" :index="opt.index">
            {{ opt.label }}
          </slot>
          <ComboboxItemIndicator>
            <BaseIcon icon-name="mdiCheck" :size="14" />
          </ComboboxItemIndicator>
        </ComboboxItem>
      </ComboboxGroup>
    </ComboboxContent>
  </Combobox>

  <Select
    v-else
    v-model="internalValue"
    :disabled="disabled"
    @update:model-value="onUpdate"
  >
    <SelectTrigger :tabindex="tabindex" :class="['select-trigger w-full', dropdownClass]">
      <SelectValue :placeholder="placeholder">{{ currentOptionLabel }}</SelectValue>
    </SelectTrigger>
    <SelectContent>
      <SelectGroup v-for="group in normalizedOptions" :key="group.id">
        <SelectLabel v-if="group.$type === 'group'">{{ group.label }}</SelectLabel>
        <SelectItem
          v-for="opt in group.children"
          :key="opt.id"
          :value="opt.value"
          :disabled="opt.disabled"
        >
          <slot name="option" :option="opt" :index="opt.index">
            {{ opt.label }}
          </slot>
        </SelectItem>
      </SelectGroup>
    </SelectContent>
  </Select>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Combobox, ComboboxContent, ComboboxEmpty, ComboboxGroup, ComboboxInput,
  ComboboxItem, ComboboxItemIndicator, ComboboxLabel, ComboboxTrigger
} from '@/components/ui/combobox';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectTrigger, SelectValue
} from '@/components/ui/select';
import BaseIcon from '@/components/BaseIcon.vue';

interface Props {
  modelValue?: string | number | object | boolean;
  value?: string | number | object | boolean;
  searchable?: boolean;
  preserveSearch?: boolean;
  tabindex?: number;
  options?: any[];
  optionTrackBy?: string | ((opt: any) => any);
  optionLabel?: string | ((opt: any) => string);
  optionDisabled?: (opt: any) => boolean;
  groupLabel?: string;
  groupValues?: string;
  closeOnSelect?: boolean;
  dropdownClass?: string;
  disabled?: boolean;
  placeholder?: string;
}

const props = withDefaults(defineProps<Props>(), {
  searchable: true,
  preserveSearch: false,
  tabindex: 0,
  options: () => [],
  optionTrackBy: 'value',
  optionLabel: 'label',
  closeOnSelect: true,
  disabled: false
});

const emit = defineEmits<{
  'update:modelValue': [value: any];
  'select': [value: any];
  'open': [];
  'close': [];
  'change': [value: any];
  'blur': [];
}>();

const { t } = useI18n();

const internalValue = ref(props.modelValue ?? props.value);
const searchText = ref('');

watch(() => props.modelValue, (v) => internalValue.value = v);

const _guess = (key: 'optionTrackBy' | 'optionLabel' | 'optionDisabled', item: any) => {
  const prop = props[key];
  if (typeof prop === 'function') return prop(item);
  if (typeof prop === 'string') return item[prop] !== undefined ? item[prop] : item;
  return item;
};

const normalizedOptions = computed(() => {
  // 把 props.options 攤平成統一結構：
  // [{ $type: 'group', id, label, children: [{ $type: 'option', id, value, label, disabled }] }]
  const result: any[] = [];
  for (const curr of props.options) {
    if (props.groupValues && curr[props.groupValues]?.length) {
      result.push({
        $type: 'group',
        id: `group-${curr[props.groupLabel!]}`,
        label: curr[props.groupLabel!],
        children: curr[props.groupValues].map((el: any, idx: number) => ({
          $type: 'option',
          id: `option-${_guess('optionTrackBy', el)}`,
          value: _guess('optionTrackBy', el),
          label: String(_guess('optionLabel', el)),
          disabled: _guess('optionDisabled', el) === true,
          index: idx
        }))
      });
    } else {
      result.push({
        $type: 'group',
        id: 'flat',
        label: '',
        children: [{
          $type: 'option',
          id: `option-${_guess('optionTrackBy', curr)}`,
          value: _guess('optionTrackBy', curr),
          label: String(_guess('optionLabel', curr)),
          disabled: _guess('optionDisabled', curr) === true,
          index: 0
        }]
      });
    }
  }
  return result;
});

const filteredOptions = computed(() => {
  if (!searchText.value) return normalizedOptions.value;
  const q = searchText.value.toLowerCase();
  return normalizedOptions.value.map(g => ({
    ...g,
    children: g.children.filter((opt: any) => opt.label.toLowerCase().includes(q))
  })).filter(g => g.children.length);
});

const currentOptionLabel = computed(() => {
  for (const g of normalizedOptions.value) {
    const found = g.children.find((opt: any) => opt.value === internalValue.value);
    if (found) return found.label;
  }
  return '';
});

const onUpdate = (val: any) => {
  internalValue.value = val;
  emit('update:modelValue', val);
  emit('select', val);
  emit('change', val);
};
</script>

<style scoped>
.select-trigger {
  /* 保留與舊 BaseSelect 一致的高度（32px）對齊 form-input */
  @apply h-8 text-[12px];
}
</style>
```

**注意**：
- `ComboboxItemIndicator` / `ComboboxEmpty` / `ComboboxLabel` 等元件**Batch 0 沒列入** — 必須在 Batch 0 補建（更新 Batch 0 spec）或 Batch 1 開工時補建。
- script 用 `<script setup lang="ts">` 取代舊的 `defineComponent`，是 Phase 2 推薦寫法。

---

## 5. Per-File Detailed Steps

只有 1 個檔，但步驟較多。

### Step 1：建 Combobox primitive（補 Batch 0 缺漏）

如果 Batch 0 沒做 Combobox，本 step 補上：

```bash
mkdir -p /tmp/shadcn-scratch && cd /tmp/shadcn-scratch
pnpm dlx shadcn-vue@latest add combobox
cp components/ui/combobox/* e:/source/antares2/src/renderer/components/ui/combobox/
```

跟 §4.1（Batch 0）的 5 步驟一樣處理（路徑 alias / 圖示 swap / hex token / text-foreground）。

**回頭更新 Batch 0 spec**：在 batch-00-prep.md §1.1 表格內加上 Combobox（13 個 primitive 而非 12 個）。

### Step 2：53 callers 用法 audit

跑 §2 的 grep 4 + 5，把所有用到的 props / slots / events 寫進 audit log：

```bash
cd e:/source/antares2

# 列出所有 BaseSelect 用法及其檔案
grep -rEln "<BaseSelect" src/renderer/components/ --include="*.vue" > /tmp/baseselect-callers.txt
wc -l /tmp/baseselect-callers.txt  # 預期 ~25-30 個檔（多個 caller 一個檔算一次）

# 抽出所有 prop 用法
grep -rEoh ":[a-z-]+=\"[^\"]+\"" src/renderer/ --include="*.vue" | \
   grep -E ":(option-|group-|searchable|tabindex|disabled|max-visible|dropdown-)" | \
   sort | uniq -c | sort -rn > /tmp/baseselect-props-audit.txt
cat /tmp/baseselect-props-audit.txt

# 抽出所有 slot 用法
grep -rEln "<BaseSelect[^>]*>[\s\S]*<template[^>]*name=\"option\"" src/renderer/ --include="*.vue" \
   > /tmp/baseselect-slot-callers.txt
```

### Step 3：備份原檔

```bash
cp src/renderer/components/BaseSelect.vue \
   src/renderer/components/BaseSelect.vue.legacy-backup
git add -N src/renderer/components/BaseSelect.vue.legacy-backup
git stash  # 暫存到 stash，不 commit
```

理由：477 行的舊邏輯（特別是 `flattenOptions`、`hightlightedIndex`、`Transition`）有微妙行為，重寫時隨時 diff 對照。

### Step 4：重寫 BaseSelect.vue

依 §4.4 範本實作。重點：
- 全內部用 TypeScript
- 保留所有 18 props 的「外部介面」（即使內部改用 normalized 形式）
- 所有 emits 全保留（即使 reka 不主動觸發 `@open` / `@close` / `@blur` 也要假觸發以維持相容）

### Step 5：跑 dev mode 53 callers 抽測

開 `pnpm tauri:dev`，驗：
- 連線 panel 的 driver select（5 種 DB type）
- props-table 的 column type select（百級選項，**最高 stress**）
- ModalAskParameters 的 schema picker
- 任何其他「常用」select

每測一個 caller，記在 §9 smoke checklist 上。

### Step 6：跑 e2e

```bash
pnpm test:e2e
```

### Step 7：Stash 還原 + diff 比對

```bash
git stash pop  # 還原 backup
diff src/renderer/components/BaseSelect.vue.legacy-backup \
     src/renderer/components/BaseSelect.vue | head -50
# 對照重寫前後的差異，看有沒有遺漏的邊角 logic
```

確認無問題後刪 backup：
```bash
rm src/renderer/components/BaseSelect.vue.legacy-backup
```

### Step 8：commit

依 §11 commit message。

---

## 6. New Files Created

- `src/renderer/components/ui/combobox/*`（如 Batch 0 沒做）— 約 6-8 個檔

無其他新檔。`BaseSelect.vue` 是改寫，不是新建。

---

## 7. Acceptance Checklist

- [ ] Combobox primitive 已在（從 Batch 0 或本 batch Step 1）
- [ ] `BaseSelect.vue` 改寫完成，外部 18 props 全保留
- [ ] 6 個 emits 全保留（`update:modelValue` / `select` / `open` / `close` / `change` / `blur`）
- [ ] `option` slot 仍可工作（custom render）
- [ ] `group-label` / `group-values` 群組仍可工作
- [ ] `searchable: true` 走 Combobox 路徑，可搜尋
- [ ] `searchable: false` 走 Select 路徑
- [ ] `disabled: true` 視覺反饋 + 不可互動
- [ ] dark / light theme 視覺對齊 pencil
- [ ] 53 callers 抽測 5+ 個典型用例 OK
- [ ] `pnpm vue-tsc --noEmit` 過
- [ ] `pnpm lint` 過
- [ ] `pnpm test:e2e` 全綠
- [ ] §8 完成偵測 grep 全綠

---

## 8. Completion Detection Grep（核心）

```bash
cd e:/source/antares2

# 1. BaseSelect.vue 內部用 shadcn Combobox 或 Select，不再有手刻 select__list 等 class
grep -c "select__\|select-list\|select__option" src/renderer/components/BaseSelect.vue
# 預期：0

# 2. BaseSelect.vue import 了 ui/combobox 與 ui/select
grep -c "from '@/components/ui/\(combobox\|select\)'" src/renderer/components/BaseSelect.vue
# 預期：>= 2

# 3. 沒有任何 caller 因為 API change 需要修改（驗證 backward-compat）
grep -rEln "<BaseSelect" src/renderer/components/ --include="*.vue" | wc -l
# 預期：與 §2 grep 3 數字一致（53）

# 4. 沒有 <BaseSelect> 用了不支援的舊 prop（如已移除的 maxVisibleOptions）
# 此項可選 — 如果保留所有 prop 即使無用，則跳過此檢查
grep -rEoh "<BaseSelect[^>]*:max-visible-options" src/renderer/ --include="*.vue" | wc -l
# 預期：0 或留 N（如果決定 silently ignore，則 N 可大於 0）

# 5. backup 檔已刪
ls src/renderer/components/BaseSelect.vue.legacy-backup 2>&1 | grep -c "cannot access"
# 預期：1（即「找不到」訊息出現一次 = backup 已刪）
```

**全綠的判定**：1 = 0；2 ≥ 2；3 = 53；5 = 1。

```bash
# 一鍵總檢
cd e:/source/antares2 && {
  echo -n "1. spectre BaseSelect classes: "; grep -c "select__\|select-list\|select__option" src/renderer/components/BaseSelect.vue
  echo -n "2. BaseSelect imports ui/: "; grep -c "from '@/components/ui/\(combobox\|select\)'" src/renderer/components/BaseSelect.vue
  echo -n "3. Caller count unchanged: "; grep -rEln "<BaseSelect" src/renderer/components/ --include="*.vue" | wc -l
  echo -n "5. Backup removed: "; ls src/renderer/components/BaseSelect.vue.legacy-backup >/dev/null 2>&1 && echo "STILL EXISTS" || echo "removed ✓"
}
# 預期：0 / 2+ / 53 / removed ✓
```

---

## 9. Manual Smoke Test Plan

開 `pnpm tauri:dev`：

- [ ] **連線 panel driver select**：開 Add Connection → 切換 MySQL / PostgreSQL / SQLite / Firebird / SQL Server → 顯示對應欄位
- [ ] **連線 panel SSH tunnel**：toggle on → 切換 password / key auth select
- [ ] **Props-table column type**：開任一表 Props → 加欄位 → 點 type select → 搜尋 `var` → 看到 VARCHAR / VARBINARY → 選擇
- [ ] **Props-table column collation**：選 utf8 collation 群（grouped options）→ 確認群組標題顯示
- [ ] **ModalAskParameters schema picker**：跑一個 stored procedure → ask param → schema 下拉
- [ ] **History modal limit select**：開 history → 改 limit (10/50/100) → 列表更新
- [ ] **Settings page selects**：theme / language / font-size 各切一次
- [ ] **大選項列表性能**：column type select（>100 選項）切換時無 lag
- [ ] **鍵盤導覽**：focus select → Enter 開 → 上下箭頭 → Enter 選 → ESC 關
- [ ] **搜尋輸入**：Combobox 路徑下，鍵入字元 filter options
- [ ] **Disabled state**：找一個 disabled select（如 SSH 關閉時的 SSH-related select）→ 不可開
- [ ] **dark / light 切換**：切 theme，所有 select 視覺仍對齊

---

## 10. Rollback

**整 batch 回退**：
```bash
git revert <batch-1-commit-hash>
```

副作用：
- BaseSelect 回到舊手刻版（477 行 `<div>`），53 callers 視覺與行為不變（因為外部 API 沒動）
- Batch 2-9 的 spectre 殘留收尾仍可繼續做（不依賴 Batch 1）
- 但 Batch 7 的 sidebar 想用同樣 Combobox primitive 會缺，需另建

**不可單獨回退**：如果已經有後續 batch 假設 Combobox primitive 存在 → revert 會破後續 batch。建議用「往前修」處理 BaseSelect 的個別問題，不 revert 整 batch。

---

## 11. Commit Message

建議 1-2 個 commit：

```
feat(ui): add shadcn-vue Combobox primitive

Combobox supports filtering / search-as-you-type, complementing the
existing Select primitive (which doesn't). Required for BaseSelect
migration (Batch 1) where 53 callers depend on `:searchable="true"`.

Per spec: docs/superpowers/specs/shadcn-phase2/batch-01-base-select.md §4.2
```

```
refactor(base-select): migrate BaseSelect to shadcn-vue Select/Combobox

Replaces 477 lines of hand-rolled <div role="combobox"> with shadcn-vue
Select (when searchable=false) or Combobox (when searchable=true).
External API (18 props, 6 emits, `option` slot) preserved exactly so
all 53 callers remain unchanged.

Refactor benefits:
- Free a11y (aria-* attributes via reka-ui)
- Free keyboard nav (arrow keys, ESC, Enter, type-to-search)
- Free animations (no more <Transition> hand-rolling)
- Removes 300+ lines of hightlightedIndex / mouseDown / blur handling

Per spec: docs/superpowers/specs/shadcn-phase2/batch-01-base-select.md
```

---

**End of Batch 1 Spec.**
