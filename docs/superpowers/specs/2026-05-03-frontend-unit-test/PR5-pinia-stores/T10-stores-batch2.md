# T10 — Pinia store 第二批（3 個 ipc-api 呼叫）

**對應 PR**：PR5
**前置**：T8（fixture mock pattern 已建）+ T9
**目標覆蓋率**：lines ≥ 80% / branches ≥ 65%（warn-only）

## 執行配置（**啟動前必讀**）

| 項目 | 值 |
|------|-----|
| 主 skill | `superpowers:test-driven-development` |
| 副 skill | `vuejs-typescript-best-practices`（Pinia testing + ipc-api mock pattern） |
| 模型 | **Opus 4.7** |
| Worktree | **禁用** |
| 並行 subagent | 否（3 個 store 跨依賴複雜，序列做避免 mock 衝突） |
| 詳細政策 | 見 [README 全域執行政策](../../README.md) |

## 範圍

`web/renderer/stores/`：
- `connections.ts`（store id `'connections'`）
- `workspaces.ts`（store id `'workspaces'`）—— **核心 store**
- `application.ts`（store id `'application'`）

這 3 個 store 直接 call ipc-api，測試重用 T7 fixture。

## 觸碰檔案

### 新增
- `web/renderer/stores/connections.test.ts`
- `web/renderer/stores/workspaces.test.ts`
- `web/renderer/stores/application.test.ts`

## 通用 pattern

```ts
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useConnectionsStore } from './connections';
import { apiCall } from '@/ipc-api/httpClient';
// @tests alias（T1 設定）—— 議題 2 修正
import connectionConnectFixture from '@tests/fixtures/contract/connections.connect.mysql.happy.json';

describe('connections store', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
      vi.mocked(apiCall).mockReset();
   });

   it('connect: dispatches Connection.connect with correct payload', async () => {
      vi.mocked(apiCall).mockResolvedValueOnce(connectionConnectFixture.response.body);

      const store = useConnectionsStore();
      await store.addAndConnect({
         name: 'dev',
         client: 'mysql',
         host: '127.0.0.1',
         port: 3306,
         user: 'testuser',
         password: 'x',
         database: 'antares_test_fixture'
      });

      expect(apiCall).toHaveBeenCalledWith(
         '/connections/connect',
         expect.objectContaining({ client: 'mysql', host: '127.0.0.1' })
      );
      expect(store.connected.length).toBe(1);
   });

   it('connect failure: surfaces error and does not add to connected', async () => {
      vi.mocked(apiCall).mockResolvedValueOnce({
         status: 'error',
         response: 'ECONNREFUSED'
      });

      const store = useConnectionsStore();
      await expect(store.addAndConnect({ /* ... */ })).rejects.toThrow();
      expect(store.connected.length).toBe(0);
   });

   it('token expire reload: re-invokes get_sidecar_token', async () => {
      // 模擬 connect 後 token 過期，wrapper 自動重 invoke
      // 細節 spec 執行時 read 實作後決定
   });
});
```

## 各 store 測試重點

### connections
- `addAndConnect` happy / error path（含 4 dialect）
- `disconnect` 後 connected 列表更新
- `connect` 失敗的 retry 機制（若有）
- token expire 時的 reload flow
- 連線設定 persistStore 寫入

### workspaces（**核心 + 最複雜**）
- `addTab` / `removeTab` / `selectTab`
- 切 active connection 時 tabs 同步切換
- query 結果 cache（每個 tab 獨立）
- `closeAll` / 關連線時 tabs 清理
- 跨 store 依賴：依 `connections.connected` + `application.locale`
  - 用 `createTestingPinia({ initialState: { connections: { connected: [...] }, application: { ... } } })` 灌相依

### application
- `checkForUpdates` happy path（updater plugin enabled）
- `checkForUpdates` 在 plugin 未 enable 時的 graceful fallback（status='nocheck'，**不 throw**，CLAUDE.md 明確要求）
- `installUpdate` flow
- locale 切換、theme 切換（這部分若委派 settings store，testing 對應 dispatch）

## 跨依賴範例

```ts
import { createTestingPinia } from '@pinia/testing';

const pinia = createTestingPinia({
   initialState: {
      connections: {
         connected: [{ uid: 'c1', name: 'dev', client: 'mysql' }]
      },
      application: { locale: 'en-US' }
   },
   stubActions: false,
   createSpy: vi.fn
});

setActivePinia(pinia);
const workspaces = useWorkspacesStore();
workspaces.addTab({ uid: 'c1', type: 'query' });
expect(workspaces.tabs.length).toBe(1);
```

## 驗收

```bash
pnpm test:unit:run web/renderer/stores/connections.test.ts \
                   web/renderer/stores/workspaces.test.ts \
                   web/renderer/stores/application.test.ts

pnpm test:coverage --coverage.include='web/renderer/stores/{connections,workspaces,application}.ts'
```

## 風險

- **`workspaces` 是 antares 中最複雜的 store**：可能有 100+ 行 actions、跨多個 ipc-api、含 worker thread 互動。spec 執行時 read 實作後**可能要再拆**為 workspaces.tabs.test.ts + workspaces.connections.test.ts 等子檔。
- **application.checkForUpdates plugin 未 enable**：CLAUDE.md 提到 plugin 註冊行被註解掉，所以實際 runtime `check()` 會 throw → catch → status='nocheck'。測試要驗 catch path 工作（不 throw 出 store 邊界）。
- **fixture 對不上 store action 期望的 payload shape**：若 store 把 user input 轉換後才送 ipc-api，fixture 跟 store 的 input 形狀不一定一樣 —— 可以額外灌假 input 然後驗 store 內部把它轉成 fixture.payload。

## User 批准語法

「**T10 OK**」
