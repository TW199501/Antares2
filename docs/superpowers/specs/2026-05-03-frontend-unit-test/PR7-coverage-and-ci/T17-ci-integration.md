# T17 — CI 整合（test-build.yml）

**對應 PR**：PR7
**前置**：T1-T16
**風險等級**：低（CI workflow 改動，本機 build 不受影響）

## 執行配置（**啟動前必讀**）

| 項目 | 值 |
|------|-----|
| 主 skill | `superpowers:executing-plans` |
| 副 skill | — |
| 模型 | **Opus 4.7** |
| Worktree | **禁用** |
| 並行 subagent | 否 |
| 詳細政策 | 見 [README 全域執行政策](../../README.md) |

## 動作摘要

在 `.github/workflows/test-build.yml` 加 `unit-test` job，**parallel** 跟 4 個 build job 跑（不用 `needs:`），coverage 用 T16 自寫腳本當 hard gate，e2e job 維持 manual dispatch only。

## 觸碰檔案

### 修改
- `.github/workflows/test-build.yml`

### 不變
- `.github/workflows/release.yml`（release 流程不變）
- `.github/workflows/test-e2e-win.yml`（e2e manual dispatch only）
- `.github/workflows/codeql-analysis.yml`、`create-generated-sources.yml`

## `.github/workflows/test-build.yml` diff

```diff
 name: Test Build
 on:
   push:
-    branches: [dev]
+    branches: [dev]
+    paths-ignore:
+      - 'docs/**'
+      - '*.md'
   workflow_dispatch:

 jobs:
+  unit-test:
+    name: Unit Tests + Coverage
+    runs-on: ubuntu-latest
+    timeout-minutes: 15
+    steps:
+      - uses: actions/checkout@v4
+      - uses: pnpm/action-setup@v3
+        with:
+          version: 9
+      - uses: actions/setup-node@v4
+        with:
+          node-version: 20
+          cache: pnpm
+      - run: pnpm install --frozen-lockfile
+      - name: Run unit tests
+        run: pnpm test:unit:run
+      - name: Generate coverage report
+        run: pnpm test:coverage
+      - name: Check coverage gate (60% global hard gate)
+        run: pnpm test:coverage:check --report
+      - name: Upload coverage artifact
+        if: always()
+        uses: actions/upload-artifact@v4
+        with:
+          name: coverage-report
+          path: |
+            coverage/
+          retention-days: 7
+      - name: Comment coverage on PR
+        if: github.event_name == 'pull_request'
+        uses: marocchino/sticky-pull-request-comment@v2
+        with:
+          path: coverage/report.md
+
   build-windows:
     name: Build Windows x64
     runs-on: windows-latest
     ...
   build-macos-arm:
     ...
   build-macos-x64:
     ...
   build-linux:
     ...
```

## 為什麼 unit-test 不放 `needs:` 阻擋 build

- **Parallel 省時間**：unit test ~2 分鐘，build 各 ~10 分鐘；序列要 12 分，並行只要 10 分
- **Build 失敗也想看 unit test 結果**：兩種失敗原因分開診斷
- **`always()` 的 artifact upload**：即使 unit-test 失敗也能下載 coverage 看哪邊掉

## 為什麼 paths-ignore 加 docs

避免改 spec / plan / CLAUDE.md 觸發整套 CI（節省 runner 時間 + cost）。

## PR comment 顯示 coverage

`marocchino/sticky-pull-request-comment` 會把 `coverage/report.md`（T16 產的）貼到 PR 留言區，每次 push 自動 update（不另開新留言，sticky 模式）。Reviewer 不用點進 artifact 就能看分區報告。

## 驗收

```bash
# 1. 本機 push dev 前 lint workflow yaml
# 用 actionlint（若有裝）：
actionlint .github/workflows/test-build.yml

# 2. push dev、看 GitHub Actions
git push origin dev
gh run list --branch dev --limit 1

# 3. 5 個 job 應出現（parallel）
gh run view <run-id>
# 預期：unit-test / build-windows / build-macos-arm / build-macos-x64 / build-linux
# 全綠 + coverage artifact 可下載

# 4. 開個 PR、看是否有 sticky comment
gh pr create --base master --head dev --title "test ci" --body "test coverage comment"
# 等 CI 跑完，PR 留言區應出現 coverage/report.md 內容
gh pr close <pr-num>  # 測完關掉
```

## 風險

- **`marocchino/sticky-pull-request-comment` 需要 PR write 權限**：GitHub Actions 預設 token 通常足夠，若爆權限改用 fork-friendly 的 `peter-evans/create-or-update-comment`。
- **paths-ignore 可能漏觸發**：若 docs 改的同時也改 source code，paths-ignore 不會擋（it triggers）。但若只改 docs，CI 不跑——這是預期。
- **timeout-minutes 15 可能不夠**：280-380 個測試 + coverage + check 估計 5-10 分鐘，15 分有 buffer；若 T6-T14 之後測試暴增到 1000+，要回頭調。

## Out of scope

- **不**改 release.yml（不在本 plan）
- **不**把 e2e 加進 PR gate（CLAUDE.md 已寫 e2e 維持 manual dispatch）
- **不**裝 codecov / coveralls 第三方服務（artifact + sticky comment 已足）

## User 批准語法

「**T17 OK**」
