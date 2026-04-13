import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
   testDir: './e2e',
   outputDir: './e2e-results/artifacts',

   use: {
      baseURL: 'http://127.0.0.1:5555',
      actionTimeout: 30_000,
      navigationTimeout: 30_000
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
