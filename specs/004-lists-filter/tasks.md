---

description: "Task list for 004-lists-filter"
---

# Tasks: Filter Lists by Name on the Overview Page

**Branch**: `004-lists-filter` | **Input**: Design documents from `/specs/004-lists-filter/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Tests**: Included. plan.md's Testing section and research.md §4 explicitly call for a new integration test covering `getVisibleLists`/`hasAnyLists` against a real Postgres instance (FR-013/SC-005 is correctness-critical and not provable by types alone). No component-test task is included for `ListsFilterInput.tsx`/`page.tsx` layout — this project has no automated component-test coverage (CLAUDE.md); those are validated manually via quickstart.md in Phase 5.

**Organization**: Tasks are grouped by user story (spec.md's US1/US2) to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)

## Path Conventions

Single Next.js App Router project (no frontend/backend split). All paths are repository-root-relative, matching plan.md's Project Structure.

---

## Phase 1: Setup

No setup tasks required. This feature adds no new dependency and no schema change/migration (plan.md Technical Context; data-model.md) — it works entirely within the existing `app/(lists)/` route group and `lists` table.

---

## Phase 2: Foundational (Blocking Prerequisites)

No shared/blocking infrastructure beyond what User Story 1 builds directly. `getVisibleLists` (the one piece both stories ultimately depend on) is delivered as part of US1 below, per the Task Generation Rule "map each contract function to the user story it serves" — `hasAnyLists` is US2-specific and delivered there.

**Checkpoint**: Proceed directly to User Story 1.

---

## Phase 3: User Story 1 - Find a list by typing part of its name (Priority: P1) 🎯 MVP

**Goal**: Typing part of a list's name into a new filter input narrows the visible lists live, server-side, with the URL reflecting the current filter value via `replace()` (never `push()`).

**Independent Test**: With at least two existing lists with different names, type a substring unique to one list's name into the filter field and confirm only that list remains visible; clear the field and confirm all lists reappear (spec.md US1 Independent Test).

### Tests for User Story 1

> Write T001 first; it must fail (`getVisibleLists` doesn't exist yet) before starting T002.

- [ ] T001 [P] [US1] Integration test for `getVisibleLists` in `tests/integration/lists-filter.test.ts` — against `TEST_DATABASE_URL` (same pattern as `tests/integration/lists.test.ts`: `vi.mock("@/app/lib/dal")`, real `db` insert/select, `zz-test-` prefixed list names per the standing test-data rule). Cover: case-insensitive match (SC-002), accent-sensitivity (`"sessao"` does NOT match `"Sessão"`, spec.md Assumptions), literal `%`/`_`/`\` matching with no wildcard/escape interpretation (FR-013, SC-005), whitespace-only input treated as no filter (Edge Cases), `ORDER BY name ASC` unchanged in both branches (FR-011), and the unfiltered/empty-input branch returning all lists (contracts/lists-filter-query.md).

### Implementation for User Story 1

- [ ] T002 [US1] Implement `getVisibleLists(filterValue: string | undefined): Promise<{ id: string; name: string }[]>` in `app/(lists)/queries.ts` (new file) per `contracts/lists-filter-query.md`: trim input; empty/whitespace-only → `SELECT id, name FROM lists ORDER BY name ASC` (no `WHERE`, verified as a safe `.where(undefined)` no-op per research.md §7); non-empty → add `WHERE position(lower(trim($filterValue)) in lower(lists.name)) > 0` via a Drizzle `sql` template (same parameterized-interpolation pattern as `app/(lists)/actions.ts:42,93`). Makes T001 pass.
- [ ] T003 [P] [US1] Create `app/(lists)/ListsFilterInput.tsx` (new client component) per `contracts/lists-filter-url-param.md` and research.md §2/§3: `"use client"`; accepts `initialQuery: string` prop (no `useSearchParams()`, so no Suspense boundary needed); local `value` state initialized from `initialQuery`, updated on every keystroke; `useEffect` keyed on `value` debounces 400ms (matching `app/components/useTmdbSearch.ts`'s `DEBOUNCE_MS` `setTimeout`/`clearTimeout` shape) before calling `router.replace(trimmed ? \`/?q=${encodeURIComponent(trimmed)}\` : "/")` — `replace()` only, never `push()` (FR-005/FR-014). Visually-hidden pt-BR `<label>` (e.g. "Filtrar listas") + pt-BR `placeholder` (e.g. "Filtrar listas...") on the `<input>`, matching `CreateListForm`'s `sr-only` label pattern (FR-009).
- [ ] T004 [US1] Modify `app/(lists)/page.tsx`: change `ListsOverviewPage` to accept `searchParams: Promise<{ q?: string }>`; `await searchParams` and pass the raw `q` value to `getVisibleLists(q)` (from T002) instead of the current inline `db.select()...orderBy(asc(lists.name))` query; wrap `<CreateListForm />` and `<ListsFilterInput initialQuery={q ?? ""} />` (from T003) in a `grid gap-4 sm:grid-cols-2` container, `CreateListForm` first in DOM order, `ListsFilterInput` second with `order-first sm:order-none` (research.md §6 — filter appears above the form below `sm:`, right of the form at `sm:` and above); render the existing `ListRow` list using `visibleLists` in place of `allLists` (depends on T002, T003).
- [ ] T005 [P] [US1] Modify `app/(lists)/CreateListForm.tsx`: remove the form's own `mt-6` top margin class (spacing between the two grid columns/rows is now owned by the parent grid's `gap-4` from T004) — no change to form logic, fields, or Server Action wiring.

**Checkpoint**: User Story 1 is fully functional — typing narrows lists live, URL reflects the filter, Back button skips intermediate filter values, layout is 2-column on desktop / filter-first stacked on mobile.

---

## Phase 4: User Story 2 - No list matches the typed filter (Priority: P2)

**Goal**: When lists exist overall but none match the current filter, show a distinct pt-BR message instead of the "no lists at all" message.

**Independent Test**: With at least one existing list, type a filter value that matches no list name and confirm a "no results for this filter" message appears (not the "no lists created yet" message) (spec.md US2 Independent Test).

### Tests for User Story 2

- [ ] T006 [P] [US2] Integration test for `hasAnyLists` gating in `tests/integration/lists-filter.test.ts` (extends T001's file) per `data-model.md`'s page-level state table: `hasAnyLists()` returns `true`/`false` correctly, and is the correct signal for distinguishing "zero lists overall" (stale/bookmarked `?q=` on an empty workspace) from "lists exist but none match the filter" (quickstart.md Scenario 3).

### Implementation for User Story 2

- [ ] T007 [US2] Implement `hasAnyLists(): Promise<boolean>` in `app/(lists)/queries.ts` (extends T002's file) per `contracts/lists-filter-query.md`: `SELECT lists.id FROM lists LIMIT 1`, return whether a row was found. Makes T006 pass.
- [ ] T008 [US2] Modify `app/(lists)/page.tsx` (extends T004's change): when `visibleLists.length === 0`, branch on whether a filter is active — no filter active → keep existing "Nenhuma lista criada ainda." message unchanged (FR-011, US2 Acceptance Scenario 2); filter active → call `hasAnyLists()` (from T007): if `false`, still show "Nenhuma lista criada ainda." (a stale `?q=` on a zero-list workspace, research.md §5); if `true`, show a new, distinct pt-BR "no results for this filter" message (FR-007), with `CreateListForm` remaining visible and usable in all cases (depends on T004, T007).

**Checkpoint**: Both user stories work independently and together — filtering narrows results (US1) and the correct empty-state message shows when a filter matches nothing (US2).

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T009 [P] Run `npm test` (vitest — unit + integration projects), `npm run lint`, and `npm run build` (quickstart.md Automated checks) — confirm T001/T006 pass and no type errors across `queries.ts`, `ListsFilterInput.tsx`, `page.tsx`, `CreateListForm.tsx`.
- [ ] T010 Manually validate `quickstart.md` Scenarios 1–8 in a running `npm run dev:test` session (per project convention: never seed the DB manually) — narrow/clear (Scenario 1), case-insensitive/accent-sensitive matching (Scenario 2), no-match vs. zero-lists messaging (Scenario 3), literal `%`/`_`/`\` matching (Scenario 4), whitespace-only input (Scenario 5), URL reproducibility + single Back-press history behavior (Scenario 6), filter/create independence (Scenario 7), and 360px layout + keyboard operability + pt-BR label/placeholder (Scenario 8). Record exact concrete observations (viewport widths tested, DevTools history-entry count, specific list names/filter strings used) in the verification commit body per CLAUDE.md's verification-only-commit convention — no bare "pass"/"verified".

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** / **Foundational (Phase 2)**: No tasks — nothing blocks User Story 1 from starting immediately.
- **User Story 1 (Phase 3)**: No dependencies on other stories. T001 before T002 (test-first). T002 and T003 are parallel (different files). T004 depends on T002 + T003. T005 is parallel to T003/T004 (different file, independent edit).
- **User Story 2 (Phase 4)**: Depends on User Story 1 being complete — `hasAnyLists`'s branch in `page.tsx` (T008) extends the same `getVisibleLists`-driven render (T004) and `queries.ts` (T002) that US1 delivers. T006 before T007 (test-first). T008 depends on T004 + T007.
- **Polish (Phase 5)**: Depends on both user stories being complete.

### Parallel Opportunities

- T001 (US1 test) has no code dependency and can be written immediately.
- T002 and T003 can run in parallel once T001 exists (different files: `queries.ts` vs. `ListsFilterInput.tsx`).
- T005 can run in parallel with T003/T004 (different file: `CreateListForm.tsx`).
- T006 (US2 test) can be written any time after T001's test file exists.

---

## Parallel Example: User Story 1

```bash
# After T001 (test) is written and failing:
Task: "Implement getVisibleLists in app/(lists)/queries.ts"
Task: "Create ListsFilterInput.tsx client component"

# Independent of the above, any time:
Task: "Remove CreateListForm's own mt-6 top margin"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Skip Phase 1/2 (no tasks).
2. Complete Phase 3: User Story 1 (T001–T005).
3. **STOP and VALIDATE**: Independently test US1 (type to narrow, clear to restore, URL reproducibility, Back-button behavior, 2-column layout).
4. This is a deployable MVP — the empty-filter-result message (US2) can ship as a fast-follow.

### Incremental Delivery

1. User Story 1 (T001–T005) → validate → deploy/demo (MVP).
2. User Story 2 (T006–T008) → validate → deploy/demo.
3. Polish (T009–T010) → final verification.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- T001 and T006 must fail before their corresponding implementation task, then pass after.
- Total: 10 tasks (US1: 5, US2: 3, Polish: 2).
