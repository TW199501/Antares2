/**
 * Selectors for TheSettingBar.vue. Encapsulates the structural CSS so
 * specs don't repeat magic class names.
 *
 * Bottom group (`.settingbar-bottom-elements`) order:
 *   [0] specsnap (crosshair)
 *   [1] scratchpad
 *   [2] settings (gear)
 *
 * Middle group (`.settingbar-middle-elements`) — last child is the
 * mdiPlus "add connection" button (the conditional dots-overflow icon
 * may precede it when the connections list overflows).
 */
import { expect, Locator, Page } from '@playwright/test';

export async function openSettings (page: Page): Promise<Locator> {
   await page
      .locator('.settingbar-bottom-elements .settingbar-element')
      .last()
      .click();
   const dialog = page.locator('[role=dialog]').first();
   await expect(dialog).toBeVisible({ timeout: 5_000 });
   return dialog;
}

export async function clickAddConnection (page: Page): Promise<Locator> {
   await page
      .locator('.settingbar-middle-elements .settingbar-element')
      .last()
      .click();
   const panel = page.locator('.connection-panel-wrapper');
   await expect(panel).toBeVisible({ timeout: 5_000 });
   return panel;
}

export async function clickScratchpad (page: Page): Promise<void> {
   await page
      .locator('.settingbar-bottom-elements .settingbar-element')
      .nth(1)
      .click();
}

export async function clickSpecsnap (page: Page): Promise<void> {
   await page
      .locator('.settingbar-bottom-elements .settingbar-element')
      .first()
      .click();
}
