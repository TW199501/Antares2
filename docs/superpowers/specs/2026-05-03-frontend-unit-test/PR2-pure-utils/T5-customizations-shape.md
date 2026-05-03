# T5 — customizations shape 驗證（7 檔）

**對應 PR**：PR2
**前置**：T1 + T2
**特殊角色**：**.NET 重寫的能力清單契約** —— 每個 .NET 不支援的 customization 都要在這層顯化

## 執行配置（**啟動前必讀**）

| 項目 | 值 |
|------|-----|
| 主 skill | `superpowers:test-driven-development` |
| 副 skill | — |
| 模型 | **Opus 4.7** |
| Worktree | **禁用** |
| 並行 subagent | 否（7 檔太少不值得 dispatch） |
| 詳細政策 | 見 [README 全域執行政策](../../README.md) |

## 範圍

`web/common/customizations/`：
- `defaults.ts` — base defaults
- `index.ts` — entry，輸出 `customizations` map
- `mysql.ts`、`postgresql.ts`、`sqlite.ts`、`mssql.ts`、`firebird.ts` — 5 個 client

## 為什麼這層特別重要

renderer 透過 `workspace.customizations.<feature>` 讀「目前連線的 DB 是否支援某 feature」（CLAUDE.md customizations pattern）。.NET 重寫時這份契約必須一字不差搬過去，否則前端會出現「按鈕能按但功能未實作」之類的破綻。

## 測試設計（兩層）

### Layer 1：每個 client 的物件 snapshot

```ts
// web/common/customizations/mysql.test.ts
import { describe, expect, it } from 'vitest';
import customizations from './mysql';

describe('mysql customizations', () => {
   it('matches snapshot', () => {
      expect(customizations).toMatchSnapshot();
   });
});
```

snapshot baseline 一次後，**任何 customizations 物件改動都會在 PR diff 顯示** —— review 時就能看到契約變了。

### Layer 2：shape consistency assertion（跨 client）

```ts
// web/common/customizations/index.test.ts
import { describe, expect, it } from 'vitest';
import { customizations } from './index';

const REQUIRED_FEATURES = [
   'database',
   'tables',
   'views',
   'procedures',
   'functions',
   'triggers',
   'schemas',
   'indexes',
   'foreigns',
   'transactions',
   'comments',
   'export',
   'import'
] as const;

describe('customizations shape', () => {
   for (const client of ['mysql', 'maria', 'pg', 'sqlite', 'mssql', 'firebird'] as const) {
      it(`${client} declares all required feature flags`, () => {
         const c = customizations[client];
         expect(c).toBeDefined();
         for (const feat of REQUIRED_FEATURES) {
            expect(c, `${client}.${feat}`).toHaveProperty(feat);
            expect(typeof c[feat], `${client}.${feat} type`).toMatch(/boolean|object/);
         }
      });
   }

   it('every client extends defaults (no missing keys)', () => {
      const defaultsKeys = Object.keys(customizations.defaults ?? {}).sort();
      for (const client of ['mysql', 'maria', 'pg', 'sqlite', 'mssql', 'firebird'] as const) {
         const clientKeys = Object.keys(customizations[client]).sort();
         for (const k of defaultsKeys) {
            expect(clientKeys, `${client} missing key ${k}`).toContain(k);
         }
      }
   });
});
```

## 為什麼是 snapshot + assertion 雙層

- Snapshot 抓**意外改動**（看 diff 就知道）
- Assertion 抓**遺漏**（新加 client 時忘記填某 feature）

兩層互補，缺一不可。

## 驗收

```bash
pnpm test:unit:run web/common/customizations/

# 第一次跑會產 __snapshots__/，commit 進去
git add web/common/customizations/__snapshots__

# 之後改動 customizations 必須 update snapshot
pnpm test:unit:run web/common/customizations/ -u
```

## 風險

- **REQUIRED_FEATURES 列表來自我推測**：spec 執行時 read 真實 customizations 物件、列出共同 keys 當 baseline。若有 keys 在某些 client 不存在（合法的差異），改用「subset 必含」邏輯而非「全等」。
- **snapshot baseline drift**：第一次 commit 時就鎖住，未來任何改動都要在 PR review 確認語意是否合理。

## Out of scope

- 不測各 customization 在 runtime 實際被消費的 logic（那是 store / component 的事）
- 不寫 customization 的「正向使用」測試（例如「mysql 的 schemas=false → UI 隱藏 schema 切換」），這是 component test 工作

## User 批准語法

「**T5 OK**」
