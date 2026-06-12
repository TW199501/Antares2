# T7 — IPC 契約 fixture 採集

**對應 PR**：PR3
**前置**：T0（路徑）；可與 PR2 並行
**後置阻擋**：PR4（T8 依本批 fixture）+ PR5（T10 依 fixture）
**風險等級**：**中高** —— 需要 dev DB 環境、anonymize 不能漏

## 執行配置（**啟動前必讀**）

| 項目 | 值 |
|------|-----|
| 主 skill | `superpowers:executing-plans` |
| 副 skill | — |
| 模型 | **Opus 4.7** |
| Worktree | **禁用** |
| 並行 subagent | 否（採集流程序列：啟 sidecar → 4 dialect 順跑） |
| 詳細政策 | 見 [README 全域執行政策](../../README.md) |

## 動作摘要

對現行 Node sidecar 跑一次完整 ipc-api，採集**兩種契約**：
1. **HTTP 契約**：14 個 wrapper 的 request / response，存成 `.json`
2. **WebSocket 契約**：2 個 WS route（`/ws/export`、`/ws/import`）的 frame sequence，存成 `.jsonl`（每行一 frame）

**這是 .NET 重寫的 acceptance criteria 來源** —— `web/main/workers/{exporter,importer}.ts` 即將被 .NET 取代，沒 WS frame fixture 就只能靠 e2e 抓 regression（成本太高）。

## 觸碰檔案

### 新增
- `scripts/capture-contract-fixtures.mjs`
- `tests/fixtures/contract/<route>.json`（14+ 檔，每 route 1-2 個 fixture）
- `tests/fixtures/contract/README.md`

### 修改
- `package.json` 加 script `capture:contract`
- `.gitignore`（**不**忽略 fixtures，要 commit）

### 不變
- `web/main/server.ts`（**只讀不改**，純跑起來收 traffic）
- 所有 14 個 ipc-api wrapper

## Dev DB 需求（user 必須提供）

採集需要對真實 DB 跑 query；**user 提供以下 connection string**（敏感資訊不要寫死在 git，用 env 或 prompt）：

| DB | 環境需求 | 對應 schema |
|----|---------|-------------|
| MySQL 8.x | dev DB | 一個 small schema 含 1-2 table、1 view、1 procedure、1 trigger、1 index |
| PostgreSQL 14+ | dev DB | 同上，含 1 function、1 schema |
| SQL Server 2019+ | dev DB | 同上，schema=`dbo`，table 名含空白 + bracket（驗 escape）|
| SQLite | local file | dev fixture file（已有的話用，沒就建一個 minimal） |
| Firebird | optional | 若無環境跳過 firebird fixtures，T8 對應 fixture 就 skip |

**理想的 sample schema**（對 dev MySQL 為例）：
```sql
CREATE SCHEMA antares_test_fixture;
USE antares_test_fixture;
CREATE TABLE users (id INT PK, name VARCHAR(50), created_at DATETIME);
CREATE TABLE orders (id INT PK, user_id INT, amount DECIMAL(10,2), FK(user_id));
CREATE VIEW user_orders AS SELECT u.name, o.amount FROM users u JOIN orders o ON u.id=o.user_id;
CREATE PROCEDURE get_user_count() ...;
CREATE TRIGGER orders_audit ...;
INSERT 3-5 rows per table;
```

## `scripts/capture-contract-fixtures.mjs` 設計

### 入口流程

```
1. spawn sidecar (web/main/server.ts) on port 5556 (避開 dev 5555)
2. 等 sidecar emit READY:5556:<token>
3. 對每個 dev DB：
   a. POST /connections/connect with credentials
   b. 對該 DB 跑「14 個 ipc-api 函式 × happy/error path」
   c. 攔截 HTTP request body + response body
   d. anonymize（清 password / token / file path / username）
   e. 寫 tests/fixtures/contract/<route>.<dialect>.<scenario>.json
4. POST /connections/disconnect
5. kill sidecar
```

### 採集對象（14 HTTP routes + 2 WS routes）

| ipc-api 檔 | 主要 routes | 採集 fixture |
|-----------|------------|--------------|
| `Connection.ts` | `connections/connect`、`connections/disconnect` | mysql / pg / mssql / sqlite |
| `Databases.ts` | `databases/list`、`databases/select` | × 4 |
| `Schema.ts` | `schema/list`、`schema/structure` | × 4 |
| `Tables.ts` | `tables/data`、`tables/structure`、`tables/insert/update/delete` | × 4 |
| `Views.ts` | `views/list`、`views/get` | × 4 |
| `Functions.ts` | `functions/list`、`functions/get` | × 4 |
| `Routines.ts` | `routines/list`、`routines/get` | × 4 |
| `Triggers.ts` | `triggers/list`、`triggers/get` | × 4 |
| `Schedulers.ts` | `schedulers/list`（mysql only） | × 1 |
| `Users.ts` | `users/list`、`users/privileges` | × 4 |
| `Application.ts` | `application/version`、`application/check-update` | × 1 |
| `Updater.ts` | `updater/check`、`updater/install` | × 1 |
| `Ai.ts` | `ai/...`（依實作） | × 1（mock LLM endpoint）|

#### WebSocket routes（**v4 + 議題 1 補強**）

| WS path | 對應 store / worker | 採集 fixture |
|---------|---------------------|-------------|
| `/ws/export` | `schemaExport` store + `web/main/workers/exporter.ts` | × 4 dialect |
| `/ws/import` | `schemaImport` store + `web/main/workers/importer.ts` | × 4 dialect |

**為什麼 WS 不能省**：
- `httpClient.createWebSocket(path)` 帶 `?token=` 的握手契約
- 連線後的 frame sequence（client → server: `start` / `cancel` / `pause`；server → client: `progress` / `complete` / `error`）
- frame payload shape（`{ type, jobId, progress, payload }` 之類）

這些 .NET worker 重寫時都要 1:1 對齊，沒 fixture 就只能猜。

### Fixture JSON 結構（HTTP，每檔 .json）

```json
{
   "metadata": {
      "captured_at": "2026-05-03T12:34:56Z",
      "dialect": "mysql",
      "scenario": "happy",
      "anonymized": true
   },
   "request": {
      "route": "tables/data",
      "method": "POST",
      "headers": {
         "Content-Type": "application/json",
         "X-Sidecar-Token": "<REDACTED>"
      },
      "payload": {
         "uid": "<UUID>",
         "schema": "antares_test_fixture",
         "table": "users",
         "limit": 100,
         "offset": 0
      }
   },
   "response": {
      "status": 200,
      "body": {
         "status": "success",
         "response": {
            "rows": [
               { "id": 1, "name": "Alice", "created_at": "2026-01-01T00:00:00Z" }
            ],
            "fields": [
               { "name": "id", "type": "INT", "nullable": false },
               { "name": "name", "type": "VARCHAR", "nullable": true }
            ]
         }
      }
   },
   "expected": {
      "rows": "<same as response.body.response.rows>",
      "fields": "<same as response.body.response.fields>"
   }
}
```

`expected` 區塊是「wrapper 把 response 轉換成內部 type 後的 shape」，T8 replay 測試用這個 assertion。

### Fixture JSONL 結構（WebSocket，每檔 .jsonl）

每行一個 frame，client / server 雙向都記。`tests/fixtures/contract/ws-export.mysql.jsonl`：

```jsonl
{"t":"2026-01-01T00:00:00.000Z","dir":"handshake","payload":{"path":"/ws/export","token":"<REDACTED>","headers":{"sec-websocket-protocol":"v1"}}}
{"t":"2026-01-01T00:00:00.010Z","dir":"client→server","frame":{"type":"start","jobId":"<UUID>","payload":{"uid":"<UUID>","tables":["users","orders"],"format":"sql","options":{"includeData":true}}}}
{"t":"2026-01-01T00:00:00.150Z","dir":"server→client","frame":{"type":"progress","jobId":"<UUID>","payload":{"phase":"schema","done":1,"total":2}}}
{"t":"2026-01-01T00:00:00.300Z","dir":"server→client","frame":{"type":"progress","jobId":"<UUID>","payload":{"phase":"data","done":2,"total":2}}}
{"t":"2026-01-01T00:00:00.500Z","dir":"server→client","frame":{"type":"complete","jobId":"<UUID>","payload":{"path":"<USER_HOME>/export.sql","bytesWritten":4096}}}
{"t":"2026-01-01T00:00:00.510Z","dir":"close","payload":{"code":1000,"reason":"normal"}}
```

**為什麼 jsonl 不用 json**：
- 一行一 frame，與真實傳輸對齊（時序 = 行序）
- diff 對得乾淨（PR review 時看得出哪 frame 變了）
- 採集 script 邊收邊 append，記憶體不爆

**WS error path 也要採**：例如 client 跑 `cancel` mid-job、server 回 `error` payload —— `tests/fixtures/contract/ws-export.mysql.cancel.jsonl`、`ws-export.mssql.error.jsonl` 等。

### 採集 WS 的實作方式

`scripts/capture-contract-fixtures.mjs` 內加 WS 採集函式：

```js
import { WebSocket } from 'ws';

async function captureWs (sidecarPort, token, path, scenario) {
   const log = [];
   const ws = new WebSocket(`ws://127.0.0.1:${sidecarPort}${path}?token=${token}`);
   const start = Date.now();
   const t = () => new Date(start + (Date.now() - start)).toISOString();

   log.push({ t: t(), dir: 'handshake', payload: { path, token: '<REDACTED>' } });

   ws.on('message', (data) => {
      const frame = JSON.parse(data.toString());
      log.push({ t: t(), dir: 'server→client', frame });
   });

   ws.on('open', () => {
      const startFrame = scenario.startFrame;
      log.push({ t: t(), dir: 'client→server', frame: startFrame });
      ws.send(JSON.stringify(startFrame));
   });

   await new Promise(resolve => ws.on('close', (code, reason) => {
      log.push({ t: t(), dir: 'close', payload: { code, reason: reason.toString() } });
      resolve();
   }));

   // anonymize timestamps + uuids
   const anonymized = anonymizeWsLog(log);
   const filename = `tests/fixtures/contract/ws-${path.slice(4)}.${scenario.dialect}.${scenario.name}.jsonl`;
   writeFileSync(filename, anonymized.map(JSON.stringify).join('\n'));
}
```

## Anonymize 規則（**重要，洩密就慘了**）

採集後 fixture 內以下欄位必須替換：

| 來源 | 替換為 |
|------|--------|
| `password` / `pass` 任何形式 | `<REDACTED>` |
| `X-Sidecar-Token` value | `<REDACTED>` |
| connection `host` 若是 internal IP | `127.0.0.1` |
| `user` 若是真名 | `testuser` |
| Windows `C:\Users\<name>\` paths | `<USER_HOME>` |
| UUID 在 `uid`（保留是 uid 但替換成固定 `00000000-0000-0000-0000-000000000001`） | `<UUID>` 或固定值 |
| timestamp（保留結構但換固定值） | `2026-01-01T00:00:00.000Z` |

**capture script 自動跑 anonymize**，commit 之前 user 還要肉眼看一遍 fixtures 確認沒遺漏（grep `password` / 真實 host / 真名）。

## `tests/fixtures/contract/README.md`（要寫的內容）

```markdown
# IPC 契約 Fixtures

這份 fixtures 凍結了前端 ipc-api wrapper 與 sidecar 之間的真實契約。

## 用途

1. T8 wrapper replay 測試用（驗證 wrapper 把 response 正確 map 成內部 type）
2. **.NET 10 重寫的 acceptance criteria** —— .NET sidecar 必須通過同一組 fixture，否則前端 runtime 會壞

## 如何重新採集

1. 啟動 dev DB（MySQL / PostgreSQL / SQL Server）
2. 執行 schema fixture script（見 `tests/fixtures/contract/scripts/`）
3. `pnpm capture:contract`（會 prompt 連線資訊）
4. 跑完後手動 grep 確認 anonymize 完整：
   ```bash
   cd tests/fixtures/contract
   grep -ri "password\|admin\|prod\.local" .  # 應該 0 命中
   ```
5. `git add tests/fixtures/contract && git commit -m "chore(fixtures): refresh contract fixtures"`

## 對 .NET 重寫的意義

.NET sidecar 完成後，跑：
```bash
pnpm capture:contract --target=dotnet --port=5557
diff -r tests/fixtures/contract/ tests/fixtures/contract-dotnet/
```
應只有 timestamp / uuid 差異；其他欄位（route、payload shape、response shape）必須完全一致。
```

## 驗收

```bash
# 1. 採集（user 提供 dev DB credential）
pnpm capture:contract

# 2. 確認 14+ HTTP fixture + 2 個 WS fixture 產出
ls tests/fixtures/contract/*.json | wc -l    # 預期 ~30-50（HTTP × dialect × scenario）
ls tests/fixtures/contract/ws-*.jsonl | wc -l  # 預期 ~16（2 routes × 4 dialect × 2 scenario）

# 3. 大小合理
du -sh tests/fixtures/contract  # 預期 < 250KB（含 WS jsonl）

# 4. anonymize 檢查（不應命中）
grep -rE "password|admin|prod\.local|[A-Z]:\\\\Users\\\\" tests/fixtures/contract/

# 5. idempotent 驗證
pnpm capture:contract  # 重跑
git status -- tests/fixtures/contract  # 預期 diff 只在 timestamp / uuid

# 6. README 文件可讀
cat tests/fixtures/contract/README.md
```

## 風險與 rollback

### 風險
- **dev DB 沒準備好** → user 必須先建 schema 才能跑；spec 執行時若 user 沒 dev DB，**PR3 暫緩**直到環境就緒
- **anonymize 漏改某欄位** → fixture commit 進 git 洩密；多重防護：(1) capture script 跑完自動 grep 危險字、(2) commit 前 user 肉眼 review、(3) git pre-commit hook 跑 grep
- **firebird 沒環境** → fixture 缺 firebird，T8 對應 wrapper test 改用 mock 回值（標註 unmocked-from-real-data）

### Rollback
```bash
git rm -r tests/fixtures/contract/
git rm scripts/capture-contract-fixtures.mjs
# 還原 package.json 的 capture:contract script
```

## Out of scope

- 不採集 Application.ts 的 update flow 全部分支（只 happy + 1 error）
- 不採集 Ai.ts 真實 LLM response（用 mock LLM endpoint）
- 不對 production DB 跑（**嚴格禁止**）

## User 批准語法

「**T7 OK + 我準備好 dev DB**」/「**T7 暫緩，等我建 dev DB**」/「**T7 改成 XXX**」
