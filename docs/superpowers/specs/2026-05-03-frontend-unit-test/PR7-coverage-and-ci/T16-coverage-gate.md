# T16 — Coverage gate 自寫腳本

**對應 PR**：PR7
**前置**：T1-T15（要有測試才能 gate）
**風險等級**：低（純 build script，錯了不影響功能）

## 執行配置（**啟動前必讀**）

| 項目 | 值 |
|------|-----|
| 主 skill | `superpowers:executing-plans` |
| 副 skill | — |
| 模型 | **Opus 4.7** |
| Worktree | **禁用** |
| 並行 subagent | 否 |
| 詳細政策 | 見 [README 全域執行政策](../../README.md) |

## 動作摘要

寫 `scripts/check-coverage.mjs`：讀 `coverage/lcov.info`，計算總體與分區覆蓋率；hard gate 失敗 exit 1，warn-only 區產 markdown 報告。

## 觸碰檔案

### 新增
- `scripts/check-coverage.mjs`

### 修改
- `package.json`（已在 T1 加 `test:coverage:check`）

## 完整實作

```js
// scripts/check-coverage.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const HARD_GATE = {
   lines: 60,
   branches: 60,
   functions: 60,
   statements: 60
};

const ZONES = [
   {
      name: 'common-and-libs',
      glob: ['web/common/', 'web/renderer/libs/', 'web/renderer/lib/'],
      target: { lines: 95, branches: 90 }
   },
   {
      name: 'ipc-api',
      glob: ['web/renderer/ipc-api/'],
      target: { lines: 90, branches: 75 }
   },
   {
      name: 'stores',
      glob: ['web/renderer/stores/'],
      target: { lines: 80, branches: 65 }
   },
   {
      name: 'composables',
      glob: ['web/renderer/composables/'],
      target: { lines: 85, branches: 70 }
   },
   {
      name: 'components',
      glob: ['web/renderer/components/'],
      target: { lines: 40, branches: 25 }
   }
];

// ─── lcov.info 解析 ───
function parseLcov (content) {
   const records = [];
   let current = null;
   for (const line of content.split('\n')) {
      if (line.startsWith('SF:')) {
         current = {
            file: line.slice(3),
            lines: { hit: 0, found: 0 },
            branches: { hit: 0, found: 0 },
            functions: { hit: 0, found: 0 }
         };
      } else if (!current) { continue; }
      else if (line.startsWith('LH:')) current.lines.hit = +line.slice(3);
      else if (line.startsWith('LF:')) current.lines.found = +line.slice(3);
      else if (line.startsWith('BRH:')) current.branches.hit = +line.slice(4);
      else if (line.startsWith('BRF:')) current.branches.found = +line.slice(4);
      else if (line.startsWith('FNH:')) current.functions.hit = +line.slice(4);
      else if (line.startsWith('FNF:')) current.functions.found = +line.slice(4);
      else if (line.startsWith('end_of_record')) {
         records.push(current);
         current = null;
      }
   }
   return records;
}

function aggregate (records) {
   const sum = { lines: { hit: 0, found: 0 }, branches: { hit: 0, found: 0 }, functions: { hit: 0, found: 0 } };
   for (const r of records) {
      sum.lines.hit += r.lines.hit; sum.lines.found += r.lines.found;
      sum.branches.hit += r.branches.hit; sum.branches.found += r.branches.found;
      sum.functions.hit += r.functions.hit; sum.functions.found += r.functions.found;
   }
   return {
      lines: pct(sum.lines),
      branches: pct(sum.branches),
      functions: pct(sum.functions),
      statements: pct(sum.lines)  // lcov 沒拆 statement，借用 lines
   };
}

function pct ({ hit, found }) {
   return found === 0 ? 100 : (hit / found) * 100;
}

function filterByZone (records, zone) {
   return records.filter(r => zone.glob.some(prefix => r.file.includes(prefix)));
}

function fmt (n) { return n.toFixed(1) + '%'; }

// ─── 主流程 ───
const lcovPath = resolve('coverage/lcov.info');
if (!existsSync(lcovPath)) {
   console.error('❌ coverage/lcov.info not found. Run pnpm test:coverage first.');
   process.exit(1);
}

const all = parseLcov(readFileSync(lcovPath, 'utf-8'));
const overall = aggregate(all);

const wantReport = process.argv.includes('--report');
const lines = [];
const log = (s) => { lines.push(s); console.log(s); };

log(`\n## Coverage Report\n`);
log(`### Hard Gate (CI blocks if any < ${HARD_GATE.lines}%)`);
log(`| Metric | Value | Gate | Status |`);
log(`|--------|-------|------|--------|`);

let hardFail = false;
for (const m of ['lines', 'branches', 'functions', 'statements']) {
   const value = overall[m];
   const gate = HARD_GATE[m];
   const pass = value >= gate;
   if (!pass) hardFail = true;
   log(`| ${m} | ${fmt(value)} | ≥ ${gate}% | ${pass ? '✅' : '❌'} |`);
}

log(`\n### Zone Targets (warn-only)`);
log(`| Zone | Lines | Lines target | Branches | Branches target | Status |`);
log(`|------|-------|--------------|----------|-----------------|--------|`);

for (const zone of ZONES) {
   const zRecords = filterByZone(all, zone);
   if (zRecords.length === 0) {
      log(`| ${zone.name} | n/a | ≥ ${zone.target.lines}% | n/a | ≥ ${zone.target.branches}% | ⏭ no files |`);
      continue;
   }
   const z = aggregate(zRecords);
   const linePass = z.lines >= zone.target.lines;
   const branchPass = z.branches >= zone.target.branches;
   const status = linePass && branchPass ? '✅' : '⚠️ below target';
   log(`| ${zone.name} | ${fmt(z.lines)} | ≥ ${zone.target.lines}% | ${fmt(z.branches)} | ≥ ${zone.target.branches}% | ${status} |`);
}

if (wantReport) {
   writeFileSync('coverage/report.md', lines.join('\n'));
   console.log(`\n📝 Markdown report written to coverage/report.md`);
}

if (hardFail) {
   console.error(`\n❌ Hard gate failed. Coverage below 60% threshold.`);
   process.exit(1);
} else {
   console.log(`\n✅ Hard gate passed.`);
   process.exit(0);
}
```

## 設計理由

- **全域 60% 是唯一 hard gate**（user 指定）
- **分區 95/90/85/80/40 是品質目標**，warn-only 顯示在報告，但**不**擋 PR
- **lcov 而非 json-summary**：lcov 是業界標準，CI 整合（codecov / coveralls）也吃這個格式
- **statements 借用 lines 統計**：lcov 沒原生拆 statement coverage，跟 vitest config 的 statements thresholds 對齊用同 lines 數字

## 驗收

```bash
# 1. 跑全套測試 + 覆蓋率
pnpm test:coverage

# 2. gate 跑得起來
pnpm test:coverage:check
# 預期：全部 60% pass + 分區報告
echo $?  # 應為 0

# 3. 報告檔產出
pnpm test:coverage:check --report
cat coverage/report.md

# 4. 故意壞掉測試（手動把某個 .test.ts skip 一半）→ rerun → 應 exit 1
pnpm test:coverage
pnpm test:coverage:check
echo $?  # 應為 1
```

## 風險

- **lcov 解析格式變動**：vitest @v8 預期穩定產 lcov，但若升級 reporter format 變，要回頭改 parser。
- **coverage 路徑相對 / 絕對**：lcov 內 SF: 可能是 abs path 或 rel；filter 函式用 `includes` 不用 `startsWith` 容錯。
- **zone 沒檔案的情境**：T8 / T16 還沒做的階段跑會 0 檔，需 graceful skip（已加 `if (zRecords.length === 0)` 邏輯）。

## User 批准語法

「**T16 OK**」
