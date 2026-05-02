---
name: release-version-bump-and-tag
description: Workflow command scaffold for release-version-bump-and-tag in Antares2.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /release-version-bump-and-tag

Use this workflow when working on **release-version-bump-and-tag** in `Antares2`.

## Goal

Automates the process of bumping the project version, updating all version files, generating release notes, tagging, and pushing to origin.

## Common Files

- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`
- `src-tauri/tauri.conf.json`
- `docs/release-notes-v*.md`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Ensure on dev branch with clean working tree.
- Bump version in package.json, src-tauri/Cargo.toml, src-tauri/Cargo.lock (antares2 entry), and src-tauri/tauri.conf.json.
- Generate docs/release-notes-vX.Y.Z.md skeleton if not exists.
- Pause for author to fill in release notes prose section.
- Commit all version and release note changes.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.