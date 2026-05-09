#!/usr/bin/env node
/**
 * PreToolUse hook: block `git worktree add`.
 *
 * Triggered by `.claude/settings.json` on every Bash tool invocation.
 * Rejects with exit code 2 (= "block this tool call") if the command
 * contains `git worktree add` (case-insensitive, whitespace-tolerant).
 *
 * Why: repo policy — all work happens directly on dev branch in the
 * main working tree. See CLAUDE.md "## Workflow rules" for the why
 * (avoids parallel-checkout disk overhead + sync-state confusion).
 *
 * Other `git worktree` subcommands (list / remove / prune / move /
 * lock / unlock / repair) are not blocked — they're useful for
 * inspection / cleanup and don't create new working trees.
 */

let stdin = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { stdin += chunk; });
process.stdin.on('end', () => {
   try {
      const input = JSON.parse(stdin);
      const cmd = input?.tool_input?.command ?? '';
      if (/\bgit\s+worktree\s+add\b/i.test(cmd)) {
         process.stderr.write(
            'BLOCKED: `git worktree add` is forbidden by repo policy.\n' +
            'Use `git stash push -- <paths>` or `git checkout <sha> -- <path>` instead.\n' +
            'See CLAUDE.md "## Workflow rules" section.\n'
         );
         process.exit(2);
      }
   }
   catch (_e) {
      // If stdin parsing fails, don't block — let the tool through.
   }
});
