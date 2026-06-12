/**
 * Task 11 — SpecSnap 檢測器 開合
 *
 * Source-of-truth：web/renderer/components/TheSpecSnapInspector.vue
 *   - 用 @tw199501/specsnap-inspector-vue 包裝，:trigger="false"，shell 在
 *     onMounted 主動呼叫 inspectorRef.open()。
 *   - 包裝內部把 panel Teleport 到 body，class = `.specsnap-inspector-panel`。
 *   - shell 用 MutationObserver 抓到後加上 useDraggable 拖曳。
 *
 * 驗收：
 *   1. 點 settingbar 底部第 1 個 icon（crosshair）→ `.specsnap-inspector-panel`
 *      出現在 body 之下。
 *   2. 點 panel 內任一個含「Close」/「關閉」/「×」文字的按鈕 → panel 從 DOM 移除。
 *
 * 失敗處理（rules §7）：抓不到 .specsnap-inspector-panel 時不要改 selector
 * 為通配（例 `[class*=panel]`）— 先確認 wrapper version（package.json 的
 * @tw199501/specsnap-inspector-vue 是否還是 0.0.9）。
 */
import { expect, test } from '@playwright/test';

import { shot } from './_helpers/screenshot';
import { clickSpecsnap } from './_helpers/settings-bar';
import { installTauriShim } from './_helpers/tauri-shim';

test.describe('Task 11 — SpecSnap 檢測器 開合', () => {
   test.beforeEach(async ({ page }) => {
      await installTauriShim(page);
      await page.goto('/');
      await expect(page.locator('#wrapper')).toBeVisible({ timeout: 10_000 });
      await page.waitForLoadState('networkidle');
   });

   test('specsnap inspector opens then closes', async ({ page }) => {
      // ── Step 1: 點 crosshair icon ──
      await clickSpecsnap(page);

      // ── Step 2: 驗收 — wrapper panel 出現 ──
      const panel = page.locator('.specsnap-inspector-panel').first();
      await expect(panel).toBeVisible({ timeout: 5_000 });
      await shot(page, 'task11-step1-specsnap-open');

      // ── Step 3: 點 panel 內的 close 按鈕 ──
      // wrapper 的 close button 文字目前是英文（labels prop 還沒上游），
      // 範圍涵蓋 「Close」/「關閉」/「×」 以防之後改 labels。
      const closeBtn = panel
         .locator('button')
         .filter({ hasText: /Close|關閉|✕|×/ })
         .first();
      await closeBtn.click();

      // ── Step 4: 驗收 — panel 從 DOM 移除（component v-if=isSpecsnap → false）──
      await expect(panel).toBeHidden({ timeout: 5_000 });
      await shot(page, 'task11-step2-specsnap-closed');
   });
});
