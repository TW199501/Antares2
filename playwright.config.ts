import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
   testDir: './e2e',
   outputDir: './e2e-results',

   use: {
      // Use 'localhost' (NOT 127.0.0.1) — vite on Windows binds to IPv6 [::1]
      // by default, and 127.0.0.1 is IPv4-only → ERR_CONNECTION_REFUSED.
      // Pre-existing mssql specs override via VITE_URL env var.
      baseURL: process.env.VITE_URL || 'http://localhost:5173',

      // 1920×1200 — antares2 memory rule overrides playwright-rules.md's 1440×900
      // (smaller viewport hides right-side gaps + max-width caps).
      viewport: { width: 1920, height: 1200 },

      // 800ms slowMo per playwright-rules.md §2; E2E_FAST=1 disables for CI.
      launchOptions: {
         slowMo: process.env.E2E_FAST ? 0 : 800
      },

      // Headed by default — agent observes browser, screenshots are evidence
      // (rules §7). E2E_HEADLESS=1 for CI.
      headless: process.env.E2E_HEADLESS === '1',

      actionTimeout: 15_000,
      navigationTimeout: 30_000,

      // Always-on recording per rules §2.
      video: 'on',
      screenshot: 'on',
      trace: 'retain-on-failure'
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
