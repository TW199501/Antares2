# Antares2 前端單元測試導入計畫

## Context

antares2 前端 Vue **零測試**。後端 Node sidecar 即將被 .NET 10 + SqlSugar 取代。**在後端動工之前**先做兩件事：

1. **目錄重整**：`src/` → `web/`（純前端拆出來），`src-tauri/` **不動**（Tauri v2 官方慣例），未來 .NET 10 落 `server/`
2. **建立測試底盤 + 凍結 ipc-api 真實契約**：用現行 Node sidecar 對真 DB 採集 fixture，wrapper 測試用 fixture replay；.NET 重寫必須通過同一組 fixture，否則前端 runtime 會壞。

工具：Vitest + @vitest/coverage-v8 + @vue/test-utils + happy-dom + Playwright（已有）。co-located（`foo.ts` 旁 `foo.test.ts`），不另開 `tests/__tests__/`。

## 範圍量測（已完成）

- 194 個 .vue（97 shadcn primitives + 97 業務）
- 14 個 ipc-api wrapper、10 個 Pinia store、5 個 composable
- 8 + 1 個 renderer libs、12 + 7 + 3 個 common 工具
- Tauri import 5 檔、httpClient 引用 15 檔
- TS alias `@/` → `src/renderer/`（T0 後改 `web/renderer/`）、`common/` → `src/common/`（T0 後改 `web/common/`）

## 預期 layout

```
e:/source/antares2/
├─ web/                  ← 從 src/ 改名
│   ├─ common/
│   ├─ main/             # Node sidecar，.NET 上線後刪
│   └─ renderer/
├─ src-tauri/            ← 不動
├─ sidecar/              # build artifact
├─ workers/              # build artifact
├─ scripts/              # 內容改路徑
├─ e2e/                  # 留 root
├─ tests/                ← 新增（setup / helpers / fixtures/contract/）
├─ docs/、.github/、CLAUDE.md
├─ vite.config.ts、tsconfig.json、package.json、playwright.config.ts、vitest.config.ts(新)
└─ server/?              # 未來 .NET 10
```

## 任務（18 個 / 7 個 PR）

詳細實做請見 `docs/superpowers/specs/2026-05-03-frontend-unit-test/` 各 spec 檔。

### PR0：T0 — `src/` → `web/` 改名
詳見 [PR0-rename-src-to-web/T0-rename-and-path-update.md](../specs/2026-05-03-frontend-unit-test/PR0-rename-src-to-web/T0-rename-and-path-update.md)

### PR1：T1 + T2 + T3 sample（vitest infra）
- [T1-vitest-config.md](../specs/2026-05-03-frontend-unit-test/PR1-vitest-infra/T1-vitest-config.md)
- [T2-global-setup.md](../specs/2026-05-03-frontend-unit-test/PR1-vitest-infra/T2-global-setup.md)
- [T3-sample-uidgen-test.md](../specs/2026-05-03-frontend-unit-test/PR1-vitest-infra/T3-sample-uidgen-test.md)

### PR2：T3 剩 14 + T4 + T5 + T6（pure utils）
- [T3-common-utils.md](../specs/2026-05-03-frontend-unit-test/PR2-pure-utils/T3-common-utils.md)
- [T4-renderer-libs.md](../specs/2026-05-03-frontend-unit-test/PR2-pure-utils/T4-renderer-libs.md)
- [T5-customizations-shape.md](../specs/2026-05-03-frontend-unit-test/PR2-pure-utils/T5-customizations-shape.md)
- [T6-composables.md](../specs/2026-05-03-frontend-unit-test/PR2-pure-utils/T6-composables.md)

### PR3：T7 — IPC 契約 fixture 採集
- [T7-capture-contract-fixtures.md](../specs/2026-05-03-frontend-unit-test/PR3-fixture-capture/T7-capture-contract-fixtures.md)

### PR4：T8 — IPC contract replay
- [T8-ipc-replay-tests.md](../specs/2026-05-03-frontend-unit-test/PR4-ipc-contract-replay/T8-ipc-replay-tests.md)

### PR5：T9 + T10 + T11（10 個 Pinia store）
- [T9-stores-batch1.md](../specs/2026-05-03-frontend-unit-test/PR5-pinia-stores/T9-stores-batch1.md)
- [T10-stores-batch2.md](../specs/2026-05-03-frontend-unit-test/PR5-pinia-stores/T10-stores-batch2.md)
- [T11-stores-batch3.md](../specs/2026-05-03-frontend-unit-test/PR5-pinia-stores/T11-stores-batch3.md)

### PR6：T12 + T13 + T14 + T15（components + e2e）
- [T12-shadcn-interaction.md](../specs/2026-05-03-frontend-unit-test/PR6-components-and-e2e/T12-shadcn-interaction.md)
- [T13-base-primitives.md](../specs/2026-05-03-frontend-unit-test/PR6-components-and-e2e/T13-base-primitives.md)
- [T14-the-and-business.md](../specs/2026-05-03-frontend-unit-test/PR6-components-and-e2e/T14-the-and-business.md)
- [T15-playwright-smoke.md](../specs/2026-05-03-frontend-unit-test/PR6-components-and-e2e/T15-playwright-smoke.md)

### PR7：T16 + T17（gate + CI）
- [T16-coverage-gate.md](../specs/2026-05-03-frontend-unit-test/PR7-coverage-and-ci/T16-coverage-gate.md)
- [T17-ci-integration.md](../specs/2026-05-03-frontend-unit-test/PR7-coverage-and-ci/T17-ci-integration.md)

## 順序硬約束

PR0 → PR1 → PR2 ‖ PR3（兩者可並行） → PR4（依 PR3） → PR5（依 PR4） → PR6 → PR7

節奏：建議一週一個 PR；PR0 跟 PR3 視 dev DB / 路徑驗證另估

## Critical Files

**T0 改動**：
- `vite.config.ts`、`tsconfig.json`、`package.json`、`playwright.config.ts`（驗）、`.gitignore`、`.editorconfig`、`.gitattributes`
- `scripts/{build-sidecar,verify-tauri-migration,translation-check,migrate-appdata}.mjs`
- `.github/workflows/*.yml`（5 個）
- `CLAUDE.md`、`docs/superpowers/{plans,rules}/*.md`、`docs/ui-spec.md`
- **不變**：`src-tauri/` 全部、`scripts/{stage-resources,tauri-build,build-msi,release}.mjs`

**T1-T17 對象**：
- `web/renderer/i18n/index.ts`（T2）、`web/renderer/composables/useShortcutDispatcher.ts`（T6）、`web/renderer/libs/persistStore.ts`（T4）
- `web/renderer/ipc-api/httpClient.ts` + 14 wrapper（T7、T8）
- `web/renderer/stores/*.ts` 10 檔（T9-T11）
- `web/main/server.ts`（T7 採集啟動，**只讀不改**）
- 新增：`vitest.config.ts`、`scripts/capture-contract-fixtures.mjs`、`scripts/check-coverage.mjs`、`tests/setup.ts`、`tests/helpers/*`、`tests/fixtures/contract/*`

## 執行 Phase 0：先寫 spec、後動 code（**user 強制要求**）

> 18 任務量大，user 要求**先看到實做細節再放行**。Claude ExitPlanMode 後的**第一個動作**是把 plan + spec 全部寫到 `docs/`，**寫完停下來等 user review**，每個 spec 檔個別批准後才繼續執行對應 PR。spec 不過 = 不動 code。

### User review 流程

1. Claude 寫完 18 個 spec 後**停下**，貼出 spec 路徑清單
2. User 逐檔 review（建議先看 PR0 / T7 / T16 三個高風險 spec）
3. User 逐 spec 批准（「這個 spec OK 開 PR0」/「T7 改成 XXX」）
4. Claude 接受批准 → 開對應 PR → 完成 → 下一個 spec 確認 → 繼續
5. **任一 spec 被否 = Claude 停手等修改 spec，不繞過**

## Claude 自驗職責（**user 強制要求**）

**Claude 必須親自用 Playwright 跑測試驗收，不只寫 spec 交給人類跑。** 每個 PR 完成後 Claude 必須：

1. 啟動 dev server（`pnpm vite:dev` 背景跑）
2. 執行 `pnpm test:e2e`（在現行 Windows 機器上）
3. **回報**：成功 / 失敗 spec 數、失敗的具體錯誤訊息、screenshot artifact 路徑
4. 失敗 → diagnose 並修；不能用「把測試 skip 掉讓 CI 綠」當解法

**自驗時機點**：
- PR0 後：跑 `pnpm tauri:build` + 既有 3 個 mssql spec 確認沒 regression
- PR1 後：`pnpm test:unit:run` smoke
- PR4 後：`pnpm test:unit:run` + 14 個 ipc-api contract replay spec
- PR5 後：`pnpm test:unit:run` 全 store 測試
- PR6 後：`pnpm test:unit:run` + `pnpm test:e2e`（**首次跑全套 8 個 Playwright spec**）
- PR7 後：`pnpm test:coverage:check` + 8 個 Playwright spec 再跑一次

## 驗收（end-to-end）

完成 18 任務後 Claude 必須親自跑完整套並回報結果：
1. 從乾淨 clone：`pnpm install`
2. `pnpm tauri:dev` 跑起（驗 T0 沒爆）
3. `pnpm tauri:build` 在本機 Windows 跑完，產 NSIS / MSI（**T0 主要驗收**）
4. `pnpm test:unit:run` 全綠（預估 ~280-380 個測試），Claude 貼出 Vitest 終端輸出
5. `pnpm test:coverage` + `pnpm test:coverage:check` 過 **60% lines / 60% branches hard gate**
6. **`pnpm vite:dev`（背景） + `pnpm test:e2e` —— Claude 自行執行 Playwright 8 支 smoke**（3 mssql 既有 + 5 新增），全綠才算過；失敗則 Claude 貼出 trace.zip / screenshot 路徑並 diagnose
7. push dev，CI 4 build + 1 unit-test 全綠（parallel）
8. `tests/fixtures/contract/README.md` 寫清「.NET 必須通過這組」
9. `docs/release-notes-vX.Y.Z.md` 補一段：「Frontend test infrastructure landed; ipc-api contract frozen via fixture replay; coverage 60% gate; src/ renamed to web/ for upcoming .NET 10 backend」

## 不在範圍

- 不寫 97 個 shadcn primitive snapshot
- 不測 `web/main/`（即將被 .NET 取代），但 T7 用它採集 fixture（讀模式）
- 不測 `web/main/workers/`、不測 `src-tauri/src/sidecar.rs`
- 不開 worktree（per user 約定 single-file edits + HMR）
- 不改 `web/renderer/scss/main.scss` legacy class
- 不拆 monorepo（`web/` 不放 sub `package.json`）
- 不改 `src-tauri/`（Tauri v2 官方慣例）
- 不重命名 `web/main/`（過渡期殘留，.NET 上線後刪）
- 不寫 .NET 10 backend（後續獨立 plan）

## 風險

- **T0 風險**：須驗 `pnpm tauri:build` 在本機 + CI 雙綠（不動 `src-tauri/` 所以風險中等）
- **happy-dom KeyboardEvent 缺 `getModifierState()`**：T6 若觸到要 polyfill 或 fallback jsdom
- **fixture 採集對 dev DB 敏感**：anonymize 必須做，否則 commit 進 git 洩密
- **fixture 對應 sidecar 行為**：sidecar 換 .NET 後 fixture 必須對著 .NET 跑驗證 —— .NET 端 acceptance criteria
- **store 跨依賴**：T10 用 `createTestingPinia({ initialState })` 灌相依 store 預設值
- **CLAUDE.md 路徑提及量大**（`src/main/`、`src/renderer/`、`src/common/` 數十處）：T0 PR description 列出改動章節清單便於 review；`src-tauri/` 提及不變
