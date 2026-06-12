# Auto-Update Integration Plan (Tauri Updater)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stub `ipcRenderer.send('check-for-updates')` / `ipcRenderer.send('restart-to-update')` pattern in `ModalSettingsUpdate.vue` with a real Tauri updater integration, so users can check for updates and install them without relaunching manually.

**Architecture:** Add `tauri-plugin-updater` to the Rust shell and `@tauri-apps/plugin-updater` to the renderer. Create a TypeScript wrapper `src/renderer/ipc-api/Updater.ts`. Add actions to `applicationStore` that drive the update state machine. Wire `ModalSettingsUpdate.vue` to the store actions.

**Tech Stack:** `tauri-plugin-updater` (Rust), `@tauri-apps/plugin-updater` (JS), Pinia `applicationStore`, Vue 3 Composition API.

---

## Spec

### Update State Machine

The `applicationStore` already defines `UpdateStatus`:

```
'noupdate' | 'available' | 'checking' | 'nocheck' | 'downloading' | 'downloaded' | 'disabled' | 'link'
```

Target flow:

```
on app start / user clicks "Check for Updates"
  → status: 'checking'
  → call check()
    ↳ no update → status: 'noupdate'
    ↳ error → status: 'nocheck'
    ↳ update found
        → status: 'available'
        → auto-download starts
        → status: 'downloading' (with progressPercentage)
        → download complete → status: 'downloaded'
        → user clicks "Restart to Install"
        → plugin.installUpdate() + relaunch()
```

### Endpoint

The Tauri updater reads the update JSON endpoint from `tauri.conf.json` (`updater.endpoints`). This plan wires up the plugin; configuring the actual endpoint URL is a deployment concern (out of scope here — a `TODO` comment is left in `tauri.conf.json`).

---

## File Map

| File | Change |
| --- | --- |
| `src-tauri/Cargo.toml` | Add `tauri-plugin-updater = "2"` dependency |
| `src-tauri/src/lib.rs` | Register `tauri_plugin_updater` |
| `src-tauri/tauri.conf.json` | Add `plugins.updater` section with placeholder endpoint |
| `src/renderer/ipc-api/Updater.ts` | **Create** — wraps `@tauri-apps/plugin-updater` |
| `src/renderer/stores/application.ts` | Add `checkForUpdates()` and `installUpdate()` actions |
| `src/renderer/components/ModalSettingsUpdate.vue` | Call store actions; remove stubs |

---

## P0 — Plugin Wiring + Check/Download Flow

### Task 1: Add Rust dependency and register plugin

**Files:**

Modify: `src-tauri/Cargo.toml`

Modify: `src-tauri/src/lib.rs`

 **Step 1: Add crate to Cargo.toml**

In `src-tauri/Cargo.toml`, in `[dependencies]`, add:

```
tauri-plugin-updater = "2"
```

*   **Step 2: Register plugin in lib.rs**

In `src-tauri/src/lib.rs`, in `tauri::Builder::default()` chain, add after existing plugins:

```
.plugin(tauri_plugin_updater::Builder::new().build())
```

The full builder block should look like:

```
tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_window_state::Builder::new().build())
    .plugin(tauri_plugin_os::init())
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .plugin(tauri_plugin_clipboard_manager::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    // ...
```

*   **Step 3: Add updater config placeholder in tauri.conf.json**

In `src-tauri/tauri.conf.json`, add under `"plugins"`:

```
"updater": {
  "pubkey": "",
  "endpoints": [
    "TODO: https://your-update-server/{{target}}/{{arch}}/{{current_version}}"
  ]
}
```

> Note: The actual endpoint URL and signing key must be configured before production releases. Leave as TODO for now.

*   **Step 4: Verify Rust compiles**

```
cd e:/source/antares2
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5
```

Expected: `Compiling antares-sql ...` then `Finished`. No errors.

*   **Step 5: Commit**

```
git add src-tauri/Cargo.toml src-tauri/src/lib.rs src-tauri/tauri.conf.json
git commit -m "feat: add tauri-plugin-updater to Rust shell"
```

---

### Task 2: Install JS package and create `Updater.ts`

**Files:**

Modify: `package.json` (via pnpm)

Create: `src/renderer/ipc-api/Updater.ts`

 **Step 1: Install the JS package**

```
cd e:/source/antares2
pnpm add @tauri-apps/plugin-updater
```

Expected: package added to `package.json` and `pnpm-lock.yaml`.

*   **Step 2: Create Updater.ts**

Create `src/renderer/ipc-api/Updater.ts`:

```typescript
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export type UpdaterCallbacks = {
   onStatus: (status: 'noupdate' | 'available' | 'nocheck') => void;
   onDownloadProgress: (percentage: number) => void;
   onDownloaded: () => void;
};

/**
 * Checks for an update and, if found, downloads it automatically.
 * Calls the appropriate callback at each stage.
 */
export async function checkAndDownload (callbacks: UpdaterCallbacks): Promise<void> {
   try {
      const update = await check();

      if (!update) {
         callbacks.onStatus('noupdate');
         return;
      }

      callbacks.onStatus('available');

      let downloaded = 0;
      let contentLength = 0;

      await update.download((event) => {
         switch (event.event) {
            case 'Started':
               contentLength = event.data.contentLength ?? 0;
               break;
            case 'Progress':
               downloaded += event.data.chunkLength;
               const pct = contentLength > 0
                  ? Number(((downloaded / contentLength) * 100).toFixed(1))
                  : 0;
               callbacks.onDownloadProgress(pct);
               break;
            case 'Finished':
               callbacks.onDownloaded();
               break;
         }
      });
   }
   catch (_err) {
      callbacks.onStatus('nocheck');
   }
}

/**
 * Installs the downloaded update and relaunches the app.
 * Call only when updateStatus === 'downloaded'.
 */
export async function installAndRelaunch (): Promise<void> {
   const update = await check();
   if (update) await update.install();
   await relaunch();
}
```

> Note: `@tauri-apps/plugin-process` provides `relaunch()`. Install if not present:
> 
> ```
> pnpm add @tauri-apps/plugin-process
> ```
> 
> Also add `tauri-plugin-process = "2"` to `Cargo.toml` and register it in `lib.rs` if the project doesn't already have it.

*   **Step 3: Verify TypeScript**

```
cd e:/source/antares2
pnpm vue-tsc --noEmit 2>&1 | grep Updater
```

Expected: no errors.

*   **Step 4: Commit**

```
git add src/renderer/ipc-api/Updater.ts package.json pnpm-lock.yaml
git commit -m "feat: add Updater.ts wrapper for tauri-plugin-updater"
```

---

### Task 3: Add update actions to `applicationStore`

**Files:**

Modify: `src/renderer/stores/application.ts`

 **Step 1: Add import**

At the top of `src/renderer/stores/application.ts`, add:

```typescript
import { checkAndDownload, installAndRelaunch } from '@/ipc-api/Updater';
```

*   **Step 2: Add two actions**

Inside the `actions` object in the store, add after `hideScratchpad`:

```typescript
async checkForUpdates () {
   this.updateStatus = 'checking';
   await checkAndDownload({
      onStatus: (status) => {
         this.updateStatus = status;
      },
      onDownloadProgress: (pct) => {
         this.updateStatus = 'downloading';
         this.downloadProgress = pct;
      },
      onDownloaded: () => {
         this.updateStatus = 'downloaded';
         this.downloadProgress = 100;
      }
   });
},
async installUpdate () {
   await installAndRelaunch();
}
```

*   **Step 3: Verify TypeScript**

```
cd e:/source/antares2
pnpm vue-tsc --noEmit 2>&1 | grep "application.ts"
```

Expected: no errors.

*   **Step 4: Commit**

```
git add src/renderer/stores/application.ts
git commit -m "feat: add checkForUpdates and installUpdate actions to applicationStore"
```

---

### Task 4: Wire `ModalSettingsUpdate.vue` to store actions

**Files:**

Modify: `src/renderer/components/ModalSettingsUpdate.vue`

 **Step 1: Remove the** `**ipcRenderer**` **stub**

Delete lines 67–76 (the `ipcRenderer` stub object):

```typescript
// DELETE:
const ipcRenderer = {
   on: (_channel: string, _listener: (...args: any[]) => void) => {},
   send: (_channel: string, ..._args: any[]) => {},
   removeListener: (_channel: string, _listener: (...args: any[]) => void) => {},
   off: (_channel: string, _listener: (...args: any[]) => void) => {}
};
```

*   **Step 2: Replace** `**checkForUpdates**` **and** `**restartToUpdate**` **functions**

Find:

```typescript
const checkForUpdates = () => {
   ipcRenderer.send('check-for-updates');
};

const restartToUpdate = () => {
   ipcRenderer.send('restart-to-update');
};
```

Replace with:

```typescript
const { checkForUpdates, installUpdate } = applicationStore;

const restartToUpdate = () => {
   installUpdate();
};
```

Update the template button binding from `@click="checkForUpdates"` — it can stay as-is since `checkForUpdates` is now imported from the store. Verify the `restartToUpdate` binding in the template is `@click="restartToUpdate"` (unchanged).

*   **Step 3: Also trigger check-for-updates on App.vue startup**

In `src/renderer/App.vue`, in `onMounted`, add after `checkVersionUpdate()`:

```typescript
applicationStore.checkForUpdates();
```

*   **Step 4: Verify TypeScript**

```
cd e:/source/antares2
pnpm vue-tsc --noEmit 2>&1 | grep ModalSettingsUpdate
```

Expected: no errors.

*   **Step 5: Commit**

```
git add src/renderer/components/ModalSettingsUpdate.vue src/renderer/App.vue
git commit -m "feat: wire ModalSettingsUpdate to applicationStore update actions"
```

---

## P1 — Pre-release Toggle Persistence

### Task 5: Persist `allowPrerelease` into Tauri updater check

**Files:**

Modify: `src/renderer/ipc-api/Updater.ts`

Modify: `src/renderer/stores/application.ts`

 **Step 1: Pass allowPrerelease to check()**

The Tauri updater `check()` accepts an options object. Update `Updater.ts` to accept and forward the `allowPrerelease` flag:

```typescript
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export type UpdaterCallbacks = {
   onStatus: (status: 'noupdate' | 'available' | 'nocheck') => void;
   onDownloadProgress: (percentage: number) => void;
   onDownloaded: () => void;
};

export async function checkAndDownload (
   callbacks: UpdaterCallbacks,
   options?: { allowPrerelease?: boolean }
): Promise<void> {
   try {
      // tauri-plugin-updater v2 `check()` uses the endpoint configured in tauri.conf.json.
      // allowPrerelease is a hint passed to the endpoint (URL template variable);
      // actual filtering depends on the update server implementation.
      const update = await check();
      // ... rest unchanged
```

> Note: `tauri-plugin-updater` v2 does not have a native `allowPrerelease` flag — it is an endpoint convention. The update server should respect a query param. For now, record the flag in settings and leave a comment noting the server must implement it.

*   **Step 2: Update** `**checkForUpdates**` **action to pass the flag**

```typescript
async checkForUpdates () {
   const { allowPrerelease } = useSettingsStore();
   this.updateStatus = 'checking';
   await checkAndDownload({
      onStatus: (status) => { this.updateStatus = status; },
      onDownloadProgress: (pct) => {
         this.updateStatus = 'downloading';
         this.downloadProgress = pct;
      },
      onDownloaded: () => {
         this.updateStatus = 'downloaded';
         this.downloadProgress = 100;
      }
   }, { allowPrerelease });
},
```

Add import at top of `application.ts`:

```typescript
import { useSettingsStore } from './settings';
```

*   **Step 3: Verify TypeScript**

```
cd e:/source/antares2
pnpm vue-tsc --noEmit
```

Expected: 0 errors.

*   **Step 4: Commit**

```
git add src/renderer/ipc-api/Updater.ts src/renderer/stores/application.ts
git commit -m "feat: forward allowPrerelease setting to updater check"
```

---

## Manual Testing Checklist

*   Open Settings → Updates tab
*   Click "Check for updates" → status changes to "Checking..."
*   If no update available → "No updates available"
*   If update available → progress bar appears, fills to 100%
*   After download → "Restart to Install" button appears
*   (Staging only) Click restart → app relaunches with new version
*   Toggle "Include beta updates" → persists across restarts