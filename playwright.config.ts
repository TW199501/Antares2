import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
   testDir: './e2e',
   outputDir: './e2e-results/artifacts',

   use: {
      // 5173 = vite dev server (renderer HTML/JS). The sidecar API at 5555
      // is hit by the renderer itself via httpClient, not by Playwright.
      // Pre-existing mssql specs override via VITE_URL env var; T15 specs
      // use page.goto('/') so they need the correct baseURL here.
      // Use 'localhost' (NOT 127.0.0.1) — vite on Windows binds to IPv6 [::1]
      // by default, and 127.0.0.1 is IPv4-only → ERR_CONNECTION_REFUSED.
      baseURL: process.env.VITE_URL || 'http://localhost:5173',
      viewport: { width: 1920, height: 1200 },
      actionTimeout: 30_000,
      navigationTimeout: 30_000,
      trace: 'retain-on-failure',
      screenshot: 'only-on-failure'
   },

   reporter: [
      ['html', {
         outputFolder: './e2e-results/report',
         open: 'never'
      }],
      ['list']
   ]
};

export default config;
