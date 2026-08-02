# Quickstart: Validating the Lists Filter

## Prerequisites

- `npm run dev:test` running (`TEST_DATABASE_URL`, `teste@teste.com` / `teste123` — do not seed manually, per `specs/notes.md`'s standing DB-safety rule).
- At least two lists with clearly distinguishable names, e.g. `zz-test-Halloween marathon` and `zz-test-Date night` (prefixed per the standing test-data rule so they're identifiable as agent-created).
- At least one list whose name contains a literal `%`, `_`, or `\` character for Scenario 4, e.g. `zz-test-100%_classics\`.

## Scenario 1 — Type to narrow, clear to restore (User Story 1 / FR-003, FR-004, FR-008, SC-001)

1. On the overview page, type `hallo` into the filter field.
2. Confirm only `zz-test-Halloween marathon` remains visible, updating as each character is typed — no submit action, no visible loading spinner (FR-012).
3. Clear the field entirely; confirm all lists reappear in alphabetical order (FR-008, FR-011 — order unchanged).

## Scenario 2 — Case-insensitive, accent-sensitive (FR-003, SC-002)

1. Type `NIGHT` (uppercase); confirm `zz-test-Date night` still matches (case-insensitive).
2. If a list name containing an accented character is available (e.g. one named with "Sessão"), type `sessao` (no accent) and confirm it does **not** match — accent-sensitive by design (spec.md Assumptions; [[research]] §1).

## Scenario 3 — No match vs. zero lists overall (User Story 2 / FR-007)

1. With the test lists from Prerequisites present, type a filter value that matches none of them (e.g. `zzzznomatch`).
2. Confirm a distinct pt-BR message appears (not "Nenhuma lista criada ainda.") and the create-list form remains usable below it.
3. Separately, verify the zero-lists-overall message is unchanged: this is best checked by reading `app/(lists)/queries.ts`'s `hasAnyLists` gating logic ([[data-model]]) and/or the integration test covering it (T-series, see Automated checks below) rather than by emptying the shared test database — do not delete other lists to force this state.

## Scenario 4 — Literal `%`, `_`, `\` matching (Edge Cases, FR-013, SC-005)

1. Type `%` alone into the filter field; confirm it matches **only** `zz-test-100%_classics\` (or whichever prefixed list contains a literal `%`) — not every list, which is what would happen if `%` were misinterpreted as an `ILIKE` wildcard.
2. Type `_c` (containing a literal underscore); confirm the same literal-match behavior — it should match only names actually containing `_c`, not "any single character followed by c."
3. If feasible, type a filter containing a literal backslash and confirm it's matched literally, not treated as an escape character.

## Scenario 5 — Whitespace-only filter (Edge Cases)

1. Type a single space (or a few spaces) into the filter field with no other characters.
2. Confirm this behaves identically to an empty filter — all lists remain visible, not zero.

## Scenario 6 — URL reproducibility and Back-button behavior (FR-005, FR-014, SC-003)

1. Type a filter value, wait for it to settle (~400ms after the last keystroke), and confirm the browser's address bar shows `?q=<value>`.
2. Reload the page via browser refresh; confirm the same filtered view is restored on load, with the filter field pre-populated.
3. Copy the URL, open it in a new tab (or paste after clearing); confirm the same filtered view appears.
4. Starting from a different page (e.g. click a header nav link to get to the overview page fresh), type a filter value on the overview page, let it settle, then press the browser's Back button **once**. Confirm you land on the page you came from — not on the overview page with an earlier, less-filtered `q` value. Open DevTools and confirm no more than one history entry was added for the entire typing session (or check via repeated Back presses that typing several characters only ever required one Back press to leave the page, not one per keystroke).

## Scenario 7 — Independence from list creation (Edge Cases)

1. With a filter active that doesn't match a name you're about to create, create a new list via the create-list form using a name that doesn't match the current filter.
2. Confirm the list is created successfully (e.g. visible after clearing the filter) but does not appear while the non-matching filter is still active.

## Scenario 8 — Layout, responsiveness, keyboard (FR-001, FR-002, FR-009, FR-010, SC-004)

1. At a desktop viewport width, confirm the create-list form is on the left and the filter input is on the right, both visible without needing to scroll or interact.
2. Resize to 360px width; confirm the filter input now appears above the create-list form (stacked), and there is no horizontal scrolling anywhere on the page (`document.documentElement.scrollWidth === clientWidth`).
3. Using only the keyboard (Tab/Shift+Tab), confirm the filter input is reachable, typeable, and clearable (e.g. Ctrl+A then Delete, or repeated Backspace) without a mouse.
4. Confirm the filter input carries a pt-BR visually-hidden label and a pt-BR placeholder (inspect via accessibility tree or screen reader, not just visually).

## Automated checks

```bash
npm test        # vitest run — unit + integration projects
npm run lint
npm run build    # confirms no type errors across new/modified files
```

Relevant new/updated test files to look for once implemented (see tasks.md): an integration test file (e.g. `tests/integration/lists-filter.test.ts`) exercising `getVisibleLists`/`hasAnyLists` directly against `TEST_DATABASE_URL` — covering case-insensitivity, accent-sensitivity, literal `%`/`_`/`\` matching (SC-005), whitespace-only input, and the `hasAnyLists` gating behavior from [[data-model]]'s page-level state table — since these DB-level correctness properties are the ones a browser walkthrough alone can't exhaustively prove.
