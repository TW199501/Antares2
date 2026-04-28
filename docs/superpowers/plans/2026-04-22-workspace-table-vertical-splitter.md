# Workspace Table Vertical Splitter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the pop-out filter form in `WorkspaceTabTable.vue` with a permanent two-pane vertical layout — a reserved 300-px query area on top (intentionally empty for now; user will plug a custom query UI in later) and the existing result table on the bottom, separated by a 6-px draggable horizontal bar that persists its position across app restarts.

**Architecture:** One new hand-rolled `BaseSplitV` component (vertical splitter; `pointerdown/move/up` + `v-model:topHeight` + `@resize-end`; double-click resets to `defaultTopHeight` prop) plus one empty `WorkspaceTabTableQueryArea` placeholder SFC. Persistence lives on the existing Pinia `settings` store via a new `tableQueryAreaHeight` field that uses the same snake_case `saveStore` / `loadStore` pattern the store already follows. `WorkspaceTabTable.vue` swaps its filter `v-if="isSearch"` block and the `.empty` island for a splitter that wraps the query area and the existing `<WorkspaceTabQueryTable>` — the latter is untouched.

**Tech Stack:** Vue 3.5 (`<script setup>`), Pinia, Tailwind v4 utilities + shadcn-vue primitives, pnpm, the repo's existing `@/libs/persistStore` wrapper around the Tauri FS plugin. No new packages. No Element Plus (we do not ship it and will not add it just for this).

---

## Background & Context

### Why this plan exists

- In `WorkspaceTabTable.vue` the old layout uses a pop-open `<WorkspaceTabTableFilters v-if="isSearch">` form that sits between toolbar and results. User has confirmed (session 2026-04-22) they will build a different query UI and do **not** want the existing filter form anymore.
- They want a **reserved 300-px empty zone** above the result table — a "slot" where the future query UI will live — separated by an up/down draggable bar. Pattern reference: `e:\source\platfrom-admin\Web\src\views\system\database\sqlQuery.vue` lines 699–733 (Element Plus `el-splitter layout="vertical"`).
- antares2 does not bundle Element Plus. The stack is Tailwind v4 + shadcn-vue + vueuse; the right way is a tiny dedicated splitter component that matches the existing primitive style in `src/renderer/components/ui/` and is usable from any workspace tab in the future.
- The dragged height must persist: "關閉畫面再開啟預設 300px，拖拉過已設為主" — default 300 on fresh install, user's last-dragged value after that. Per-app (all tables share the same height), not per-tab — matches net-admin behavior.

### What this plan deliberately does NOT do

- Implement the real query UI. The top pane is an empty placeholder with one hint string (`application.queryAreaPlaceholder`). The user will fill it in a follow-up session.
- Delete `WorkspaceTabTableFilters.vue` from disk. It stays unimported but on disk so the file remains rediscoverable if the user wants to port parts of it into the future query UI. A separate clean-up commit can delete it once the replacement ships.
- Touch `WorkspaceTabQueryTable.vue` body, headers, the `useCommentHeader` work, or any of the other `workspace-query-info` divider work we just finished.
- Add SFC unit tests. antares2 has no SFC test harness; per `feedback_vue_sfc_needs_runtime_smoke.md` we verify with `pnpm tauri:dev` + manual checklist.

### Pre-existing uncommitted state

The working tree currently has **one** uncommitted file: `src/renderer/components/WorkspaceTabTable.vue`. The diff is the toolbar reorg that the user already approved earlier in the session (export → right info bar, 39-px footer, `!text-[14px]` unification, `|` dividers between info items, SCSS reverted). Task 1 below commits it cleanly before we start structural layout work.

### Decisions locked in before planning

| Decision | Choice | Why |
| --- | --- | --- |
| Splitter implementation | Hand-rolled `BaseSplitV.vue` using native pointer events | Adding Element Plus for one widget is disproportionate; `@vueuse/core` `useDraggable` moves an element, not a divider handle, so reusing it would mean fighting its semantics. Native `pointerdown/move/up` is ~40 lines and also supports touch & pen. |
| Handle thickness | 6 px | Matches net-admin's `.el-splitter-bar { height: 6px }` exactly so muscle memory transfers. |
| Handle hover state | `hover:bg-primary` | Same visual pattern net-admin uses (`&:hover { background: var(--el-color-primary) }`). |
| Default top height | 300 px | User-specified. |
| Persistence scope | App-level via `settings` store (single scalar field) | User said once-dragged becomes the new default everywhere. Not per-tab. |
| Persistence trigger | `@resize-end` event fires on `pointerup`, emitting final px value; store action persists once per drag | Writing to Tauri FS on every pointermove tick would thrash the disk; writing only on pointerup is lossless and cheap. |
| Min top / min bottom | 80 / 80 px | Matches net-admin's `:min="80"`. Below 80 px the user can no longer grab the handle comfortably. |
| Reset gesture | Double-click the handle resets to `defaultTopHeight` | Discoverable; matches the "restore column width by double-clicking the resize handle" pattern most SQL clients have. |
| Placeholder content | Single centered line of muted text, translated via `application.queryAreaPlaceholder` | Keeps the 300-px zone visibly reserved (not blank-looking-broken) and makes the follow-up session's goal obvious to any reader. |

### File map

Files created:

- `src/renderer/components/BaseSplitV.vue` — vertical splitter. Two slots (`#top`, `#bottom`). Props: `topHeight` (controlled, px), `minTop = 80`, `minBottom = 80`, `defaultTopHeight = 300`. Emits `update:topHeight` and `resize-end`. Uses `pointerdown / pointermove / pointerup` (capture-enabled via `setPointerCapture`), Tailwind-only styles, no SCSS.
- `src/renderer/components/WorkspaceTabTableQueryArea.vue` — placeholder SFC. Full-size div with `flex items-center justify-center text-muted-foreground text-[13px]` rendering `t('application.queryAreaPlaceholder')`. No props, no emits. Swappable by the follow-up session.

Files modified:

- `src/renderer/stores/settings.ts` — add `tableQueryAreaHeight: 300 as number` to state; add the matching `init()` branch reading `settings.table_query_area_height`; add the matching `persistSettings()` branch writing `table_query_area_height: this.tableQueryAreaHeight`; add `setTableQueryAreaHeight(h: number)` action.
- `src/renderer/components/WorkspaceTabTable.vue` — remove the `<WorkspaceTabTableFilters v-if="isSearch" ...>` block; remove the old filter `<Button>` (the 🔍 magnify one) from the workspace-query-buttons row; replace the `workspace-query-results` data view with a `<BaseSplitV>` that wraps a `<WorkspaceTabTableQueryArea>` in `#top` and the existing `<WorkspaceTabQueryTable>` in `#bottom`; keep the floating "沒有結果" hint logic but repoint it at the bottom pane only; wire `tableQueryAreaHeight` / `setTableQueryAreaHeight` from the `settings` store.
- `src/renderer/i18n/en-US.json` — add `application.queryAreaPlaceholder`.
- `src/renderer/i18n/zh-TW.json` — add `application.queryAreaPlaceholder`.

Files NOT modified:

- `src/renderer/components/WorkspaceTabTableFilters.vue` stays on disk, unimported.
- `src/renderer/components/WorkspaceTabQueryTable.vue` body, props, headers unchanged.
- `src/renderer/scss/main.scss` not touched (per `feedback_tailwind_not_scss.md`).
- No Tauri-side changes; persistence reuses the existing `settings` file.

---

## Task 1: Commit the pending toolbar reorg

**Files:**
- Already-modified working-tree file: `src/renderer/components/WorkspaceTabTable.vue`

- [ ] **Step 1.1 — Verify only this file is dirty**

Run:
```bash
cd e:/source/antares2
git status --short
```
Expected output (exact):
```
 M src/renderer/components/WorkspaceTabTable.vue
```
If anything else is listed, stop and inspect — the plan assumes a clean slate apart from this one file.

- [ ] **Step 1.2 — Skim the diff to confirm it is the toolbar reorg only**

Run:
```bash
git diff src/renderer/components/WorkspaceTabTable.vue | head -80
```
Expected highlights:
- `!h-[39px] !py-[3px] !px-[10px] !text-[14px]` added to the `workspace-query-runner-footer` div.
- The `<DropdownMenu>` export block moves from `workspace-query-buttons` to `workspace-query-info`.
- The info container becomes `class="workspace-query-info !gap-0 divide-x divide-border [&>*]:px-[10px] [&>*:first-child]:pl-0 [&>*:last-child]:pr-0"`.
- No SCSS file in the diff.

If the diff does not match, stop — someone else has edited this file.

- [ ] **Step 1.3 — Commit**

```bash
git add src/renderer/components/WorkspaceTabTable.vue
git commit -m "feat(table-view): relocate export to info bar + compact 39px footer + unify 14px type

Three refinements, all applied as Tailwind utilities on the template rather
than SCSS edits (the file's SCSS block is untouched):

1. Export dropdown moves from the left action group into the right info bar,
   immediately after the pagination control so grouping reads as
   'actions on the left, status + navigation on the right'.

2. Footer row compacted from 45px to 39px via '!h-[39px] !py-[3px]' —
   wins over the legacy spectre '.workspace-tabs .workspace-query-runner
   .workspace-query-runner-footer' nested selector via Tailwind v4's !
   (important) modifier.

3. Toolbar text unified at 14px by '!text-[14px]' on every Button /
   TabsTrigger / raw button. Reka UI's TabsTrigger cn() injects 'text-sm'
   which tailwind-merge was not dropping, so the ! prefix is needed to
   force specificity.

Info-bar divisions between items rendered via
'divide-x divide-border [&>*]:px-[10px]' + first/last pl/pr-0 overrides."
```

Expected output: pre-commit lint passes; new commit hash shown.

---

## Task 2: Add `tableQueryAreaHeight` to the settings store

**Files:**
- Modify: `src/renderer/stores/settings.ts`

- [ ] **Step 2.1 — Add the state field**

Open `src/renderer/stores/settings.ts`. Find the `state: () => ({ ... })` block (around line 15). Directly after the existing `tableAutoRefreshInterval: 0 as number,` line, add:

```ts
         tableQueryAreaHeight: 300 as number,
```

The surrounding lines should then read:

```ts
         tableAutoRefreshInterval: 0 as number,
         tableQueryAreaHeight: 300 as number,
         _loaded: false
```

- [ ] **Step 2.2 — Wire up `init()`**

Find the `init()` action (around line 37). After the line that reads:

```ts
         if (settings.table_auto_refresh_interval !== undefined) this.tableAutoRefreshInterval = settings.table_auto_refresh_interval;
```

add on the next line:

```ts
         if (settings.table_query_area_height !== undefined) this.tableQueryAreaHeight = settings.table_query_area_height;
```

- [ ] **Step 2.3 — Wire up `persistSettings()`**

Find the `persistSettings()` action. Inside its `saveStore('settings', { ... })` object, after the line:

```ts
            table_auto_refresh_interval: this.tableAutoRefreshInterval
```

change that trailing `,` is present, then add on the next line:

```ts
            table_query_area_height: this.tableQueryAreaHeight
```

The block should become:

```ts
            table_auto_refresh_interval: this.tableAutoRefreshInterval,
            table_query_area_height: this.tableQueryAreaHeight
```

- [ ] **Step 2.4 — Add the setter action**

Still in `settings.ts`, find any existing setter action (e.g. `changePageSize`). Immediately after that action's closing `},` line, add:

```ts
      setTableQueryAreaHeight (height: number) {
         this.tableQueryAreaHeight = height;
         this.persistSettings();
      },
```

- [ ] **Step 2.5 — Type-check by running lint (catches structural typos)**

Run:
```bash
pnpm lint 2>&1 | tail -5
```
Expected: no errors. If ESLint complains about trailing comma style, `pnpm lint:fix` and re-run.

---

## Task 3: Add the placeholder i18n key

**Files:**
- Modify: `src/renderer/i18n/en-US.json`
- Modify: `src/renderer/i18n/zh-TW.json`

- [ ] **Step 3.1 — Add the English key**

Open `src/renderer/i18n/en-US.json`. Find the `"application": { ... }` block (line 1 area, anchor via `"showColumnNames"` added earlier this session). After the line:

```json
    "showColumnNames": "Show column names",
```

insert:

```json
    "queryAreaPlaceholder": "Query area — custom UI coming soon",
```

- [ ] **Step 3.2 — Add the Traditional-Chinese key**

Open `src/renderer/i18n/zh-TW.json`. Find the matching block. After:

```json
    "showColumnNames": "顯示欄位名稱",
```

insert:

```json
    "queryAreaPlaceholder": "查詢區 — 自訂查詢 UI 待實作",
```

- [ ] **Step 3.3 — Verify JSON parses**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('e:/source/antares2/src/renderer/i18n/en-US.json','utf8')); console.log('en OK')"
node -e "JSON.parse(require('fs').readFileSync('e:/source/antares2/src/renderer/i18n/zh-TW.json','utf8')); console.log('zh-TW OK')"
```
Expected: `en OK` then `zh-TW OK`. If either throws, a comma or bracket is wrong — fix it.

Other locales (`zh-CN`, `ja-JP`, `ko-KR`) intentionally do not get the key in this plan; vue-i18n falls back to `en-US` for missing keys. The user can catch them up later with `pnpm translation:check`.

---

## Task 4: Create `BaseSplitV.vue`

**Files:**
- Create: `src/renderer/components/BaseSplitV.vue`

- [ ] **Step 4.1 — Write the component**

Create `src/renderer/components/BaseSplitV.vue` with the full content:

```vue
<template>
   <div ref="containerRef" class="flex h-full flex-col">
      <div :style="{ height: `${resolvedTopHeight}px` }" class="min-h-0 overflow-hidden">
         <slot name="top" />
      </div>
      <div
         ref="handleRef"
         class="h-[6px] flex-shrink-0 cursor-row-resize bg-border transition-colors hover:bg-primary"
         :class="{ 'bg-primary': isDragging }"
         role="separator"
         aria-orientation="horizontal"
         :aria-valuenow="resolvedTopHeight"
         :aria-valuemin="minTop"
         :title="t('general.doubleClickToReset')"
         @pointerdown="onPointerDown"
         @dblclick="resetToDefault"
      />
      <div class="min-h-0 flex-1 overflow-hidden">
         <slot name="bottom" />
      </div>
   </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = withDefaults(defineProps<{
   topHeight: number;
   minTop?: number;
   minBottom?: number;
   defaultTopHeight?: number;
}>(), {
   minTop: 80,
   minBottom: 80,
   defaultTopHeight: 300
});

const emit = defineEmits<{
   'update:topHeight': [value: number];
   'resize-end': [value: number];
}>();

const { t } = useI18n();

const containerRef = ref<HTMLElement | null>(null);
const handleRef = ref<HTMLElement | null>(null);
const isDragging = ref(false);

// Clamp the rendered top height so it never exceeds container - minBottom - handle,
// even if persisted state is stale after a window-resize that shrunk the viewport.
const resolvedTopHeight = computed(() => Math.max(props.minTop, props.topHeight));

let startY = 0;
let startTop = 0;

function onPointerDown (e: PointerEvent): void {
   e.preventDefault();
   startY = e.clientY;
   startTop = resolvedTopHeight.value;
   isDragging.value = true;
   handleRef.value?.setPointerCapture(e.pointerId);
   window.addEventListener('pointermove', onPointerMove);
   window.addEventListener('pointerup', onPointerUp);
}

function onPointerMove (e: PointerEvent): void {
   const delta = e.clientY - startY;
   const container = containerRef.value;
   if (!container) return;
   const containerHeight = container.getBoundingClientRect().height;
   const handleHeight = 6;
   const maxTop = Math.max(props.minTop, containerHeight - handleHeight - props.minBottom);
   const next = Math.max(props.minTop, Math.min(maxTop, startTop + delta));
   emit('update:topHeight', next);
}

function onPointerUp (): void {
   window.removeEventListener('pointermove', onPointerMove);
   window.removeEventListener('pointerup', onPointerUp);
   isDragging.value = false;
   emit('resize-end', resolvedTopHeight.value);
}

function resetToDefault (): void {
   emit('update:topHeight', props.defaultTopHeight);
   emit('resize-end', props.defaultTopHeight);
}
</script>
```

- [ ] **Step 4.2 — Add the i18n key used by the handle tooltip**

The template binds `t('general.doubleClickToReset')`. Add it to both locales.

Open `src/renderer/i18n/en-US.json`. Find the `"general"` block. Add:

```json
    "doubleClickToReset": "Double-click to reset",
```

Open `src/renderer/i18n/zh-TW.json`. Find the `"general"` block. Add:

```json
    "doubleClickToReset": "雙擊重設",
```

Verify both parse with the node JSON.parse commands from Step 3.3.

- [ ] **Step 4.3 — Lint**

Run:
```bash
pnpm lint 2>&1 | tail -8
```
Expected: no errors in `BaseSplitV.vue`.

---

## Task 5: Create `WorkspaceTabTableQueryArea.vue` placeholder

**Files:**
- Create: `src/renderer/components/WorkspaceTabTableQueryArea.vue`

- [ ] **Step 5.1 — Write the component**

Create `src/renderer/components/WorkspaceTabTableQueryArea.vue`:

```vue
<template>
   <div class="flex h-full items-center justify-center border-b border-border bg-muted/30 text-[13px] text-muted-foreground">
      {{ t('application.queryAreaPlaceholder') }}
   </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>
```

Design notes for the next session that replaces this:
- Outer `<div class="flex h-full ...">` is the contract — the query UI fills the full splitter top pane.
- `border-b border-border` reinforces the split visually even if the splitter handle is mid-drag (optional — remove if it looks heavy).
- The real query UI should emit or call into the parent's `results` state via events/store, not bypass `WorkspaceTabTable.vue`'s existing query pipeline.

- [ ] **Step 5.2 — Lint**

Run:
```bash
pnpm lint 2>&1 | tail -5
```
Expected: clean.

---

## Task 6: Wire the splitter into `WorkspaceTabTable.vue`

**Files:**
- Modify: `src/renderer/components/WorkspaceTabTable.vue`

- [ ] **Step 6.1 — Read the current state of the file**

Before editing, open and visually verify the three landmarks you will edit:

1. The `<WorkspaceTabTableFilters v-if="isSearch" ... />` block (approximately lines 168–175 after Task 1).
2. The `workspace-query-results` div that contains `<WorkspaceTabQueryTable>` and the floating empty hint (approximately lines 176–197 after Task 1).
3. The `<script setup>` area where `isSearch`, `settingsStore`, `results`, and the `storeToRefs` destructuring live (approximately lines 250–260 after Task 1).

If any landmark is not where expected, stop and re-locate them by `grep -n` — do not guess.

- [ ] **Step 6.2 — Remove the old filter Button from the left action group**

Find the `<!-- Filter toggle -->` block inside the `<div v-show="viewMode === 'data'" class="d-flex align-items-center gap-1">` container (around line 38–50). Delete the entire `<Button>` block for the filter:

```vue
                  <!-- Filter toggle -->
                  <Button
                     :variant="isSearch ? 'default' : 'outline'"
                     class="h-[32px] px-[10px] !text-[14px]"
                     :title="t('general.filter')"
                     :disabled="isQuering"
                     @click="isSearch = !isSearch"
                  >
                     <BaseIcon icon-name="mdiMagnify" :size="16" />
                  </Button>

```

becomes just a blank line (or the block above merges with the Insert button cleanly). Leave `<!-- Insert row -->` and everything after it unchanged.

- [ ] **Step 6.3 — Remove the pop-open filter form**

Find and delete the block:

```vue
      <WorkspaceTabTableFilters
         v-if="isSearch"
         :fields="fields"
         :is-quering="isQuering"
         :conn-client="connection.client"
         @filter="updateFilters"
         @filter-change="onFilterChange"
      />
```

- [ ] **Step 6.4 — Replace the data-view block with the splitter**

Locate the current data-view block:

```vue
      <div v-show="viewMode === 'data'" class="workspace-query-results p-relative column col-12">
         <BaseLoader v-if="isQuering" />
         <WorkspaceTabQueryTable
            v-if="results"
            ref="queryTable"
            :results="results"
            :is-quering="isQuering"
            :page="page"
            :tab-uid="tabUid"
            :conn-uid="connection.uid"
            :is-selected="isSelected"
            mode="table"
            :element-type="elementType"
            :use-comment-header="useCommentHeader"
            @update-field="updateField"
            @delete-selected="deleteSelected"
            @duplicate-row="showFakerModal"
            @hard-sort="hardSort"
         />
         <div
            v-if="!isQuering && !results[0]?.rows.length"
            class="pointer-events-none absolute inset-x-0 top-[60px] flex justify-center text-[12px] text-muted-foreground"
         >
            {{ t('database.noResultsPresent') }}
         </div>
      </div>
```

Replace it with:

```vue
      <div v-show="viewMode === 'data'" class="workspace-query-results column col-12 relative">
         <BaseLoader v-if="isQuering" />
         <BaseSplitV
            :top-height="tableQueryAreaHeight"
            :default-top-height="300"
            class="h-full"
            @update:top-height="tableQueryAreaHeight = $event"
            @resize-end="setTableQueryAreaHeight($event)"
         >
            <template #top>
               <WorkspaceTabTableQueryArea />
            </template>
            <template #bottom>
               <div class="relative h-full">
                  <WorkspaceTabQueryTable
                     v-if="results"
                     ref="queryTable"
                     :results="results"
                     :is-quering="isQuering"
                     :page="page"
                     :tab-uid="tabUid"
                     :conn-uid="connection.uid"
                     :is-selected="isSelected"
                     mode="table"
                     :element-type="elementType"
                     :use-comment-header="useCommentHeader"
                     @update-field="updateField"
                     @delete-selected="deleteSelected"
                     @duplicate-row="showFakerModal"
                     @hard-sort="hardSort"
                  />
                  <div
                     v-if="!isQuering && !results[0]?.rows.length"
                     class="pointer-events-none absolute inset-x-0 top-[12px] flex justify-center text-[12px] text-muted-foreground"
                  >
                     {{ t('database.noResultsPresent') }}
                  </div>
               </div>
            </template>
         </BaseSplitV>
      </div>
```

Note: the floating "沒有結果" hint's `top-[60px]` is reduced to `top-[12px]` because the hint now lives **inside** the bottom splitter pane instead of sitting under the whole toolbar. `inset-x-0 flex justify-center` still centers horizontally.

- [ ] **Step 6.5 — Add the imports and the reactive wiring in `<script setup>`**

Locate the `<script setup>` block. Find the imports area at the top (it already imports `BaseLoader`, `BaseIcon`, etc.) and add:

```ts
import BaseSplitV from '@/components/BaseSplitV.vue';
import WorkspaceTabTableQueryArea from '@/components/WorkspaceTabTableQueryArea.vue';
```

These should be added alphabetically among the existing `@/components/*` imports.

Next, find the `storeToRefs(settingsStore)` destructuring:

```ts
const { dataTabLimit: limit, tableAutoRefreshInterval } = storeToRefs(settingsStore);
```

Change it to:

```ts
const { dataTabLimit: limit, tableAutoRefreshInterval, tableQueryAreaHeight } = storeToRefs(settingsStore);
```

Then find the existing `const { changeBreadcrumbs, getWorkspace, newTab } = workspacesStore;` line and add **after** it a new destructure from `settingsStore` for the setter:

```ts
const { setTableQueryAreaHeight } = settingsStore;
```

- [ ] **Step 6.6 — Remove the now-unused `isSearch` state if and only if nothing else references it**

Run:
```bash
grep -n "isSearch" src/renderer/components/WorkspaceTabTable.vue
```

Expected after Steps 6.2 and 6.3: zero matches. If there are still matches, read the lines — the shortcut dispatcher (search F3-equivalent) may use it. If you find a caller that still needs `isSearch` (e.g. a keyboard shortcut that opens filters), leave `isSearch = ref(false)` in place and do not delete. Otherwise, remove the single line:

```ts
const isSearch = ref(false);
```

- [ ] **Step 6.7 — Lint**

Run:
```bash
pnpm lint 2>&1 | tail -10
```
Expected: no errors. The most likely warning is `simple-import-sort/imports` on the new `@/components/*` imports — `pnpm lint:fix` handles it.

---

## Task 7: Smoke test in the Tauri dev window

**Files:** none; manual verification only.

- [ ] **Step 7.1 — Start dev (do NOT kill any process on port 5555; it is the sidecar)**

Run:
```bash
cd e:/source/antares2
pnpm tauri:dev
```

Wait for the Tauri window to open. If a previous `tauri dev` is already running on port 5173, close the old window (Vite will exit with it) then re-run — per `feedback_dont_kill_sidecar_port.md` we never force-kill 5555.

- [ ] **Step 7.2 — Open a table tab and verify the layout**

In the Tauri window:
1. Connect to any database and open any table.
2. Verify top-to-bottom: toolbar (39 px) → query area (300 px, muted background, centered hint) → 6-px grey handle → result rows.
3. The floating "沒有結果" hint must only appear inside the **bottom** pane when rows are empty, and must not cover the query area above.
4. There must be **no** filter form popping out anywhere and **no** 🔍 filter button in the toolbar.

If any of those is wrong, stop and diagnose.

- [ ] **Step 7.3 — Drag the handle**

Hover the 6-px bar → cursor changes to `row-resize` and bar turns orange (brand primary).
Press and drag down → query area grows, result shrinks.
Release → bar returns to grey.

Hit the bottom limit: drag further down. The handle must stop before the result pane shrinks below 80 px.
Hit the top limit: drag up. The handle must stop when the query area shrinks below 80 px.

- [ ] **Step 7.4 — Verify double-click resets to 300**

Drag the handle to some non-default position. Verify the query area is clearly not 300 px.
Double-click the handle. Query area snaps back to 300 px.

- [ ] **Step 7.5 — Verify persistence across app restart**

1. Drag the handle to a clearly-not-300 height (e.g. ~200 or ~450).
2. Close the Tauri window fully.
3. Run `pnpm tauri:dev` again and open the same table tab.
4. The query area must open at the height you set in step 1, not 300. This confirms `setTableQueryAreaHeight` wrote to the settings file and `init()` read it back.

If the height reset to 300, inspect `%APPDATA%\com.tw199501.antares2\settings.*` on Windows for the `table_query_area_height` field — if absent, `persistSettings` did not write; if present but the wrong value, `init()` is not applying it.

- [ ] **Step 7.6 — Verify other workspace tabs share the same height**

Open a second table in a different tab. The query area must open at the **same** height as tab 1 (not a per-tab value). This confirms the scope is app-level.

- [ ] **Step 7.7 — Stop dev**

Close the Tauri window (do not Ctrl+C the terminal — the graceful close cleans up child processes).

---

## Task 8: Commit the splitter work

**Files:** all files modified / created by Tasks 2–6.

- [ ] **Step 8.1 — Review staged content**

Run:
```bash
git status --short
```

Expected files listed:
- `M src/renderer/components/WorkspaceTabTable.vue`
- `M src/renderer/stores/settings.ts`
- `M src/renderer/i18n/en-US.json`
- `M src/renderer/i18n/zh-TW.json`
- `?? src/renderer/components/BaseSplitV.vue`
- `?? src/renderer/components/WorkspaceTabTableQueryArea.vue`

Nothing else.

- [ ] **Step 8.2 — Commit**

```bash
git add src/renderer/components/WorkspaceTabTable.vue \
        src/renderer/stores/settings.ts \
        src/renderer/i18n/en-US.json \
        src/renderer/i18n/zh-TW.json \
        src/renderer/components/BaseSplitV.vue \
        src/renderer/components/WorkspaceTabTableQueryArea.vue
git commit -m "feat(table-view): add draggable vertical splitter reserving 300px query area above results

The old pop-open WorkspaceTabTableFilters form is removed from the data
view. In its place the result area is now a two-pane vertical splitter:

- Top pane: a 300px-default empty placeholder (WorkspaceTabTableQueryArea)
  where a future session will plug a custom query UI.
- 6px draggable grey bar in the middle — hover turns brand primary,
  double-click resets to 300px, drag persists via settings.
- Bottom pane: the existing WorkspaceTabQueryTable, untouched. The
  'no results' hint was repositioned so it only floats inside the
  bottom pane instead of covering the query area.

New BaseSplitV.vue is a generic vertical splitter (hand-rolled pointer
events, v-model:topHeight, @resize-end, Tailwind only). Persistence
uses the existing settings store via a new tableQueryAreaHeight field
that serializes to snake_case 'table_query_area_height' matching the
established pattern. Scope is app-level — all table tabs share the
same height, matching the net-admin reference behavior.

Pattern reference: e:/source/platfrom-admin/Web/src/views/system/database/sqlQuery.vue
(Element Plus el-splitter; we hand-roll to avoid adding Element Plus)."
```

- [ ] **Step 8.3 — Verify pre-commit hook passes**

Pre-commit will run lint. If it fails, `pnpm lint:fix` and re-commit. Do **not** use `--no-verify`.

---

## Self-Review Checklist (already run before delivering this plan)

- ✅ **Spec coverage:**
  - "預留 300px 放查詢區" → Task 5 (placeholder) + Task 6 (splitter wiring) + default value in Task 4 splitter prop.
  - "裡面的欄位都不要了" → Task 6.2 / 6.3 remove the Filter button and the `WorkspaceTabTableFilters` v-if block entirely; no fields carry over.
  - "中間上下拖拉" → Task 4 (the 6-px draggable handle with pointer events).
  - "關閉畫面再開啟預設 300px，拖拉過已設為主" → Task 2 (settings field) + Task 4 (`resize-end` event) + Task 6.5 (wiring `setTableQueryAreaHeight`) + Task 7.5 (verifies across restart).
  - Net-admin parity (6-px handle, hover primary, 80-px mins) → Task 4 implementation.
- ✅ **Placeholder scan:** Every task step contains literal code or literal commands; no "TBD" / "similar to" / "implement error handling" anywhere.
- ✅ **Type consistency:** `tableQueryAreaHeight` and `setTableQueryAreaHeight` use the same names in the store (Task 2), in `storeToRefs` destructure (Task 6.5), in template bindings (Task 6.4), and in the commit message. `BaseSplitV` props `topHeight` / `minTop` / `minBottom` / `defaultTopHeight` match the template and the call site in Task 6.4. The `@resize-end` event name is consistent between Task 4 definition and Task 6.4 handler.
- ✅ **Tailwind-only styling:** No `.scss` files modified. Per `feedback_tailwind_not_scss.md`.
- ✅ **Smoke-test-first for SFC:** Per `feedback_vue_sfc_needs_runtime_smoke.md` — Task 7 runs `pnpm tauri:dev` and verifies seven interactive scenarios before committing.
- ✅ **Sidecar port left alone:** Per `feedback_dont_kill_sidecar_port.md` — Step 7.1 explicitly forbids killing port 5555.
