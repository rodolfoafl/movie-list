---

description: "Task list for 003-imdb-links"
---

# Tasks: IMDb Links on Movie Cards

**Input**: Design documents from `/specs/003-imdb-links/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included — quickstart.md names specific new/touched test files (unit `useImdbIds` cache/cancel, integration `addMovieToList` tri-state, integration `external-ids` route auth/shape), so this generation includes matching test tasks.

**Organization**: Tasks are grouped by user story (US1–US4, priority order from spec.md) to enable independent implementation and testing of each.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Exact file paths included in every description

## Path Conventions

Single Next.js App Router project (matches 001/002 — no frontend/backend split). Paths are relative to repo root: `app/`, `scripts/`, `drizzle/`, `tests/unit/`, `tests/integration/`.

---

## Phase 1: Setup

**Purpose**: Schema change and generated migration — the one piece every user story depends on.

- [x] T001 Add nullable `imdb_id` (`text`) column to `movieEntries` in `app/lib/db/schema.ts` (after `releaseYear`, before `watchedAt`, per [data-model.md](./data-model.md) — no index, no default)
- [x] T002 Run `npx drizzle-kit generate` to produce the new migration file under `drizzle/` for T001's schema change; apply it to the local/test database (`npx drizzle-kit migrate` or equivalent per [quickstart.md](./quickstart.md) prerequisites)

**Checkpoint**: `movie_entries` table has the new column locally; existing rows have `imdb_id = NULL` and continue working unmodified (FR-006).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared TMDB resolution functions every other phase (add-time, route handler, backfill script) calls. Nothing in Phase 3+ can be implemented without this.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T003 Add `fetchExternalIds(tmdbId: number): Promise<string | null>` to `app/lib/tmdb.ts` — calls `GET https://api.themoviedb.org/3/movie/{tmdbId}?append_to_response=external_ids`, reads `external_ids.imdb_id`, throws on non-2xx/network failure, returns `null` on a 2xx response with no `imdb_id` (genuine no-match) — mirrors `migrate-legacy.ts`'s `resolveTmdbId` throw/null split (research.md §2)
- [ ] T004 [P] Add `resolveImdbId(tmdbId: number): Promise<string | null>` to `app/lib/tmdb.ts` — thin wrapper around `fetchExternalIds` with `AbortSignal.timeout(5000)`, catches everything (network error, timeout, HTTP error) and collapses to `null`; never throws (research.md §2, FR-008)

**Checkpoint**: `app/lib/tmdb.ts` exposes both the throwing low-level fetch and the safe wrapper — every downstream phase (US1 storage via US3, US2's route, US4's backfill) can now be built.

---

## Phase 3: User Story 1 - See an IMDb link for a movie already in a list (Priority: P1) 🎯 MVP

**Goal**: A plain-text "IMDb" link renders on any list-detail-page movie entry whose `imdb_id` is set; entries with no id render exactly as today.

**Independent Test**: Manually set `imdb_id` on one existing `movie_entries` row (e.g. via SQL, since T009/US3 isn't required to land data yet), open that list's detail page, confirm the link renders and opens the correct IMDb page in a new tab; confirm an entry with `imdb_id = NULL` shows nothing extra.

### Implementation for User Story 1

- [ ] T005 [P] [US1] Create `ImdbLink` component in `app/components/ImdbLink.tsx` — takes `imdbId: string | null | undefined`, renders `null` when falsy (FR-003), otherwise renders `<a href="https://www.imdb.com/title/${imdbId}/" target="_blank" rel="noopener">IMDb</a>` (plain text, no icon per CLAUDE.md/FR-001) with pt-BR `aria-label`/`title` (e.g. `Abrir página do filme no IMDb`) matching this project's icon-only-button convention for consistency even though this is a text link, focus-visible ring styling matching existing links in `app/(lists)/[listId]/page.tsx`
- [ ] T006 [US1] Render `<ImdbLink imdbId={entry.imdbId} />` in the entry row in `app/(lists)/[listId]/page.tsx` (inside the `<li>` per entry, alongside `WatchedToggle`, not crowding it — FR-019); include `movieEntries.imdbId` implicitly via the existing `db.select()` (no column list restriction currently limits it — verify the select isn't projecting a narrower column set before assuming it's included)

**Checkpoint**: User Story 1 fully functional and independently testable — list-detail entries with a stored `imdb_id` show a working new-tab link; entries without one are unchanged.

---

## Phase 4: User Story 2 - See an IMDb link on search results not yet added to any list (Priority: P1)

**Goal**: Both search surfaces (in-list `MovieSearch`, global `GlobalMovieSearch`) resolve and show IMDb links on result cards, without blocking card render, respecting the session cache / cancel-on-supersede / debounce-aligned rules (FR-014–FR-017, FR-021, FR-022).

**Independent Test**: Search the same well-known movie from both the in-list search and `/search`; confirm the card renders immediately (title/poster/overview) and the IMDb link appears shortly after as a non-blocking update, on both surfaces; confirm rapid retype (per quickstart.md Scenario 3) fires no more than one `external-ids` request per previously-unseen result per settled query and never shows a link from a superseded query.

### Tests for User Story 2

- [ ] T007 [P] [US2] Integration test for the route in `tests/integration/external-ids-route.test.ts` — auth gate (unauthenticated → `401 { error: "unauthenticated" }`, mirroring `tests/unit/tmdb-search-route.test.ts`'s mock-`verifySession`-rejection pattern), missing/non-numeric `tmdbId` → `200 { imdbId: null }` without calling `resolveImdbId`, TMDB failure mocked via `resolveImdbId` → still `200 { imdbId: null }` (never `503`, per contracts/external-ids-route.md)
- [ ] T008 [P] [US2] Unit test for the cache/cancel state machine in `tests/unit/use-imdb-ids.test.ts` (no network — mock `fetch` and `AbortController`, following the mocking style of `tests/unit/tmdb-search-route.test.ts`) — covers: previously-unseen `tmdbId` triggers a fetch, already-cached `tmdbId` (resolved or `null`) triggers no fetch (FR-014), an in-flight fetch is aborted when `results` changes before it resolves (FR-015), cache only grows, never resets between `results` changes within the same hook instance; **and** (review finding E2 — FR-016/FR-017/FR-021 volume is satisfied by construction but had no automated assertion): passing a `results` array of length N fires exactly N fetches (minus whatever's already cached), and re-invoking the hook with an unchanged `results` reference/content fires zero additional fetches — turning the "keystroke-disproportionate volume" risk called out in spec.md's feature description into a regression-tested property instead of a manual DevTools-only check (quickstart Scenario 3)

### Implementation for User Story 2

- [ ] T009 [US2] Create `GET /api/tmdb/external-ids` route handler in `app/api/tmdb/external-ids/route.ts` — `verifySession()` gate returning `401 { error: "unauthenticated" }` on failure (mirroring `app/api/tmdb/search/route.ts`'s try/catch shape), parses `tmdbId` query param (missing/non-numeric → `200 { imdbId: null }`, no TMDB call), otherwise calls `resolveImdbId(tmdbId)` and always returns `200 { imdbId }`; sets `export const dynamic = "force-dynamic"` explicitly (research.md §3, contracts/external-ids-route.md)
- [ ] T010 [US2] Create `useImdbIds(results: TmdbSearchResult[]): Record<number, string | null>` hook in `app/components/useImdbIds.ts` — `Record<number, string | null>` state that only grows across renders within the mount (session cache, FR-014); `useEffect` keyed on `results` fetches `/api/tmdb/external-ids?tmdbId=...` per not-yet-cached result, one `AbortController` per fetch, effect cleanup aborts all controllers created in that pass (FR-015); no independent debounce — triggering is driven entirely by `results` changing, i.e. after `useTmdbSearch`'s existing 400ms debounce has already settled (FR-016); volume per pass is naturally bounded by `results.length` (already capped at 10 by `app/api/tmdb/search/route.ts`) minus what's cached (FR-021, FR-017)
- [ ] T011 [P] [US2] Add optional `imdbId?: string | null` prop to `MovieResultCard` in `app/components/MovieResultCard.tsx`, rendering `<ImdbLink imdbId={imdbId} />` alongside `renderAction(result)` without disturbing existing title/poster/overview rendering (FR-022) or crowding the action slot (FR-019)
- [ ] T012 [US2] Wire `useImdbIds(results)` into `app/(lists)/[listId]/MovieSearch.tsx` — pass `cache[result.tmdbId]` as `MovieResultCard`'s new `imdbId` prop for each rendered result
- [ ] T013 [US2] Wire `useImdbIds(results)` into `app/search/GlobalMovieSearch.tsx` — same as T012, passing `cache[result.tmdbId]` into `MovieResultCard`'s `imdbId` prop

**Checkpoint**: User Stories 1 AND 2 both work independently — search results on both surfaces show non-blocking, cancel-safe, cache-reusing IMDb links.

---

## Phase 5: User Story 3 - Newly added movies get their IMDb link automatically (Priority: P2)

**Goal**: `addMovieToList` resolves and stores `imdb_id` as part of the add, best-effort and never blocking; reuses a session-cached id from US2 when available instead of re-fetching (FR-023).

**Independent Test**: Add a movie to a list and confirm its entry subsequently shows an IMDb link with no extra user step; separately, simulate a lookup failure/timeout during add and confirm the add still succeeds identically with no link afterward; separately, add a movie whose id was already resolved via search-result lookup in the same session and confirm (via DevTools Network tab) no second lookup fires.

### Tests for User Story 3

- [ ] T014 [P] [US3] Integration test for tri-state `imdbId` handling, added to `tests/integration/movie-entries.test.ts` (same file/mocking pattern as the existing `addMovieToList` tests — `vi.mock("@/app/lib/dal")`, `vi.mock("next/cache")`) plus `vi.mock("@/app/lib/tmdb")` for `resolveImdbId` and `vi.mock("next/server")` for `after` (mock `after` as `(cb) => cb()` so the scheduled background task runs synchronously and can be awaited in the test — vitest calls `addMovieToList` directly, outside a real Next.js request scope, so the real `after()` would throw per its documented "called outside a request scope" guard; verified against `node_modules/next/dist/server/after/after.js`, research.md §9): omitted `imdbId` on the input → `addMovieToList` returns immediately (assert this resolves before asserting anything about `resolveImdbId`), row is inserted with `imdb_id = null` first, then (after the mocked `after` callback runs) `resolveImdbId` is confirmed called once and its return value persisted to `movie_entries.imdb_id` via the follow-up update; `imdbId: null` on the input → stored as `null` directly, `resolveImdbId` NOT called, no `after` callback scheduled (FR-023); `imdbId: "tt0133093"` on the input → stored as-is, `resolveImdbId` NOT called, no `after` callback scheduled (FR-023); a `resolveImdbId` mock resolving to `null` (simulating failure) → the add still succeeds (`addMovieToList` returns `undefined`, not an error) and returns before the mock is even invoked, confirming FR-008 is unconditional, not timeout-bounded

### Implementation for User Story 3

- [ ] T015 [US3] Add optional `imdbId?: string | null` to `MovieSnapshot` in `app/(lists)/[listId]/actions.ts`; change `addMovieToList`'s insert to always persist `imdbId: movie.imdbId === undefined ? null : movie.imdbId` immediately — never awaiting TMDB — and capture the inserted row's `id`; when `movie.imdbId === undefined`, additionally call `after(async () => { const id = await resolveImdbId(movie.tmdbId); if (id) await db.update(movieEntries).set({ imdbId: id }).where(eq(movieEntries.id, entryId)); })`, importing `after` from `"next/server"` and `resolveImdbId` from `app/lib/tmdb.ts` — the update is no-op-safe if the row was removed before the task runs, matching `removeMovieFromList`'s existing no-op-safe idiom (data-model.md's redesigned "State flow — add-time IMDb persistence", research.md §9, FR-007/FR-008/FR-023)
- [ ] T016 [US3] Update `MovieSearch.tsx`'s `handleAdd` (`app/(lists)/[listId]/MovieSearch.tsx`, from T012) to pass `imdbId: cache[result.tmdbId]` into the `addMovieToList` call's movie object (relies on T010/T012 already wiring `useImdbIds` into this file)
- [ ] T017 [US3] Update `GlobalMovieSearch.tsx`'s `AddToListModal` invocation (`app/search/GlobalMovieSearch.tsx`, from T013) to pass `imdbId: cache[selectedResult.tmdbId]` into the `movie` prop object it constructs (relies on T010/T013 already wiring `useImdbIds` into this file); `AddToListModal.tsx` itself needs no change — it already forwards `movie` as-is through `confirmAddToLists` → `addMovieToListWithOutcome` → `addMovieToList`

**Checkpoint**: User Stories 1, 2, AND 3 all work independently — newly added movies get `imdb_id` resolved for free, reusing session-cached ids from search when present.

---

## Phase 6: User Story 4 - Existing movie entries are backfilled with IMDb links (Priority: P3)

**Goal**: A one-time, idempotent, rate-limited CLI script resolves `imdb_id` for every pre-existing `movie_entries` row lacking one, reporting unresolvable rows at the end.

**Independent Test**: Run the script against a test database containing a mix of resolvable/unresolvable entries; confirm resolvable entries get `imdb_id` set (and subsequently show a link), unresolvable ones appear in the JSON report with the correct `category`, and a second run resolves/reports nothing further and makes no TMDB calls.

### Implementation for User Story 4

- [ ] T018 [US4] Create `scripts/backfill-imdb-ids.ts`, structurally parallel to `scripts/migrate-legacy.ts` (contracts/backfill-imdb-ids-script.md, research.md §8): same `--database-url` / `MIGRATION_DATABASE_URL` guard (never reads `DATABASE_URL`), selects `movie_entries` rows `WHERE imdb_id IS NULL`, sequentially calls `fetchExternalIds(row.tmdbId)` from `app/lib/tmdb.ts` with `TMDB_REQUEST_DELAY_MS = 250` sleep between rows, `UPDATE movie_entries SET imdb_id = :id WHERE id = :entryId` on success, records `category: "no_tmdb_match"` orphan on a `null` return (no throw), records `category: "api_error"` orphan on a throw and increments a consecutive-error counter that resets on any success, aborts remaining rows via a `CircuitBreakerAbort`-style class after `CONSECUTIVE_API_ERROR_LIMIT = 5` consecutive errors (still writing the partial report), writes the end-of-run report to `scripts/data/backfill-imdb-orphans.json` with `entriesScanned`/`entriesResolved`/`orphans` (fields: `entryId`, `listId`, `title`, `tmdbId`, `reason`, `category`), prints a one-line console summary

**Checkpoint**: All four user stories independently functional — US4 extends US1's link coverage to every pre-existing entry.

---

## Phase 7: Review Coverage Additions (findings E1)

**Purpose**: Close a coverage gap flagged by code review — FR-013 (removal deletes `imdb_id` with the row) had no automated test, only manual QA (T021's Scenario 6). Sibling persistence guarantees on the same column (FR-007/008/023) already get dedicated integration coverage via T014; this brings removal to parity.

- [ ] T022 [P] Add a `describe("removeMovieFromList — imdb_id cleanup (FR-013)")` block to `tests/integration/movie-entries.test.ts` (same mocking pattern as the file's existing tests — `vi.mock("@/app/lib/dal")`, `vi.mock("next/cache")`) asserting: insert an entry with a non-null `imdb_id` (either directly via `db.insert(movieEntries)` or via `addMovieToList` with an explicit string `imdbId`, to avoid needing the T014 `after()`/`resolveImdbId` mocks here), call `removeMovieFromList(entryId)`, then `db.select().from(movieEntries).where(eq(movieEntries.id, entryId))` returns zero rows — confirming the id is gone, not merely nulled out. Note: no existing removal test was found in this codebase to extend (`removeMovieFromList` currently has zero test coverage, in this file or elsewhere) — this is a new `describe` block, not a one-line addition to a pre-existing one.

**Checkpoint**: FR-013 now has automated regression coverage alongside its manual QA scenario (quickstart Scenario 6); a future schema change (e.g. splitting IMDb data into a side table) that silently breaks the cascade now fails `npm test`.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Repo-wide checks and manual verification spanning all stories.

- [ ] T019 [P] Run `npm run lint` and `npm run build` — confirm no type errors across every new/modified file listed in plan.md's Project Structure
- [ ] T020 Run `npm test` (vitest `unit` + `integration` projects) — confirm T007, T008, T014, T022 pass alongside the full existing suite
- [ ] T021 Execute [quickstart.md](./quickstart.md) Scenarios 1–7 manually against `npm run dev:test` (teste@teste.com/teste123 — do not seed manually) per this project's local-verification convention; record concrete observations (exact URLs opened, DevTools Network tab request counts per scenario, 360px viewport check results) in the verification commit body per CLAUDE.md's verification-only-commits rule — no bare "pass"/"verified"
- [ ] T023 **Post-deploy only — not a pre-merge gate; do not block T019–T021 or the PR on this.** Once this feature is deployed to a real Vercel environment (preview or production — never `npm run dev`, `dev:test`, or a local `next build && next start`, none of which suspend the process the way a real serverless function does), execute [quickstart.md](./quickstart.md) Scenario 8: temporarily add an artificial delay to the `after()` callback in `addMovieToList`, deploy to a preview, confirm the add still returns instantly, then confirm minutes later that the entry's `imdb_id` was actually persisted — proving the background task survives real serverless function suspension, not just that its logic is correct under T014's mocked `after()`. Revert the artificial delay before/after this check; it must never reach `main`. This closes the same class of dev-vs-production gap logged in `specs/notes.md`'s 2026-07-25 "Launch-blocking bug invisible to the entire process" entry (a production-only login failure that every `npm run dev`-only validation layer missed). Record concrete observations (deployment URL, exact wait time, whether the link appeared) in the verification commit body per CLAUDE.md's verification-only-commits rule. A failure here is launch-blocking, not a backlog item — do not consider User Story 3 done until it passes.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 (T003/T004 don't strictly need the schema column, but are grouped here as the shared blocking prerequisite per plan.md). BLOCKS all user stories.
- **User Story 1 (Phase 3)**: Depends on Phase 1 (needs `movieEntries.imdbId` to select/render) and Phase 2 conceptually not at all for T005/T006 (US1 only *reads* the column — it doesn't call `resolveImdbId` itself) — but Phase 2 must still be complete first since US3 (which populates the column) depends on it, and US1's independent test is more meaningful once data can actually be written. Can be implemented in parallel with US2.
- **User Story 2 (Phase 4)**: Depends on Phase 2 (T003/T004) for T009's route handler. Independent of US1/US3.
- **User Story 3 (Phase 5)**: Depends on Phase 2 (T003/T004 via T015) and on US2's T010/T012/T013 (useImdbIds wiring) for T016/T017 to read `cache[...]` — cannot start until US2's implementation tasks (not just its tests) are done.
- **User Story 4 (Phase 6)**: Depends on Phase 1 (T001, the column to write) and Phase 2 (T003, `fetchExternalIds`). Independent of US1/US2/US3 — can run in parallel with any of them once Phase 2 is done.
- **Review Coverage Additions (Phase 7)**: T022 depends on Phase 1 (T001, the column) and on `removeMovieFromList` already existing (it does, unchanged from 001-movie-watchlist) — not on US3's `after()`/`resolveImdbId` wiring, since the test seeds `imdb_id` directly rather than through the add flow. Can run any time after Phase 1.
- **Polish (Phase 8)**: T019–T021 depend on all four user stories and Phase 7 being complete, and are the actual pre-merge gate. T023 additionally depends on a real Vercel deployment existing (preview or production) — it runs *after* this feature has shipped, is explicitly not a merge blocker, and has no ordering relationship to T019–T021 beyond needing US3 (T015's `after()` wiring) to exist at all.

### User Story Dependencies

- **US1 (P1)**: After Setup + Foundational. No dependency on other stories.
- **US2 (P1)**: After Foundational. No dependency on other stories.
- **US3 (P2)**: After Foundational; additionally depends on US2's implementation (T010/T012/T013) for the cache-reuse wiring in T016/T017.
- **US4 (P3)**: After Setup + Foundational. No dependency on other stories.

### Within Each User Story

- US1: T005 (component) before T006 (wiring it in) — T005 marked [P] since it has no dependency on T006 existing yet, but T006 depends on T005.
- US2: Tests (T007, T008) can be written in parallel with each other and before/alongside implementation (T009–T013); T009 (route) before T010 (hook consumes it via fetch); T010 before T012/T013 (both consume the hook); T011 ([P], independent file) can happen any time before T012/T013 need it.
- US3: Test (T014) before/alongside T015; T015 before T016/T017 (both need `MovieSnapshot.imdbId` to exist).
- US4: Single task (T018), self-contained.

### Parallel Opportunities

- T003 and T004 are sequential in one file (`app/lib/tmdb.ts`) — not marked [P] against each other, though T004 depends only on T003 existing in the same file, not on T003 being "done" in a cross-file sense.
- T005 ([P], US1) can run alongside any Phase 4/5/6 work once Phase 2 is complete.
- T007 and T008 ([P], US2 tests) can run in parallel — different files.
- T011 ([P], US2) can run in parallel with T009/T010 — different file.
- T014 ([P], US3 test) can run in parallel with US1/US2/US4 implementation work.
- US4's T018 can run in parallel with all of US1/US2/US3 once Phase 2 is done — entirely separate file, no shared runtime code path with the web app.
- T022 ([P], Phase 7) can run in parallel with any of US1/US2/US3/US4 once Phase 1 is done — same file as T014 (`tests/integration/movie-entries.test.ts`) but a separate `describe` block with no shared state.
- T019 ([P], Polish) can run alongside T020/T021 once all stories (and T022) are code-complete.
- T023 is not a "parallel opportunity" in the usual sense — it can't start until a real deployment exists, which itself typically follows T019–T021 passing and the PR merging. Scheduling note, not a code dependency.

---

## Parallel Example: User Story 2

```bash
# Launch both US2 tests together:
Task: "Integration test for the route in tests/integration/external-ids-route.test.ts"
Task: "Unit test for the cache/cancel state machine in tests/unit/use-imdb-ids.test.ts"

# T011 (MovieResultCard prop) can proceed in parallel with T009 (route) + T010 (hook):
Task: "Add optional imdbId prop to MovieResultCard in app/components/MovieResultCard.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002).
2. Complete Phase 2: Foundational (T003–T004) — required even for US1-only scope, since US3 (which populates real data) needs it, and a meaningful US1 demo needs at least one entry with a real `imdb_id` to show.
3. Complete Phase 3: User Story 1 (T005–T006).
4. **STOP and VALIDATE**: manually set `imdb_id` on a test row, confirm the link renders/opens correctly, confirm a `NULL` row is unchanged.
5. Demo if ready.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. Add US1 → validate independently → demo (link rendering works, given data).
3. Add US2 → validate independently → demo (search results now show links live).
4. Add US3 → validate independently → demo (adding a movie now populates the data US1 renders, going forward).
5. Add US4 → validate independently → demo (existing 582+ entries backfilled, extending US1 to old data).
6. Add Phase 7 (T022) → closes the FR-013 automated-coverage gap ahead of final polish.
7. Polish (Phase 8, T019–T021) → final pre-merge verification pass, then ship.
8. After deploy: T023 → post-deploy-only confirmation that `after()` survives real serverless function suspension (not required to reach step 7, but required before calling US3 done).

### Parallel Team Strategy

With multiple developers, after Setup + Foundational:

- Developer A: US1 (T005–T006) then US4 (T018, independent of US2/US3).
- Developer B: US2 (T007–T013).
- Developer C: joins US3 (T014–T017) once Developer B's US2 implementation tasks (T010/T012/T013) land.

---

## Notes

- [P] tasks = different files, no dependencies on other unfinished tasks in this list.
- [Story] label maps every phase-3+ task to its user story for traceability.
- No contract test tasks for `addMovieToList` beyond T014 and T022 — both are amendments to an existing, already-tested Server Action, not a new endpoint; the existing `tests/integration/movie-entries.test.ts` file is extended (twice, in separate `describe` blocks) rather than duplicated.
- T022 and the T008 amendment (both in Phase 7 / this revision) originate from code-review findings E1 and E2, respectively: FR-013 (removal cascade) and FR-016/FR-017/FR-021 (keystroke-disproportionate volume) each previously relied on manual QA (T021) alone for a property with automatable, cheap coverage. T015's fire-and-forget `after()` redesign (research.md §9) originates from finding I1.
- Sync `tasks.md` checkboxes in the same commit as each task's implementation (per project convention) — do not batch checkbox updates into a separate pass.
- Commit after each task or logical group; verification-only commits (e.g. T021, T023) must record concrete observations per CLAUDE.md, never a bare "pass".
- T023 is deliberately excluded from the T019–T021 pre-merge gate: it can only run after a real Vercel deployment exists, and its purpose is specifically to catch a class of bug (`after()`/`waitUntil` wiring silently broken) that is invisible to every check that runs earlier — `npm run dev`, `npm run dev:test`, local `next build && next start`, and T014's mocked-`after()` test all share this blind spot by construction (research.md §9, `specs/notes.md` 2026-07-25). Leave its checkbox unchecked until it's actually been run post-deploy; don't check it off alongside T015 just because the code is written.
