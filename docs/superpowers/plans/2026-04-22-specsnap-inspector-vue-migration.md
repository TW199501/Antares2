# SpecSnap Inspector — Migrate from `-core` (hand-rolled UI) to `-inspector-vue` (drop-in wrapper)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace antares2's hand-rolled `TheSpecSnapInspector.vue` (510 LOC, on top of `@tw199501/specsnap-core ^0.0.2`) with a thin shell that mounts `<SpecSnapInspector>` from the published Vue wrapper `@tw199501/specsnap-inspector-vue ^0.0.9`, gaining: on-page overlay + numbered badges + gap labels + box-model panel + Copy MD feedback + StrictMode-safe lifecycle, while preserving the **trigger UX** (sidebar button click → inspector opens).

**Architecture:** The published wrapper already implements every UI feature antares2's hand-rolled SFC implements (overlay, panel, picker, copy, drag — though drag is now positional `data-position` instead of free-drag, an accepted trade-off). The shell is a 30-line SFC that:
- Renders `<SpecSnapInspector :trigger="false" ref="inspector" @close="hideSpecsnap" />`
- Calls `inspector.value?.open()` in `onMounted` so the panel appears immediately when the sidebar button mounts the shell via `v-if="isSpecsnap"`
- Imports the wrapper's CSS as a side-effect from inside `<script setup>` so the bundle loads on demand only when the inspector is opened (matches the existing `defineAsyncComponent` lazy-load).

The store API (`isSpecsnap`, `showSpecsnap`, `hideSpecsnap`) and the trigger location (`TheSettingBar.vue:68`) **do not change** — only the implementation behind the curtain does. App.vue's `<TheSpecSnapInspector v-if="isSpecsnap" />` line stays byte-for-byte identical.

**Tech Stack:** Vue 3.5 (`<script setup>`), Pinia, `@tw199501/specsnap-inspector-vue ^0.0.9` (which transitively depends on `@tw199501/specsnap-inspector-core ^0.0.9`), pnpm, Tauri v2 renderer.

---

## Background & Context

### Why this plan exists

- antares2 currently consumes `@tw199501/specsnap-core ^0.0.2` and hand-rolls **all** UI in a 510-line SFC (`src/renderer/components/TheSpecSnapInspector.vue`).
- The `^0.0.2` constraint in semver pre-1.0 means `>=0.0.2 <0.0.3` — `pnpm install` will never auto-upgrade. antares2 is **7 versions behind**.
- specsnap published v0.0.7 (`-inspector-{core,vue,react}` debut) and v0.0.8 (overlay + box-model + Copy feedback + StrictMode-safe) explicitly so consumers like antares2 can drop-in instead of hand-rolling.
- The v0.0.8 retrospective at `e:\source\specsnap\docs\superpower\plan\2026-04-21-retrospective-v008.md:53` lists this exact migration as a v0.0.9+ follow-up:
  > "antares2 migration to consume `@tw199501/specsnap-inspector-vue`"

### What this plan deliberately does NOT do

- Add wrapper-level i18n. The wrapper's `Panel.vue` hardcodes English (`"Clear"`, `"Start Inspect"`, `"Close"`, etc.) and has no `labels` prop. Adding one is an upstream change in the specsnap repo, not antares2. Captured as **Follow-up A** below.
- Remove the legacy `application.specsnap.*` i18n keys. The trigger tooltip in `TheSettingBar.vue` still uses `t('application.specsnap.inspector')`. Panel-only keys (`done`, `selectedCount`, `inspecting`, `hint`, `markdown`, `json`, `copy`, `copied`, `clear`, `startInspect`) become **dormant** but stay in the JSON files until upstream wrapper accepts a `labels` prop, then they get rewired.
- Add Vue test-utils unit tests for the shell. antares2 has no SFC unit-test infrastructure (only Playwright e2e at `tests/app.spec.ts`); adding it for a 30-line wrapper is overkill. Per memory `feedback_vue_sfc_needs_runtime_smoke.md` we **must** smoke-test in `pnpm tauri:dev` before each commit.
- Touch the application store, the App.vue mounting line, the sidebar trigger, or any i18n JSON file (in this plan).
- Refactor the wrapper itself, the Panel.vue, the BoxModelDiagram.vue. Anything we don't like in the wrapper UI is logged as **Follow-up B** below for upstream.

### Decisions locked in before planning

| Decision | Choice | Why |
| --- | --- | --- |
| Replace `-core` direct dep | **Yes — remove entirely** | The wrapper transitively brings in `-inspector-core` which itself imports `-core`. Direct dep on `-core` becomes redundant after the shell stops calling `captureSession / toMarkdown / toJSON` directly. |
| Keep `defineAsyncComponent` lazy-load | **Yes** | Cold-start cost is real for an Electron-replaced Tauri app; the inspector is opt-in. CSS side-effect import inside `<script setup>` follows the chunk so the panel's stylesheet only downloads when the user opens it. |
| Trigger UX | **Sidebar click → mount shell → auto-open panel** | Preserves existing UX. Wrapper's built-in floating trigger (`:trigger="true"` default) would duplicate the sidebar button — disable it. |
| Panel close behavior | **Sync to store via `@close`** | Wrapper emits `close` when user clicks the panel's `×`. Hook it to `hideSpecsnap()` so `isSpecsnap` flips to `false`, unmounting the shell, releasing the `ShallowRef` + listeners via the wrapper's own `onBeforeUnmount`. |
| i18n regression | **Accepted for now** | Inspector is a developer tool; English Panel labels are the current upstream reality. Filed as Follow-up A. |
| Drag UX loss | **Accepted** | Wrapper uses fixed `data-position="bottom-right"` corner positioning, not free-drag. Hand-rolled SFC supported full drag via `useDraggable`. Loss is non-blocking — corner snapping is the common pattern. Filed as Follow-up B. |
| Lockfile policy | **Commit lockfile change** | Standard pnpm convention. |

### File map

Files **modified**:

- `e:\source\antares2\package.json` — remove `@tw199501/specsnap-core` line; add `@tw199501/specsnap-inspector-vue ^0.0.9`.
- `e:\source\antares2\src\renderer\components\TheSpecSnapInspector.vue` — full rewrite: 510 LOC → ~35 LOC shell.
- `e:\source\antares2\pnpm-lock.yaml` — regenerated by `pnpm install`.

Files **explicitly NOT modified**:

- `src/renderer/App.vue` — `<TheSpecSnapInspector v-if="isSpecsnap" />` line unchanged.
- `src/renderer/components/TheSettingBar.vue` — trigger button + tooltip unchanged.
- `src/renderer/stores/application.ts` — `isSpecsnap / showSpecsnap / hideSpecsnap` unchanged.
- `src/renderer/i18n/*.json` — keys preserved (dormant ones await upstream `labels` prop).

### Follow-ups (NOT part of this plan, log them after)

- **Follow-up A — upstream i18n in `@tw199501/specsnap-inspector-vue`:** Add a `labels?: Partial<{ inspect, done, clear, copy, copying, copied, error, close, hint, empty, panelTitle, ... }>` prop to `<SpecSnapInspector>`, threaded down to `Panel.vue` and `TriggerButton.vue`. When shipped, antares2 swaps in a `computed labels` object built from `t('application.specsnap.*')` and the dormant keys reactivate.
- **Follow-up B — upstream free-drag:** Wrapper's `data-position` is corner-only. Add `position="custom"` mode + `:offset="{ x, y }"` prop or a `draggable` prop. Lower priority than A.
- **Follow-up C — update memory:** `project_specsnap_screenshot_gap.md` says "0.0.3+ screenshot candidate" — status check whether v0.0.8's overlay + `to-annotated-png.ts` closes that gap; rewrite the memory.

---

## Task 1: Swap dependency

**Files:**
- Modify: `e:\source\antares2\package.json` (the `dependencies` object near line 50)
- Regenerated: `e:\source\antares2\pnpm-lock.yaml`

- [ ] **Step 1.1 — Remove the old direct dep and add the wrapper**

Open `e:\source\antares2\package.json`. Find the line:
```json
    "@tw199501/specsnap-core": "^0.0.2",
```
Replace it with:
```json
    "@tw199501/specsnap-inspector-vue": "^0.0.9",
```
Keep alphabetical ordering inside `dependencies` (the `@tw…` block sorts together; this is a one-for-one swap so no other reordering needed). The wrapper's `peerDependencies.vue` is `>=3.3` — antares2 ships Vue 3.5, so peer is satisfied automatically.

- [ ] **Step 1.2 — Install + verify lockfile resolves the wrapper and its transitive `-inspector-core` + `-core`**

Run:
```bash
cd e:/source/antares2
pnpm install
```
Expected end-of-output:
- `+ @tw199501/specsnap-inspector-vue 0.0.9` (or higher within `^0.0.9`).
- `- @tw199501/specsnap-core` removed.
- No new high/critical audit warnings (the wrapper only adds `dom-to-image-more` transitively, already audited via `-core` previously).

If pnpm prints "ERR_PNPM_PEER_DEP_ISSUES" referencing Vue, **stop** — antares2's Vue version may not satisfy `>=3.3`. Verify with `pnpm why vue` and report; do not force-install.

- [ ] **Step 1.3 — Sanity check the lockfile records the wrapper + transitive deps**

Run:
```bash
grep -E "specsnap-(core|inspector-core|inspector-vue)" e:/source/antares2/pnpm-lock.yaml | head -20
```
Expected: at least three entries (`-core@0.0.9`, `-inspector-core@0.0.9`, `-inspector-vue@0.0.9`). If you see `-core@0.0.2` still resolved as a top-level dep, Step 1.1 was not saved — re-open and re-edit `package.json`.

- [ ] **Step 1.4 — Commit**

```bash
cd e:/source/antares2
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): swap specsnap-core for specsnap-inspector-vue ^0.0.9

The hand-rolled inspector UI is being replaced with the published Vue wrapper
(see follow-up commit). Wrapper transitively pulls in -inspector-core + -core,
so the direct -core dep becomes redundant."
```

---

## Task 2: Rewrite `TheSpecSnapInspector.vue` as a thin shell

**Files:**
- Modify (full rewrite): `e:\source\antares2\src\renderer\components\TheSpecSnapInspector.vue`

- [ ] **Step 2.1 — Replace the file's full contents**

Overwrite `e:\source\antares2\src\renderer\components\TheSpecSnapInspector.vue` with:

```vue
<template>
   <SpecSnapInspector
      ref="inspectorRef"
      :trigger="false"
      :panel-title="t('application.specsnap.inspector')"
      @close="onPanelClose"
   />
</template>

<script setup lang="ts">
import { SpecSnapInspector } from '@tw199501/specsnap-inspector-vue';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { useApplicationStore } from '@/stores/application';

import '@tw199501/specsnap-inspector-vue/styles.css';

const { t } = useI18n();
const { hideSpecsnap } = useApplicationStore();

// Wrapper exposes open/close/toggle/startPicker/stopPicker/clearFrames/getSnapshot.
// We only need open() — App.vue's `v-if="isSpecsnap"` gates mount, and onMounted
// fires every time the user re-opens via the sidebar button.
const inspectorRef = ref<InstanceType<typeof SpecSnapInspector> | null>(null);

onMounted(() => {
   inspectorRef.value?.open();
});

function onPanelClose (): void {
   // Wrapper has already closed its panel; sync the store so App.vue unmounts
   // the shell. On next showSpecsnap() the shell remounts and onMounted() above
   // re-opens the panel. The wrapper's own onBeforeUnmount tears down listeners
   // and the inspector-core store on unmount.
   hideSpecsnap();
}
</script>
```

**Important** — note what is intentionally absent vs. the old SFC:
- No `<Teleport>` — wrapper does its own `<Teleport to="body">` for the panel.
- No SVG overlay code (rendered by `inspector-core/src/overlay.ts`).
- No `useDraggable` (wrapper uses corner positioning per Follow-up B).
- No `<style>` block — the `import '@tw199501/specsnap-inspector-vue/styles.css'` line is the **only** styling source. The wrapper's CSS namespaces all classes under `.specsnap-inspector-*`, so it cannot bleed into the rest of the app.

- [ ] **Step 2.2 — Type-check the renderer to confirm imports resolve**

Run:
```bash
cd e:/source/antares2
pnpm vue-tsc --noEmit
```
Expected: zero errors related to `@tw199501/specsnap-inspector-vue`. If you see `Cannot find module '@tw199501/specsnap-inspector-vue'`, Task 1's `pnpm install` did not complete — rerun Step 1.2.

If you see `Cannot find module '@tw199501/specsnap-inspector-vue/styles.css'` specifically, verify the file actually exists:
```bash
ls e:/source/antares2/node_modules/@tw199501/specsnap-inspector-vue/dist/
```
Expected to include `styles.css`. Vue-tsc handles CSS module declarations via Vite's `vite/client` types — if it errors, check that `tsconfig.json` includes `"types": [..., "vite/client"]` (it should already, since the rest of antares2 imports CSS this way).

- [ ] **Step 2.3 — Lint pass**

Run:
```bash
cd e:/source/antares2
pnpm lint
```
Expected: no new ESLint or Stylelint errors in `TheSpecSnapInspector.vue`. The file should be ~30 lines including blank lines. If lint complains about `useI18n` being unused, it means you removed the `panel-title` binding — restore it.

- [ ] **Step 2.4 — Smoke test in dev (mandatory per `feedback_vue_sfc_needs_runtime_smoke.md`)**

Important pre-condition: do **not** kill anything on port 5555 (per `feedback_dont_kill_sidecar_port.md` — that's the Tauri-owned sidecar; killing it invalidates the renderer's session token).

Run in a dedicated shell:
```bash
cd e:/source/antares2
pnpm tauri:dev
```

Wait for the Tauri window to open with the renderer loaded. Then verify each of the following manually (this is the actual acceptance criteria — do not skip):

1. **Sidebar trigger** — click the crosshair icon at the bottom of the left sidebar (the one whose tooltip says "SpecSnap Inspector"). Expected: a panel appears anchored bottom-right of the window with header "SpecSnap Inspector", an inspect button, "Clear", "Copy MD" buttons, and an empty-state hint.
2. **Pick element** — click "Start Inspect" → click any visible element in the antares2 main area (e.g. a connection card or a sidebar item). Expected: the element gets a blue outline + a numbered badge "①" overlaid on the page, AND a corresponding frame appears in the panel showing tag.class, size/padding/margin.
3. **Pick second element** — click another element. Expected: badge "②" appears; if the two are siblings with whitespace between, an orange dashed gap line with `Npx` label appears between them.
4. **Stop picking** — press Escape OR click the inspect button again. Expected: outlines stay; cursor returns to default; inspect button label returns to "Start Inspect".
5. **Copy MD** — click "Copy MD". Expected: button briefly shows "Copying…" then green "Copied ✓" for ~1.8s, then back to "Copy MD". Paste into any text editor — should be valid SpecSnap Markdown.
6. **Clear** — click "Clear". Expected: panel frame list empties; on-page overlays disappear.
7. **Close** — click the `×` in the panel header. Expected: the panel disappears AND clicking the sidebar trigger again re-opens it (this verifies `hideSpecsnap()` → `showSpecsnap()` → re-mount → `onMounted()` → `open()` round-trips correctly).

If any of 1–7 fails, **do not commit**. Capture the failure mode (screenshot + console log) and diagnose before proceeding. The most likely failure is step 1 (panel doesn't appear) — that means `inspectorRef.value?.open()` ran before the wrapper exposed the imperative handle. Workaround: wrap in `nextTick`:
```ts
import { nextTick, onMounted, ref } from 'vue';
onMounted(async () => {
   await nextTick();
   inspectorRef.value?.open();
});
```

- [ ] **Step 2.5 — Verify the legacy `^0.0.2` import path is gone**

Run:
```bash
grep -rn "@tw199501/specsnap-core" e:/source/antares2/src 2>/dev/null
```
Expected: zero matches. If anything remains, hunt it down — leftover imports will fail at build time.

Also verify the new bundle entry:
```bash
grep -rn "@tw199501/specsnap-inspector-vue" e:/source/antares2/src 2>/dev/null
```
Expected: exactly two matches inside `TheSpecSnapInspector.vue` (the `import { SpecSnapInspector }` line and the `import '....styles.css'` line).

- [ ] **Step 2.6 — Commit**

```bash
cd e:/source/antares2
git add src/renderer/components/TheSpecSnapInspector.vue
git commit -m "refactor(specsnap): replace hand-rolled inspector with @tw199501/specsnap-inspector-vue

510-line SFC reduced to a 30-line shell that mounts <SpecSnapInspector>
from the published wrapper and bridges its @close event to the existing
applicationStore.hideSpecsnap action. Sidebar trigger, store API, and
i18n trigger-tooltip key all unchanged.

Gains delivered by the wrapper (vs. v0.0.2 hand-roll):
- On-page overlay with numbered badges and gap labels.
- Per-frame box-model SVG diagram in the panel.
- Copy MD button with copying/copied/error feedback.
- StrictMode-safe lifecycle (not relevant for Vue but bundled in).

Known regressions (filed upstream as follow-ups):
- Panel labels are English-only — wrapper does not yet accept a labels prop.
- Free-drag is replaced by data-position corner snap (default bottom-right)."
```

---

## Task 3: Update CLAUDE.md and memory

**Files:**
- Modify: `e:\source\antares2\CLAUDE.md` (add a one-paragraph note about the SpecSnap dep)
- Update: `C:\Users\EDDIE\.claude\projects\E--source-antares2\memory\project_specsnap_screenshot_gap.md`

- [ ] **Step 3.1 — Add a note to CLAUDE.md**

Open `e:\source\antares2\CLAUDE.md`. After the "shadcn-vue + spectre coexistence" subsection (find the heading `### UI stack: shadcn-vue + spectre coexistence`), insert a new sibling subsection at the same `###` level:

```markdown
### Embedded SpecSnap Inspector

The SpecSnap Inspector (sidebar crosshair icon) is the **`@tw199501/specsnap-inspector-vue` published wrapper**, mounted by `src/renderer/components/TheSpecSnapInspector.vue` as a thin shell. The shell is gated by `applicationStore.isSpecsnap` via `App.vue`'s `v-if`, calls `inspectorRef.value?.open()` on mount, and bridges the panel's `@close` event back to `hideSpecsnap()`. **Do not** import from `@tw199501/specsnap-core` directly — the wrapper transitively re-exports the relevant types via `@tw199501/specsnap-inspector-core`. Panel labels are currently English-only (wrapper has no `labels` prop yet); upstream issue tracked as a follow-up. The dormant i18n keys under `application.specsnap.{done,clear,copy,copied,…}` remain in the locale files for when the wrapper accepts a `labels` prop.
```

- [ ] **Step 3.2 — Refresh the screenshot-gap memory**

The existing memory at `C:\Users\EDDIE\.claude\projects\E--source-antares2\memory\project_specsnap_screenshot_gap.md` says "0.0.3+ screenshot candidate" and is now stale (specsnap shipped overlay rendering in 0.0.7 / box-model + Copy feedback in 0.0.8, and `to-annotated-png.ts` exists in `-core@0.0.9`). Rewrite it to reflect current state:

Open the file and replace the body (everything below the frontmatter `---`) with:

```markdown
**Status (2026-04-22):** specsnap-core ships `to-annotated-png.ts` and the inspector-core package ships an on-page overlay renderer (`overlay.ts`); both arrived between v0.0.7 and v0.0.9. antares2 consumes both transitively through `@tw199501/specsnap-inspector-vue ^0.0.9` (migrated 2026-04-22 — see `docs/superpowers/plans/2026-04-22-specsnap-inspector-vue-migration.md`).

**Remaining gap for AI consumers:** `toAnnotatedPNG()` returns a `Promise<Blob[]>` per frame, but **the inspector-vue panel does not yet expose a "Save annotated PNG" button** — only Copy MD invokes saveBundle which writes a multi-frame PNG bundle to disk via the storage ladder. If you want a single annotated PNG to embed in chat, you currently have to either (a) call the bundle storage-ladder output directly or (b) get specsnap to add a "Copy PNG" button alongside Copy MD.

**How to apply:**
- When user asks "can I get a screenshot of the inspected element?", answer: yes via Save Bundle to ZIP — but no one-click "copy PNG to clipboard" yet.
- If user wants AI to receive the visual: paste the bundle ZIP path or upload the per-frame PNG manually until upstream adds the button.
- Filed in plan as Follow-up D for `inspector-vue` v0.0.10.
```

Also update the frontmatter `description` to:
```
description: After 2026-04-22 antares2 migration to inspector-vue ^0.0.9, the rendering layer is shipped — but Panel still has no one-click PNG export button. saveBundle writes to ZIP via storage ladder.
```

And update the `name`:
```
name: SpecSnap PNG capture status — overlay shipped, single-click Copy PNG button still missing
```

- [ ] **Step 3.3 — Verify memory index pointer is still accurate**

Open `C:\Users\EDDIE\.claude\projects\E--source-antares2\memory\MEMORY.md`. Find the line:
```
- [SpecSnap screenshot gap](project_specsnap_screenshot_gap.md) — 0.0.1/0.0.2 ship without annotated PNG export; user flagged this as remembered priority for 0.0.3+
```
Replace the hook (text after the em-dash) with the post-migration reality:
```
- [SpecSnap PNG capture status](project_specsnap_screenshot_gap.md) — overlay rendering shipped via inspector-vue 0.0.9; one-click "Copy PNG" button still missing
```

- [ ] **Step 3.4 — Commit**

```bash
cd e:/source/antares2
git add CLAUDE.md
git commit -m "docs: note SpecSnap inspector now uses published Vue wrapper

Add a CLAUDE.md subsection documenting the shell-around-wrapper pattern,
the dormant i18n keys, and the upstream follow-up for a labels prop."
```

The memory file lives outside the repo (`C:\Users\EDDIE\.claude\projects\E--source-antares2\memory\`) so steps 3.2 and 3.3 are not part of this commit — they're host-machine state edits, which take effect immediately.

---

## Self-Review Checklist (already run before delivering this plan)

- ✅ **Spec coverage:** Three identified concerns are covered:
  - Replace `-core` direct dep with `-inspector-vue` (Task 1).
  - Replace hand-rolled SFC with thin wrapper shell (Task 2).
  - Document the change for future Claude sessions and reflect in the screenshot-gap memory (Task 3).
- ✅ **Placeholder scan:** No "TBD" / "implement later" / "add error handling" / "similar to Task N" — every step has the literal code or command.
- ✅ **Type consistency:** The shell uses `inspectorRef` consistently (not `inspector` in one place and `inspectorRef` in another); the imperative `open()` matches `defineExpose({ open: () => handle.open(), … })` in the wrapper at `e:\source\specsnap\packages\inspector-vue\src\SpecSnapInspector.vue:108`.
- ✅ **No new patterns invented:** uses the same `defineAsyncComponent` lazy-load already in App.vue, the same `useApplicationStore` access pattern, the same vue-i18n Composition-API usage already standard in this codebase.
- ✅ **Memory hygiene:** Task 3.2/3.3 update the stale screenshot-gap memory with verified-as-of-today status (cross-checked against `e:\source\specsnap\packages\core\package.json` showing 0.0.9 and `e:\source\specsnap\packages\inspector-core\src\overlay.ts` existing).
