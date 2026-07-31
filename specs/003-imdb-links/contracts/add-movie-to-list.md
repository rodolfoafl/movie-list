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
| field omitted (`undefined`) | No session-cached IMDb attempt exists for this movie | `addMovieToList` calls `resolveImdbId(movie.tmdbId)` itself (best-effort, bounded timeout, never throws) and stores whatever it returns (FR-007) |
| `null` | The calling session already attempted resolution (via search-result lookup) and found nothing | Stored as `null` directly — **no new TMDB call is made** (FR-023) |
| a string | The calling session already resolved this movie's IMDb id (via search-result lookup) | Stored directly — **no new TMDB call is made** (FR-023) |

## Guarantees preserved

- **FR-008**: Regardless of which branch above runs, `addMovieToList`'s return value, timing characteristics, and success path are indistinguishable from a build of this feature where the lookup always failed instantly. A slow or failing `resolveImdbId` call can add latency (bounded by its own internal timeout) but can never cause the function to return an error or throw where it previously wouldn't have.
- **Existing callers unaffected**: Every current call site (`MovieSearch.tsx`'s `handleAdd`, `addMovieToListWithOutcome` in `app/search/actions.ts`) that does not yet pass `imdbId` continues to work exactly as before — the field is optional, and omitting it is precisely the "no session cache, do the fallback lookup" behavior, which is what happens today implicitly (today, there is no `imdb_id` column at all; after this change, omitting the field reproduces the same "look it up fresh" behavior this feature introduces).

## Non-goals

- No change to `addMovieToList`'s duplicate-detection, its `revalidatePath` call, or its thrown-error behavior on genuine DB errors — all unchanged from 001-movie-watchlist.
- No retry of a failed lookup on a subsequent add of the *same* movie to a *different* list — each `addMovieToList` call is independent; if the session cache holds `null` for a movie, adding it to five different lists in the same session stores `null` five times, consistent with "no automatic retry" (Assumptions).
