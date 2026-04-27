# Batch 3 — Settings & 系統 Modal（10 個）

**前置依賴**：Batch 0（Switch / Tooltip / Card / RadioGroup / Sonner）+ Batch 1
**估時**：2.5 天
**對應 Plan 段落**：parent-plan §3 Batch 3
**Spec rev**：2026-04-28 against commit `fd44e3a`

---

## 1. Scope

10 個檔（parent-plan 附錄 A.3 #15-#24）：

| # | 檔名 | 主要 UI 元素 |
|---|------|--------------|
| 15 | `ModalSettings.vue` | Dialog 殼 + 6 tab 導覽 |
| 16 | `ModalSettingsUpdate.vue` | Form（updater 設定） |
| 17 | `ModalSettingsData.vue` | tab 殼包 import/export |
| 18 | `ModalSettingsDataImport.vue` | Form + file picker |
| 19 | `ModalSettingsDataExport.vue` | Form + checkbox 群 |
| 20 | `ModalSettingsShortcuts.vue` | List + KeyPressDetector |
| 21 | `ModalConnectionAppearance.vue` | Color picker + name input |
| 22 | `ModalFolderAppearance.vue` | Color picker + name input |
| 23 | `DebugConsole.vue` | Console output + filter |
| 24 | `ModalProcessesList.vue` | Table + refresh button |

### 1.2 排除清單

- 不動 `KeyPressDetector.vue`（Batch 9）
- 不動 settings store 邏輯（只動 UI）

---

## 2. Pre-flight Drift Check

```bash
cd e:/source/antares2

for f in ModalSettings ModalSettingsUpdate ModalSettingsData ModalSettingsDataImport \
         ModalSettingsDataExport ModalSettingsShortcuts ModalConnectionAppearance \
         ModalFolderAppearance DebugConsole ModalProcessesList; do
   c=$(grep -cE "form-input|form-select|form-label|form-checkbox|form-switch|btn |modal-container|tab-block|panel|chip" \
       src/renderer/components/$f.vue 2>/dev/null)
   echo "$f: $c"
done
```

---

## 3. Primitives Used

- 既有：`Dialog` / `Tabs` / `FormField` / `Input` / `Label` / `Select` / `Checkbox` / `Button`
- Batch 0 新加：`Switch` / `RadioGroup` / `Tooltip` / `Card` / `Textarea`

---

## 4. Common Transformations

### 4.1 Settings 殼：Dialog + Tabs（左側 vertical tabs）

```vue
<Dialog :open="isOpen" @update:open="(v) => !v && hideModal()">
  <DialogContent class="max-w-[800px] max-h-[85vh] !p-0 [&>button.absolute]:!hidden">
    <Tabs v-model="activeTab" orientation="vertical" class="flex h-full">
      <TabsList class="flex flex-col items-stretch w-[180px] border-r bg-muted/30 p-2 gap-1">
        <TabsTrigger value="general">{{ t('settings.general') }}</TabsTrigger>
        <TabsTrigger value="appearance">{{ t('settings.appearance') }}</TabsTrigger>
        <TabsTrigger value="shortcuts">{{ t('settings.shortcuts') }}</TabsTrigger>
        <TabsTrigger value="data">{{ t('settings.data') }}</TabsTrigger>
        <TabsTrigger value="updates">{{ t('settings.updates') }}</TabsTrigger>
        <TabsTrigger value="changelog">{{ t('settings.changelog') }}</TabsTrigger>
      </TabsList>
      <div class="flex-1 overflow-y-auto p-6">
        <TabsContent value="general">...</TabsContent>
        <TabsContent value="appearance">...</TabsContent>
        ...
      </div>
    </Tabs>
  </DialogContent>
</Dialog>
```

### 4.2 Switch 替 form-switch

```vue
<!-- Before -->
<label class="form-switch">
  <input type="checkbox" v-model="settings.notifications" />
  <i class="form-icon"></i> Notifications
</label>

<!-- After -->
<div class="flex items-center justify-between gap-2">
  <Label for="notif">Notifications</Label>
  <Switch id="notif" v-model:checked="settings.notifications" />
</div>
```

### 4.3 RadioGroup 替 form-radio

```vue
<!-- Before -->
<label class="form-radio">
  <input type="radio" name="theme" value="light" v-model="theme" />
  <i class="form-icon"></i> Light
</label>
<label class="form-radio">
  <input type="radio" name="theme" value="dark" v-model="theme" />
  <i class="form-icon"></i> Dark
</label>

<!-- After -->
<RadioGroup v-model="theme">
  <div class="flex items-center gap-2">
    <RadioGroupItem id="theme-light" value="light" />
    <Label for="theme-light">Light</Label>
  </div>
  <div class="flex items-center gap-2">
    <RadioGroupItem id="theme-dark" value="dark" />
    <Label for="theme-dark">Dark</Label>
  </div>
</RadioGroup>
```

### 4.4 Card 替 settings 區塊

```vue
<Card>
  <CardHeader>
    <CardTitle class="text-sm">Auto-update</CardTitle>
    <CardDescription>How antares2 checks for new versions</CardDescription>
  </CardHeader>
  <CardContent class="space-y-4">
    <Switch v-model:checked="settings.autoUpdate" />
    <FormField name="updateChannel">...</FormField>
  </CardContent>
</Card>
```

---

## 5. Per-File Detailed Steps

### 5.1 `ModalSettings.vue`（殼，最先做）

**Step 1**：把現有的 `<Modal>` 殼換成 §4.1 結構。
**Step 2**：vertical tabs 設計：左 180px tabs / 右 1fr content。
**Step 3**：sticky DialogFooter 放 Apply / Cancel button。

### 5.2 - 5.4 各 tab 內容（settings tab 是 ModalSettings 內的 6 個 tab，但有些抽出獨立 modal）

對照每個 tab 用 §4.2 / §4.3 / §4.4 pattern。

### 5.5 `ModalConnectionAppearance.vue` + `ModalFolderAppearance.vue`

**Step 1**：用 `Dialog` 殼。
**Step 2**：name input 用 `<Input>`。
**Step 3**：color picker — 12 個顏色按鈕 grid，每個是小圓 `<Button variant="ghost" size="icon">`，用 `bg-[var(--color-connection-N)]` 套 Batch 0 補的 token。
**Step 4**：選中態加 ring outline。

### 5.6 `DebugConsole.vue`

**Step 1**：`<Dialog>` 殼。
**Step 2**：日誌區用 `<Card>` + `<Textarea readonly>`（font-mono 等寬字）。
**Step 3**：filter input 用 `<Input>`。
**Step 4**：Clear / Copy / Export 按鈕用 `<Button>` 不同 variant。

### 5.7 `ModalProcessesList.vue`

**Step 1**：`<Dialog>` 殼。
**Step 2**：表本身保留現實作（如有 BaseVirtualScroll）— 只動殼與 toolbar。
**Step 3**：refresh 按鈕用 `<Button variant="outline" size="sm">`，配 `<Tooltip>` 顯示「Refresh」。

### 5.8 `ModalSettingsShortcuts.vue`

**Step 1**：`<Dialog>` 殼。
**Step 2**：每個 shortcut row 用 grid layout：左 label，右 KeyPressDetector + clear button。
**Step 3**：**KeyPressDetector 元件本身不動** — 只把外層改 shadcn。

---

## 6. New Files Created

無。可選擇抽出 `SettingRow.vue`（label + control 共用 layout）但非必要。

---

## 7. Acceptance Checklist

- [ ] 10 個檔殘留 spectre class 為 0
- [ ] 所有設定切換 / 儲存 / reset OK
- [ ] dark / light theme 切換不破畫面
- [ ] keyboard shortcut detection 在 ModalSettingsShortcuts 仍可用
- [ ] CJK 字型在 label / input 顯示正常
- [ ] Color picker 12 顏色都點得到、選中態明顯
- [ ] Process list 表正確顯示 + refresh OK
- [ ] §8 grep 全綠

---

## 8. Completion Detection Grep

```bash
cd e:/source/antares2

for f in ModalSettings ModalSettingsUpdate ModalSettingsData ModalSettingsDataImport \
         ModalSettingsDataExport ModalSettingsShortcuts ModalConnectionAppearance \
         ModalFolderAppearance DebugConsole ModalProcessesList; do
   c=$(grep -cE "class=\"[^\"]*\b(form-input|form-select|form-label|form-checkbox|form-switch|form-group|btn |modal-container|tab-block|panel|chip)\b" \
       src/renderer/components/$f.vue 2>/dev/null)
   echo "$f: $c"
done
# 預期：每行 0
```

```bash
# 一鍵總檢
cd e:/source/antares2 && total=0 && for f in ModalSettings ModalSettingsUpdate ModalSettingsData ModalSettingsDataImport ModalSettingsDataExport ModalSettingsShortcuts ModalConnectionAppearance ModalFolderAppearance DebugConsole ModalProcessesList; do
   c=$(grep -cE "class=\"[^\"]*\b(form-input|form-select|form-label|form-checkbox|form-switch|btn |modal-container|tab-block)\b" src/renderer/components/$f.vue 2>/dev/null)
   total=$((total + c))
done && echo "Total Batch 3 residue: $total"
# 預期：0
```

---

## 9. Manual Smoke Test Plan

- [ ] 開 Settings → 切每個 tab
- [ ] General tab：切 language → app 重整
- [ ] Appearance tab：切 dark/light → 全畫面 theme 變
- [ ] Shortcuts tab：點某 shortcut → 按鍵 → 看到捕捉成功
- [ ] Data tab → Import：選檔 → 預覽 → 匯入
- [ ] Data tab → Export：選 schema → 匯出
- [ ] Updates tab：切 channel + auto-update toggle
- [ ] Connection appearance：右鍵連線 → Appearance → 改色 + 名稱 → save
- [ ] Folder appearance 同上
- [ ] Debug Console：開 → 看 log → filter
- [ ] Processes List：開 → refresh → 看清單

---

## 10. Rollback

每檔獨立 revert。Settings 殼 (`ModalSettings.vue`) 若回退會讓所有 tab 回到舊 `<Modal>` 殼，但內 tab 內容不變。

---

## 11. Commit Message

建議拆 3 個 commit：

```
refactor(modal-settings): migrate settings shell to shadcn Dialog + Tabs

ModalSettings.vue + ModalSettingsUpdate.vue + ModalSettingsData.vue +
ModalSettingsDataImport.vue + ModalSettingsDataExport.vue +
ModalSettingsShortcuts.vue.

Per spec: docs/superpowers/specs/shadcn-phase2/batch-03-settings-modals.md
```

```
refactor(modal-appearance): migrate connection/folder appearance modals

ModalConnectionAppearance.vue + ModalFolderAppearance.vue.

Per spec: docs/superpowers/specs/shadcn-phase2/batch-03-settings-modals.md
```

```
refactor(modal-debug): migrate DebugConsole + ModalProcessesList

Per spec: docs/superpowers/specs/shadcn-phase2/batch-03-settings-modals.md
```

---

**End of Batch 3 Spec.**
