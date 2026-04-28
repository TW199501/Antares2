# Plan: Electron → Tauri 遷移收尾 — 清除 TypeScript/ESLint 錯誤

## Context

專案已從 Electron 遷移到 Tauri v2，但留下了多個未完成的 API 橋接點：

*   Electron 特有的 `File.path` 仍被 3 個組件使用（Tauri 無此屬性）
*   `Application.ts` 有 5 個方法被註解掉（IPC → Tauri 未實作）
*   3 個 ESLint 錯誤阻擋乾淨的 CI

目前狀況：`npx vue-tsc --noEmit` 回報 21 個 TypeScript 錯誤，`npm run lint` 回報 3 個 ESLint 錯誤。目標是將兩者降至 0。

---

## Step 1 — 修 ESLint 錯誤（快速清理）

**涉及檔案：**

*   `src/main/routes/tables.ts:420` — else 後缺少 curly braces
*   `src/renderer/index.ts:2` — import 排序
*   `src/renderer/ipc-api/Application.ts:1` — import 排序

**做法：**

1.  `npm run lint:fix` → 自動修復 2 個 import 排序問題
2.  手動修 `tables.ts:420`：`else statement` → `else { statement }`

**驗證：** `npm run lint` 回報 0 errors

---

## Step 2 — 修 File Picker（`File.path` → Tauri dialog）

**問題根因：** `BaseUploadInput.vue` 用原生 `<input type="file">`，父組件從 `event.target.files[0].path` 讀 Electron 特有屬性。

**涉及檔案：**

*   `src/renderer/components/BaseUploadInput.vue` — 核心修改
*   `src/renderer/components/WorkspaceAddConnectionPanel.vue` — 5 個 `@change` 呼叫 + `pathSelection()` 函數（line 616）
*   `src/renderer/components/WorkspaceEditConnectionPanel.vue` — 5 個 `@change` 呼叫 + `pathSelection()` 函數（line 625）
*   `src/renderer/components/FakerSelect.vue` — `filesChange()` 函數（line 195-201）

**做法：**

### 2a. 改 `BaseUploadInput.vue`

*   移除 `<input type="file">` 的 `@change` 事件
*   在 label 的 `@click.prevent` 中呼叫 `tauriOpen()`（`@tauri-apps/plugin-dialog`，已在 `Application.ts` 使用）
*   將 emit 從 `'change': [event: Event]` 改為 `'select': [path: string]`
*   接受 `filters` prop，傳入 `tauriOpen({ filters })`

```
// 新 emit
const emit = defineEmits<{ 'select': [path: string]; 'clear': [] }>();

const handleClick = async (e: MouseEvent) => {
   e.preventDefault();
   const result = await tauriOpen({ filters: props.filters ?? [] });
   if (result && typeof result === 'string') emit('select', result);
};
```

### 2b. 改 Connection Panels（Add + Edit）

*   `pathSelection(event, name)` → `pathSelection(path: string, name: keyof ConnectionParams)`
*   移除 Event 型別，直接 assign：`(connection.value as any)[name] = path`
*   Template：`@change="pathSelection($event, 'x')"` → `@select="pathSelection($event, 'x')"`（5 處）

### 2c. 改 `FakerSelect.vue`

*   移除 `filesChange(event: Event)` 函數
*   改用 `Application.showOpenDialog()` 或直接呼叫 `tauriOpen()`，assign 到 `selectedValue.value`
*   移除或隱藏原有的 `<input type="file">`

**驗證：** 連線面板可正常選擇 SSL cert / SQLite 檔案路徑；檔案路徑正確顯示

---

## Step 3 — 實作缺失的 `Application.ts` 方法

**涉及檔案：**

*   `src/renderer/ipc-api/Application.ts` — 加入 5 個方法
*   `src/renderer/components/ModalExportSchema.vue:517` — 呼叫 `getDownloadPathDirectory()`

**做法：**

### 3a. `getDownloadPathDirectory()`（真實實作）

```
import { downloadDir } from '@tauri-apps/api/path';
// ...
static getDownloadPathDirectory (): Promise<string> {
   return downloadDir();
}
```

無需新增套件，`@tauri-apps/api/path` 已包含在 `@tauri-apps/api@2.10.1`。

### 3b. `closeApp()`（真實實作）

```
import { getCurrentWindow } from '@tauri-apps/api/window';
// ...
static async closeApp () {
   await getCurrentWindow().close();
}
```

### 3c. Shortcut 相關 4 個方法（no-op stubs）

背景：實際按鍵監聽在 renderer 端用 DOM 事件（`KeyPressDetector.vue`），不依賴 Electron global shortcuts。Shortcuts 設定已由 Pinia store 持久化到 localStorage。這 4 個方法只是呼叫 Electron main process 去重新註冊 global shortcuts，Tauri 版本暫時不實作 global shortcuts。

```
static reloadShortcuts (): Promise<void> { return Promise.resolve(); }
static unregisterShortcuts (): Promise<void> { return Promise.resolve(); }
static async updateShortcuts (_shortcuts: ShortcutRecord[]): Promise<void> { /* persisted by settings store */ }
static async restoreDefaultShortcuts (): Promise<void> { /* defaults handled by settings store */ }
```

**驗證：** `ModalExportSchema` 匯出時預設路徑指向系統下載資料夾；關閉 app 正常運作

---

## Step 4 — 修其餘 TypeScript 錯誤

Step 2 & 3 完成後，剩餘 TS 錯誤應只剩 3 個：

| 檔案 | 錯誤 | 修法 |
| --- | --- | --- |
| `ModalEditSchema.vue:143` | `{}.status / {}.response` | 為 `apiCall` 回傳值加型別 `{ status: string; response: string }` |
| `WorkspaceTabTable.vue:350` | always-truthy expression | 讀取該行並移除多餘判斷（值已保證非 undefined） |

**涉及檔案：**

*   `src/renderer/components/ModalEditSchema.vue:143`
*   `src/renderer/components/WorkspaceTabTable.vue:350`

**驗證流程：**

```
npm run lint           # 期望 0 errors
npx vue-tsc --noEmit   # 期望 0 errors
npm run tauri:dev      # 啟動 app，確認功能正常
```

功能測試清單：

*   新增 SQLite 連線 → 可選擇 `.db` 檔案路徑
*   新增 MySQL 連線 → SSL cert 欄位可選擇檔案
*   ModalExportSchema → 匯出時預設路徑為下載資料夾
*   Settings → Shortcuts 頁面可開啟（不 crash）
*   輸入框 focus/blur 不 throw runtime error

---

## 注意事項

*   `ShortcutRegister.ts` 整個檔案都是 Electron 專用（import `BrowserWindow`, `globalShortcut`, `Menu` from 'electron'）。本次計劃**不動這個檔案**。若未來要實作 Tauri global shortcuts，需要用 Rust command + `tauri-plugin-global-shortcut`，這是獨立的 feature。
*   `BaseUploadInput` 的 emit 介面改變會 breaking change，但全域搜尋確認只有 3 個組件使用此組件，範圍可控。