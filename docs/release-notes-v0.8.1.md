# Antares2 v0.8.1

第一個正式 release，承襲自 [antares-sql/antares](https://github.com/antares-sql/antares) v0.7.35 (MIT)，徹底遷移到 **Tauri v2 + shadcn-vue + Tailwind v4** 技術棧並完成大量 UI 對齊修復。

---

## 🧱 技術棧重構（Architecture）

- **Electron → Tauri v2**：Rust shell + Node.js sidecar，安裝檔大幅縮小、啟動加速、記憶體佔用降低
- **spectre.css → shadcn-vue + Tailwind v4**：80+ 檔元件遷移到 reka-ui primitives，響應式 token-based theming
- **html font-size**: 從 spectre 強制的 20px 還原到瀏覽器預設 16px（Tailwind rem token 對應正常 px 值）
- **內建 SpecSnap inspector**（@tw199501/specsnap-inspector-vue 0.0.9）：side bar 工具按鈕直接量 DOM，方便 design-vs-code 對齊驗證
- **Build 跨平台**：CI 4 個 platform（Windows / macOS Intel x64 / macOS Apple Silicon / Linux）自動跑 `pnpm tauri:build` 並產 installer

## 🎨 UI 大改（Visual）

- **Dark + Light theme**：完整 navy-glass dark mode + lavender-tinted light mode，Tauri webview 內 `color-scheme` 正確處理 native scrollbar / autofill / form control
- **Brand orange `#FF5000`** 維持為 primary action 色（保存、執行、新增、連線等）
- **🔵 Mode 切換改用 sky blue `#0EA5E9`**：資料/屬性 tabs、A/中 toggle 等 mode 切換按鈕用對比藍，與 primary 動作按鈕視覺分層
- **All toolbar buttons 統一 32px 高度** — 不再有 28 vs 32 的高度不一致
- **Result table cell 文字垂直置中**（`vertical-align: middle` on `display: table-cell`）
- **Result table column header 不再有 `—` 殘影**（spectre `d-invisible` helper 移除後遺症修掉）

## 🐛 重要 Bug 修復

| 問題 | 修法 |
|------|------|
| Routine / Table tab 內容被 tab-strip flex 吞，只佔右半畫面 | Workspace.vue 改 `<template v-if>` 包 tab strip + 內容分離 |
| 視窗右邊有 ~170px 白色空隙（在 viewport > 1536px 看得到）| 拿掉 `#main-content class="container"`（Tailwind container utility 鎖 1536px max-width）|
| 整個 dark theme 露出白色 body（toolbar 工具列、結果表下方）| `#wrapper` 加 `background-color: var(--background)` + `color: var(--foreground)` |
| 下拉選單、Modal、Context menu、Tooltip 在 dark mode 全變白底（reka-ui Portal teleport 到 body 逃出 `theme-dark` scope）| `<html>` 也 mirror `theme-dark` class，所有 portaled 元件繼承 dark token |
| BaseSelect 看不出是下拉選單（沒 chevron）| ComboboxAnchor 加 `<ComboboxTrigger>` 含 `mdiChevronDown` icon，53 個 caller 全受惠 |
| BaseSelect 下拉 panel 寬度不對齊 trigger（`dropdownMatchParent` prop 定義了但沒接線）| 接線到 `--reka-popper-anchor-width` CSS variable |
| Result table sort 0-row 表時 `Object.keys(undefined)` crash | 加 optional chaining guard |
| WorkspaceTabPropsTable Teleport `:to=""` 空字串導致 `querySelector('')` crash | prop default `''` → `null`，`v-if="toolbarTarget"` 短路 |
| 4 個 i18n key path 拼錯（`application.queryAreaPlaceholder` → `database.queryAreaPlaceholder` 等）| 改 + 加 audit script |
| `WorkspaceExploreBarMiscFolderContext` Vue warning：`openCreateMaterializedViewTab` listener fallthrough | 修 emit 名稱 typo（`materializedView` → `materialized-view`）+ 加 `reload` emit 宣告 |
| `BaseConfirmModal` 的 `aria-describedby="undefined"` 落到 fragment-rooted Teleport 上引發兩個 warning | 改用 `<DialogDescription class="sr-only">`（Radix 推薦做法）|
| Database picker 的 comment 跟 picker 並排（應該在下方） | 還原 pre-Phase-2 的垂直直排 |
| Workspace 兩欄 layout 失效（spectre `column / columns col-gapless` 拔掉沒補）| 改用 Tailwind `flex flex-row + flex-1 min-w-0` |
| BaseSelect ComboboxInput 高度 36px 從 32px 容器溢出 2px | `!h-8` override |

## 🛠️ Dev tooling

- **`feat(dev)`: Tauri API browser fallback** — 偵測 `__TAURI_INTERNALS__` 不存在時，`httpClient.getToken()` 回 ''（dev sidecar `--port 5555` 已 skip token 驗證），`TheTitleBar.getCurrentWindow()` 換 no-op stub。**讓 Playwright 可以直接 drive `http://localhost:5173/` 跑全 UI 流程**，不再需要 Tauri 殼測 UI bug。Production Tauri 殼提供 `__TAURI_INTERNALS__`，shim path 永不執行。
- **i18n key audit script** — runtime grep 抓 `t('xxx.yyy')` 對 5 個 locale JSON 檔
- **CI cross-platform build** — Windows job 用 PowerShell 抓 node.exe，macOS/Linux 用 curl，所有 platform 共用 stage-resources script BFS 走 transitive dependency

## 📦 Distribution

- **Windows**: `.msi` (推薦) / `.exe` (NSIS)
- **macOS**: `.dmg` (Intel x64 + Apple Silicon 分別 build)
- **Linux**: `.AppImage` / `.deb` / `.rpm`

App ID: `com.tw199501.antares2`
AppData:
- Windows `%APPDATA%\com.tw199501.antares2\`
- Linux `~/.config/com.tw199501.antares2/`
- macOS `~/Library/Application Support/com.tw199501.antares2/`

## ⚠️ Known Issues

- 12 個 pre-existing TypeScript errors（在 fork 之前就有的型別問題，跟 runtime 行為無關，已 baseline lock）
- SpecSnap inspector 面板 button labels 暫為英文（`Start Inspect / Clear / Copy MD ...`）— 等上游 `@tw199501/specsnap-inspector-vue` 支援 `labels` prop 後接回多語系
- `pencil-new.pen` 設計稿需要 Pencil desktop app 開啟才能透過 MCP 讀取

## 🙏 Credits

Forked from [antares-sql/antares](https://github.com/antares-sql/antares) by Fabio Di Stasio (MIT License). Original project no longer maintained.

Phase 2 UI migration + Tauri v2 port: [@tw199501](https://github.com/TW199501)

---

## English Summary

First public release of **Antares2**, a Tauri v2 + shadcn-vue port of the original Antares SQL client. Highlights:

- **Tauri v2** instead of Electron (smaller installer, lower memory)
- **shadcn-vue + Tailwind v4** UI rewrite (80+ files migrated, full dark mode)
- **MySQL / MariaDB / PostgreSQL / SQLite / Firebird SQL / SQL Server** all supported
- Embedded **SpecSnap DOM inspector** for design-spec verification
- Cross-platform CI (Windows / macOS Intel + Apple Silicon / Linux)

This release closes the post-ship UI alignment cycle with 11 targeted CSS / layout fixes — see commit history for full details.
