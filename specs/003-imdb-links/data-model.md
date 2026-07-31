# Data Model: IMDb Links on Movie Cards

One schema change (a new nullable column); everything else below is either the existing TMDB search result shape (extended in-memory only) or transport/hook shapes introduced for this feature.

## Modified entity: Movie Entry (`movie_entries`, `app/lib/db/schema.ts`)

Extends the existing table from 001-movie-watchlist with one new nullable column:

| Field | Type | Notes |
|---|---|---|
| `imdbId` (`imdb_id`) | `text`, nullable | NEW. Resolved either at add-time (`addMovieToList`, FR-007) or by the backfill script (FR-009). `NULL` is a normal, expected state (never looked up, lookup failed, or no TMDB match) — not an error condition (FR-006). No index: never queried by value, only read per-row when rendering a list-detail page. Deleted along with its row when the entry is removed (`ON DELETE CASCADE` already governs the whole row via `movieEntries.listId → lists.id`; no separate cleanup needed since `imdb_id` is a column on that row, not a separate table) — satisfies FR-013 automatically. |

All other existing columns (`id`, `listId`, `tmdbId`, `title`, `posterPath`, `releaseYear`, `watchedAt`, `createdAt`) are unchanged.

**Migration**: One additive Drizzle migration (`drizzle-kit generate`, applied via the project's existing migration flow) — `ALTER TABLE movie_entries ADD COLUMN imdb_id text`. No backfill runs as part of the migration itself; existing rows get `NULL` and are picked up later by `scripts/backfill-imdb-ids.ts` (User Story 4), consistent with FR-006's "optional, not an error" framing.

## Modified transport shape: `MovieSnapshot` (`app/(lists)/[listId]/actions.ts`)

| Field | Type | Notes |
|---|---|---|
| `tmdbId` | `number` | unchanged |
| `title` | `string` | unchanged |
| `posterPath` | `string \| null` | unchanged |
| `releaseYear` | `number \| null` | unchanged |
| `imdbId` | `string \| null \| undefined` | NEW, optional. Tri-state per [[research]] §5: `undefined` = no session-cached attempt, `addMovieToList` must perform its own lookup (FR-007/FR-008); `null` = session already attempted and found nothing, stored as-is, no new lookup; `string` = session already resolved this id, stored as-is, no new lookup (FR-023). |

`addMovieToList`'s insert now includes `imdbId: movie.imdbId === undefined ? null : movie.imdbId` — i.e. the row is always inserted immediately, with `null` for both the `null` case and the not-yet-resolved `undefined` case. Only in the `undefined` case does the function additionally schedule an `after()` background task (research.md §9) that calls `resolveImdbId(movie.tmdbId)` and, on a non-null result, runs a no-op-safe `UPDATE movie_entries SET imdb_id = :id WHERE id = :entryId` using the entry id returned by the insert. `resolveImdbId` (research.md §2) never throws, and the background task runs entirely after the action has already returned, so this can never fail or delay the add (FR-008).

## Reused entity: TMDB Search Result (`TmdbSearchResult`, `app/components/useTmdbSearch.ts`)

Unchanged — `tmdbId`, `title`, `releaseYear`, `posterPath`, `overview`. The IMDb id for a search result is **not** added to this type; it's tracked separately by the new session cache below and passed into `MovieResultCard` as a sibling prop, since a `TmdbSearchResult`'s IMDb id resolves asynchronously *after* the result itself already exists (FR-022), and mixing an eventually-set field into an otherwise-immutable result object would require mutating or re-keying `results` just to attach it.

## New entity: IMDb Session Cache (`useImdbIds`, in-memory only, `app/components/useImdbIds.ts`)

Not persisted, not a database entity — a per-mount, in-memory record living exactly as long as the search component that owns it (`GlobalMovieSearch` or the in-list `MovieSearch`).

| Field | Type | Meaning |
|---|---|---|
| key | `number` (`tmdbId`) | Movie identifier, matching a `TmdbSearchResult.tmdbId` |
| value | `string \| null` | Resolved IMDb id, or `null` if this session already attempted resolution and found nothing (failure or no match, collapsed per [[research]] §2) |

**Lifecycle**: starts empty on mount; grows by one entry the first time each previously-unseen `tmdbId` is resolved (successfully or not) across any settled search within that mount; never shrinks, never re-resolves an already-keyed `tmdbId` (FR-014); discarded entirely on unmount (navigating away, closing the tab) — matching the Key Entities amendment's "exists only for the duration of the search session... discarded at the end of the session" for entries never added to a list. An entry *is* promoted into a persisted `movie_entries.imdb_id` value if and only if that movie is added to a list while the cache entry exists (FR-023), via the `MovieSnapshot.imdbId` field above.

## New transport shape: External Ids Route response (`GET /api/tmdb/external-ids`)

| Field | Type | Meaning |
|---|---|---|
| `imdbId` | `string \| null` | Resolved IMDb id, or `null` for any failure mode (TMDB error, timeout, genuine no-match) — see [[contracts/external-ids-route]]. Always present in a `200` response; never a distinguishable error shape for this field specifically (FR-005's graceful-absence contract). |

## New entity: Backfill Report (`scripts/backfill-imdb-ids.ts`, operational artifact only)

Not a persisted application entity — an end-of-run JSON report, structurally identical in spirit to `scripts/migrate-legacy.ts`'s existing orphan report, written to `scripts/data/backfill-imdb-orphans.json`.

| Field | Type | Meaning |
|---|---|---|
| `entryId` | `string` (uuid) | `movie_entries.id` that could not be resolved |
| `listId` | `string` (uuid) | Which list the entry belongs to, for the operator's reference |
| `title` | `string` | Snapshot title, for the operator's reference (no extra TMDB call needed — already stored) |
| `tmdbId` | `number` | TMDB id that was looked up |
| `reason` | `string` | Human-readable cause |
| `category` | `"api_error" \| "no_tmdb_match"` | Distinguishes lookup failure from a genuine no-match (FR-012) |

**Summary fields** (top-level, alongside the `orphans` array): `entriesScanned`, `entriesResolved`, `entriesSkippedAlreadyResolved` (should be `0` in the same run that scanned them, since the query itself excludes already-resolved rows — included for operator visibility that idempotency held), matching `migrate-legacy.ts`'s existing `Summary` shape's spirit.

## State flow — search-result IMDb resolution (per settled query)

```
query settles (useTmdbSearch → new `results` array)
  → useImdbIds effect fires, keyed on `results`
      → for each result whose tmdbId is NOT already in the session cache:
          → issue GET /api/tmdb/external-ids?tmdbId=... with its own AbortController
          → on success or graceful-null response → cache[tmdbId] = imdbId (string | null)
          → on abort (superseded by next settled query) → discarded, cache untouched
      → for each result whose tmdbId IS already in the session cache (resolved or null):
          → no fetch issued; MovieResultCard receives the cached value immediately
  → card renders immediately with title/poster/overview (unaffected, FR-022);
    ImdbLink renders once cache[tmdbId] resolves — a non-blocking, additive re-render
    of just that card's action-adjacent slot, never reordering or re-mounting the list
```

## State flow — add-time IMDb persistence

```
user triggers "add" on a search result (in-list MovieSearch, or GlobalMovieSearch → AddToListModal)
  → caller reads cache[result.tmdbId] (may be undefined, null, or a string) into MovieSnapshot.imdbId
  → addMovieToList(listId, movie) called
      → insert movie_entries row NOW:
          movie.imdbId === undefined → imdb_id = NULL (not yet resolved)
          movie.imdbId !== undefined → imdb_id = movie.imdbId as-is (string or null), no lookup at all (FR-023)
      → action returns immediately after the insert — identical outcome/timing regardless of which
        branch ran; TMDB is never on the critical path of the add (FR-008, unconditionally, not bounded
        by a timeout)
      → only when movie.imdbId === undefined, additionally: after(async () => {
            const id = await resolveImdbId(movie.tmdbId)   // best-effort, never throws
            if (id) await db.update(movieEntries).set({ imdbId: id }).where(eq(movieEntries.id, entryId))
                                                             // no-op if the row was since removed
          })
```
