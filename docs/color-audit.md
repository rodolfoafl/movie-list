# Color usage audit (pre-theme)

Scope: `app/**/*.tsx` + `app/globals.css`. No `ring-*`/`outline-*` focus classes exist anywhere — there is no visible focus style beyond the browser default. No component consumes the `--background`/`--foreground` CSS vars defined in `globals.css` (searched for `bg-background`/`text-foreground` — zero hits), so that token layer is effectively dead code and every component hardcodes raw Tailwind colors instead.

## `app/globals.css`
- `--background: #ffffff` / `--foreground: #171717` (`:root`) — light-mode page background/text, applied to `<body>` only
- `--background: #0a0a0a` / `--foreground: #ededed` (`@media prefers-color-scheme: dark`) — dark-mode equivalents, **OS-level** dark mode (not the `dark:` class variant every component uses — two different dark-mode mechanisms coexist)

## `app/components/AppHeader.tsx`
- `bg-white dark:bg-zinc-950` — header surface
- `border-b border-black/10 dark:border-white/10` — header bottom border
- `text-zinc-700 dark:text-zinc-300` — nav link default
- `hover:text-black dark:hover:text-zinc-50` — nav link hover

## `app/components/MovieResultCard.tsx`
- `bg-white dark:bg-zinc-950` — card surface
- `border-black/10 dark:border-white/10` — card border
- `bg-zinc-200 dark:bg-zinc-800` — poster placeholder box (no image)
- `text-black dark:text-zinc-50` — title
- `text-zinc-500 dark:text-zinc-400` — release year (inline, muted)
- `text-zinc-600 dark:text-zinc-400` — overview text (muted body)

## `app/search/GlobalMovieSearch.tsx`
- `border-black/15 dark:border-white/15` + `dark:bg-zinc-900` + `text-black dark:text-zinc-50` — search input
- `border-amber-300 bg-amber-50 text-amber-800` / dark: `border-amber-900 bg-amber-950 text-amber-200` — error banner (fetch failure)
- `border-amber-400` + `hover:bg-amber-100 dark:hover:bg-amber-900` — "Tentar novamente" retry button inside error banner
- `text-zinc-600 dark:text-zinc-400` — empty-results message
- `border-black/15 dark:border-white/15` + `text-zinc-700 dark:text-zinc-300` + `hover:bg-black/5 dark:hover:bg-white/5` — icon-only "add to list" button (Plus icon)

## `app/search/AddToListModal.tsx`
- `border-black/10 dark:border-white/10` + `bg-white dark:bg-zinc-950` + `text-black dark:text-zinc-50` — dialog surface
- `backdrop:bg-black/50` — dialog backdrop scrim
- `text-zinc-600 dark:text-zinc-400` — subtitle/loading/empty-state text (repeated 3×: movie title line, "Carregando listas...", "Você ainda não tem...")
- `border-amber-300 bg-amber-50 text-amber-800` / dark `border-amber-900 bg-amber-950 text-amber-200` — fetch-error banner (same pattern as GlobalMovieSearch)
- `border-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900` — retry button in that banner
- `text-zinc-500 dark:text-zinc-400` — "(já está nesta lista)" annotation
- `border-black/15 dark:border-white/15 dark:bg-zinc-900 text-black dark:text-zinc-50` — new-list-name input
- `text-red-600 dark:text-red-400` — create-list validation error
- `bg-black text-white hover:bg-[#383838]` / dark `bg-zinc-50 text-black hover:bg-zinc-200` — primary "Criar lista" submit button
- `text-emerald-700 dark:text-emerald-400` — per-list **success** outcome row
- `text-red-700 dark:text-red-400` — per-list **failure** outcome row (this is the "success/failure report (emerald/red)" pattern)
- `border-black/15 dark:border-white/15` — "Fechar" secondary button (border only, no fill)
- `bg-black text-white` / dark `bg-white text-black` — "Confirmar" button (note: inverse-color pattern here, no `[#383838]` hover — inconsistent with the other primary buttons below)
- same `bg-black text-white dark:bg-white dark:text-black` + `opacity-50` — disabled "Adicionando..." state

## `app/(lists)/ListRow.tsx`
- `border-black/10 dark:border-white/10` + `bg-white dark:bg-zinc-950` — list-row card surface (both edit and view mode)
- `border-black/15 dark:border-white/15` + `dark:bg-zinc-900 text-black dark:text-zinc-50` — rename input
- `bg-black text-white hover:bg-[#383838]` / dark `bg-zinc-50 text-black hover:bg-zinc-200` — "Salvar" primary button
- `border-black/15 dark:border-white/15 text-zinc-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5` — "Cancelar" secondary button
- `text-red-600 dark:text-red-400` — rename error message
- `text-black dark:text-zinc-50` + `hover:underline` — list name link
- `border-black/15 dark:border-white/15 text-zinc-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5` — "Renomear" button (icon-less)
- `border-red-300 dark:border-red-900 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950` — **destructive** icon-only delete button (Trash2)

## `app/(lists)/CreateListForm.tsx`
- `border-black/15 dark:border-white/15 dark:bg-zinc-900 text-black dark:text-zinc-50` — new-list input
- `text-red-600 dark:text-red-400` — validation error
- `bg-black text-white hover:bg-[#383838]` / dark `bg-zinc-50 text-black hover:bg-zinc-200` — primary submit button (identical pattern to AddToListModal/ListRow)

## `app/(lists)/[listId]/MovieSearch.tsx`
- `text-black dark:text-zinc-50` — "Buscar filmes" heading
- `border-black/15 dark:border-white/15 dark:bg-zinc-900 text-black dark:text-zinc-50` — search input
- `border-amber-300 bg-amber-50 text-amber-800` / dark `border-amber-900 bg-amber-950 text-amber-200` — error banner (same recurring amber pattern, 3rd occurrence)
- `border-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900` — retry button
- `text-zinc-600 dark:text-zinc-400` — empty-results message
- `text-zinc-500 dark:text-zinc-400` — "Já está nesta lista" status text
- `border-black/15 dark:border-white/15 text-zinc-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5` — icon-only add button (Plus)

## `app/(lists)/[listId]/WatchedToggle.tsx`
- `border-black/15 dark:border-white/15 text-zinc-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5` — watched/unwatched toggle button (Eye/EyeOff)
- `border-red-300 dark:border-red-900 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950` — destructive remove button (Trash2), same pattern as ListRow delete
- `text-amber-700 dark:text-amber-400` — "already removed" inline warning (amber used as plain text here, not a banner — inconsistent with the banner pattern elsewhere)

## `app/(lists)/[listId]/page.tsx`
- `bg-zinc-50 dark:bg-black` — page background (this is the recurring page-shell pattern, also in `page.tsx` overview and `search/page.tsx`)
- `text-zinc-600 dark:text-zinc-400` — "← Minhas listas" back link
- `text-black dark:text-zinc-50` — page/list title, "Filmes" heading, entry title (3 occurrences)
- filter nav pills: active = `border-black bg-black text-white dark:border-white dark:bg-white dark:text-black`; inactive = `border-black/15 text-zinc-700 hover:bg-black/5 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5`
- `text-zinc-600 dark:text-zinc-400` — empty-state / no-filter-match messages (2 occurrences)
- `border-black/10 dark:border-white/10 bg-white dark:bg-zinc-950` — movie entry row card
- `bg-zinc-200 dark:bg-zinc-800` — poster placeholder box (dup of MovieResultCard)
- `text-zinc-600 dark:text-zinc-400` — release year
- `text-emerald-700 dark:text-emerald-400` — "Assistido em {date}" success/status text

## `app/(lists)/page.tsx`
- `bg-zinc-50 dark:bg-black` — page background
- `text-black dark:text-zinc-50` — "Minhas listas" heading
- `border-black/15 dark:border-white/15 text-zinc-700 dark:text-zinc-300 hover:bg-black/5 dark:hover:bg-white/5` — "Sair" (logout) button
- `text-zinc-600 dark:text-zinc-400` — "Nenhuma lista criada" empty state

## `app/login/LoginForm.tsx`
- `bg-zinc-50 dark:bg-black` — page background
- `border-black/10 dark:border-white/10 bg-white dark:bg-zinc-950` — form card surface
- `text-black dark:text-zinc-50` — "Entrar" heading
- `text-zinc-700 dark:text-zinc-300` — field labels (email/senha)
- `border-black/15 dark:border-white/15 dark:bg-zinc-900 text-black dark:text-zinc-50` — email/password inputs (2×)
- `text-red-600 dark:text-red-400` — sign-in error
- `bg-black text-white hover:bg-[#383838]` / dark `bg-zinc-50 text-black hover:bg-zinc-200` — primary submit (5th occurrence of this exact pattern)

## `app/search/page.tsx`
- `bg-zinc-50 dark:bg-black` — page background
- `text-black dark:text-zinc-50` — page heading

## `app/layout.tsx`
- No color classes — just layout/flex utilities.

---

## Recurring patterns (candidates for tokens)

| Role | Light | Dark | Where |
|---|---|---|---|
| Page background | `bg-zinc-50` | `bg-black` | 4 page shells |
| Card/surface background | `bg-white` | `bg-zinc-950` | header, dialog, cards, form (6 files) |
| Card/surface border | `border-black/10` | `border-white/10` | same 6 files |
| Input border | `border-black/15` | `border-white/15` | every text input (7 occurrences) |
| Input background (dark only) | *(none, uses card bg)* | `bg-zinc-900` | inputs |
| Primary text | `text-black` | `text-zinc-50` | headings, titles, primary body |
| Secondary/muted text | `text-zinc-600` | `text-zinc-400` | 12+ occurrences — most common muted pair |
| Tertiary/dim text | `text-zinc-500` | `text-zinc-400` | annotations, meta (year, "already in list") |
| Secondary button text | `text-zinc-700` | `text-zinc-300` | outline buttons |
| Secondary button hover fill | `hover:bg-black/5` | `dark:hover:bg-white/5` | outline/icon buttons (7 occurrences) |
| Primary button | `bg-black text-white hover:bg-[#383838]` | `bg-zinc-50 text-black hover:bg-zinc-200` | 5 occurrences — **the `#383838` hex is the only true one-off color in the whole codebase** |
| Primary button (modal confirm variant) | `bg-black text-white` (no hover) | `bg-white text-black` | AddToListModal only — diverges from the pattern above (uses `dark:bg-white` not `dark:bg-zinc-50`, and no hover state) |
| Poster placeholder bg | `bg-zinc-200` | `bg-zinc-800` | 2 occurrences |
| Warning/error-banner | `border-amber-300 bg-amber-50 text-amber-800` | `border-amber-900 bg-amber-950 text-amber-200` | 3 identical occurrences (fetch-error banners) |
| Warning retry-button hover | `hover:bg-amber-100`, border `amber-400` | `dark:hover:bg-amber-900` | same 3 banners |
| Warning inline text (no banner) | `text-amber-700` | `text-amber-400` | WatchedToggle "already removed" — same amber family, different treatment (text-only, not a banner) |
| Destructive/error text | `text-red-600` | `text-red-400` | form validation errors (3×) |
| Destructive button | `border-red-300 text-red-700 hover:bg-red-50` | `border-red-900 text-red-400 hover:bg-red-950` | delete/remove icon buttons (2×) |
| Success text | `text-emerald-700` | `text-emerald-400` | "watched" status, add-to-list success outcome (2×) |
| Failure/error text (report) | `text-red-700` | `text-red-400` | add-to-list failure outcome — note this is a *different* red shade than the destructive-button red (700/400 vs 300·700/900·400) |
| Backdrop scrim | `bg-black/50` | *(same in both modes — no dark variant)* | dialog backdrop only |

## Notable inconsistencies worth flagging before token design

1. **Dead token layer**: `globals.css` defines `--background`/`--foreground` → `color-background`/`color-foreground` theme vars, but zero components use `bg-background`/`text-foreground`. It only affects the raw `<body>` tag. Two dark-mode systems currently coexist: `prefers-color-scheme` (unused by components) vs. Tailwind `dark:` class variant (used everywhere else).
2. **One hardcoded hex**: `hover:bg-[#383838]` appears 5× identically — should become a token, not stay a magic value.
3. **Primary button has two divergent variants**: the "confirmed" pattern (`bg-black hover:bg-[#383838]` / `dark:bg-zinc-50 hover:bg-zinc-200`) vs. AddToListModal's "Confirmar"/"Adicionando..." buttons (`dark:bg-white`, no hover state at all).
4. **Amber used two ways**: full banner treatment (border+bg+text, 3×) vs. bare inline text only (WatchedToggle, 1×) — same semantic (warning) but no shared component.
5. **Two distinct reds**: destructive-action red (`red-300/700` light, `red-900/400` dark — buttons) vs. status/error-text red (`red-600/400` — validation, and `red-700/400` — outcome report). Worth deciding if these collapse into one `danger` token or stay split (action vs. text emphasis).
6. **No focus-visible styling anywhere** — worth deciding whether the token system should introduce one (currently relying entirely on native browser outline, which may already be failing the Lighthouse ≥90 accessibility bar depending on browser default).

No files were changed as part of this audit — inventory only, ready to design the token mapping against.
