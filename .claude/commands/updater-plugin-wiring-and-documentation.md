---
name: updater-plugin-wiring-and-documentation
description: Workflow command scaffold for updater-plugin-wiring-and-documentation in Antares2.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /updater-plugin-wiring-and-documentation

Use this workflow when working on **updater-plugin-wiring-and-documentation** in `Antares2`.

## Goal

Wires up or adjusts the Tauri updater plugin, including code changes, permissions, and documentation for activation steps.

## Common Files

- `src-tauri/src/lib.rs`
- `src-tauri/capabilities/default.json`
- `src-tauri/gen/schemas/capabilities.json`
- `.github/workflows/release.yml`
- `CLAUDE.md`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Edit src-tauri/src/lib.rs to register or comment out the updater plugin.
- Update src-tauri/capabilities/default.json and regenerate related schemas if permissions change.
- Edit .github/workflows/release.yml if CI/CD needs to pass new env vars.
- Document activation or deactivation procedures in CLAUDE.md.

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.