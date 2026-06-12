# Plan: ModalSettings 開關按鈕對比度修正

## Context

使用者回報「系統設置選項中，UI 有關開關的開關按鈕顯示不清楚」。經 read-only 探勘確認，這是 **全環境（light + dark mode）皆存在的對比度問題**，非單純 dark mode 顯示問題。

問題出在 [src/renderer/components/ui/switch/Switch.vue](src/renderer/components/ui/switch/Switch.vue) 的 token 選擇：

| 環境 | Track (unchecked) | Thumb | 對比 |
|------|-------------------|-------|------|
| Light unchecked | `bg-muted` = `#f4f4f7` | `bg-background` = `#ffffff` | **1.1:1 ❌** |
| Light checked | `bg-primary` = `#FF5000` | `bg-background` = `#ffffff` | OK |
| Dark unchecked | `bg-muted` = `#111530` | `bg-background` = `#08091A` | **1.05:1 ❌** |
| Dark checked | `bg-primary` = `#FF5000` | `bg-background` = `#08091A` | OK |

WCAG 圖形元件最低對比要求 3:1。Unchecked 狀態 thumb 與 track 在兩個 mode 都接近相同色值，肉眼幾乎看不到 thumb 滑塊位置 → 使用者不知道 switch 是 on 還是 off。

根因：本地 Switch 元件當初手動 port 時把 unchecked track 寫成 `bg-muted`（shadcn-vue 上游用 `bg-input`），又用 `bg-background` 給 thumb — 這兩個 token 在這套 navy-glass / lavender 配色下幾乎重疊。

影響範圍：[ModalSettings.vue](src/renderer/components/ModalSettings.vue) 共 6 個 Switch（General → Application/Editor 區塊），加上 [ModalSettingsUpdate.vue](src/renderer/components/ModalSettingsUpdate.vue) 1 個，總共 7 個。**全部都使用同一個 shadcn `<Switch />` primitive**，沒有 hand-rolled 版本，因此修一個檔案就解全部。

## Recommended Approach

只改一個檔案：[src/renderer/components/ui/switch/Switch.vue](src/renderer/components/ui/switch/Switch.vue)。

**(1) Track unchecked**: `bg-muted` → `bg-input`
- Light: `#f4f4f7` → `#e6e3ef`（lavender 較深，與 `#ffffff` 背景明顯區隔）
- Dark: `#111530` → `rgb(255 255 255 / 0.15)`（半透明白疊在 `#08091A` 上 ≈ `#2D2E3F`，從背景浮起）
- 與 shadcn-vue 上游 New York 預設一致

**(2) Thumb**: `bg-background` → state-aware（checked = `bg-primary-foreground` / unchecked = `bg-foreground`）
- Unchecked thumb 自動取「與背景相反」的色：light mode 深灰 `#0f0f1a`、dark mode 近白 `#f5f5fa` → 兩個 mode 對 unchecked track 都是 5:1+ 對比
- Checked thumb = `--primary-foreground` = `#ffffff`（兩 mode 皆然）→ 白 thumb on 橘 track，視覺一致且鮮明
- 完全用 design token，不寫 arbitrary value，不破壞 design system

**(3) 不改的部分**：
- 尺寸 `h-5 w-9`（與上游一致，不做 scope creep）
- API：props / emits / `v-model:checked` 簽名不動
- ModalSettings.vue / ModalSettingsUpdate.vue 不需動（呼叫端零 churn）

## Files to Modify

| File | Change |
|------|--------|
| [src/renderer/components/ui/switch/Switch.vue](src/renderer/components/ui/switch/Switch.vue) | Root class: `data-[state=unchecked]:bg-muted` → `data-[state=unchecked]:bg-input`<br>Thumb class: `bg-background` → `data-[state=checked]:bg-primary-foreground data-[state=unchecked]:bg-foreground` |

預估 diff：2 行 class 字串。

## Diff Preview

```diff
- :class="cn('peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted', props.class)"
+ :class="cn('peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input', props.class)"

  <SwitchThumb
-    class="pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
+    class="pointer-events-none block h-4 w-4 rounded-full shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0 data-[state=checked]:bg-primary-foreground data-[state=unchecked]:bg-foreground"
  />
```

## Verification

修改後：

1. **`pnpm tauri:dev`** 啟動 app（dev sidecar 已知佔用 5555，**不要** kill — 直接重啟即可，記憶 `feedback_dont_kill_sidecar_port.md`）。
2. **測試矩陣**（Settings → 各 tab 觀察開關）：
   - Light mode 下：General → Application 三個 switch、Editor 三個 switch、Update tab 一個 switch — toggle 觀察 thumb 在 on/off 兩態都明顯可見
   - 切到 Dark mode（Themes tab → Dark），重複上述
3. **SpecSnap 量測**（可選但建議，記憶 `feedback_specsnap_data_is_ground_truth.md`）：開 SpecSnap inspector → 抓任一 Switch unchecked 狀態 → 確認 thumb 與 track 的 computed background 至少 3:1 對比。
4. **無回歸**：
   - Switch 之外的 `bg-muted` 用法（Card / Badge 等）不受影響 — 我們只動 Switch.vue
   - `pnpm type-check` 不應新增 error（class 字串改動不影響型別）
   - `pnpm lint` 應 pass

## Out of Scope

- 不調整 Switch 尺寸（沿用 `h-5 w-9`）
- 不動 `--muted` token 本身（其他元件可能依賴目前色值）
- 不處理 ModalSettings.vue 既有的 uncommitted diff（移除 translation footnote — 與本 bug 無關，由使用者自行決定保留與否）
- 不擴大到其他 modal 的 switch 檢查（已確認 grep 結果只有 ModalSettings* 用 Switch，且全部都是同一個 primitive）
