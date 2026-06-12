#!/usr/bin/env node
/**
 * Coverage gate — reads coverage/lcov.info, enforces a single global hard
 * gate (60% lines + 60% branches) **on non-component code only**, prints a
 * per-zone report (warn-only), and optionally writes coverage/report.md for
 * PR comment.
 *
 * Usage
 * -----
 *   pnpm test:coverage:check               # gate only, exit 1 on fail
 *   pnpm test:coverage:check -- --report   # also write coverage/report.md
 *
 * Why a custom gate instead of vitest's built-in `coverage.thresholds`?
 *   - vitest's built-in supports per-glob thresholds but not the
 *     "warn-only" semantics we want for buildup phases.
 *   - We dropped vitest's internal `thresholds` block in commit a18b40a
 *     (PR1/T3) precisely so this script is the single source of truth.
 *
 * Hard gate (CI blocks)
 *   lines ≥ 60% && branches ≥ 60% — computed across web/renderer/{libs,lib,
 *   ipc-api,stores,composables} + web/common/. Components are intentionally
 *   excluded because:
 *     - 194 .vue files in web/renderer/components/ vs ~14 unit-tested
 *       (the rest are tested via Playwright e2e + integration paths)
 *     - Including components would force the global ratio to be dominated
 *       by untested .vue files, making the gate unhittable until every
 *       component has a unit test (which contradicts the testing-pyramid
 *       choice in the v2 plan)
 *   The component zone is still measured + reported as warn-only.
 *
 * Zone targets (warn-only — emoji ⚠ in report, exit 0)
 *   common-and-libs            lines ≥ 95% / branches ≥ 90%
 *   ipc-api                    lines ≥ 90% / branches ≥ 75%
 *   stores                     lines ≥ 80% / branches ≥ 65%
 *   composables                lines ≥ 85% / branches ≥ 70%
 *   components                 lines ≥ 40% / branches ≥ 25%
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const HARD_GATE = {
   lines: 60,
   branches: 60
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

// ────────────────────────────────────────────────────────────────────
// lcov.info parser — minimal, only the fields we need
// ────────────────────────────────────────────────────────────────────
function parseLcov (content) {
   const records = [];
   let current = null;
   for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (line.startsWith('SF:')) {
         current = {
            file: line.slice(3),
            lines: { hit: 0, found: 0 },
            branches: { hit: 0, found: 0 },
            functions: { hit: 0, found: 0 }
         };
      }
      else if (!current) { continue; }
      else if (line.startsWith('LH:')) current.lines.hit = +line.slice(3);
      else if (line.startsWith('LF:')) current.lines.found = +line.slice(3);
      else if (line.startsWith('BRH:')) current.branches.hit = +line.slice(4);
      else if (line.startsWith('BRF:')) current.branches.found = +line.slice(4);
      else if (line.startsWith('FNH:')) current.functions.hit = +line.slice(4);
      else if (line.startsWith('FNF:')) current.functions.found = +line.slice(4);
      else if (line === 'end_of_record') {
         records.push(current);
         current = null;
      }
   }
   return records;
}

function aggregate (records) {
   const sum = {
      lines: { hit: 0, found: 0 },
      branches: { hit: 0, found: 0 },
      functions: { hit: 0, found: 0 }
   };
   for (const r of records) {
      sum.lines.hit += r.lines.hit; sum.lines.found += r.lines.found;
      sum.branches.hit += r.branches.hit; sum.branches.found += r.branches.found;
      sum.functions.hit += r.functions.hit; sum.functions.found += r.functions.found;
   }
   return {
      lines: pct(sum.lines),
      branches: pct(sum.branches),
      functions: pct(sum.functions),
      filesCount: records.length
   };
}

function pct ({ hit, found }) {
   return found === 0 ? 100 : (hit / found) * 100;
}

function fmt (n) { return n.toFixed(1) + '%'; }

function filterByZone (records, zone) {
   // Match on either forward or backslash to handle Windows lcov paths
   const matchers = zone.glob.map(g => g.replace(/\//g, '[\\\\/]'));
   const re = new RegExp(matchers.join('|'));
   return records.filter(r => re.test(r.file));
}

// ────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────
const lcovPath = resolve('coverage/lcov.info');
if (!existsSync(lcovPath)) {
   console.error('❌ coverage/lcov.info not found. Run `pnpm test:coverage` first.');
   process.exit(1);
}

const wantReport = process.argv.includes('--report');
const all = parseLcov(readFileSync(lcovPath, 'utf-8'));

// Hard gate excludes components/ — see header comment for rationale.
const componentRe = /web[\\/]renderer[\\/]components[\\/]/;
const nonComponent = all.filter(r => !componentRe.test(r.file));
const gateAgg = aggregate(nonComponent);
const overall = aggregate(all); // for total file count info

const out = [];
const log = (s) => { out.push(s); console.log(s); };

log('## Coverage Report');
log('');
log(`### Hard gate — non-component code (CI blocks if any < ${HARD_GATE.lines}%)`);
log('');
log('| Metric | Value | Gate | Status |');
log('|--------|-------|------|--------|');

let hardFail = false;
for (const m of ['lines', 'branches']) {
   const value = gateAgg[m];
   const gate = HARD_GATE[m];
   const pass = value >= gate;
   if (!pass) hardFail = true;
   log(`| ${m} | ${fmt(value)} | ≥ ${gate}% | ${pass ? '✅' : '❌'} |`);
}
log(`| files (gated) | ${gateAgg.filesCount} | — | ℹ |`);
log(`| files (total incl. components) | ${overall.filesCount} | — | ℹ |`);
log('');

log('### Zone targets (warn-only — informational)');
log('');
log('| Zone | Lines | Lines target | Branches | Branches target | Status |');
log('|------|-------|--------------|----------|-----------------|--------|');

for (const zone of ZONES) {
   const zRecords = filterByZone(all, zone);
   if (zRecords.length === 0) {
      log(`| ${zone.name} | — | ≥ ${zone.target.lines}% | — | ≥ ${zone.target.branches}% | ⏭ no files |`);
      continue;
   }
   const z = aggregate(zRecords);
   const linePass = z.lines >= zone.target.lines;
   const branchPass = z.branches >= zone.target.branches;
   const status = linePass && branchPass ? '✅' : '⚠ below target';
   log(`| ${zone.name} | ${fmt(z.lines)} | ≥ ${zone.target.lines}% | ${fmt(z.branches)} | ≥ ${zone.target.branches}% | ${status} |`);
}
log('');

if (wantReport) {
   const reportPath = resolve('coverage/report.md');
   writeFileSync(reportPath, out.join('\n') + '\n', 'utf8');
   console.log(`📝 Markdown report written to ${reportPath}`);
}

if (hardFail) {
   console.error(`\n❌ Hard gate failed. Coverage below ${HARD_GATE.lines}% threshold.`);
   process.exit(1);
}

console.log(`\n✅ Hard gate passed (≥ ${HARD_GATE.lines}% lines + branches).`);
process.exit(0);
