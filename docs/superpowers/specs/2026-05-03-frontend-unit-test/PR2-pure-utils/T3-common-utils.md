# T3 — common 純工具測試（14 檔 + 3 根目錄）

**對應 PR**：PR2
**前置**：T1 + T2 + T3 sample
**目標覆蓋率**：lines ≥ 95% / branches ≥ 90%（warn-only，T16 報告顯示）

## 執行配置（**啟動前必讀**）

| 項目 | 值 |
|------|-----|
| 主 skill | `superpowers:test-driven-development` |
| 副 skill | `superpowers:subagent-driven-development`（15 utils 並行 dispatch） |
| 模型 | **Opus 4.7**（含 subagent dispatch） |
| Worktree | **禁用** |
| 並行 subagent | **是** —— 建議 3 批每批 5 utils |
| 詳細政策 | 見 [README 全域執行政策](../../README.md) |

## 範圍（17 檔）

### `web/common/libs/`（12 檔）
| 檔 | 性質 | 重點測試 |
|----|------|---------|
| `bufferToBase64.ts` | Buffer → base64 | 空 Buffer / 大 Buffer / binary 邊界 |
| `encrypter.ts` | encrypt/decrypt | round-trip、key 錯誤、空字串、Unicode |
| `formatBytes.ts` | bytes → human readable | 0、< 1KB、TB 級、負數、Infinity |
| `getArrayDepth.ts` | nested array depth | 空 / 1D / 巢套 5 層 / mixed type |
| `hexToBinary.ts` | hex string → binary | empty、odd length、invalid char |
| `langDetector.ts` | SQL dialect detect | mysql / postgres / mssql / 模糊輸入 |
| `mimeFromHex.ts` | magic bytes → mime | png / jpg / pdf / unknown 回 fallback |
| `uidGen.ts` | uid generator | T3 sample 已寫，這裡確認 |
| `sqlUtils.ts` | SQL helper（escape / split） | SQL injection chars、multi-statement |
| `fakerCustom.ts` | faker wrapper | 各 faker method 都產出 string、無 throw |
| `sqlBuilder/index.ts` | builder entry | route 到正確 dialect builder |
| `sqlBuilder/mssql.ts` | SQL Server builder | `[brackets]` escape、TOP / OFFSET、schema.table |

### `web/common/`（3 檔）
| 檔 | 重點 |
|----|------|
| `FakerMethods.ts` | const list、shape consistency |
| `fieldTypes.ts` | 各 DB type → category mapping、unknown fallback |
| `shortcuts.ts` | 預設 shortcut 表結構、key combo unique |

## 共通測試模板

```ts
// web/common/libs/formatBytes.test.ts
import { describe, expect, it } from 'vitest';
import { formatBytes } from './formatBytes';

describe('formatBytes', () => {
   it('handles 0', () => {
      expect(formatBytes(0)).toBe('0 B');
   });
   it('formats KB / MB / GB / TB', () => {
      expect(formatBytes(1024)).toMatch(/1\.?0*\s*KB/);
      expect(formatBytes(1024 ** 2)).toMatch(/1\.?0*\s*MB/);
      expect(formatBytes(1024 ** 3)).toMatch(/1\.?0*\s*GB/);
      expect(formatBytes(1024 ** 4)).toMatch(/1\.?0*\s*TB/);
   });
   it('handles negative input gracefully', () => {
      expect(() => formatBytes(-1)).not.toThrow();
   });
   it('handles Infinity', () => {
      expect(formatBytes(Infinity)).toBeTypeOf('string');
   });
});
```

## sqlBuilder/mssql 重點

`[brackets]` escape 是 SQL Server 特有，**.NET 重寫時這層必須保持一致**，所以是契約測試的一部分：

```ts
// web/common/libs/sqlBuilder/mssql.test.ts
describe('mssql sqlBuilder', () => {
   it('escapes table name with brackets', () => {
      const sql = builder.select({ schema: 'dbo', table: 'My Table' });
      expect(sql).toContain('[dbo].[My Table]');
   });
   it('escapes column name with reserved word', () => {
      const sql = builder.select({ table: 't', columns: ['order'] });
      expect(sql).toContain('[order]');
   });
   it('handles bracket inside identifier (escapes ] as ]])', () => {
      const sql = builder.select({ table: 'foo]bar' });
      expect(sql).toContain('[foo]]bar]');
   });
   it('TOP + OFFSET pagination', () => {
      const sql = builder.select({ table: 't', limit: 10, offset: 20 });
      expect(sql).toMatch(/OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY/i);
   });
});
```

## encrypter round-trip

```ts
describe('encrypter', () => {
   it('encrypt then decrypt returns original', () => {
      const plain = 'my secret password';
      const encrypted = encrypt(plain, 'key123');
      expect(encrypted).not.toBe(plain);
      expect(decrypt(encrypted, 'key123')).toBe(plain);
   });
   it('decrypt with wrong key throws or returns garbage', () => {
      const encrypted = encrypt('foo', 'key1');
      expect(() => decrypt(encrypted, 'key2')).toThrow();
      // 或：expect(decrypt(encrypted, 'key2')).not.toBe('foo')
   });
   it('handles Unicode (CJK)', () => {
      const plain = '密碼設定 漢字';
      expect(decrypt(encrypt(plain, 'k'), 'k')).toBe(plain);
   });
   it('handles empty string', () => {
      expect(decrypt(encrypt('', 'k'), 'k')).toBe('');
   });
});
```

## 驗收

```bash
# 全套跑
pnpm test:unit:run web/common/

# 單檔覆蓋率
pnpm test:coverage web/common/libs/sqlBuilder/mssql.ts
# 預期：≥ 95% lines

# 整體 common 覆蓋率
pnpm test:coverage --coverage.include='web/common/**'
```

## 風險

- **encrypter 可能用了 Node `crypto` API**：happy-dom 不支援 Node crypto，要用 `globalThis.crypto.subtle` (WebCrypto) 或在 vitest config 加 `pool: 'forks'` + `environment: 'node'` 給這支特例。執行時讀 encrypter.ts 看實作再決定。
- **sqlBuilder 可能用了 db-driver 的 escape 函式**：若 import `mssql` package 會在 happy-dom 環境爆，要 mock 該 dep 或將 sqlBuilder 改純函式。執行時 read 後決定。

## Out of scope

- 不測 sqlBuilder/ 下其他 dialect（mysql / postgres / sqlite / firebird）—— 若有的話本 spec 會擴充
- 不測 sqlUtils 內 driver-specific helper（依 db driver 的部分歸類在 ipc-api 那層）

## User 批准語法

「**T3 common-utils OK**」
