# Quickstart: Validating Global Movie Search

## Prerequisites

- `.env.local` with a working DB connection and TMDB credentials (same as the rest of the app — see repo README).
- `npm run dev` running.
- At least one seeded user (`npm run seed:users:test -- --email qa@example.com --password <pw>` if needed) and a logged-in session.

## Setup

```bash
npm run dev
```

## Scenario 1 — Reach and use global search (User Story 1 / FR-001–FR-006, SC-001)

1. From any page (`/`, or a list's `/[listId]` page), click "Buscar filmes" in the header.
2. Confirm the page loads at `/search` without having opened any list first.
3. Type a known movie title (e.g. "Matrix"); confirm results appear after a brief pause (not per keystroke) with poster/title/year/overview, matching the look of the in-list search on a list's detail page.
4. Type a nonsense query (e.g. "zzxxqq123"); confirm a friendly empty state, not an error.
5. Simulate a TMDB outage (e.g. temporarily break `TMDB_API_KEY` in `.env.local` and restart dev server) and search again; confirm a retry-capable message appears and the page does not crash. Restore the key afterward.

## Scenario 2 — Add to multiple lists at once (User Story 2 / FR-007–FR-012)

Prerequisite: at least 2 lists exist (create via `/`).

1. Search for a movie, click its "Adicionar à lista" action.
2. Confirm the modal lists every existing list as its own checkbox.
3. Check 2+ lists, confirm.
4. Confirm the movie now appears in every checked list (verify via each list's `/[listId]` page).
5. Reopen the modal for the same movie; confirm those lists now show checked + disabled (Scenario 3 below covers this in more detail).

## Scenario 3 — Already-in-list checkboxes (User Story 3 / FR-010, FR-011, FR-022, SC-003)

1. With the movie already added to one list (from Scenario 2), reopen "Adicionar à lista" for it.
2. Confirm that list's checkbox is checked and cannot be unchecked (disabled), while other lists remain normal unchecked checkboxes.
3. Check an additional (previously unchecked) list and confirm; verify the movie is now in that list too, and the already-containing list was left untouched (no duplicate error surfaced).
4. Concurrency check: with the modal open and a list unchecked, add the same movie to that list from a second browser/session (simulating the other user), then confirm in the first modal with that list checked — expect a **success** outcome reported for it (FR-022), not a duplicate error.

## Scenario 4 — No lists yet, guided creation (User Story 4 / FR-013, FR-014, FR-024, FR-025, SC-004)

Prerequisite: a workspace with zero lists (fresh DB, or delete all lists via `/`).

1. Search for any movie, click "Adicionar à lista".
2. Confirm the modal prompts list creation instead of showing empty checkboxes.
3. Try creating a list with an empty name, a name over 60 characters, and a name duplicating an existing one (case/whitespace-insensitive) — confirm each shows the same inline error text as the primary list-creation flow on `/`, without leaving the modal.
4. Create a valid list; confirm it becomes immediately selectable in the same modal (no re-search needed), check it, and confirm the movie is added.

## Scenario 5 — Partial failure and retry (FR-012, FR-020, FR-021, FR-023)

1. Check 2+ lists in the modal, including one that another session deletes *after* the modal opened but *before* confirmation.
2. Confirm; expect a per-list report: the deleted list shows failure with reason "Lista não existe mais.", the other(s) show success.
3. Reopen the modal for the same movie (FR-020's retry path); confirm the deleted list no longer appears at all (fresh snapshot), and previously-succeeded lists show checked+disabled.

## Scenario 6 — Cancel is a no-op (FR-015, Edge Cases)

1. Open the modal, check a list, close/cancel without confirming (Escape key or a cancel control).
2. Confirm no list changed — reopen and verify the list is still unchecked.

## Scenario 7 — Responsive & keyboard-only (FR-016, FR-018, SC-005)

1. Resize the browser (or use device emulation) to 360px width; repeat Scenarios 1–2 and confirm no horizontal scrolling and all actions remain reachable.
2. Using only the keyboard (Tab/Shift+Tab/Enter/Space/Escape), complete Scenario 2 end-to-end: focus the search input, reach a result's "add to list" action, move focus into the modal, toggle checkboxes, confirm, and close — without a mouse.

## Scenario 8 — Modal snapshot-fetch failure (FR-019's carve-out, data-model.md's `open/error` state)

1. Search for a movie, click its "Adicionar à lista" action.
2. Simulate a failure of the `getListsForMovie` snapshot fetch (e.g., temporarily break the DB connection string in `.env.local` and restart the dev server, or throw inside `getListsForMovie` locally), then trigger "Adicionar à lista" again.
3. Confirm the modal shows a retry-capable error state instead of an empty or broken checkbox list, and the page does not crash.
4. Click retry; confirm the same `getListsForMovie` call re-runs (this is safe and expected — no snapshot was ever established yet, so this is not a violation of FR-019, which only forbids re-fetching an *already-established* snapshot).
5. Restore the DB connection and confirm the modal now loads the checkbox list normally.

## Automated checks

```bash
npm test        # vitest run — unit + integration projects
npm run lint
npm run build    # confirms no type errors across new app/search/* files
```

Relevant new/updated test files to look for once implemented (see tasks.md): integration tests for `getListsForMovie` (snapshot correctness, including zero-lists case), `addMovieToListWithOutcome` (success, already-in-list-as-success, deleted-list-as-failure, generic-failure), and `confirmAddToLists` (single `verifySession()` call regardless of list count, `listId` correctly zipped onto each outcome, empty-array no-op), plus a `createList` regression test confirming its success return now includes `{id, name}` without breaking `CreateListForm.tsx`'s existing `.error`-only check.
