# Antares SQL Client: Electron to Tauri v2 Migration Design

## Overview

Migrate Antares SQL Client from Electron 30 to Tauri v2, using a Node.js sidecar (HTTP server) to preserve all existing database driver code. The Vue 3 frontend stays, Webpack is replaced by Vite, and Electron-specific APIs are replaced by Tauri plugins.

**Key decisions:**

*   **Tauri v2** (stable, mature plugin ecosystem)
*   **Sidecar HTTP Server** (Fastify) to reuse all Node.js DB code
*   **All 4 DB drivers retained** (MySQL, PostgreSQL, SQLite, Firebird) **\+ add SQL Server**
*   **One feature addition:** SQL Server support via `mssql` package (~1,500 lines new client)

---

## Architecture

```
antares/                        ← 根目錄
├── src-tauri/                  ← 新增：Tauri Rust 端
│   ├── src/
│   │   ├── main.rs             ← Tauri 入口，啟動 sidecar + 視窗
│   │   ├── sidecar.rs          ← Sidecar 生命週期管理
│   │   └── commands.rs         ← 原生 API 代理（dialog, clipboard 等）
│   ├── binaries/               ← pkg 打包的 sidecar 執行檔
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── src/
│   ├── main/                   ← 現有 Node.js 後端，改造為 HTTP server
│   │   ├── server.ts           ← 新增：Fastify HTTP server 入口
│   │   ├── routes/             ← 新增：從 ipc-handlers 轉換的 HTTP routes
│   │   ├── ipc-handlers/       ← 保留作為參考，逐步遷移到 routes/
│   │   ├── libs/clients/       ← 不改：BaseClient + 4 個 DB driver
│   │   └── workers/            ← 不改：export/import worker
│   │
│   ├── renderer/               ← 現有 Vue 3 前端
│   │   ├── ipc-api/            ← 改造：ipcRenderer → fetch/WebSocket
│   │   ├── stores/             ← 改造：electron-store → Tauri fs plugin
│   │   ├── components/         ← 小改：移除 @electron/remote 用法
│   │   └── composables/        ← 不改
│   │
│   └── common/                 ← 不改：共用介面和工具
│
├── vite.config.ts              ← 新增：取代 webpack.renderer.config.js
├── package.json                ← 更新依賴
└── index.html                  ← 新增：Vite 入口 HTML
```

### Communication Flow

```
Vue 3 WebView ◄── fetch/WebSocket ──► Node.js Fastify Server (sidecar)
     │                                        │
     │                                        ├── MySQLClient (mysql2)
     │                                        ├── PostgreSQLClient (pg)
     │                                        ├── SQLiteClient (better-sqlite3)
     │                                        └── FirebirdSQLClient (node-firebird)
     │
     └── @tauri-apps/api ──► Tauri Rust Core
                                  │
                                  ├── Window management
                                  ├── File dialogs
                                  ├── Clipboard
                                  ├── Auto-updater
                                  └── Sidecar lifecycle
```

---

## Node.js Sidecar (HTTP Server)

### Technology

*   **Framework:** Fastify (lightweight, TypeScript-native, schema validation)
*   **Port:** Dynamic (find free port at startup, report to Tauri via stdout)
*   **Packaging:** `pkg` to compile into standalone executable (includes Node 20 runtime + native addons)

### IPC → HTTP Route Mapping

87 IPC handlers map to HTTP routes:

| Route Prefix | Source Handler | Endpoints | Method |
| --- | --- | --- | --- |
| `POST /api/connection/*` | connection.ts | 5 | connect, disconnect, test, check, abort |
| `POST /api/schema/*` | schema.ts | 21 | DDL, raw-query, collations, export, import |
| `POST /api/tables/*` | tables.ts | 17 | CRUD, data, indexes, DDL, fake rows |
| `POST /api/views/*` | views.ts | 8 | including materialized views |
| `POST /api/routines/*` | routines.ts | 4 | stored procedures |
| `POST /api/functions/*` | functions.ts | 6 | UDF + trigger functions |
| `POST /api/triggers/*` | triggers.ts | 5 | trigger CRUD |
| `POST /api/schedulers/*` | schedulers.ts | 5 | event schedulers |
| `POST /api/databases/*` | database.ts | 1 | list databases |
| `POST /api/users/*` | users.ts | 1 | list users |
| `POST /api/app/*` | application.ts | 4 | file I/O, shortcuts (dialog moved to Tauri) |

All routes use POST with JSON body. Responses are JSON.

### Connection Management

```typescript
class ConnectionManager {
  private clients: Map<string, BaseClient>;  // connId → client instance

  getClient(connId: string): BaseClient;
  connect(params: ConnectionParams): string;  // returns connId
  disconnect(connId: string): void;
  destroyAll(): void;                         // cleanup on shutdown
}
```

Existing `ClientsFactory` is reused to create the correct driver instance.

### WebSocket Channels

For streaming/progress operations:

| Channel | Purpose | Original Mechanism |
| --- | --- | --- |
| `ws://localhost:{port}/ws/export` | Export progress & completion | Worker `parentPort.postMessage` |
| `ws://localhost:{port}/ws/import` | Import progress & completion | Worker `parentPort.postMessage` |
| `ws://localhost:{port}/ws/query` | Long query partial results | `ipcMain.reply` streaming |

### Health Check

`GET /health` → `{ status: "ok", port: number }`

Used by Tauri Rust side to confirm sidecar is ready before loading the frontend.

### Startup Protocol

1.  Tauri spawns sidecar executable
2.  Sidecar finds a free port, starts Fastify, prints `READY:{port}` to stdout
3.  Tauri reads stdout, captures port number
4.  Tauri emits `sidecar-ready` event with port to frontend
5.  Frontend stores port and initializes API client

---

## Frontend Changes

### IPC API Layer Replacement

All 11 modules in `src/renderer/ipc-api/` change from `ipcRenderer.invoke` to `fetch`:

```typescript
// src/renderer/ipc-api/httpClient.ts (new utility)
const BASE_URL = ref('');  // set when sidecar-ready event fires

export async function apiCall<T>(path: string, params?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL.value}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: params ? JSON.stringify(params) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

Each ipc-api module becomes a thin wrapper:

```typescript
// Tables.ts — before
export function getTableData(params) {
  return ipcRenderer.invoke('get-table-data', unproxify(params));
}

// Tables.ts — after
export function getTableData(params) {
  return apiCall('/api/tables/data', params);
}
```

### Pinia Store Persistence Replacement

Replace `electron-store` with Tauri fs plugin:

```typescript
// src/renderer/libs/persistStore.ts (new utility)
import { BaseDirectory, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

export async function loadStore<T>(name: string, defaults: T): Promise<T> {
  try {
    const text = await readTextFile(`${name}.json`, { baseDir: BaseDirectory.AppData });
    return { ...defaults, ...JSON.parse(text) };
  } catch {
    return defaults;
  }
}

export async function saveStore(name: string, data: unknown): Promise<void> {
  await writeTextFile(`${name}.json`, JSON.stringify(data, null, 2),
    { baseDir: BaseDirectory.AppData });
}
```

Store mapping:

| electron-store name | New file | Stores using it |
| --- | --- | --- |
| `settings` | `settings.json` | application, settings |
| `connections` | `connections.json` | connections (passwords encrypted by sidecar) |
| `tabs` | `tabs.json` | workspaces |
| `history` | `history.json` | history |
| `notes` | `notes.json` | scratchpad |
| `shortcuts` | `shortcuts.json` | settings |

### Electron API Replacement (Renderer)

| Original | Files | Tauri Replacement |
| --- | --- | --- |
| `@electron/remote.getCurrentWindow()` | 11 files | `getCurrentWindow()` from `@tauri-apps/api/window` |
| `@electron/remote.Menu.popup()` | context menus | `@tauri-apps/api/menu` |
| `ipcRenderer.send('close-app')` | title bar | `getCurrentWindow().close()` |
| `process.platform` | 5+ files | `platform()` from `@tauri-apps/plugin-os` |
| `process.env.NODE_ENV` | debug console | `import.meta.env.MODE` |
| `process.env.PACKAGE_VERSION` | about dialog | `import.meta.env.PACKAGE_VERSION` (Vite define) |

### Encryption (safeStorage Replacement)

Connection passwords are encrypted/decrypted by the Node.js sidecar using `crypto.createCipheriv`. The sidecar generates and stores a machine-specific key on first run (in AppData). Frontend never sees plaintext passwords — only passes connId.

---

## Tauri Rust Side

### Responsibilities

The Rust side is intentionally thin:

1.  **Sidecar lifecycle** — spawn, health check, kill
2.  **Window management** — state persistence, title bar overlay
3.  **Native API proxy** — file dialogs, clipboard, OS info
4.  **Auto-updater** — Tauri updater plugin

### Plugins

| Plugin | Purpose | Replaces |
| --- | --- | --- |
| `tauri-plugin-dialog` | File open/save dialogs | `electron.dialog` |
| `tauri-plugin-fs` | Persistent JSON storage | `electron-store` |
| `tauri-plugin-shell` | Sidecar spawning | N/A (Electron IS Node) |
| `tauri-plugin-window-state` | Window position/size | `electron-window-state` |
| `tauri-plugin-updater` | Auto-update | `electron-updater` |
| `tauri-plugin-os` | OS info | `process.platform` |
| `tauri-plugin-global-shortcut` | Keyboard shortcuts | `electron.globalShortcut` |
| `tauri-plugin-clipboard-manager` | Clipboard | `electron.clipboard` |

### tauri.conf.json

```
{
  "productName": "Antares SQL",
  "version": "0.8.0",
  "identifier": "com.fabio286.antares",
  "build": {
    "beforeDevCommand": "npm run vite:dev",
    "devUrl": "http://localhost:5173",
    "beforeBuildCommand": "npm run vite:build",
    "frontendDist": "dist"
  },
  "bundle": {
    "active": true,
    "targets": ["nsis", "msi"],
    "externalBin": ["binaries/antares-server"],
    "icon": ["assets/icon.ico", "assets/icon.png"]
  },
  "app": {
    "windows": [{
      "title": "Antares SQL",
      "width": 1024,
      "height": 800,
      "minWidth": 900,
      "minHeight": 550,
      "decorations": true,
      "titleBarStyle": "Overlay"
    }],
    "security": {
      "csp": "default-src 'self'; connect-src 'self' http://localhost:* ws://localhost:*; img-src 'self' data:; style-src 'self' 'unsafe-inline'"
    }
  }
}
```

---

## Build System

### Development

```
# Terminal 1: Node sidecar (dev mode with hot reload)
npm run sidecar:dev
# → npx tsx watch src/main/server.ts --port 5555

# Terminal 2: Tauri + Vite (frontend HMR)
npm run tauri:dev
# → cargo tauri dev (auto-runs vite:dev)
```

### Production Build

```
npm run tauri:build
# Executes:
# 1. esbuild src/main/server.ts → sidecar/bundle.js
# 2. pkg sidecar/bundle.js → src-tauri/binaries/antares-server-{target}.exe
# 3. vite build → dist/
# 4. cargo tauri build → installer (.msi/.exe)
```

### package.json Scripts

```
{
  "scripts": {
    "vite:dev": "vite",
    "vite:build": "vite build",
    "sidecar:dev": "tsx watch src/main/server.ts --port 5555",
    "build:sidecar": "esbuild src/main/server.ts --bundle --platform=node --outfile=sidecar/bundle.js && pkg sidecar/bundle.js -t node20-win-x64 -o src-tauri/binaries/antares-server-x86_64-pc-windows-msvc.exe",
    "tauri:dev": "cargo tauri dev",
    "tauri:build": "npm run build:sidecar && cargo tauri build",
    "lint": "eslint . --ext .js,.ts,.vue",
    "lint:fix": "eslint . --ext .js,.ts,.vue --fix"
  }
}
```

### Files to Remove

| File/Dir | Reason |
| --- | --- |
| `webpack.main.config.js` | Replaced by esbuild for sidecar |
| `webpack.renderer.config.js` | Replaced by Vite |
| `webpack.workers.config.js` | Workers bundled into sidecar |
| `scripts/devRunner.js` | Replaced by `cargo tauri dev` |
| `scripts/devtoolsInstaller.js` | Tauri uses browser DevTools |
| `electron-builder` config in `package.json` | Replaced by `tauri.conf.json` |

### Dependencies to Remove

```
electron, @electron/remote, electron-store, electron-updater,
electron-window-state, electron-builder, electron-log
```

### Dependencies to Add

```
@tauri-apps/api, @tauri-apps/cli,
@tauri-apps/plugin-dialog, @tauri-apps/plugin-fs,
@tauri-apps/plugin-shell, @tauri-apps/plugin-window-state,
@tauri-apps/plugin-updater, @tauri-apps/plugin-os,
@tauri-apps/plugin-global-shortcut, @tauri-apps/plugin-clipboard-manager,
fastify, vite, @vitejs/plugin-vue
```

---

## Expected Output Size

| Component | Size |
| --- | --- |
| Tauri shell (Rust + WebView2) | ~3 MB |
| Vite frontend bundle | ~10 MB |
| Node sidecar (pkg) | ~55 MB |
| **Total installer** | **~68 MB** |

Compared to Electron version (~150 MB+), this is roughly 55% smaller. The main bulk is the Node sidecar; future Rust rewrites of DB drivers would reduce this further.

---

## Migration Scope Summary

| Layer | Change Level | Description |
| --- | --- | --- |
| DB Clients (BaseClient + 4 drivers + new SQL Server) | Low-Medium | Reused as-is; add SQLServerClient (~1,500 lines) |
| Workers (export/import) | None | Reused inside sidecar |
| Common interfaces | None | Shared between sidecar and frontend |
| Node IPC handlers → HTTP routes | Medium | Mechanical conversion (ipcMain.handle → fastify.post) |
| Renderer IPC API | Medium | ipcRenderer.invoke → fetch (11 modules) |
| Pinia stores | Medium | electron-store → Tauri fs plugin (6 stores) |
| Vue components | Low | Remove @electron/remote (11 files), process.platform (5 files) |
| Build system | High | Webpack → Vite + esbuild + Cargo |
| Tauri Rust side | New | ~200 lines (main.rs + sidecar.rs + commands.rs) |

---

## SQL Server Support (New)

Add SQL Server as the 5th supported database, using the `mssql` npm package (wraps `tedious`).

### New Files

| File | Lines (est.) | Description |
| --- | --- | --- |
| `src/main/libs/clients/SQLServerClient.ts` | ~1,500 | BaseClient implementation for SQL Server |
| `src/common/data-types/sqlserver.ts` | ~100 | Type definitions (int, nvarchar, datetime2, uniqueidentifier, etc.) |
| `src/common/customizations/sqlserver.ts` | ~50 | Feature flags (schemas=true, events=false, etc.) |

### Frontend Changes

*   Connection form: add SQL Server option (driver selection dropdown)
*   Connection params: support Windows Auth + SQL Auth
*   Icon: add SQL Server icon to `src/renderer/images/`

### SQL Server-Specific Considerations

*   Schema support: `dbo` as default, multi-schema via `sys.schemas`
*   Catalog queries: `sys.tables`, `sys.columns`, `sys.indexes`, `INFORMATION_SCHEMA`
*   DDL: T-SQL syntax differences (e.g., `ALTER TABLE ... ADD` vs `ALTER TABLE ... ADD COLUMN`)
*   Identity: `SCOPE_IDENTITY()` for auto-increment
*   `nvarchar(max)` has Length = -1, must be handled
*   `MS_Description` extended properties for column comments

### New Dependency

```
mssql (npm package, wraps tedious — pure JavaScript, no native addon)
```

---

## Out of Scope

*   Upgrading TypeScript version
*   Replacing spectre.css
*   UI redesign
*   Performance optimization
*   Adding features beyond SQL Server support

These may be addressed in follow-up iterations after the migration is stable.