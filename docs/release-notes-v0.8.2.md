# Antares2 v0.8.2

承襲 v0.8.1 之後的 **docs / housekeeping patch release**，不含任何 source code 或 runtime 行為變更。Binary 跟 v0.8.1 功能上完全相同，只有 metadata（版本字串）不同。

---

## 📝 Documentation

- 補上 **v0.8.1 雙語 release notes**（中英對照），補齊上一版漏掉的 changelog
- **CLAUDE.md** 修正：
  - 新增 `pnpm migrate:appdata` 指令說明（從 upstream `com.fabio286.antares` AppData 一次性複製到 `com.tw199501.antares2`）
  - CI 段落從 "Two workflows" 改成實際的 5 個 workflow：明確標出 `codeql-analysis`（GitHub-managed scan）、`test-e2e-win`（manual dispatch only，不在 merge gate 上）、`create-generated-sources`（upstream legacy）為輔助型，避免日後 agent 誤判它們是 build gate

## 🧹 Housekeeping

- `.gitignore` 補上 AI session 紀錄與 MCP 連線設定的 ignore 規則：
  - `.claude-code-history`
  - `.codex-history/`
  - `.openmcp/`（**`connection.json` 可能含 token / API key — 絕對不能推上 GitHub**）
  - `skills.json`（與既有 ignore 的 `skills-lock.json` 同類）

## 🔢 Versions bumped

| 檔案 | 從 | 到 |
|------|------|------|
| `package.json` | 0.8.1 | 0.8.2 |
| `src-tauri/Cargo.toml` | 0.8.1 | 0.8.2 |
| `src-tauri/Cargo.lock` (`antares2` package) | 0.8.1 | 0.8.2 |
| `src-tauri/tauri.conf.json` | 0.8.1 | 0.8.2 |

## ⚠️ 注意

- **沒有 source code 變更**。如果你是從 0.8.1 升級，*沒有任何* runtime 行為差異。這個 tag 主要是讓 CHANGELOG / release artifact 的版本字串對齊。
- 既存 12 個 pre-existing TypeScript errors 數量 unchanged。
- 既知 SpecSnap inspector panel 仍是英文 label（等上游 `@tw199501/specsnap-inspector-vue` 加 `labels` prop）。

## 📦 Distribution

跟 v0.8.1 完全相同（同樣 4 platform CI build）：

- **Windows**: `.msi` (推薦) / `.exe` (NSIS)
- **macOS**: `.dmg` (Intel x64 + Apple Silicon)
- **Linux**: `.AppImage` / `.deb` / `.rpm`

App ID: `com.tw199501.antares2`

---

## English Summary

Docs / housekeeping patch release on top of v0.8.1. **No source code or runtime changes** — binary is functionally identical to v0.8.1, only the version string differs.

- Added v0.8.1 bilingual release notes (was missing on the previous tag)
- `CLAUDE.md` updated: documents `pnpm migrate:appdata` and the full set of 5 GitHub Actions workflows (only 2 were previously documented; the other 3 are auxiliary — security scan / manual-dispatch e2e / upstream legacy)
- `.gitignore` extended to cover AI tool session dumps (`.codex-history/`, `.openmcp/`, `skills.json`). `.openmcp/connection.json` can carry credentials and must never be committed.

## 🙏 Credits

Forked from [antares-sql/antares](https://github.com/antares-sql/antares) by Fabio Di Stasio (MIT License).
