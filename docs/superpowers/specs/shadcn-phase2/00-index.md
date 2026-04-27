# Phase 2 shadcn-vue Migration — Implementation Specs Index

**所屬 Plan**：[../../plans/2026-04-28-shadcn-vue-phase-2-full-migration.md](../../plans/2026-04-28-shadcn-vue-phase-2-full-migration.md)
**Spec 規格集建立日期**：2026-04-28
**狀態**：Phase 2 尚未開工，所有 batch 為 ☐ 未開始

本資料夾為 Phase 2 全 app shadcn-vue 遷移的**逐批執行 runbook**。Plan 說「做什麼」，Spec 說「具體怎麼改 + 怎麼驗 + 漏了 grep 找得出來」。

---

## 進度表（Progress Table）

| Batch | Spec | 元件數 | 狀態 | 開工 | 完工 | PR |
|-------|------|--------|------|------|------|----|
| 0 | [batch-00-prep.md](batch-00-prep.md) | 12 primitives | ☐ 未開始 | — | — | — |
| 1 | [batch-01-base-select.md](batch-01-base-select.md) | 1（53 callers） | ☐ 未開始 | — | — | — |
| 2 | [batch-02-tier-b-cleanup.md](batch-02-tier-b-cleanup.md) | 11 | ☐ 未開始 | — | — | — |
| 3 | [batch-03-settings-modals.md](batch-03-settings-modals.md) | 10 | ☐ 未開始 | — | — | — |
| 4 | [batch-04-schema-modals.md](batch-04-schema-modals.md) | 8 | ☐ 未開始 | — | — | — |
| 5 | [batch-05-workspace-props.md](batch-05-workspace-props.md) | 13 | ☐ 未開始 | — | — | — |
| 6 | [batch-06-workspace-new.md](batch-06-workspace-new.md) | 9 | ☐ 未開始 | — | — | — |
| 7 | [batch-07-sidebar-explore.md](batch-07-sidebar-explore.md) | 10 | ☐ 未開始 | — | — | — |
| 8 | [batch-08-scratchpad.md](batch-08-scratchpad.md) | 4 | ☐ 未開始 | — | — | — |
| 9 | [batch-09-notif-empty-shell.md](batch-09-notif-empty-shell.md) | 6 | ☐ 未開始 | — | — | — |
| 10 | [batch-10-spectre-removal.md](batch-10-spectre-removal.md) | 0（僅刪除） | ☐ 未開始 | — | — | — |
| **總計** | | **74 元件 + 12 primitives** | | | | |

> 狀態圖示：☐ 未開始 / 🔧 進行中 / 🔍 review 中 / ✅ 已完成 / ⏸ 暫停 / ❌ 取消
>
> 開工時更新狀態為 🔧 並填上開工日；完工填 PR 連結與完工日。

---

## 推薦閱讀順序（給接手的 Claude / 人）

如果你只有 30 分鐘，依序讀這 4 份就能掌握全局：

1. **本檔（00-index）** — 5 分鐘，整體進度與順序
2. **[batch-00-prep.md](batch-00-prep.md)** — 10 分鐘，所有後續批次依賴的基礎建設
3. **[batch-10-spectre-removal.md](batch-10-spectre-removal.md)** — 10 分鐘，Phase 2 的終點長相，影響每個批次的取捨
4. **[batch-01-base-select.md](batch-01-base-select.md)** — 5 分鐘，最高 leverage 的單檔遷移範本

讀完這 4 份後，**任何 batch 你都能直接開工**。

---

## 為什麼有這 12 份文件

回應使用者明確擔憂：「**我怕你沒有改到**」。

Plan 文件解決不了這擔憂 — 它只描述「做什麼」。Spec 透過三層機制保證**無遺漏**：

1. **明確檔案清單**：每份 spec §1 列出本批所有檔名 + 行數，從 parent plan 附錄 A 抄過來，無轉錄錯誤。
2. **「Pre-flight Drift Check」**（§2）：開工前跑 grep，記錄當下 spectre 殘留量；改完再跑同樣 grep，看數字必須降到 0（或 spec 註明的 allowlist）。
3. **「Completion Detection Grep」**（§8）：每份 spec 都有一條 deterministic 指令，回 0 才算完成。**人腦會漏，grep 不會。**

---

## Spec 11 段落結構速查

每份 batch spec 都有相同 11 段：

| § | 段落 | 用途 |
|---|------|------|
| 1 | Scope | 本批檔案清單 + 排除清單 |
| 2 | Pre-flight Drift Check | 開工前殘留量基準 |
| 3 | Primitives Used | 用到哪些 shadcn-vue primitive |
| 4 | Common Transformations | 共通 before/after 範例 |
| 5 | Per-File Detailed Steps | 逐檔細節 |
| 6 | New Files Created | 新抽出的元件（如有） |
| 7 | Acceptance Checklist | per-PR 驗收清單 |
| 8 | **Completion Detection Grep** | 漏改自動偵測（核心） |
| 9 | Manual Smoke Test Plan | 5-10 個操作驗證 |
| 10 | Rollback | 回退步驟 + 副作用 |
| 11 | Commit Message | 建議格式 |

---

## 全 74 元件覆蓋驗證

執行 spec 撰寫完成後，跑：

```bash
cd e:/source/antares2

# 從 parent-plan 附錄 A 抽出所有元件名（74 個）
sed -n 's/^[0-9]\+\. `\([A-Za-z]*.vue\)`/\1/p' \
   docs/superpowers/plans/2026-04-28-shadcn-vue-phase-2-full-migration.md \
   > /tmp/phase2-components.txt

# 確認每個都至少在某 spec 出現
while read comp; do
   if ! grep -rq "$comp" docs/superpowers/specs/shadcn-phase2/; then
      echo "MISSING from specs: $comp"
   fi
done < /tmp/phase2-components.txt

# 預期輸出為空 → 全 74 元件皆有 spec 涵蓋
```

如果有 MISSING 輸出 → 對應的 spec 必須補上該元件。

---

## 跨 spec 共用參照

每份 spec 都會引用以下檔案當「目標長相」或「pattern 範本」：

| 參照檔 | 用途 | 哪些 spec 會引用 |
|--------|------|------------------|
| `BaseConfirmModal.vue` | shadcn Dialog 包裝範本 | batch-02、03、04、05、06、08 |
| `ModalFakerRows.vue` | 整檔純 shadcn 黃金範本 | batch-02、03、04、05、06、08 |
| `WorkspaceTabPropsTableEditModal.vue` | Dialog + FormField + Select 組合範本 | batch-02、03、04 |
| `ui/input/Input.vue` | 本地 patch 過的 text-foreground 規格 | batch-00、所有用 raw input 的 batch |
| `ui/form-field/FormField.vue` | FormField 組合規格 | 所有需要 form 的 batch |
| `assets/tailwind.css` | hex token / dark variant / color-scheme | batch-00、batch-10 |

---

## Spec rev 與 codebase 飄移

每份 batch spec 結尾標註：

```
**Spec rev**：2026-04-28 against commit <hash>
```

**規則**：超過 30 天未實作該 batch，必須 re-audit（重跑 §2 pre-flight grep，比較與 spec 寫成時的差距，若 codebase 已飄移 > 20%，spec 需更新或重寫）。

理由：codebase 持續演化（特別是 spectre 殘留量會被其他 PR 不知不覺地改變），spec 內的 grep 結果會失真，而 spec 的 §5 per-file step 可能引用已不存在的行號。

---

## 開工前自我檢查（每個 Batch 開工時跑）

```bash
# 1. 確認 parent plan 沒被修改（影響 spec 假設）
git log --oneline docs/superpowers/plans/2026-04-28-shadcn-vue-phase-2-full-migration.md | head -5

# 2. 確認本 spec 沒被修改
git log --oneline docs/superpowers/specs/shadcn-phase2/batch-NN-<slug>.md | head -5

# 3. 跑 spec §2 pre-flight grep，看當下殘留量
# (見各 batch spec)

# 4. 確認前置依賴 batch 都完成（看 00-index 進度表）

# 5. 切新 branch
git checkout -b shadcn/batch-NN-<slug>
```

如果 1/2 顯示有非預期的近期修改 → 先讀那些 commit 確認影響範圍。

---

## 並行化建議

依 parent plan §6，以下 batch 互不相依，可並行執行（多人或多 worktree）：

```
Batch 0  ──┐
           ├─→ Batch 1 ─→ Batch 2 ─┬─→ Batch 3 ─┐
           │                         ├─→ Batch 4 ├─→ Batch 7 ─→ Batch 10
           │                         ├─→ Batch 5 │
           │                         ├─→ Batch 6 │
           │                         ├─→ Batch 8 │
           │                         └─→ Batch 9 ┘
```

並行時每個 worker 用獨立 worktree（`git worktree add ../antares2-batch-N`），避免 lock file 與 sidecar 衝突。

---

**End of Index.**
