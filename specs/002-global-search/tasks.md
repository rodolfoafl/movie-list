---

description: "Task list for feature 002-global-search"
---

# Tasks: Global Movie Search

**Input**: Design documents from `/specs/002-global-search/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. Not explicitly requested by spec.md, but quickstart.md's "Automated checks" section explicitly names the integration test files below as deliverables for this feature (`get-lists-for-movie.test.ts`, `add-movie-to-list-with-outcome.test.ts`, `confirm-add-to-lists.test.ts`, plus a `createList` regression case in `lists.test.ts`), so they are treated as required, not optional. No component-testing library exists in this repo (`package.json` has only `vitest`, no `@testing-library/react`), so UI components are verified via the existing integration-test convention (testing the Server Actions they call) plus manual quickstart validation, matching how `001-movie-watchlist` is tested today.

**Organization**: Tasks are grouped by user story (spec.md P1–P3) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Maps task to a user story (US1–US4) for traceability
- Every task names an exact file path

## Path Conventions

Single Next.js App Router project (no frontend/backend split) — paths are `app/` and `tests/` at repo root, per plan.md's Project Structure.

---

## Phase 1: Setup

- [ ] T001 Read the Next.js App Router / Server Actions guidance under `node_modules/next/dist/docs/` relevant to routing, layouts, and Server Actions before writing any code in this feature — per `AGENTS.md`, this installed Next.js version (16.2.11) has breaking changes from training data, and this feature adds a new route segment (`app/search/`), a new root-layout render (`app/layout.tsx`), and three new Server Actions (`app/search/actions.ts`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extract the shared search UI (per [research.md](./research.md) §5) that both the existing in-list search and the new global search will consume. This MUST land before either `GlobalMovieSearch.tsx` (US1) or the refactored `MovieSearch.tsx` exist, and unblocks every subsequent search-UI task.

- [ ] T002 [P] Extract the debounce/fetch state machine (currently inline in `app/(lists)/[listId]/MovieSearch.tsx:56-91`) into a new hook `useTmdbSearch(query: string)` in `app/components/useTmdbSearch.ts`, exporting the `TmdbSearchResult` type (currently `app/(lists)/[listId]/MovieSearch.tsx:9-15`) and the same status/result/retry state shape, unchanged behavior (400ms debounce, abort-on-retype, `/api/tmdb/search` fetch)
- [ ] T003 [P] Extract the result-card markup (currently inline in `app/(lists)/[listId]/MovieSearch.tsx:145-201`) into a presentational component `MovieResultCard` in `app/components/MovieResultCard.tsx`, taking a `result: TmdbSearchResult` prop and a `renderAction: (result) => ReactNode` slot prop for the per-context "add" affordance (list-scoped add button vs. global "Adicionar à lista" action)
- [ ] T004 Refactor `app/(lists)/[listId]/MovieSearch.tsx` to consume `useTmdbSearch` (T002) and `MovieResultCard` (T003) instead of its inline logic/markup, passing a `renderAction` that reproduces the existing list-scoped add button exactly (same `handleAdd`, `addStatuses`, disabled/duplicate states) — behavior must be pixel-for-pixel unchanged; verify by re-running `tests/integration/movie-entries.test.ts` (depends on T002, T003)

**Checkpoint**: Shared search hook + card exist and the existing in-list search still passes its existing tests. User story work can now begin.

---

## Phase 3: User Story 1 - Search for a movie from anywhere in the app (Priority: P1) 🎯 MVP

**Goal**: A destination-agnostic `/search` page, reachable from anywhere in the app, with the same debounced search experience (poster/title/year/overview, empty state, retry-capable error state) as the existing in-list search.

**Independent Test**: Navigate to `/search` directly (no list opened first), type a known title and see matching result cards; type a nonsense query and see the friendly empty state; simulate a TMDB failure and see a retry-capable message without a crash. (quickstart.md Scenario 1)

- [ ] T005 [P] [US1] Create `AppHeader` component in `app/components/AppHeader.tsx`: a minimal persistent nav with two links, "Minhas listas" (`/`) and "Buscar filmes" (`/search`), pt-BR labels, keyboard-focusable `<Link>`s (FR-001, FR-017, FR-018)
- [ ] T006 [US1] Render `AppHeader` from `app/layout.tsx` inside `<body>`, above `<main>` (depends on T005)
- [ ] T007 [US1] Create client component `GlobalMovieSearch` in `app/search/GlobalMovieSearch.tsx`, consuming `useTmdbSearch` (T002) and `MovieResultCard` (T003): renders the search input, debounced results, friendly empty state (FR-004), and retry-capable error state (FR-005); pass a `renderAction` slot rendering an "Adicionar à lista" button per result (wired to open the modal in US2 — for this story it may render the button as a visual-only placeholder with no `onClick` yet, since US1's independent test only covers search/result-rendering, not the add flow) (depends on T002, T003)
- [ ] T008 [US1] Create `app/search/page.tsx` Server Component: call `verifySession()`, then render `GlobalMovieSearch` (T007), matching the page-shell layout conventions of `app/(lists)/page.tsx` (depends on T007)

**Checkpoint**: `/search` is reachable from any page via `AppHeader`, loads independent of any list, and search/empty/error states work per quickstart.md Scenario 1.

---

## Phase 4: User Story 2 - Add a search result to one or more lists at once (Priority: P1)

**Goal**: "Adicionar à lista" opens a modal listing every list as an independent checkbox; confirming adds the movie to every checked list in one action, with per-list success/failure reporting (FR-007–FR-012, FR-015, FR-019, FR-021–FR-023).

**Independent Test**: Search for a movie, open "add to list", check 2+ lists, confirm, and verify the movie now appears in every checked list; verify closing without confirming changes nothing. (quickstart.md Scenarios 2, 5, 6)

### Tests for User Story 2

> Write these first; they exercise the three new Server Actions directly against `TEST_DATABASE_URL` per this repo's existing integration-test convention (see `tests/integration/lists.test.ts` for the `vi.mock` pattern to follow).

- [ ] T009 [P] [US2] Integration test in `tests/integration/get-lists-for-movie.test.ts`: returns one entry per list ordered by name, `alreadyInList` correctly reflects `movie_entries` membership for the given `tmdbId`, and returns `[]` when zero lists exist (per [[contracts/get-lists-for-movie]])
- [ ] T010 [P] [US2] Integration test in `tests/integration/add-movie-to-list-with-outcome.test.ts`: covers success (insert), already-in-list-as-success (FR-022), deleted-list-as-failure with reason "Lista não existe mais." (FR-021), and generic-DB-failure-as-failure with reason "Não foi possível adicionar, tente novamente." (FR-023) (per [[contracts/add-movie-to-list-with-outcome]])
- [ ] T011 [P] [US2] Integration test in `tests/integration/confirm-add-to-lists.test.ts`: `verifySession()` called exactly once regardless of `listIds.length`, each returned outcome carries the correct `listId` zipped on, and an empty `listIds` array resolves to `[]` with no DB writes (per [[contracts/confirm-add-to-lists]])

### Implementation for User Story 2

- [ ] T012 [US2] Implement `getListsForMovie(tmdbId: number)` Server Action in `app/search/actions.ts` per [[contracts/get-lists-for-movie]]: `verifySession()`, select all `lists` ordered by name, select `movie_entries.listId` where `tmdbId` matches, return `{ id, name, alreadyInList }[]` (depends on T009)
- [ ] T013 [US2] Implement `addMovieToListWithOutcome(listId: string, movie: MovieSnapshot)` Server Action in `app/search/actions.ts` per [[contracts/add-movie-to-list-with-outcome]]: `verifySession()`, existence check on `lists`, then call the unmodified `addMovieToList` from `app/(lists)/[listId]/actions.ts:20` wrapped in try/catch, classifying the result per the contract's rules (depends on T010)
- [ ] T014 [US2] Implement `confirmAddToLists(listIds: string[], movie: MovieSnapshot)` Server Action in `app/search/actions.ts` per [[contracts/confirm-add-to-lists]]: single `verifySession()`, `Promise.allSettled` over `addMovieToListWithOutcome` per `listId`, zip each settled result back with its `listId` (depends on T013, T011)
- [ ] T015 [US2] Create `AddToListModal` client component in `app/search/AddToListModal.tsx`: native `<dialog>` (`showModal()`/`.close()`), fetch `getListsForMovie` exactly once in a `useEffect` keyed on `[isOpen, movie.tmdbId]` (FR-019), render one checkbox per list (already-in-list entries checked+disabled), a confirm button calling `confirmAddToLists` once with the checked-and-enabled `listId`s, and render the returned per-list success/failure report by joining each outcome's `listId` with the list name already held in the snapshot (list name + reason, FR-012/FR-023 — see data-model.md's "displayed shape", `listName` is never part of `confirmAddToLists`'s own return value); closing/canceling triggers no mutation (FR-015). Also render an `open/error` state when the initial `getListsForMovie` fetch itself fails (data-model.md's state diagram), with a retry action that simply re-invokes `getListsForMovie` — safe to re-fetch since no snapshot was ever established yet, per FR-019's carve-out clause (depends on T012, T014)
- [ ] T016 [US2] Wire the "Adicionar à lista" action in `app/search/GlobalMovieSearch.tsx` (T007) to open `AddToListModal` (T015) for the clicked result, replacing the US1 placeholder button (depends on T015)

**Checkpoint**: US1 + US2 together are fully functional — quickstart.md Scenarios 2, 5 (partial failure + retry-by-reopen), and 6 (cancel is a no-op) all pass.

---

## Phase 5: User Story 3 - See at a glance which lists already have the movie (Priority: P2)

**Goal**: Confirm the checked+disabled behavior already produced by US2's `getListsForMovie`/`AddToListModal` correctly covers every already-in-list combination (FR-010, FR-011, FR-022, SC-003).

**Independent Test**: Add a movie to one list, reopen "add to list" for it, confirm that list's checkbox is checked+disabled while others remain normal. (quickstart.md Scenario 3)

- [ ] T017 [US3] Extend `tests/integration/get-lists-for-movie.test.ts` (T009) with cases for a movie present in *some* lists (mixed `alreadyInList` true/false) and present in *every* list (all `alreadyInList: true`), confirming SC-003's "100% of already-containing lists shown checked+disabled" (depends on T012)
- [ ] T018 [US3] Extend `tests/integration/add-movie-to-list-with-outcome.test.ts` (T010) with a concurrency case: the list already contains the movie at call time (simulating a concurrent add by the other user between modal-open and confirmation) → asserts `{ status: "success" }`, not a duplicate error (FR-022) (depends on T013)

**Checkpoint**: All three FR-010/FR-011/FR-022 scenarios in quickstart.md Scenario 3 pass without any further production-code changes — the behavior was already built by US2; this phase only adds dedicated regression coverage for it.

---

## Phase 6: User Story 4 - Be guided to create a list when none exist yet (Priority: P3)

**Goal**: When zero lists exist, "add to list" prompts inline list creation (reusing `createList`'s validation) instead of an empty modal; after creating, the new list is immediately selectable without redoing the search (FR-013, FR-014, FR-024, FR-025, SC-004).

**Independent Test**: With zero lists in the workspace, search for a movie, trigger "add to list", confirm the modal prompts list creation rather than showing empty checkboxes; create a list and confirm it becomes immediately selectable. (quickstart.md Scenario 4)

- [ ] T019 [P] [US4] Modify `createList` in `app/(lists)/actions.ts:16-55` so its success path returns `{ id, name }` instead of `undefined`, by adding `.returning({ id: lists.id, name: lists.name })` to the existing insert — no `.error` field added, so `CreateListForm.tsx`'s existing `if (!result?.error)` check keeps working unmodified
- [ ] T020 [US4] Add a regression test to `tests/integration/lists.test.ts` asserting `createList`'s success return is now `{ id, name }` (not `undefined`) for a valid new list, while the existing error-path assertions (duplicate name, etc.) still pass unchanged (depends on T019)
- [ ] T021 [US4] Add an inline create-list path to `AddToListModal.tsx` (T015): when the `getListsForMovie` snapshot is empty, render a `createList` form via `useActionState` (mirroring `CreateListForm.tsx:9-18`, same validation/error strings per FR-024); on success, append `{ id, name, alreadyInList: false }` from the action's returned `{id, name}` to the modal's local snapshot state (no re-fetch, per FR-019/FR-025), so the new list is immediately checkable in the same modal instance (depends on T019, T015)

**Checkpoint**: All four user stories are independently functional — quickstart.md Scenario 4 passes end-to-end, including the empty/duplicate/too-long validation-error sub-cases (FR-024).

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Cross-cutting requirements that apply across all four stories (FR-016, FR-017, FR-018) plus final regression validation.

- [ ] T022 [P] Verify FR-016 (360px width, no horizontal scroll) on `app/search/page.tsx`, `GlobalMovieSearch.tsx`, and the open `AddToListModal.tsx`, per quickstart.md Scenario 7 step 1
- [ ] T023 [P] Verify FR-018 (fully keyboard-operable: Tab/Shift+Tab/Enter/Space/Escape) end-to-end through search → open modal → toggle checkboxes → confirm → close, per quickstart.md Scenario 7 step 2
- [ ] T024 [P] Verify FR-017 (all new UI text in pt-BR) across `AppHeader.tsx`, `GlobalMovieSearch.tsx`, `AddToListModal.tsx`
- [ ] T025 Run `npm test`, `npm run lint`, and `npm run build` and fix any failures across the new/modified files listed in this plan
- [ ] T026 Run the full `quickstart.md` validation (all 7 scenarios) end-to-end against a running `npm run dev` instance

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. BLOCKS all user stories (US1's `GlobalMovieSearch` and the refactored `MovieSearch.tsx` both need T002/T003).
- **US1 (Phase 3)**: Depends on Foundational. No dependency on US2/US3/US4.
- **US2 (Phase 4)**: Depends on Foundational. Its "wire the button" task (T016) depends on US1's T007, but US2's Server Actions (T012–T014) and modal (T015) have no US1 dependency and could be built in parallel with US1.
- **US3 (Phase 5)**: Depends on US2's T012/T013 (adds test coverage for behavior US2 already implements) — not independently implementable before US2.
- **US4 (Phase 6)**: Depends on Foundational only for `AddToListModal.tsx` to exist (T015 from US2) — T019/T020 (the `createList` change) have no US1/US2/US3 dependency and could be built in parallel with any of them.
- **Polish (Phase 7)**: Depends on US1–US4 all being complete.

### Parallel Opportunities

- T002 and T003 (Foundational) — different files.
- T005 (US1, AppHeader) can run parallel to T002/T003.
- T009, T010, T011 (US2 tests) — different files, no dependencies on each other.
- T019 (US4, `createList` change) can start any time after Setup — no dependency on US1/US2/US3 work.
- T022, T023, T024 (Polish) — independent verification passes.

---

## Parallel Example: Foundational + User Story 2 tests

```bash
# Foundational extraction (different files):
Task: "Extract useTmdbSearch hook in app/components/useTmdbSearch.ts"
Task: "Extract MovieResultCard component in app/components/MovieResultCard.tsx"

# User Story 2 tests (different files, write before implementation):
Task: "Integration test for getListsForMovie in tests/integration/get-lists-for-movie.test.ts"
Task: "Integration test for addMovieToListWithOutcome in tests/integration/add-movie-to-list-with-outcome.test.ts"
Task: "Integration test for confirmAddToLists in tests/integration/confirm-add-to-lists.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup (T001)
2. Phase 2: Foundational (T002–T004) — CRITICAL, blocks everything else
3. Phase 3: User Story 1 (T005–T008)
4. **STOP and VALIDATE**: quickstart.md Scenario 1 — `/search` reachable and usable, read-only
5. This is a legitimate demo/MVP checkpoint even though it delivers no list-mutation value yet (US2 is what makes the feature useful end-to-end)

### Incremental Delivery

1. Setup + Foundational → shared search UI ready
2. US1 → `/search` reachable, search works → demo (read-only MVP)
3. US2 → add-to-multiple-lists with per-list reporting → demo (feature now delivers its core value)
4. US3 → dedicated regression coverage for already-in-list checked/disabled state
5. US4 → guided list creation for the zero-lists edge case
6. Polish → 360px, keyboard, pt-BR, full quickstart pass

### Suggested MVP Scope

User Story 1 alone is a valid *demo* checkpoint (read-only search reachable from anywhere), but User Story 2 is what makes the feature deliver its stated value (turning search into shared-list additions) — treat **US1 + US2 together** as the practical MVP if only one increment can ship.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to its user story for traceability.
- No DB migration in this feature — all three new Server Actions read/write the existing `lists`/`movie_entries` tables (data-model.md).
- `addMovieToList`, `createList`'s validation logic, and `GET /api/tmdb/search` are reused unchanged — do not modify their behavior beyond T019's additive `{id, name}` return.
- Commit after each task or logical group; stop at any checkpoint to validate a story independently before moving to the next.
