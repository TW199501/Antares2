```markdown
# Antares2 Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill teaches you the core development patterns, coding conventions, and automated workflows used in the Antares2 codebase. Antares2 is a TypeScript project built with Vite, featuring a modular frontend (Vue), backend integration (Tauri), robust i18n, and a strong focus on documentation and test infrastructure. The repository emphasizes conventional commits, clear documentation, and repeatable workflows for releases, features, testing, and localization.

---

## Coding Conventions

### File Naming

- **PascalCase** is used for file names, especially for Vue components and TypeScript modules.
  - Example: `WorkspaceTabPropsTable.vue`, `UserProfile.ts`

### Imports

- **Relative imports** are preferred.
  - Example:
    ```ts
    import UserProfile from '../libs/UserProfile'
    ```

### Exports

- **Default exports** are used for modules and components.
  - Example:
    ```ts
    export default function useAuth() { ... }
    ```

### Commit Messages

- **Conventional commit** format is enforced.
  - Types: `test`, `fix`, `docs`, `feat`, `chore`, `refactor`
  - Example:
    ```
    feat: add user profile editing modal
    fix: correct i18n key for settings page
    ```

---

## Workflows

### Release Version Bump and Tag

**Trigger:** When preparing a new release version.  
**Command:** `/release-bump`

1. Bump version in all relevant files:
    - `package.json`
    - `src-tauri/Cargo.toml`
    - `src-tauri/Cargo.lock` (antares2 entry)
    - `src-tauri/tauri.conf.json`
2. Generate a release notes skeleton:  
   - `docs/release-notes-vX.Y.Z.md` (from git log)
3. Pause for author to fill in release notes prose.
4. Commit version bump and release notes.
5. Create annotated git tag `vX.Y.Z`.
6. Push `dev` branch and tag to origin.

**Example:**
```sh
pnpm run release-bump
# or use the /release-bump command in chatops
```

---

### Update Release Workflow or CI/CD

**Trigger:** When CI/CD or release automation needs to be fixed or improved.  
**Command:** `/update-workflow`

1. Edit workflow files:
    - `.github/workflows/release.yml`
    - `.github/workflows/codeql-analysis.yml`
2. Adjust permissions, checkout ref, or update action versions.
3. Document or reference the change in `CLAUDE.md` or `docs/`.
4. Test workflow by triggering a build or release.

---

### Feature Development with Plans and i18n

**Trigger:** When adding a new feature or significant UI change.  
**Command:** `/feature`

1. Implement or update feature files:
    - Vue components, composables, backend routes, etc.
2. Add or update plan/spec in `docs/superpowers/plans/` or `specs/`.
3. Add or update i18n keys in `en-US.json` and other locale files.
4. Run translation check to ensure all locales are in sync.
5. Document verification steps in commit message.

**Example:**
```ts
// web/renderer/composables/useNewFeature.ts
export default function useNewFeature() { ... }
```
```json
// web/renderer/i18n/en-US.json
{
  "newFeature.title": "New Feature"
}
```

---

### Props Table UI Iteration

**Trigger:** When refining the table properties UI based on feedback or new requirements.  
**Command:** `/props-table-ui`

1. Edit `WorkspaceTabPropsTable*.vue` components for new UI or behavior.
2. Add or update related modals/components.
3. Update or add i18n keys for new UI elements.
4. Document user feedback or plan in `docs/superpowers/plans/`.
5. Verify with lint/build/type-check and translation check.

---

### Test Infrastructure Rollout

**Trigger:** When introducing or expanding frontend test coverage.  
**Command:** `/add-tests`

1. Install or configure test runner (Vitest, happy-dom, etc).
2. Add global setup/mocks and test helpers.
3. Write sample or characterization tests for utilities and composables.
4. Update test scripts and `tsconfig` paths.
5. Verify with `pnpm test:unit:run`, lint, and type-check.

**Example:**
```ts
// web/common/libs/parseUser.test.ts
import { describe, it, expect } from 'vitest'
import parseUser from './parseUser'

describe('parseUser', () => {
  it('parses valid user data', () => {
    expect(parseUser({ name: 'Alice' })).toEqual({ name: 'Alice' })
  })
})
```

---

### i18n Surface Expansion

**Trigger:** When a feature or UI change introduces new user-facing text.  
**Command:** `/update-i18n`

1. Add new i18n keys to `en-US.json`.
2. Add corresponding translations to:
    - `zh-TW.json`
    - `zh-CN.json`
    - `ja-JP.json`
    - `ko-KR.json`
3. Run `translation:check` to verify 100% coverage.
4. Document translation conventions and verification.

---

### Plan or Spec Documentation

**Trigger:** When planning a significant architectural change, migration, or test rollout.  
**Command:** `/add-plan`

1. Write or update plan/spec `.md` files in `docs/superpowers/plans/` or `specs/`.
2. Reference or link the plan in related commits.
3. Update plan as phases progress or new knowledge is integrated.

---

## Testing Patterns

- **Framework:** [Vitest](https://vitest.dev/)
- **Test files:** Named with `.test.ts` suffix, located alongside or near the code under test.
- **Test structure:** Use `describe`, `it`, and `expect` for unit tests.
- **Setup:** Global setup and helpers in `tests/setup.ts` and `tests/helpers/`.

**Example:**
```ts
// web/renderer/composables/useAuth.test.ts
import { describe, it, expect } from 'vitest'
import useAuth from './useAuth'

describe('useAuth', () => {
  it('returns user info after login', async () => {
    const { login, user } = useAuth()
    await login('demo', 'password')
    expect(user.value).toBeDefined()
  })
})
```

---

## Commands

| Command            | Purpose                                                         |
|--------------------|-----------------------------------------------------------------|
| /release-bump      | Automate version bump, release notes, tagging, and push         |
| /update-workflow   | Update/fix CI/CD or release workflow files                      |
| /feature           | Start a new feature with plan/spec and i18n updates             |
| /props-table-ui    | Refine table properties UI and related i18n/docs                |
| /add-tests         | Add or expand test infrastructure and coverage                  |
| /update-i18n       | Add or update i18n keys and translations for all locales        |
| /add-plan          | Add or update plan/spec documentation for features or migrations|
```
