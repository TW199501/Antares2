/**
 * Manual screenshot helper per playwright-rules.md §3.
 *
 * Writes to `e2e-results/screenshots/<name>.png` so the run's HTML report
 * embeds it alongside Playwright's auto-screenshots and video.
 *
 * Naming convention (rules §3): `task{N}-step{M}-{slug}.png`.
 */
import path from 'node:path';

import type { Page } from '@playwright/test';

export async function shot (page: Page, name: string): Promise<void> {
   await page.screenshot({
      path: path.join('e2e-results', 'screenshots', `${name}.png`),
      fullPage: false
   });
}
