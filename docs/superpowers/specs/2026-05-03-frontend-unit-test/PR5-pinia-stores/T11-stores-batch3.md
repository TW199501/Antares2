# T11 — Pinia store 第三批（剩 3 個）

**對應 PR**：PR5
**前置**：T9 + T10（store mock pattern 已建）
**目標覆蓋率**：lines ≥ 80% / branches ≥ 65%（warn-only）

## 執行配置（**啟動前必讀**）

| 項目 | 值 |
|------|-----|
| 主 skill | `superpowers:test-driven-development` |
| 副 skill | `vuejs-typescript-best-practices` |
| 模型 | **Opus 4.7** |
| Worktree | **禁用** |
| 並行 subagent | 否 |
| 詳細政策 | 見 [README 全域執行政策](../../README.md) |

## 範圍

`web/renderer/stores/`：
- `console.ts`（store id `'console'`）
- `schemaExport.ts`（store id `'schemaExport'`）
- `tablePager.ts`（store id `'tablePager'`）

## 觸碰檔案

### 新增
- `web/renderer/stores/console.test.ts`
- `web/renderer/stores/schemaExport.test.ts`
- `web/renderer/stores/tablePager.test.ts`

## 各 store 測試重點

### console
- 訊息 append（log / warn / error）
- 訊息 buffer 上限與 overflow（最舊的截掉）
- clear
- filter by level

### schemaExport（**特殊：worker thread protocol**）
worker 互動透過 `apiCall` 走 sidecar route（CLAUDE.md 提到 export 走 `src/main/workers/`），測：
- `start` 觸發 `apiCall('exporter/start', payload)`
- `cancel` 觸發 `apiCall('exporter/cancel', { jobId })`
- progress event 接收 + state 更新（透過 mock createWebSocket 回 message）
- error path

```ts
describe('schemaExport store', () => {
   it('start: dispatches exporter/start with options', async () => {
      vi.mocked(apiCall).mockResolvedValueOnce({ status: 'success', response: { jobId: 'j1' } });
      const store = useSchemaExportStore();
      await store.start({ uid: 'c1', tables: ['users'], format: 'sql' });
      expect(apiCall).toHaveBeenCalledWith('/exporter/start',
         expect.objectContaining({ uid: 'c1', tables: ['users'], format: 'sql' }));
   });

   it('cancel: dispatches exporter/cancel for active job', async () => {
      // 先 start，再 cancel
   });

   it('progress event: updates state.progress', async () => {
      // 模擬 createWebSocket 回 message event
   });
});
```

### tablePager（純資料）
- `nextPage` / `prevPage` / `setPageSize`
- 邊界（< 0 → clamp、> totalPages → clamp）
- `reset`

## 驗收

```bash
pnpm test:unit:run web/renderer/stores/console.test.ts \
                   web/renderer/stores/schemaExport.test.ts \
                   web/renderer/stores/tablePager.test.ts

# T9 + T10 + T11 全部 store coverage
pnpm test:coverage --coverage.include='web/renderer/stores/**'
# 目標：≥ 80% lines（warn-only）
```

## 風險

- **schemaExport 真實 worker 互動**：實際 sidecar 開 worker thread 跑 export，事件透過 WebSocket 回 store；測試只能 mock 這層通訊。實際 worker 邏輯本 plan 不測（src/main/workers/ 即將被 .NET 取代）。
- **console buffer overflow 邊界**：若上限是 1000、加 1001 條應該截掉最舊；具體上限值 spec 執行時 read store 實作。

## User 批准語法

「**T11 OK**」
