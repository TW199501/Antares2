# TheTitleBar Window API Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all no-op stub calls in `TheTitleBar.vue` with real Tauri window API calls so the title bar fully works.

**Architecture:** `TheTitleBar.vue` currently uses two stubs: `getCurrentWindow()` (all returns no-ops) and `ipcRenderer` (also no-ops). The real `@tauri-apps/api/window` module is already a declared dependency and already used in `src/renderer/ipc-api/Application.ts`. This plan wires the title bar directly to Tauri.

**Tech Stack:** `@tauri-apps/api/window` (`getCurrentWindow`, `Window`), Vue 3 Composition API, TypeScript.

---

## Spec

| Behaviour | Old (Electron) | Target (Tauri) |
| --- | --- | --- |
| Close button | `ipcRenderer.send('close-app')` → Electron main | `Application.closeApp()` (already calls `getCurrentWindow().close()`) |
| Minimize | `getCurrentWindow().minimize()` stub | `appWindow.minimize()` |
| Maximize / Restore | `getCurrentWindow().maximize/unmaximize()` stub | `appWindow.maximize()` / `appWindow.unmaximize()` |
| isMaximized state | `getCurrentWindow().isMaximized()` stub → always false | `appWindow.isMaximized()` (async), update on `resize` window event |
| Document title | `ipcRenderer.send('change-window-title', val)` → no-op | `document.title = val` |
| DevTools | `w.value.webContents.openDevTools()` stub | Tauri opens DevTools in debug builds automatically; remove button guard or use `__TAURI_INTERNALS__` for debug |
| Reload | `w.value.reload()` stub | `location.reload()` |
| isMaximized update event | `getCurrentWindow().on('resize', ...)` stub | `appWindow.onResized(cb)` or `window.addEventListener('resize', onResize)` + `appWindow.isMaximized()` |

---

## File Map

| File | Change |
| --- | --- |
| `src/renderer/components/TheTitleBar.vue` | Replace both stubs; import Tauri APIs |

---

### Task 1: Replace `getCurrentWindow` stub and `ipcRenderer` stub

**Files:**

Modify: `src/renderer/components/TheTitleBar.vue:49-154`

 **Step 1: Remove both stubs and add real imports**

Replace the entire script section from line 48 through the two stub blocks (lines 49–86):

```typescript
// REMOVE these lines (48-86 in the file):
// TODO: Replace with @tauri-apps/api/window when Tauri is set up
// import { getCurrentWindow } from '@electron/remote';
// TODO: Replace with Tauri event system when Tauri is set up
// import { ipcRenderer } from 'electron';
// Stub getCurrentWindow for Tauri migration
const getCurrentWindow = () => ({ ... });
// Stub ipcRenderer for Tauri migration
const ipcRenderer = { ... };
```

Replace with:

```typescript
import { getCurrentWindow } from '@tauri-apps/api/window';
import Application from '@/ipc-api/Application';
import { storeToRefs } from 'pinia';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseIcon from '@/components/BaseIcon.vue';
import { useConnectionsStore } from '@/stores/connections';
import { useWorkspacesStore } from '@/stores/workspaces';
```

*   **Step 2: Replace stub usage in component logic**

Replace the body of the script section (lines 88–153) with:

```typescript
const { t } = useI18n();
const { getConnectionName } = useConnectionsStore();
const workspacesStore = useWorkspacesStore();
const { getSelected: selectedWorkspace } = storeToRefs(workspacesStore);
const { getWorkspace } = workspacesStore;

const appIcon = new URL('@/images/logo.svg', import.meta.url).href;
const isDevelopment = ref(import.meta.env?.MODE === 'development');
const isMacOS = navigator.platform.startsWith('Mac');
const isWindows = navigator.platform.startsWith('Win');
const isLinux = navigator.platform.startsWith('Linux');
const isMaximized = ref(false);

const appWindow = getCurrentWindow();

const windowTitle = computed(() => {
   if (!selectedWorkspace.value) return '';
   if (selectedWorkspace.value === 'NEW') return t('connection.createNewConnection');
   const connectionName = getConnectionName(selectedWorkspace.value);
   const workspace = getWorkspace(selectedWorkspace.value);
   const breadcrumbs = workspace
      ? Object.values(workspace.breadcrumbs).filter(Boolean)
      : [workspace?.client];
   return [connectionName, ...breadcrumbs].join(' • ');
});

const openDevTools = () => {
   // DevTools are auto-opened in debug builds by Tauri (lib.rs).
   // This button is only shown when isDevelopment is true.
   // Tauri v2 has no JS API to open DevTools; rely on the Rust side.
};

const reload = () => {
   location.reload();
};

const minimize = () => {
   appWindow.minimize();
};

const toggleFullScreen = () => {
   if (isMaximized.value)
      appWindow.unmaximize();
   else
      appWindow.maximize();
};

const closeApp = () => {
   Application.closeApp();
};

const onResize = async () => {
   isMaximized.value = await appWindow.isMaximized();
};

watch(windowTitle, (val) => {
   document.title = val || 'Antares SQL';
});

onMounted(async () => {
   isMaximized.value = await appWindow.isMaximized();
   window.addEventListener('resize', onResize);
});

onUnmounted(() => {
   window.removeEventListener('resize', onResize);
});
```

*   **Step 3: Verify TypeScript compiles**

```
cd e:/source/antares2
pnpm vue-tsc --noEmit 2>&1 | grep TheTitleBar
```

Expected: no errors for `TheTitleBar.vue`.

*   **Step 4: Start dev server and manually verify**

```
pnpm tauri:dev
```

Manual checks:

 Click minimize → window minimizes

 Click maximize → window maximizes; icon switches to restore icon

 Click restore → window restores

 Click close → window closes

 Switch to a connection → document.title updates to connection name

 Dev tools button visible in dev mode (DevTools already auto-open in debug; button can be left as no-op)

 **Step 5: Commit**

```
cd e:/source/antares2
git add src/renderer/components/TheTitleBar.vue
git commit -m "fix: replace TheTitleBar stubs with real Tauri window API"
```