# shadcn-vue Migration Recipe

How to migrate one Antares component from spectre.css to shadcn-vue. Use this recipe for every component in Phase 2+.

## Prerequisites

- Phase 1 foundation is merged (`src/renderer/components/ui/` tree + `src/renderer/assets/tailwind.css` + `tailwind.config.ts`).
- The target component's public API is well-understood — read all its callers first.

## Steps

1. **Freeze the public API.** List every prop, emit, slot, and exposed method. The new implementation MUST keep these identical. If a caller needs to change, that is a separate PR.
2. **Map the spectre classes to shadcn-vue primitives** using the table below.
3. **Identify the reka-ui primitive.** If none exists (e.g. custom virtual scroll, Ace editor wrapper, `BaseMap`), this is not a shadcn-vue migration target — skip it.
4. **Check shadcn-vue docs.** Run `pnpm dlx shadcn-vue@latest add <component>` **in a scratch directory, not the repo**, read the generated file, then hand-port it into `src/renderer/components/ui/<name>/`. Never let the CLI write into the repo — it assumes different aliases and will mangle imports.
5. **Swap icons.** Replace every `lucide-vue-next` import with `BaseIcon` + an `mdi*` icon name. Never install `lucide-vue-next`.
6. **Run `pnpm lint` before commit.** ESLint + Stylelint exit 0 is the gate.
7. **Keep spectre imports.** Do NOT remove the `@import "~spectre.css/..."` lines in `main.scss` during Phase 2. They are removed only after every component is migrated.
8. **Run the caller audit.** `grep -rn "<ComponentName>" src/renderer/components/` to find all callers. Verify each only uses the documented public API. If any caller uses an undocumented property, either preserve it in the new implementation or flag it for a separate fix.

## Spectre → shadcn-vue primitive cheat sheet

| Spectre / existing class | shadcn-vue primitive |
|---|---|
| `.btn` | `<Button>` |
| `.btn-primary` | `<Button variant="default">` |
| `.btn-link` | `<Button variant="link">` |
| `.btn-sm` | `<Button size="sm">` |
| `.form-input` | `<Input>` |
| `.form-select` (custom `BaseSelect`) | `<Select>` family (Phase 2 — `BaseSelect` is complex, needs own plan) |
| `.form-label` | `<Label>` |
| form field group (label + input + error) | `<FormField>` composite |
| `.form-checkbox` | `<Checkbox>` |
| `.modal.active` | `<Dialog :open>` + `<DialogContent>` |
| `.tab` / `.tab-item` | `<Tabs>` family |
| `.menu` | `<DropdownMenu>` (Phase 2 — not yet built) |
| `.divider` | `<Separator>` (Phase 2 — not yet built) |
| `.empty` | custom — no shadcn equivalent in Phase 1 |
| `.tile` | custom — use Card + manual layout |

## Icon mapping (lucide → MDI)

The shadcn-vue upstream uses `lucide-vue-next`; Antares uses `@mdi/js` via `BaseIcon`. Swap every icon at implementation time:

| lucide name | MDI name |
|---|---|
| `X` | `mdiClose` |
| `Check` | `mdiCheck` |
| `ChevronDown` | `mdiChevronDown` |
| `ChevronRight` | `mdiChevronRight` |
| `ChevronsUpDown` | `mdiUnfoldMoreHorizontal` |
| `Search` | `mdiMagnify` |

Usage pattern in Vue:

```vue
<script setup lang="ts">
import BaseIcon from '@/components/BaseIcon.vue';
</script>

<template>
   <BaseIcon icon-name="mdiClose" :size="16" />
</template>
```

## Anti-patterns

- **Don't auto-run the shadcn-vue CLI in the repo.** It rewrites alias paths wrong. Generate in scratch and hand-port.
- **Don't install `lucide-vue-next`.** Swap to MDI during port.
- **Don't change a component's public API during migration.** That's a caller-coupled refactor, not a UI swap.
- **Don't remove `BaseConfirmModal`'s `useFocusTrap` binding** — keep the `trapRef` pattern.
- **Don't enable Tailwind `preflight`.** It will break every spectre-styled screen.
- **Don't rename the `.theme-dark` class** on `#wrapper`. Tailwind's `darkMode: ['class', '.theme-dark']` is tied to this.

## When in doubt

Run `pnpm dlx shadcn-vue@latest add <name>` in `/tmp/scratch` (or `C:\temp\scratch` on Windows), read the output, port it manually. Never guess the Vue-specific API.
