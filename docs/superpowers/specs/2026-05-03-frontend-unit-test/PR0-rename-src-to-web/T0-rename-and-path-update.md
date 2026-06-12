# T0 — `src/` → `web/` 改名與路徑同步

**對應 PR**：PR0
**前置**：無（最先執行）
**後置阻擋**：所有後續 PR 都依賴本 PR
**風險等級**：**中**（路徑改動面廣，但 `src-tauri/` 完全不動所以 Tauri build chain 風險低）

## 執行配置（**啟動前必讀**）

| 項目 | 值 |
|------|-----|
| 主 skill | `superpowers:executing-plans` |
| 副 skill | — |
| 模型 | **Opus 4.7**（`claude-opus-4-7`） |
| Worktree | **禁用**（single-file edits + HMR） |
| 並行 subagent | 否 |
| 詳細政策 | 見 [README 全域執行政策](../../README.md) |

## 動作摘要

把前端目錄 `src/` 改名為 `web/`，所有對 `src/main/`、`src/renderer/`、`src/common/` 的路徑引用同步替換。**`src-tauri/` 完全不動**（Tauri v2 官方慣例）。

## 觸碰檔案清單

### 移動
- `git mv src web`（含子目錄 `src/main/`、`src/renderer/`、`src/common/` 全部）

### 修改（10 類）

| 檔 | 變更 |
|----|------|
| `vite.config.ts` | alias path、sidecarPlugin spawn 參數 |
| `tsconfig.json` | `paths`、`include`、`exclude` |
| `package.json` | `sidecar:dev`、`lint`、`lint:fix` script glob |
| `scripts/build-sidecar.mjs` | esbuild entry path |
| `scripts/checkTauriMigration.js` + `.ts` | grep 目標 |
| `scripts/translationCheck.ts` | locale 目錄路徑 |
| `scripts/check-eol.mjs` | 掃描範圍 |
| `.github/workflows/*.yml`（5 檔） | `paths:` filter |
| `.gitignore` / `.editorconfig` / `.gitattributes` | path glob |
| `CLAUDE.md` | 文件描述路徑 |

### 不變
- `src-tauri/` 全部（Cargo.toml、tauri.conf.json + 3 平台 conf、src/*.rs、capabilities/、icons/、resources/）
- `scripts/stage-resources.mjs`、`scripts/tauri-build.mjs`、`scripts/build-msi.mjs`、`scripts/release.mjs`（都只動 `src-tauri/`）
- `playwright.config.ts`（`testDir: './e2e'` 不變）
- `sidecar/`、`workers/`（build artifacts）

## 具體 diff

### 1. `vite.config.ts`

```diff
@@ sidecarPlugin function @@
   function startSidecar () {
-     sidecar = spawn('npx', ['tsx', 'src/main/server.ts', '--port', '5555'], {
+     sidecar = spawn('npx', ['tsx', 'web/main/server.ts', '--port', '5555'], {
        shell: true,

@@ resolve.alias @@
    resolve: {
       alias: {
-         '@': path.resolve(__dirname, 'src/renderer'),
-         common: path.resolve(__dirname, 'src/common'),
+         '@': path.resolve(__dirname, 'web/renderer'),
+         common: path.resolve(__dirname, 'web/common'),
          '~spectre.css': path.resolve(__dirname, 'node_modules/spectre.css'),
```

> SCSS `additionalData: '@import "@/scss/_variables.scss";'` **不需要改** —— 它走 `@/` alias，alias 已指向新位置自動解析。

### 2. `tsconfig.json`

```diff
 {
   "include": [
-    "./src/renderer/**/*",
-    "./src/common/**/*",
-    "./src/main/**/*"
+    "./web/renderer/**/*",
+    "./web/common/**/*",
+    "./web/main/**/*"
   ],
   "exclude": [
-    "./src/renderer/libs/ext-language_tools.js",
-    "./src/main/ipc-handlers/**/*"
+    "./web/renderer/libs/ext-language_tools.js",
+    "./web/main/ipc-handlers/**/*"
   ],
   "compilerOptions": {
     ...
     "paths": {
-      "common/*": ["./src/common/*"],
-      "@/*": ["./src/renderer/*"],
+      "common/*": ["./web/common/*"],
+      "@/*": ["./web/renderer/*"],
     }
   }
 }
```

### 3. `package.json`

```diff
   "scripts": {
     "vite:dev": "vite",
     "vite:build": "vite build",
-    "sidecar:dev": "tsx watch src/main/server.ts --port 5555",
+    "sidecar:dev": "tsx watch web/main/server.ts --port 5555",
     "sidecar:build": "node scripts/build-sidecar.mjs",
     "tauri:dev": "tauri dev",
     "tauri:build": "node scripts/tauri-build.mjs",
-    "lint": "eslint . --ext .js,.ts,.vue && stylelint \"./src/**/*.{css,scss,sass,vue}\"",
-    "lint:fix": "eslint . --ext .js,.ts,.vue --fix && stylelint \"./src/**/*.{css,scss,sass,vue}\" --fix",
+    "lint": "eslint . --ext .js,.ts,.vue && stylelint \"./web/**/*.{css,scss,sass,vue}\"",
+    "lint:fix": "eslint . --ext .js,.ts,.vue --fix && stylelint \"./web/**/*.{css,scss,sass,vue}\" --fix",
     "type-check": "vue-tsc --noEmit",
```

### 4. `scripts/build-sidecar.mjs`

需要把 `src/main/server.ts`、`src/main/workers/exporter.ts`、`src/main/workers/importer.ts` 等 esbuild entry path 改成 `web/main/...`。具體 diff 待 read 後給。

### 5. `scripts/checkTauriMigration.js` 與 `.ts`

兩個檔同名不同副檔名（`.js` 與 `.ts`），grep 內 `src/renderer`、`src/main` 字串需要改成 `web/renderer`、`web/main`。具體 diff 待 read 後給。

### 6. `scripts/translationCheck.ts`

locale 目錄 `src/renderer/i18n/` → `web/renderer/i18n/`。

### 7. `scripts/check-eol.mjs`

掃描範圍若含 `src/` 改 `web/`。

### 8. `.github/workflows/*.yml`（5 檔）

對 `test-build.yml`、`release.yml`、`test-e2e-win.yml`、`codeql-analysis.yml`、`create-generated-sources.yml` 各檔搜 `src/` 字串：
- `paths:` filter 內 `src/**` → `web/**`
- 任何 `working-directory: src` → `working-directory: web`（如有）
- **不變**：`Download Node.js binary` 步驟寫入 `sidecar/`（不是 `src/`）

### 9. `.gitignore` / `.editorconfig` / `.gitattributes`

只動 `src/main/`、`src/renderer/`、`src/common/` glob；`src-tauri/target/` 不變。

### 10. `CLAUDE.md`

全文搜 `src/main/`、`src/renderer/`、`src/common/` 全替換為 `web/main/`、`web/renderer/`、`web/common/`。`src-tauri/` 提及全部不變。預估改動量：數十處。

### 11. `docs/superpowers/{plans,rules}/*.md`、`docs/ui-spec.md`

歷史 plan / rule 文件內若引用 `src/main/`、`src/renderer/`、`src/common/` 同步替換。**注意**：歷史文件描述當時的事實狀態，部分可能保留原樣作為 historical record；review 時逐檔判斷。

## 驗收命令（依序跑、全部需綠）

```bash
# 1. install 不應該變（lock 不動）
pnpm install

# 2. sidecar 能 build（驗證 build-sidecar.mjs 路徑正確）
pnpm sidecar:build
ls sidecar/antares-server.cjs

# 3. type-check 沒新增 error（已知 12 個 pre-existing 不算）
pnpm type-check

# 4. lint 跑得起來（驗證 stylelint glob 正確）
pnpm lint

# 5. tauri:dev 三層活（前端 + sidecar + Rust 殼）
pnpm tauri:dev
# 手動驗：app 啟動、可看到 main window、ribbon 渲染

# 6. tauri:build 產 NSIS / MSI（**最高風險驗收**）
pnpm tauri:build
ls src-tauri/target/release/bundle/nsis/*.exe
ls src-tauri/target/release/bundle/msi/*.msi

# 7. 既有 e2e 不爆
pnpm vite:dev &
pnpm test:e2e

# 8. push dev、CI 4 build job 全綠
git push origin dev
# 等 CI run 完成
gh run list --branch dev --limit 1
```

## 風險與 rollback

### 風險
- **stylelint glob 漏改**：若 `package.json` 的 `lint` script 還寫 `./src/**/*.{css,scss,sass,vue}`，stylelint 會 0 命中，`pnpm lint` 看似綠但其實沒掃到。**驗收**：故意在 `web/renderer/scss/main.scss` 加一個故意違規樣式，跑 `pnpm lint` 確認 stylelint 抓到。
- **vite scss `@import "@/scss/..."` 失效**：alias `@/` 指向變了 `web/renderer/`，`@import "@/scss/_variables.scss"` 仍應正確解析，但若 alias 設定有 typo 會全站 SCSS 編譯失敗。**驗收**：`pnpm vite:dev` 開後看 console 沒有 SCSS warning。
- **Rust 殼引用過時 path**：理論上 `src-tauri/src/sidecar.rs` 不引用 `src/main/`（只引用 staged 的 cjs），但若有意外 import 會在 cargo build 時爆。**驗收**：`pnpm tauri:dev` 跑得起來。
- **CI workflow paths filter 漏改**：`paths: ['src/**']` 沒改成 `paths: ['web/**']` 會讓 push 不觸發 CI。**驗收**：push dev、確認 CI run 出現在 GitHub Actions 頁。
- **CLAUDE.md 描述過時**：CLAUDE.md 改動量大、容易漏，但這只是文件不是 code 不會影響 build。**驗收**：grep CLAUDE.md `src/renderer`、`src/main`、`src/common` 應為 0 命中。

### Rollback

```bash
# 完全還原（git mv 是 atomic 的）
git revert HEAD
# 或者 hard reset 到 PR0 之前
git reset --hard <pre-PR0-sha>
git push origin dev --force-with-lease  # 危險！只在沒 merge 時用
```

PR0 一旦 merge 進 master 不應 force-push 還原；採 follow-up commit 把改錯的單一檔案手動還原。

## Out of scope（明確列出）

- 不重命名 `web/main/` 為 `web/server/` 或其他（過渡期殘留，.NET 上線後刪）
- 不搬 `e2e/` 進 `web/`（Playwright 跑整個 desktop app）
- 不拆 `web/` 為獨立 pnpm package（不放 sub `package.json`）
- 不動 `src-tauri/` 任何檔
- 不動 `scripts/{stage-resources,tauri-build,build-msi,release}.mjs`

## User 批准語法

- 「**T0 OK 開 PR0**」→ Claude 開 PR0，按本 spec 執行
- 「**T0 改成 XXX**」→ Claude 修 spec，等再批准
- 「**PR0 暫緩**」→ Claude 不動，等下一指示
