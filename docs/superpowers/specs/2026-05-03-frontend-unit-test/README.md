# 前端單元測試導入 — Spec 索引

> 對應 plan：[`docs/superpowers/plans/2026-05-03-frontend-unit-test-rollout.md`](../../plans/2026-05-03-frontend-unit-test-rollout.md)

## 全域執行政策（**強制，所有 PR / Task 都遵守**）

| 項目 | 規定 | 違反後果 |
|------|------|---------|
| **模型** | Opus 4.7（`claude-opus-4-7`），dispatch subagent 也用 opus | Sonnet / Haiku 可能寫測試品質不足 |
| **Worktree** | **禁止** —— 不准 `git worktree add` | per user memory，使用者偏好 single-file + HMR |
| **Skill 啟動** | 每個 PR / Task 開始前**必須**先 invoke 該 task spec 列出的 skill | 防止 agent 自由發揮亂寫 |
| **Code 改動範圍** | 嚴格按本 spec「觸碰檔案清單」，**不得擴張** | 影響 review 範圍、容易藏 bug |
| **Spec 不過 = 不動 code** | 任一 spec user 沒批准前 0 行 source code 改動 | 違反 plan Phase 0 約定 |
| **Commit 範圍** | 一 PR 一 task 群組，不混 PR | review 困難 |
| **Commit 訊息** | Conventional Commits（`test:`、`feat:`、`refactor:`、`chore:`）| commitlint 會擋 |

## Skill 對照表（每個 task 必啟動的 skill）

| Task | 主 skill | 副 skill / 補充 |
|------|---------|----------------|
| T0 (rename) | `superpowers:executing-plans` | — |
| T1 (vitest config) | `superpowers:executing-plans` | — |
| T2 (global setup) | `superpowers:test-driven-development` | — |
| T3 sample | `superpowers:test-driven-development` | — |
| T3 common-utils | `superpowers:test-driven-development` | `superpowers:subagent-driven-development`（15 utils 並行） |
| T4 renderer-libs | `superpowers:test-driven-development` | `superpowers:subagent-driven-development` |
| T5 customizations | `superpowers:test-driven-development` | — |
| T6 composables | `superpowers:test-driven-development` | `vuejs-typescript-best-practices` |
| T7 fixture capture | `superpowers:executing-plans` | — |
| T8 ipc replay | `superpowers:test-driven-development` | `superpowers:subagent-driven-development`（14 wrappers 並行） |
| T9 stores batch1 | `superpowers:test-driven-development` | `vuejs-typescript-best-practices` |
| T10 stores batch2 | `superpowers:test-driven-development` | `vuejs-typescript-best-practices` |
| T11 stores batch3 | `superpowers:test-driven-development` | `vuejs-typescript-best-practices` |
| T12 shadcn interactions | `superpowers:test-driven-development` | `shadcn-vue` + `vuejs-typescript-best-practices` |
| T13 base primitives | `superpowers:test-driven-development` | `superpowers:subagent-driven-development`（20+ 元件並行） + `vuejs-typescript-best-practices` |
| T14 the + business | `superpowers:test-driven-development` | `vuejs-typescript-best-practices` |
| T15 Playwright | `superpowers:executing-plans` | — |
| T16 coverage gate | `superpowers:executing-plans` | — |
| T17 CI integration | `superpowers:executing-plans` | — |

## Skill 為什麼這樣分

- **`superpowers:executing-plans`**（純執行型）：T0 / T1 / T7 / T15 / T16 / T17 都是「按 spec 改 config 或寫 script」，沒有測試品質的判斷負擔，executing-plans 紀律就足夠
- **`superpowers:test-driven-development`**（測試品質型）：T2 - T6 / T8 - T14 都是寫測試，必須保有 TDD 紀律 —— 紅 → 綠 → 重構，不為覆蓋率寫空殼測試
- **`superpowers:subagent-driven-development`**（並行型）：T3 / T4 / T8 / T13 任務本身就是「N 個獨立 case」，subagent 並行省 50%+ 時間
- **`vuejs-typescript-best-practices`**（領域知識型）：所有牽涉 Vue 元件 / Pinia / TypeScript 類型推導的 task 都該載這個，避免反 best-practice 寫法
- **`shadcn-vue`**：T12 專屬，因為要碰 Reka UI / shadcn-vue primitive 內部結構

## Subagent dispatch 規範（T3 / T4 / T8 / T13）

dispatch subagent 時 **必須** 在 Agent tool call 加：

```
{
  "subagent_type": "general-purpose",
  "model": "opus",        ← 不可省
  "isolation": null,       ← 禁用 worktree
  "prompt": "..."
}
```

**不准設 `isolation: 'worktree'`**（per user memory `feedback_no_worktree_without_consent.md`）。



## Review 順序建議

**先看高風險 3 個**（決定整套要不要做）：
1. [T0 — src/ → web/ 改名](PR0-rename-src-to-web/T0-rename-and-path-update.md) — 改動面最大、最容易讓 build 紅
2. [T7 — IPC fixture 採集](PR3-fixture-capture/T7-capture-contract-fixtures.md) — 需要 dev DB 環境、是 .NET 契約凍結的核心
3. [T16 — Coverage gate 腳本](PR7-coverage-and-ci/T16-coverage-gate.md) — 60% hard gate 自寫腳本邏輯

**其次（infra）**：
4. [T1 — Vitest config](PR1-vitest-infra/T1-vitest-config.md)
5. [T2 — 全域 setup + helpers](PR1-vitest-infra/T2-global-setup.md)
6. [T8 — IPC replay 測試](PR4-ipc-contract-replay/T8-ipc-replay-tests.md)

**再來（測試批次）**：
7. [T3 — sample 測試](PR1-vitest-infra/T3-sample-uidgen-test.md)
8. [T3 — common 工具](PR2-pure-utils/T3-common-utils.md)
9. [T4 — renderer libs](PR2-pure-utils/T4-renderer-libs.md)
10. [T5 — customizations shape](PR2-pure-utils/T5-customizations-shape.md)
11. [T6 — composables](PR2-pure-utils/T6-composables.md)
12. [T9 — Stores 第一批](PR5-pinia-stores/T9-stores-batch1.md)
13. [T10 — Stores 第二批](PR5-pinia-stores/T10-stores-batch2.md)
14. [T11 — Stores 第三批](PR5-pinia-stores/T11-stores-batch3.md)
15. [T12 — shadcn 互動測試](PR6-components-and-e2e/T12-shadcn-interaction.md)
16. [T13 — Base\* primitives](PR6-components-and-e2e/T13-base-primitives.md)
17. [T14 — The\* + 業務元件](PR6-components-and-e2e/T14-the-and-business.md)
18. [T15 — Playwright smoke](PR6-components-and-e2e/T15-playwright-smoke.md)
19. [T17 — CI 整合](PR7-coverage-and-ci/T17-ci-integration.md)

## PR 切分與順序

```
PR0 (T0)
  ↓
PR1 (T1+T2+T3 sample)
  ↓
PR2 (T3+T4+T5+T6) ─┐
                   ├─ 可並行
PR3 (T7) ──────────┘
  ↓
PR4 (T8) — 依 PR3 fixtures
  ↓
PR5 (T9+T10+T11) — 依 PR4 mock pattern
  ↓
PR6 (T12+T13+T14+T15)
  ↓
PR7 (T16+T17) — 最後，要等所有測試先存在
```

## Spec 共通結構

每個 spec 包含：
1. **前置條件** — 哪些 task / PR 必須先完成
2. **觸碰檔案清單** — 新增 / 修改 / 不變
3. **動作** — 新檔給完整內容、改檔給 before/after diff
4. **風險與 rollback** — git revert 命令或具體還原步驟
5. **驗收命令** — copy-paste 就能跑

## 批准語法

User 確認某個 spec：「**T0 OK 開 PR0**」「**T7 改成 XXX**」「**PR4 暫緩**」皆可。Claude 收到「OK」之前不動 code。

## 設計常數速查

| 項目 | 值 |
|------|------|
| Coverage hard gate | lines ≥ 60% / branches ≥ 60%（全域）|
| ipc-api 區覆蓋率目標（warn-only） | 90% / 75% |
| common 工具覆蓋率目標（warn-only） | 95% / 90% |
| Playwright viewport | 1920 × 1200 |
| Vitest environment | happy-dom |
| Test 檔位置 | co-located（`foo.ts` 旁 `foo.test.ts`） |
| Test infra 位置 | `tests/`（setup / helpers / fixtures） |
| Mock 對象 | `@tauri-apps/api/*`、`@/ipc-api/httpClient`、`@/i18n` |
