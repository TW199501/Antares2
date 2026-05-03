# T3 sample — uidGen.test.ts

**對應 PR**：PR1
**前置**：T2（setup + helpers 已建）
**後置阻擋**：T3 全套 + 後續所有測試的「co-located 範本」
**風險等級**：低

## 執行配置（**啟動前必讀**）

| 項目 | 值 |
|------|-----|
| 主 skill | `superpowers:test-driven-development` |
| 副 skill | — |
| 模型 | **Opus 4.7** |
| Worktree | **禁用** |
| 並行 subagent | 否 |
| 詳細政策 | 見 [README 全域執行政策](../../README.md) |

## 動作摘要

寫第一支 co-located 測試 `web/common/libs/uidGen.test.ts`，作為後續所有測試的 reference template。同時驗證 vitest infra 跑得起來。

## 觸碰檔案

### 新增
- `web/common/libs/uidGen.test.ts`

### 不變
- `web/common/libs/uidGen.ts`（受測對象）
- 所有 setup / helper

## 為什麼選 uidGen 當 sample

- 純函式（無 dep、無 side effect）
- 公開 API 簡單（一個產 uid 的函式）
- 可測 uniqueness、format、boundary
- 是被很多 store / wrapper 引用的基礎工具，先驗它不會挖坑

## 測試設計

```ts
// web/common/libs/uidGen.test.ts
import { describe, expect, it } from 'vitest';
import { uidGen } from './uidGen';

describe('uidGen', () => {
   it('returns a non-empty string', () => {
      const uid = uidGen();
      expect(uid).toBeTypeOf('string');
      expect(uid.length).toBeGreaterThan(0);
   });

   it('returns unique values across 1000 calls', () => {
      const set = new Set<string>();
      for (let i = 0; i < 1000; i++) set.add(uidGen());
      expect(set.size).toBe(1000);
   });

   it('matches expected format (e.g. alphanumeric, length range)', () => {
      const uid = uidGen();
      // 假設 uidGen 產 6+ 字元的英數
      // 真實 regex 視 uidGen 實作調整（spec 執行時 read 後決定）
      expect(uid).toMatch(/^[\w-]+$/);
   });

   it('accepts optional prefix argument if implemented', () => {
      // 若 uidGen 接受 prefix 參數
      // 視實作決定要不要加；若 uidGen() 無參數，刪此 test
      // const uid = uidGen('conn-');
      // expect(uid.startsWith('conn-')).toBe(true);
   });
});
```

> **執行時 read 真實 uidGen.ts**：可能 uidGen 沒接 prefix 參數，要刪掉第 4 個 it；可能 format 不是 `^[\w-]+$`，要調 regex。

## 驗收

```bash
pnpm test:unit:run web/common/libs/uidGen.test.ts
# 預期：3-4 個 test 全綠

pnpm test:coverage web/common/libs/uidGen.ts
# 預期：uidGen.ts coverage ≥ 95%（純函式應該很高）
```

## 風險與 rollback

低風險。失敗 → 看 test 跑出來什麼錯，多半是 uidGen 實作跟我預期不同，調 test 內容即可。

## User 批准語法

「**T3 sample OK**」
