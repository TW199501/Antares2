![](https://raw.githubusercontent.com/antares-sql/antares/master/docs/gh-logo.png)

# Antares SQL — 第二代

![GitHub license](https://img.shields.io/github/license/TW199501/Antares2)

[English](./README.md) | **繁體中文**

> \*\*本專案 Fork 自 [antares-sql/antares](https://github.com/antares-sql/antares)\*\*，原作者為 [Fabio Di Stasio](https://github.com/Fabio286)，依 [MIT 授權](./LICENSE) 使用與延伸開發。  
> 感謝原專案及所有貢獻者的努力，本專案在其基礎上持續開發。

## 第二代新增功能

| 項目 | 變更說明 |
| --- | --- |
| **執行框架** | 從 Electron 遷移至 **Tauri v2** — 更小的執行檔、更好的系統整合 |
| **SQL Server** | 完整支援：SSL、唯讀模式、單一連線模式、連線池穩定性修復 |
| **穩定性** | 修復切換資料庫時的競態條件；sidecar 重啟後自動重連 |
| **自動更新** | 以 `tauri-plugin-updater` 取代 electron-updater |

🔗 [最新版下載](https://github.com/TW199501/Antares2/releases/latest) · [原始專案](https://github.com/antares-sql/antares)

---

Antares 是一款以 [Tauri v2](https://tauri.app/) 和 [Vue.js](https://github.com/vuejs/vue) 打造的跨平台 SQL 客戶端，目標是成為永久免費、開放原始碼的開發者工具。  
本 Fork 延續相同精神 — 開放原始碼、MIT 授權、歡迎社群參與。

## 主要功能

*   同時管理多個資料庫連線
*   資料庫管理（新增 / 編輯 / 刪除）
*   完整的資料表管理，包含索引與外鍵
*   視圖、觸發器、預存程序、函數管理（新增 / 編輯 / 刪除）
*   現代化分頁系統，在工作區保持多個分頁開啟
*   假資料填充工具，快速產生測試資料
*   查詢建議與自動完成
*   查詢歷史紀錄（最近 1000 筆）
*   儲存查詢、筆記或待辦事項
*   SSH 通道支援
*   手動 Commit 模式
*   匯入與匯出資料庫備份
*   自訂鍵盤快捷鍵
*   深色與淺色主題
*   多種編輯器主題

## 支援的資料庫

*   MySQL / MariaDB
*   PostgreSQL
*   SQLite
*   Firebird SQL
*   SQL Server（第二代新增完整支援）
*   DuckDB
*   更多...

## 支援的作業系統

#### x64

*   Windows
*   Linux
*   macOS

#### ARM

*   Windows
*   Linux
*   macOS

## 開發指令

```
# 開發模式（同時啟動 Tauri shell + Vite + sidecar）
pnpm tauri:dev

# 正式建置
pnpm tauri:build

# 程式碼檢查
pnpm lint
pnpm lint:fix

# TypeScript 型別檢查
pnpm vue-tsc --noEmit

# E2E 測試（Playwright）
pnpm test:e2e

# 檢查翻譯完整性
pnpm translation:check
```

## 授權

本專案採用 [MIT 授權](./LICENSE)，與原專案相同。

## 貢獻者

感謝原專案 [antares-sql/antares](https://github.com/antares-sql/antares) 的所有貢獻者，完整名單請見 [README.md](./README.md#contributors-)。