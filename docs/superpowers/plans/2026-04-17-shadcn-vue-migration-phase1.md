# shadcn-vue Migration — Phase 1 (Foundation + Pilot)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install Tailwind CSS v3 + shadcn-vue alongside the existing spectre.css UI, wire up the Antares brand theme as shadcn design tokens, add the core primitive components (Button, Dialog, Input, Label, Select, Checkbox, Switch, Separator), prove end-to-end viability by migrating **one** pilot modal (`ModalDiscardChanges.vue`) with zero visual regression of unmigrated screens, and land a written migration recipe for Phase 2+ to follow per component group.

**Architecture:** Strangler-fig coexistence. Tailwind runs with `preflight: false` so spectre's reset/base layer remains authoritative; shadcn-vue components are additive islands that use utility classes and CSS custom properties. Dark mode is triggered by Tailwind's `darkMode: ['class', '.theme-dark']` so the existing `#wrapper.theme-{light,dark}` class continues to work unchanged — no need to touch `App.vue` or the settings store. Brand token (`#e36929`) is mapped to the shadcn `--primary` HSL variable, so Button's default variant looks like "Antares orange" out of the box. MDI icons stay in place via `BaseIcon.vue`; shadcn Button/Dialog/etc. accept icons through slots rather than the React-style `data-icon` attribute.

**Tech Stack:** Vue 3.5 (Composition API, `<script setup>`), Vite 8, Tailwind CSS v3, shadcn-vue (new-york style), reka-ui (Radix Vue fork, shadcn-vue's underlying primitive library), class-variance-authority, tailwind-merge, clsx, pnpm.

---

## Background & Context

### Why this plan exists

A previous session attempted a UI revamp without writing a plan first and produced an unstable intermediate state. This plan does the opposite: small, verifiable slices, committed frequently, with an explicit stop point before attempting bulk migration.

### What "Phase 1" deliberately does NOT do

*   Migrate all 24 Modal\* components.
*   Migrate any Workspace\* component (there are 40+).
*   Migrate `BaseSelect`, `BaseContextMenu`, `BaseVirtualScroll`, `BaseTextEditor`, `BaseMap`, `BaseNotification`, `BaseLoader` — these are complex or third-party-wrapping and deserve their own plans.
*   Remove spectre.css from the build. Phase 1 ends with spectre and shadcn-vue running side-by-side.
*   Delete any existing CSS/SCSS. Phase 1 is additive.
*   Change the theme-switching UX or the settings store.
*   Migrate icons from MDI to Lucide. MDI stays.

### Decisions locked in before planning

| Decision | Choice | Why |
| --- | --- | --- |
| Tailwind version | **v3** (not v4) | v4 has no `preflight` disable knob as cleanly documented; coexistence with spectre is the priority, not being on the latest |
| shadcn-vue style | **new-york** | Tighter spacing + neutral borders fits a dense SQL client better than `default`'s rounded chrome |
| Component base | **reka-ui** (default for shadcn-vue) | No alternative for Vue; radix-vue was renamed to reka-ui |
| Preflight | **disabled** | Tailwind's reset breaks spectre's base styles; we only need utilities, not a reset |
| Tailwind prefix | **none** | shadcn-vue templates assume unprefixed utilities; adding a prefix means rewriting every copy-pasted component |
| Dark mode trigger | **class-based,** `**.theme-dark**` **alias** | Don't touch `App.vue`'s `theme-${applicationTheme}` logic |
| Brand color | `#e36929` stays as primary, mapped to `--primary` HSL | Preserves identity; only the _delivery mechanism_ changes (from SCSS `$primary-color` to CSS var consumed by Tailwind) |
| Icon library | MDI via existing `BaseIcon.vue` | 94 components use it; swapping would be a Phase 0 of its own |
| Migration unit | One component family per future plan (Modals, Workspace Explore, Workspace Tabs, etc.) | Big-bang failed once already |
| Pilot modal | `ModalDiscardChanges.vue` | Simplest modal (confirm/cancel only), zero business logic, exercises Dialog + Button |

### File map (Phase 1)

Files created:

*   `tailwind.config.ts` — Tailwind config with `preflight: false`, `darkMode: ['class', '.theme-dark']`, content globs.
*   `postcss.config.js` — PostCSS wiring (`tailwindcss` + `autoprefixer`).
*   `src/renderer/assets/tailwind.css` — `@tailwind base/components/utilities` directives + shadcn CSS variables (light + dark).
*   `src/renderer/lib/utils.ts` — `cn()` helper (clsx + tailwind-merge).
*   `components.json` — shadcn-vue CLI config.
*   `src/renderer/components/ui/button/Button.vue` + `index.ts` — shadcn Button.
*   `src/renderer/components/ui/dialog/Dialog.vue` + `DialogContent.vue` + `DialogHeader.vue` + `DialogTitle.vue` + `DialogDescription.vue` + `DialogFooter.vue` + `DialogClose.vue` + `index.ts` — shadcn Dialog family.
*   `src/renderer/components/ui/input/Input.vue` + `index.ts` — shadcn Input.
*   `src/renderer/components/ui/label/Label.vue` + `index.ts` — shadcn Label.
*   `src/renderer/components/ui/select/*` — shadcn Select family.
*   `src/renderer/components/ui/checkbox/Checkbox.vue` + `index.ts`.
*   `src/renderer/components/ui/switch/Switch.vue` + `index.ts`.
*   `src/renderer/components/ui/separator/Separator.vue` + `index.ts`.
*   `docs/superpowers/rules/shadcn-vue-migration-recipe.md` — per-component migration playbook (for Phase 2+).

Files modified:

*   `package.json` — new dev dependencies.
*   `vite.config.ts` — no change if Tailwind is PostCSS-driven (which it is on v3). Confirm only.
*   `src/renderer/index.ts` — import `assets/tailwind.css` **after** the existing SCSS import so Tailwind utilities win specificity ties.
*   `src/renderer/components/ModalDiscardChanges.vue` — rewrite against shadcn Dialog + Button.
*   `tsconfig.json` — add `~/*` and `@/*` paths if not already covered (spot-check only; `@/*` is already there).
*   `.gitignore` — no change needed (Tailwind has no generated artifacts committed).
*   `CLAUDE.md` — one-paragraph addition about the coexistence mode so future Claude sessions don't accidentally remove spectre or enable preflight.

### Verification strategy (not classic TDD)

Visual components don't unit-test naturally, and this project has zero Vue component tests. The verification stack per task is:

1.  `pnpm vue-tsc --noEmit` — catches type errors from new imports/generics.
2.  `pnpm lint` — catches stylelint/eslint violations (the `components/ui/` subtree may need an eslint override for Tailwind class strings).
3.  `pnpm tauri:dev` — manual inspection that the pilot modal opens, confirms, cancels, and keyboard-dismisses; and that **no other screen** visually changed (spot-check the Workspace explore bar, a query tab, and Settings).
4.  `pnpm test:e2e` — `tests/app.spec.ts` must still pass end-to-end. Any failure halts the task.

---

## Tasks

### Task 1: Install Tailwind CSS v3 + PostCSS toolchain

**Files:**

Modify: `package.json`

Create: `postcss.config.js`

Create: `tailwind.config.ts`

 **Step 1: Install dev deps**

```
pnpm add -D tailwindcss@^3.4 postcss@^8.4 autoprefixer@^10.4
```

Expected: `package.json` gains `tailwindcss`, `postcss`, `autoprefixer` under `devDependencies`. `pnpm-lock.yaml` updates. No runtime deps touched.

*   **Step 2: Create** `**postcss.config.js**`

```
module.exports = {
   plugins: {
      tailwindcss: {},
      autoprefixer: {}
   }
};
```

*   **Step 3: Create** `**tailwind.config.ts**`

```
import type { Config } from 'tailwindcss';

export default {
   darkMode: ['class', '.theme-dark'],
   content: [
      './index.html',
      './src/renderer/**/*.{vue,ts,tsx,js,jsx}'
   ],
   corePlugins: {
      preflight: false
   },
   theme: {
      container: {
         center: true,
         padding: '2rem',
         screens: { '2xl': '1400px' }
      },
      extend: {
         colors: {
            border: 'hsl(var(--border))',
            input: 'hsl(var(--input))',
            ring: 'hsl(var(--ring))',
            background: 'hsl(var(--background))',
            foreground: 'hsl(var(--foreground))',
            primary: {
               DEFAULT: 'hsl(var(--primary))',
               foreground: 'hsl(var(--primary-foreground))'
            },
            secondary: {
               DEFAULT: 'hsl(var(--secondary))',
               foreground: 'hsl(var(--secondary-foreground))'
            },
            destructive: {
               DEFAULT: 'hsl(var(--destructive))',
               foreground: 'hsl(var(--destructive-foreground))'
            },
            muted: {
               DEFAULT: 'hsl(var(--muted))',
               foreground: 'hsl(var(--muted-foreground))'
            },
            accent: {
               DEFAULT: 'hsl(var(--accent))',
               foreground: 'hsl(var(--accent-foreground))'
            },
            popover: {
               DEFAULT: 'hsl(var(--popover))',
               foreground: 'hsl(var(--popover-foreground))'
            },
            card: {
               DEFAULT: 'hsl(var(--card))',
               foreground: 'hsl(var(--card-foreground))'
            }
         },
         borderRadius: {
            lg: 'var(--radius)',
            md: 'calc(var(--radius) - 2px)',
            sm: 'calc(var(--radius) - 4px)'
         },
         keyframes: {
            'accordion-down': {
               from: { height: '0' },
               to: { height: 'var(--reka-accordion-content-height)' }
            },
            'accordion-up': {
               from: { height: 'var(--reka-accordion-content-height)' },
               to: { height: '0' }
            }
         },
         animation: {
            'accordion-down': 'accordion-down 0.2s ease-out',
            'accordion-up': 'accordion-up 0.2s ease-out'
         }
      }
   },
   plugins: [require('tailwindcss-animate')]
} satisfies Config;
```

Note: `darkMode: ['class', '.theme-dark']` tells Tailwind to treat `.theme-dark` (the existing class on `#wrapper`) as the dark selector. Components can use `dark:bg-background` and it will apply under `.theme-dark`.

*   **Step 4: Install** `**tailwindcss-animate**`

```
pnpm add -D tailwindcss-animate
```

*   **Step 5: Verify type-check still passes**

```
pnpm vue-tsc --noEmit
```

Expected: PASS (unchanged — no Vue/TS code has been modified yet).

*   **Step 6: Commit**

```
git add package.json pnpm-lock.yaml postcss.config.js tailwind.config.ts
git commit -m "chore(ui): install tailwind v3 + postcss for shadcn-vue coexistence"
```

---

### Task 2: Install shadcn-vue runtime dependencies

**Files:**

Modify: `package.json`

 **Step 1: Install shadcn runtime deps**

```
pnpm add class-variance-authority clsx tailwind-merge reka-ui
pnpm add -D @types/node
```

Expected: `class-variance-authority`, `clsx`, `tailwind-merge`, `reka-ui` appear under `dependencies`. `@types/node` is already present — pnpm will no-op or bump.

*   **Step 2: Verify pnpm install completes cleanly**

```
pnpm install
```

Expected: no peer-dep warnings for Vue 3.5. `reka-ui` supports Vue 3.3+.

*   **Step 3: Commit**

```
git add package.json pnpm-lock.yaml
git commit -m "chore(ui): add class-variance-authority, clsx, tailwind-merge, reka-ui"
```

---

### Task 3: Add Tailwind entry stylesheet with brand tokens

**Files:**

Create: `src/renderer/assets/tailwind.css`

Modify: `src/renderer/index.ts`

 **Step 1: Create** `**src/renderer/assets/tailwind.css**`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
   :root {
      --background: 0 0% 100%;
      --foreground: 0 0% 10%;

      --card: 0 0% 100%;
      --card-foreground: 0 0% 10%;

      --popover: 0 0% 100%;
      --popover-foreground: 0 0% 10%;

      /* Antares brand orange #e36929 → hsl(21 77% 53%) */
      --primary: 21 77% 53%;
      --primary-foreground: 0 0% 100%;

      --secondary: 0 0% 96%;
      --secondary-foreground: 0 0% 15%;

      --muted: 0 0% 96%;
      --muted-foreground: 0 0% 40%;

      --accent: 0 0% 95%;
      --accent-foreground: 0 0% 10%;

      --destructive: 4 74% 52%;          /* #de3b28 */
      --destructive-foreground: 0 0% 100%;

      --border: 0 0% 88%;
      --input: 0 0% 88%;
      --ring: 21 77% 53%;

      --radius: 0.3rem;
   }

   .theme-dark {
      --background: 0 0% 11%;           /* #1d1d1d */
      --foreground: 0 0% 98%;

      --card: 0 0% 15%;
      --card-foreground: 0 0% 98%;

      --popover: 0 0% 15%;
      --popover-foreground: 0 0% 98%;

      --primary: 21 77% 53%;
      --primary-foreground: 0 0% 100%;

      --secondary: 0 0% 18%;
      --secondary-foreground: 0 0% 95%;

      --muted: 0 0% 18%;
      --muted-foreground: 0 0% 65%;

      --accent: 0 0% 22%;
      --accent-foreground: 0 0% 98%;

      --destructive: 4 65% 48%;
      --destructive-foreground: 0 0% 100%;

      --border: 0 0% 25%;
      --input: 0 0% 25%;
      --ring: 21 77% 53%;
   }
}
```

Rationale for the HSL: `#e36929` (RGB 227/105/41) converts to approximately `hsl(21, 77%, 53%)`. Max channel R=227, Min B=41, so L ≈ (227+41)/2/255 ≈ 52.5%; S = 186/(510−268) ≈ 76.9%; H = 60·((G−B)/(max−min)) = 60·(64/186) ≈ 20.6°. The values in `--primary` / `--ring` round to that triple.

*   **Step 2: Import in** `**src/renderer/index.ts**`

Find the existing SCSS import. Add the Tailwind import **immediately after** so Tailwind utilities outrank spectre on equal-specificity ties:

```
import '@/scss/main.scss';
import '@/assets/tailwind.css';   // ← add this line
```

*   **Step 3: Run dev server and verify no regression**

```
pnpm tauri:dev
```

Expected:

*   App builds without PostCSS errors.
*   Existing UI looks identical (no fonts, colors, or spacing changed anywhere).
*   Opening DevTools and inspecting `<body>` shows CSS custom properties `--primary`, `--background` etc. on `:root`.
*   Switching theme toggles those vars under `.theme-dark`.

If spectre buttons/inputs look different, `preflight: false` didn't apply — stop and debug `tailwind.config.ts` before proceeding.

*   **Step 4: Commit**

```
git add src/renderer/assets/tailwind.css src/renderer/index.ts
git commit -m "feat(ui): add tailwind entry css with antares brand tokens"
```

---

### Task 4: Add `cn()` utility and `components.json`

**Files:**

Create: `src/renderer/lib/utils.ts`

Create: `components.json`

 **Step 1: Create** `**src/renderer/lib/utils.ts**`

```
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn (...inputs: ClassValue[]) {
   return twMerge(clsx(inputs));
}
```

*   **Step 2: Create** `**components.json**` (repo root)

```
{
  "$schema": "https://shadcn-vue.com/schema.json",
  "style": "new-york",
  "typescript": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/renderer/assets/tailwind.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "ui": "@/components/ui",
    "composables": "@/composables",
    "utils": "@/lib/utils",
    "lib": "@/lib"
  },
  "iconLibrary": "lucide"
}
```

Note: `iconLibrary: "lucide"` is what the CLI thinks — Antares actually uses MDI. The config value matters only for what the CLI auto-injects when you run `add`; we'll manually swap any Lucide import for MDI when that happens. No Lucide package is installed and none will be.

*   **Step 3: Verify type-check still passes**

```
pnpm vue-tsc --noEmit
```

Expected: PASS.

*   **Step 4: Commit**

```
git add src/renderer/lib/utils.ts components.json
git commit -m "feat(ui): add cn() util and shadcn-vue components.json"
```

---

### Task 5: Add Button primitive

**Files:**

Create: `src/renderer/components/ui/button/Button.vue`

Create: `src/renderer/components/ui/button/index.ts`

 **Step 1: Create** `**src/renderer/components/ui/button/Button.vue**`

```
<script setup lang="ts">
import { Primitive, type PrimitiveProps } from 'reka-ui';
import { computed, type HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';
import { buttonVariants, type ButtonVariants } from './variants';

interface Props extends PrimitiveProps {
   variant?: ButtonVariants['variant'];
   size?: ButtonVariants['size'];
   class?: HTMLAttributes['class'];
}

const props = withDefaults(defineProps<Props>(), {
   as: 'button'
});
</script>

<template>
   <Primitive
      :as="as"
      :as-child="asChild"
      :class="cn(buttonVariants({ variant, size }), props.class)"
   >
      <slot />
   </Primitive>
</template>
```

*   **Step 2: Create** `**src/renderer/components/ui/button/variants.ts**`

```
import { cva, type VariantProps } from 'class-variance-authority';

export const buttonVariants = cva(
   'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
   {
      variants: {
         variant: {
            default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
            destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
            outline: 'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
            secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
            ghost: 'hover:bg-accent hover:text-accent-foreground',
            link: 'text-primary underline-offset-4 hover:underline'
         },
         size: {
            default: 'h-9 px-4 py-2',
            sm: 'h-8 rounded-md px-3 text-xs',
            lg: 'h-10 rounded-md px-8',
            icon: 'h-9 w-9'
         }
      },
      defaultVariants: {
         variant: 'default',
         size: 'default'
      }
   }
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;
```

*   **Step 3: Create** `**src/renderer/components/ui/button/index.ts**`

```
export { default as Button } from './Button.vue';
export { buttonVariants, type ButtonVariants } from './variants';
```

*   **Step 4: Type-check**

```
pnpm vue-tsc --noEmit
```

Expected: PASS.

*   **Step 5: Commit**

```
git add src/renderer/components/ui/button
git commit -m "feat(ui): add shadcn-vue Button primitive"
```

---

### Task 6: Add Label + Input primitives

**Files:**

Create: `src/renderer/components/ui/label/Label.vue` + `index.ts`

Create: `src/renderer/components/ui/input/Input.vue` + `index.ts`

 **Step 1: Create** `**Label.vue**`

```
<script setup lang="ts">
import { Label, type LabelProps } from 'reka-ui';
import { computed, type HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = defineProps<LabelProps & { class?: HTMLAttributes['class'] }>();
</script>

<template>
   <Label
      v-bind="$attrs"
      :class="cn('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', props.class)"
   >
      <slot />
   </Label>
</template>
```

*   **Step 2: Create** `**src/renderer/components/ui/label/index.ts**`

```
export { default as Label } from './Label.vue';
```

*   **Step 3: Create** `**Input.vue**`

```
<script setup lang="ts">
import { useVModel } from '@vueuse/core';
import type { HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = defineProps<{
   defaultValue?: string | number;
   modelValue?: string | number;
   class?: HTMLAttributes['class'];
}>();

const emits = defineEmits<{
   (e: 'update:modelValue', payload: string | number): void;
}>();

const modelValue = useVModel(props, 'modelValue', emits, {
   passive: true,
   defaultValue: props.defaultValue
});
</script>

<template>
   <input
      v-model="modelValue"
      :class="cn('flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50', props.class)"
   >
</template>
```

*   **Step 4: Create** `**src/renderer/components/ui/input/index.ts**`

```
export { default as Input } from './Input.vue';
```

*   **Step 5: Type-check + commit**

```
pnpm vue-tsc --noEmit
git add src/renderer/components/ui/label src/renderer/components/ui/input
git commit -m "feat(ui): add shadcn-vue Label and Input primitives"
```

---

### Task 7: Add Dialog primitive family

**Files:**

Create: `src/renderer/components/ui/dialog/Dialog.vue`

Create: `src/renderer/components/ui/dialog/DialogTrigger.vue`

Create: `src/renderer/components/ui/dialog/DialogContent.vue`

Create: `src/renderer/components/ui/dialog/DialogHeader.vue`

Create: `src/renderer/components/ui/dialog/DialogFooter.vue`

Create: `src/renderer/components/ui/dialog/DialogTitle.vue`

Create: `src/renderer/components/ui/dialog/DialogDescription.vue`

Create: `src/renderer/components/ui/dialog/DialogClose.vue`

Create: `src/renderer/components/ui/dialog/index.ts`

 **Step 1: Create** `**Dialog.vue**` (root, re-exports reka `DialogRoot`)

```
<script setup lang="ts">
import { DialogRoot, type DialogRootEmits, type DialogRootProps } from 'reka-ui';
import { useForwardPropsEmits } from 'reka-ui';

const props = defineProps<DialogRootProps>();
const emits = defineEmits<DialogRootEmits>();
const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
   <DialogRoot v-bind="forwarded">
      <slot />
   </DialogRoot>
</template>
```

*   **Step 2: Create** `**DialogTrigger.vue**`

```
<script setup lang="ts">
import { DialogTrigger, type DialogTriggerProps } from 'reka-ui';

const props = defineProps<DialogTriggerProps>();
</script>

<template>
   <DialogTrigger v-bind="props">
      <slot />
   </DialogTrigger>
</template>
```

*   **Step 3: Create** `**DialogContent.vue**`

```
<script setup lang="ts">
import { X } from 'lucide-vue-next';
import {
   DialogClose,
   DialogContent,
   type DialogContentEmits,
   type DialogContentProps,
   DialogOverlay,
   DialogPortal,
   useForwardPropsEmits
} from 'reka-ui';
import { computed, type HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = defineProps<DialogContentProps & { class?: HTMLAttributes['class'] }>();
const emits = defineEmits<DialogContentEmits>();

const delegatedProps = computed(() => {
   const { class: _, ...rest } = props;
   return rest;
});

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
   <DialogPortal>
      <DialogOverlay
         class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
      />
      <DialogContent
         v-bind="forwarded"
         :class="cn('fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg', props.class)"
      >
         <slot />
         <DialogClose
            class="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
         >
            <X class="h-4 w-4" />
            <span class="sr-only">Close</span>
         </DialogClose>
      </DialogContent>
   </DialogPortal>
</template>
```

> **MDI swap note (MANDATORY):** The template above uses `lucide-vue-next` for the close icon, following shadcn-vue's upstream. Antares uses MDI. **Before committing**, replace the import and usage with `BaseIcon`:
> 
> ```
> <script setup lang="ts">
> import BaseIcon from '@/components/BaseIcon.vue';
> // ...remove: import { X } from 'lucide-vue-next';
> </script>
> 
> <template>
>   <!-- ...above DialogClose body... -->
>   <DialogClose class="...">
>      <BaseIcon icon-name="mdiClose" :size="16" />
>      <span class="sr-only">Close</span>
>   </DialogClose>
> </template>
> ```
> 
> `mdiClose` must exist in `@mdi/js` (it does). `BaseIcon`'s existing API is `icon-name` + `size`.

*   **Step 4: Create** `**DialogHeader.vue**`

```
<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = defineProps<{ class?: HTMLAttributes['class'] }>();
</script>

<template>
   <div :class="cn('flex flex-col gap-1.5 text-center sm:text-left', props.class)">
      <slot />
   </div>
</template>
```

*   **Step 5: Create** `**DialogFooter.vue**`

```
<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = defineProps<{ class?: HTMLAttributes['class'] }>();
</script>

<template>
   <div :class="cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-2', props.class)">
      <slot />
   </div>
</template>
```

*   **Step 6: Create** `**DialogTitle.vue**`

```
<script setup lang="ts">
import { DialogTitle, type DialogTitleProps, useForwardProps } from 'reka-ui';
import { computed, type HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = defineProps<DialogTitleProps & { class?: HTMLAttributes['class'] }>();
const delegatedProps = computed(() => {
   const { class: _, ...rest } = props;
   return rest;
});
const forwarded = useForwardProps(delegatedProps);
</script>

<template>
   <DialogTitle v-bind="forwarded" :class="cn('text-lg font-semibold leading-none tracking-tight', props.class)">
      <slot />
   </DialogTitle>
</template>
```

*   **Step 7: Create** `**DialogDescription.vue**`

```
<script setup lang="ts">
import { DialogDescription, type DialogDescriptionProps, useForwardProps } from 'reka-ui';
import { computed, type HTMLAttributes } from 'vue';

import { cn } from '@/lib/utils';

const props = defineProps<DialogDescriptionProps & { class?: HTMLAttributes['class'] }>();
const delegatedProps = computed(() => {
   const { class: _, ...rest } = props;
   return rest;
});
const forwarded = useForwardProps(delegatedProps);
</script>

<template>
   <DialogDescription v-bind="forwarded" :class="cn('text-sm text-muted-foreground', props.class)">
      <slot />
   </DialogDescription>
</template>
```

*   **Step 8: Create** `**DialogClose.vue**` (thin pass-through for use in footer)

```
<script setup lang="ts">
import { DialogClose, type DialogCloseProps } from 'reka-ui';

const props = defineProps<DialogCloseProps>();
</script>

<template>
   <DialogClose v-bind="props">
      <slot />
   </DialogClose>
</template>
```

*   **Step 9: Create** `**src/renderer/components/ui/dialog/index.ts**`

```
export { default as Dialog } from './Dialog.vue';
export { default as DialogClose } from './DialogClose.vue';
export { default as DialogContent } from './DialogContent.vue';
export { default as DialogDescription } from './DialogDescription.vue';
export { default as DialogFooter } from './DialogFooter.vue';
export { default as DialogHeader } from './DialogHeader.vue';
export { default as DialogTitle } from './DialogTitle.vue';
export { default as DialogTrigger } from './DialogTrigger.vue';
```

*   **Step 10: Type-check**

```
pnpm vue-tsc --noEmit
```

Expected: PASS. If errors reference `DialogContentProps` missing `class`, reka-ui version mismatch — check `pnpm why reka-ui`.

*   **Step 11: Commit**

```
git add src/renderer/components/ui/dialog
git commit -m "feat(ui): add shadcn-vue Dialog primitive family with MDI close icon"
```

---

### Task 8: Migrate pilot modal `ModalDiscardChanges.vue`

**Files:**

Read: `src/renderer/components/ModalDiscardChanges.vue` (baseline)

Modify: `src/renderer/components/ModalDiscardChanges.vue`

 **Step 1: Confirm the current public API**

The existing `ModalDiscardChanges.vue` (verified 2026-04-17):

*   **No props** (no `modelValue`, no `open`).
*   **Emits:** `confirm`, `close`.
*   **Rendered by parents using** `**v-if**` (conditional render pattern), not `:open`. Parent sets its own local flag to false on `@close`.
*   **i18n keys used:** `general.discard`, `general.stay`, `application.unsavedChanges`, `application.discardUnsavedChanges`.
*   **Header icon:** `mdiContentSaveAlert` at size 24.
*   **Wraps** `BaseConfirmModal` (spectre-based) today.

The pilot rewrite MUST keep these emits and not introduce new props, so every existing caller (`v-if="flag" @confirm="..." @close="flag = false"`) keeps working without edits.

*   **Step 2: Rewrite against shadcn-vue primitives**

Replace the entire file with:

```
<script setup lang="ts">
import { onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const { t } = useI18n();

const emit = defineEmits<{
   'confirm': [];
   'close': [];
}>();

function onOpenChange (open: boolean) {
   if (!open) emit('close');
}

function onConfirm () {
   emit('confirm');
   emit('close');
}

function onCancel () {
   emit('close');
}

// Preserve existing Escape handling so Escape always propagates a close
// even if reka-ui's built-in handler is prevented by a nested component.
const onKey = (e: KeyboardEvent) => {
   e.stopPropagation();
   if (e.key === 'Escape') emit('close');
};
window.addEventListener('keydown', onKey);
onBeforeUnmount(() => {
   window.removeEventListener('keydown', onKey);
});
</script>

<template>
   <Dialog :open="true" @update:open="onOpenChange">
      <DialogContent class="max-w-md">
         <DialogHeader>
            <DialogTitle class="flex items-center gap-2">
               <BaseIcon icon-name="mdiContentSaveAlert" :size="24" />
               {{ t('application.unsavedChanges') }}
            </DialogTitle>
            <DialogDescription>
               {{ t('application.discardUnsavedChanges') }}
            </DialogDescription>
         </DialogHeader>
         <DialogFooter>
            <Button variant="outline" @click="onCancel">
               {{ t('general.stay') }}
            </Button>
            <Button variant="destructive" @click="onConfirm">
               {{ t('general.discard') }}
            </Button>
         </DialogFooter>
      </DialogContent>
   </Dialog>
</template>
```

Key design notes:

`:open="true"` is hardcoded: the component is mounted only when the parent wants it shown (matching the existing `v-if` caller pattern), so it's always "open" from its own perspective. reka-ui's `update:open` fires when the user clicks outside or presses Esc — we forward that to `close`.

We emit `close` after `confirm` so parents don't need to also handle hiding in two places.

Manual keydown listener is kept for parity with the original: some callers rely on Escape closing even while another dialog may be absorbing key events.

 **Step 3: Verify required i18n keys already exist**

```
pnpm translation:check en-US
```

`general.discard`, `general.stay`, `application.unsavedChanges`, `application.discardUnsavedChanges` are all present in `src/renderer/i18n/en-US.json` today (confirmed 2026-04-17), so no i18n additions are needed for this migration. If `translation:check` reports any of them missing in `zh-TW`, `zh-CN`, `ja-JP`, or `ko-KR`, that is a pre-existing translation gap — track it separately, do not block this task.

*   **Step 4: Type-check**

```
pnpm vue-tsc --noEmit
```

Expected: PASS.

*   **Step 5: Lint**

```
pnpm lint
```

Expected: PASS or only pre-existing warnings.

*   **Step 6: Manual verify in dev server**

```
pnpm tauri:dev
```

Steps to verify:

1.  Open any workspace tab that triggers the "discard changes" modal (e.g. edit a table, then try to close the tab without saving).
2.  Modal opens with the new look (Tailwind spacing, Antares orange destructive button hue).
3.  Pressing `Esc` closes it (reka-ui handles this).
4.  Clicking the overlay closes it.
5.  `Cancel` emits the cancel path; `Discard` emits the confirm path — parent component behaves identically to before.
6.  Toggle dark/light theme — modal colors flip correctly via `.theme-dark` CSS variables.
7.  Spot-check **another** modal that was NOT migrated (e.g. `ModalAskCredentials`): it should look visually identical to before. If it changed, Tailwind preflight leaked — halt and debug.

*   **Step 7: Playwright e2e**

```
pnpm test:e2e
```

Expected: PASS. If the test suite asserts on any discard-modal DOM structure, update those selectors inside the test file; do not revert the component.

*   **Step 8: Commit**

```
git add src/renderer/components/ModalDiscardChanges.vue
git commit -m "refactor(ui): migrate ModalDiscardChanges to shadcn-vue Dialog"
```

---

### Task 9: Document the migration recipe

**Files:**

Create: `docs/superpowers/rules/shadcn-vue-migration-recipe.md`

 **Step 1: Write the recipe**

```
# shadcn-vue Migration Recipe

How to migrate one Antares component to shadcn-vue. Use this recipe for every component in Phase 2+.

## Prerequisites
- Phase 1 (foundation) is merged. `components/ui/` exists. Tailwind is wired. Brand tokens are in `tailwind.css`.
- The target component's public API is well-understood — read all its callers first.

## Steps

1. **Freeze the public API.** List every prop, emit, slot, and exposed method. The new implementation MUST keep these identical. If a caller needs to change, that is a separate PR.
2. **Map the spectre classes to Tailwind utilities** using the table in this recipe.
3. **Identify the reka-ui primitive.** If none exists (e.g. custom virtual scroll, Ace editor wrapper), this is not a shadcn-vue migration target — skip it.
4. **Check the shadcn-vue docs.** Run `pnpm dlx shadcn-vue@latest add <component>` **in a scratch directory, not the repo**, read the generated file, then hand-port it into `src/renderer/components/ui/<name>/`. Never let the CLI write into the repo — it assumes different aliases and will mangle imports.
5. **Swap icons.** Replace every `lucide-vue-next` import with `BaseIcon` + an `mdi*` icon name. Never install `lucide-vue-next`.
6. **Type-check + lint + e2e before commit.** These three gates catch 90% of regressions.
7. **Keep spectre imports.** Do NOT remove the `@import "~spectre.css/..."` lines in `main.scss` during Phase 2. They are removed only after every component is migrated.

## Spectre → Tailwind token cheat sheet

| Spectre class | Tailwind replacement |
|---|---|
| `.btn` | `<Button>` (shadcn-vue) |
| `.btn-primary` | `<Button variant="default">` |
| `.btn-link` | `<Button variant="link">` |
| `.btn-sm` | `<Button size="sm">` |
| `.form-input` | `<Input>` (shadcn-vue) |
| `.form-select` | `<Select>` family (Phase 2 — reka Select is nontrivial) |
| `.form-label` | `<Label>` |
| `.modal.active` | `<Dialog :open>` |
| `.tab` / `.tab-item` | `<Tabs>` family (install in Phase 2) |
| `.menu` | `<DropdownMenu>` (Phase 2) |
| `.divider` | `<Separator>` |
| `.empty` | `<Empty>` equivalent — roll your own or adapt |
| `.tile` | custom, no shadcn equivalent; use Card + manual layout |

## When in doubt

Run `pnpm dlx shadcn-vue@latest add <name>` in `/tmp/scratch` (or `C:\temp\scratch` on Windows), read the output, port it manually. Never guess the Vue-specific API.
```

*   **Step 2: Commit**

```
git add docs/superpowers/rules/shadcn-vue-migration-recipe.md
git commit -m "docs(ui): add shadcn-vue migration recipe"
```

---

### Task 10: Update `CLAUDE.md` with coexistence note

**Files:**

Modify: `CLAUDE.md`

 **Step 1: Add a new section after** `**### Customizations pattern**`

Append:

```
### UI stack: shadcn-vue + spectre coexistence

As of Phase 1 of the shadcn-vue migration, the renderer has **two** UI systems running side-by-side:

- **Legacy**: `spectre.css 0.5.9` via `src/renderer/scss/main.scss`. Class-based (`.btn`, `.form-input`, `.modal`). All unmigrated components use this.
- **New**: Tailwind CSS v3 + shadcn-vue primitives in `src/renderer/components/ui/`. Uses CSS custom properties defined in `src/renderer/assets/tailwind.css`. Utility-class driven.

**Invariants until migration is complete:**

- Tailwind's `preflight` is **disabled** in `tailwind.config.ts`. Re-enabling it will break every spectre-based screen. Don't touch.
- The dark-mode selector is `darkMode: ['class', '.theme-dark']`. The existing `theme-${applicationTheme}` class on `#wrapper` (`App.vue`) drives both systems — don't rename.
- Never install `lucide-vue-next`. shadcn-vue's default close/chevron icons must be swapped to `BaseIcon` + `mdi*` names. See [docs/superpowers/rules/shadcn-vue-migration-recipe.md](docs/superpowers/rules/shadcn-vue-migration-recipe.md).
- Never let the shadcn-vue CLI write into the repo (`pnpm dlx shadcn-vue@latest add ...`). Run it in a scratch directory and hand-port, because the CLI assumes aliases/icon libs that don't match this project.
- When migrating a component, keep its **public API (props/emits/slots) identical** so callers don't need to change in the same PR.
```

*   **Step 2: Commit**

```
git add CLAUDE.md
git commit -m "docs(ui): document shadcn-vue + spectre coexistence invariants"
```

---

## Tasks deferred to Phase 2+

The following are explicitly OUT of Phase 1 scope. Each will be its own plan, written after Phase 1 ships and the pattern is proven:

| Future plan | Scope |
| --- | --- |
| Phase 2a: Select + Combobox | Migrate `BaseSelect.vue` (complex custom) → reka-ui `Select` + `Combobox`. Largest single component migration. |
| Phase 2b: ContextMenu | `BaseContextMenu.vue` → reka-ui `ContextMenu`. Used across explore bars and tabs. |
| Phase 3: Simple modals | `ModalAskCredentials`, `ModalAskParameters`, `ModalNewSchema`, `ModalEditSchema`, `ModalNoteNew`, `ModalNoteEdit` — apply the pilot pattern in bulk. |
| Phase 4: Complex modals | `ModalSettings*` (has tabs, nested panels), `ModalExportSchema`, `ModalImportSchema`, `ModalConnectionAppearance`, `ModalHistory`, `ModalProcessesList*`, `ModalFakerRows`, `ModalFolderAppearance`, `ModalAllConnections`. |
| Phase 5: Workspace Explore Bar | `WorkspaceExploreBar*` family + context menus. |
| Phase 6: Workspace Tabs — Props | `WorkspaceTabProps*` family (table editor, function editor, trigger editor, etc.). |
| Phase 7: Workspace Tabs — New | `WorkspaceTabNew*` family. |
| Phase 8: Query workspace | `WorkspaceTabQuery*`, includes result grid. Highest visual density, highest risk. |
| Phase 9: Layout chrome | `TheTitleBar`, `TheSettingBar`, `TheFooter`, `TheNotificationsBoard`. |
| Phase 10: Teardown | Remove spectre.css, remove `preflight: false`, flip dark mode selector back to plain `.dark` if desired, delete legacy SCSS overrides. Full visual QA pass + Playwright expansion. |

---

## Self-review

### Spec coverage

*   ✅ Install Tailwind + PostCSS → Task 1
*   ✅ Install shadcn-vue runtime deps → Task 2
*   ✅ Tailwind entry CSS + brand tokens → Task 3
*   ✅ `cn()` + `components.json` → Task 4
*   ✅ Button primitive → Task 5
*   ✅ Label + Input primitives → Task 6
*   ✅ Dialog primitive family → Task 7
*   ✅ Pilot modal migration → Task 8
*   ✅ Migration recipe documented → Task 9
*   ✅ CLAUDE.md coexistence note → Task 10

### Placeholder scan

*   No "TBD", "implement later", "add error handling", "similar to Task N" — all code blocks are complete.
*   Icon swap in Task 7 includes the exact before/after snippet.
*   Pilot rewrite in Task 8 provides full file content, with an explicit fallback instruction if the original API differs.

### Type consistency

*   `cn()` signature appears identically in Tasks 4 and the templates consuming it (Task 5, 6, 7).
*   `buttonVariants` / `ButtonVariants` type names match between `variants.ts` and `Button.vue`.
*   Dialog emits/props use reka-ui's type re-exports consistently — no drift.
*   `BaseIcon` prop names (`icon-name`, `:size`) match actual usage in `BaseUploadInput.vue` (verified).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-17-shadcn-vue-migration-phase1.md`. Two execution options:

**Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration. Best for a foundation-level change like this where one slip (e.g. forgetting `preflight: false`) can break every screen.

**Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?

---

# Phase 1 Addendum (2026-04-17): Pilot pivot + primitive expansion

## Why this addendum exists

After the initial plan was written, the designer's `.pen` file (`E:\source\antares2\pencil-new.pen`) was opened. It already contains:

- A completed Antares2 Design System frame (51 reusable components).
- Three Connection Modal screens (常規 / SSL / SSH 通道 tabs) showing the target pilot UI.
- A full variable set: HSL tokens, font stacks, spacing / radius / font-size scales.

Three facts forced a pivot:

1. **The brand primary is `#FF5000`**, not `#E36929`. The token commit (`58ec1a7`) replaces the wrong HSL values across `tailwind.css` and adds `primary-tint`, `info/success/warning` pairs, a 4-step radius scale, and Antares-specific font stacks.
2. **The pilot should be the Connection Modal**, not `ModalDiscardChanges`. The designer drew the Connection Modal in detail (中文 labels, 3 tabs, 8 form fields, 3 checkboxes, 2 footer buttons), so that is the screen the migration has to prove.
3. **The Connection Modal needs more primitives than originally planned** — Tabs, Select, Checkbox, and a FormField composite. Task 7's Dialog alone is not enough.

## New tasks

### Task 5b: Tighten Button + Input to match `.pen` density

**Files:**
- Modify: `src/renderer/components/ui/button/variants.ts`
- Modify: `src/renderer/components/ui/input/Input.vue`

**Why:** The `.pen` Button has no drop shadow; mine did. The `.pen` Input has a `bg-secondary` grey fill rather than transparent; mine was transparent. Connection Modal stacks 8 inputs vertically — the fill difference is the biggest visual tell.

**Changes:**
- Remove `shadow` from Button's `default` variant and `shadow-sm` from `destructive` / `outline` / `secondary`. Leaves Button flat and matches the `.pen` aesthetic.
- Remove `shadow-sm` from Input. Change Input's `bg-transparent` to `bg-secondary`.

### Task 6b: Tabs primitive family

**Files:** `src/renderer/components/ui/tabs/{Tabs,TabsList,TabsTrigger,TabsContent,index.ts}.vue`

**Why:** Connection Modal uses 3 tabs (常規 / SSL / SSH 通道). The `.pen` tab list is a `h-44px` pill-bg container with 4px padding; the active trigger gets the `bg-background` indicator; inactive triggers are transparent text.

**Key values from `.pen`:**
- `Tabs / List` (`oVuQd`): `cornerRadius: 6, fill: #F4F4F5 (secondary), padding: 4, height: 44, alignItems: center`
- `Tabs / Trigger Active` (`gEmhD`) + `Tabs / Trigger Inactive` (`HkZRk`) — to be read during implementation

**Target Tailwind classes:**
- TabsList: `inline-flex h-11 items-center justify-center rounded-md bg-secondary p-1 text-muted-foreground`
- TabsTrigger: `inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground`

Implement via `reka-ui`'s `TabsRoot / TabsList / TabsTrigger / TabsContent`.

### Task 6c: Select primitive family

**Files:** `src/renderer/components/ui/select/{Select,SelectContent,SelectItem,SelectTrigger,SelectValue,index.ts}.vue`

**Why:** Connection Modal has "資料庫類型" dropdown (MySQL / PostgreSQL / SQLite / etc.). `Select (closed)` component exists in `.pen` — match it.

Implement via `reka-ui`'s `SelectRoot / SelectTrigger / SelectContent / SelectItem / SelectValue / SelectPortal`.

### Task 6d: Checkbox primitive

**Files:** `src/renderer/components/ui/checkbox/{Checkbox.vue,index.ts}`

**Why:** Connection Modal has 3 checkboxes (唯讀模式 / 詢問憑據 / 單一連線) in a horizontal row. `.pen` has `Checkbox / Unchecked` + `Checkbox / Checked` variants.

Implement via `reka-ui`'s `CheckboxRoot` + `CheckboxIndicator` + MDI `mdiCheck` icon (NOT `lucide`).

### Task 6e: FormField composite

**Files:** `src/renderer/components/ui/form-field/{FormField.vue,index.ts}`

**Why:** Connection Modal repeats `<label>{content}<input/>` vertically for every field. Encapsulating as `<FormField label="連線名稱" ... />` avoids 8× repetition and matches `.pen`'s FormField reusable component.

**Structure:**
```vue
<template>
   <div class="flex flex-col gap-1.5">
      <Label :for="id">{{ label }}</Label>
      <slot :id="id" />
      <p v-if="error" class="text-xs text-destructive">{{ error }}</p>
   </div>
</template>
```

Default slot receives the input/select/etc. Scoped slot exposes `id` so the control can bind `for`/`id` pairing.

### Task 8 (pivoted): Connection Modal pilot

**Replaces the original Task 8 (`ModalDiscardChanges`) — that modal now migrates in Phase 2 as part of the simple-modals batch.**

**Files:**
- Modify: `src/renderer/components/ModalConnectionAppearance.vue` — NO, that's a different modal
- Likely create: `src/renderer/components/WorkspaceAddConnectionPanel.vue` refactor — TBD during execution after reading the real Antares flow
- Reference: the actual Antares file currently rendering "New Connection" UI — to be located during Task 8 reconnaissance

**Pilot success criteria:**
- Visually matches `.pen` Screen 1 (`qoGrg`): 3 tabs, 8 form fields, 3 horizontal checkboxes, footer with "測試連線" left + "保存" right.
- Keeps the existing caller's public API (props/emits).
- Playwright e2e suite still passes.

## Updated task order

| Order | Task |
|-------|------|
| ✅ 1–5 | Foundation (Tailwind, deps, tokens, cn, Button) |
| ✅ (interstitial) | Token realignment to `.pen` primary `#FF5000` + zinc palette + radius scale + font stacks |
| ✅ 6 | Label + Input primitives (committed, to be tightened in 5b) |
| 🆕 5b | Tighten Button (no shadow) + Input (`bg-secondary`) |
| 🆕 6b | Tabs primitive family |
| 🆕 6c | Select primitive family |
| 🆕 6d | Checkbox primitive |
| 🆕 6e | FormField composite |
| 7 | Dialog primitive family |
| 🔁 8 | **Connection Modal** pilot (was: `ModalDiscardChanges`) |
| 9 | Migration recipe doc |
| 10 | CLAUDE.md coexistence note |

## Visual QA checkpoint

After Task 6e (all primitives in place, before Dialog + pilot), spin up `pnpm tauri:dev` and render a temporary `UiPlayground.vue` showing Button × all variants+sizes, Input, Label, Tabs, Select, Checkbox, FormField. The user verifies visual density / color / font / dark-mode behavior. Any deltas get fixed before Task 7 starts.
