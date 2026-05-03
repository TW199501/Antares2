# T15 — Playwright smoke 測試 + viewport 設定

**對應 PR**：PR6
**前置**：T1-T14（前端可跑）
**驗收方式**：Claude **必須親自跑** `pnpm test:e2e`，不只寫完交人類

## 執行配置（**啟動前必讀**）

| 項目 | 值 |
|------|-----|
| 主 skill | `superpowers:executing-plans` |
| 副 skill | — |
| 模型 | **Opus 4.7** |
| Worktree | **禁用** |
| 並行 subagent | 否 |
| 詳細政策 | 見 [README 全域執行政策](../../README.md) |

## 範圍

### 新增 5 支 spec（`e2e/`）
| 檔 | 範圍 |
|---|------|
| `app-boot.spec.ts` | app 啟動 → main window 可見 → ribbon 渲染 |
| `settings-modal.spec.ts` | 開設定 → 切分頁 → 改值 → 關 |
| `connection-modal.spec.ts` | 開連線視窗 → 表單渲染 → 取消（不真連 DB） |
| `theme-toggle.spec.ts` | light ↔ dark 切換 → `#wrapper` class 變化 |
| `i18n-locale-switch.spec.ts` | 切 zh-TW / ja-JP → 主畫面文字渲染（key 變實際翻譯） |

### 既有保留（不動）
- `mssql-database-switch.spec.ts`
- `mssql-limit-guards.spec.ts`
- `mssql-empty-table-header.spec.ts`

### 修改
- `playwright.config.ts` 加 viewport

## 觸碰檔案

### 新增
- `e2e/app-boot.spec.ts`
- `e2e/settings-modal.spec.ts`
- `e2e/connection-modal.spec.ts`
- `e2e/theme-toggle.spec.ts`
- `e2e/i18n-locale-switch.spec.ts`

### 修改
- `playwright.config.ts`

## `playwright.config.ts` 修改

```diff
 import { defineConfig } from '@playwright/test';

 export default defineConfig({
   testDir: './e2e',
   timeout: 30_000,
   use: {
     baseURL: 'http://127.0.0.1:5555',
+    viewport: { width: 1920, height: 1200 },
     trace: 'retain-on-failure',
     screenshot: 'only-on-failure'
   },
   webServer: {
     command: 'pnpm vite:dev',
     port: 5173,
     reuseExistingServer: !process.env.CI,
     timeout: 60_000
   }
 });
```

> viewport 1920×1200 對齊 user 螢幕（per memory `feedback_playwright_viewport_match_user.md`）。

## 範例：app-boot.spec.ts

```ts
import { test, expect } from '@playwright/test';

test('app boots with main window visible', async ({ page }) => {
   await page.goto('/');
   // antares 前端 mount 點
   await expect(page.locator('#wrapper')).toBeVisible({ timeout: 10_000 });
   // ribbon / top bar 渲染（依實際 selector，spec 執行時 read App.vue 對齊）
   await expect(page.locator('[data-testid=titlebar]')).toBeVisible();
});

test('no console errors on first paint', async ({ page }) => {
   const errors: string[] = [];
   page.on('console', msg => msg.type() === 'error' && errors.push(msg.text()));
   await page.goto('/');
   await page.waitForLoadState('networkidle');
   expect(errors).toEqual([]);
});
```

## 範例：theme-toggle.spec.ts

```ts
test('theme toggle changes #wrapper class', async ({ page }) => {
   await page.goto('/');
   await expect(page.locator('#wrapper')).toBeVisible();

   const initialClass = await page.locator('#wrapper').getAttribute('class');
   const wasLight = initialClass?.includes('theme-light');

   // 開 settings、切 theme（依實際 UI flow）
   await page.locator('[data-testid=settings-btn]').click();
   await page.locator('[data-testid=theme-toggle]').click();
   await page.locator('[data-testid=settings-close]').click();

   const newClass = await page.locator('#wrapper').getAttribute('class');
   expect(newClass).not.toBe(initialClass);
   if (wasLight) expect(newClass).toContain('theme-dark');
   else expect(newClass).toContain('theme-light');
});
```

## 範例：i18n-locale-switch.spec.ts

```ts
test('switching locale changes UI text', async ({ page }) => {
   await page.goto('/');
   // 找一個一定渲染的 i18n 文字（執行時 read 後選穩定的 selector）
   const titlebarTextEN = await page.locator('[data-testid=titlebar-title]').textContent();

   // 切 zh-TW
   await page.locator('[data-testid=settings-btn]').click();
   await page.locator('[data-testid=locale-select]').selectOption('zh-TW');
   await page.locator('[data-testid=settings-close]').click();

   const titlebarTextZH = await page.locator('[data-testid=titlebar-title]').textContent();
   expect(titlebarTextZH).not.toBe(titlebarTextEN);
   // 確認真的有翻譯（不是空字串）
   expect(titlebarTextZH?.length).toBeGreaterThan(0);
});
```

## Claude 自驗職責（plan 強制要求）

PR6 完成後 Claude **必須親自**：
```bash
pnpm vite:dev &
sleep 3
pnpm test:e2e
```
回報：成功 / 失敗 spec 數、失敗的 trace.zip 路徑、screenshot 路徑。失敗就 diagnose，**不准把測試 skip 掉**。

## 驗收

```bash
# 1. unit test 全綠（前置）
pnpm test:unit:run

# 2. dev server 跑得起來
pnpm vite:dev &
sleep 3
curl -f http://127.0.0.1:5555/health  # sidecar 活著

# 3. Playwright 全套 8 支綠
pnpm test:e2e
# 預期：3 mssql + 5 新 = 8 支 passed

# 4. trace 失敗才產
ls e2e-results/  # 預期：空（全綠時）
```

## 風險

- **Playwright 對 Tauri webview 與純瀏覽器行為不同**：本 e2e 跑在 vite dev server (port 5555)，是純瀏覽器；Tauri 殼層 API（getCurrentWindow / invoke）在純瀏覽器是 undefined，httpClient 已 fallback（不送 token），但部分元件可能依賴 Tauri 才工作（TheTitleBar 的視窗按鈕）。**處理**：寫 spec 時用 `data-testid` 存在性而非「視窗真的最小化」這種 Tauri-only 行為。
- **viewport 1920×1200 與 CI 預設 1280×720 不同**：CI 環境記得也設 1920×1200，否則 layout 不同 spec 抓 selector 可能失效。
- **網路時序 flaky**：用 `page.waitForLoadState('networkidle')` + `expect.toBeVisible({ timeout })`。

## User 批准語法

「**T15 OK**」
