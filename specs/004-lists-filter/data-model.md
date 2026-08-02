# Data Model: Filter Lists by Name on the Overview Page

No schema change. This feature introduces no new persisted entity or column — it adds one derived/ephemeral piece of state (the URL's `q` param) and two new query-layer functions over the existing `lists` table.

## Unmodified entity: List (`lists`, `app/lib/db/schema.ts`)

| Field | Type | Notes |
|---|---|---|
| `id` | `uuid` | unchanged |
| `name` | `text` | unchanged — the filter reads this existing column; no new attribute is introduced |
| `createdAt` / `updatedAt` | `timestamp` | unchanged |

The existing `lists_name_unique_idx` (`lower(trim(name))`) is unrelated to this feature and untouched.

## New (ephemeral) state: Overview Filter Value

Not a database entity — lives entirely in the URL query string (`?q=`) and, transiently, in `ListsFilterInput`'s local component state. Never persisted.

| Representation | Shape | Lifecycle |
|---|---|---|
| URL search param (`q`) | `string \| undefined` | Source of truth on every server render (`ListsOverviewPage`'s `searchParams` prop). Absent when no filter is active or the trimmed value is empty. Read fresh on every request — satisfies FR-005's "reload/share URL reproduces the same filtered view." |
| `ListsFilterInput` local state (`value`) | `string` | Client-only, initialized once from the `initialQuery` prop (the server-read `q` value) on mount; updated on every keystroke for immediate visual feedback; debounced (400ms, [[research]] §2) before being trimmed and written back to the URL via `router.replace()`. Never trimmed while the user is actively typing, so a trailing space mid-word isn't silently dropped from the input while typing. |

## New query-layer functions (`app/(lists)/queries.ts`)

Both operate over the existing `lists` table only; neither introduces a new table or column.

### `getVisibleLists(filterValue: string | undefined): Promise<{ id: string; name: string }[]>`

| Input | Behavior |
|---|---|
| `undefined`, `""`, or whitespace-only | No `WHERE` clause applied ([[research]] §7 — `.where(undefined)` is a verified no-op) — returns all lists, `ORDER BY name ASC` (unchanged from today, FR-011). |
| Non-empty after trimming | `WHERE position(lower(trim(filterValue)) in lower(name)) > 0`, `ORDER BY name ASC`. Case-insensitive ([[research]] §1), accent-sensitive (no `unaccent`), every character including `%`/`_`/`\` matched literally (FR-013, SC-005). |

### `hasAnyLists(): Promise<boolean>`

`SELECT lists.id LIMIT 1` — existence check only, no filter applied. Called by the page **only** when `getVisibleLists` returned zero rows and a filter is active ([[research]] §5), to decide which empty-state message applies (FR-007).

## Page-level derived state (`ListsOverviewPage`, `app/(lists)/page.tsx`)

Computed each render from the two functions above, drives the three mutually-exclusive UI states:

| Condition | UI shown |
|---|---|
| `visibleLists.length > 0` | The list, `ORDER BY name ASC`, unchanged rendering via `ListRow` (FR-011) |
| `visibleLists.length === 0` AND no filter active | Existing "Nenhuma lista criada ainda." (unchanged, US2 Acceptance Scenario 2) |
| `visibleLists.length === 0` AND filter active AND `hasAnyLists()` is `false` | Same "Nenhuma lista criada ainda." message — a stale/bookmarked `?q=` on a workspace with zero lists must not claim lists exist but don't match ([[research]] §5) |
| `visibleLists.length === 0` AND filter active AND `hasAnyLists()` is `true` | New, distinct pt-BR "no results for this filter" message (FR-007) |

In every case, `CreateListForm` remains rendered and usable (FR-007 Acceptance Scenario 1, FR-011 — the filter never disables list creation).
