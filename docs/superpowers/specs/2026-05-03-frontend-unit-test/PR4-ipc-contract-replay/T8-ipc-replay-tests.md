# T8 — IPC contract replay 測試（14 wrapper + httpClient）

**對應 PR**：PR4
**前置**：T7（fixture 已採集）
**後置阻擋**：T10（Pinia store 第二批用相同 mock pattern）
**目標覆蓋率**：lines ≥ 90% / branches ≥ 75%（warn-only）

## 執行配置（**啟動前必讀**）

| 項目 | 值 |
|------|-----|
| 主 skill | `superpowers:test-driven-development` |
| 副 skill | `superpowers:subagent-driven-development`（14 wrappers 分 4 批並行） |
| 模型 | **Opus 4.7**（含 subagent dispatch） |
| Worktree | **禁用** |
| 並行 subagent | **是** —— 4 批每批 3-4 wrappers |
| 詳細政策 | 見 [README 全域執行政策](../../README.md) |

## 動作摘要

每個 ipc-api wrapper 寫一個 `.test.ts`，import T7 採集的 fixture，用 mock `apiCall` 灌入 fixture response，斷言：
1. wrapper 呼叫了正確的 `(route, payload)`
2. wrapper 把 response 正確 map 成內部 type（即 fixture 的 `expected` 區塊）

**v4 + 議題 1 補強**：再加 `httpClient.createWebSocket` 自身 + WS frame protocol 測試（T9-T11 store batch 用相同 fixture 跑 frame replay）。

## 觸碰檔案

### 新增（每個 wrapper 一個）
- `web/renderer/ipc-api/Ai.test.ts`
- `web/renderer/ipc-api/Application.test.ts`
- `web/renderer/ipc-api/Connection.test.ts`
- `web/renderer/ipc-api/Databases.test.ts`
- `web/renderer/ipc-api/Functions.test.ts`
- `web/renderer/ipc-api/Routines.test.ts`
- `web/renderer/ipc-api/Schedulers.test.ts`
- `web/renderer/ipc-api/Schema.test.ts`
- `web/renderer/ipc-api/Tables.test.ts`
- `web/renderer/ipc-api/Triggers.test.ts`
- `web/renderer/ipc-api/Updater.test.ts`
- `web/renderer/ipc-api/Users.test.ts`
- `web/renderer/ipc-api/Views.test.ts`
- `web/renderer/ipc-api/httpClient.test.ts`（特殊：直接測 `apiCall` / `createWebSocket` 自身）

### 不變
- 14 個 wrapper source 檔
- T7 fixtures

## 通用測試模板（**v4 + 議題 2：用 `@tests` alias**）

```ts
// web/renderer/ipc-api/Tables.test.ts
import { describe, expect, it, vi } from 'vitest';
import { apiCall } from '@/ipc-api/httpClient';
import * as Tables from './Tables';

// @tests alias（T1 設定，alias = tests/）—— 取代醜的 '@/../../tests/...'
import getTableDataMysqlHappy from '@tests/fixtures/contract/tables.data.mysql.happy.json';
import getTableDataMssqlHappy from '@tests/fixtures/contract/tables.data.mssql.happy.json';
import getTableDataMysqlError from '@tests/fixtures/contract/tables.data.mysql.error.json';

describe('Tables.getTableData (contract replay)', () => {
   it('mysql happy: calls correct route + maps response', async () => {
      vi.mocked(apiCall).mockResolvedValueOnce(getTableDataMysqlHappy.response.body);
      const result = await Tables.getTableData(getTableDataMysqlHappy.request.payload);

      expect(apiCall).toHaveBeenCalledWith(
         '/' + getTableDataMysqlHappy.request.route,
         getTableDataMysqlHappy.request.payload
      );
      expect(result).toMatchObject(getTableDataMysqlHappy.expected);
   });

   it('mssql happy: same contract works on different dialect', async () => {
      vi.mocked(apiCall).mockResolvedValueOnce(getTableDataMssqlHappy.response.body);
      const result = await Tables.getTableData(getTableDataMssqlHappy.request.payload);
      expect(result).toMatchObject(getTableDataMssqlHappy.expected);
   });

   it('mysql error: wrapper surfaces error correctly', async () => {
      vi.mocked(apiCall).mockResolvedValueOnce(getTableDataMysqlError.response.body);
      // 視 wrapper 對 error 的處理：
      // - throw → expect(...).rejects.toThrow()
      // - 回 { status: 'error', response: ... } → expect(result.status).toBe('error')
      const result = await Tables.getTableData(getTableDataMysqlError.request.payload);
      expect((result as any).status).toBe('error');
   });
});

describe('Tables.updateTableCell (contract replay)', () => {
   // 類似結構...
});
```

## httpClient.test.ts 特殊測試

httpClient 自己不靠 fixture（它**就是** fixture 的產生者），測：

```ts
// web/renderer/ipc-api/httpClient.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

// 這支測試需要 unmock httpClient（它在 T2 setup 預設 mock）
vi.unmock('@/ipc-api/httpClient');

import { apiCall, createWebSocket, setSidecarPort, getSidecarPort } from '@/ipc-api/httpClient';
import { invoke } from '@tauri-apps/api/core';

describe('httpClient.apiCall', () => {
   beforeEach(() => {
      vi.mocked(invoke).mockResolvedValue('test-token-abc');
      // 模擬有 Tauri 環境
      vi.stubGlobal('window', {
         ...window,
         __TAURI_INTERNALS__: {}
      });
   });

   it('injects X-Sidecar-Token header', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
         ok: true,
         status: 200,
         json: async () => ({ status: 'success', response: 'ok' })
      });
      vi.stubGlobal('fetch', fetchSpy);

      setSidecarPort(5555);
      await apiCall('/test', { foo: 1 });

      expect(fetchSpy).toHaveBeenCalledWith(
         'http://127.0.0.1:5555/test',
         expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
               'X-Sidecar-Token': 'test-token-abc',
               'Content-Type': 'application/json'
            }),
            body: JSON.stringify({ foo: 1 })
         })
      );
   });

   it('skips token in non-Tauri environment (Playwright)', async () => {
      vi.stubGlobal('window', {});  // 沒 __TAURI_INTERNALS__
      const fetchSpy = vi.fn().mockResolvedValue({
         ok: true,
         status: 200,
         json: async () => ({})
      });
      vi.stubGlobal('fetch', fetchSpy);

      await apiCall('/test', {});
      expect(fetchSpy.mock.calls[0][1].headers['X-Sidecar-Token']).toBe('');
   });

   it('throws on non-OK response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
         ok: false,
         status: 500,
         text: async () => 'Internal Error'
      }));
      await expect(apiCall('/test', {})).rejects.toThrow(/API error 500/);
   });

   it('triggers noConnectionHandler on "No active connection" error', async () => {
      const handler = vi.fn();
      const { setNoConnectionHandler } = await import('@/ipc-api/httpClient');
      setNoConnectionHandler(handler);

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
         ok: true,
         json: async () => ({
            status: 'error',
            response: 'No active connection'
         })
      }));

      await apiCall('/x', { uid: 'conn-1' });
      expect(handler).toHaveBeenCalledWith('conn-1');
   });
});

describe('httpClient.createWebSocket', () => {
   it('appends ?token= query', async () => {
      vi.mocked(invoke).mockResolvedValue('ws-token');
      vi.stubGlobal('window', { __TAURI_INTERNALS__: {} });

      const wsConstructor = vi.fn();
      vi.stubGlobal('WebSocket', wsConstructor);

      setSidecarPort(5555);
      await createWebSocket('/stream');

      expect(wsConstructor).toHaveBeenCalledWith('ws://127.0.0.1:5555/stream?token=ws-token');
   });
});
```

## 對 .NET 重寫的價值

T8 是整套 plan **最重要的測試**。.NET 重寫完成後，只要：
1. .NET sidecar 跑起來在 port X
2. 跑 `pnpm capture:contract --target=dotnet --port=X`
3. `diff` 對比 T7 的 fixtures
4. 跑 T8 全套，全綠 = 前端不需要改任何一行

## 驗收

```bash
# 1. 全部 wrapper test 跑得起來
pnpm test:unit:run web/renderer/ipc-api/

# 2. 覆蓋率
pnpm test:coverage --coverage.include='web/renderer/ipc-api/**'
# 目標：≥ 90% lines

# 3. fixture 對應確認（每個 wrapper 至少 import 一個 fixture）
grep -l 'fixtures/contract' web/renderer/ipc-api/*.test.ts | wc -l
# 預期：14（每個 wrapper 都用 fixture）
```

## 風險

- **wrapper internal type 與 fixture `expected` 對不上**：T7 採集時 `expected` 欄位是用「想像中的 wrapper output」填的，跑 T8 才會對；不對就修 fixture（畢竟 wrapper 是真實 source of truth），不要改 wrapper。
- **httpClient.test.ts 需要 unmock**：注意 vi.unmock 只在該檔案範圍生效，不會污染其他測試。
- **WebSocket 在 happy-dom**：應該支援基本 API；若有問題用 `vi.stubGlobal('WebSocket', class { ... })` 自己 stub。

## Out of scope

- 不對 wrapper 的 source 改任何一行（純測試）
- 不寫 wrapper 行為以外的 integration test（那是 store / component 的事）

## User 批准語法

「**T8 OK**」
