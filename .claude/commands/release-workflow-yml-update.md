---
name: release-workflow-yml-update
description: Workflow command scaffold for release-workflow-yml-update in Antares2.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /release-workflow-yml-update

Use this workflow when working on **release-workflow-yml-update** in `Antares2`.

## Goal

Updates and fixes the GitHub Actions release workflow to address CI/CD or deployment issues.

## Common Files

- `.github/workflows/release.yml`
- `CLAUDE.md`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Edit .github/workflows/release.yml to fix or enhance release automation.
- Document the change in CLAUDE.md if it affects the release process.
- Merge changes back to dev if hotfixed on another branch.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.