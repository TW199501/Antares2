# Plan: Settings 分頁去 upstream branding + Changelog 啟用 + Dialog a11y 修正

## Context

使用者在 Settings dialog 內巡視時發現四個累積問題，需要一次清掉：

1. **About 分頁**仍是 upstream antares 內容（`Fabio Di Stasio` 寫死、Mastodon 連結指向 `@AntaresSQL`、Website 指向 `antares-sql.app`），且 `<img>` 用的 logo 是 upstream `logo.svg`（橘紅漸層星座 A，**不是** antares2 navy + `#FF5000` 設計）。
2. **Logo 檔本身** (`src/renderer/images/logo.svg`) 從 fork 後沒換過 — 但 `src-tauri/icons/` 在 commit `aa5a05b` 已經換成 antares2 設計（從 `1024X1024.png` 重新產生）。renderer 與 Tauri OS-level icon 視覺不一致。
3. **Changelog 分頁是空殼** ([ModalSettingsChangelog.vue](src/renderer/components/ModalSettingsChangelog.vue) 只顯示 `v{{ appVersion }}` + 一個資訊 icon)，沒撈任何 release notes。專案根目錄 `docs/release-notes-v0.8.1.md` / `v0.8.2.md` / `v0.8.3.md` 已經由 `pnpm release` 自動產生，但 component 完全沒讀到。
4. **DialogContent a11y warning** 開 Settings 時 console 出現兩次 `Missing Description or aria-describedby="undefined" for DialogContent`。Reka UI（shadcn-vue 用的 Radix Vue port）強制要求 `<DialogContent>` 提供描述以支援 screen reader。三個 modal 全部沒給：[ModalSettings.vue:15](src/renderer/components/ModalSettings.vue#L15)、[ModalSettingsDataImport.vue:3](src/renderer/components/ModalSettingsDataImport.vue#L3)、[ModalSettingsDataExport.vue:12](src/renderer/components/ModalSettingsDataExport.vue#L12)。

**使用者已決定**（透過 AskUserQuestion）：
- 作者欄完全移除（不留 attribution row）
- Logo 從 `src-tauri/icons/` 複製過來

**範圍邊界**：antares2 只支援 Mac / Linux / Windows 三個 desktop OS。任何文案不得引用 iOS / Android / Web 平台（即使 `src-tauri/icons/android/`、`ios/` 子資料夾存在 — 那是 Tauri Mobile scaffold 殘留，不在本計畫範圍）。

---

## Issue 1 — About 分頁清除 upstream 殘留

**檔案**：[src/renderer/components/ModalSettings.vue](src/renderer/components/ModalSettings.vue)

**改動**：

| 行 | 動作 |
|---|---|
| 387–392 | 整段 Mastodon `<a>` 連 `mdiMastodon` icon **刪除** |
| 393 | Mastodon 前的 `•` separator 刪除 |
| 394–399 | 整段 Website `<a>` 連 `mdiWeb` icon + `https://antares-sql.app/` **刪除** |
| 401 | 整行 `<small>` 作者 row 刪除（包含 `appAuthor` interpolation 與 `https://github.com/Fabio286` 連結） |
| 495 | `const appAuthor = 'Fabio Di Stasio';` 刪除（未使用引用後就是 dead code） |
| 498 | `appLogo = new URL('../images/logo.svg', import.meta.url).href` → 改為 `'../images/logo.png'`（搭配 Issue 2 複製過來的檔案） |

**保留不動**：
- GitHub 連結 ([:382](src/renderer/components/ModalSettings.vue#L382))，已正確指向 `https://github.com/TW199501/Antares2`
- Contributors 區段 (404–407)：仍從 `.all-contributorsrc` 讀，這是 upstream 貢獻者名單 — 不刪是出於 fork 學術誠實，與「移除作者」不衝突（作者是個人，contributors 是社群）
- `madeWithJS` ([:408](src/renderer/components/ModalSettings.vue#L408))：app personality，與 branding 無關
- 版本號顯示 (378)

---

## Issue 2 — Logo 從 Tauri icons 複製到 renderer

**動作**：
1. 把 [src-tauri/icons/512x512.png](src-tauri/icons/512x512.png) 複製到 `src/renderer/images/logo.png`（覆蓋舊的 upstream PNG）
2. About 分頁的 `<img :src="appLogo">` 透過 `width="96"` 顯示，512×512 source 縮放清晰
3. 同步 Issue 1 改 `appLogo` URL 路徑

**舊 SVG 檔處理**：
- `src/renderer/images/logo.svg` / `logo-dark.svg` / `logo-light.svg` **暫不刪除** — 需要先 grep 確認沒被其他元件引用（Splash、TheTitleBar、TheFavicon 等都可能用到）。本計畫只覆寫 `logo.png`、修 About 分頁參照路徑。實際刪除留作後續 cleanup。
- `logo-16.png` / `logo-32.png` / `logo-64.png` 同上，等驗證無 caller 後再刪。

**驗證引用**（執行階段需做的 read-only 步驟）：
```bash
# Phase 1 of implementation: confirm caller surface before/after change
grep -rn "logo\.svg\|logo-dark\|logo-light\|logo-16\|logo-32\|logo-64" src/renderer/
```
若除了 `ModalSettings.vue:498` 之外還有 caller，要在計畫執行時併同處理（或縮小到只改 ModalSettings 的指向）。

---

## Issue 3 — Changelog 分頁顯示專案 release notes

**檔案**：[src/renderer/components/ModalSettingsChangelog.vue](src/renderer/components/ModalSettingsChangelog.vue) — 完全重寫 (從 32 行 stub 變成可運作的 markdown viewer)

**實作方法**：

```vue
<script setup lang="ts">
import { marked } from 'marked';
import { computed } from 'vue';
import { ScrollArea } from '@/components/ui/scroll-area';

// Vite eager glob: bundle every docs/release-notes-vX.Y.Z.md as raw text at build
const notesGlob = import.meta.glob('../../../docs/release-notes-v*.md', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>;

const sortedNotes = computed(() => {
  return Object.entries(notesGlob)
    .map(([path, content]) => {
      const m = path.match(/release-notes-v(\d+)\.(\d+)\.(\d+)\.md$/);
      const version = m ? `${m[1]}.${m[2]}.${m[3]}` : '0.0.0';
      const sortKey = m ? Number(m[1]) * 1e6 + Number(m[2]) * 1e3 + Number(m[3]) : 0;
      return { version, sortKey, html: marked.parse(content, { async: false }) as string };
    })
    .sort((a, b) => b.sortKey - a.sortKey);
});
</script>

<template>
  <ScrollArea class="h-[60vh]">
    <div id="changelog" class="px-5 py-4 space-y-8">
      <article v-for="note in sortedNotes" :key="note.version" class="text-sm leading-relaxed" v-html="note.html" />
    </div>
  </ScrollArea>
</template>

<style lang="scss">
#changelog {
  h1 { @apply text-[18px] font-semibold mb-2 pb-2 border-b border-border/60; }
  h2 { @apply text-[15px] font-semibold mt-4 mb-1.5; }
  h3 { @apply text-[14px] font-semibold mt-3 mb-1; }
  p { @apply mb-2 text-foreground/85; }
  ul { @apply list-disc pl-5 space-y-1 mb-2 text-foreground/85; }
  li { margin-top: 0; }
  code { @apply px-1 py-0.5 rounded bg-muted text-[12px] font-mono; }
  pre { @apply p-3 rounded bg-muted overflow-x-auto text-[12px] font-mono mb-2; }
  pre code { @apply p-0 bg-transparent; }
  table { @apply w-full text-[12px] my-2; }
  th, td { @apply border border-border/60 px-2 py-1 text-left; }
  hr { @apply my-3 border-border/60; }
  a { @apply text-primary underline hover:opacity-80; }
}
</style>
```

**為什麼這樣設計**：
- `marked` 已是 dep（`package.json:69` `^18.0.0`），不需新增套件
- `import.meta.glob` 在 build time 把 markdown bundle 進 JS，不依賴 runtime fs / network — 跟 sidecar/Tauri model 解耦，離線可用
- `eager: true` 讓初次開 Changelog 不需要 await dynamic import，避免閃爍
- `query: '?raw'` 是 Vite 6 的新語法（取代 `as: 'raw'`，後者 deprecated）
- 排序用 numeric key（`major*1e6 + minor*1e3 + patch`）支援多位數版本（不會把 v0.10.0 排在 v0.9.0 前面變字串排序的災難）
- v-html 安全：所有 markdown 都來自 repo 內 build-time bundle，不含 external input
- ScrollArea 用 `h-[60vh]` 避免 dialog 被超長 changelog 撐高
- SCSS 區塊保留 existing `#changelog` selector — 不改 main.scss、不污染全域

**已知限制**：
- 不支援 syntax-highlighting（marked 預設 plain `<pre><code>`）— 若未來需要，加 `marked-highlight` + `highlight.js`
- 不支援 GFM（GitHub-flavored）的 task list / strikethrough — `marked` 預設關閉，可用 `marked.use({ gfm: true })` 啟用，但 release notes 目前用標準 markdown 為主，先不開

---

## Issue 4 — Dialog a11y warning 修正

**選擇的方案**：對三個 `<DialogContent>` 加 `:aria-describedby="undefined"` (literal undefined value via Vue binding) — 這是 Reka UI / Radix UI **官方文件記載的 escape hatch**，明確表達「此 Dialog 沒有 description，已知曉並接受」。

**為什麼不選 `<DialogDescription>`**：
- 若加 sr-only DialogDescription，需要新增 3 個 i18n key × 5 locale = **15 條翻譯字串**（en-US / zh-CN / zh-TW / ja-JP / ko-KR），維護成本高
- 三個 dialog 的 `<DialogTitle>` 已清楚標示用途（Settings / Import data / Export data），sr-only 描述會是 redundant 的 noise
- escape hatch 是文件記載的合法用法，不是 hack

**檔案 + 改動**：

| File | Line | Change |
|---|---|---|
| [src/renderer/components/ModalSettings.vue:15](src/renderer/components/ModalSettings.vue#L15) | `<DialogContent class="!max-w-..." ...>` | 加 `:aria-describedby="undefined"` |
| [src/renderer/components/ModalSettingsDataImport.vue:3](src/renderer/components/ModalSettingsDataImport.vue#L3) | 同上 | 加 `:aria-describedby="undefined"` |
| [src/renderer/components/ModalSettingsDataExport.vue:12](src/renderer/components/ModalSettingsDataExport.vue#L12) | 同上 | 加 `:aria-describedby="undefined"` |

**注意 Vue 語法**：必須用 `:aria-describedby="undefined"` (binding to JS undefined) 而非 `aria-describedby="undefined"` (literal string "undefined")。binding 形式會讓 Reka 的 internal check 看到 `value === undefined` 而跳過 warning，但實際 render 出的 DOM 不會帶 `aria-describedby` 屬性。

---

## Files to Modify

| File | Issue | Change |
|---|---|---|
| `src/renderer/components/ModalSettings.vue` | 1, 4 | 刪 author/Mastodon/Website (lines 387-401, 495)；改 logo 路徑 (498)；加 aria-describedby (15) |
| `src/renderer/components/ModalSettingsChangelog.vue` | 3 | 完全重寫 (32 行 → ~70 行 markdown viewer) |
| `src/renderer/components/ModalSettingsDataImport.vue` | 4 | 加 aria-describedby (3) |
| `src/renderer/components/ModalSettingsDataExport.vue` | 4 | 加 aria-describedby (12) |
| `src/renderer/images/logo.png` | 2 | **覆寫** — 從 `src-tauri/icons/512x512.png` 複製 |

**不動**：i18n locale 檔（不需新增 key）、main.scss、其他 ModalSettings* 檔。

## Reused Existing Utilities

- `marked` (`package.json` line 69) — markdown → HTML
- `ScrollArea` ([src/renderer/components/ui/scroll-area/](src/renderer/components/ui/scroll-area/)) — 內含滾動容器
- `import.meta.glob` — Vite 內建
- `src-tauri/icons/512x512.png` — antares2 已 rebrand 的 source

## Verification

**Build / static checks**：
1. `pnpm type-check` — 預期維持 12 個 pre-existing error baseline（皆在 `WorkspaceTabQueryTableRow.vue` 的 moment.js 型別），不應新增任何 error
2. `pnpm lint` — 應 pass（ESLint + Stylelint）

**Runtime smoke (per `feedback_vue_sfc_needs_runtime_smoke.md` 記憶 — Vue SFC 必須跑 dev server 實測)**：

3. **不要 kill port 5555**（per `feedback_dont_kill_sidecar_port.md`），現有 `pnpm tauri:dev` 會 hot-reload
4. **Console 驗 Issue 4**：開 Settings → 觀察 DevTools console 不再出現 `Missing Description for DialogContent` warning
5. **About 驗 Issue 1+2**：點 Settings → About 分頁
   - logo 是 antares2 設計（深色系 + 橘色 brand），非 upstream 橘紅星座 A
   - 沒有「Author / Fabio Di Stasio」那一行
   - Mastodon / Website icon 連結消失
   - GitHub 連結還在
6. **Changelog 驗 Issue 3**：點 Changelog 分頁
   - 看到 v0.8.3、v0.8.2、v0.8.1 三段（**從新到舊**）
   - 標題、列表、`code` block、表格樣式正常
   - 內容滾動順暢（ScrollArea 限高 60vh）
   - 沒空頁、沒 error 訊息
7. **Import / Export 驗 Issue 4**：在 Data 分頁分別點 Import / Export 按鈕，三個 modal 開啟時 console 都不再出現 a11y warning

**Cross-OS 注意**：
- Logo PNG 需在 Windows / macOS / Linux 三個 OS dev 環境都顯示正常（PNG 跨平台一致，理論無風險）
- `import.meta.glob` 路徑用 forward slash，Vite 會處理 Windows 反斜線正規化，但保險起見用 `../../../docs/release-notes-v*.md`（forward slash）

## Out of Scope

- 不刪舊的 `logo.svg` / `logo-dark.svg` / `logo-light.svg` / `logo-16.png` / `logo-32.png` / `logo-64.png`（需先掃 caller，留作後續 cleanup PR）
- 不改 `.all-contributorsrc` 內容（contributors 名單仍是 upstream，這是 fork 誠實標示）
- 不刪 `src-tauri/icons/android/` 與 `ios/`（Tauri Mobile scaffold 殘留，不影響 desktop build）
- 不加 changelog 的 syntax-highlighting / GFM 擴充（先讓基本顯示能動）
- 不換 DialogDescription 為長期方案（若未來需要嚴格 a11y compliance 再加 i18n key）
- 不動之前未 commit 的 ModalSettings.vue 中關於 translation footnote 的 diff（與本計畫無關，使用者自行處理）
