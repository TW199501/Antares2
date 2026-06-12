#!/usr/bin/env node
// Phase 5: mechanically verify web/renderer/ + web/common/ have not been modified
// during the .NET migration outside of an explicit allowlist.
//
// Plan: docs/superpowers/plans/2026-05-05-net-sidecar-migration.md (Phase 5 §348-374)
// Compares HEAD against the tag in docs/net-migration/baseline-tag.txt and asserts
// every changed file under web/renderer/ or web/common/ has an allowlist entry.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_TAG_FILE = join(ROOT, 'docs', 'net-migration', 'baseline-tag.txt');
const ALLOWLIST_FILE = join(ROOT, 'docs', 'net-migration', 'renderer-audit-allowlist.txt');
const PROTECTED_PREFIXES = ['web/renderer/', 'web/common/'];

if (!existsSync(BASELINE_TAG_FILE)) {
   console.error(`✗ baseline tag file missing: ${BASELINE_TAG_FILE}`);
   process.exit(1);
}
const baselineTag = readFileSync(BASELINE_TAG_FILE, 'utf8').trim();

// Verify the baseline tag actually exists in the repo. If not (e.g. Phase 0 hasn't
// been tagged yet on this machine), we still want a pass — print a notice and exit 0
// so the gate doesn't break sequence in early phases.
const tagCheck = spawnSync('git', ['rev-parse', '--verify', baselineTag], { stdio: ['ignore', 'pipe', 'pipe'] });
if (tagCheck.status !== 0) {
   console.log(`(info) baseline tag '${baselineTag}' does not yet exist locally. Audit skipped.`);
   console.log('Re-run after Phase 0 commit + tag (see docs/superpowers/plans/2026-05-06-net-migration-playbook.md).');
   process.exit(0);
}

// List files changed since baseline.
const diff = spawnSync('git', ['diff', '--name-only', `${baselineTag}...HEAD`], { encoding: 'utf8' });
if (diff.status !== 0) {
   console.error(`✗ git diff failed: ${diff.stderr}`);
   process.exit(2);
}
const changedFiles = diff.stdout.split('\n').map(s => s.trim()).filter(Boolean);

const protectedChanges = changedFiles.filter(f => PROTECTED_PREFIXES.some(p => f.startsWith(p)));
if (protectedChanges.length === 0) {
   console.log(`✓ No changes under ${PROTECTED_PREFIXES.join(' / ')} since ${baselineTag}.`);
   process.exit(0);
}

// Read allowlist (skip blank lines + comments).
const allowlistLines = existsSync(ALLOWLIST_FILE)
   ? readFileSync(ALLOWLIST_FILE, 'utf8').split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'))
   : [];

// Each allowlist entry: <sha-prefix> <file-substring> <reason...>
const allowlist = allowlistLines.map(l => {
   const tokens = l.split(/\s+/);
   return { sha: tokens[0], pattern: tokens[1] ?? '' };
});

// For each changed protected file, verify SOME commit between baseline..HEAD that
// touched it has a matching allowlist entry.
const violations = [];
for (const file of protectedChanges) {
   // Find commits that touched this file.
   const log = spawnSync('git', ['log', '--format=%H', `${baselineTag}..HEAD`, '--', file], { encoding: 'utf8' });
   const commits = log.stdout.split('\n').map(s => s.trim()).filter(Boolean);
   const ok = commits.some(commitSha => allowlist.some(entry => commitSha.startsWith(entry.sha) && file.includes(entry.pattern)));
   if (!ok) violations.push({ file, commits });
}

if (violations.length === 0) {
   console.log(`✓ All ${protectedChanges.length} change(s) under protected paths are explicitly allowlisted.`);
   process.exit(0);
}

console.error(`✗ ${violations.length} unallowlisted change(s) under web/renderer/ or web/common/:`);
for (const v of violations) {
   console.error(`  · ${v.file}`);
   for (const c of v.commits) console.error(`      commit: ${c}`);
}
console.error('\nAdd an entry to docs/net-migration/renderer-audit-allowlist.txt with reason, OR revert the change.');
process.exit(1);
