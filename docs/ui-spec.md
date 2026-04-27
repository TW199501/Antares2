# antares2 UI Spec

> **Read this before any UI padding / height / font-size / color decision.** This exists because the project has two UI systems coexisting (spectre.css legacy + Tailwind v4 + shadcn-vue) and ad-hoc values drift badly without a single reference.

## Sources of truth (ranked)

1.  `**pencil-new.pen**` — the Pencil design file at repo root. Definitive for **layouts, screens, interaction patterns**. Access requires Pencil desktop app open + `pencil` MCP server (CLAUDE / future AI sessions: ask user to open the file if MCP times out). Do NOT read it with `Read` / `Grep` — it's encrypted.
2.  `**src/renderer/assets/tailwind.css**` — the `@theme inline { … }` block is the authoritative color / radius token source, always readable, always in sync with runtime.
3.  **This file (**`**docs/ui-spec.md**`**)** — component-level conventions and cross-cutting rules distilled from session decisions, so future edits are consistent without reopening every past thread.

When they conflict: `pencil-new.pen` > `tailwind.css` > `ui-spec.md`. If you change this file, update memory `pencil_design_spec.md` too.

## Design tokens (summary — authoritative source is `tailwind.css`)

| Token | Light | Dark | Used for |
| --- | --- | --- | --- |
| `--primary` | `#ff5000` | `#ff5000` | Brand orange. Active tabs, CTA buttons, footer bg, tag backgrounds |
| `--primary-foreground` | `#ffffff` | `#ffffff` | Text / icon on primary surfaces |
| `--background` | `#ffffff` | `#08091a` | App body |
| `--foreground` | `#0f0f1a` | `#f5f5fa` | Body text |
| `--muted` | `#f4f4f7` | translucent | Neutral backdrops (TabsList, input wrappers) |
| `--muted-foreground` | `#6e6e80` | similar | Secondary text (hints, placeholders) |
| `--accent` | `#f0e9ff` | navy glass | Hover highlight |
| `--border` | `#e6e3ef` | subtle | All dividers and input borders |
| `--card` | `#ffffff` | `rgba(255 255 255 / 0.04)` | Card / modal bodies (note: dark is intentionally translucent — navy glass) |

> Dark-mode tokens follow shadcn-vue convention with one deliberate deviation: `--card` is translucent in dark mode to implement the "navy glass" design from `untitled1`. This is documented in `CLAUDE.md`.

### Radius scale

*   `--radius-sm: 4px` — chips, pills, footer pager buttons
*   `--radius-md: 6px` — form inputs, small buttons
*   `--radius-lg: 8px` — cards, dialogs (default)
*   `--radius-xl: 12px` — feature cards, hero panels

## Component heights

All measured with `!` modifier on Tailwind utilities because spectre's nested selectors outweigh single-class Tailwind (see "Tailwind vs SCSS" below).

| Context | Height | Example |
| --- | --- | --- |
| App footer | **30px** (`$footer-height` SCSS var) | `TheFooter.vue` — don't change without touching all absolute-positioning downstream |
| Table view toolbar row | **39px** | `WorkspaceTabTable.vue` `.workspace-query-runner-footer !h-[39px] !py-[3px]` |
| TabsList (outer) | **32px** | `h-[32px] gap-0 p-[2px]` wrapper |
| TabsTrigger (inner tab) | **28px** | `h-[28px]` — note: outer TabsList has 2px padding each side, so 32 = 28 + 2+2 |
| Standard action Button (shadcn) | **32px** | `h-[32px] px-[10px]` for Insert row / Filter / nav buttons |
| Dense Button in toolbar | **28px** | When the button group is inside a 32px wrapper |
| Footer pager chip | **24px** | `TheFooter.vue .footer-pager-btn` — fits inside 30px footer with 3px top/bottom |
| Search input (explore bar) | **22px** | `WorkspaceExploreBar.vue` — smaller than toolbar because sidebar is dense |

## Font sizes

`html { font-size: 20px }` is set by **spectre.css** (not 16px default). Every Tailwind `rem`\-based size is scaled ×1.25: `text-xs` → 15px (not 12px), `text-sm` → 17.5px, `text-base` → 20px. **Always use arbitrary values with literal** `**px**` when a migrated component needs to visually align with unmigrated siblings.

| Context | Size | Tailwind |
| --- | --- | --- |
| Toolbar action row (Tabs, buttons, nav) | **14px** | `!text-[14px]` |
| Footer / dense info areas | **12px** | `text-[12px]` |
| Explore-bar inputs (typed text) | **11px** | `text-[11px]` |
| Explore-bar input placeholder | **12px** | `placeholder:text-[12px]` (bigger than typed so hint reads easier) |
| Empty-state inline hint | **12px** | `text-[12px] text-muted-foreground` |
| Table column headers | default 14px (inherited) | avoid overriding unless a comment-mode needs variation |

**Why** `**!**` **matters:** Reka UI / shadcn primitives in `components/ui/` bake in `text-sm` via `cn()`. `tailwind-merge` is supposed to dedupe and keep the last-declared arbitrary value, but in practice Reka's own internal class strings win. Always use `!text-[14px]` etc. at the call site when overriding primitives.

## Color & surface patterns

### Reverse-video rule (footer + primary surfaces)

When a container surface is `**--primary**` (orange footer, active tab pill), children that need to pop use the inverse:

*   Container: `bg-primary text-primary-foreground`
*   Child chip / button: `bg-[var(--primary-foreground)] text-[var(--primary-color)]` (i.e. white bg + orange text)

This mirrors the sidebar "schema tag" pattern the user referenced. Do NOT use black-tint or gray-tint chips on primary surfaces — they read muddy against orange.

### Tag / chip spec

*   Background: solid `#fff` or solid `--primary` depending on surface (see reverse-video)
*   Text: 12px / weight 500
*   Padding: `0 8px` horizontal, inner vertical derived from height
*   Radius: 4px (`rounded-sm`)
*   No border for solid chips; `border-white/40` only for frost-glass variants (rare)

### Feedback states

*   Disabled: `opacity: 0.5` (not 0.35 — too faint)
*   Hover on white chip: background `#fff8f3` (subtle orange tint)
*   Hover on primary button: rely on shadcn Button's built-in hover state, don't override
*   Focus visible: use the default `ring-1 ring-ring/40` from shadcn primitives

## Spacing / layout rules

*   Gap between sibling controls in a toolbar: `gap-1` (4px) or `gap-1.5` (6px)
*   Gap between panel sections (vertical): `gap-3` (12px) or `gap-4` (16px)
*   Never use SCSS `rem` values for new work — always Tailwind arbitrary `[Npx]` because spectre's 20px root breaks intuition
*   Dividers between toolbar info items: `divide-x divide-border [&>*]:px-[10px] [&>*:first-child]:pl-0 [&>*:last-child]:pr-0`

## Tailwind vs SCSS boundary

*   **Default**: all new UI adjustments go on the element's `class` attribute with Tailwind utilities. Do NOT edit `src/renderer/scss/main.scss` for size/color/spacing tweaks. Reason: the whole app is strangler-fig-migrating away from spectre; every new SCSS rule is tech debt.
*   **Exception**: `<style>` blocks inside SFCs are fine for component-local styling that can't be expressed as utilities (keyframe animations, `::-webkit-scrollbar` shims, pseudo-element chrome like `details > summary` markers).
*   **Escape hatch**: if a spectre nested selector has `(0, 3, 0)` specificity (e.g. `.workspace-tabs .workspace-query-runner .foo`), write the Tailwind utility with `!` prefix to force override. Example: `!h-[39px] !py-[3px]`.
*   **Never**: don't reach for `:deep()`, don't add `!important` in SCSS, don't paste styles into shadcn primitive files under `components/ui/` — customize at the call site.

## State persistence

UI state the user expects to survive an app restart goes through:

1.  Pinia setting store with camelCase field (`tableQueryAreaHeight`)
2.  `persistSettings()` method serializes to snake\_case (`table_query_area_height`)
3.  Stored via the Tauri FS plugin at `%APPDATA%/com.tw199501.antares2/settings.json`

Pattern is established in `src/renderer/stores/settings.ts` — follow it, don't invent a new persistence layer.

## Component-by-component notes (session-derived)

### WorkspaceTabTable (current)

*   Toolbar row: 39px height, 14px text, `!` modifiers to win specificity
*   Left group: Tabs (data/props) + A/中 comment toggle + Insert row (data mode only)
*   Right info bar: 0.01s / results count / total / schema — `divide-x` separators
*   Pagination + Export: **moved to TheFooter center block as of commit** `**f4b0523**` — do NOT re-add to the toolbar
*   Data area: `<BaseSplitV>` reserving 300px top pane for a future custom query UI (`WorkspaceTabTableQueryArea.vue` is the placeholder)
*   Filter toggle is removed (`WorkspaceTabTableFilters.vue` stays on disk but unimported); `isSearch` ref is retained for keyboard shortcut compatibility

### TheFooter

*   30px orange band, position fixed bottom
*   Three zones: `footer-left-elements` (version, readonly, SSL, SSH), `footer-center-elements` (active table pager — only shown when `tablePagerStore.activePager !== null`), `footer-right-elements` (console, bug report, about)
*   Center is absolutely positioned (not `flex: 1`) so it doesn't get squeezed when left/right expand
*   Pager chips use reverse-video: white bg, `var(--primary-color)` text. The primary color follows any folder-level accent override.

### WorkspaceExploreBar

*   32px tall search + column-search row inside collapsible tree
*   Inputs: 22px tall, 11px typed text, 12px placeholder (bigger for legibility)

### Embedded SpecSnap Inspector

*   Shell pattern wrapping `@tw199501/specsnap-inspector-vue` published wrapper, documented in `CLAUDE.md`'s "Embedded SpecSnap Inspector" subsection

## Phase 2 primitive coverage

Batch 0 (commit `<TBD>`) adds twelve new shadcn-vue primitives under `src/renderer/components/ui/` to back the rest of the Phase 2 migration. Below is the **contract** for which primitive a given UI surface should reach for. **Anything not in the table** must default to one of the existing primitives (Button / Checkbox / Dialog / DropdownMenu / FormField / Input / Label / Select / Tabs) or be raised in review.

| Primitive | Use for | Do **not** use for |
| --- | --- | --- |
| `Switch` | Settings boolean toggle, connection enabled/disabled, single on/off knob in a form row | Multi-select binary fields (use `Checkbox`) |
| `Textarea` | DDL view, SQL body, note content, anything multi-line user input | Single-line input (use `Input`) |
| `Tooltip` | Icon-only button labels, ellipsised text hover hint, table-header description | Critical action explanation (write it into the visible button label) |
| `Sonner` (toast) | Async result notifications (saved / failed / connected), non-blocking feedback | Confirmations that need a user response (use `BaseConfirmModal`) |
| `ContextMenu` | Sidebar connection right-click, explore tree table/column right-click, scratchpad note right-click | Standard click-to-open menu (use `DropdownMenu`) |
| `ScrollArea` | Bounded-height connection list, explore tree, long settings panel | Main viewport scroll (use the browser native scrollbar) |
| `Separator` | Visual break between grouped form sections, vertical divider in toolbars | Replacement for spacing (use `gap-*` / `space-*`) |
| `Badge` | Connection status chip, column-type tag, version label, schema tag | Primary call-to-action (use `Button`) |
| `Card` | Settings group panel, connection card, empty-state container, dashboard tile | Whole-modal shell (use `Dialog`) |
| `Popover` | Color picker, inline detail flyout, lightweight extra controls | Confirmation prompts (use `Dialog` or `BaseConfirmModal`) |
| `RadioGroup` | Mutually-exclusive choice with 2–5 options visible inline | 6+ options (use `Select`) |
| `Accordion` | Sidebar object-type groups (Tables / Views / Triggers), settings sub-sections | Tab switching (use `Tabs`) |

### Status-color tokens (Batch 0)

`tailwind.css` now exposes the following Tailwind utilities backed by CSS variables:

*   `bg-success` / `text-success-foreground` — successful save / connection
*   `bg-warning` / `text-warning-foreground` — non-blocking caution
*   `bg-info` / `text-info-foreground` — neutral informational state (new in Batch 0)
*   `bg-danger` / `text-danger-foreground` — recoverable error (separate from `bg-destructive`, which is reserved for irreversible / delete actions)

`Badge` exposes `variant="success" | "warning" | "info"` in addition to the defaults. **Do not** introduce new colors inline — extend `tailwind.css` and the `Badge` variants instead.

### Connection-palette tokens (Batch 0)

The 17-color palette previously inlined in `ModalFolderAppearance.vue` is now mapped to `--color-connection-<name>` (e.g. `--color-connection-emerald`). Use these via `bg-connection-emerald` / `border-connection-emerald` so user-customised connection accents stay theme-aware. Hex values are duplicated under `:root` and `.theme-dark` because the dark-mode shades are subtly brighter for surface contrast.

### DB-object icon tokens (Batch 0, placeholder)

`--db-table` / `--db-view` / `--db-trigger` / `--db-function` / `--db-procedure` / `--db-scheduler` are introduced as **placeholders** for Batch 7 (sidebar / explore-bar migration). Final hex values must be confirmed against `pencil-new.pen` before Batch 7 lands. Until then, do not surface these tokens in production UI.

## When in doubt

1.  Open `pencil-new.pen` in Pencil desktop, use `pencil` MCP to read spec
2.  Or read `tailwind.css` for tokens
3.  Or read this file for component-level conventions
4.  Still unsure — ask user. **Do not guess padding / color / size values from air.**