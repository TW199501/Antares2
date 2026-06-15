# 屬性 Tab — UI 一致性 + CRUD 邏輯稽核計畫

> **Status**: 待執行 (2026-05-10)
> **Triggered by**: 使用者實機操作 `屬性` tab 在 `approval_flow` 表上發現 4 類問題
> **Scope**: `web/renderer/components/WorkspaceTabPropsTable*.vue`、後端 `server/Tables/`、`server/Schemas/SchemaDdlService.cs` + e2e

## Context

使用者跑 `dev` 連到 MSSQL 後,在屬性 tab 上發現:

1. **頂部 toolbar 兩行高度不一致** — 第 1 行 `資料/屬性/新增/索引/外鍵/DDL` tab strip 量出 outer 44px,第 2 行(名稱/描述/自增/編輯 action row,class 含 `workspace-query-runner-footer.!h-[39px]`)量出 outer 52px。視覺不對齊。
2. **屬性表欄寬不夠** — `名稱` 欄 114px、`描述` 欄 120px,但整個表寬有 1472px。長英文 column name(像 `update_user_name`)會被截斷,使用者要求兩欄都拉到 200px,行動欄空間還很多。
3. **CRUD 動作沒生效** —
   - `表的描述` 編輯後沒寫回 DB
   - `新增欄位` 按下沒反應
   - 其他 CRUD(改名 / 刪欄位 / 加索引 / 加外鍵)使用者沒一一試,可能也有
4. **測試缺**: 使用者問有沒有 unit test + playwright e2e cover 這些 CRUD 路徑 — 截至 2026-05-10 沒有。

使用者要求**寫成計畫**,不要再 piecemeal fix。

## Goal

| | 量化 done criteria |
|---|---|
| UI | 屬性 tab toolbar 雙行 outer 高度統一 44px;名稱 / 描述 欄寬 200px |
| CRUD | 表描述、欄位 add/edit/delete、索引 add/delete、外鍵 add/delete、唯一 add/delete 全部 round-trip 過 sidecar 寫進 DB |
| 測試 | 每條 CRUD path 至少 1 個 unit test(renderer 端 ipc-api wrapper)+ 1 個 playwright e2e 走完整 click flow |

## Tasks (依 ROI 排序)

### T0 — Node-era baseline 對 .NET 缺漏 audit(最高優先,~2 h)

**動機:** 使用者發現「改完後端變成****」— 大量功能 Node 期正常,.NET 遷移後變空 / 沒反應 / 點下去白畫面。例:
- 點「建立 schema」現在空白(Node 期正常)
- 改表描述沒寫回(Node 期可寫)
- 新增欄位沒反應(Node 期可加)

每一個都單修浪費時間。**直接拿 Node 版的全部 route handler 對 .NET 端點做 diff**,缺什麼一次列完一次補。

**方法:**
1. 找 Node sidecar 最後一個 working commit:
   ```
   cat docs/net-migration/baseline-tag.txt   # 應該是 phase 17 之前的 SHA
   git show <baseline-sha>:web/main/routes/   # Node 的 route 目錄
   ```
   找 deletion commit:
   ```
   git log --all --diff-filter=D --name-only --pretty=format: | grep -E "web/main/routes" | sort -u
   git log --grep "phase 18" --oneline
   ```
2. 列出 Node 期所有 endpoint(每個 `routes/*.ts` 的 fastify route handler)。對比 `.NET` 現有的 `[HttpPost]` 端點列表:
   ```
   grep -rn "HttpPost\b" server/ | grep -v "bin/\|obj/"
   ```
3. 產出 diff 表:
   - **同名同 shape**: ✓ 沒事(可能 wire 漏)
   - **Node 有 .NET 沒**: 整個漏實作(明確補)
   - **Node 有 .NET 也有但 SQL 不同**: 行為差異(按 Node 行為補)
   - **Renderer 仍在呼叫但 .NET 端 404**: bug 浮上來(優先)

**驗收:** 產出 markdown 表格 `docs/net-migration/endpoint-coverage-diff.md`(per resource: connections / schemas / tables / views / triggers / routines / functions / schedulers / users),每行標明 Node 有沒、.NET 有沒、行為一致/差異/缺失。

**理由為什麼放 T0:** T3 / T4 / T5 都是 audit 結果的子集。先掃完整體再針對性修,而不是使用者每點一個白畫面我修一個。

### T1 — Toolbar 雙行高度統一 44px(視覺,~10 min)
**改:** 找到第 2 行的 `.px-4.pt-2` wrapper,移除 `!h-[39px]` Tailwind override 或改寫 padding 讓兩行 outer 一致。可能位置:`WorkspaceTabPropsTable.vue` template top section。
**驗收:** F5 後 SpecSnap 量兩行 outer 都 44。

### T2 — 屬性表名稱 / 描述欄寬 200px(視覺,~5 min)
**改:** `WorkspaceTabPropsTableFields.vue` scoped style 加 `.th-name { width: 200px; min-width: 200px; max-width: 200px; }` 跟 `.th-comment { width: 200px; ... }`,template 對應 column header 加上對應 class。對齊現有 `.th-order/.th-chip/.th-num/.th-chip2/.th-scale/.th-ops` 命名慣例。
**驗收:** 使用者複眼確認沒被截斷。

### T3 — 表描述編輯不生效 bug(後端可能漏實作,~30 min ~ 2 h)
**Diagnose:**
- Renderer 端 `WorkspaceTabPropsTable.vue` 編輯描述後呼叫哪個 ipc-api?(grep `editTableComment\|updateTableComment\|setTableOptions`)
- 後端對應 endpoint 在 `server/Schemas/SchemaDdlService.cs` 或 `server/Tables/`?
- MSSQL 表級描述修改 SQL: `EXEC sp_addextendedproperty / sp_updateextendedproperty 'MS_Description', @value, 'SCHEMA', @schema, 'TABLE', @table`
**Fix:** 補上 missing endpoint 或修 SQL 路徑。
**驗收:** F5 → 編輯描述 → 重連 → sidebar 顯示新描述。

### T4 — 新增欄位按鈕沒反應(可能 click handler 漏 wire,~30 min)
**Diagnose:**
- 找 `WorkspaceTabPropsTable.vue` 的「新增」按鈕 click handler
- 是否觸發 modal?還是觸發 ipc-api?
- ipc-api 是否真的打到 sidecar 端 `/api/tables/addColumn` (or similar)?
- 後端 endpoint 是否存在且實作完整?
**Fix:** 視 root cause 補 click → modal 開啟 / api 呼叫 / 後端實作。
**驗收:** 點新增 → modal 出現 → 填欄位 → 確認 → 表結構刷新看到新欄位。

### T5 — 全 CRUD round-trip audit(~3 h)
逐項驗證以下動作 click → ipc-api → sidecar SQL → DB 寫回 → renderer 刷新:

| 操作 | renderer 入口 | ipc-api | sidecar endpoint | 狀態 |
|------|--------------|---------|-----------------|------|
| 改表描述 | T3 |  |  |  |
| 改表名 | (使用者已知不易,先 skip) |  |  |  |
| 新增欄位 | T4 |  |  |  |
| 編輯欄位 | `WorkspaceTabPropsTableEditModal.vue` |  |  |  |
| 刪除欄位 | row context menu |  |  |  |
| 加索引 | `WorkspaceTabPropsTableIndexesModal.vue` |  |  |  |
| 刪索引 | indexes modal context |  |  |  |
| 加外鍵 | `WorkspaceTabPropsTableForeignModal.vue` |  |  |  |
| 刪外鍵 | foreign modal context |  |  |  |
| 加唯一 | (待找) |  |  |  |
| 刪唯一 | 同上 |  |  |  |

每一條都實機點過 + 確認 DB 真的寫回。失敗的補進 T3-T4 模式修。

### T6 — Renderer 端 unit test(~2 h)
給每個 ipc-api wrapper 寫一個 `describe('xxx')` 帶 happy path + error path:
- `Tables.addColumn` / `Tables.editColumn` / `Tables.dropColumn`
- `Schema.addIndex` / `Schema.dropIndex`
- `Schema.addForeign` / `Schema.dropForeign`
- `Schema.editTableComment`
測試只 mock httpClient.apiCall,驗 path + body shape — 鎖契約。

### T7 — Playwright e2e(~3 h)
新增 `e2e/props-tab-crud.spec.ts` 走完整 click flow,跟現有 `mssql-*.spec.ts` 同 pattern:
1. 連到測試 MSSQL → 開 approval_flow 表 → 屬性 tab
2. 編輯描述 → 確認 → 重連 → sidebar 描述更新
3. 新增欄位 → modal → 填 → 確認 → 表 fields 多一個
4. 編輯該欄位 → 確認 → 變更生效
5. 刪除該欄位 → 確認 → 消失
6. 加 index / drop index
7. 加 foreign / drop foreign
**Pattern:** 跟 `mssql-database-switch.spec.ts:111` 同樣的「斷線並行」健壯性測試也補一個。

### T8 — 後端 xunit(~2 h)
`tests/integration-net/Tables/TablesDdlServiceTests.cs` cover MSSQL 各 DDL endpoint:
- 真連到 docker MSSQL(同 `tests/integration-net` 既有 pattern)
- AddColumn / EditColumn / DropColumn / AddIndex 等 happy path
- Reserved-word table name(`User`/`Order`)的反例(per CLAUDE.md `### .NET sidecar gotchas`)

## Out of scope

- Mysql / pg / sqlite 同樣 CRUD path(這次只看使用者撞到的 MSSQL 路徑)
- 改表名 — 使用者明確 skip
- Properties 以外 tab 的 CRUD(資料 row insert/edit/delete 是另一條 path)

## Done criteria

- T1-T2 視覺修通過 SpecSnap 量測
- T3-T5 每條 CRUD 都有 e2e 跑過綠燈
- T6-T8 unit + xunit 全綠
- 全部 commit + push 後 release v0.8.7
