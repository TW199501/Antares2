# Antares2 v0.8.3

繼 v0.8.2 之後的小型 release，**收尾兩件事**：(1) Phase-2 shadcn-vue 遷移最後一個 dead primitive 上線，(2) LF line ending 從 2 層 enforcement 補齊到 4 層。

---

## 🧩 Phase-2 shadcn-vue migration — 收尾

`Accordion` primitive 之前被 copy 到 `src/renderer/components/ui/accordion/` 但 caller 數是 0（dead code）。本版把 `WorkspaceExploreBarSchema.vue` 裡 8 個手刻 `<details class="accordion">` 全部換成 reka-ui 驅動的 `<Accordion>`：

- **Outer schema wrapper**: `<details ref="schemaAccordion" open>` → `<Accordion type="single" collapsible v-model="schemaOpenValue">` + 一個 `<AccordionItem value="schema">`（預設展開保留）
- **7 個 misc folders**（views / matViews / triggers / procedures / triggerFunctions / functions / schedulers）每個獨立 `<Accordion type="single" collapsible>`，可獨立摺收（與舊行為一致）
- **Trigger 用 reka-ui primitive 直接接**而非 wrapper — wrapper 內建 `py-4 text-sm` 跟 `mdiChevronDown` icon 不適合 schema tree 的密集排版；wrapper 的 `AccordionItem` / `AccordionContent` 仍透過 `@/components/ui/accordion` 引入（accordion caller 數 0 → 1）
- **External API 變更**：`WorkspaceExploreBar.vue` 從 `schema.value[0].$refs.schemaAccordion.open = true` 改成 `schema.value[0].openSchemaAccordion()`
- **SCSS**: `.accordion[open]` 全改 `[data-state="open"]`，新增 reka 自動產的 `<button>` 樣式 reset，`&:only-child > .database-name` 改成 descendant selector（reka 在 root / trigger 之間多了兩層 wrapper）

**結果：22 個 ui/ primitive 全部有 caller，dead code = 0。**

## 🔚 LF 4-layer enforcement — 收尾

Repo 之前只有 2 層 LF 強制：

| Layer | 之前 | v0.8.3 |
|---|---|---|
| 1. `.gitattributes`（commit-time normalization） | ✓ `* text eol=lf` | ✓ |
| 2. `.editorconfig`（editor hint） | ✓ `end_of_line = lf` | ✓ |
| 3. `.vscode/settings.json`（VS Code 預設）| — | ✓ 新增 `files.eol: "\n"` + `insertFinalNewline` + `trimTrailingWhitespace`（markdown opt-out）|
| 4. CI-callable assertion script | — | ✓ 新增 `pnpm check:eol`（`scripts/check-eol.mjs`，掃 git ls-files、撞到 CRLF 就 exit 1）|

驗證：674 個 tracked text 檔全 LF。

## 🧹 雜項

- `.gitignore` 多了 `.codex-history/`、`.openmcp/`、`skills.json`（IDE 工具產生的 session / 連線設定，不該 commit；`.openmcp/connection.json` 可能含 token）
- `CLAUDE.md` 補上 `pnpm migrate:appdata` 指令說明、把 CI 段落從「two workflows」改成完整 5 個 workflow 標註

## 📦 Distribution

跟 v0.8.2 完全相同（同樣 4 platform CI build）：

- **Windows**: `.msi`（推薦）/ `.exe`（NSIS）
- **macOS**: `.dmg`（Intel x64 + Apple Silicon）
- **Linux**: `.AppImage` / `.deb` / `.rpm`

App ID: `com.tw199501.antares2`

## ⚠️ 注意

- 12 個 pre-existing TypeScript errors 數量 **unchanged**（baseline locked）。
- Schema explore tree 的開合動畫（`animate-accordion-down/up` keyframes 沒定義）目前是 noop — native `<details>` 本來也沒動畫，不算回歸。
- v0.8.1 的 release.yml 上次失敗（24h timeout），v0.8.3 build 完請確認 4 個 platform artifact 都有產。

---

## English Summary

Small release closing two outstanding items from v0.8.2:

1. **Phase-2 shadcn-vue migration final piece** — `WorkspaceExploreBarSchema.vue` had 8 hand-rolled `<details class="accordion">` blocks (one outer schema wrapper + 7 misc folders for views / triggers / routines / functions / schedulers / etc.). Migrated all to `<Accordion type="single" collapsible>` from `@/components/ui/accordion`. The `Accordion` primitive went from 0 callers to 1 — every one of the 22 ui/ primitives is now in use, no more dead code in the design system.
2. **LF enforcement filled in** — repo previously only had `.gitattributes` + `.editorconfig` (2 layers). Added VS Code default (`files.eol: "\n"`) + a `pnpm check:eol` script as the 4th layer (CI-callable, scans every tracked file for CR bytes). 674 tracked text files all LF, verified.

No breaking changes; binary upgrade-compatible with v0.8.2.

## 🙏 Credits

Forked from [antares-sql/antares](https://github.com/antares-sql/antares) by Fabio Di Stasio (MIT License).
