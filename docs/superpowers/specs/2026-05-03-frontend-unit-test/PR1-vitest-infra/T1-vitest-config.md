# T1 — Vitest 基礎建設

**對應 PR**：PR1
**前置**：T0（`web/` 改名完成）
**後置阻擋**：T2 / T3 sample / 所有後續測試
**風險等級**：低（純 dev infra，build / 既有功能不受影響）

## 執行配置（**啟動前必讀**）

| 項目 | 值 |
|------|-----|
| 主 skill | `superpowers:executing-plans` |
| 副 skill | — |
| 模型 | **Opus 4.7** |
| Worktree | **禁用** |
| 並行 subagent | 否 |
| 詳細政策 | 見 [README 全域執行政策](../../README.md) |

## 動作摘要

安裝 vitest + 相關 dev deps，新增 root `vitest.config.ts`（重用 vite alias），加 5 個 `package.json` script。

## 觸碰檔案清單

### 新增
- `vitest.config.ts`（root）

### 修改
- `package.json`（dev deps + scripts）
- `tsconfig.json`（include 加 vitest.config.ts）

### 不變
- 任何 source code

## 具體內容

### 1. 安裝 dev dependencies

```bash
pnpm add -D vitest @vitest/coverage-v8 @vue/test-utils happy-dom @pinia/testing
```

| Package | 用途 |
|---------|------|
| `vitest` | test runner |
| `@vitest/coverage-v8` | V8 coverage instrumentation（業界標準）|
| `@vue/test-utils` | Vue 元件 mount + interaction helper |
| `happy-dom` | DOM 環境（比 jsdom 快 ~3x）|
| `@pinia/testing` | `createTestingPinia` helper |

### 2. 新增 `vitest.config.ts`（完整內容）

```ts
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig, mergeConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
   plugins: [vue()],
   resolve: {
      alias: {
         '@': path.resolve(__dirname, 'web/renderer'),
         common: path.resolve(__dirname, 'web/common'),
         '@tests': path.resolve(__dirname, 'tests')
      }
   },
   define: {
      __VUE_OPTIONS_API__: true,
      __VUE_PROD_DEVTOOLS__: false,
      __VUE_I18N_LEGACY_API__: false,
      __VUE_I18N_FULL_INSTALL__: false,
      __INTLIFY_PROD_DEVTOOLS__: false,
      'import.meta.env.VITE_APP_VERSION': JSON.stringify('test'),
      'import.meta.env.VITE_APP_CONTRIBUTORS': JSON.stringify('')
   },
   test: {
      environment: 'happy-dom',
      globals: true,
      include: ['web/**/*.test.ts', 'tests/**/*.test.ts'],
      setupFiles: ['tests/setup.ts'],
      coverage: {
         provider: 'v8',
         reporter: ['text', 'html', 'lcov', 'json-summary'],
         reportsDirectory: 'coverage',
         include: ['web/**/*.{ts,vue}'],
         exclude: [
            'web/**/*.test.ts',
            'web/**/*.d.ts',
            'web/renderer/scss/**',
            'web/renderer/images/**',
            'web/renderer/untyped.d.ts',
            'web/renderer/components/TheSpecSnapInspector.vue',
            'web/main/**',
            'web/renderer/libs/ext-language_tools.js',
            'tests/.generated/**',
            'e2e/**',
            'src-tauri/**',
            'sidecar/**',
            'workers/**',
            'scripts/**',
            'docs/**'
         ],
         thresholds: {
            lines: 60,
            branches: 60,
            functions: 60,
            statements: 60
         }
      }
   }
});
```

**設計重點**：
- `extend.config` 不從 vite.config.ts 直接 import：vite.config.ts 帶 `sidecarPlugin`，會在每次 vitest 跑時 spawn 一份 sidecar，浪費資源且 port 衝突。手動複製 alias / define 即可。
- `__VUE_I18N_LEGACY_API__: false` —— vitest 不需要 legacy API；T2 全域 mock i18n。
- `coverage.exclude` 把 `web/main/`（Node sidecar）整個排除，因為本計畫不測 sidecar。
- `coverage.include` 限定 `web/**/*.{ts,vue}` 防止 coverage 飛掃 node_modules。
- `thresholds` 是 vitest 內建 hard gate（60% 全域），是 T16 自寫腳本之外的第二道防線；任一指標 < 60% 直接 `pnpm test:coverage` exit code ≠ 0。

### 3. 修改 `package.json` scripts

```diff
   "scripts": {
     "vite:dev": "vite",
     "vite:build": "vite build",
     "sidecar:dev": "tsx watch web/main/server.ts --port 5555",
     "sidecar:build": "node scripts/build-sidecar.mjs",
     "tauri:dev": "tauri dev",
     "tauri:build": "node scripts/tauri-build.mjs",
+    "test:unit": "vitest",
+    "test:unit:watch": "vitest watch",
+    "test:unit:run": "vitest run",
+    "test:coverage": "vitest run --coverage",
+    "test:coverage:check": "node scripts/check-coverage.mjs",
     "lint": "eslint . --ext .js,.ts,.vue && stylelint \"./web/**/*.{css,scss,sass,vue}\"",
     "test:e2e": "npx playwright test",
```

### 4. 修改 `tsconfig.json`

```diff
 {
   "include": [
     "./web/renderer/**/*",
     "./web/common/**/*",
-    "./web/main/**/*"
+    "./web/main/**/*",
+    "./vitest.config.ts",
+    "./tests/**/*"
   ],
   ...
   "compilerOptions": {
     ...
     "paths": {
       "common/*": ["./web/common/*"],
       "@/*": ["./web/renderer/*"],
+      "@tests/*": ["./tests/*"]
     }
   }
 }
```

理由：
- vitest.config.ts 與 tests/ 內測試需要 type-check（不過會 emit），不加 include 會讓 IDE 紅波浪線
- `@tests/*` paths 對齊 vitest 的 `@tests` alias —— vitest 是 runtime resolver、tsconfig 是 IDE / vue-tsc 的 type-check resolver，**兩處必須同步設定**，否則「runtime 跑得起來但 IDE 紅波浪線 / `pnpm type-check` 爆」

## 驗收命令

```bash
# 1. install 成功
pnpm install
ls node_modules/vitest

# 2. type-check 不爆（vitest types 應該透過 globals: true 載入）
pnpm type-check

# 3. test:unit 跑得起來（即使 0 個測試）
pnpm test:unit:run
# 預期：「No test files found」是合理的，exit code 應為 0 或表示 no-test
# 若 exit code != 0 因為「no test」，加 --passWithNoTests

# 4. test:coverage 跑得起來
pnpm test:coverage
ls coverage/index.html
# 預期：coverage/index.html 存在；因為 0 測試所以 0% coverage，60% threshold 會 fail
# 這是預期行為 —— T3 sample 寫完後就會綠

# 5. test:coverage:check 暫時不會跑成功（scripts/check-coverage.mjs 還沒寫）
# 該 script 在 T16 才寫
```

## 風險與 rollback

### 風險
- **`vitest run` 在 0 測試時 exit 1**：某些 vitest 版本對 0 個測試會 exit 1。若這是 PR1 的 fail point，加 `--passWithNoTests` flag 到 `test:unit:run`。
- **`@pinia/testing` 與既有 `pinia` 版本衝突**：`@pinia/testing` 必須相容於 `pinia@3.x`（CLAUDE.md 顯示 pinia 3.0.4）。`@pinia/testing` 最新版支援 pinia 3。pnpm 安裝時若爆錯加 peer dep override。
- **`coverage.exclude` 漏排某個 generator 產物**：T11/T12 之後會有 `tests/.generated/`，已預先排除；若新增其他 generator 產物要回頭加 exclude。

### Rollback
```bash
# 取消所有 deps + scripts
git revert HEAD
# 或手動：
pnpm remove vitest @vitest/coverage-v8 @vue/test-utils happy-dom @pinia/testing
git checkout -- vitest.config.ts package.json tsconfig.json
rm vitest.config.ts
```

## Out of scope

- 不寫 `tests/setup.ts`（在 T2）
- 不寫任何 .test.ts（在 T3 sample）
- 不寫 `scripts/check-coverage.mjs`（在 T16）
- 不改 CI workflow（在 T17）

## User 批准語法

「**T1 OK**」/「**T1 改成 XXX**」
