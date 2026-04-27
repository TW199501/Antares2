# Batch 0 — Primitive 補齊 + Token 完備 + ui-spec 擴充

**前置依賴**：無（Phase 2 起點）
**估時**：2 天
**對應 Plan 段落**：parent-plan §2 前置工作
**Spec rev**：2026-04-28 against commit `fd44e3a`

---

## 1. Scope

新增 **12 個** shadcn-vue primitive 到 `src/renderer/components/ui/`，補齊缺漏的設計 token，更新 `docs/ui-spec.md`。

### 1.1 必須建立的 12 個 primitive

| # | Primitive | 目錄名 | 主要檔案 | reka-ui 底層 |
|---|-----------|--------|----------|--------------|
| 1 | Switch | `ui/switch/` | `Switch.vue` + `index.ts` | `SwitchRoot` + `SwitchThumb` |
| 2 | Textarea | `ui/textarea/` | `Textarea.vue` + `index.ts` | （非 reka，純 `<textarea>`） |
| 3 | Tooltip | `ui/tooltip/` | `Tooltip.vue` + `TooltipContent.vue` + `TooltipTrigger.vue` + `TooltipProvider.vue` + `index.ts` | `TooltipRoot/Content/Trigger/Provider` |
| 4 | Sonner | `ui/sonner/` | `Sonner.vue` + `index.ts` | `vue-sonner` 套件 |
| 5 | ContextMenu | `ui/context-menu/` | `ContextMenu*.vue`（10+ 子元件） | `ContextMenuRoot/Trigger/Content/Item/...` |
| 6 | ScrollArea | `ui/scroll-area/` | `ScrollArea.vue` + `ScrollBar.vue` + `index.ts` | `ScrollAreaRoot/Viewport/Scrollbar/Thumb` |
| 7 | Separator | `ui/separator/` | `Separator.vue` + `index.ts` | `SeparatorRoot` |
| 8 | Badge | `ui/badge/` | `Badge.vue` + `index.ts` | （純 div + cva） |
| 9 | Card | `ui/card/` | `Card.vue` + `CardHeader.vue` + `CardTitle.vue` + `CardContent.vue` + `CardFooter.vue` + `index.ts` | （純 div） |
| 10 | Popover | `ui/popover/` | `Popover.vue` + `PopoverContent.vue` + `PopoverTrigger.vue` + `index.ts` | `PopoverRoot/Trigger/Portal/Content` |
| 11 | RadioGroup | `ui/radio-group/` | `RadioGroup.vue` + `RadioGroupItem.vue` + `index.ts` | `RadioGroupRoot/Item/Indicator` |
| 12 | Accordion | `ui/accordion/` | `Accordion.vue` + `AccordionContent.vue` + `AccordionItem.vue` + `AccordionTrigger.vue` + `index.ts` | `AccordionRoot/Item/Header/Trigger/Content` |

### 1.2 Token 補齊

`src/renderer/assets/tailwind.css` 的 `@theme inline` 區塊需要新增：

- `--success`、`--success-foreground`
- `--warning`、`--warning-foreground`
- `--info`、`--info-foreground`
- `--danger`、`--danger-foreground`（與 `--destructive` 是否同義？看 pencil 設計決定）
- `--connection-color-1` ~ `--connection-color-12`（連線顏色 palette，目前 inline hex）
- `--db-icon-table` / `--db-icon-view` / `--db-icon-trigger` / `--db-icon-function` / `--db-icon-procedure` / `--db-icon-scheduler`（從 `_db-icons.scss` 抽出）

### 1.3 排除清單（不在本 batch）

- 不動既有 9 個 primitive（Button / Checkbox / Dialog / DropdownMenu / FormField / Input / Label / Select / Tabs）
- 不開始遷移任何 `Modal*.vue` / `Workspace*.vue` 元件（那是 Batch 1+）
- 不刪除 `BaseContextMenu.vue`（Batch 7 才刪）
- 不裝 `lucide-vue-next`（永遠不裝，所有圖示走 `BaseIcon` + `mdi*`）

---

## 2. Pre-flight Drift Check

```bash
cd e:/source/antares2

# 1. 確認既有 9 個 primitive 還在
ls src/renderer/components/ui/ | sort
# 預期輸出：button checkbox dialog dropdown-menu form-field input label select tabs

# 2. 確認 reka-ui / cva / clsx / tailwind-merge 已是 deps
node -e "const p = require('./package.json'); ['reka-ui', 'class-variance-authority', 'clsx', 'tailwind-merge'].forEach(d => console.log(d, p.dependencies[d] || 'MISSING'))"

# 3. 確認 vue-sonner 還未安裝（本 batch 才會加）
node -e "console.log('vue-sonner:', require('./package.json').dependencies['vue-sonner'] || 'NOT INSTALLED (expected)')"

# 4. 拍照當下 ui-spec.md 的目錄結構
grep -n "^##" docs/ui-spec.md
```

---

## 3. Primitives Used

本 batch **就是**建立 primitive，所以 §3 是「12 個 primitive 對應的 reka-ui 元件」清單，已列於 §1.1。

額外要安裝的 npm package：

```bash
pnpm add vue-sonner
# 注意：reka-ui 已在 deps，不需重裝
```

---

## 4. Common Transformations

### 4.1 通用 primitive 建檔流程

每個 primitive 走以下 5 步驟：

#### Step A：在 scratch 目錄跑 shadcn-vue CLI
```bash
mkdir -p /tmp/shadcn-scratch && cd /tmp/shadcn-scratch
pnpm dlx shadcn-vue@latest init --yes  # 一次就好
pnpm dlx shadcn-vue@latest add switch  # 例：add Switch
```
→ 會在 `/tmp/shadcn-scratch/components/ui/switch/` 產出 `Switch.vue` + `index.ts`。

#### Step B：手抄到本 repo
```bash
mkdir -p e:/source/antares2/src/renderer/components/ui/switch
cp /tmp/shadcn-scratch/components/ui/switch/* \
   e:/source/antares2/src/renderer/components/ui/switch/
```

#### Step C：套用 4 條本 repo 強制改寫

| 改寫 | 來源（CLI 預設） | 目標（本 repo 規範） |
|------|------------------|----------------------|
| 路徑 alias | `@/lib/utils` | `@/utils/cn`（或本 repo 既有 `cn` 工具位置） |
| 圖示 import | `lucide-vue-next` 的 `Check`、`X` 等 | `BaseIcon` + `mdiCheck`、`mdiClose` 等 mdi 名稱 |
| Token 解析 | `hsl(var(--background))` | `bg-background` 直接用（hex token） |
| `text-foreground` 補丁 | `<input>` / `<textarea>` 預設沒有 | 強制加 `text-foreground` 到 raw input element（避免 dark mode 黑底黑字） |

#### Step D：在 SFC 開頭寫 `<!-- @usage -->` 範例
```vue
<!--
  @usage
  <Switch v-model:checked="isOn" />
  <Switch v-model:checked="isOn" disabled />
  <Switch v-model:checked="isOn" @update:checked="onChange" />
-->
<template>...</template>
```
理由：未來 Claude / 人在 IDE hover SFC 名稱時能直接看到用法，不必跳檔讀 reka-ui 文件。

#### Step E：在 `pnpm tauri:dev` 內掛載 1 次驗證
```vue
<!-- 暫時在 App.vue 或 ScratchpadDev.vue（如有）掛一個 demo -->
<Switch v-model:checked="demoSwitch" />
<!-- 看 console 無 error，視覺對齊 pencil 規格 → 拆掉 demo -->
```

### 4.2 Sonner 特殊：替換 BaseNotification 的 store 渲染

Sonner 不是 reka-ui，是獨立套件 `vue-sonner`。本 batch 只**建立 primitive**，**不**移除 `BaseNotification.vue`（那是 Batch 9）。建立後是「未使用狀態」，等 Batch 9 接管。

```vue
<!-- src/renderer/components/ui/sonner/Sonner.vue -->
<script setup lang="ts">
import { Toaster, toast } from 'vue-sonner';
export { toast };
</script>
<template>
  <Toaster
    position="bottom-right"
    rich-colors
    close-button
    :toast-options="{
      classes: {
        toast: 'bg-card border-border text-card-foreground shadow-lg',
        title: 'text-[14px] font-medium',
        description: 'text-[12px] text-muted-foreground'
      }
    }"
  />
</template>
```

→ Batch 9 才在 `App.vue` 加 `<Sonner />`。本 batch 不掛。

---

## 5. Per-File Detailed Steps

按建檔複雜度由低到高排序。

### 5.1 Switch（最簡單）

**Step 1**：跑 §4.1 5 步驟。

**Step 2**：CLI 預設 `Switch.vue` 用 `bg-input` 當 unchecked 背景；本 repo 改用 `bg-muted` 對齊 pencil。

**Step 3**：thumb 內預設無圖示；可選擇加 `mdiCheck` / `mdiClose` 視覺強化（與設計討論決定）。

**Step 4**：`<!-- @usage -->` 範例：
```vue
<Switch v-model:checked="settings.darkMode" />
<Switch v-model:checked="settings.notificationsEnabled" :disabled="isReadOnly" />
```

### 5.2 Textarea

**Step 1**：跑 §4.1。

**Step 2**：上游 `Textarea.vue` 沒有 `text-foreground` — **必須加**（同 Input.vue 的 patch）。

**Step 3**：補 `placeholder:text-muted-foreground` 讓 placeholder 在 dark mode 可見。

**Step 4**：`@usage`：
```vue
<Textarea v-model="note.content" rows="6" placeholder="Write something..." />
<Textarea v-model="ddl" readonly class="font-mono text-[12px]" />
```

### 5.3 Tooltip（多元件 + Provider）

**Step 1**：跑 §4.1，但會抄到 4 個檔（Tooltip.vue / TooltipContent.vue / TooltipTrigger.vue / TooltipProvider.vue）。

**Step 2**：在 `App.vue` 最外層包 `<TooltipProvider :delay-duration="300">`（**Batch 0 只建檔不掛載**；標註 TODO）。

**Step 3**：CLI 預設 `TooltipContent` 用 `bg-primary text-primary-foreground`；改成 `bg-popover text-popover-foreground border` 對齊 spectre tooltip 視覺。

**Step 4**：`@usage`：
```vue
<Tooltip>
  <TooltipTrigger as-child>
    <Button variant="ghost" size="icon"><BaseIcon icon-name="mdiContentCopy" /></Button>
  </TooltipTrigger>
  <TooltipContent>{{ t('general.copy') }}</TooltipContent>
</Tooltip>
```

### 5.4 Sonner

**Step 1**：`pnpm add vue-sonner`。

**Step 2**：建 `src/renderer/components/ui/sonner/Sonner.vue`（內容見 §4.2）。

**Step 3**：`index.ts` re-export：
```ts
export { default as Sonner } from './Sonner.vue';
export { toast } from 'vue-sonner';
```

**Step 4**：**不**掛載 `<Sonner />` 到 App.vue（Batch 9 任務）。

### 5.5 ContextMenu（檔案最多 — 10+ 個子元件）

**Step 1**：跑 §4.1，會抄到一大堆（ContextMenu.vue / ContextMenuTrigger.vue / ContextMenuContent.vue / ContextMenuItem.vue / ContextMenuLabel.vue / ContextMenuSeparator.vue / ContextMenuShortcut.vue / ContextMenuSub.vue / ContextMenuSubTrigger.vue / ContextMenuSubContent.vue / ContextMenuCheckboxItem.vue / ContextMenuRadioGroup.vue / ContextMenuRadioItem.vue）。

**Step 2**：所有 `lucide` 圖示換 `BaseIcon`：
- `Check` → `mdiCheck`
- `Circle` → `mdiCircleSmall`（指 RadioItem 的點）
- `ChevronRight` → `mdiChevronRight`（指 SubTrigger）

**Step 3**：`@usage`：
```vue
<ContextMenu>
  <ContextMenuTrigger as-child>
    <div class="connection-card">...</div>
  </ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem @click="onEdit">
      <BaseIcon icon-name="mdiPencil" :size="14" /> {{ t('general.edit') }}
    </ContextMenuItem>
    <ContextMenuItem @click="onDelete" class="text-destructive">
      <BaseIcon icon-name="mdiDelete" :size="14" /> {{ t('general.delete') }}
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

### 5.6 ScrollArea

**Step 1**：跑 §4.1，2 檔（ScrollArea.vue + ScrollBar.vue）。

**Step 2**：CLI 預設 thumb 用 `bg-border`；改 `bg-muted-foreground/30 hover:bg-muted-foreground/50` 讓 hover 反饋更明顯。

**Step 3**：`@usage`：
```vue
<ScrollArea class="h-[400px] w-full">
  <div v-for="conn in connections" :key="conn.id">...</div>
</ScrollArea>
```

### 5.7 Separator

**Step 1**：跑 §4.1。

**Step 2**：CLI 預設 `bg-border`；保留。

**Step 3**：補 `orientation="vertical"` 範例（Phase 2 sidebar / footer 多用垂直分隔）。

### 5.8 Badge

**Step 1**：跑 §4.1。

**Step 2**：CLI 預設 4 個 variants（default / secondary / destructive / outline）；新增本 repo 用的 `success` / `warning` / `info` variants：
```ts
const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ...',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground',
        success: 'border-transparent bg-success text-success-foreground',  // NEW
        warning: 'border-transparent bg-warning text-warning-foreground',  // NEW
        info: 'border-transparent bg-info text-info-foreground'            // NEW
      }
    },
    defaultVariants: { variant: 'default' }
  }
);
```

### 5.9 Card

**Step 1**：跑 §4.1，5 個子元件。

**Step 2**：dark mode 時 `--card` 是 `rgb(255 255 255 / 0.04)`（navy glass）— **不要**動成 opaque。Card 視覺淡是設計意圖。

**Step 3**：CardHeader / Footer 預設 padding 是 `p-6`；本 repo settings panel 用 `p-4`，建議再加一個 `compact` prop：
```vue
<Card>
  <CardHeader :compact="isCompactMode">...
</Card>
```

或更簡單：caller 直接加 `class="!p-4"`。Spec 推薦後者，避免 prop 增生。

### 5.10 Popover

**Step 1**：跑 §4.1，3 檔。

**Step 2**：`PopoverContent` 的 portal 預設掛在 `body`；Tauri webview 內可能與 Dialog overlay 互搶 z-index — 如遇此問題，改用 `<PopoverPortal disabled>` 讓 popover 留在原 DOM 層。

**Step 3**：`@usage`：
```vue
<Popover>
  <PopoverTrigger as-child>
    <Button variant="outline" size="icon"><BaseIcon icon-name="mdiPalette" /></Button>
  </PopoverTrigger>
  <PopoverContent class="w-[200px]">
    <ColorPickerInline v-model="color" />
  </PopoverContent>
</Popover>
```

### 5.11 RadioGroup

**Step 1**：跑 §4.1，2 檔。

**Step 2**：與 Checkbox 視覺對齊（圓點 vs 勾號），共享 token。

**Step 3**：`@usage`：
```vue
<RadioGroup v-model="settings.autoUpdate">
  <div class="flex items-center gap-2">
    <RadioGroupItem id="auto-on" value="enabled" />
    <Label for="auto-on">{{ t('settings.autoUpdate.enabled') }}</Label>
  </div>
  <div class="flex items-center gap-2">
    <RadioGroupItem id="auto-off" value="disabled" />
    <Label for="auto-off">{{ t('settings.autoUpdate.disabled') }}</Label>
  </div>
</RadioGroup>
```

### 5.12 Accordion

**Step 1**：跑 §4.1，4 檔。

**Step 2**：`AccordionTrigger` 預設 chevron 用 `lucide` 的 `ChevronDown`；換 `mdiChevronDown`。

**Step 3**：`@usage`：
```vue
<Accordion type="multiple" :default-value="['tables', 'views']">
  <AccordionItem value="tables">
    <AccordionTrigger>{{ t('database.tables') }}</AccordionTrigger>
    <AccordionContent>
      <div v-for="t in tables" :key="t.name">{{ t.name }}</div>
    </AccordionContent>
  </AccordionItem>
  <AccordionItem value="views">...</AccordionItem>
</Accordion>
```

### 5.13 Token 補齊（§1.2 細節）

開 `src/renderer/assets/tailwind.css`，在 `@theme inline { ... }` 區塊內：

```css
@theme inline {
  /* ... existing tokens ... */

  /* Status colors — Phase 2 additions */
  --color-success: #16a34a;
  --color-success-foreground: #ffffff;
  --color-warning: #f59e0b;
  --color-warning-foreground: #1a1a1a;
  --color-info: #0284c7;
  --color-info-foreground: #ffffff;
  --color-danger: #dc2626;
  --color-danger-foreground: #ffffff;

  /* Connection palette — abstract from inline hex callsites */
  --color-connection-1: #3b82f6;  /* blue */
  --color-connection-2: #10b981;  /* green */
  /* ... 12 顏色，依 pencil 設計 ... */

  /* DB icon colors — abstract from _db-icons.scss */
  --color-db-table: #3b82f6;
  --color-db-view: #8b5cf6;
  --color-db-trigger: #f59e0b;
  --color-db-function: #10b981;
  --color-db-procedure: #ec4899;
  --color-db-scheduler: #06b6d4;
}

/* dark mode overrides — 如果 dark / light 顏色不同 */
.theme-dark {
  --color-success: #22c55e;
  /* ... */
}
```

**注意**：實際 hex 值由 `pencil-new.pen` 決定。pencil MCP 開檔讀色票。

### 5.14 ui-spec.md 擴充

開 `docs/ui-spec.md`，新增章節：

```markdown
## Phase 2 primitive coverage

下表列出每個 primitive 的「該用 / 不該用」場景，作為 Phase 2 遷移時的 contract。

| Primitive | 該用於 | 不該用於 |
|-----------|--------|----------|
| Switch | settings 布林 toggle、connection enabled/disabled | 表單必填欄位（用 Checkbox） |
| Textarea | DDL 顯示、SQL body、note 內容 | 單行輸入（用 Input） |
| Tooltip | 圖示按鈕說明、截斷文字 hover | 主要操作說明（應該寫在 button label 內） |
| Sonner | 操作成功/失敗 toast、async 結果 | 阻塞性確認（用 BaseConfirmModal） |
| ContextMenu | sidebar 連線右鍵、explore tree 表/欄右鍵、scratchpad note 右鍵 | 普通下拉選單（用 DropdownMenu） |
| ScrollArea | 連線清單、explore tree、長 list | 主內容區（瀏覽器原生捲軸已夠） |
| Separator | 群組之間的視覺分隔 | 替代 padding（應該用 spacing） |
| Badge | 連線狀態 chip、表/欄類型標籤、版本標 | 主要 CTA（應該用 Button） |
| Card | settings 區塊、連線卡、empty state 容器 | 整 modal 殼（用 Dialog） |
| Popover | 顏色選、額外操作浮動面板 | 確認對話（用 Dialog 或 BaseConfirmModal） |
| RadioGroup | 互斥選擇 2-5 項 | 6+ 項（用 Select） |
| Accordion | sidebar 群組摺疊、settings tab 內次群 | tab 切換（用 Tabs） |
```

---

## 6. New Files Created

```
src/renderer/components/ui/switch/Switch.vue
src/renderer/components/ui/switch/index.ts
src/renderer/components/ui/textarea/Textarea.vue
src/renderer/components/ui/textarea/index.ts
src/renderer/components/ui/tooltip/Tooltip.vue
src/renderer/components/ui/tooltip/TooltipContent.vue
src/renderer/components/ui/tooltip/TooltipProvider.vue
src/renderer/components/ui/tooltip/TooltipTrigger.vue
src/renderer/components/ui/tooltip/index.ts
src/renderer/components/ui/sonner/Sonner.vue
src/renderer/components/ui/sonner/index.ts
src/renderer/components/ui/context-menu/ContextMenu.vue
src/renderer/components/ui/context-menu/ContextMenuCheckboxItem.vue
src/renderer/components/ui/context-menu/ContextMenuContent.vue
src/renderer/components/ui/context-menu/ContextMenuGroup.vue
src/renderer/components/ui/context-menu/ContextMenuItem.vue
src/renderer/components/ui/context-menu/ContextMenuLabel.vue
src/renderer/components/ui/context-menu/ContextMenuRadioGroup.vue
src/renderer/components/ui/context-menu/ContextMenuRadioItem.vue
src/renderer/components/ui/context-menu/ContextMenuSeparator.vue
src/renderer/components/ui/context-menu/ContextMenuShortcut.vue
src/renderer/components/ui/context-menu/ContextMenuSub.vue
src/renderer/components/ui/context-menu/ContextMenuSubContent.vue
src/renderer/components/ui/context-menu/ContextMenuSubTrigger.vue
src/renderer/components/ui/context-menu/ContextMenuTrigger.vue
src/renderer/components/ui/context-menu/index.ts
src/renderer/components/ui/scroll-area/ScrollArea.vue
src/renderer/components/ui/scroll-area/ScrollBar.vue
src/renderer/components/ui/scroll-area/index.ts
src/renderer/components/ui/separator/Separator.vue
src/renderer/components/ui/separator/index.ts
src/renderer/components/ui/badge/Badge.vue
src/renderer/components/ui/badge/index.ts
src/renderer/components/ui/card/Card.vue
src/renderer/components/ui/card/CardContent.vue
src/renderer/components/ui/card/CardDescription.vue
src/renderer/components/ui/card/CardFooter.vue
src/renderer/components/ui/card/CardHeader.vue
src/renderer/components/ui/card/CardTitle.vue
src/renderer/components/ui/card/index.ts
src/renderer/components/ui/popover/Popover.vue
src/renderer/components/ui/popover/PopoverContent.vue
src/renderer/components/ui/popover/PopoverTrigger.vue
src/renderer/components/ui/popover/index.ts
src/renderer/components/ui/radio-group/RadioGroup.vue
src/renderer/components/ui/radio-group/RadioGroupItem.vue
src/renderer/components/ui/radio-group/index.ts
src/renderer/components/ui/accordion/Accordion.vue
src/renderer/components/ui/accordion/AccordionContent.vue
src/renderer/components/ui/accordion/AccordionItem.vue
src/renderer/components/ui/accordion/AccordionTrigger.vue
src/renderer/components/ui/accordion/index.ts
```

**修改的既有檔案**：
- `src/renderer/assets/tailwind.css` — 新增 §5.13 token
- `docs/ui-spec.md` — 新增「Phase 2 primitive coverage」章節
- `package.json` — 新增 `vue-sonner` dep

---

## 7. Acceptance Checklist

- [ ] 12 個 primitive 目錄全建立
- [ ] 每個 primitive 的 `Switch.vue` / `Card.vue` 等主檔有 `<!-- @usage -->` 範例
- [ ] 沒有任何 primitive 用到 `lucide-vue-next` import
- [ ] 沒有任何 primitive 用 `hsl(var(--...))` 形式（要直接 hex var）
- [ ] `text-foreground` 有加在 `Textarea` 與其他 raw input element
- [ ] `pnpm add vue-sonner` 跑過，`pnpm-lock.yaml` 有更新
- [ ] `pnpm vue-tsc --noEmit` 過
- [ ] `pnpm lint` 過
- [ ] `pnpm tauri:dev` 啟動正常，console 無 error
- [ ] `tailwind.css` 補上 §5.13 token，且 dev mode 內 `bg-success` 等 utility 真的渲染出顏色
- [ ] `docs/ui-spec.md` 有新增「Phase 2 primitive coverage」章節
- [ ] §8 完成偵測 grep 回 0

---

## 8. Completion Detection Grep（核心防遺漏）

```bash
cd e:/source/antares2

# 1. 所有 12 個 primitive 目錄都存在 → 預期回 12
ls -d src/renderer/components/ui/{switch,textarea,tooltip,sonner,context-menu,scroll-area,separator,badge,card,popover,radio-group,accordion} 2>/dev/null | wc -l

# 2. 沒有 primitive 用到 lucide-vue-next → 預期回 0
grep -rln "lucide-vue-next" src/renderer/components/ui/ | wc -l

# 3. 沒有 primitive 用 hsl(var()) 形式 → 預期回 0（除歷史註解外）
grep -rln "hsl(var(--" src/renderer/components/ui/ | grep -v "^.*://" | wc -l

# 4. Textarea 有加 text-foreground → 預期回非 0（至少 1 行匹配）
grep -c "text-foreground" src/renderer/components/ui/textarea/Textarea.vue

# 5. ui-spec.md 有 Phase 2 primitive coverage 段 → 預期回非 0
grep -c "Phase 2 primitive coverage" docs/ui-spec.md

# 6. vue-sonner 已裝 → 預期回非 0
node -e "console.log(require('./package.json').dependencies['vue-sonner'] || 'MISSING')"
```

**全綠的判定**：1 應為 12；2、3 應為 0；4、5、6 應為非 0/MISSING。

```bash
# 一鍵總檢
cd e:/source/antares2 && {
  echo -n "1. primitives: "; ls -d src/renderer/components/ui/{switch,textarea,tooltip,sonner,context-menu,scroll-area,separator,badge,card,popover,radio-group,accordion} 2>/dev/null | wc -l
  echo -n "2. lucide refs: "; grep -rln "lucide-vue-next" src/renderer/components/ui/ | wc -l
  echo -n "3. hsl(var): "; grep -rln "hsl(var(--" src/renderer/components/ui/ | wc -l
  echo -n "4. textarea text-fg: "; grep -c "text-foreground" src/renderer/components/ui/textarea/Textarea.vue
  echo -n "5. ui-spec section: "; grep -c "Phase 2 primitive coverage" docs/ui-spec.md
  echo -n "6. vue-sonner dep: "; node -e "console.log(require('./package.json').dependencies['vue-sonner'] || 'MISSING')"
}
# 預期：12 / 0 / 0 / 1+ / 1+ / "^0.0.0" 或類似版本
```

---

## 9. Manual Smoke Test Plan

開 `pnpm tauri:dev`，逐項：

- [ ] App 啟動，console 無 error
- [ ] 在 ScratchpadDev（或臨時 demo）掛 `<Switch v-model:checked="x" />`，點擊 toggle，視覺反饋 OK
- [ ] 掛 `<Textarea v-model="y" placeholder="test" />`，dark mode 下打字看得見、placeholder 灰色
- [ ] 掛 Tooltip 範例，hover 300ms 後出現 tooltip
- [ ] 在 console 跑 `import { toast } from '@/components/ui/sonner'; toast.success('hi')` — Sonner 還未掛載到 App 所以**不會出現**（預期），確認 import 路徑可解析即可
- [ ] 掛 ContextMenu 範例，右鍵元素顯示選單；ESC 關閉
- [ ] 掛 ScrollArea 包一個高 600px 的 div，捲動時自訂 scrollbar 出現
- [ ] 掛 `<Separator />` 與 `<Separator orientation="vertical" />`，視覺對齊 1px 細線
- [ ] 掛 `<Badge variant="success">OK</Badge>`、`variant="warning">!</Badge>`，顏色對應 token
- [ ] 掛 Card + Header/Title/Content，dark mode 下 navy glass 視覺正確
- [ ] 掛 Popover + Trigger button，點擊 trigger 浮層出現
- [ ] 掛 RadioGroup 3 個 option，鍵盤 Tab + 方向鍵切換 OK
- [ ] 掛 Accordion 2 個 item，點 trigger 展/收
- [ ] 切 dark / light theme，所有 demo 視覺都有對應反應

---

## 10. Rollback

**單一 primitive 回退**：
```bash
git checkout HEAD -- src/renderer/components/ui/<name>/
```
副作用：無（沒有 caller 用到，因為 Batch 0 不掛載任何 primitive 到實際畫面）。

**整 batch 回退**：
```bash
git revert <batch-0-commit-hash>
pnpm install  # 移除 vue-sonner
```
副作用：Batch 1 之後不能開工（依賴 primitives）。

**特殊**：`tailwind.css` 的 token 改動不可單獨 revert — 如果 Batch 0 後 token 已被其他 PR 引用，revert 會破未完成的元件。優先用「往前修」而非 revert。

---

## 11. Commit Message

建議拆成 3 個 commit：

```
feat(ui): add 12 shadcn-vue primitives for Phase 2

Switch / Textarea / Tooltip / Sonner / ContextMenu / ScrollArea /
Separator / Badge / Card / Popover / RadioGroup / Accordion.

All primitives follow repo conventions:
- BaseIcon swap (no lucide-vue-next)
- Hex CSS vars (no hsl(var()) wrap)
- text-foreground on raw input elements
- @usage examples inline

Per spec: docs/superpowers/specs/shadcn-phase2/batch-00-prep.md
```

```
feat(tokens): add status / connection / db-icon color tokens

Adds --success/--warning/--info/--danger and their -foreground pairs,
plus connection palette (12 colors) and db-icon colors abstracted
from _db-icons.scss.

Per spec: docs/superpowers/specs/shadcn-phase2/batch-00-prep.md §5.13
```

```
docs(ui-spec): document Phase 2 primitive coverage

New section listing each primitive's intended use cases and
anti-patterns. Acts as contract for Phase 2 batch migrations.

Per spec: docs/superpowers/specs/shadcn-phase2/batch-00-prep.md §5.14
```

---

**End of Batch 0 Spec.**
