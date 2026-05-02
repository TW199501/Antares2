#!/usr/bin/env node
/**
 * Release helper: bumps version across 4 files, generates release-notes
 * skeleton, commits, tags, optionally pushes.
 *
 * Usage:
 *   pnpm release 0.8.4
 *   pnpm release patch | minor | major
 *   pnpm release 0.8.4 --dry-run
 *   pnpm release 0.8.4 --no-push
 *   pnpm release 0.8.4 --no-prompt
 *
 * Flow (matching docs/release-notes-v0.8.x.md convention):
 *   1. Pre-flight: working tree clean + branch is "dev".
 *   2. Bump version in package.json / Cargo.toml / Cargo.lock (antares2
 *      entry only) / tauri.conf.json.
 *   3. Generate docs/release-notes-vX.Y.Z.md skeleton grouped by
 *      conventional-commit type from `git log v<prev>..HEAD`.
 *   4. Pause for the author to edit the notes (skip with --no-prompt).
 *   5. Commit "chore(release): bump version <prev> -> <next>".
 *   6. Annotated tag vX.Y.Z.
 *   7. Push origin dev + tag (skip with --no-push).
 *
 * On any failure after step 2 the script `git checkout -- <files>` to
 * roll back the version-file edits.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, '')), '..');
const PKG_JSON = path.join(REPO_ROOT, 'package.json');
const CARGO_TOML = path.join(REPO_ROOT, 'src-tauri', 'Cargo.toml');
const CARGO_LOCK = path.join(REPO_ROOT, 'src-tauri', 'Cargo.lock');
const TAURI_CONF = path.join(REPO_ROOT, 'src-tauri', 'tauri.conf.json');

const args = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith('--')));
const positional = args.filter(a => !a.startsWith('--'));
const DRY_RUN = flags.has('--dry-run');
const NO_TAG = flags.has('--no-tag');
const NO_PUSH = flags.has('--no-push');
const NO_PROMPT = flags.has('--no-prompt');

if (positional.length !== 1) {
   console.error('Usage: pnpm release <version|patch|minor|major> [--dry-run] [--no-tag] [--no-push] [--no-prompt]');
   process.exit(1);
}

function git (...gitArgs) {
   return execFileSync('git', gitArgs, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}

function gitNoThrow (...gitArgs) {
   try { return git(...gitArgs); }
   catch { return null; }
}

function bumpSemver (current, level) {
   const m = current.match(/^(\d+)\.(\d+)\.(\d+)$/);
   if (!m) throw new Error(`Cannot parse current version "${current}" — expected MAJOR.MINOR.PATCH`);
   const [_, MA, MI, PA] = m.map((v, i) => i === 0 ? v : Number(v));
   if (level === 'patch') return `${MA}.${MI}.${PA + 1}`;
   if (level === 'minor') return `${MA}.${MI + 1}.0`;
   if (level === 'major') return `${MA + 1}.0.0`;
   throw new Error(`Unknown bump level "${level}"`);
}

function readJson (file) {
   return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function preflight () {
   const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
   if (branch !== 'dev')
      throw new Error(`Current branch is "${branch}", expected "dev". Switch with: git checkout dev`);

   const status = git('status', '--porcelain');
   if (status)
      throw new Error(`Working tree is dirty. Commit or stash first:\n${status}`);
}

function bumpPackageJson (next) {
   const txt = fs.readFileSync(PKG_JSON, 'utf8');
   const updated = txt.replace(/"version":\s*"[^"]+"/, `"version": "${next}"`);
   if (updated === txt) throw new Error(`No "version": match in ${PKG_JSON}`);
   if (!DRY_RUN) fs.writeFileSync(PKG_JSON, updated);
}

function bumpCargoToml (next) {
   const txt = fs.readFileSync(CARGO_TOML, 'utf8');
   // [package]\nname = "antares2"\nversion = "X.Y.Z"
   const re = /(\[package\]\s*\nname\s*=\s*"antares2"\s*\nversion\s*=\s*")[^"]+(")/;
   const updated = txt.replace(re, `$1${next}$2`);
   if (updated === txt) throw new Error(`No [package]/antares2 version match in ${CARGO_TOML}`);
   if (!DRY_RUN) fs.writeFileSync(CARGO_TOML, updated);
}

function bumpCargoLock (next) {
   const txt = fs.readFileSync(CARGO_LOCK, 'utf8');
   // [[package]]\nname = "antares2"\nversion = "X.Y.Z" — ONLY this entry, not other crates
   const re = /(\[\[package\]\]\s*\nname\s*=\s*"antares2"\s*\nversion\s*=\s*")[^"]+(")/;
   const updated = txt.replace(re, `$1${next}$2`);
   if (updated === txt) throw new Error(`No [[package]]/antares2 version match in ${CARGO_LOCK}`);
   if (!DRY_RUN) fs.writeFileSync(CARGO_LOCK, updated);
}

function bumpTauriConf (next) {
   const txt = fs.readFileSync(TAURI_CONF, 'utf8');
   const updated = txt.replace(/"version":\s*"[^"]+"/, `"version": "${next}"`);
   if (updated === txt) throw new Error(`No "version": match in ${TAURI_CONF}`);
   if (!DRY_RUN) fs.writeFileSync(TAURI_CONF, updated);
}

function classifyCommit (subject) {
   const m = subject.match(/^(\w+)(?:\([^)]+\))?!?:/);
   if (!m) return 'other';
   const type = m[1].toLowerCase();
   if (['feat'].includes(type)) return 'feat';
   if (['fix'].includes(type)) return 'fix';
   if (['refactor'].includes(type)) return 'refactor';
   if (['perf'].includes(type)) return 'perf';
   if (['docs'].includes(type)) return 'docs';
   if (['chore', 'build', 'ci'].includes(type)) return 'chore';
   if (['test'].includes(type)) return 'test';
   if (['style'].includes(type)) return 'style';
   return 'other';
}

const SECTION_TITLES = {
   feat: '✨ Features',
   fix: '🐛 Bug fixes',
   refactor: '🔧 Refactor',
   perf: '⚡ Performance',
   docs: '📝 Documentation',
   chore: '🧹 Housekeeping',
   test: '🧪 Tests',
   style: '🎨 Style',
   other: '📦 Other'
};

function generateReleaseNotes (prevTag, nextVersion) {
   const range = prevTag ? `${prevTag}..HEAD` : 'HEAD';
   const log = gitNoThrow('log', range, '--no-merges', '--pretty=format:%h %s');
   if (!log) return null;

   const buckets = {};
   for (const line of log.split('\n')) {
      const [, ...rest] = line.match(/^(\S+) (.*)$/) || [];
      const subject = rest.join(' ');
      if (!subject) continue;
      const type = classifyCommit(subject);
      (buckets[type] ||= []).push(subject);
   }

   const order = ['feat', 'fix', 'refactor', 'perf', 'docs', 'chore', 'test', 'style', 'other'];
   const sections = order
      .filter(t => buckets[t]?.length)
      .map(t => `## ${SECTION_TITLES[t]}\n\n${buckets[t].map(s => `- ${s}`).join('\n')}`)
      .join('\n\n');

   return [
      `# Antares2 v${nextVersion}`,
      '',
      '<!-- 補一段 release 主軸的人話敘述（為什麼這版重要、最關鍵的兩三件事）。骨架由 git log 自動產生，請刪掉這個註解。 -->',
      '',
      sections,
      '',
      '---',
      '',
      '## English Summary',
      '',
      '<!-- 中英對照的英文摘要 -->',
      '',
      '## 🙏 Credits',
      '',
      'Forked from [antares-sql/antares](https://github.com/antares-sql/antares) by Fabio Di Stasio (MIT License).',
      ''
   ].join('\n');
}

async function pause (message) {
   return new Promise((resolve) => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(message, () => { rl.close(); resolve(); });
   });
}

async function main () {
   preflight();

   const pkg = readJson(PKG_JSON);
   const current = pkg.version;
   const arg = positional[0];
   const next = ['patch', 'minor', 'major'].includes(arg) ? bumpSemver(current, arg) : arg;
   if (!/^\d+\.\d+\.\d+$/.test(next))
      throw new Error(`"${next}" is not a valid semver`);
   if (next === current)
      throw new Error(`Target version ${next} equals current version ${current}`);

   const prevTag = gitNoThrow('describe', '--tags', '--abbrev=0');
   const notesFile = path.join(REPO_ROOT, 'docs', `release-notes-v${next}.md`);

   console.log(`\nantares2 release: ${current} -> ${next}`);
   console.log(`previous tag    : ${prevTag || '(none)'}`);
   console.log(`notes file      : ${path.relative(REPO_ROOT, notesFile)}`);
   console.log(`flags           : ${[...flags].join(' ') || '(none)'}\n`);

   bumpPackageJson(next);
   bumpCargoToml(next);
   bumpCargoLock(next);
   bumpTauriConf(next);
   console.log(`✓ bumped 4 version files`);

   if (fs.existsSync(notesFile)) {
      console.log(`✓ ${path.relative(REPO_ROOT, notesFile)} already exists; skipping skeleton`);
   }
   else {
      const skeleton = generateReleaseNotes(prevTag, next);
      if (skeleton) {
         if (!DRY_RUN) fs.writeFileSync(notesFile, skeleton);
         console.log(`✓ generated release notes skeleton`);
      }
   }

   if (DRY_RUN) {
      console.log('\n[DRY RUN] no commit / tag / push performed. Inspect changes via `git diff`.');
      return;
   }

   if (!NO_PROMPT) {
      console.log(`\n→ Edit ${path.relative(REPO_ROOT, notesFile)} now (補敘述), save, then press Enter to continue.`);
      await pause('  Press Enter when ready (Ctrl+C to abort): ');
   }

   git('add', PKG_JSON, CARGO_TOML, CARGO_LOCK, TAURI_CONF, notesFile);
   git('commit', '-m', `chore(release): bump version ${current} -> ${next}`);
   console.log(`✓ committed`);

   if (!NO_TAG) {
      git('tag', '-a', `v${next}`, '-m', `v${next}`);
      console.log(`✓ tagged v${next}`);
   }

   if (!NO_PUSH) {
      git('push', 'origin', 'dev');
      if (!NO_TAG) git('push', 'origin', `v${next}`);
      console.log(`✓ pushed origin dev${NO_TAG ? '' : ` + v${next}`}`);
   }
   else {
      console.log(`\nSkipped push. To finish:\n  git push origin dev${NO_TAG ? '' : ` v${next}`}`);
   }

   console.log(`\nDone. release.yml will trigger on tag v${next} and produce a public Release.`);
}

main().catch((err) => {
   console.error(`\n✗ ${err.message}`);
   const dirty = gitNoThrow('status', '--porcelain');
   if (dirty && !DRY_RUN) {
      console.error('Rolling back version-file edits...');
      try {
         git('checkout', '--', PKG_JSON, CARGO_TOML, CARGO_LOCK, TAURI_CONF);
         console.error('✓ rolled back');
      }
      catch (rollbackErr) {
         console.error(`✗ rollback failed: ${rollbackErr.message}`);
      }
   }
   process.exit(1);
});
