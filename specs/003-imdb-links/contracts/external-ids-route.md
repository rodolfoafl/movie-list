# Contract: TMDB External Ids Route Handler

**File**: `app/api/tmdb/external-ids/route.ts` | **Method**: `GET`

A new interface boundary, parallel to `001-movie-watchlist`'s `GET /api/tmdb/search` (see that feature's [tmdb-search.md](../../001-movie-watchlist/contracts/tmdb-search.md)). A Route Handler (not a Server Action) because `useImdbIds` ([[research]] §4) needs `fetch` + `AbortController` to cancel an in-flight lookup when a newer search query supersedes it (FR-015).

## Request

```
GET /api/tmdb/external-ids?tmdbId=<id>
```

| Param | Type | Required | Notes |
|---|---|---|---|
| `tmdbId` | number (as string) | yes | A `TmdbSearchResult.tmdbId` from an already-rendered search result. A missing or non-numeric `tmdbId` returns `{ imdbId: null }` without calling TMDB. |

**Auth**: Requires a valid session (`verifySession()`), same as `tmdb/search`. Unauthenticated requests get `401`.

**Caching**: The route file sets `export const dynamic = "force-dynamic"` explicitly. Verified against the Next.js 16.2.11 source (not assumed) that this route is dynamic-by-default regardless — see [[research]] §3 — but the export is added anyway as a safety net rather than relying on that implicit default, consistent with the caution from 001-movie-watchlist's Phase 7 production-login incident.

## Response — 200 OK

```json
{ "imdbId": "tt0133093" }
```

or, when no IMDb id could be resolved for any reason:

```json
{ "imdbId": null }
```

- This is the **only** non-auth response shape this route ever returns. Unlike `tmdb/search`, there is no `503`/`error` variant here: a TMDB outage, a request timeout, and a genuine "this movie has no IMDb cross-reference" all collapse to `imdbId: null` inside the route (research.md §3). FR-005 requires a search result with no resolvable id to render with "no error... in its place" — normalizing at the route boundary means `useImdbIds` never needs to distinguish these cases, it only ever sees a resolved value or `null`.
- The route calls `resolveImdbId` (`app/lib/tmdb.ts`, [[research]] §2), which itself never throws — this route's own handler therefore needs no `try/catch` around that call, only around request parsing.

## Response — 401 Unauthorized

```json
{ "error": "unauthenticated" }
```

Same shape and cause as `tmdb/search`'s `401`. This is the one error case `useImdbIds` does *not* need to special-case either — a non-`200` response is simply treated as "no id resolved this attempt" by the caller, same as a graceful `imdbId: null`, since a mid-search session expiry is already handled at the page level by `verifySession()`'s redirect on the next navigation.

## Non-goals

- No batching (`?tmdbIds=1,2,3`) — each result gets its own call, capped in aggregate by the existing 10-result search cap (FR-021); batching would be premature at this app's 2-user scale and isn't required by any FR.
- No caching header / `dynamic` config — each call is a live TMDB lookup; caching is handled client-side by the session cache in `useImdbIds`, not by this route.
