# Plan: 4 個 Workspace Table Properties UI 修復

## Context

使用者根據 SpecSnap (2026-05-02T19:00:30, frame `dbo.ding_talk_wokerflow_config`) 對 Workspace 的 table properties 編輯器提出 4 個 UI 修復，全部圍繞「資訊密度低 / 寬度不夠 / 按鈕不顯眼」的核心痛點。target tag 是下一個 release（v0.8.5）。

**SpecSnap 量到的具體狀態**：
- 字段名 input 寬 **176px**（使用者要 200px）
- 字體 14px Inter / `Microsoft JhengHei` / `PingFang TC`，行高 20px
- border-radius 6, padding 0/12/0/12, 高度 32px
- 上述 (h-32, rounded-md, font 14, padding 12) 是這個 release 內所有屬性編輯區的「標準 cell」樣式，後面 3 項要對齊

---

## Item 1 — 字段名欄位寬度 176 → 200

**單行修改**：`WorkspaceTabPropsTableFields.vue` line 28：

```diff
-               <div class="column-resizable min-120">
+               <div class="column-resizable min-200">
```

`.min-200` 的 SCSS 規則已存在於同檔 line 291-293（`min-width: 200px !important`），不需新加 CSS。Comment 欄位 (line 79) 已用 `min-200`，這個改動讓字段名跟 Comment 等齊。

**修改檔案**：[src/renderer/components/WorkspaceTabPropsTableFields.vue:28](../../../src/renderer/components/WorkspaceTabPropsTableFields.vue#L28)

---

## Item 2 — 每列「修改」按鈕 + 編輯 modal 內容補完

### 2a. 修改按鈕已存在但不顯眼

[`WorkspaceTabPropsTableRow.vue:201-209`](../../../src/renderer/components/WorkspaceTabPropsTableRow.vue#L201) 早就有 edit 按鈕，但 `variant="ghost"` + `opacity-55` + 24×24 → 沒邊框、半透明、小，使用者沒注意到。改成 `variant="outline"` 28×28 sky-blue 邊框常駐顯眼版。

### 2b. 編輯 modal 補齊 charset / collation 兩欄

[`WorkspaceTabPropsTableEditModal.vue`](../../../src/renderer/components/WorkspaceTabPropsTableEditModal.vue) 目前缺 `charset` (BaseSelect, 可編輯) + `collation` (read-only display) 兩欄。`TableField` model 已有這 2 個 field（confirmed by `WorkspaceTabPropsTable.vue:720-721` 的 `buildDraftField()`），純粹是 modal UI 沒 expose。

新增於 Default 之後、Comment 之前。i18n keys 待加（5 locale）：
- `database.charset` / `database.collation` / `database.inheritFromTable`

### 2c. 描述翻譯：Claude → Google Translate (free, no key)

[`WorkspaceTabPropsTableEditModal.vue:132-145`](../../../src/renderer/components/WorkspaceTabPropsTableEditModal.vue#L132) 的「🌐 翻譯」按鈕需要 `settingsStore.aiApiKey` 才能用。改用 Google 公開非官方 endpoint：

```
GET https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl={target}&dt=t&q={text}
```

`{target}` = 目前 UI locale BCP 47 code。後端 [src/main/routes/ai.ts](../../../src/main/routes/ai.ts) 整支重寫 — fetch Google endpoint，parse nested array (`result[0][0][0]`)，不需 API key。前端移除 `aiApiKey` disabled 條件 + 警告 `<p>`。

i18n key 改名：`database.translateWithAi` → `database.translateDescription`，移除 `database.aiKeyRequired`。

---

## Item 3 — Indexes Modal 重排 + 寬度

[`WorkspaceTabPropsTableIndexesModal.vue`](../../../src/renderer/components/WorkspaceTabPropsTableIndexesModal.vue) (307 行)：

1. `BaseConfirmModal size="resize"`（95vw × 95vh）
2. 左右比例 5:7 → 4:8
3. 右編輯區 fields list `max-h-[300px]` → `max-h-[50vh]`
4. Add Index 按鈕放左 panel sticky header

---

## Item 4 — Foreign Keys Modal 清晰度 + 參考表 picker

[`WorkspaceTabPropsTableForeignModal.vue`](../../../src/renderer/components/WorkspaceTabPropsTableForeignModal.vue) (447 行)：

### 4a. Modal 結構（同 Item 3）
- `size="resize"`，左右 4:8

### 4b. 參考表 picker 升級 Combobox
Line 153 `BaseSelect` 加 `searchable` prop（BaseSelect internal 已支援 → 內部走 Combobox path）。

### 4c. fk-details 摘要 row 別 truncate
Line 76-95 把 `max-width: calc(100% - 1rem)` 換成 `flex flex-wrap gap-1`。

### 4d. Reference Schema 連動
加 watcher 讓 schema 變更時 refTable options 自動 reload，無效選擇被清空。

---

## 執行順序

1. Item 1（1 行）
2. Item 2a（edit button 樣式）
3. Item 2b（modal 加 charset/collation + i18n）
4. Item 2c（Google Translate 後端＋前端＋i18n 重新命名）
5. Item 3（Indexes modal）
6. Item 4a-d（FK modal）

每個 Item commit 一次，prefix `fix(props-table)` / `feat(props-table)`。

---

## Verification

### Item 1
- 字段名 column DevTools 量寬度 200px

### Item 2a
- 編輯按鈕第一眼看到（28×28、藍色邊框）；點擊行為不變

### Item 2b
- Edit field → modal 顯示 charset (BaseSelect) + collation (read-only)
- `pnpm translation:check zh-TW` 等 100%；5 locale 各加 3 keys、無 empty

### Item 2c
- 不需 `aiApiKey` 也能翻譯；切換 UI 語言翻譯目標跟著變

### Item 3
- 寬度 95vw、高度 95vh；fields list 隨 modal 高度伸縮

### Item 4
- 參考表 picker 可 search；Schema 切換自動 reload；fk-details 換行不截斷

### 全域
- `pnpm lint` clean
- `pnpm vite:build` 通過
- `pnpm check:eol` 全 LF
- `pnpm type-check` 12 個 baseline error 不變

---

## 風險 / 副作用

- **Google Translate 公開 endpoint** (`client=gtx`) 是非官方 API，可能 IP throttle
- **Combobox 在 Dialog 內**：reka-ui teleport 到 `<body>`，需驗 `<DialogContent>` 的 `overflow: hidden` 不截 panel
- **`min-120 → min-200`** 整列加寬 ~80px，極窄 viewport (< 1280px) 可能觸發水平捲軸
- **修改 `ai.ts` 後端**：要重 build sidecar (`pnpm sidecar:build`) + commit `sidecar/antares-server.cjs`

---

## 不在這個計劃裡

- Apple Developer ID 簽章
- Tauri auto-updater 啟用 / `latest.json` manifest
- `create-generated-sources.yml` upstream 遺留 workflow
