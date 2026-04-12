# Plan: 建立 src-tauri/.cargo/config.toml 關閉增量編譯

## Context

Rust 增量編譯在 Windows 上會出現 `error finalizing incremental compilation session directory: 存取被拒 (os error 5)` 警告，原因是 Windows 檔案鎖定機制導致暫存目錄無法清理。關閉增量編譯可消除此警告，代價是每次 debug build 略慢。

## 唯一步驟

建立 `src-tauri/.cargo/config.toml`，內容如下：

```toml
[profile.dev]
incremental = false
```

**驗證：** 執行 `pnpm tauri:dev`，確認不再出現 `error finalizing incremental compilation session directory` 警告。
