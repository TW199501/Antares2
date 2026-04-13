import { defineConfig } from '@playwright/test';

export default defineConfig({
   testDir: './e2e',
   outputDir: './e2e-results',

   use: {
      baseURL: 'http://127.0.0.1:5555',

      // API 測試不需要瀏覽器 slowMo，但保留 actionTimeout
      actionTimeout: 30_000,
      navigationTimeout: 30_000
   },

   // 全程錄影 + 截圖（規範要求）
   // UI 測試時啟用；API 測試時 Playwright 自動略過這些設定
   reporter: [
      ['html', {
         outputFolder: './e2e-results/report',
         open: 'never'
      }],
      ['list']
   ]
});
