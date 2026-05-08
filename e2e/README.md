# Antares2 E2E 測試套件

Playwright e2e tests for the Vue renderer. 測試對著 `pnpm vite:dev` 或
`pnpm tauri:dev` 跑（兩者都把 Vite 開在 http://localhost:5173）。

> 規範來源：[`docs/superpowers/rules/playwright-rules.md`](../docs/superpowers/rules/playwright-rules.md)
> 計畫來源：[`docs/superpowers/plans/2026-05-08-playwright-e2e-comprehensive.md`](../docs/superpowers/plans/2026-05-08-playwright-e2e-comprehensive.md)

## 跑測試

```bash
# 前置（另一個終端）
pnpm vite:dev          # 或 pnpm tauri:dev

# 全部 spec
pnpm test:e2e

# 單一 spec
pnpm test:e2e e2e/app-boot.spec.ts

# 跑完開報告
npx playwright show-report e2e-results/report
```

## 環境變數

| 變數 | 用途 |
|------|------|
| `E2E_FAST=1` | 關掉 800ms slowMo（CI / 快速本地跑） |
| `E2E_HEADLESS=1` | headless 模式（CI 預設） |
| `VITE_URL=http://...` | 覆蓋 renderer URL |
| `MSSQL_HOST/PORT/USER/PASS/DB1/DB2` | `mssql-*.spec.ts` 需要（這些 spec 是 live-DB 測試，跟 UI smoke 是兩套模型） |

## 目錄結構（playwright-rules.md §1）

```
e2e/
├── _helpers/                # 共用 helper（不會被 testMatch 撈到）
│   ├── tauri-shim.ts        # installTauriShim(page)
│   ├── screenshot.ts        # shot(page, name)
│   └── settings-bar.ts      # openSettings / clickAddConnection / clickScratchpad / clickSpecsnap
├── app-boot.spec.ts         # task1 — 應用程式啟動
├── settings-modal.spec.ts   # task2 — Settings 對話框
├── connection-modal.spec.ts # task3 — 新增連線面板
├── theme-toggle.spec.ts     # task4 — 主題切換
├── i18n-locale-switch.spec.ts # task5 — i18n 語系切換（5 語系）
├── settings-pagesize.spec.ts  # task6 — Settings page-size
├── settings-shortcuts-tab.spec.ts # task7 — Settings shortcuts tab
├── settings-about-tab.spec.ts # task8 — Settings about tab
├── connection-client-switch.spec.ts # task9 — client 切換
├── scratchpad-toggle.spec.ts  # task10 — Scratchpad 開合
├── specsnap-toggle.spec.ts    # task11 — SpecSnap 開合
├── mssql-database-switch.spec.ts # live-DB（需要 env）
├── mssql-limit-guards.spec.ts    # live-DB
└── mssql-empty-table-header.spec.ts # live-DB

e2e-results/                 # gitignored
├── screenshots/             # 手動截圖（shot helper 寫入）
├── report/index.html        # HTML 報告（含截圖 + 影片嵌入）
├── *.webm                   # 全程錄影
└── ...                      # Playwright artifacts
```

## 規範重點（playwright-rules.md）

### §3 截圖

- 命名：`task{N}-step{M}-{slug}.png`，例：`task6-step2-pagesize-changed.png`。
- 寫法：`await shot(page, 'taskN-stepM-slug')`，自動寫到 `e2e-results/screenshots/`。
- 必截圖時機：頁面導航後 / Dialog 開啟後 / 表單填完前 / 狀態變更後 / 每個驗收完成後。

### §4 程式碼風格

- 步驟註解：`// ── Step N: 描述 ──`（中文 + 箱型線）。
- describe 標題：`Task N — 描述`。
- 每個 spec 用 `installTauriShim` + `page.goto('/')` + `expect(#wrapper).toBeVisible()` 開場。

### §7 失敗處理

- expect() 失敗 → Playwright 自動截圖；spec 內的 hasText filter / regex 不可為了綠燈而拿掉。
- 找不到元素 → 不要切 selector 通配，**先確認 source 是否變了**（grep 檔案 / 看 git log）。
- selector 改 2 次仍找不到 = 真 bug 或 source drift，**回報，不繞**。
- 「工具問題」/「環境問題」不可帶過 — 截圖就是證據。

### §8 完成回報

每次 `pnpm test:e2e` 跑完，agent 應交：

```markdown
## Playwright E2E 測試報告 — {任務名稱}

**執行時間：** YYYY-MM-DD HH:MM
**報告路徑：** e2e-results/report/index.html
**開啟指令：** npx playwright show-report e2e-results/report

### 測試結果
| 步驟 | 操作 | 結果 | 截圖 |
|------|------|------|------|
| Step 1 | ... | ✅/❌ | taskN-stepM-...png |

### 影片
| 測試 | 路徑 |
|------|------|
| Task N — ... | e2e-results/.../video.webm |

### 問題回報（若有）
- ...
```

## 助手用法（`_helpers/`）

```typescript
import { expect, test } from '@playwright/test';

import { shot } from './_helpers/screenshot';
import { openSettings, clickAddConnection } from './_helpers/settings-bar';
import { installTauriShim } from './_helpers/tauri-shim';

test.describe('Task N — 標題', () => {
   test.beforeEach(async ({ page }) => {
      await installTauriShim(page);
      await page.goto('/');
      await expect(page.locator('#wrapper')).toBeVisible({ timeout: 10_000 });
      await page.waitForLoadState('networkidle');
   });

   test('描述', async ({ page }) => {
      // ── Step 1: 開啟 Settings ──
      const dialog = await openSettings(page);
      await shot(page, 'taskN-step1-dialog-open');
      // ...
   });
});
```

## Selector 慣例

優先順序：

1. **reka-ui ARIA hooks**（最穩，由 upstream 維護）：`[role=dialog]` / `[role=tab]` / `[role=tabpanel]` / `[role=combobox]`。
2. **app 自有 stable class**：`.connection-panel-wrapper` / `.settingbar-element` / `.specsnap-inspector-panel`。
3. **i18n 文字**：盡量避免，會跟 locale 綁；若要用則用 regex 包多語版本。

特別注意：

- `text=Settings` 之類純文字 selector → **不要用**（會被 i18n 切壞）。
- `data-testid` → 目前 antares2 不用這個 attribute；新增 testid 屬於應用碼變更，不在 e2e 範疇內。

## 既有 spec 不動的列表

下列 3 個 spec 是 **live-DB 模型**（直接打 sidecar API，不走頁面互動），跟本套 UI smoke 規範是兩套：

- `mssql-database-switch.spec.ts`
- `mssql-limit-guards.spec.ts`
- `mssql-empty-table-header.spec.ts`

它們需要 `MSSQL_*` env 變數 + 真實 SQL Server。修這些 spec 屬於 backend 整合測試議題。
