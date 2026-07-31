# Quickstart: Validating IMDb Links

## Prerequisites

- `.env.local` with a working DB connection and `TMDB_API_KEY` (same as the rest of the app).
- `npm run dev:test` running (seeds/uses `teste@teste.com` / `teste123` — do not seed manually).
- The `movie_entries.imdb_id` migration applied (`npx drizzle-kit migrate` or equivalent, once generated during implementation). **If targeting a DB whose schema was ever provisioned via `drizzle-kit push`** (this includes `TEST_DATABASE_URL` and, per `specs/notes.md`'s 2026-07-31 entry, will also apply to `DATABASE_URL` the first time it's migrated) — `drizzle-kit migrate` will fail trying to replay migration 0000 from scratch unless `drizzle.__drizzle_migrations` is first backfilled to reflect what's already live; see that entry for the exact one-time pre-step and why it's needed.
- At least one list with existing entries, and one list with zero entries.

## Scenario 1 — IMDb link on an existing list entry (User Story 1 / FR-001–FR-003, SC-001)

1. Add a well-known movie (e.g. "The Matrix") to a list, wait for it to appear.
2. Open that list's detail page; confirm a plain-text "IMDb" link (no icon) appears on that entry.
3. Click it; confirm it opens `https://www.imdb.com/title/tt0133093/` (or the correct id for whatever movie was added) in a **new tab**, and the list page remains open, unchanged, in the original tab.
4. Manually null out `imdb_id` for one entry (or add a movie you expect TMDB has no IMDb cross-reference for, if one is known) and reload; confirm that entry renders exactly as it did before this feature — no link, no placeholder, no broken-link icon.

## Scenario 2 — IMDb link on search results, before adding (User Story 2 / FR-004–FR-005, FR-022)

1. From a list's detail page, search for a movie in the in-list search box.
2. Confirm results render immediately with title/poster/overview (unaffected by this feature), and the "IMDb" link appears on each resolvable result shortly after — a visibly separate, non-blocking update, not simultaneous with the rest of the card (FR-022; acceptance scenario 4).
3. Repeat from `/search` (global search); confirm identical behavior on both surfaces.
4. Confirm a result whose id cannot be resolved shows no link and no error indicator in its place.

## Scenario 3 — Rapid retype does not spam TMDB or cross-contaminate results (FR-014–FR-017, FR-021, SC-004)

Prerequisite: browser DevTools Network tab open, filtered to `external-ids`.

1. Type a query, let it settle (results + IMDb links appear), then quickly backspace and retype a different query several times within a few seconds.
2. Confirm: no visible slowdown or error state; the Network tab shows `external-ids` requests only for previously-unseen movies in the settled results (already-seen movies from an earlier settled query in the same visit fire **no** new request); requests belonging to a query you've since typed past do not arrive and attach to the wrong result set (no IMDb link appears on the wrong card).
3. Confirm the count of `external-ids` requests fired for any single settled query never exceeds the number of results actually displayed for that query (≤10).

## Scenario 4 — Adding a movie resolves and stores its IMDb id automatically (User Story 3 / FR-007, FR-008, SC-002)

1. Search for a movie not yet in any list; before its IMDb link finishes resolving in the results (i.e., click fast), click "Adicionar à lista" / check a list and confirm in the modal.
2. Confirm the add completes with the same success messaging and speed as before this feature.
3. Open the list; confirm the entry now shows an IMDb link (resolved server-side at add-time, since the client hadn't cached it yet).
4. Repeat, but this time wait for the search result's IMDb link to appear *before* adding; confirm in DevTools Network tab that adding does **not** fire a second `external-ids`-equivalent lookup for that movie (FR-023 — the add reuses the session-cached id).
5. Background completion (FR-007/FR-008, research.md §9 — `after()` fire-and-forget, not an inline await): add a movie not previously searched in this session (so no session-cached id exists) to a list. Confirm the add's response is as fast as before this feature — no visible delay, same success messaging. Immediately open that list's detail page (before there's necessarily been time for the background lookup to finish); the entry may still show no IMDb link at this instant — that's expected, since resolution happens in a background task scheduled to run *after* the add already responded, not before it. Wait a couple of seconds and reload the list page again; confirm the entry now shows the IMDb link, demonstrating the id was resolved and persisted to the row after the add had already completed, with no bounded-timeout delay visible to the user at add time.
6. Simulate an add-time lookup failure (temporarily break `TMDB_API_KEY`, restart dev server) and add a movie not previously searched in this session; confirm the add still succeeds with the same messaging/speed, and the entry simply shows no IMDb link even after waiting and reloading. Restore the key.

## Scenario 5 — Backfill (User Story 4 / FR-009–FR-012, SC-003)

Prerequisite: some `movie_entries` rows with `imdb_id IS NULL` (true for any pre-migration row, or force one with a manual `UPDATE`).

1. Run: `npx tsx scripts/backfill-imdb-ids.ts --database-url <TEST_DATABASE_URL>` against a test database (never the shared app database without explicit intent — see [[contracts/backfill-imdb-ids-script]]'s `--database-url` guard).
2. Confirm console output reports entries scanned/resolved, and `scripts/data/backfill-imdb-orphans.json` lists any unresolved entries with a `category` of `api_error` or `no_tmdb_match`.
3. Open a list containing a previously-unresolved entry that the backfill resolved; confirm its IMDb link now appears.
4. Re-run the exact same command; confirm the console reports zero entries scanned/resolved (all rows already have `imdb_id` set or are legitimately unresolved orphans not retried) and the script makes no new TMDB calls (verify via DevTools/log output or a temporarily-broken `TMDB_API_KEY` — a re-run should complete instantly without erroring, since it should never call TMDB at all when there's nothing left to resolve).

## Scenario 6 — Removal cleans up the IMDb id (Edge Cases, FR-013)

1. Remove a movie entry that has an IMDb link from its list.
2. Confirm the entry (and its link) is gone from the list view — nothing else to check, since `imdb_id` lives on the same row that's deleted, not a separate table.

## Scenario 7 — Responsive & keyboard-only (FR-018, FR-019, SC-005)

1. Resize to 360px width (or device emulation); confirm IMDb links remain visible and tappable on both list entries and search result cards, with no horizontal scrolling and no crowding of the add/remove/mark-watched actions.
2. Using only the keyboard (Tab/Shift+Tab/Enter), reach and activate an IMDb link on both a list entry and a search result card; confirm it opens in a new tab.

## Scenario 8 — Post-deploy: `after()` survives real serverless function suspension (FR-007/FR-008, research.md §9)

**Post-deploy only. Not satisfied by anything above, by T014, or by local `npm run dev`/`dev:test` — run this only against a real Vercel deployment (preview or production), after this feature has shipped.**

T014 mocks `after()` to run its callback synchronously, which proves the *logic* inside it is correct (calls `resolveImdbId`, persists the result, no-ops if the row was removed) but proves nothing about whether the callback actually gets to run at all once deployed. `npm run dev`, `npm run dev:test`, and even a local `next build && next start` all keep one long-lived Node process alive for the whole session — the background task will appear to "work" in every one of those environments even if `after()`/`waitUntil` is wired incorrectly, because nothing ever suspends the process out from under it. A real Vercel serverless function is the only environment where the process can actually suspend once the response is flushed, which is the one failure mode that matters here. This is the same class of gap as `specs/notes.md`'s 2026-07-25 "Launch-blocking bug invisible to the entire process" entry, where every pre-launch validation layer ran exclusively against `npm run dev` and missed a production-build-only login failure — dev-only (and build-and-start-only) testing is a blind spot no lower-fidelity check can cover.

Prerequisite: this feature deployed to a real Vercel environment (a preview deployment is sufficient — it runs as an actual serverless function, same as production; local `next start` does not qualify).

1. Temporarily add an artificial delay to the `after()` callback in `addMovieToList` (e.g. `await new Promise((r) => setTimeout(r, 15000))` immediately before the `resolveImdbId` call), and deploy that change to a preview deployment for this check only. The delay is necessary: a fast-resolving TMDB call could coincidentally finish before the function suspends even with broken `after()`/`waitUntil` wiring, producing a false pass. Revert the delay before merging to `main` — it must never reach production.
2. On the deployed preview, search for and add a movie not previously searched in that session (so no session-cached id exists — this is the only branch that schedules a background task).
3. Confirm the add's response returns instantly, with no visible delay — the 15-second artificial delay must not be observable in the add's response time. If it is, the background task is not actually deferred past the response, and the fire-and-forget redesign isn't working as intended.
4. Wait at least 20 seconds (past the artificial delay), then reload that list's detail page on the deployed preview. Confirm the entry's IMDb link now appears — this is the actual proof that `imdb_id` was persisted by a background task that survived the serverless function suspending after the response was already sent.
5. If the link never appears no matter how long you wait, `after()`/`waitUntil` is not correctly wired for this deployment target. Treat this as launch-blocking per the 2026-07-25 standing rule in `specs/notes.md` — do not consider User Story 3 done until resolved, regardless of what T014 or any earlier scenario showed.

## Automated checks

```bash
npm test        # vitest run — unit + integration projects
npm run lint
npm run build    # confirms no type errors across new/modified files
```

Relevant new/updated test files to look for once implemented (see tasks.md): a unit test for `useImdbIds`'s cache/cancel state machine (no network — mock `fetch`; includes an explicit N-results-in/N-fetches-out assertion, finding E2), an integration test for `addMovieToList`'s tri-state `imdbId` handling (omitted → immediate `NULL` insert plus a background `after()` task that resolves and updates it, `null`/string → stored as-is, no new lookup and no background task in the latter two cases — T014, mocking `next/server`'s `after` to run synchronously since tests call the action outside a real request scope), a new `removeMovieFromList` cleanup test confirming a removed entry's row (and its `imdb_id`) is fully gone (T022, finding E1), and an integration test for the `external-ids` route (auth gate, always-`200`-or-`401` shape, never a `503`).
