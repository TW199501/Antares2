# Plan: 補齊 zh-TW 繁體中文翻譯缺失

## Context

執行 `pnpm translation:check zh-TW` 發現 570 個字串中有 19 個完全缺失（"Translation missing!"）、
1 個值與英文相同但應翻譯（`database.drop`）。缺失的 key 在執行期會 fallback 到英文顯示，
影響繁體中文使用者體驗。

計劃文件正式位置：`docs/superpowers/plans/zh-TW-translation-fix.md`

**唯一修改的檔案：** `src/renderer/i18n/zh-TW.ts`

**使用 skill：** `davila7/claude-code-templates@i18n-localization`（已安裝）

---

## 執行順序

### 前置：將計劃複製到正確位置
複製本計劃到 `docs/superpowers/plans/zh-TW-translation-fix.md`

### 呼叫 i18n-localization skill
使用 Skill 工具載入 i18n-localization skill，按其指引進行翻譯工作。

---

## Step 1 — 修 `database` 區塊（8 個缺失 + 1 個未翻譯）

**修改 `drop`（line 164，現值 'Drop'）：**
```ts
drop: '刪除',
```

**在 `savedQueries` 之後（line 280）、`},` 之前插入：**
```ts
tableChecks: '資料表檢查',
materializedView: '物化視圖 | 物化視圖',
manageTableChecks: '管理資料表檢查',
createNewCheck: '新增檢查',
checkClause: '檢查子句',
thereAreNoTableChecks: '沒有資料表檢查',
createNewMaterializedView: '新增物化視圖',
newMaterializedView: '新的物化視圖',
```

---

## Step 2 — 修 `application` 區塊（11 個缺失）

**在 `openNotes` 之後（line 402）、`},` 之前插入：**
```ts
customIcon: '自訂圖示',
newFolder: '新增資料夾',
outOfFolder: '移出資料夾',
invalidFile: '無效的檔案',
debugConsole: '除錯主控台',
executedQueries: '已執行的查詢',
sizeLimitError: '已超過 {size} 的大小上限',
fullScreen: '全螢幕',
zoomIn: '放大',
zoomOut: '縮小',
zoomReset: '重設縮放',
```

---

## 不需修改的項目

| Key | 原因 |
|-----|------|
| `connection.ssl` | SSL 為縮寫，保留英文正確 |
| `faker.git/lorem/bs/iban/bic/ip/ipv6/mac/slug/float/uuid/semver/fuel/vin` | 技術專有名詞，繁中慣用英文 |

---

## 驗證

```bash
pnpm translation:check zh-TW
# 期望：所有 "Translation missing!" 消失，database.drop 不再顯示 "not translated"
```
