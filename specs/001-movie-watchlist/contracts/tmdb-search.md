# Contract: TMDB Search Route Handler

**File**: `app/api/tmdb/search/route.ts` | **Method**: `GET`

The only interface boundary where a movie-search "API" is exposed — everything else in this app is Server Actions (see [server-actions.md](./server-actions.md)). This is a Route Handler (not a Server Action) because the client performs debounced, cancelable typeahead requests via `fetch` + `AbortController`.

## Request

```
GET /api/tmdb/search?q=<title>
```

| Param | Type | Required | Notes |
|---|---|---|---|
| `q` | string | yes | Raw search text from the user; empty/whitespace `q` returns `{ results: [] }` without calling TMDB |

**Auth**: Requires a valid session (checked via the DAL's `verifySession()`). Unauthenticated requests get `401`. (This route is also reachable only from within `proxy.ts`-protected pages, but it enforces its own check per the authentication guide's recommendation not to rely on Proxy alone.)

## Response — 200 OK

```json
{
  "results": [
    {
      "tmdbId": 603,
      "title": "The Matrix",
      "releaseYear": 1999,
      "posterPath": "/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
      "overview": "Set in the 22nd century..."
    }
  ]
}
```

- `results` is `[]` (not an error) when TMDB returns no matches (FR-012).
- Any TMDB result missing a usable movie id is dropped from `results` server-side before this response is built (closes CHK021) — the client never has to handle a malformed entry.
- `posterPath` is `null` when TMDB has no poster; the client renders a placeholder (spec Edge Cases).
- `results` is capped at the first 10 of TMDB's first page.

## Response — 503 Service Unavailable

```json
{ "error": "search_unavailable" }
```

Returned when TMDB is down or rate-limits the request. The client shows a retry-capable message and must not crash the page (FR-013). The route catches TMDB fetch failures and non-2xx TMDB responses and maps them to this shape — TMDB's raw error body is never forwarded to the client.

## Response — 401 Unauthorized

```json
{ "error": "unauthenticated" }
```

## Non-goals

- No pagination param in MVP (first page of TMDB results is sufficient for a personal watchlist search).
- No caching (`dynamic = 'force-static'` not used) — search results must always be fresh per query.
