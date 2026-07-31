# Contract Amendment: `addMovieToList` (IMDb id persistence)

**File**: `app/(lists)/[listId]/actions.ts` | **Kind**: Server Action (existing, amended)

This amends 001-movie-watchlist's `addMovieToList` contract (see that feature's [server-actions.md](../../001-movie-watchlist/contracts/server-actions.md)) — the function's existing signature, session check, duplicate-detection, and success/error return shape (`{ error: "already_in_list" } | undefined`) are all unchanged. The only change is what gets written to the new `imdb_id` column.

## Amended input: `MovieSnapshot`

```ts
type MovieSnapshot = {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  releaseYear: number | null;
  imdbId?: string | null; // NEW
};
```

| Value passed | Meaning | Behavior |
|---|---|---|
| field omitted (`undefined`) | No session-cached IMDb attempt exists for this movie | `addMovieToList` inserts the row immediately with `imdb_id = NULL`, then schedules a background task via `next/server`'s `after()` that calls `resolveImdbId(movie.tmdbId)` and, on success, runs a no-op-safe `UPDATE movie_entries SET imdb_id = :id WHERE id = :entryId` (no-op if the entry was removed in the meantime) — the TMDB call never runs before the action returns (FR-007, research.md §9) |
| `null` | The calling session already attempted resolution (via search-result lookup) and found nothing | Stored as `null` directly — **no new TMDB call is made, no background task scheduled** (FR-023) |
| a string | The calling session already resolved this movie's IMDb id (via search-result lookup) | Stored directly — **no new TMDB call is made, no background task scheduled** (FR-023) |

## Guarantees preserved

- **FR-008**: `addMovieToList`'s return value and timing are now unconditionally identical across all three branches above — not merely bounded by a timeout. The row insert never waits on TMDB in any branch; the only TMDB call this function can trigger (the `undefined` case) runs in an `after()` callback scheduled to execute after the action has already returned, so it cannot add latency, cannot be visible to the caller, and cannot cause the function to return an error or throw where it previously wouldn't have.
- **Existing callers unaffected**: Every current call site (`MovieSearch.tsx`'s `handleAdd`, `addMovieToListWithOutcome` in `app/search/actions.ts`) that does not yet pass `imdbId` continues to work exactly as before — the field is optional, and omitting it is precisely the "no session cache, do the fallback lookup" behavior, which is what happens today implicitly (today, there is no `imdb_id` column at all; after this change, omitting the field reproduces the same "look it up fresh" behavior this feature introduces).

## Non-goals

- No change to `addMovieToList`'s duplicate-detection, its `revalidatePath` call, or its thrown-error behavior on genuine DB errors — all unchanged from 001-movie-watchlist.
- No retry of a failed lookup on a subsequent add of the *same* movie to a *different* list — each `addMovieToList` call is independent; if the session cache holds `null` for a movie, adding it to five different lists in the same session stores `null` five times, consistent with "no automatic retry" (Assumptions).
