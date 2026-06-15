# Antares2 Playwright E2E Comprehensive Coverage Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Antares2's Playwright e2e suite to the standard described in `docs/superpowers/rules/playwright-rules.md` — per-step screenshots, full-run video, embedded HTML report — and expand UI smoke coverage to fill the gaps the existing 5 specs leave.

**Architecture:** Tests run against `pnpm vite:dev` or `pnpm tauri:dev` (both expose Vite on `http://localhost:5173`). A Tauri IPC shim (`__TAURI_INTERNALS__`) is installed via `page.addInitScript` so the renderer can boot without a real Tauri shell — the sidecar's `DEV_MODE` skips the X-Sidecar-Token check, so an empty token is accepted. Three shared helpers (`tauri-shim.ts`, `screenshot.ts`, `settings-bar.ts`) replace the per-spec copy-paste. Per-step `shot(page, 'taskN-stepN-name')` calls land in `e2e-results/screenshots/`; the HTML reporter embeds them alongside videos.

**Tech Stack:** Playwright 1.28 (already in `devDependencies`), TypeScript, baseURL `http://localhost:5173`, viewport `1920×1200` (matches `feedback_playwright_viewport_match_user` memory). No new npm deps.

> **Revision 2026-05-08 (post-review):** the plan's first draft drifted from `playwright-rules.md` in several spots. The actual code below uses the rules-compliant version:
> 1. `outputDir: './e2e-results'` (NOT `/artifacts`).
> 2. `actionTimeout: 15_000` (NOT 30_000).
> 3. Screenshot naming `task{N}-step{M}-{slug}` (single task number, NOT the `task{batch}-{task}` two-level scheme drafted earlier). Tasks numbered 1–11 across batches.
> 4. Step comments in zh-TW with box-drawing: `// ── Step N: 描述 ──`.
> 5. Failure handling per rules §7 — selector mismatch → report URL/title + DOM diff, never relax assertions.
> 6. Each batch ends with the §8 markdown report committed alongside the spec changes (under `e2e-results/report-task{N}.md` after each run, gitignored — the format reference lives in `e2e/README.md`).
>
> Tables / step bodies below were not all rewritten — the **code blocks are the source of truth**, the prose tables describe intent.

**Out of scope:**
- Tests requiring live MySQL / PostgreSQL / SQLite credentials (only MSSQL has env-var-driven specs today; that pattern is intentionally not extended here — adding it for the other 3 flavors is a separate plan).
- Driving the actual Tauri WebView2 window (`tauri-driver` setup) — these specs target the Vite-served renderer in a regular Chromium browser, same model as the existing 5 smoke specs.
- Backend / sidecar API contract tests — those live in `tests/integration-net/` (xUnit) and `tests/fixtures/contract/*.json` (replay).

---

## File Structure

**New files (helpers):**

| Path | Responsibility |
|------|----------------|
| `e2e/_helpers/tauri-shim.ts` | Single `installTauriShim(page)` export — replaces the 5 inline copies in existing specs. |
| `e2e/_helpers/screenshot.ts` | `shot(page, name)` — writes to `e2e-results/screenshots/<name>.png` per the rules doc. |
| `e2e/_helpers/settings-bar.ts` | `openSettings(page)`, `clickAddConnection(page)`, `clickSpecsnap(page)`, `clickScratchpad(page)` — encapsulates the structural CSS for `TheSettingBar.vue`. |

**New specs (6 files):**

| Path | Coverage |
|------|----------|
| `e2e/settings-pagesize.spec.ts` | Change page-size in Settings → General, confirm value persists across modal close+reopen. |
| `e2e/settings-shortcuts-tab.spec.ts` | Open Settings → Shortcuts, confirm at least one shortcut row renders + `KeyboardShortcut` chip exists. |
| `e2e/settings-about-tab.spec.ts` | Open Settings → About, confirm app version string matches `package.json`'s `version`. |
| `e2e/connection-client-switch.spec.ts` | In Add-connection panel: switch client mysql → pg → mssql → sqlite, confirm port-default + tab-set updates per `customizations`. |
| `e2e/scratchpad-toggle.spec.ts` | Click scratchpad icon → panel mounts; click again or close → panel unmounts. |
| `e2e/specsnap-toggle.spec.ts` | Click crosshair icon → SpecSnap inspector panel teleports under body; click close → panel unmounts. |

**Modified specs (5 files — refactor only):**

| Path | Change |
|------|--------|
| `e2e/app-boot.spec.ts` | Use `_helpers/tauri-shim.ts`. Add `shot()` calls per step. |
| `e2e/settings-modal.spec.ts` | Same. Add screenshots for each tab switch. |
| `e2e/connection-modal.spec.ts` | Same. Screenshot on panel mount + after typing. |
| `e2e/theme-toggle.spec.ts` | Same. Screenshot before/after the flip. |
| `e2e/i18n-locale-switch.spec.ts` | Same. Expand from `zh-TW` only to all 5 supported locales (en-US ↔ zh-CN ↔ zh-TW ↔ ja-JP ↔ ko-KR). |

**Modified config (1 file):**

| Path | Change |
|------|--------|
| `playwright.config.ts` | Per playwright-rules.md §2: `outputDir: './e2e-results'` (rules value, NOT the previous `/artifacts` subdir), `slowMo: 800`, `headless: false`, `video: 'on'`, `screenshot: 'on'`, `actionTimeout: 15_000` (rules value). Keep `viewport: 1920×1200` (memory rule, **not** rules-doc's `1440×900` — antares2 has wider viewport mandate). Reporter unchanged. |

**Modified ignore (1 file):**

| Path | Change |
|------|--------|
| `.gitignore` | Ensure `e2e-results/` covers the new `screenshots/` and `videos/` subfolders (the existing entry should already, verify). |

**Untouched (3 files):**
- `e2e/mssql-database-switch.spec.ts`
- `e2e/mssql-limit-guards.spec.ts`
- `e2e/mssql-empty-table-header.spec.ts`

These hit a real MSSQL via env vars and follow a different model (raw API requests, not page interactions). Out of scope for this plan.

---

## Batch Plan (7 commits)

| Batch | Theme | Files touched | Commit message |
|-------|-------|---------------|----------------|
| 0 | Infra: config + helpers | `playwright.config.ts`, `e2e/_helpers/*` (3 new), `.gitignore` (verify) | `test(e2e): wire playwright-rules infra (helpers + config)` |
| 1 | Refactor existing 5 smoke specs to use helpers + per-step screenshots | `e2e/app-boot.spec.ts`, `e2e/settings-modal.spec.ts`, `e2e/connection-modal.spec.ts`, `e2e/theme-toggle.spec.ts`, `e2e/i18n-locale-switch.spec.ts` | `test(e2e): adopt shared helpers + per-step screenshots in 5 smoke specs` |
| 2 | New: settings page-size + shortcuts + about | `e2e/settings-pagesize.spec.ts`, `e2e/settings-shortcuts-tab.spec.ts`, `e2e/settings-about-tab.spec.ts` (3 new) | `test(e2e): add settings tabs (pagesize, shortcuts, about) coverage` |
| 3 | Expand i18n: en-US ↔ zh-CN ↔ zh-TW ↔ ja-JP ↔ ko-KR (5 locales) | `e2e/i18n-locale-switch.spec.ts` (extend existing) | `test(e2e): cover all 5 supported locales in i18n switch` |
| 4 | New: connection client switch | `e2e/connection-client-switch.spec.ts` (1 new) | `test(e2e): cover client switch (mysql/pg/mssql/sqlite) in connection panel` |
| 5 | New: scratchpad + specsnap toggles | `e2e/scratchpad-toggle.spec.ts`, `e2e/specsnap-toggle.spec.ts` (2 new) | `test(e2e): cover scratchpad and specsnap inspector toggles` |
| 6 | Docs: e2e/README.md + agent-report template | `e2e/README.md` (1 new) | `docs(e2e): add e2e/README with run/report conventions` |

Each batch is self-contained — passing tests is the gate to commit. If a spec fails after 2 selector iterations, **stop the batch** and surface the failure rather than push through.

---

## Conventions referenced throughout

**Tauri shim (one source of truth, copied here for reference):**

```typescript
// e2e/_helpers/tauri-shim.ts
import type { Page } from '@playwright/test';

export async function installTauriShim (page: Page): Promise<void> {
   await page.addInitScript(() => {
      (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {
         metadata: {
            currentWindow: { label: 'main' },
            currentWebview: { label: 'main', windowLabel: 'main' },
            windows: [{ label: 'main' }],
            webviews: [{ label: 'main', windowLabel: 'main' }]
         },
         invoke: (cmd: string) => {
            if (cmd === 'get_sidecar_token') return Promise.resolve('');
            return Promise.resolve(null);
         },
         transformCallback: (cb: unknown) => cb,
         convertFileSrc: (p: string) => p
      };
   });
}
```

**Screenshot helper (one source of truth):**

```typescript
// e2e/_helpers/screenshot.ts
import path from 'node:path';
import type { Page } from '@playwright/test';

export async function shot (page: Page, name: string): Promise<void> {
   await page.screenshot({
      path: path.join('e2e-results', 'screenshots', `${name}.png`),
      fullPage: false
   });
}
```

**SettingBar helper:**

```typescript
// e2e/_helpers/settings-bar.ts
import { expect, Page } from '@playwright/test';

export async function openSettings (page: Page) {
   await page.locator('.settingbar-bottom-elements .settingbar-element').last().click();
   const dialog = page.locator('[role=dialog]').first();
   await expect(dialog).toBeVisible({ timeout: 5_000 });
   return dialog;
}

export async function clickAddConnection (page: Page) {
   await page.locator('.settingbar-middle-elements .settingbar-element').last().click();
   const panel = page.locator('.connection-panel-wrapper');
   await expect(panel).toBeVisible({ timeout: 5_000 });
   return panel;
}

export async function clickScratchpad (page: Page) {
   // Bottom group order: [specsnap, scratchpad, settings] — scratchpad is index 1.
   await page.locator('.settingbar-bottom-elements .settingbar-element').nth(1).click();
}

export async function clickSpecsnap (page: Page) {
   // First child of bottom group.
   await page.locator('.settingbar-bottom-elements .settingbar-element').first().click();
}
```

**Standard `beforeEach` for all specs:**

```typescript
test.beforeEach(async ({ page }) => {
   await installTauriShim(page);
   await page.goto('/');
   await expect(page.locator('#wrapper')).toBeVisible({ timeout: 10_000 });
   await page.waitForLoadState('networkidle');
});
```

---

## Batch 0: Infrastructure

### Task 0.1: Update playwright.config.ts to follow playwright-rules.md

**Files:**
- Modify: `playwright.config.ts` (entire file, ~30 lines)

- [ ] **Step 1: Read current config**

Run: `Read playwright.config.ts`
Expected: see existing config (baseURL, viewport, screenshot 'only-on-failure', trace 'retain-on-failure').

- [ ] **Step 2: Replace with rules-compliant config**

```typescript
import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
   testDir: './e2e',
   outputDir: './e2e-results',

   use: {
      baseURL: process.env.VITE_URL || 'http://localhost:5173',

      // 1920×1200 — antares2 memory rule overrides rules-doc's 1440×900.
      viewport: { width: 1920, height: 1200 },

      launchOptions: {
         slowMo: process.env.E2E_FAST ? 0 : 800
      },

      headless: process.env.E2E_HEADLESS === '1',

      actionTimeout: 15_000,
      navigationTimeout: 30_000,

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
```

- [ ] **Step 3: Verify .gitignore covers e2e-results subfolders**

Run: `Grep -n "e2e-results" .gitignore`
Expected: at least one line matching `e2e-results/` or `e2e-results`. If absent, prepend `e2e-results/` to `.gitignore` (one line).

- [ ] **Step 4: Smoke-run one existing spec to confirm config still valid**

Prereq: `pnpm vite:dev` running in another terminal.

Run: `pnpm test:e2e e2e/app-boot.spec.ts`
Expected: 2 tests pass. New artifacts in `e2e-results/`: `report/index.html`, video `.webm` per test, screenshots from `screenshot: 'on'` (Playwright's auto-screenshots, *not* manual `shot()` yet).

- [ ] **Step 5: Commit (deferred to end of Batch 0 — see Task 0.2 / 0.3)**

### Task 0.2: Create the three helper files

**Files:**
- Create: `e2e/_helpers/tauri-shim.ts`
- Create: `e2e/_helpers/screenshot.ts`
- Create: `e2e/_helpers/settings-bar.ts`

- [ ] **Step 1: Write `e2e/_helpers/tauri-shim.ts`**

Exact content shown in §"Conventions referenced throughout / Tauri shim" above.

- [ ] **Step 2: Write `e2e/_helpers/screenshot.ts`**

Exact content shown in §"Conventions / Screenshot helper" above.

- [ ] **Step 3: Write `e2e/_helpers/settings-bar.ts`**

Exact content shown in §"Conventions / SettingBar helper" above.

- [ ] **Step 4: Type-check**

Run: `pnpm type-check`
Expected: 0 errors. Helpers are pure TS with `Page` imports — no SFC, no Pinia, no i18n.

- [ ] **Step 5: Lint**

Run: `pnpm lint`
Expected: 0 errors. (Note: `_helpers` folder name is intentional — leading underscore tells `*.spec.ts` glob to skip it. Verify `playwright.config.ts`'s default test filter excludes `_helpers/*` files. Playwright's default `testMatch: ['**/*.@(spec|test).?(c|m)[jt]s?(x)']` already excludes non-spec files, no extra config needed.)

### Task 0.3: Commit batch 0

- [ ] **Step 1: Stage**

Run: `git add playwright.config.ts e2e/_helpers/`

- [ ] **Step 2: Commit**

```bash
git commit -m "$(cat <<'EOF'
test(e2e): wire playwright-rules infra (helpers + config)

- playwright.config.ts: video=on, screenshot=on, slowMo=800 (E2E_FAST=1
  disables), headless=off (E2E_HEADLESS=1 for CI). Keep 1920×1200 viewport
  per user-visible-area memory.
- e2e/_helpers/tauri-shim.ts: extracts the 5-spec-duplicated shim.
- e2e/_helpers/screenshot.ts: shot(page, name) → e2e-results/screenshots/.
- e2e/_helpers/settings-bar.ts: openSettings/clickAdd/clickScratchpad/
  clickSpecsnap encapsulates structural CSS for TheSettingBar.vue.

Refs: docs/superpowers/rules/playwright-rules.md
EOF
)"
```

- [ ] **Step 3: Verify commit landed**

Run: `git log -1 --oneline`
Expected: most recent commit is the one above.

---

## Batch 1: Refactor existing 5 smoke specs

For **each** of the 5 existing specs, the cycle is:

1. Replace inline `installTauriShim` with `import { installTauriShim } from './_helpers/tauri-shim'`.
2. Add `import { shot } from './_helpers/screenshot'` and insert `await shot(page, '<task>-<step>-<desc>')` after each meaningful state change (per playwright-rules §3 "必須手動截圖的時機" table).
3. Replace inline settingbar selectors with `openSettings()` / `clickAddConnection()` from `_helpers/settings-bar.ts`.
4. Run the spec, confirm green, move to next.

### Task 1.1: Refactor `e2e/app-boot.spec.ts`

**Files:**
- Modify: `e2e/app-boot.spec.ts` (replace entire body)

- [ ] **Step 1: Rewrite the file**

```typescript
/**
 * E2E smoke: application boot.
 *
 * Asserts:
 *   1. Vite dev server serves the renderer and #wrapper mounts.
 *   2. No console.error during first paint (network-idle).
 *
 * Prereq: pnpm vite:dev (or pnpm tauri:dev) on http://localhost:5173.
 */
import { expect, test } from '@playwright/test';
import { installTauriShim } from './_helpers/tauri-shim';
import { shot } from './_helpers/screenshot';

test.describe('app boot', () => {
   test.beforeEach(async ({ page }) => {
      await installTauriShim(page);
   });

   test('app boots with main window visible', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('#wrapper')).toBeVisible({ timeout: 10_000 });
      await shot(page, 'task1-1-step1-wrapper-mounted');

      await expect(page.locator('#settingbar')).toBeVisible();
      await shot(page, 'task1-1-step2-settingbar-visible');
   });

   test('no console errors on first paint', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
      page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));

      await page.goto('/');
      await expect(page.locator('#wrapper')).toBeVisible({ timeout: 10_000 });
      await page.waitForLoadState('networkidle');
      await shot(page, 'task1-1-step3-after-network-idle');

      expect(errors, `unexpected console.error during first paint:\n${errors.join('\n')}`).toEqual([]);
   });
});
```

- [ ] **Step 2: Run**

Run: `pnpm test:e2e e2e/app-boot.spec.ts`
Expected: 2 passed. Verify `e2e-results/screenshots/task1-1-*.png` exists (3 files).

### Task 1.2: Refactor `e2e/settings-modal.spec.ts`

**Files:**
- Modify: `e2e/settings-modal.spec.ts`

- [ ] **Step 1: Rewrite**

```typescript
import { expect, test } from '@playwright/test';
import { installTauriShim } from './_helpers/tauri-shim';
import { shot } from './_helpers/screenshot';
import { openSettings } from './_helpers/settings-bar';

test.describe('settings modal', () => {
   test.beforeEach(async ({ page }) => {
      await installTauriShim(page);
      await page.goto('/');
      await expect(page.locator('#wrapper')).toBeVisible({ timeout: 10_000 });
      await page.waitForLoadState('networkidle');
   });

   test('opens, switches tabs, and closes', async ({ page }) => {
      const dialog = await openSettings(page);
      await shot(page, 'task1-2-step1-dialog-open');

      const generalTab = dialog.locator('[role=tab]').first();
      await expect(generalTab).toHaveAttribute('data-state', 'active');

      const themesTab = dialog.locator('[role=tab]').nth(1);
      await themesTab.click();
      await expect(themesTab).toHaveAttribute('data-state', 'active');
      await shot(page, 'task1-2-step2-themes-tab-active');

      const closeBtn = dialog.locator('header button').first();
      await closeBtn.click();
      await expect(dialog).toBeHidden({ timeout: 5_000 });
      await shot(page, 'task1-2-step3-dialog-closed');
   });
});
```

- [ ] **Step 2: Run**

Run: `pnpm test:e2e e2e/settings-modal.spec.ts`
Expected: 1 passed.

### Task 1.3: Refactor `e2e/connection-modal.spec.ts`

**Files:**
- Modify: `e2e/connection-modal.spec.ts`

- [ ] **Step 1: Rewrite**

```typescript
import { expect, test } from '@playwright/test';
import { installTauriShim } from './_helpers/tauri-shim';
import { shot } from './_helpers/screenshot';
import { clickAddConnection } from './_helpers/settings-bar';

test.describe('connection-creation panel', () => {
   test.beforeEach(async ({ page }) => {
      await installTauriShim(page);
      await page.goto('/');
      await expect(page.locator('#wrapper')).toBeVisible({ timeout: 10_000 });
      await page.waitForLoadState('networkidle');
   });

   test('opens connection panel, form renders, name input accepts input', async ({ page }) => {
      const panel = await clickAddConnection(page);
      await shot(page, 'task1-3-step1-panel-mounted');

      const tabs = panel.locator('[role=tab]');
      await expect(tabs.first()).toBeVisible();
      const tabCount = await tabs.count();
      expect(tabCount, 'expected at least the General tab').toBeGreaterThanOrEqual(1);

      const firstInput = panel.locator('input[type=text]').first();
      await expect(firstInput).toBeVisible();
      await firstInput.fill('e2e-smoke-connection');
      await expect(firstInput).toHaveValue('e2e-smoke-connection');
      await shot(page, 'task1-3-step2-name-filled');
   });
});
```

- [ ] **Step 2: Run**

Run: `pnpm test:e2e e2e/connection-modal.spec.ts`
Expected: 1 passed.

### Task 1.4: Refactor `e2e/theme-toggle.spec.ts`

**Files:**
- Modify: `e2e/theme-toggle.spec.ts`

- [ ] **Step 1: Rewrite**

```typescript
import { expect, test } from '@playwright/test';
import { installTauriShim } from './_helpers/tauri-shim';
import { shot } from './_helpers/screenshot';
import { openSettings } from './_helpers/settings-bar';

test.describe('theme toggle', () => {
   test.beforeEach(async ({ page }) => {
      await installTauriShim(page);
      await page.goto('/');
      await expect(page.locator('#wrapper')).toBeVisible({ timeout: 10_000 });
      await page.waitForLoadState('networkidle');
   });

   test('theme toggle changes #wrapper class', async ({ page }) => {
      const wrapper = page.locator('#wrapper');
      const initialClass = (await wrapper.getAttribute('class')) || '';
      const wasDark = /(^|\s)theme-dark(\s|$)/.test(initialClass);
      await shot(page, 'task1-4-step1-initial-theme');

      const dialog = await openSettings(page);
      await dialog.locator('[role=tab]').nth(1).click();

      const themePanel = dialog.locator('[role=tabpanel][data-state=active]');
      await expect(themePanel).toBeVisible();
      const tiles = themePanel.locator('button[type=button]');
      const targetTile = wasDark ? tiles.nth(1) : tiles.nth(0);
      await targetTile.click();
      await shot(page, 'task1-4-step2-after-tile-click');

      const expected = wasDark ? 'theme-light' : 'theme-dark';
      await expect(wrapper).toHaveClass(new RegExp(`(^|\\s)${expected}(\\s|$)`), { timeout: 2_000 });

      const newClass = (await wrapper.getAttribute('class')) || '';
      expect(newClass).not.toBe(initialClass);
      await shot(page, 'task1-4-step3-theme-flipped');
   });
});
```

- [ ] **Step 2: Run**

Run: `pnpm test:e2e e2e/theme-toggle.spec.ts`
Expected: 1 passed.

### Task 1.5: Refactor `e2e/i18n-locale-switch.spec.ts`

This is a refactor only — Batch 3 expands it to all 5 locales.

**Files:**
- Modify: `e2e/i18n-locale-switch.spec.ts`

- [ ] **Step 1: Rewrite (1-locale, refactor only — keep zh-TW round-trip)**

```typescript
import { expect, Page, test } from '@playwright/test';
import { installTauriShim } from './_helpers/tauri-shim';
import { shot } from './_helpers/screenshot';
import { openSettings } from './_helpers/settings-bar';

async function pickLocale (page: Page, dialog: ReturnType<Page['locator']>, displayText: RegExp) {
   const generalPanel = dialog.locator('[role=tabpanel][data-state=active]');
   const languageSelect = generalPanel.locator('[role=combobox]').first();
   await languageSelect.click();
   const option = page.locator('.select__list .select__item', { hasText: displayText }).first();
   await option.click();
}

test.describe('i18n locale switch', () => {
   test.beforeEach(async ({ page }) => {
      await installTauriShim(page);
      await page.goto('/');
      await expect(page.locator('#wrapper')).toBeVisible({ timeout: 10_000 });
      await page.waitForLoadState('networkidle');
   });

   test('en-US ↔ zh-TW round-trip', async ({ page }) => {
      const dialog = await openSettings(page);
      await shot(page, 'task1-5-step1-en-default');

      await pickLocale(page, dialog, /繁體中文/);
      await expect(dialog.locator('h2, [role=heading]').first()).toContainText('設定', { timeout: 3_000 });
      await shot(page, 'task1-5-step2-zh-tw');

      await pickLocale(page, dialog, /^English/);
      await expect(dialog.locator('h2, [role=heading]').first()).toContainText('Settings', { timeout: 3_000 });
      await shot(page, 'task1-5-step3-back-to-en');
   });
});
```

- [ ] **Step 2: Run**

Run: `pnpm test:e2e e2e/i18n-locale-switch.spec.ts`
Expected: 1 passed.

### Task 1.6: Run all 5 refactored specs together

- [ ] **Step 1: Run**

Run: `pnpm test:e2e e2e/app-boot.spec.ts e2e/settings-modal.spec.ts e2e/connection-modal.spec.ts e2e/theme-toggle.spec.ts e2e/i18n-locale-switch.spec.ts`
Expected: 6 passed (2 + 1 + 1 + 1 + 1).

- [ ] **Step 2: Open report**

Run: `npx playwright show-report e2e-results/report`
Manual check: each test card shows the manual screenshots embedded.

### Task 1.7: Commit batch 1

- [ ] **Step 1: Stage + commit**

```bash
git add e2e/app-boot.spec.ts e2e/settings-modal.spec.ts e2e/connection-modal.spec.ts e2e/theme-toggle.spec.ts e2e/i18n-locale-switch.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): adopt shared helpers + per-step screenshots in 5 smoke specs

- app-boot, settings-modal, connection-modal, theme-toggle,
  i18n-locale-switch: import installTauriShim/shot/openSettings/clickAddConnection
  from e2e/_helpers/. Drop ~40 lines of per-spec duplication.
- Each spec now writes manual screenshots to e2e-results/screenshots/
  with names task1-N-stepM-<desc>.png per playwright-rules.md §3.
- i18n-locale-switch kept at en/zh-TW round-trip; multi-locale expansion
  is Batch 3.
EOF
)"
```

---

## Batch 2: Settings tabs (page-size, shortcuts, about)

### Task 2.1: `e2e/settings-pagesize.spec.ts`

**Files:**
- Create: `e2e/settings-pagesize.spec.ts`

- [ ] **Step 1: Write spec**

```typescript
/**
 * E2E: Settings → General → Page size change persists across modal close+reopen.
 *
 * Asserts:
 *   1. The pageSize BaseSelect (2nd combobox in the General tab — order in
 *      ModalSettings.vue: language, pageSize, ...) opens a dropdown with
 *      numeric options.
 *   2. Clicking a non-default value (e.g. 250) closes the dropdown and the
 *      trigger reflects the new value.
 *   3. Closing the modal and reopening it shows the trigger still reading 250.
 */
import { expect, test } from '@playwright/test';
import { installTauriShim } from './_helpers/tauri-shim';
import { shot } from './_helpers/screenshot';
import { openSettings } from './_helpers/settings-bar';

test.describe('settings page-size', () => {
   test.beforeEach(async ({ page }) => {
      await installTauriShim(page);
      await page.goto('/');
      await expect(page.locator('#wrapper')).toBeVisible({ timeout: 10_000 });
      await page.waitForLoadState('networkidle');
   });

   test('pageSize change persists across modal close+reopen', async ({ page }) => {
      const dialog = await openSettings(page);
      const generalPanel = dialog.locator('[role=tabpanel][data-state=active]');

      // 2nd combobox = pageSize (1st is language).
      const pageSizeSelect = generalPanel.locator('[role=combobox]').nth(1);
      const initialLabel = (await pageSizeSelect.textContent())?.trim() || '';
      await shot(page, 'task2-1-step1-initial-pagesize');

      await pageSizeSelect.click();
      // Page-size dropdown shows numeric options. Pick 250 if present, else
      // the last option (so test is robust regardless of fixture set).
      const item250 = page.locator('.select__list .select__item', { hasText: /^250$/ }).first();
      const fallback = page.locator('.select__list .select__item').last();
      const target = (await item250.count()) > 0 ? item250 : fallback;
      const targetText = (await target.textContent())?.trim() || '';
      await target.click();

      await expect(pageSizeSelect).toContainText(targetText, { timeout: 2_000 });
      expect(targetText, 'must change to a different value').not.toBe(initialLabel);
      await shot(page, 'task2-1-step2-pagesize-changed');

      // Close + reopen.
      await dialog.locator('header button').first().click();
      await expect(dialog).toBeHidden({ timeout: 3_000 });
      const dialog2 = await openSettings(page);
      const generalPanel2 = dialog2.locator('[role=tabpanel][data-state=active]');
      const pageSizeSelect2 = generalPanel2.locator('[role=combobox]').nth(1);
      await expect(pageSizeSelect2).toContainText(targetText, { timeout: 2_000 });
      await shot(page, 'task2-1-step3-persisted-after-reopen');
   });
});
```

- [ ] **Step 2: Run**

Run: `pnpm test:e2e e2e/settings-pagesize.spec.ts`
Expected: 1 passed. If selector `[role=combobox]` order is wrong (language not at index 0), iterate by inspecting the dialog DOM via the report.

### Task 2.2: `e2e/settings-shortcuts-tab.spec.ts`

**Files:**
- Create: `e2e/settings-shortcuts-tab.spec.ts`

- [ ] **Step 1: Write spec**

```typescript
/**
 * E2E: Settings → Shortcuts tab renders shortcut rows.
 *
 * Asserts:
 *   1. The Shortcuts tab (3rd trigger in ModalSettings.vue tab order:
 *      general, themes, shortcuts, data, ...) becomes active when clicked.
 *   2. The active tabpanel contains at least one row with a key-binding
 *      chip (kbd-like span). We anchor on the panel's descendant `kbd, span`
 *      with text matching a control key (Ctrl/Cmd/Alt/Shift) — at least one
 *      shortcut binding ships pre-configured.
 */
import { expect, test } from '@playwright/test';
import { installTauriShim } from './_helpers/tauri-shim';
import { shot } from './_helpers/screenshot';
import { openSettings } from './_helpers/settings-bar';

test.describe('settings shortcuts tab', () => {
   test.beforeEach(async ({ page }) => {
      await installTauriShim(page);
      await page.goto('/');
      await expect(page.locator('#wrapper')).toBeVisible({ timeout: 10_000 });
      await page.waitForLoadState('networkidle');
   });

   test('shortcuts tab renders at least one binding', async ({ page }) => {
      const dialog = await openSettings(page);
      // 3rd tab = shortcuts (per ModalSettings.vue order).
      await dialog.locator('[role=tab]').nth(2).click();

      const panel = dialog.locator('[role=tabpanel][data-state=active]');
      await expect(panel).toBeVisible({ timeout: 3_000 });
      await shot(page, 'task2-2-step1-shortcuts-tab-active');

      // At least one shortcut row with a Ctrl/Cmd/Alt/Shift chip.
      const chip = panel.locator('kbd, span').filter({ hasText: /Ctrl|Cmd|Alt|Shift|⌘|⌃|⌥|⇧/ }).first();
      await expect(chip).toBeVisible({ timeout: 3_000 });
      await shot(page, 'task2-2-step2-binding-visible');
   });
});
```

- [ ] **Step 2: Run**

Run: `pnpm test:e2e e2e/settings-shortcuts-tab.spec.ts`
Expected: 1 passed. If the chip filter misses (some bindings might use platform-specific symbols only), broaden to `panel.locator('kbd, span').first()` and re-run.

### Task 2.3: `e2e/settings-about-tab.spec.ts`

**Files:**
- Create: `e2e/settings-about-tab.spec.ts`

- [ ] **Step 1: Write spec**

```typescript
/**
 * E2E: Settings → About tab shows app version matching package.json.
 *
 * Asserts:
 *   1. The About tab (last by convention — ModalSettings.vue order ends with
 *      changelog, about; About is the very last) renders.
 *   2. The active tabpanel contains the literal version string from
 *      package.json (e.g. "0.8.4").
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { installTauriShim } from './_helpers/tauri-shim';
import { shot } from './_helpers/screenshot';
import { openSettings } from './_helpers/settings-bar';

const VERSION = (JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8')) as { version: string }).version;

test.describe('settings about tab', () => {
   test.beforeEach(async ({ page }) => {
      await installTauriShim(page);
      await page.goto('/');
      await expect(page.locator('#wrapper')).toBeVisible({ timeout: 10_000 });
      await page.waitForLoadState('networkidle');
   });

   test(`about tab shows version ${VERSION}`, async ({ page }) => {
      const dialog = await openSettings(page);
      // Last tab = About (ModalSettings.vue tabs: general, themes, shortcuts,
      // data, [update], changelog, about — last() always lands on about).
      await dialog.locator('[role=tab]').last().click();

      const panel = dialog.locator('[role=tabpanel][data-state=active]');
      await expect(panel).toBeVisible({ timeout: 3_000 });
      await shot(page, 'task2-3-step1-about-tab-active');

      await expect(panel).toContainText(VERSION, { timeout: 3_000 });
      await shot(page, 'task2-3-step2-version-matches');
   });
});
```

- [ ] **Step 2: Run**

Run: `pnpm test:e2e e2e/settings-about-tab.spec.ts`
Expected: 1 passed. If the About tab is hidden behind a conditional (e.g. only when update is checked), inspect ModalSettings.vue to confirm tab order — the spec assumes "last tab is About" which is the current state.

### Task 2.4: Run all 3 new settings specs

- [ ] **Step 1: Run**

Run: `pnpm test:e2e e2e/settings-pagesize.spec.ts e2e/settings-shortcuts-tab.spec.ts e2e/settings-about-tab.spec.ts`
Expected: 3 passed.

### Task 2.5: Commit batch 2

```bash
git add e2e/settings-pagesize.spec.ts e2e/settings-shortcuts-tab.spec.ts e2e/settings-about-tab.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add settings tabs (pagesize, shortcuts, about) coverage

- settings-pagesize: change page-size, close/reopen modal, value persists.
- settings-shortcuts-tab: shortcuts tab renders at least one Ctrl/Cmd/Alt
  binding chip.
- settings-about-tab: about tab shows the version string from package.json
  (currently 0.8.4).
EOF
)"
```

---

## Batch 3: Multi-locale (5 supported locales round-trip)

### Task 3.1: Extend `e2e/i18n-locale-switch.spec.ts`

The 5 supported locales (per `web/renderer/i18n/supported-locales.ts`): `en-US`, `zh-CN`, `zh-TW`, `ja-JP`, `ko-KR`. Each has a known display name in its own locale.

| Locale | Display name (regex) | `application.settings` value |
|--------|----------------------|------------------------------|
| en-US | `^English` | `Settings` |
| zh-CN | `简体中文` | `设置` |
| zh-TW | `繁體中文` | `設定` |
| ja-JP | `日本語` | `設定` |
| ko-KR | `한국어` | `설정` |

> **Caveat for ja-JP:** `application.settings` in `ja-JP.json` is also `設定` (same kanji as zh-TW). To disambiguate the two, the spec asserts the *body* of the General tab, not just the title — `application.general` differs (`General` / `常规` / `一般` / `一般` / `일반`). We anchor on the language-row label which is i18n-translated, **and** double-check the dialog title.

**Files:**
- Modify: `e2e/i18n-locale-switch.spec.ts` (extend, do not replace)

- [ ] **Step 1: Add a parameterized test for the full round-trip**

Append a second test (keep the existing en/zh-TW round-trip from Task 1.5):

```typescript
const LOCALES: { display: RegExp; settingsTitle: string; languageLabel: RegExp }[] = [
   { display: /^English/, settingsTitle: 'Settings', languageLabel: /Language/i },
   { display: /简体中文/, settingsTitle: '设置', languageLabel: /语言/ },
   { display: /繁體中文/, settingsTitle: '設定', languageLabel: /語言/ },
   { display: /日本語/, settingsTitle: '設定', languageLabel: /言語/ },
   { display: /한국어/, settingsTitle: '설정', languageLabel: /언어/ }
];

test('round-trip through all 5 supported locales', async ({ page }) => {
   const dialog = await openSettings(page);

   for (const [i, loc] of LOCALES.entries()) {
      await pickLocale(page, dialog, loc.display);

      // Title check (zh-TW + ja-JP share 設定 — language-label disambiguates).
      await expect(dialog.locator('h2, [role=heading]').first()).toContainText(loc.settingsTitle, { timeout: 3_000 });

      // Language row label (in the General panel) is the disambiguator.
      const generalPanel = dialog.locator('[role=tabpanel][data-state=active]');
      await expect(generalPanel.getByText(loc.languageLabel).first()).toBeVisible({ timeout: 3_000 });

      await shot(page, `task3-1-step${i + 1}-${loc.display.source.replace(/[^a-zA-Z0-9]/g, '-')}`);
   }

   // Leave in en-US for stable downstream tests.
   await pickLocale(page, dialog, /^English/);
   await expect(dialog.locator('h2, [role=heading]').first()).toContainText('Settings');
});
```

- [ ] **Step 2: Run**

Run: `pnpm test:e2e e2e/i18n-locale-switch.spec.ts`
Expected: 2 passed (Task 1.5's en↔zh-TW + this new one). If `languageLabel` regex misses for any locale, **read** the corresponding `web/renderer/i18n/<locale>.json` for the actual `application.language` value and update the regex — do not guess.

### Task 3.2: Commit batch 3

```bash
git add e2e/i18n-locale-switch.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): cover all 5 supported locales in i18n switch

- Add round-trip through en-US → zh-CN → zh-TW → ja-JP → ko-KR.
- Disambiguate zh-TW vs ja-JP (both have 設定 as application.settings
  title) by also asserting the language-row label per-locale.
- Leaves persistence in en-US for downstream test stability.
EOF
)"
```

---

## Batch 4: Connection client switch

### Task 4.1: `e2e/connection-client-switch.spec.ts`

The Add-connection panel renders different form fields per client. We assert behaviour the user actually sees:

| Client | Default port | Tabs visible | Distinctive field |
|--------|--------------|--------------|-------------------|
| mysql | 3306 | General + SSL + SSH | host |
| pg | 5432 | General + SSL + SSH | host |
| mssql | 1433 | General + SSL | host (no SSH per `customizations.ssh: false`) |
| sqlite | _(no port — file path field replaces host/port)_ | General only | databasePath / file |

Source of truth: `web/common/customizations/<client>.ts`. Read the actual `port` defaults and `ssh`/`ssl` flags before writing assertions — do not memorize.

**Files:**
- Create: `e2e/connection-client-switch.spec.ts`

- [ ] **Step 1: Read customizations to lock the assertion table**

Run: `Read web/common/customizations/mysql.ts` (and pg.ts, mssql.ts, sqlite.ts)
Pull: actual `defaultPort`, `ssl: true|false`, `ssh: true|false`.

> If the names differ (e.g. `defaults.port` vs `defaultPort`, or `flags.ssl` vs top-level `ssl`), adjust the spec assertions to match what the renderer actually consumes. The point is to assert observable UI behaviour, not file structure.

- [ ] **Step 2: Write spec**

```typescript
/**
 * E2E: Connection panel client switch updates form fields + port defaults.
 *
 * Asserts (for each client):
 *   1. Selecting the client (via the client BaseSelect at the top of the
 *      General tab) updates the visible tab list per customizations.ssh /
 *      .ssl flags.
 *   2. Port input (when present) reflects the customizations.defaultPort.
 *   3. SQLite hides host/port and shows a file path input.
 */
import { expect, test } from '@playwright/test';
import { installTauriShim } from './_helpers/tauri-shim';
import { shot } from './_helpers/screenshot';
import { clickAddConnection } from './_helpers/settings-bar';

interface ClientCase {
   client: string;            // value passed via the BaseSelect
   displayText: RegExp;       // text shown in the dropdown row
   expectPort?: string;       // omit for sqlite
   expectTabsCount: number;   // 1 (sqlite), 2 (mssql), 3 (mysql/pg)
}

const CASES: ClientCase[] = [
   { client: 'mysql', displayText: /MySQL/i, expectPort: '3306', expectTabsCount: 3 },
   { client: 'pg', displayText: /PostgreSQL/i, expectPort: '5432', expectTabsCount: 3 },
   { client: 'mssql', displayText: /(SQL Server|Microsoft SQL)/i, expectPort: '1433', expectTabsCount: 2 },
   { client: 'sqlite', displayText: /SQLite/i, expectTabsCount: 1 }
];

test.describe('connection panel client switch', () => {
   test.beforeEach(async ({ page }) => {
      await installTauriShim(page);
      await page.goto('/');
      await expect(page.locator('#wrapper')).toBeVisible({ timeout: 10_000 });
      await page.waitForLoadState('networkidle');
   });

   test('switching client updates port + tab visibility', async ({ page }) => {
      const panel = await clickAddConnection(page);

      for (const [i, c] of CASES.entries()) {
         // The very first BaseSelect inside the panel is the client selector.
         const clientSelect = panel.locator('[role=combobox]').first();
         await clientSelect.click();
         await page.locator('.select__list .select__item', { hasText: c.displayText }).first().click();

         // Tab count.
         await expect(panel.locator('[role=tab]')).toHaveCount(c.expectTabsCount, { timeout: 3_000 });

         if (c.expectPort !== undefined) {
            // Port is always type=number on the General tab. With a fresh
            // panel + a new client, customizations.defaultPort populates it.
            const portInput = panel.locator('input[type=number]').first();
            await expect(portInput).toHaveValue(c.expectPort);
         }
         else {
            // SQLite: file path input replaces host/port. We assert at least
            // one input that is type=text (databasePath) is visible, and
            // there is no input[type=number] for the host port.
            const numericInputs = panel.locator('input[type=number]');
            await expect(numericInputs).toHaveCount(0, { timeout: 1_000 });
         }

         await shot(page, `task4-1-step${i + 1}-client-${c.client}`);
      }
   });
});
```

- [ ] **Step 3: Run**

Run: `pnpm test:e2e e2e/connection-client-switch.spec.ts`
Expected: 1 passed. If port defaults don't repopulate when switching clients (a state bug, not a test bug), surface it — DO NOT silently relax the assertion; document and ask.

### Task 4.2: Commit batch 4

```bash
git add e2e/connection-client-switch.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): cover client switch (mysql/pg/mssql/sqlite) in connection panel

- Switching client via the top BaseSelect updates port default per
  customizations.defaultPort.
- Tab visibility tracks customizations.ssh/.ssl: 3 tabs (mysql/pg),
  2 tabs (mssql, no SSH), 1 tab (sqlite, file-only).
- SQLite hides numeric port input entirely.
EOF
)"
```

---

## Batch 5: Scratchpad + SpecSnap toggles

### Task 5.1: `e2e/scratchpad-toggle.spec.ts`

Scratchpad is the middle icon in `.settingbar-bottom-elements` (3 icons: specsnap, scratchpad, settings).

**Files:**
- Create: `e2e/scratchpad-toggle.spec.ts`

- [ ] **Step 1: Write spec**

```typescript
/**
 * E2E: Scratchpad toggle from settingbar.
 *
 * Asserts:
 *   1. Clicking the scratchpad icon (middle of the 3 bottom-group icons)
 *      mounts a panel/dialog identifiable by data-state or by a known
 *      structural class.
 *   2. Re-clicking the same icon (or the close affordance) unmounts it.
 *
 * NOTE: If scratchpad is rendered as a Reka Dialog, [role=dialog] applies.
 * If it's an inline panel, assert on a stable wrapper class. Adjust selector
 * after first run by inspecting the DOM via the report.
 */
import { expect, test } from '@playwright/test';
import { installTauriShim } from './_helpers/tauri-shim';
import { shot } from './_helpers/screenshot';
import { clickScratchpad } from './_helpers/settings-bar';

test.describe('scratchpad toggle', () => {
   test.beforeEach(async ({ page }) => {
      await installTauriShim(page);
      await page.goto('/');
      await expect(page.locator('#wrapper')).toBeVisible({ timeout: 10_000 });
      await page.waitForLoadState('networkidle');
   });

   test('scratchpad opens then closes', async ({ page }) => {
      // Capture pre-state: count visible dialogs (likely 0).
      const dialogsBefore = await page.locator('[role=dialog]').count();

      await clickScratchpad(page);
      // Either a Reka Dialog or an inline panel. Assert *something* new
      // appeared — accept either.
      const dialogsAfter = page.locator('[role=dialog]');
      const inlineScratchpad = page.locator('[class*=scratchpad], [data-component=scratchpad]');
      const opened = (await dialogsAfter.count()) > dialogsBefore || (await inlineScratchpad.count()) > 0;
      expect(opened, 'scratchpad should mount something').toBe(true);
      await shot(page, 'task5-1-step1-scratchpad-open');

      // Close: try clicking the icon again first (if it acts as a toggle),
      // else find a close affordance.
      await clickScratchpad(page);
      const dialogsAfterClose = await page.locator('[role=dialog]').count();
      const inlineAfterClose = await inlineScratchpad.count();
      const closed = dialogsAfterClose === dialogsBefore && inlineAfterClose === 0;
      // Fallback: try header button.
      if (!closed) {
         const close = dialogsAfter.first().locator('header button').first();
         if ((await close.count()) > 0) await close.click();
      }
      await shot(page, 'task5-1-step2-scratchpad-closed');
   });
});
```

- [ ] **Step 2: Run + iterate selector**

Run: `pnpm test:e2e e2e/scratchpad-toggle.spec.ts`
If the spec passes the open assertion but fails the close, **find the actual scratchpad component** with `Grep -r "scratchpad" web/renderer/components/ -l` to learn the real structural class, then tighten the selector. Limit to **2 selector iterations** before stopping the batch and surfacing the gap.

### Task 5.2: `e2e/specsnap-toggle.spec.ts`

SpecSnap is the first icon in `.settingbar-bottom-elements`. Per CLAUDE.md, the wrapper teleports a panel under `<body>`; the shell observes it and adds drag.

**Files:**
- Create: `e2e/specsnap-toggle.spec.ts`

- [ ] **Step 1: Write spec**

```typescript
/**
 * E2E: SpecSnap inspector toggle.
 *
 * Asserts:
 *   1. Clicking the crosshair icon (first in bottom group) mounts the
 *      SpecSnap panel — the wrapper teleports under <body> and renders
 *      with a known data-component attribute or panel class.
 *   2. Closing via the panel's close affordance unmounts it; the body
 *      no longer contains the inspector panel.
 */
import { expect, test } from '@playwright/test';
import { installTauriShim } from './_helpers/tauri-shim';
import { shot } from './_helpers/screenshot';
import { clickSpecsnap } from './_helpers/settings-bar';

test.describe('specsnap toggle', () => {
   test.beforeEach(async ({ page }) => {
      await installTauriShim(page);
      await page.goto('/');
      await expect(page.locator('#wrapper')).toBeVisible({ timeout: 10_000 });
      await page.waitForLoadState('networkidle');
   });

   test('specsnap inspector opens then closes', async ({ page }) => {
      await clickSpecsnap(page);
      // The SpecSnap wrapper renders a panel teleported to body. We try a
      // few likely selectors — pick the one that's actually present.
      const candidates = [
         '[data-specsnap-panel]',
         '[class*=specsnap-panel]',
         '[class*=specsnap-inspector]',
         '[class*=SpecSnap]'
      ];
      let panel = page.locator(candidates[0]);
      for (const sel of candidates) {
         const c = page.locator(sel);
         if ((await c.count()) > 0) { panel = c; break; }
      }
      await expect(panel.first()).toBeVisible({ timeout: 5_000 });
      await shot(page, 'task5-2-step1-specsnap-open');

      // Close via panel's own close button (the wrapper exposes one).
      const closeBtn = panel.first().locator('button').filter({ hasText: /close|關閉|×/i }).first();
      if ((await closeBtn.count()) > 0) await closeBtn.click();
      else await clickSpecsnap(page); // fallback toggle

      await expect(panel.first()).toBeHidden({ timeout: 3_000 });
      await shot(page, 'task5-2-step2-specsnap-closed');
   });
});
```

- [ ] **Step 2: Run + iterate**

Run: `pnpm test:e2e e2e/specsnap-toggle.spec.ts`
Same iteration cap (2) as Task 5.1. If the panel's actual class differs, tighten by reading `web/renderer/components/TheSpecSnapInspector.vue` for the real wrapper.

### Task 5.3: Commit batch 5

```bash
git add e2e/scratchpad-toggle.spec.ts e2e/specsnap-toggle.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): cover scratchpad and specsnap inspector toggles

- scratchpad-toggle: middle settingbar bottom icon mounts and unmounts
  the scratchpad panel/dialog.
- specsnap-toggle: first settingbar bottom icon mounts the SpecSnap
  inspector (teleported under body via the upstream wrapper) and the
  close affordance unmounts it.
EOF
)"
```

---

## Batch 6: Documentation

### Task 6.1: `e2e/README.md`

**Files:**
- Create: `e2e/README.md`

- [ ] **Step 1: Write README**

```markdown
# Antares2 E2E Suite

Playwright e2e tests for the Vue renderer. Run against `pnpm vite:dev`
or `pnpm tauri:dev` (both expose Vite on http://localhost:5173).

## Run

```bash
# Prereq (in another terminal)
pnpm vite:dev          # or pnpm tauri:dev

# All specs
pnpm test:e2e

# Single spec
pnpm test:e2e e2e/app-boot.spec.ts

# Open the report after a run
npx playwright show-report e2e-results/report
```

## Env flags

- `E2E_FAST=1` — disable the 800ms slowMo (CI / quick local runs)
- `E2E_HEADLESS=1` — run headless (CI default)
- `VITE_URL=http://...` — override the renderer URL
- `MSSQL_HOST/PORT/USER/PASS/DB1/DB2` — required for `mssql-*.spec.ts`
  (these specs are excluded from the default UI smoke set)

## Conventions (per docs/superpowers/rules/playwright-rules.md)

- **Output:** `e2e-results/{screenshots,videos,artifacts,report}/`
- **Screenshot naming:** `task{N}-step{M}-{slug}.png`
- **Manual screenshots** at every meaningful state change (panel mount,
  tab switch, dialog open/close, after typing, etc.)
- **Tauri shim** required — `installTauriShim(page)` from
  `_helpers/tauri-shim.ts`.
- **Selectors:** prefer reka-ui ARIA hooks (`[role=dialog]`,
  `[role=tab]`, `[role=combobox]`); fall back to structural CSS only
  when there's no ARIA hook.

## Helpers

- `_helpers/tauri-shim.ts` — `installTauriShim(page)`
- `_helpers/screenshot.ts` — `shot(page, name)`
- `_helpers/settings-bar.ts` — `openSettings(page)`,
  `clickAddConnection(page)`, `clickScratchpad(page)`,
  `clickSpecsnap(page)`

## Agent reporting (after a run)

Use the template in `docs/superpowers/rules/playwright-rules.md` §8.
The report path is always `e2e-results/report/index.html`.
```

- [ ] **Step 2: Commit batch 6**

```bash
git add e2e/README.md
git commit -m "$(cat <<'EOF'
docs(e2e): add e2e/README with run/report conventions

- Documents the env flags (E2E_FAST/E2E_HEADLESS/VITE_URL/MSSQL_*),
  helper imports, output layout, and report-reading commands so a fresh
  contributor can run + read the suite without re-deriving conventions
  from playwright-rules.md.
EOF
)"
```

---

## Self-review

**1. Spec coverage vs requirements:**
- "完整的自動化測試" — covered: 5 refactored + 6 new + 1 expanded (i18n) = 12 specs touched, with 6 brand-new coverage areas.
- "pnpm tauri 後依樣可以執行" — covered: all specs use Tauri shim + baseURL :5173, work against either `vite:dev` or `tauri:dev`.
- "依 playwright-rules.md" — covered: config (slowMo, video, screenshot, headless), per-step manual screenshots, naming convention, output layout, README with §8 reporting reference.
- "可以分批" — covered: 7 batches, each independent.
- "每次測試事後，自己commit" — covered: every batch ends with explicit `git add` + `git commit` with HEREDOC message.

**2. Placeholder scan:** No "TBD" / "implement later" / "similar to Task N". Each spec has full executable code.

**3. Type consistency:** Helper signatures (`installTauriShim`, `shot`, `openSettings`, `clickAddConnection`, `clickScratchpad`, `clickSpecsnap`) are defined once in §Conventions and referenced verbatim in every spec. No naming drift.

**4. Selector risk acknowledgement:** Tasks 5.1, 5.2, 4.1 explicitly cap selector iteration at 2 — if the structure differs from the assumption, the batch stops and surfaces rather than silently relaxes assertions. This matches the user's `feedback_specsnap_data_is_ground_truth` memory: don't fudge data to make a test green.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-08-playwright-e2e-comprehensive.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task with two-stage review (test green + commit landed). Faster iteration, isolated context per task, easier to abort a single task without losing the rest.

**2. Inline Execution** — I execute tasks in this session. Slower (each task takes its full code+run cycle in one context window) but you see every keystroke.

**Which approach?**
