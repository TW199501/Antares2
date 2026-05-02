```markdown
# Antares2 Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill teaches the core development conventions and workflows used in the Antares2 repository, a project built with Rust (backend) and Vue (frontend). It covers commit message standards, file naming, import/export patterns, and automated workflows for releases, CI/CD, and plugin management. By following these patterns, contributors can ensure consistency, reliability, and smooth collaboration within the codebase.

## Coding Conventions

### Commit Messages

- **Style:** [Conventional Commits](https://www.conventionalcommits.org/)
- **Prefixes:** `feat`, `chore`, `fix`, `docs`
- **Format Example:**
  ```
  feat: add support for custom themes in settings panel
  fix: correct SQL syntax error in query builder
  docs: update README with installation instructions
  chore: bump dependencies to latest versions
  ```
- **Average Length:** ~64 characters

### File Naming

- **Style:** camelCase
- **Example:**
  ```
  userProfile.vue
  databaseManager.rs
  queryBuilder.test.js
  ```

### Imports

- **Style:** Relative imports
- **Example (Vue):**
  ```js
  import userService from '../services/userService'
  ```
- **Example (Rust):**
  ```rust
  mod utils;
  use crate::database::connection;
  ```

### Exports

- **Style:** Named exports
- **Example (Vue):**
  ```js
  export function fetchData() { ... }
  export const API_URL = '...'
  ```
- **Example (Rust):**
  ```rust
  pub fn connect_db() { ... }
  pub struct QueryResult { ... }
  ```

## Workflows

### Release Version Bump and Tag

**Trigger:** When releasing a new version  
**Command:** `/release`

1. Ensure you are on the `dev` branch with a clean working tree.
2. Bump the version in all relevant files:
    - `package.json`
    - `src-tauri/Cargo.toml`
    - `src-tauri/Cargo.lock` (for the `antares2` entry)
    - `src-tauri/tauri.conf.json`
3. Generate a skeleton for release notes:  
   `docs/release-notes-vX.Y.Z.md` (if it doesn't exist)
4. Pause to fill in the prose section of the release notes.
5. Commit all version and release note changes:
    ```
    chore(release): bump version to vX.Y.Z and update release notes
    ```
6. Create an annotated git tag:
    ```
    git tag -a vX.Y.Z -m "Release vX.Y.Z"
    ```
7. Push the `dev` branch and the new tag to origin:
    ```
    git push origin dev --tags
    ```

### Release Workflow YML Update

**Trigger:** When updating or fixing the GitHub Actions release workflow  
**Command:** `/update-release-workflow`

1. Edit `.github/workflows/release.yml` to fix or enhance the release automation.
2. If the change affects the release process, document it in `CLAUDE.md`.
3. If hotfixed on another branch, merge changes back to `dev`.

### Updater Plugin Wiring and Documentation

**Trigger:** When enabling, disabling, or documenting the Tauri updater plugin  
**Command:** `/updater-plugin`

1. Edit `src-tauri/src/lib.rs` to register or comment out the updater plugin:
    ```rust
    // To enable:
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        // ...
    // To disable, comment out or remove the plugin registration
    ```
2. Update `src-tauri/capabilities/default.json` if permissions change.
3. Regenerate related schemas:
    ```
    # Example command (if applicable)
    npm run generate:schemas
    ```
4. Edit `.github/workflows/release.yml` if CI/CD needs to pass new environment variables.
5. Document activation or deactivation procedures in `CLAUDE.md`.

## Testing Patterns

- **Test File Pattern:** `*.test.*` (e.g., `queryBuilder.test.js`)
- **Testing Framework:** Not explicitly detected; check project documentation or test files for details.
- **Example Test File Name:**
  ```
  src/components/queryBuilder.test.js
  src-tauri/tests/databaseManager.test.rs
  ```

## Commands

| Command                   | Purpose                                                          |
|---------------------------|------------------------------------------------------------------|
| /release                  | Automate version bump, release notes, tagging, and push          |
| /update-release-workflow  | Update or fix the GitHub Actions release workflow                |
| /updater-plugin           | Wire up, disable, or document the Tauri updater plugin           |
```