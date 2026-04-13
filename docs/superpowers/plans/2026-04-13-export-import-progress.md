# Export / Import Progress via WebSocket Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dead `ipcRenderer.on('export-progress', ...)` and `ipcRenderer.on('import-progress', ...)` patterns in `ModalExportSchema.vue` and `ModalImportSchema.vue` with real WebSocket connections to the Fastify sidecar, so progress bars and status messages work during export and import operations.

**Architecture:** The Fastify sidecar already has `/ws/export` and `/ws/import` WebSocket routes (in `src/main/routes/schema.ts` lines 387–470). The renderer's `httpClient.ts` already has a `createWebSocket(path)` helper. This plan wires the two modals to use WebSocket instead of the HTTP POST + `ipcRenderer.on` pattern. The existing `Schema.export()` and `Schema.import()` HTTP calls are replaced by WebSocket sessions that stream progress and yield a final result.

**Tech Stack:** Browser WebSocket API, `createWebSocket()` from `httpClient.ts`, Fastify WebSocket routes (already exist), Vue 3 Composition API.

---

## Spec

### Current broken flow (ModalExportSchema)

```
startExport()
  → Schema.export(params)          ← HTTP POST /api/schema/export (long-running)
  → ipcRenderer.on('export-progress', updateProgress)  ← no-op stub, never fires
  → response when done
```

### Target flow

```
startExport()
  → ws = createWebSocket('/ws/export')
  → ws.send({ type: 'start', params })
  → ws.onmessage:
      { type: 'export-progress', payload } → updateProgress(payload)
      { type: 'end', payload }             → mark complete, close ws
      { type: 'cancel' }                  → mark aborted, close ws
      { type: 'error', payload }           → mark error, close ws
  → abortExport():
      ws.send({ type: 'abort' })
```

### WebSocket message protocol (from `src/main/routes/schema.ts`)

**Export `/ws/export`:**

Send to open:
```json
{ "type": "start", "params": { "uid": "...", "type": "mysql", "schema": "...", "outputFile": "...", "tables": [...], ... } }
```

Receive:
```json
{ "type": "export-progress", "payload": { "currentItemIndex": 3, "totalItems": 10, "currentItem": "users", "op": "PROCESSING" } }
{ "type": "end",             "payload": { "cancelled": false } }
{ "type": "cancel" }
{ "type": "error",           "payload": "error message" }
```

Abort:
```json
{ "type": "abort" }
```

**Import `/ws/import`:**

Send to open:
```json
{ "type": "start", "params": { "uid": "...", "type": "mysql", "schema": "...", "file": "/path/to/file.sql" } }
```

Receive:
```json
{ "type": "import-progress", "payload": { "percentage": 42.5, "queryCount": 150 } }
{ "type": "query-error",     "payload": { "time": "2026-04-13T10:00:00", "message": "..." } }
{ "type": "end",             "payload": { "cancelled": false } }
{ "type": "cancel" }
{ "type": "error",           "payload": "error message" }
```

Abort:
```json
{ "type": "abort" }
```

---

## File Map

| File | Change |
|------|--------|
| `src/renderer/components/ModalExportSchema.vue` | Replace `Schema.export()` + `ipcRenderer.on` with WebSocket |
| `src/renderer/components/ModalImportSchema.vue` | Replace `Schema.import()` + `ipcRenderer.on` with WebSocket |

No backend changes needed — WebSocket routes already exist.

---

### Task 1: Migrate `ModalExportSchema.vue` to WebSocket

**Files:**
- Modify: `src/renderer/components/ModalExportSchema.vue`

- [ ] **Step 1: Add `createWebSocket` import**

At the top of the `<script setup>` section, add:

```typescript
import { createWebSocket } from '@/ipc-api/httpClient';
```

- [ ] **Step 2: Add a `wsExport` ref to hold the open socket**

Near the other `ref` declarations in the component, add:

```typescript
const wsExport = ref<WebSocket | null>(null);
```

- [ ] **Step 3: Replace `startExport` function**

Find the current `startExport` function (around line 386):

```typescript
const startExport = async () => {
   isExporting.value = true;
   ...
   const { status, response } = await Schema.export(params);
   ...
   isExporting.value = false;
};
```

Replace with:

```typescript
const startExport = () => {
   isExporting.value = true;
   progressPercentage.value = 0;
   progressStatus.value = '';

   const { uid, client } = currentWorkspace.value;
   const params = {
      uid,
      type: client,
      schema: selectedSchema.value,
      outputFile: dumpFilePath.value,
      tables: [...tables.value],
      ...options.value
   };

   const ws = createWebSocket('/ws/export');
   wsExport.value = ws;

   ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'start', params }));
   };

   ws.onmessage = (event: MessageEvent) => {
      const msg = JSON.parse(event.data as string);

      switch (msg.type) {
         case 'export-progress':
            updateProgress(msg.payload);
            break;
         case 'end':
            progressStatus.value = msg.payload?.cancelled
               ? t('general.aborted')
               : t('general.completed');
            isExporting.value = false;
            wsExport.value = null;
            ws.close();
            break;
         case 'cancel':
            progressStatus.value = t('general.aborted');
            isExporting.value = false;
            wsExport.value = null;
            ws.close();
            break;
         case 'error':
            progressStatus.value = msg.payload;
            addNotification({ status: 'error', message: msg.payload });
            isExporting.value = false;
            wsExport.value = null;
            ws.close();
            break;
      }
   };

   ws.onerror = () => {
      progressStatus.value = t('general.error');
      isExporting.value = false;
      wsExport.value = null;
   };
};
```

- [ ] **Step 4: Replace `updateProgress` function signature**

Find:
```typescript
const updateProgress = (event: IpcRendererEvent, state: ExportState) => {
   progressPercentage.value = Number((state.currentItemIndex / state.totalItems * 100).toFixed(1));
   ...
};
```

The WebSocket path calls `updateProgress(msg.payload)` directly, so drop the `IpcRendererEvent` first argument:

```typescript
const updateProgress = (state: ExportState) => {
   progressPercentage.value = Number((state.currentItemIndex / state.totalItems * 100).toFixed(1));
   switch (state.op) {
      case 'PROCESSING':
         progressStatus.value = t('database.processingTableExport', { table: state.currentItem });
         break;
      case 'FETCH':
         progressStatus.value = t('database.fetchingTableExport', { table: state.currentItem });
         break;
      case 'WRITE':
         progressStatus.value = t('database.writingTableExport', { table: state.currentItem });
         break;
   }
};
```

- [ ] **Step 5: Update abortExport to send via WebSocket**

Find any `Schema.abortExport()` call in the component. Replace with:

```typescript
const abortExport = () => {
   if (wsExport.value && wsExport.value.readyState === WebSocket.OPEN)
      wsExport.value.send(JSON.stringify({ type: 'abort' }));
};
```

- [ ] **Step 6: Remove ipcRenderer listener registration**

Find and remove:
```typescript
ipcRenderer.on('export-progress', updateProgress);
```
(in `onMounted` / IIFE around line 533)

Find and remove:
```typescript
ipcRenderer.off('export-progress', updateProgress);
```
(in `onBeforeUnmount` around line 538)

Remove the `ipcRenderer` stub if it exists in this file.

Also remove `IpcRendererEvent` from any imports (it was used in the old signature).

- [ ] **Step 7: Close WebSocket on component unmount**

In `onBeforeUnmount`, add:

```typescript
if (wsExport.value) {
   wsExport.value.close();
   wsExport.value = null;
}
```

- [ ] **Step 8: Verify TypeScript**

```bash
cd e:/source/antares2
pnpm vue-tsc --noEmit 2>&1 | grep ModalExportSchema
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/renderer/components/ModalExportSchema.vue
git commit -m "feat: migrate ModalExportSchema to WebSocket progress streaming"
```

---

### Task 2: Migrate `ModalImportSchema.vue` to WebSocket

**Files:**
- Modify: `src/renderer/components/ModalImportSchema.vue`

- [ ] **Step 1: Add `createWebSocket` import**

```typescript
import { createWebSocket } from '@/ipc-api/httpClient';
```

- [ ] **Step 2: Add WebSocket ref**

```typescript
const wsImport = ref<WebSocket | null>(null);
```

- [ ] **Step 3: Replace `startImport` function**

Find (around line 118):
```typescript
const startImport = async (file: string) => {
   isImporting.value = true;
   ...
   const { status, response } = await Schema.import(params);
   ...
};
```

Replace with:

```typescript
const startImport = (file: string) => {
   isImporting.value = true;
   sqlFile.value = file;
   completed.value = false;
   progressPercentage.value = 0;
   queryCount.value = 0;
   queryErrors.value = [];

   const { uid, client } = currentWorkspace.value;
   const params = {
      uid,
      type: client,
      schema: props.selectedSchema,
      file
   };

   const ws = createWebSocket('/ws/import');
   wsImport.value = ws;

   ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'start', params }));
   };

   ws.onmessage = (event: MessageEvent) => {
      const msg = JSON.parse(event.data as string);

      switch (msg.type) {
         case 'import-progress':
            updateProgress(msg.payload);
            break;
         case 'query-error':
            handleQueryError(msg.payload);
            break;
         case 'end':
            progressStatus.value = msg.payload?.cancelled
               ? t('general.aborted')
               : t('general.completed');
            completed.value = true;
            isImporting.value = false;
            wsImport.value = null;
            ws.close();
            refreshSchema({ uid, schema: props.selectedSchema });
            break;
         case 'cancel':
            progressStatus.value = t('general.aborted');
            completed.value = true;
            isImporting.value = false;
            wsImport.value = null;
            ws.close();
            break;
         case 'error':
            progressStatus.value = msg.payload;
            addNotification({ status: 'error', message: msg.payload });
            isImporting.value = false;
            wsImport.value = null;
            ws.close();
            break;
      }
   };

   ws.onerror = () => {
      progressStatus.value = t('general.error');
      isImporting.value = false;
      wsImport.value = null;
   };
};
```

- [ ] **Step 4: Update `updateProgress` and `handleQueryError` signatures**

Remove `IpcRendererEvent` as the first argument:

```typescript
const updateProgress = (state: ImportState) => {
   progressPercentage.value = parseFloat(Number(state.percentage).toFixed(1));
   queryCount.value = Number(state.queryCount);
};

const handleQueryError = (err: { time: string; message: string }) => {
   queryErrors.value.push(err);
};
```

- [ ] **Step 5: Update `closeModal` to abort via WebSocket**

Find:
```typescript
const closeModal = async () => {
   let willClose = true;
   if (isImporting.value) {
      willClose = false;
      const { response } = await Schema.abortImport();
      willClose = response.willAbort;
   }
   if (willClose) emit('close');
};
```

Replace with:
```typescript
const closeModal = () => {
   if (isImporting.value) {
      if (wsImport.value && wsImport.value.readyState === WebSocket.OPEN)
         wsImport.value.send(JSON.stringify({ type: 'abort' }));
      // The 'cancel' message handler above will set completed and close
      // The user can then click close again
      return;
   }
   emit('close');
};
```

> Note: The abort flow is now: user clicks Cancel → sends `abort` message → server sends back `{ type: 'cancel' }` → `completed` becomes true → user clicks Close.

- [ ] **Step 6: Remove ipcRenderer listener registrations**

Remove:
```typescript
ipcRenderer.on('import-progress', updateProgress);
ipcRenderer.on('query-error', handleQueryError);
```

Remove:
```typescript
ipcRenderer.off('import-progress', updateProgress);
ipcRenderer.off('query-error', handleQueryError);
```

Remove the `ipcRenderer` stub if it exists in this file.

- [ ] **Step 7: Close WebSocket on component unmount**

In `onBeforeUnmount` or `onUnmounted`:
```typescript
if (wsImport.value) {
   wsImport.value.close();
   wsImport.value = null;
}
```

- [ ] **Step 8: Verify TypeScript**

```bash
cd e:/source/antares2
pnpm vue-tsc --noEmit 2>&1 | grep ModalImportSchema
```

Expected: no errors.

- [ ] **Step 9: Full TypeScript pass**

```bash
cd e:/source/antares2
pnpm vue-tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 10: Commit**

```bash
git add src/renderer/components/ModalImportSchema.vue
git commit -m "feat: migrate ModalImportSchema to WebSocket progress streaming"
```

---

## Manual Testing Checklist

> Requires a real database connection.

**Export:**
- [ ] Right-click a schema → Export → choose output file → click Export
- [ ] Progress bar fills as tables are processed
- [ ] Status label shows current table name
- [ ] On completion: status shows "Completed"
- [ ] Click Cancel during export → operation aborts, status shows "Aborted"
- [ ] Exported file exists and is valid SQL

**Import:**
- [ ] Right-click a schema → Import SQL → choose a SQL file → import starts
- [ ] `X% - N queries executed` updates in real time
- [ ] On completion: "Completed" shown, schema refreshes in sidebar
- [ ] If SQL contains errors: errors listed in the text area
- [ ] Click Cancel during import → operation aborts cleanly
