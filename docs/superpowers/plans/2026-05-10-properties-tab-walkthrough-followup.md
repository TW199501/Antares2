# Properties Tab UI 走查 — 發現的 follow-up bugs

> **建立時間:** 2026-05-10 17:00
> **觸發任務:** 使用者要求「逐 1 按鈕下去落實確認沒有錯誤」(緊接 T0-T8 plan 完成後)
> **狀態:** backend (T9) 已修;3 個 renderer-side bug 待後續

## 走查路徑

1. 從乾淨環境啟 vite + 重啟 sidecar(舊 binary build 在 T3-T5 commit 之前,不認新 DTO)
2. 打開 properties tab,逐個按鈕點過去:**新增欄位 → 改欄位 → 刪欄位 → 表描述**
3. 每步用 SpecSnap-style 觀察 + 直接 query DB 驗證

## 已修(commit `cccd481`)

### Bug A — renderer 的 boolean sentinel 跟 .NET typed DTO 衝突

**症狀**:點「新增欄位」確定後,POST `/api/tables/alter` 回 400,
`The JSON value could not be converted to System.Nullable<Int32>. Path: $.tableStructure.fields[2].numLength`

**根因**:`web/common/interfaces/antares.ts:78-110` `TableField` 對長度欄位用
`number | false`(`false` 作 「沒有」 sentinel),`after` 用 `string | false`.
T4-T5 把 .NET DTO typed 成 `int? / string?` 後,System.Text.Json 嚴格模式拒收
`false`,renderer 每個 alter 請求都 400.

**修法**:`BoolOrIntConverter` + `BoolOrStringConverter`(server/Tables/TablesWriteService.cs).

**驗收**:走查後直連 API 全 4 條路徑成功:
- T3 `options.comment` ✓
- T4 ADD COLUMN avatar_url(NVARCHAR + 中文 comment)✓
- T5 CHANGE COLUMN rename ✓
- T5 DROP COLUMN ✓

## 待修(renderer + wire-contract)

### Bug B — Reka Dialog 關閉後 overlay 殘留

**症狀**:連續開關 modal(例如「新增」失敗 → 取消 → 點下一行的「編輯欄位」),
第二次的 click 會被一個 `<div data-state="open" aria-hidden="true" class="fixed inset-0 z-50 bg-black/50 ...">`
攔下,Playwright 報 `intercepts pointer events`.

**已知記憶**:user_settings 已記錄 `feedback_radix_body_pointer_events_trap.md`
(Dialog 開啟會讓 body.pointerEvents=none,需在 shell 層覆寫).這個 case 是
**overlay 元素本身殘留在 DOM**,不是 body pointer-events.

**懷疑根因**:`@/components/BaseConfirmModal.vue` 用 reka-ui Dialog,在 v-if 切
false 時,DialogOverlay 的 transition leave 動畫沒等完就被 Vue 移除了 root
但 overlay teleport 殘留.或者父元件 v-if 條件變化太快,Dialog cleanup 沒觸發.

**Workaround 模式(已用在 e2e/props-tab-crud-ui.spec.ts)**:測試前先掃殘留 overlay
`document.querySelectorAll('[data-state="open"][aria-hidden="true"].fixed.inset-0').forEach(o => o.remove())`.

**正解**:查 BaseConfirmModal 的 cleanup 邏輯,確認 DialogOverlay 跟 DialogContent
都進入 closed 狀態才 unmount;或在外層加 `:key="forceRemount"` 強制 cleanup.

### Bug C — 編輯欄位 confirmEditModal 走 add+drop 而非 in-place

**症狀**:對已存在的 avatar_url 點「編輯欄位」改名 → 「avatar」 → 確定 →
backend 回 500 「Column name 'avatar_url' specified more than once」.

**根因 (尚未證實)**:`WorkspaceTabPropsTable.vue:749` `confirmEditModal` 用
`Object.assign(target, updated)` 應該是 in-place,理論上 `_antares_id` 不變.
但實機觀察:request 送出時 `additions[0]._antares_id = L80BARXWW`(NEW)同時
`deletions[0]._antares_id = JD5A0X8EP`(OLD)— 兩個 id 不同,代表 localFields
跟 originalFields 的 _antares_id 對不上.

**懷疑**:前一次失敗的 ADD 操作 push 進 localFields(取得 L80BARXWW),失敗
後 `getFieldsData` 重抓 originalFields = [..., avatar_url-JD5A0X8EP] 但沒重設
localFields,留下殘渣.下次 saveChanges 算 diff 時把舊的視為 deletion.

**檢查路徑**:
1. `getFieldsData`(看是否同步重設 `localFields`)
2. `saveChanges` 失敗 catch path(現在只 `addNotification + getFieldsData`,缺
   `localFields = [...originalFields]` 重設)
3. 確認 modal 從打開到關閉的整個 lifecycle,_antares_id 是否被任何地方覆寫

**Workaround**:在 confirmEditModal 失敗後手動 refresh table tab.

### Bug D — backend SQL 例外回 500 而非 200+envelope

**症狀**:T5 改欄位流程踩到 「Column name specified more than once」 → 回 HTTP
**500** Internal Server Error.但 CLAUDE.md `### Wire contract` 明確規定:
**HTTP 200 is canonical for BOTH success and error**.500 會被 renderer 的
`httpClient.ts:47` `if (!res.ok) throw` 短路,跳過 envelope-level 處理,使用者看到
generic toast 「API error 500」 而非具體 SQL message.

**根因**:`server/Infrastructure/EnvelopeResultProvider.OnException` 應該包成
200+`{status:"error", response: ex.Message}`.目前 `[NonUnify]` 標的方法
(包括 `/api/tables/alter`)拋例外時不走 EnvelopeResultProvider,直接讓 Furion
框架回 500.

**修法**:`Alter` action method 內套個 try/catch,失敗時自己組 200+envelope-error
回應(跟 ConnectionService.Connect/Test 的手動 envelope 模式一致).

**測試**:加 xunit case(用內存 SqlSugar 模擬 SQL 例外),斷言 alter 回 200 +
`{status:"error", response: "<sql msg>"}`.

## 後續任務(下一個 plan 開新檔)

1. **R1** - Bug B (overlay 殘留):查 BaseConfirmModal lifecycle,1-2 行修
2. **R2** - Bug C (edit add+drop):trace _antares_id 覆寫源頭,改 saveChanges
   失敗 catch 重設 localFields
3. **R3** - Bug D (500 wire contract):為所有 `[NonUnify]` action 加 try/catch
   wrapper,xunit 補測
4. **R4** - 進階 e2e:走 Bug B/C/D 修完後,擴充 props-tab-crud-ui.spec.ts 覆蓋
   完整 CRUD round-trip(目前只 cover ADD)

## 不在這次走查的 footgun(平台限制)

- 多次 `dotnet run` 會殘留 orphan sidecar(file lock 抓 `bin/Debug` 的
  antares-server.exe).解法:Ctrl-C 關 vite/Tauri 之前,先 `Stop-Process` 看
  CommandLine 含 `AntaresServer.csproj` 的 dotnet + child antares-server.
- vite + sidecar 兩 dev server 不會同步 reload .NET 程式碼變動.每次改 server/
  必須手動 restart sidecar.
