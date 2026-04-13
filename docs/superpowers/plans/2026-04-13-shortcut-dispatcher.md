# Keyboard Shortcut Dispatcher Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dead `ipcRenderer.on/send` shortcut dispatch pattern (25 Vue files) with a real DOM-based dispatcher so all keyboard shortcuts in `src/common/shortcuts.ts` actually fire.

**Architecture:** Create a composable `useShortcutDispatcher` that installs a global `window keydown` listener, reads shortcuts from the `settingsStore`, matches them, and dispatches `CustomEvent`s on `window`. All `ipcRenderer.on(channel, handler)` calls in components become `window.addEventListener('antares:' + channel, handler)`. The composable is mounted once in `App.vue`.

**Tech Stack:** Vue 3 composables, Pinia (`useSettingsStore`), `src/common/shortcuts.ts` (existing), browser `KeyboardEvent`, `CustomEvent`.

---

## Spec

### Problem

`src/common/shortcuts.ts` defines key bindings (e.g. `F5 → run-or-reload`, `Ctrl+S → save-content`).

In Electron, `ShortcutRegister.ts` captured these via `globalShortcut` / menu items and called `mainWindow.webContents.send(eventName)`. In the renderer, every tab registered `ipcRenderer.on(eventName, handler)`.

After the Tauri migration both sides were stubbed to no-ops: the stubs don't break the app but all 25 event-driven features stopped working.

### Target

```
User presses Ctrl+S
  → global keydown listener in useShortcutDispatcher
  → matches 'save-content' from settings.shortcuts
  → window.dispatchEvent(new CustomEvent('antares:save-content'))
  → WorkspaceTabQuery/Props/New components: window.addEventListener('antares:save-content', handler)
```

### Custom event namespace

All channels are prefixed `antares:` to avoid clashing with standard DOM events:

*   `antares:run-or-reload`
*   `antares:save-content`
*   `antares:open-new-tab`
*   `antares:close-tab`
*   `antares:next-tab` / `antares:prev-tab`
*   `antares:format-query`
*   `antares:kill-query`
*   `antares:clear-query`
*   `antares:query-history`
*   `antares:open-file`
*   `antares:save-file-as`
*   `antares:open-all-connections`
*   `antares:open-scratchpad`
*   `antares:open-settings`
*   `antares:create-connection`
*   `antares:open-filter`
*   `antares:next-page` / `antares:prev-page`
*   `antares:toggle-console`
*   `antares:select-tab-1` … `antares:select-tab-9`

### Key matching

`shortcuts.ts` uses an Electron `Accelerator`\-style format: `'CommandOrControl+S'`. The matcher must translate these to browser `KeyboardEvent` fields:

| Accelerator token | KeyboardEvent check |
| --- | --- |
| `CommandOrControl` | `e.ctrlKey || e.metaKey` |
| `Alt` | `e.altKey` |
| `Shift` | `e.shiftKey` |
| `F5`…`F12` | `e.key === 'F5'` … |
| `Right` | `e.key === 'ArrowRight'` |
| `Left` | `e.key === 'ArrowLeft'` |
| `PageDown` | `e.key === 'PageDown'` |
| `PageUp` | `e.key === 'PageUp'` |
| `Space` | `e.key === ' '` |
| `0`…`9` | `e.key === '0'`…`'9'` |
| `=` | `e.key === '='` or `e.key === '+'` |
| `-` | `e.key === '-'` |
| `` ` `` | `e.key === '`'\` |
| Letter (`S`, `T`, …) | `e.key.toLowerCase() === 's'`… |

---

## File Map

| File | Change |
| --- | --- |
| `src/renderer/composables/useShortcutDispatcher.ts` | **Create** — global keydown listener + dispatch |
| `src/renderer/App.vue` | Mount composable; replace `ipcRenderer.on` for modal channels |
| `src/renderer/components/Workspace.vue` | Replace `ipcRenderer.on` for tab channels |
| `src/renderer/components/WorkspaceTabQuery.vue` | Replace `ipcRenderer.on/removeListener` |
| `src/renderer/components/WorkspaceTabTable.vue` | Replace `ipcRenderer.on/removeListener` |
| `src/renderer/components/WorkspaceTabNew*.vue` (8 files) | Replace `ipcRenderer.on/removeListener` |
| `src/renderer/components/WorkspaceTabProps*.vue` (8 files) | Replace `ipcRenderer.on/removeListener` |

---

## P0 — Core Dispatcher + High-Priority Shortcuts

### Task 1: Create `useShortcutDispatcher` composable

**Files:**

Create: `src/renderer/composables/useShortcutDispatcher.ts`

 **Step 1: Write the composable**

Create `src/renderer/composables/useShortcutDispatcher.ts`:

```typescript
import { onMounted, onUnmounted } from 'vue';

import { shortcuts as defaultShortcuts } from 'common/shortcuts';
import { useSettingsStore } from '@/stores/settings';

/**
 * Translates an Electron Accelerator key token to the equivalent KeyboardEvent.key value.
 */
function acceleratorKeyToEventKey (token: string): string {
   const map: Record<string, string> = {
      Right: 'ArrowRight',
      Left: 'ArrowLeft',
      Up: 'ArrowUp',
      Down: 'ArrowDown',
      Space: ' ',
      PageDown: 'PageDown',
      PageUp: 'PageUp',
      Home: 'Home',
      End: 'End',
      Escape: 'Escape',
      Enter: 'Enter',
      Tab: 'Tab',
      Backspace: 'Backspace',
      Delete: 'Delete'
   };
   if (map[token]) return map[token];
   // Function keys: F1–F12
   if (/^F\d+$/.test(token)) return token;
   // Single character — normalize to lowercase for comparison
   return token.toLowerCase();
}

interface ParsedShortcut {
   ctrl: boolean;   // CommandOrControl
   alt: boolean;
   shift: boolean;
   key: string;     // normalised KeyboardEvent.key
}

function parseShortcut (keys: string[]): ParsedShortcut | null {
   // keys is an array but in practice always length 1 per ShortcutRecord
   const raw = keys[0];
   if (!raw) return null;

   const parts = raw.split('+');
   let ctrl = false;
   let alt = false;
   let shift = false;
   let keyToken = '';

   for (const part of parts) {
      if (part === 'CommandOrControl') ctrl = true;
      else if (part === 'Alt') alt = true;
      else if (part === 'Shift') shift = true;
      else keyToken = part;
   }

   if (!keyToken) return null;
   return { ctrl, alt, shift, key: acceleratorKeyToEventKey(keyToken) };
}

function matchesEvent (e: KeyboardEvent, parsed: ParsedShortcut): boolean {
   if (parsed.ctrl !== (e.ctrlKey || e.metaKey)) return false;
   if (parsed.alt !== e.altKey) return false;
   if (parsed.shift !== e.shiftKey) return false;
   // e.key for letters is lowercase when no Shift; for Shift+letter it is uppercase.
   // Compare lowercase to handle both cases.
   return e.key.toLowerCase() === parsed.key.toLowerCase() || e.key === parsed.key;
}

export function useShortcutDispatcher () {
   const settingsStore = useSettingsStore();

   const handleKeydown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts while typing in inputs/textareas
      const target = e.target as HTMLElement;
      const isEditable =
         target.tagName === 'INPUT' ||
         target.tagName === 'TEXTAREA' ||
         target.isContentEditable;

      // Ace editor uses a hidden textarea — allow shortcuts there
      const isAce = target.classList.contains('ace_text-input');

      if (isEditable && !isAce) return;

      // Prefer user-customised shortcuts; fall back to defaults
      const activeShortcuts =
         settingsStore.shortcuts.length > 0
            ? settingsStore.shortcuts
            : defaultShortcuts;

      for (const record of activeShortcuts) {
         const parsed = parseShortcut(record.keys);
         if (!parsed) continue;
         if (matchesEvent(e, parsed)) {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent(`antares:${record.event}`));
            return; // first match wins
         }
      }
   };

   onMounted(() => {
      window.addEventListener('keydown', handleKeydown);
   });

   onUnmounted(() => {
      window.removeEventListener('keydown', handleKeydown);
   });
}
```

*   **Step 2: Verify TypeScript**

```
cd e:/source/antares2
pnpm vue-tsc --noEmit 2>&1 | grep useShortcutDispatcher
```

Expected: no errors.

*   **Step 3: Commit composable**

```
git add src/renderer/composables/useShortcutDispatcher.ts
git commit -m "feat: add useShortcutDispatcher composable for DOM-based shortcut dispatch"
```

---

### Task 2: Mount dispatcher in `App.vue`; migrate modal-trigger shortcuts

**Files:**

Modify: `src/renderer/App.vue`

 **Step 1: Add composable import and invocation**

In `src/renderer/App.vue`, in the `<script setup>` block, add after the existing imports:

```typescript
import { useShortcutDispatcher } from '@/composables/useShortcutDispatcher';

// Mount global shortcut dispatcher (replaces Electron ShortcutRegister)
useShortcutDispatcher();
```

*   **Step 2: Replace the four** `**ipcRenderer.on**` **calls in** `**onMounted**`

Find this block in App.vue (around line 128):

```typescript
onMounted(() => {
   ipcRenderer.on('open-all-connections', () => {
      isAllConnectionsModal.value = true;
   });
   ipcRenderer.on('open-scratchpad', () => {
      isScratchpad.value = true;
   });
   ipcRenderer.on('open-settings', () => {
      isSettingModal.value = true;
   });
   ipcRenderer.on('create-connection', () => {
      workspacesStore.selectWorkspace('NEW');
   });
   ipcRenderer.send('check-for-updates');
   checkVersionUpdate();
   ...
```

Replace the four `ipcRenderer.on` calls with:

```typescript
onMounted(() => {
   window.addEventListener('antares:open-all-connections', () => {
      isAllConnectionsModal.value = true;
   });
   window.addEventListener('antares:open-scratchpad', () => {
      isScratchpad.value = true;
   });
   window.addEventListener('antares:open-settings', () => {
      isSettingModal.value = true;
   });
   window.addEventListener('antares:create-connection', () => {
      workspacesStore.selectWorkspace('NEW');
   });
   // NOTE: check-for-updates is handled by checkVersionUpdate() until auto-update is implemented
   checkVersionUpdate();
   ...
```

Remove the `ipcRenderer.send('check-for-updates')` line (it's a no-op stub anyway).

*   **Step 3: Remove the** `**ipcRenderer**` **stub from App.vue**

Delete lines 74–83 (the `ipcRenderer` stub object). It is no longer needed.

*   **Step 4: Verify TypeScript**

```
cd e:/source/antares2
pnpm vue-tsc --noEmit 2>&1 | grep "App.vue"
```

Expected: no errors.

*   **Step 5: Commit**

```
git add src/renderer/App.vue
git commit -m "feat: mount shortcut dispatcher in App.vue; migrate modal-trigger shortcuts"
```

---

### Task 3: Migrate `Workspace.vue` tab-navigation shortcuts

**Files:**

Modify: `src/renderer/components/Workspace.vue`

 **Step 1: Find the ipcRenderer block in Workspace.vue**

The relevant block starts around line 865:

```typescript
ipcRenderer.on('open-new-tab', () => { ... });
ipcRenderer.on('close-tab', () => { ... });
ipcRenderer.on('next-tab', () => { ... });
ipcRenderer.on('prev-tab', () => { ... });
for (let i = 1; i <= 9; i++) {
   ipcRenderer.on(`select-tab-${i}`, () => { ... });
}
```

*   **Step 2: Replace with** `**window.addEventListener**` **calls**

Replace all `ipcRenderer.on(...)` with `window.addEventListener('antares:...')`. Because these are mounted listeners that should be cleaned up, store them in a variable to remove later:

```typescript
// In onMounted (or the same IIFE where they currently are):
const shortcutHandlers: Array<{ event: string; handler: EventListenerOrEventListenerObject }> = [];

const addShortcut = (event: string, handler: () => void) => {
   window.addEventListener(`antares:${event}`, handler);
   shortcutHandlers.push({ event: `antares:${event}`, handler });
};

addShortcut('open-new-tab', () => { /* existing logic */ });
addShortcut('close-tab', () => { /* existing logic */ });
addShortcut('next-tab', () => { /* existing logic */ });
addShortcut('prev-tab', () => { /* existing logic */ });
for (let i = 1; i <= 9; i++) {
   addShortcut(`select-tab-${i}`, () => { /* existing logic */ });
}
```

Add cleanup in `onUnmounted`:

```typescript
onUnmounted(() => {
   for (const { event, handler } of shortcutHandlers)
      window.removeEventListener(event, handler);
});
```

Remove the `ipcRenderer` stub if it exists in this file.

*   **Step 3: Verify TypeScript**

```
cd e:/source/antares2
pnpm vue-tsc --noEmit 2>&1 | grep "Workspace.vue"
```

Expected: no errors.

*   **Step 4: Commit**

```
git add src/renderer/components/Workspace.vue
git commit -m "feat: migrate Workspace.vue tab-navigation to DOM custom events"
```

---

### Task 4: Migrate `WorkspaceTabQuery.vue`

**Files:**

Modify: `src/renderer/components/WorkspaceTabQuery.vue`

 **Step 1: Locate ipcRenderer calls**

Lines ~814–821 (onMounted):

```typescript
ipcRenderer.on('run-or-reload', reloadListener);
ipcRenderer.on('format-query', formatListener);
ipcRenderer.on('kill-query', killQueryListener);
ipcRenderer.on('clear-query', clearQueryListener);
ipcRenderer.on('query-history', historyListener);
ipcRenderer.on('open-file', openFileListener);
ipcRenderer.on('save-file-as', saveFileAsListener);
ipcRenderer.on('save-content', saveContentListener);
```

Lines ~906–913 (onUnmounted / cleanup):

```typescript
ipcRenderer.removeListener('run-or-reload', reloadListener);
ipcRenderer.removeListener('format-query', formatListener);
...
```

*   **Step 2: Replace with** `**window.addEventListener**`

In `onMounted`:

```typescript
window.addEventListener('antares:run-or-reload', reloadListener);
window.addEventListener('antares:format-query', formatListener);
window.addEventListener('antares:kill-query', killQueryListener);
window.addEventListener('antares:clear-query', clearQueryListener);
window.addEventListener('antares:query-history', historyListener);
window.addEventListener('antares:open-file', openFileListener);
window.addEventListener('antares:save-file-as', saveFileAsListener);
window.addEventListener('antares:save-content', saveContentListener);
```

In cleanup (onUnmounted / onBeforeUnmount):

```typescript
window.removeEventListener('antares:run-or-reload', reloadListener);
window.removeEventListener('antares:format-query', formatListener);
window.removeEventListener('antares:kill-query', killQueryListener);
window.removeEventListener('antares:clear-query', clearQueryListener);
window.removeEventListener('antares:query-history', historyListener);
window.removeEventListener('antares:open-file', openFileListener);
window.removeEventListener('antares:save-file-as', saveFileAsListener);
window.removeEventListener('antares:save-content', saveContentListener);
```

Note: The handler signatures receive `(e: CustomEvent)` instead of `(event: IpcRendererEvent, ...args)`. Since none of these handlers use the event argument's extra args, just update the signature to `(_e: Event) => void` if TypeScript complains.

Remove the `ipcRenderer` stub declaration in this file.

*   **Step 3: Verify TypeScript**

```
cd e:/source/antares2
pnpm vue-tsc --noEmit 2>&1 | grep "WorkspaceTabQuery"
```

Expected: no errors.

*   **Step 4: Commit**

```
git add src/renderer/components/WorkspaceTabQuery.vue
git commit -m "feat: migrate WorkspaceTabQuery shortcuts to DOM custom events"
```

---

## P1 — Remaining WorkspaceTab\* Components

These 16 files all follow the same pattern as Task 4. Each uses a subset of the shortcut channels, most commonly `save-content` and/or `run-or-reload`.

**Files to update:**

| File | Channels used |
| --- | --- |
| `WorkspaceTabTable.vue` | `save-content`, `run-or-reload` |
| `WorkspaceTabNewFunction.vue` | `save-content`, `run-or-reload` |
| `WorkspaceTabNewMaterializedView.vue` | `save-content`, `run-or-reload` |
| `WorkspaceTabNewRoutine.vue` | `save-content`, `run-or-reload` |
| `WorkspaceTabNewScheduler.vue` | `save-content`, `run-or-reload` |
| `WorkspaceTabNewTable.vue` | `save-content`, `run-or-reload` |
| `WorkspaceTabNewTrigger.vue` | `save-content`, `run-or-reload` |
| `WorkspaceTabNewTriggerFunction.vue` | `save-content`, `run-or-reload` |
| `WorkspaceTabNewView.vue` | `save-content`, `run-or-reload` |
| `WorkspaceTabPropsFunction.vue` | `save-content`, `run-or-reload` |
| `WorkspaceTabPropsMaterializedView.vue` | `save-content`, `run-or-reload` |
| `WorkspaceTabPropsRoutine.vue` | `save-content`, `run-or-reload` |
| `WorkspaceTabPropsScheduler.vue` | `save-content`, `run-or-reload` |
| `WorkspaceTabPropsTable.vue` | `save-content`, `run-or-reload` |
| `WorkspaceTabPropsTrigger.vue` | `save-content`, `run-or-reload` |
| `WorkspaceTabPropsTriggerFunction.vue` | `save-content`, `run-or-reload` |
| `WorkspaceTabPropsView.vue` | `save-content`, `run-or-reload` |

### Task 5: Migrate all remaining WorkspaceTab\* components (bulk)

*   **Step 1: For each file in the table above, find and replace the ipcRenderer pattern**

Pattern to find in each file:

```typescript
ipcRenderer.on('save-content', saveContentListener);
// possibly also:
ipcRenderer.on('run-or-reload', reloadListener);
```

Replace with:

```typescript
window.addEventListener('antares:save-content', saveContentListener);
// possibly also:
window.addEventListener('antares:run-or-reload', reloadListener);
```

And in cleanup:

```typescript
window.removeEventListener('antares:save-content', saveContentListener);
// possibly also:
window.removeEventListener('antares:run-or-reload', reloadListener);
```

Remove any `ipcRenderer` stub declaration in each file.

Update listener function signatures from `(event: IpcRendererEvent) => void` to `(_e: Event) => void` if TypeScript requires it. Check each file's handler signature.

*   **Step 2: Full TypeScript check**

```
cd e:/source/antares2
pnpm vue-tsc --noEmit
```

Expected: 0 errors.

*   **Step 3: Lint**

```
cd e:/source/antares2
pnpm lint:fix
```

*   **Step 4: Commit all**

```
git add src/renderer/components/WorkspaceTab*.vue
git commit -m "feat: migrate all WorkspaceTab* components to DOM custom event shortcuts"
```

---

## Manual Testing Checklist

After P0 + P1 are complete:

*   Open a SQL query tab → Press `F5` → query runs
*   Press `Ctrl+S` → content saves (notification shown)
*   Press `Ctrl+B` → query formats
*   Press `Ctrl+K` → query killed
*   Press `Ctrl+T` → new tab opens
*   Press `Ctrl+W` → tab closes
*   Press `Ctrl+1` → first tab selected
*   Press `Ctrl+Shift+Space` → All Connections modal opens
*   Open a Props tab → Press `Ctrl+S` → schema saved
*   Customise a shortcut in Settings → new shortcut triggers the action