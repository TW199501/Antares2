# Antares2 v0.8.4

「**發版工具齊備 + macOS/Linux 真的能 build + Settings 對話框 a11y 補完**」三件大事的 release。從這版開始 release flow 一條 `pnpm release patch` 命令搞定，CI 自動 public Release 不再需要手點 Publish。

---

## ✨ Features

- **`pnpm release <version>` 一條命令發版** — 自動 bump 4 個版本檔（`package.json` / `Cargo.toml` / `Cargo.lock` 的 antares2 entry / `tauri.conf.json`）、從 `git log v_prev..HEAD` 產 release notes 骨架、commit、annotated tag、推 origin。`patch` / `minor` / `major` 自動算，也接顯式 `0.9.0`，附 `--dry-run` / `--no-push` 開關。從此**不要手動編輯 4 個版本檔**。
- **Settings 對話框 rebrand + Changelog tab + 全 modal 加 DialogDescription** — 視覺上 logo / Switch 對比度更新；Reka-ui 的 Dialog a11y 警告（`Missing Description or aria-describedby="undefined"`）在 4 個 ModalSettings* 子 dialog 都補上 `<DialogDescription class="sr-only">`，同 v0.8.1 BaseConfirmModal 的修法。
- **Tauri auto-updater foundation** — `tauri-plugin-updater` 安裝、`updater:default` + `process:allow-restart` capability、release.yml 4 job 都接 `TAURI_SIGNING_PRIVATE_KEY` env 簽章。Plugin 暫時不啟用（避免沒 keypair 時 panic），啟用程序在 CLAUDE.md 寫得很清楚 — 下次想開只要 6 步。

## 🐛 Bug fixes

- **`icons/icon.icns` 補齊** — 從 v0.8.1 起 `bundle.icon` 引用了這個檔但從沒 commit 進 repo。v0.8.1 / v0.8.2 build 沒撞到是因為 build 在 timeout / queue 死掉、根本沒走到 bundle 步；v0.8.3 是第一個跑完 build 的 release，才暴露 `Failed to create app icon: resource path 'icons/icon.icns' doesn't exist`。**v0.8.4 是第一個 macOS / Linux artifacts 真的會產出來的版本**。
- **release.yml 三個歷史 trap 一次掃完**：
  1. workflow level 加 `permissions: contents: write`（不然 `ncipollo/release-action` 撞 HTTP 403 *Resource not accessible by integration*，因為 GitHub 從 2023 起 `GITHUB_TOKEN` 預設只有 `contents: read`）
  2. `draft: false` + `bodyFile: docs/release-notes-${{ github.ref_name }}.md` + `omitBodyDuringUpdate: true` —  Release 從 first job 上傳完成那刻起就是 public，描述用手寫的 release notes 檔
  3. `generateReleaseNotes: true` 拿掉（API 也要 `contents: write`，且我們有手寫稿，不需要 GitHub 自動 PR-based 摘要）

## 🔧 Refactor

- 上一個 phase 從 v0.8.3 帶過來的 shadcn-vue Phase 2 收尾（accordion primitive 從 0 caller 變 1，schema explore tree 8 個 `<details class="accordion">` 全部換成 reka-ui `<Accordion>`）已在 v0.8.3 上線；本版只有後續的 a11y 補強。

## 📝 Documentation

- **CLAUDE.md 新增 `### Release process` 段**，把發版流程（從 `pnpm release patch` 到自動 public Release）寫成單一可掃讀區塊，並把上面 3 個歷史 trap 寫成可比對症狀的 troubleshooting 條目。

## 🧹 Housekeeping

- LF line ending 4 層 enforcement 在 v0.8.3 完成（`.gitattributes` + `.editorconfig` + `.vscode/settings.json files.eol` + `pnpm check:eol`）；本版維持 100% LF (677+ tracked text files)。

## 📦 Distribution

| Platform | Format |
|---|---|
| Windows | `.exe` (NSIS) / `.msi` (推薦) |
| macOS | `.dmg` (Intel x64 + Apple Silicon **本版第一次完整出貨**) |
| Linux | `.AppImage` / `.deb` / `.rpm` |

App ID: `com.tw199501.antares2`。

## ⚠️ 注意

- **首次安裝 macOS 版會跳 Gatekeeper 警告**「來源不明」 — Antares2 沒走 Apple Developer Program 簽章（Apple 那條年費 $99）。繞過方法：右鍵 .app → Open，第一次同意之後就不再問。
- 12 個 pre-existing TypeScript errors 數量 **unchanged**（baseline 鎖定）。
- 內建自動更新（auto-updater）已埋好，但 keypair 還沒啟用 — 升 v0.8.5+ 仍需手動下載。下版會視時間決定要不要正式啟用。

---

## English Summary

Three big things in v0.8.4: tooling for releases is fully wired, macOS/Linux really build now, and Settings dialogs are a11y-clean.

- **`pnpm release <version>`** — single-command release flow. Bumps 4 version files in sync (package.json, Cargo.toml, Cargo.lock antares2 entry, tauri.conf.json), generates release-notes-vX.Y.Z.md skeleton from `git log v_prev..HEAD`, commits, tags, pushes. Stop hand-editing version files.
- **Settings rebrand + a11y** — refreshed logo and Switch contrast; added `<DialogDescription class="sr-only">` to all 4 ModalSettings* sub-dialogs (matches v0.8.1's BaseConfirmModal fix), silencing reka-ui's `aria-describedby="undefined"` warning.
- **`icons/icon.icns` finally in the repo** — was referenced by `bundle.icon` since v0.8.1 but never committed. macOS arm64 + Linux bundle was silently failing for 2 prior releases (masked by earlier build-step timeouts). v0.8.4 is the first release with actual macOS/Linux artifacts.
- **`release.yml` 403 trap fixed** — workflow now has `permissions: contents: write`, drops `generateReleaseNotes`, sets `draft: false` + `bodyFile` so Releases land public on first upload.
- **Tauri auto-updater plumbing** added but kept dormant pending keypair generation; activation is a 6-step procedure documented in `CLAUDE.md`.

No breaking changes; binary upgrade-compatible with v0.8.3.

## 🙏 Credits

Forked from [antares-sql/antares](https://github.com/antares-sql/antares) by Fabio Di Stasio (MIT License).
