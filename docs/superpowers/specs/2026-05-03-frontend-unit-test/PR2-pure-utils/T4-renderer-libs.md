# T4 — renderer 共用工具測試（9 檔）

**對應 PR**：PR2
**前置**：T1 + T2
**目標覆蓋率**：lines ≥ 95% / branches ≥ 90%（warn-only）

## 執行配置（**啟動前必讀**）

| 項目 | 值 |
|------|-----|
| 主 skill | `superpowers:test-driven-development` |
| 副 skill | `superpowers:subagent-driven-development`（9 檔可分 2-3 批並行） |
| 模型 | **Opus 4.7**（含 subagent dispatch） |
| Worktree | **禁用** |
| 並行 subagent | **是** |
| 詳細政策 | 見 [README 全域執行政策](../../README.md) |

## 範圍

### `web/renderer/libs/`（8 檔）
| 檔 | 重點 |
|----|------|
| `camelize.ts` | snake_case / kebab-case → camelCase；空字串 / 已是 camel |
| `colorShade.ts` | hex + offset → hex；clamp 0-255、輸入格式驗證 |
| `copyText.ts` | mock `navigator.clipboard.writeText`、fallback path |
| `getContrast.ts` | hex → hex（black/white）；WCAG threshold |
| `hexToRgba.ts` | hex+alpha → `rgba(...)`；含 `#`、無 `#`、3-digit hex |
| `unproxify.ts` | Vue Proxy → POJO；deep nested、Map / Set 邊界 |
| `exportRows.ts` | rows → CSV / JSON / SQL；special chars escape、empty rows |
| `persistStore.ts` | localStorage wrapper：set / get / remove、JSON 例外 |

### `web/renderer/lib/`（1 檔）
| 檔 | 重點 |
|----|------|
| `utils.ts` | shadcn `cn()` —— class merge、conflict resolution（tailwind-merge） |

## 範例：copyText.test.ts

```ts
import { describe, expect, it, vi } from 'vitest';
import { copyText } from './copyText';

describe('copyText', () => {
   it('uses navigator.clipboard.writeText when available', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', { clipboard: { writeText } });
      await copyText('hello');
      expect(writeText).toHaveBeenCalledWith('hello');
   });

   it('handles writeText failure gracefully', async () => {
      const writeText = vi.fn().mockRejectedValue(new Error('denied'));
      vi.stubGlobal('navigator', { clipboard: { writeText } });
      // 視 copyText 是 throw 還是 silent 而定
      await expect(copyText('x')).rejects.toThrow();
   });

   it('falls back to document.execCommand if clipboard API absent', async () => {
      vi.stubGlobal('navigator', {});
      const exec = vi.fn().mockReturnValue(true);
      vi.stubGlobal('document', { ...document, execCommand: exec });
      await copyText('hi');
      expect(exec).toHaveBeenCalledWith('copy');
   });
});
```

## 範例：persistStore.test.ts（**含 CLAUDE.md 修正**）

```ts
import { describe, expect, it } from 'vitest';
import { persistStore } from './persistStore';

describe('persistStore', () => {
   it('writes and reads value via localStorage', () => {
      persistStore.set('foo', { bar: 1 });
      expect(JSON.parse(localStorage.getItem('foo')!)).toEqual({ bar: 1 });
      expect(persistStore.get('foo')).toEqual({ bar: 1 });
   });

   it('returns default value for missing key', () => {
      expect(persistStore.get('nope', 'fallback')).toBe('fallback');
   });

   it('handles JSON.parse exception gracefully', () => {
      localStorage.setItem('bad', '{not json');
      expect(() => persistStore.get('bad')).not.toThrow();
      expect(persistStore.get('bad', 'safe')).toBe('safe');
   });

   it('removes key', () => {
      persistStore.set('x', 1);
      persistStore.remove('x');
      expect(localStorage.getItem('x')).toBeNull();
   });
});
```

**附帶**：commit 修 CLAUDE.md 對 persistStore 的「Tauri FS」過時描述（grep `persistStore.*Tauri` 找到段落改成 localStorage）。

## 範例：utils (cn) 測試

```ts
import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn (shadcn class merger)', () => {
   it('merges multiple class strings', () => {
      expect(cn('a', 'b')).toBe('a b');
   });
   it('resolves Tailwind conflicts (last wins)', () => {
      expect(cn('p-2', 'p-4')).toBe('p-4');
      expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
   });
   it('handles conditional classes', () => {
      expect(cn('a', false && 'b', 'c')).toBe('a c');
   });
   it('handles arrays / objects', () => {
      expect(cn(['a', 'b'], { c: true, d: false })).toBe('a b c');
   });
});
```

## 驗收

```bash
pnpm test:unit:run web/renderer/libs/ web/renderer/lib/
pnpm test:coverage --coverage.include='web/renderer/{libs,lib}/**'
# 預期：≥ 95% lines
```

## 風險

- **`exportRows` 可能寫檔到 disk**（透過 Tauri FS）：mock `@tauri-apps/plugin-fs.writeTextFile`（已在 T2 setup 預設 mock）。執行時看實作確定。
- **`navigator.clipboard` 在 happy-dom 預設沒有**：要 `vi.stubGlobal` 灌；測試結束 `vi.unstubAllGlobals()`（或交給 setup 的 `restoreAllMocks`）。

## User 批准語法

「**T4 OK**」
