---

description: "Task list for Shared Movie Watchlist implementation"
---

# Tasks: Shared Movie Watchlist

**Input**: Design documents from `/specs/001-movie-watchlist/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. The spec explicitly requires "automated tests for business rules" (spec.md §5) and research.md §8 names four specific rules to cover; each gets its own task below rather than one generic test task.

**Organization**: Ordered by hard dependency first — schema/migrations and the user seed must exist before anything is testable, and auth must exist before any page is reachable (every route but `/login` is protected). After that, tasks are grouped by user story in spec priority order (P1 → P3) so each story is independently completable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks in this phase)
- **[Story]**: Maps a task to its user story (US1–US4) for traceability
- File paths are exact, per plan.md's Project Structure section

## Path Conventions

Single Next.js App Router project, per plan.md:
- App code: `app/`
- Cross-cutting server modules: `app/lib/`
- Route protection: `proxy.ts` (repo root)
- Migrations: `drizzle/`
- Tests: `tests/integration/`, `tests/unit/`

---

## Phase 1: Setup

**Purpose**: Project tooling and configuration that every later phase needs, on top of the existing `create-next-app` scaffold (Next.js 16.2.11, Tailwind v4, `next-auth@beta`, `drizzle-orm`, `bcryptjs` already in `package.json`).

- [X] T001 Install remaining dependencies: `drizzle-kit`, `@neondatabase/serverless` (runtime), `vitest`, `dotenv`, `tsx` (dev) — update `package.json`/`package-lock.json` via `npm install`
- [X] T002 [P] Create `.env.example` at repo root documenting `DATABASE_URL`, `AUTH_SECRET`, `TMDB_API_KEY` (names and example values per quickstart.md Setup step 1)
- [X] T003 [P] Configure `images.remotePatterns` in `next.config.ts` for TMDB's poster host (`image.tmdb.org`, path `/t/p/**`), per research.md §1 (`images.domains` is deprecated in this Next.js version)
- [X] T004 [P] Update `app/layout.tsx`: change root `<html lang="en">` to `lang="pt-BR"` (FR-025)
- [X] T005 [P] Configure Vitest: add `vitest.config.ts` at repo root (TS/ESM, Node environment) and a `"test": "vitest run"` script in `package.json`
- [X] T006 Set up integration-test database infrastructure (research.md §8: tests run against a real Postgres, not mocks): add a `TEST_DATABASE_URL` variable to `.env.example` documenting the two supported options (a dedicated Neon branch, or local Docker Postgres per quickstart.md Prerequisites), wire `vitest.config.ts` to load it for integration tests, and create a shared cleanup helper `tests/integration/setup.ts` that truncates `movie_entries`, `lists`, and `users` between tests — depends on T002, T005

**Checkpoint**: Tooling in place — dependencies installed, env template exists, TMDB images will load, Vitest runs, and integration tests have an isolated test database with per-test cleanup.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema/migrations and the seeded users first (nothing persists without them), then the full auth stack (nothing in the app is reachable or testable without login, since every route but `/login` is protected — FR-001).

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Data layer

- [ ] T007 Create Drizzle schema in `app/lib/db/schema.ts`: `users`, `lists`, `movie_entries` tables per data-model.md, including the `UNIQUE INDEX ON lists (lower(trim(name)))` and `UNIQUE INDEX ON movie_entries (list_id, tmdb_id)`, and `ON DELETE CASCADE` on `movie_entries.list_id`; add `drizzle.config.ts` at repo root pointing to this schema and to `drizzle/` as the migrations output dir
- [ ] T008 [P] Create the Neon HTTP driver client in `app/lib/db/client.ts` (`drizzle-orm/neon-http` + `@neondatabase/serverless`, reads `DATABASE_URL`)
- [ ] T009 Generate and apply the initial migration (`npx drizzle-kit generate` then `npx drizzle-kit push`) — depends on T007; produces files under `drizzle/`
- [ ] T010 Create the user seed script `scripts/seed-users.ts` (bcrypt-hashes passwords via `bcryptjs`, inserts/upserts the two known users into `users`, accepts repeated `--email`/`--password` CLI args per quickstart.md Setup step 3) and add a `"seed:users": "tsx scripts/seed-users.ts"` script in `package.json` — depends on T007, T008

### Auth

- [ ] T011 Configure Auth.js in `app/lib/auth.ts`: Credentials provider only, `session: { strategy: "jwt" }`, `authorize()` looks up the user by email via Drizzle (T008's client) and verifies the password with `bcryptjs` against `password_hash` — per research.md §4 and contracts/auth.md (no adapter, no OAuth) — depends on T008
- [ ] T012 Create the DAL's `verifySession()` in `app/lib/dal.ts`: verifies/decodes the JWT session via Auth.js `auth()`, checks expiry, redirects to `/login` when missing/expired, returns `{ userId }` on success — per contracts/auth.md — depends on T011
- [ ] T013 Create `proxy.ts` at repo root (Next.js 16 convention — exported function must be named `proxy`, not `middleware`): redirects unauthenticated visitors to `/login` for every route except `/login`, redirects authenticated visitors away from `/login` to `/` — per contracts/auth.md and research.md §1 — depends on T011
- [ ] T014 [P] Create the login page UI in `app/login/page.tsx`: email/password form in pt-BR, wired to `useActionState`, inline error rendering
- [ ] T015 [P] Create `signInAction` and `logoutAction` in `app/login/actions.ts` per contracts/auth.md (`signIn('credentials', ...)` with `redirect: false`, maps `CredentialsSignin` to `{ error: 'E-mail ou senha inválidos.' }`; `logoutAction` calls `signOut()`) — depends on T011

**Checkpoint**: Schema is migrated, both users are seeded, and a user can sign in/out with session protection enforced on every other route. User story work can now begin.

---

## Phase 3: User Story 1 - Sign in and see the shared lists (Priority: P1) 🎯 MVP

**Goal**: A signed-in user lands on an overview of every shared list (even if empty); a signed-out visitor is redirected to login from any other page.

**Independent Test**: Sign in with a seeded account and confirm the lists overview loads (even if empty); visit any other page while signed out and confirm redirect to `/login`.

### Implementation for User Story 1

- [ ] T016 [US1] Create the lists overview page `app/(lists)/page.tsx`: calls `verifySession()`, queries all `lists`, renders each with a link to its detail page, and shows an empty state when there are zero lists (Acceptance Scenario 1, 4)
- [ ] T017 [US1] Add a logout control to the lists overview page invoking `logoutAction` (T015)

**Checkpoint**: User Story 1 is fully functional and independently testable — login → lists overview → logout → redirect-when-signed-out all work.

---

## Phase 4: User Story 2 - Create a list and add movies via search (Priority: P1)

**Goal**: A signed-in user creates a named list, searches TMDB by title, and adds results to the list, with per-list duplicate prevention.

**Independent Test**: Create a list, search for a known movie title, add a result, and confirm it appears in the list without re-querying search on reload; confirm a second add of the same movie to the same list is indicated as already present, not duplicated.

### Tests for User Story 2 (business rules — research.md §8) ⚠️

> Write these tests FIRST; ensure they FAIL before implementation.

- [ ] T018 [P] [US2] Integration test in `tests/integration/lists.test.ts`: creating a list with a name that duplicates an existing list case/whitespace-insensitively (e.g. "Date Night" vs " date night ") is rejected with no new row (FR-005) — depends on T006
- [ ] T019 [US2] Integration test in `tests/integration/lists.test.ts`: two simultaneous creates of the same list name race safely — exactly one succeeds, the other is rejected via the DB unique index and surfaced as the same duplicate-name error (CHK004, research.md §8) — same file as T018, sequential; depends on T006
- [ ] T020 [P] [US2] Integration test in `tests/integration/movie-entries.test.ts`: adding a TMDB id already present in a list is rejected (no duplicate row created) and the caller is informed it's already present (FR-016) — depends on T006
- [ ] T021 [US2] Integration test in `tests/integration/movie-entries.test.ts`: the same TMDB id can be added independently to a second list and both entries persist and toggle independently (FR-017) — same file as T020, sequential; depends on T006
- [ ] T022 [P] [US2] Unit test in `tests/unit/tmdb-filter.test.ts`: a TMDB search response containing a result with no usable `id` has that result dropped before being returned (CHK021, research.md §5)
- [ ] T023 [P] [US2] Unit test in `tests/unit/tmdb-search-route.test.ts`: with the TMDB fetch call mocked, the search route returns `503 { error: "search_unavailable" }` when the TMDB fetch fails or returns a non-2xx response (FR-013, contracts/tmdb-search.md)

### Implementation for User Story 2

- [ ] T024 [P] [US2] Create the TMDB fetch wrapper in `app/lib/tmdb.ts`: server-only, reads `TMDB_API_KEY`, calls TMDB's title-search endpoint, maps its response shape to `{ tmdbId, title, releaseYear, posterPath, overview }`, filters out any result without a usable id (closes CHK021)
- [ ] T025 [US2] Create the TMDB search Route Handler `app/api/tmdb/search/route.ts` (`GET`) per contracts/tmdb-search.md: calls `verifySession()` (401 if unauthenticated), returns `{ results: [] }` for empty/whitespace `q` without calling TMDB, returns `503 { error: "search_unavailable" }` on TMDB fetch failure or non-2xx — depends on T012, T024
- [ ] T026 [P] [US2] Create the `createList` Server Action in `app/(lists)/actions.ts` per contracts/server-actions.md: trims and validates non-empty (FR-004), ≤60 chars (FR-026), case/whitespace-insensitive uniqueness (FR-005), catches the DB unique-violation race and maps it to the same duplicate-name message (CHK004) — depends on T007, T012
- [ ] T027 [US2] Add the list-creation form to `app/(lists)/page.tsx`, wired to `createList` via `useActionState` with inline error display — depends on T016, T026
- [ ] T028 [US2] Create the list detail page `app/(lists)/[listId]/page.tsx`: calls `verifySession()`, queries the list's movie entries ordered alphabetically by title (FR-022), and renders a distinct empty state when the list has zero movies (FR-009, FR-028) — depends on T012
- [ ] T029 [US2] Add the movie search UI to `app/(lists)/[listId]/page.tsx`: debounced `fetch` with `AbortController` against `/api/tmdb/search`, renders poster/title/year/overview per result, shows a friendly empty state on no matches (FR-012) and a retry-capable message on `503` without crashing (FR-013), textually/visually distinct from the zero-movies empty state (FR-028) — depends on T025, T028
- [ ] T030 [US2] Create the `addMovieToList` Server Action in `app/(lists)/[listId]/actions.ts` per contracts/server-actions.md: validates `(listId, tmdbId)` not already present (FR-016), returns `{ error: 'already_in_list' }` on duplicate, inserts the snapshot row on success (FR-015, FR-017) — depends on T007, T012
- [ ] T031 [US2] Wire the "add to list" action from search results in `app/(lists)/[listId]/page.tsx` to `addMovieToList`, rendering an "already in this list" indicator instead of a duplicate row — depends on T029, T030

**Checkpoint**: User Story 2 is fully functional and independently testable on top of User Story 1.

---

## Phase 5: User Story 3 - Track watched movies (Priority: P2)

**Goal**: A signed-in user toggles a movie entry watched/unwatched and sees the recorded watched date; can filter a list by watched status.

**Independent Test**: Toggle a movie's watched state in a list and confirm the watched date appears and disappears accordingly, independent of search or list-management features.

### Tests for User Story 3 (business rules — research.md §8) ⚠️

- [ ] T032 [P] [US3] Integration test in `tests/integration/watched.test.ts`: marking watched sets `watched_at` to today and displays it; marking unwatched clears it; re-marking watched later records a NEW date, never restoring the previous one (FR-020, research.md §8) — depends on T006

### Implementation for User Story 3

- [ ] T033 [US3] Create the `toggleWatched` Server Action in `app/(lists)/[listId]/actions.ts` per contracts/server-actions.md: flips `watched_at` between `NULL` and `now()` (FR-019, FR-020); no-op-safe if the entry no longer exists, returning a gentle "already removed" state (CHK018) — depends on T007, T012
- [ ] T034 [US3] Add the watched/unwatched toggle control and watched-date display to `app/(lists)/[listId]/page.tsx`, wired to `toggleWatched` — depends on T028, T033
- [ ] T035 [US3] Add the watched-status filter (All / To watch / Watched) to `app/(lists)/[listId]/page.tsx` (FR-021) — depends on T028

**Checkpoint**: User Story 3 is fully functional and independently testable on top of User Stories 1–2.

---

## Phase 6: User Story 4 - Manage and clean up lists (Priority: P3)

**Goal**: A signed-in user renames a list, removes an individual movie, or deletes an entire list, always with confirmation before anything destructive.

**Independent Test**: Rename a list, remove a single movie from a list (with confirmation), and delete a whole list (with confirmation), verifying other lists and their movies are unaffected.

### Tests for User Story 4 (business rules — research.md §8) ⚠️

- [ ] T036 [P] [US4] Integration test in `tests/integration/lists.test.ts`: renaming a list to a case/whitespace variant of its own current name succeeds — a list never conflicts with itself (FR-005 exception) — depends on T006
- [ ] T037 [US4] Integration test in `tests/integration/lists.test.ts`: deleting a list removes only that list's `movie_entries`; the same TMDB id's entry in a different list is untouched (FR-008, cascade delete, research.md §8) — same file as T036, sequential; depends on T006
- [ ] T038 [US4] Integration test in `tests/integration/lists.test.ts`: creating a new list reusing the name of a just-deleted list succeeds (FR-027) — same file as T037, sequential; depends on T006

### Implementation for User Story 4

- [ ] T039 [P] [US4] Create the `renameList` Server Action in `app/(lists)/actions.ts` per contracts/server-actions.md: same validation as `createList` (non-empty, ≤60 chars, uniqueness) but excludes the list's own current row from the duplicate check (FR-005 exception, FR-006) — depends on T026
- [ ] T040 [US4] Create the `deleteList` Server Action in `app/(lists)/actions.ts` per contracts/server-actions.md: deletes the list inside a transaction, relying on `ON DELETE CASCADE` for its `movie_entries` (FR-007, FR-008); no-op-safe if already deleted concurrently — depends on T007, T012
- [ ] T041 [P] [US4] Create the `removeMovieFromList` Server Action in `app/(lists)/[listId]/actions.ts` per contracts/server-actions.md: deletes one movie entry by id (FR-018); no-op-safe if the entry no longer exists (CHK018) — depends on T007, T012
- [ ] T042 [US4] Add rename UI (inline edit + confirmation) to `app/(lists)/page.tsx`, wired to `renameList` — depends on T016, T039
- [ ] T043 [US4] Add delete-list confirmation dialog to `app/(lists)/page.tsx`, wired to `deleteList` — depends on T016, T040
- [ ] T044 [US4] Add remove-movie confirmation dialog to `app/(lists)/[listId]/page.tsx`, wired to `removeMovieFromList` — depends on T028, T041

**Checkpoint**: All four user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Non-functional requirements that span all stories (spec.md §4 Non-functional Requirements).

- [ ] T045 [P] Add a placeholder poster asset (e.g. `public/poster-placeholder.svg`) and render it wherever `posterPath` is `null`, in both search results and list entries (spec Edge Cases)
- [ ] T046 Audit keyboard-reachability of every primary action — sign in, create/rename/delete list, search, add/remove movie, toggle watched, filter — and fix any dead ends (FR-024, SC-005)
- [ ] T047 Run Lighthouse (mobile) against the lists overview and a list detail page; fix findings until performance ≥ 90 and accessibility ≥ 90 (spec Non-functional Requirements)
- [ ] T048 Verify usability at 360px width with no horizontal scroll on both the lists overview and list detail page (SC-004)
- [ ] T049 Run the full quickstart.md validation walkthrough end-to-end (all four numbered scenarios) and fix any gaps found

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately. T006 (test DB infrastructure) depends on T002 and T005 within this phase.
- **Foundational (Phase 2)**: Depends on Setup. Data layer (T007–T010) before Auth (T011–T015) — the seed script needs the schema and client; auth needs the DB client to look up users. **Blocks all user stories.**
- **User Story 1 (Phase 3)**: Depends on Foundational only
- **User Story 2 (Phase 4)**: Depends on Foundational; its business-rule tests (T018–T023) additionally depend on T006 (test DB infrastructure) — except T023, which mocks TMDB and needs no DB; uses the lists overview page from US1 (T016) as its mount point but is independently testable via its own Server Actions and route handler
- **User Story 3 (Phase 5)**: Depends on Foundational; its business-rule test (T032) additionally depends on T006; uses the list detail page from US2 (T028) as its mount point
- **User Story 4 (Phase 6)**: Depends on Foundational; its business-rule tests (T036–T038) additionally depend on T006; extends `app/(lists)/actions.ts` (from T026) and the pages from US1/US2
- **Polish (Phase 7)**: Depends on all four user stories being complete

### User Story Dependencies

Per spec.md, all four stories share the same underlying pages/action files rather than being fully page-isolated, so implementation order follows priority (P1 → P1 → P2 → P3) even though each story's *test* is independent:

- **US1 (P1)**: No dependency on other stories
- **US2 (P1)**: Builds on US1's lists overview page (adds the creation form) and list detail page (new)
- **US3 (P2)**: Builds on US2's list detail page (adds toggle + filter)
- **US4 (P3)**: Builds on US1's lists overview page and US2's list detail page (adds rename/delete/remove UI)

### Within Each User Story

- Tests (where included) are written first and must fail before implementation
- Data-layer/action tasks before the UI tasks that wire them up
- Route handler depends on its underlying `lib` wrapper (T025 depends on T024)

### Parallel Opportunities

- All Setup tasks marked [P] (T002–T005) can run in parallel once T001 (dependency install) completes; T006 must follow T002 and T005
- T008 (DB client) can run in parallel with T007 only if the schema import isn't needed yet — in practice T008 imports `schema.ts`, so treat T007 → T008 as sequential despite the [P] marker being omitted
- T014 (login page) and T015 (login actions) can be built in parallel — different files
- Within US2: T018, T020, T022, and T023 can run in parallel (four different test files, once T006 is done — T023 needs no DB at all since TMDB is mocked); T019 must follow T018 (same file) and T021 must follow T020 (same file)
- Within US2 implementation: T024 (tmdb.ts) and T026 (createList action) can run in parallel — different files, no shared dependency
- Within US4: T036, T037, and T038 are same-file (sequential, `tests/integration/lists.test.ts`); T039 and T041 touch different files and can run in parallel

---

## Parallel Example: User Story 2 tests

```bash
# Launch together (four different files, once T006 test DB infrastructure is done — except the last, which needs no DB):
Task: "Integration test: duplicate list name rejection in tests/integration/lists.test.ts"
Task: "Integration test: duplicate movie-in-list rejection in tests/integration/movie-entries.test.ts"
Task: "Unit test: TMDB result id-filter in tests/unit/tmdb-filter.test.ts"
Task: "Unit test: TMDB search route 503 on fetch failure (mocked) in tests/unit/tmdb-search-route.test.ts"

# Then, same-file follow-ups (sequential within each file):
Task: "Integration test: concurrent-create race in tests/integration/lists.test.ts"
Task: "Integration test: multi-list independence in tests/integration/movie-entries.test.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (schema, seed, auth) — **critical, blocks everything**
3. Complete Phase 3: User Story 1 (sign in, see lists)
4. Complete Phase 4: User Story 2 (create list, search, add movies) — this is the app's core value per spec.md §3
5. **STOP and VALIDATE**: run quickstart.md scenarios 1–2, confirm the four US2 business-rule tests pass
6. Deploy/demo if ready — a couple can already build a shared list together at this point

### Incremental Delivery

1. Setup + Foundational → login works, lists overview reachable
2. + User Story 1 → deployable (login-gated empty overview)
3. + User Story 2 → deployable MVP (create lists, add movies via TMDB search)
4. + User Story 3 → deployable (watched tracking + filter)
5. + User Story 4 → deployable (full CRUD with cleanup)

---

## Notes

- [P] tasks touch different files and have no unmet dependency within their phase
- [Story] label maps each task to its user story for traceability
- Business-rule tests are grouped under the user story whose acceptance scenarios they verify, not dumped in a trailing phase
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently before continuing
