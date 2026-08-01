# Contract: Backfill Script

**File**: `scripts/backfill-imdb-ids.ts` | **Kind**: Standalone CLI script, run manually by an administrator (not part of the running app)

Structurally parallel to the existing `scripts/migrate-legacy.ts` — see [[research]] §8 for why that shape is reused rather than invented fresh.

## Invocation

```
npx tsx scripts/backfill-imdb-ids.ts --database-url <url>
```

or

```
MIGRATION_DATABASE_URL=<url> npx tsx scripts/backfill-imdb-ids.ts
```

| Flag / Env | Required | Notes |
|---|---|---|
| `--database-url` | one of these two required | Explicit target; takes precedence over the env var |
| `MIGRATION_DATABASE_URL` | one of these two required | Same guard as `migrate-legacy.ts`: `DATABASE_URL` is deliberately **never** read, so the script can't silently target the app's default database by omission |

Missing both → the script throws immediately, before any DB or TMDB call, with the same message shape `migrate-legacy.ts` uses today.

## Behavior

1. Selects every `movie_entries` row where `imdb_id IS NULL` (FR-010's idempotency boundary — already-resolved rows are never read, so a second run over an unchanged database touches nothing).
2. For each row, sequentially (never concurrently):
   - Calls `fetchExternalIds(row.tmdbId)` (`app/lib/tmdb.ts`, throws on network/HTTP failure, returns `null` on genuine no-match — [[research]] §2).
   - Waits `TMDB_REQUEST_DELAY_MS = 250` (same pacing constant as `migrate-legacy.ts`) before the next row, regardless of outcome.
   - On success (a string returned): `UPDATE movie_entries SET imdb_id = :id WHERE id = :entryId`.
   - On no-match (`null` returned, no throw): row added to the report under `category: "no_tmdb_match"`; no DB write.
   - On throw: row added to the report under `category: "api_error"`; a consecutive-error counter increments. If it reaches `CONSECUTIVE_API_ERROR_LIMIT = 5` (same threshold as `migrate-legacy.ts`), the script aborts the remaining rows early via the same `CircuitBreakerAbort` pattern, still writing the partial report collected so far — this guards against burning through the rest of a large backlog against a broken TMDB credential.
   - Any successful (non-throwing) result resets the consecutive-error counter to `0`.
3. Writes an end-of-run report to `scripts/data/backfill-imdb-orphans.json` (FR-012), then prints a one-line summary to stdout (`entriesScanned`, `entriesResolved`, `orphans.length` split by category) — same convention as `migrate-legacy.ts`'s existing console summary.

## Output — end-of-run report (`scripts/data/backfill-imdb-orphans.json`)

```json
{
  "entriesScanned": 640,
  "entriesResolved": 601,
  "orphans": [
    {
      "entryId": "b2f1...",
      "listId": "9ac0...",
      "title": "Some Obscure Title",
      "tmdbId": 123456,
      "reason": "No TMDB external_ids match",
      "category": "no_tmdb_match"
    }
  ]
}
```

See [[data-model]]'s "Backfill Report" entity for the full field table.

## Guarantees (mapped to Functional Requirements)

- **FR-009**: Scans every `movie_entries` row lacking an `imdb_id` at run-time — not bounded by any historical count.
- **FR-010**: Re-running against an unchanged database resolves and updates nothing; the `WHERE imdb_id IS NULL` scope makes this structural, not a runtime check.
- **FR-011**: Sequential, 250ms-paced calls — never `Promise.all`/concurrent TMDB requests.
- **FR-012**: Continues past individual failures (up to the circuit-breaker limit) rather than aborting the whole run on the first error; report distinguishes `api_error` from `no_tmdb_match`.

## Non-goals

- No `--dry-run` flag — not required by any FR; `migrate-legacy.ts` has none either.
- No automatic retry of a previous run's orphans — a plain re-run only picks up rows still `NULL`, which for an `api_error` orphan means running the script again later (once whatever broke TMDB access is fixed) is itself the retry mechanism, consistent with "no automatic retry" (Assumptions).
