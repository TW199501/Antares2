# Playwright E2E 測試規範

> 適用於所有 agentic Playwright 測試任務
> E2E（End-to-End）測試：模擬真實使用者操作，從瀏覽器入口到後端結果全程驗證

---

## 1. 輸出目錄結構

所有測試產出統一放在專案根目錄的 `e2e-results/` 下：

```
e2e-results/
├── screenshots/          # 手動截圖（步驟節點）
│   ├── task8-step1-navigate.png
│   ├── task8-step2-after-approve.png
│   └── ...
├── videos/               # 全程錄影（Playwright 自動產生）
│   ├── task8-核決流程/
│   │   └── video.webm
│   └── ...
├── report/               # HTML 報告（含截圖 + 影片嵌入）
│   ├── index.html        # ← 用瀏覽器開這個
│   └── ...
└── junit.xml             # CI 用 XML 報告（選用）
```

---

## 2. playwright.config.ts 完整設定

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  // 測試檔案位置
  testDir: './e2e',

  // 輸出目錄（截圖、影片）
  outputDir: './e2e-results',

  use: {
    // 基礎網址（依環境調整）
    baseURL: 'http://localhost:8080',

    // 操作放慢 800ms，讓畫面變化清楚可見
    launchOptions: {
      slowMo: 800,
    },

    // 顯示瀏覽器視窗（非 headless，讓人看得見）
    headless: false,

    // 視窗大小
    viewport: { width: 1440, height: 900 },

    // 全程錄影（每個 test 都錄，不管成功失敗）
    video: 'on',

    // 每個步驟自動截圖
    screenshot: 'on',

    // 操作逾時
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  // 報告設定
  reporter: [
    // HTML 報告（含截圖、影片嵌入、步驟詳情）
    ['html', {
      outputFolder: './e2e-results/report',
      open: 'never',   // 跑完不自動開，由 agent 手動開
    }],
    // 終端機輸出（列出每個 test 結果）
    ['list'],
  ],
});
```

---

## 3. 截圖規範

### 命名規則
```
{task編號}-{step編號}-{描述}.png

例：
task8-step1-navigate.png
task8-step2-drawer-open.png
task8-step3-approve-success.png
task8-step4-status-approved.png
```

### 必須手動截圖的時機

| 時機 | 說明 |
|------|------|
| 頁面導航後 | 確認到達正確頁面 |
| Drawer / Dialog 開啟後 | 確認 UI 正確出現 |
| 表單填寫完成後、送出前 | 留存填寫內容 |
| ElMessage 成功/錯誤訊息出現時 | 確認系統回饋 |
| 狀態變更後 | 如：待審 → 已核 |
| 每個驗收項目確認後 | 作為驗收憑證 |

### 截圖輔助函式

```typescript
// 放在測試檔案頂部，統一存到 e2e-results/screenshots/
import path from 'path';

const shot = async (page: any, name: string) => {
  await page.screenshot({
    path: path.join('e2e-results', 'screenshots', `${name}.png`),
    fullPage: false,
  });
};
```

---

## 4. 標準測試程式碼結構

```typescript
import { test, expect } from '@playwright/test';
import path from 'path';

const shot = async (page: any, name: string) => {
  await page.screenshot({
    path: path.join('e2e-results', 'screenshots', `${name}.png`),
  });
};

test('Task 8 — 核決流程', async ({ page }) => {

  // ── Step 1: 導航 ──
  await page.goto('/system/dbChangeRequest');
  await page.waitForLoadState('networkidle');
  await shot(page, 'task8-step1-navigate');

  // ── Step 2: 點擊核決按鈕 ──
  const approveBtn = page.locator('button:has-text("核決")').first();
  await expect(approveBtn).toBeVisible();
  await approveBtn.click();
  await page.waitForLoadState('networkidle');
  await shot(page, 'task8-step2-after-click-approve');

  // ── Step 3: 確認對話框 ──
  const confirmBtn = page.locator('button:has-text("確定")').first();
  await expect(confirmBtn).toBeVisible();
  await confirmBtn.click();
  await page.waitForLoadState('networkidle');
  await shot(page, 'task8-step3-confirmed');

  // ── Step 4: 驗收 — 狀態變為已核 ──
  const statusTag = page.locator('.el-tag').filter({ hasText: '已核' }).first();
  await expect(statusTag).toBeVisible({ timeout: 8000 });
  await shot(page, 'task8-step4-status-approved');

  // ── Step 5: 驗收 — ElMessage 成功訊息 ──
  const successMsg = page.locator('.el-message--success');
  await expect(successMsg).toBeVisible({ timeout: 5000 });
  await shot(page, 'task8-step5-success-message');
});
```

---

## 5. 跑測試指令

```bash
# 跑所有 E2E 測試
npx playwright test

# 跑單一測試檔案
npx playwright test e2e/task8-approval.spec.ts

# 跑完後開啟 HTML 報告（瀏覽器）
npx playwright show-report e2e-results/report

# 跑測試 + 自動開報告
npx playwright test && npx playwright show-report e2e-results/report
```

---

## 6. HTML 報告內容說明

執行 `npx playwright show-report e2e-results/report` 後，瀏覽器會開啟報告，包含：

- ✅ / ❌ 每個 test 的通過/失敗狀態
- 每個步驟的截圖（可點擊放大）
- 嵌入的影片回放（可直接在報告裡看）
- 錯誤訊息與 stack trace（失敗時）
- 執行時間統計

---

## 7. Agent 失敗處理規則

- 任何 `expect()` 失敗 → Playwright 自動截圖，Agent 必須回報 selector 與實際 DOM 差異
- 找不到元素 → 截圖當前畫面，回報目前 URL 與頁面標題
- API 回傳錯誤 → 截圖 ElMessage 錯誤訊息內容
- **不得跳過驗收步驟繼續往下跑**
- **不得以「工具問題」或「環境問題」帶過，截圖就是證據**

---

## 8. Agent 完成後必須回報格式

```markdown
## Playwright E2E 測試報告 — {任務名稱}

**執行時間：** 2026-04-08 15:30
**報告路徑：** e2e-results/report/index.html
**開啟指令：** npx playwright show-report e2e-results/report

### 測試結果

| 步驟 | 操作 | 結果 | 截圖 |
|------|------|------|------|
| Step 1 | 導航到 /system/dbChangeRequest | ✅ | task8-step1-navigate.png |
| Step 2 | 點擊核決按鈕 | ✅ | task8-step2-after-click-approve.png |
| Step 3 | 確認對話框 | ✅ | task8-step3-confirmed.png |
| Step 4 | 狀態變為「已核」 | ✅ | task8-step4-status-approved.png |
| Step 5 | ElMessage 成功訊息 | ✅ | task8-step5-success-message.png |

### 影片

| 測試 | 影片路徑 |
|------|----------|
| Task 8 — 核決流程 | e2e-results/videos/task8-核決流程/video.webm |

### 問題回報（若有）

- 無
```