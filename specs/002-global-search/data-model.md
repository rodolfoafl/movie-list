# Data Model: Global Movie Search

No database schema changes. All entities below are either the existing TMDB search result shape (reused) or in-memory/transport shapes introduced for this feature — none require a new table or column on `lists` / `movie_entries` (`app/lib/db/schema.ts`).

## Reused entity: TMDB Search Result

Already defined as `TmdbSearchResult` in `app/(lists)/[listId]/MovieSearch.tsx:9-15`, moved (per [[research]] §5) into the shared `app/components/useTmdbSearch.ts` module so both search surfaces import the same type.

| Field | Type | Source |
|---|---|---|
| `tmdbId` | `number` | TMDB API, via `app/lib/tmdb.ts` |
| `title` | `string` | TMDB API |
| `releaseYear` | `number \| null` | TMDB API |
| `posterPath` | `string \| null` | TMDB API |
| `overview` | `string` | TMDB API |

## New entity: List Selection Snapshot

Returned by the new `getListsForMovie(tmdbId)` Server Action (`app/search/actions.ts`); one entry per list in the workspace, computed at modal-open time only (FR-019).

| Field | Type | Meaning |
|---|---|---|
| `id` | `string` (uuid) | `lists.id` |
| `name` | `string` | `lists.name` |
| `alreadyInList` | `boolean` | `true` if a `movie_entries` row exists for `(id, tmdbId)` at snapshot time — drives checked+disabled state (FR-010) |

Computed as: all rows from `lists` (ordered by name, matching `app/(lists)/page.tsx:14-17`'s existing ordering convention) left-joined in memory against the set of `movie_entries.listId` where `tmdbId` matches the searched movie. No new index needed — `movie_entries_list_tmdb_unique_idx` already covers the lookup pattern (`(listId, tmdbId)`), and this query filters by `tmdbId` alone across all lists, an unindexed scan acceptable at this app's 2-user / small-list-count scale (no new performance requirement introduced beyond existing SC targets).

**Client-side augmentation**: when the inline create-list flow (FR-013/025) succeeds, the modal appends one new entry, `{ id: <returned id>, name: <returned name>, alreadyInList: false }`, to this snapshot in local state — this is the one permitted mutation of an otherwise-frozen snapshot, since a brand-new list cannot yet contain the movie.

**Lifecycle**: created on modal open, held in the modal's local React state for the lifetime of that open instance, discarded on close. Never persisted, never re-fetched while open (FR-019). A fresh instance is created each time the modal reopens (FR-020's retry-via-reopen mechanism).

## New entity: Per-List Add Outcome

Returned per checked-and-enabled list by the new `addMovieToListWithOutcome(listId, movie)` Server Action; the modal assembles an array of these (one per list it attempted) after `Promise.allSettled` resolves, to render FR-012/FR-023's per-list report.

**Wire shape** — this is the actual return value of `confirmAddToLists` (see [[contracts/confirm-add-to-lists]]), and does **not** include `listName`:

| Field | Type | Meaning |
|---|---|---|
| `listId` | `string` (uuid) | Which list this outcome is for |
| `status` | `"success" \| "failure"` | Outcome per [[research]] §1's classification rules |
| `reason` | `string \| undefined` | Present only when `status === "failure"`; one of `"Lista não existe mais."` (FR-021) or `"Não foi possível adicionar, tente novamente."` (FR-023) |

**Displayed shape** — what `AddToListModal` renders for FR-012/FR-023's per-list report, after the modal joins each wire-shape outcome with the list name it already holds in its own List Selection Snapshot (keyed by `listId`, not re-fetched):

| Field | Type | Meaning |
|---|---|---|
| `listId` | `string` (uuid) | Which list this outcome is for |
| `listName` | `string` | Joined client-side from the List Selection Snapshot for display — never part of `confirmAddToLists`'s return value itself |
| `status` | `"success" \| "failure"` | Outcome per [[research]] §1's classification rules |
| `reason` | `string \| undefined` | Present only when `status === "failure"` |

**Not modeled as a stored entity** — this is a transport shape for a single confirmation's UI report; nothing about a confirmation attempt is persisted beyond the `movie_entries` rows that `addMovieToList` itself inserts.

## State transitions — "add to list" modal

```
closed
  → (user triggers "add to list" on a search result) → open/loading
      → getListsForMovie succeeds, snapshot.length > 0 → open/ready (checkboxes shown, FR-010 checked+disabled state applied)
      → getListsForMovie succeeds, snapshot.length === 0 → open/empty (inline create-list prompt, FR-013)
          → createList succeeds → open/ready (new list appended to snapshot, unchecked+enabled, FR-014/025)
          → createList fails validation → open/empty (inline error shown, FR-024, same modal instance)
      → getListsForMovie fails → open/error (retry re-runs the fetch; this is not a mutation, so it may safely re-fetch)
  → (user confirms in open/ready, ≥0 newly-checked lists) → submitting → open/ready with per-list outcomes rendered (FR-012); no lists changed if 0 newly-checked (edge case, no-op)
  → (user closes/cancels, any open state) → closed, no lists or movies changed (FR-015)
```

Reopening (FR-020) always starts a fresh `closed → open/loading` transition with a brand-new snapshot fetch — this is how a failed per-list add is retried, per FR-020.
