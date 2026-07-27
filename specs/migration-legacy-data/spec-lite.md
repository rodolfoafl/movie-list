# Spec-lite: Legacy Data Migration (MongoDB → Postgres)

**Date**: 2026-07-27
**Source**: 2020 app's MongoDB collection `movies_lists` (exported sample analyzed: 22 lists, 584 movie entries)
**Target**: this app's `lists` / `movie_entries` tables (see data-model.md)
**Type**: one-shot backfill script, not a live sync

## Source shape (as observed)

```json
{
  "_id": { "$oid": "..." },
  "date": { "$date": "2020-04-27T00:11:37.947Z" },
  "name": "Lista para assistir com amorzinho",
  "movies": [
    {
      "status": true,
      "_id": { "$oid": "..." },
      "name": "The Count of Monte Cristo",
      "image": "https://m.media-amazon.com/...jpg",
      "year": "2002",
      "imdbID": "tt0245844"
    }
  ],
  "__v": 148
}
```

## Field mapping

| Source | Target | Rule |
|---|---|---|
| `name` (list) | `lists.name` | inserted as-is, trimmed; relies on the existing unique index to catch any collision — none expected (all 22 source names are unique, longest is 54 chars, under the 60-char limit) |
| `date` (list) | *(not migrated to a column)* | used only as the fallback `watched_at` value for that list's watched movies (see below); the schema has no list-level `created_at` semantics the spec requires preserving |
| `movies[].imdbID` | resolved to `movie_entries.tmdb_id` | via TMDB `GET /find/{imdb_id}?external_source=imdb_id&api_key=...`, using the first `movie_results[0].id`. Empty/missing `imdbID`, or a lookup with zero `movie_results`, routes the entry to the orphan report instead of failing the run. |
| `movies[].name`, `.year`, `.image` | **discarded** — replaced by the fresh TMDB snapshot (`title`, `release_year`, `poster_path`) from the same `/find` response | the new schema's snapshot must come from TMDB, not OMDB, per data-model.md |
| `movies[].status` | `movie_entries.watched_at` | `true` → the parent list's `date` (only timestamp available in the source data); `false`/absent → `NULL` |

## Known data issue (found during sampling, not hypothetical)

One entry — *"Le Dernier Combat (The Last Battle)"*, 1983, list "Sci-Fi" — has
`imdbID: ""`. Confirmed real, not an edge case invented for the spec. Routed
to the orphan report per the mapping rule above; no automatic title/year
fallback search (ambiguous — this film has circulated under three different
titles across regions).

## Process

1. **Extract**: source JSON already exported (`movies_lists.json`), read directly — no live Mongo connection required at migration time.
2. **Transform + Load**, per list, per movie, sequentially:
   - Upsert the list by name (skip if a list with that trimmed/lowercased name already exists — idempotency for lists)
   - For each movie: resolve `imdbID` → TMDB id (rate-limited, see below); on success, `INSERT ... ON CONFLICT (list_id, tmdb_id) DO NOTHING` (idempotency for entries, reusing the existing unique constraint); on resolution failure, append to the orphan report
3. **Rate limiting**: TMDB's free tier is generously rate-limited but not unlimited concurrent — resolve with a small delay between requests (e.g. 250ms), sequential, not `Promise.all` over all 584 at once.
4. **Orphan report**: after the run, print/write a list of `{ listName, movieName, year, imdbID, reason }` for every entry that couldn't be resolved, so they can be added manually via the app's normal search UI.
5. **Idempotency**: the script is safe to re-run in full — existing lists/entries are detected and skipped, not duplicated or errored on.

## Non-goals

- No ongoing/live sync with the old MongoDB — one-time backfill only
- No migration of the old app's user accounts (this app's two users are already seeded)
- No attempt to guess a real historical watched-date beyond the list's own `date` field — that's the only timestamp the source data has

## Estimated scope

22 lists, 584 movie entries (≤1 known orphan going in; more possible if any `imdbID` no longer resolves on TMDB — e.g. removed/merged titles). At ~250ms/request, full run ≈ 2–3 minutes.