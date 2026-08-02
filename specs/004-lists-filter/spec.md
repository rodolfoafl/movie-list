# Feature Specification: Filter Lists by Name on the Overview Page

**Feature Branch**: `004-lists-filter`

**Created**: 2026-08-01

**Status**: Draft

**Input**: User description: "Add a name filter to the lists overview page (app/(lists)/page.tsx), restructured into a 2-column layout: on desktop, the create-list form is on the left and a new \"Filtrar Listas...\" name-filter input is on the right; on narrow/mobile viewports where the columns stack into one, the filter input stacks first (on top) and the create-list form second. This is legacy parity with the original 2020 app's lists overview, which had this exact 2-column layout (see GitHub issue #9). Filter behavior: case-insensitive substring match on list name, live as-you-type with debounce (matching the original app's live-filter UX). Typing updates a URL search param (e.g. ?q=), and the page re-queries server-side with a SQL WHERE clause filtering by name. Non-goals: no change to list creation, deletion, or any other existing FR. No loading-spinner UI for the filter. No change to list ordering (stays alphabetical). Requirements: case-insensitive substring match; responsive down to 360px width with no horizontal scroll; full keyboard operability; pt-BR labels/placeholder text; empty-filter-result state needs a pt-BR message distinct from the existing empty-list-overall message."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find a list by typing part of its name (Priority: P1)

A user with several lists on the overview page wants to jump to one of them
without visually scanning the full list. They type part of the list's name
into a filter field, and the visible list of lists narrows to only those
whose name contains what they typed, updating as they type.

**Why this priority**: This is the entire feature — the value only exists
once typing narrows the visible lists. It also restores a capability the
original app had that this rebuild has never had, closing the last
overview-page parity gap called out in `specs/notes.md`.

**Independent Test**: With at least two existing lists with different names,
type a substring unique to one list's name into the filter field and confirm
only that list remains visible; clear the field and confirm all lists
reappear.

**Acceptance Scenarios**:

1. **Given** the overview page has lists "Halloween marathon" and "Date
   night", **When** the user types "hallo" into the filter field, **Then**
   only "Halloween marathon" remains visible in the list.
2. **Given** the same two lists, **When** the user types "NIGHT" (uppercase),
   **Then** only "Date night" remains visible (match is case-insensitive).
3. **Given** a filter has narrowed the visible lists, **When** the user
   clears the filter field entirely, **Then** all lists reappear in their
   original alphabetical order.
4. **Given** the user has typed a filter value, **When** they reload the
   page (e.g. via browser refresh) or share the URL, **Then** the same
   filtered view is restored from the URL.

---

### User Story 2 - No list matches the typed filter (Priority: P2)

A user types a filter value that doesn't match any existing list name and
needs clear feedback that nothing matched, distinct from the feedback shown
when the user has no lists at all.

**Why this priority**: Without this, a user who mistypes or over-narrows
their filter sees a blank area indistinguishable from "you have zero lists,"
which is confusing given they know lists exist.

**Independent Test**: With at least one existing list, type a filter value
that matches no list name and confirm a "no results for this filter" message
appears (not the "no lists created yet" message).

**Acceptance Scenarios**:

1. **Given** the overview page has at least one list, **When** the user
   types a filter value matching no list name, **Then** a pt-BR message
   distinct from the zero-lists-overall message is shown, and the create-list
   form remains usable.
2. **Given** the overview page has zero lists at all, **When** the page
   loads with no filter applied, **Then** the existing "Nenhuma lista criada
   ainda." message is shown (unchanged from current behavior).

---

### Edge Cases

- What happens when the filter field contains only whitespace? Treated as
  empty for matching purposes (does not filter to zero results by matching a
  literal space in list names) — leading/trailing whitespace is trimmed
  before matching.
- What happens when a list name contains characters with special meaning in
  a substring/pattern search (e.g. `%`, `_`)? These must be matched
  literally, not treated as wildcards.
- What happens if the user creates a new list while a filter is active and
  the new list's name doesn't match the current filter? The new list is
  created successfully but does not appear in the (still-filtered) visible
  list, since it doesn't match — the create-list form and the filter operate
  independently.
- What happens when the user navigates to the overview page with a `?q=`
  value already in the URL (e.g. a bookmarked or shared link)? The filter
  field is pre-populated with that value and the list is pre-filtered
  accordingly on first render, with no extra user action required.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The overview page MUST present the create-list form and a new
  name-filter input as two distinct, always-visible controls (2-column
  layout on wide viewports: create-list form on the left, filter input on
  the right).
- **FR-002**: On viewports narrow enough that the 2-column layout collapses
  to a single column, the filter input MUST appear above the create-list
  form.
- **FR-003**: The filter input MUST narrow the visible lists to only those
  whose name contains the typed text as a case-insensitive substring match.
- **FR-004**: Filtering MUST update live as the user types, without
  requiring an explicit submit action (e.g. pressing Enter or a button).
- **FR-005**: The current filter value MUST be reflected in the page's URL
  as a query parameter, such that reloading the page or sharing the URL
  reproduces the same filtered view.
- **FR-006**: List matching MUST be performed server-side (the candidate set
  of lists is narrowed by the query itself, not fetched in full and filtered
  in the browser).
- **FR-007**: When lists exist overall but none match the current filter
  value, the page MUST show a pt-BR message indicating no lists match the
  filter, distinct from the existing message shown when zero lists exist at
  all.
- **FR-008**: Clearing the filter input MUST restore the full, unfiltered
  list of lists in their existing alphabetical order.
- **FR-009**: The filter input MUST be fully operable via keyboard alone
  (focusable in a logical tab order, typeable, clearable) and MUST carry a
  pt-BR label associated with it (visually hidden label plus a pt-BR
  placeholder, matching the existing `CreateListForm` input's pattern).
- **FR-010**: The 2-column layout and filter input MUST remain usable with
  no horizontal scrolling at a 360px viewport width.
- **FR-011**: The filter MUST NOT alter list creation, list deletion, list
  ordering (alphabetical), or any other existing overview-page behavior.
- **FR-012**: The filter MUST NOT display a loading indicator/spinner while
  narrowing results.
- **FR-013**: Substring matching MUST treat pattern-special characters in
  either the filter text or list names as literal characters, not as
  wildcards.

### Key Entities

- **List** (existing entity, no schema change): the name-filter operates on
  the already-existing `name` attribute of a list; no new entity or
  attribute is introduced by this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user with 10+ lists can narrow to a single target list by
  typing 3-5 characters of its name, with the visible list updating within
  the same interaction (no manual refresh or submit needed).
- **SC-002**: 100% of substring matches are case-insensitive (typing any
  casing of a substring present in a list name surfaces that list).
- **SC-003**: The filtered view is fully reproducible from the URL alone —
  loading a URL with a filter value produces the same visible lists as
  typing that value manually, with zero exceptions.
- **SC-004**: The overview page remains fully usable (no horizontal
  scrolling, both controls reachable and operable by keyboard) at a 360px
  viewport width.

## Assumptions

- The debounce delay for live filtering is an implementation detail with no
  user-facing correctness requirement beyond "feels immediate"; exact
  timing is decided at plan time, not spec time.
- "Filtrar listas..." (or equivalent pt-BR wording) is an acceptable
  placeholder/label text; exact copy is finalized at implementation time to
  match the app's existing tone (e.g. `CreateListForm`'s "Nome da nova
  lista").
- No maximum length restriction is placed on the filter input itself (unlike
  the list-name `maxLength={60}` on creation) since it's matching against
  already-stored names, not producing new data.
- This feature does not need its own database migration or new column —
  filtering reuses the existing `lists.name` column.
