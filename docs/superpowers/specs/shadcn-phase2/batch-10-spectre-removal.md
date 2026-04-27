# Batch 10 — spectre.css 移除 + rem 解放 + token 回收

**前置依賴**：Batch 0 - 9 全部完成
**估時**：2 天
**對應 Plan 段落**：parent-plan §3 Batch 10
**Spec rev**：2026-04-28 against commit `fd44e3a`

---

## 1. Scope

刪除 `spectre.css` 依賴；解除 `html { font-size: 20px }` workaround；批次回收 `text-[12px]` 等 arbitrary token；更新 CLAUDE.md 與 ui-spec.md 移除「coexistence」表述。

### 1.1 涵蓋的修改

- `src/renderer/scss/main.scss` — 刪除 59 個 spectre `@import`
- `package.json` — 移除 `spectre.css` dependency
- `src/renderer/components/*.vue` — 批次替換 arbitrary token（如 `text-[12px]` → `text-xs`）
- `CLAUDE.md` — 改寫「UI stack」段落
- `docs/ui-spec.md` — 移除 spectre 相關段
- `CHANGELOG.md` — 紀錄 breaking visual change（如有）

### 1.2 排除清單

- **不**動 `_data-types.scss` / `_table-keys.scss` / `_fake-tables.scss` / `_editor-icons.scss` / `_db-icons.scss` / `themes/*` 內的純自訂規則（這些是 antares 自家的，與 spectre 無關）
- **不**遷移已遷移的元件（前 9 批應該都做完了）
- **不**動 `tailwind.css` 內的 token（Batch 0 已加完）

---

## 2. Pre-flight Drift Check

```bash
cd e:/source/antares2

# 1. 確認前 9 批都完成 — 沒有任何元件還用 spectre class
grep -rln "class=[\"'][^\"']*\b\(btn\|form-input\|form-select\|form-label\|form-checkbox\|form-switch\|form-radio\|form-group\|modal\|tab-block\|tab-item\|columns\|column\|panel\|navbar\|menu\|popover\|toast\|chip\)\b" src/renderer/components/ --include="*.vue" 2>/dev/null
# 預期：空（無 file 列出）。如果有，回頭修對應 batch

# 2. 確認 12 個 primitive 都還在
ls -d src/renderer/components/ui/{switch,textarea,tooltip,sonner,context-menu,scroll-area,separator,badge,card,popover,radio-group,accordion} | wc -l
# 預期：12

# 3. 拍照當下 main.scss 行數（用來事後比對）
wc -l src/renderer/scss/main.scss

# 4. 拍照所有 arbitrary px token 用量
grep -rEoh "text-\[1[0-9]px\]|h-\[2[0-9]px\]|p-\[[0-9]px\]" src/renderer/components/*.vue | sort | uniq -c | sort -rn
# 這份輸出在 Batch 10 後會大幅縮減
```

如果 §1 有非空輸出 → **不可開工 Batch 10**，回去補完缺漏的 batch。

---

## 3. Primitives Used

無新 primitive。Batch 10 只刪不加。

---

## 4. Common Transformations

### 4.1 Arbitrary token → 原生 Tailwind token 對照

當 `html { font-size: 20px }` 拔掉、root 回到 16px 後，rem 數值意義改變：

| 拔除前（spectre 20px root） | 拔除後（標準 16px root） | Tailwind 對應 |
|----------------------------|-------------------------|---------------|
| `text-[12px]` | `text-[12px]` 仍 12px | **`text-xs`**（=12px ✓） |
| `text-[14px]` | `text-[14px]` 仍 14px | **`text-sm`**（=14px ✓） |
| `text-[16px]` | `text-[16px]` 仍 16px | **`text-base`**（=16px ✓） |
| `text-[11px]` | `text-[11px]` 仍 11px | 無原生對應，**保留 arbitrary** |
| `text-[13px]` | `text-[13px]` 仍 13px | 無原生對應，**保留 arbitrary** |
| `h-[24px]` | `h-[24px]` 仍 24px | **`h-6`**（=24px ✓） |
| `h-[32px]` | `h-[32px]` 仍 32px | **`h-8`**（=32px ✓） |
| `p-[8px]` | `p-[8px]` 仍 8px | **`p-2`**（=8px ✓） |

**回收 sed pattern**（只在驗證 root font-size 真的變回 16px 後跑）：

```bash
cd e:/source/antares2

# text-[12px] → text-xs
grep -rl "text-\[12px\]" src/renderer/components/ | xargs sed -i 's/text-\[12px\]/text-xs/g'

# text-[14px] → text-sm
grep -rl "text-\[14px\]" src/renderer/components/ | xargs sed -i 's/text-\[14px\]/text-sm/g'

# text-[16px] → text-base
grep -rl "text-\[16px\]" src/renderer/components/ | xargs sed -i 's/text-\[16px\]/text-base/g'

# h-[24px] → h-6, h-[32px] → h-8, h-[40px] → h-10
grep -rl "h-\[24px\]" src/renderer/components/ | xargs sed -i 's/h-\[24px\]/h-6/g'
grep -rl "h-\[32px\]" src/renderer/components/ | xargs sed -i 's/h-\[32px\]/h-8/g'
grep -rl "h-\[40px\]" src/renderer/components/ | xargs sed -i 's/h-\[40px\]/h-10/g'

# p-[8px] → p-2, p-[16px] → p-4
grep -rl "p-\[8px\]" src/renderer/components/ | xargs sed -i 's/p-\[8px\]/p-2/g'
grep -rl "p-\[16px\]" src/renderer/components/ | xargs sed -i 's/p-\[16px\]/p-4/g'
```

**注意**：`text-[11px]` / `text-[13px]` / `text-[15px]` 沒有原生 Tailwind 對應（4px 跳一階），**留著**。

### 4.2 main.scss 刪除

```diff
// src/renderer/scss/main.scss
- @import "~spectre.css/src/variables";
  @import "variables";
  @import "transitions";
  @import "data-types";
  @import "table-keys";
  @import "fake-tables";
  @import "editor-icons";
  @import "db-icons";
  @import "themes/dark-theme";
  @import "themes/light-theme";

- @import "~spectre.css/src/mixins";
- @import "~spectre.css/src/normalize";
- @import "~spectre.css/src/base";
- @import "~spectre.css/src/typography";
- @import "~spectre.css/src/asian";
- @import "~spectre.css/src/tables";
- @import "~spectre.css/src/buttons";
- @import "~spectre.css/src/forms";
- @import "~spectre.css/src/labels";
- @import "~spectre.css/src/codes";
- @import "~spectre.css/src/media";
- @import "~spectre.css/src/layout";
- @import "~spectre.css/src/hero";
- @import "~spectre.css/src/navbar";
- @import "~spectre.css/src/accordions";
- @import "~spectre.css/src/avatars";
- @import "~spectre.css/src/badges";
- @import "~spectre.css/src/breadcrumbs";
- @import "~spectre.css/src/bars";
- @import "~spectre.css/src/cards";
- @import "~spectre.css/src/chips";
- @import "~spectre.css/src/dropdowns";
- @import "~spectre.css/src/empty";
- @import "~spectre.css/src/menus";
- @import "~spectre.css/src/modals";
- @import "~spectre.css/src/navs";
- @import "~spectre.css/src/pagination";
- @import "~spectre.css/src/panels";
- @import "~spectre.css/src/popovers";
- @import "~spectre.css/src/steps";
- @import "~spectre.css/src/tabs";
- @import "~spectre.css/src/tiles";
- @import "~spectre.css/src/toasts";
- @import "~spectre.css/src/tooltips";
- @import "~spectre.css/src/animations";
- @import "~spectre.css/src/utilities/cursors";
- @import "~spectre.css/src/utilities/display";
- @import "~spectre.css/src/utilities/divider";
- @import "~spectre.css/src/utilities/loading";
- @import "~spectre.css/src/utilities/position";
- @import "~spectre.css/src/utilities/shapes";
- @import "~spectre.css/src/utilities/text";
- @import "~spectre.css/src/spectre-exp";
```

### 4.3 自訂 SCSS 檔的 spectre 殘留檢查

```bash
# 確認 _variables.scss / _transitions.scss 等沒有間接用 spectre
grep -rn "spectre\|\$primary\|\$gray\|\$\(success\|warning\|error\)" \
   src/renderer/scss/_*.scss src/renderer/scss/themes/ \
   | grep -v "^.*://"
```

如果有間接引用 spectre 的 SCSS variable，必須先：
- 把 spectre variable 替換成 Tailwind CSS var（`$gray-light` → `var(--muted)`）
- 或把該值硬寫成 hex

### 4.4 package.json

```diff
// package.json
{
  "dependencies": {
-   "spectre.css": "^0.5.9",
    "vue": "^3.5.x",
    ...
  }
}
```

跑 `pnpm install` 重生 lockfile。

### 4.5 CLAUDE.md 改寫

開 `CLAUDE.md`，找 「### UI stack: shadcn-vue + spectre coexistence」 整節（line ~138 起），整節刪除，替換為：

```markdown
### UI stack: shadcn-vue + Tailwind v4

Renderer 全 shadcn-vue + Tailwind CSS v4。spectre.css 在 Phase 2 完工
（commit `<batch-10-hash>`）後完全移除，`html { font-size: 20px }`
workaround 解除，root 回到瀏覽器預設 16px。

Tailwind v4 配置在 `src/renderer/assets/tailwind.css`：
- `@import "tailwindcss"` 完整載入
- `@theme inline { … }` 內以 hex CSS variable 宣告 token
- `@custom-variant dark (&:where(.theme-dark, .theme-dark *))`
- `:root` / `.theme-dark` 設 `color-scheme: light / dark` 修 Chromium 原生表單顏色

shadcn-vue primitives 全在 `src/renderer/components/ui/`（21 個 primitive）：
原 9 個 + Phase 2 新增 12 個（Switch/Textarea/Tooltip/Sonner/ContextMenu/
ScrollArea/Separator/Badge/Card/Popover/RadioGroup/Accordion）。

Reka UI / class-variance-authority / clsx / tailwind-merge 是 runtime
deps；shadcn-vue CLI 只在 scratch 目錄跑、手抄回 repo（避免 CLI 覆蓋
本地客製化）。所有圖示走 `BaseIcon` + mdi*，**禁裝** lucide-vue-next。
```

### 4.6 ui-spec.md 改寫

開 `docs/ui-spec.md`，找所有 「spectre」/「coexistence」/「混用」字眼的章節，刪除或改寫成「歷史紀錄」。新增段：

```markdown
## Migration history

- Phase 1（2026-04-17）：建立 9 個 shadcn-vue primitives，遷移
  BaseConfirmModal + connection panels
- Phase 2 Batch 0-9（2026-04-28 ~ <Batch 9 完工日>）：補 12 個 primitives，
  遷移 74 個元件
- Phase 2 Batch 10（<Batch 10 完工日>）：移除 spectre.css，root font-size
  回 16px，arbitrary token 批次回收
```

### 4.7 CHANGELOG.md

```markdown
## [Unreleased]

### Changed

- **BREAKING (visual)**：移除 spectre.css 依賴，全 UI 改由 shadcn-vue
  + Tailwind v4 提供。視覺與互動行為與 0.7.x 不同（按鈕圓角 / 字級 /
  spacing 全部對齊新設計），但功能行為不變。
- HTML root font-size 從 20px 回 16px（spectre 移除的副作用）

### Removed

- `spectre.css` dependency
- 32 個 spectre `@import` from `src/renderer/scss/main.scss`
```

---

## 5. Per-File Detailed Steps

### Step 1：開工前殘留 0 化驗證

跑 §2 的 grep 1。如果輸出非空 → **STOP**，回去補對應 batch。

### Step 2：刪除 spectre import（dry-run）

```bash
# 先用 grep -c 確認移除目標數量（預期 32）
grep -c "^@import.*spectre" src/renderer/scss/main.scss

# 用 sed dry-run（不寫入）
sed -n '/^@import.*spectre/p' src/renderer/scss/main.scss | wc -l
```

### Step 3：實際刪除

開編輯器手動刪除（避免 sed 把註解內的 spectre 字眼也刪）。對照 §4.2 diff。

### Step 4：跑 dev mode 看 console

```bash
pnpm tauri:dev
```

預期：
- console 無「Cannot find file 'spectre.css'」之類錯誤
- 視覺與前一刻相比有變化（按鈕、表單預設樣式變了）— 這是預期的，因為 spectre 的 `_buttons.scss` `_forms.scss` 不再 reset

如果有任何元件「破版」（layout 跑掉）→ 該元件還有 spectre 殘留沒清，回頭修。

### Step 5：批次回收 arbitrary token

```bash
# 在 §4.1 的 sed 指令前，先驗證 root 真的變回 16px
# 開 dev mode，console:
# > getComputedStyle(document.documentElement).fontSize
# 預期："16px"
```

確認 16px 後跑 §4.1 sed。**逐條 commit**（每條 sed 一個 commit），方便逐項回退。

### Step 6：移除 spectre.css npm dep

```bash
# 修改 package.json（刪 "spectre.css": "^0.5.9"）
pnpm install
git diff pnpm-lock.yaml | head -20  # 確認 lockfile 有更新且只移除 spectre
```

### Step 7：CLAUDE.md / ui-spec.md / CHANGELOG.md 改寫

對照 §4.5 / §4.6 / §4.7。

### Step 8：build + e2e 完整跑一遍

```bash
pnpm vue-tsc --noEmit
pnpm lint
pnpm test:e2e
pnpm tauri:build  # 整個 build 一次，產生 NSIS + MSI
```

裝起來開 app 全功能 smoke test（見 §9）。

---

## 6. New Files Created

無。Batch 10 只刪不加。

但會修改：
- `src/renderer/scss/main.scss`（-32 行 spectre import）
- `package.json`（-1 dep）
- `pnpm-lock.yaml`（自動）
- `CLAUDE.md`（改寫一段）
- `docs/ui-spec.md`（改寫多段）
- `CHANGELOG.md`（新增 entry）
- `src/renderer/components/*.vue`（批次 sed 替換 arbitrary token，預期 ~30+ 檔被觸及）

---

## 7. Acceptance Checklist

- [ ] §2 pre-flight 殘留檢查為 0（前 9 批確實都完成）
- [ ] `main.scss` 內 spectre `@import` 為 0
- [ ] `package.json` 內無 `spectre.css`
- [ ] `pnpm-lock.yaml` 更新（去掉 spectre 那塊）
- [ ] dev mode `getComputedStyle(document.documentElement).fontSize` 為 `"16px"`
- [ ] arbitrary token 已批次回收（§4.1 的 sed 跑過）
- [ ] CLAUDE.md「UI stack」段已改寫，無「spectre coexistence」字眼
- [ ] ui-spec.md 已改寫，加上 Migration history 段
- [ ] CHANGELOG.md 加上 Phase 2 完工 entry
- [ ] `pnpm vue-tsc --noEmit` 過
- [ ] `pnpm lint` 過
- [ ] `pnpm test:e2e` 全綠
- [ ] `pnpm tauri:build` 出 NSIS + MSI 兩個 installer
- [ ] 安裝新 installer，全功能 smoke test 過（§9）
- [ ] dark / light theme 切換無破畫面
- [ ] §8 完成偵測 grep 全綠

---

## 8. Completion Detection Grep（核心）

```bash
cd e:/source/antares2

# 1. main.scss 不再有 spectre import → 預期 0
grep -c "^@import.*spectre" src/renderer/scss/main.scss

# 2. package.json 沒有 spectre.css dep → 預期 0
node -e "console.log(require('./package.json').dependencies['spectre.css'] ? 'STILL EXISTS' : 0)"

# 3. node_modules 沒有 spectre.css → 預期 not found
ls node_modules/spectre.css 2>&1 | head -1
# 預期輸出："ls: cannot access ..."

# 4. 全 src/ 無任何 spectre 字眼（除歷史註解 / migration 說明） → 預期 0
grep -rln "spectre" src/ | grep -v "\.md$" | wc -l

# 5. 全 src/renderer/components/*.vue 無 spectre class → 預期 0
grep -rln "class=[\"'][^\"']*\b\(form-input\|form-select\|form-label\|btn\b\|modal-container\|tab-block\)\b" \
   src/renderer/components/ --include="*.vue" | wc -l

# 6. CLAUDE.md 移除「coexistence」段 → 預期 0
grep -c "shadcn-vue + spectre coexistence\|spectre coexistence" CLAUDE.md

# 7. CLAUDE.md 補上「Tailwind v4」單一段 → 預期非 0
grep -c "shadcn-vue + Tailwind v4" CLAUDE.md
```

**全綠的判定**：1, 2, 4, 5, 6 應為 0；3 應顯示 not found；7 應為非 0。

```bash
# 一鍵總檢
cd e:/source/antares2 && {
  echo -n "1. main.scss spectre imports: "; grep -c "^@import.*spectre" src/renderer/scss/main.scss
  echo -n "2. package.json spectre.css: "; node -e "console.log(require('./package.json').dependencies['spectre.css'] ? 'STILL EXISTS' : 0)"
  echo -n "3. node_modules/spectre.css: "; ls node_modules/spectre.css >/dev/null 2>&1 && echo "STILL EXISTS" || echo "removed ✓"
  echo -n "4. src spectre refs: "; grep -rln "spectre" src/ 2>/dev/null | grep -v "\.md$" | wc -l
  echo -n "5. spectre class in vues: "; grep -rln "class=[\"'][^\"']*\b\(form-input\|form-select\|form-label\|btn\b\|modal-container\|tab-block\)\b" src/renderer/components/ --include="*.vue" 2>/dev/null | wc -l
  echo -n "6. CLAUDE.md coexistence: "; grep -c "spectre coexistence" CLAUDE.md
  echo -n "7. CLAUDE.md new section: "; grep -c "shadcn-vue + Tailwind v4" CLAUDE.md
}
# 預期：0 / 0 / removed ✓ / 0 / 0 / 0 / 1+
```

---

## 9. Manual Smoke Test Plan

裝完新 installer，跑全功能逐項：

- [ ] 啟動 app，看到主畫面（無破版）
- [ ] **連線管理**：左下 cog → 「Connections」→ 新增連線 → save → 連線
- [ ] **Schema browse**：在 Explore bar 展開 schema → 點開一個表 → 看 Props/Data tabs
- [ ] **編輯表結構**：Props tab → 改一個欄位 → save → 看 SQL → confirm
- [ ] **Query**：Query tab → 寫 SELECT → 跑 → 看結果表
- [ ] **DDL view**：點某個表 → DDL modal → 複製 SQL
- [ ] **建立物件**：右鍵 schema → New Table → 填欄位 → save
- [ ] **Settings**：cog → Settings → 切換每個 tab → 切 dark/light theme → 改 shortcut
- [ ] **History**：cog → History modal → 看歷史 query
- [ ] **Scratchpad**：右側 → 加一個 note → 改 → 刪
- [ ] **Notification**：故意斷線 → 看到 toast → 點 close
- [ ] **Right click**：sidebar 連線 → 右鍵 → 看 context menu 出現
- [ ] **Tooltip**：hover footer 圖示按鈕 → tooltip 出現
- [ ] **Keyboard shortcut**：Ctrl+Enter 跑 query、Ctrl+S save 表結構等
- [ ] **dark / light 切換**：在每個畫面切一次，無顏色錯亂

如果任何步驟破版 / 行為變化 → 該畫面所屬的 batch 沒做完，**不可** merge Batch 10。

---

## 10. Rollback

**整 batch 回退**：
```bash
git revert <batch-10-commits>...
pnpm install  # 重新裝 spectre.css
```

副作用：
- spectre 又進來，所有 batch 0-9 的元件視覺**不變**（因為它們不依賴 spectre class，只是與 spectre 同居）
- root font-size 回到 20px，所有 §4.1 sed 替換的 `text-xs` 等 token 又被 ×1.25
- 等於回到「全 shadcn-vue 但 spectre 還在」狀態，可繼續其他 PR

**不可單獨回退**：§4.1 的 sed 替換不可單獨 revert（會留 mixed state）— 要 revert 就連 spectre 一起 revert。

---

## 11. Commit Message

建議拆 4 個 commit：

```
refactor(scss): remove spectre.css imports from main.scss

Drops 32 @import lines for spectre modules. Custom partials
(_data-types, _db-icons, _editor-icons, themes/*) remain because
they're antares-specific, not spectre-dependent.

Per spec: docs/superpowers/specs/shadcn-phase2/batch-10-spectre-removal.md §4.2
```

```
chore(deps): drop spectre.css

Removes spectre.css from package.json. pnpm-lock.yaml regenerated.

Per spec: docs/superpowers/specs/shadcn-phase2/batch-10-spectre-removal.md §4.4
```

```
refactor(tailwind): reclaim arbitrary tokens to native tailwind

With root font-size restored to 16px (spectre removal), text-[12px] /
h-[24px] / p-[8px] etc. now correspond to native text-xs / h-6 / p-2.
Batch sed replacement applied across all components.

Per spec: docs/superpowers/specs/shadcn-phase2/batch-10-spectre-removal.md §4.1
```

```
docs: complete Phase 2 — full shadcn-vue migration

CLAUDE.md / ui-spec.md / CHANGELOG.md updated to reflect:
- spectre.css removed
- html root font-size restored to 16px
- 21 shadcn-vue primitives now drive all UI
- 74 components migrated across Batches 0-9

Per spec: docs/superpowers/specs/shadcn-phase2/batch-10-spectre-removal.md §4.5-§4.7
```

---

**End of Batch 10 Spec.** This is the terminal batch — Phase 2 完工後，更新 00-index.md 把所有 batch 標記 ✅。
