# Feature Specification: Global Movie Search

**Feature Branch**: `002-global-search`

**Created**: 2026-07-27

**Status**: Draft

**Input**: User description:

```text
Build a global movie search page for the shared movie
watchlist app, reachable from anywhere in the app (independent of any single
list's detail page — unlike the existing in-list search).

Behavior:
- A search page/section where the user searches TMDB by title, same search
  experience as the existing in-list search (debounced, showing poster/title/
  year/overview, friendly empty state, retry-capable message if TMDB is down).
- Each search result has an "Add to list" action. This opens a MODAL listing
  every existing list as a checkbox (not a single-select dropdown) — the user
  can check any number of lists and add the movie to all of them in one
  confirmation.
- If a list already contains the movie (per the existing per-list duplicate
  rule), that list's checkbox appears already-checked and disabled in the
  modal, rather than allowing a silent re-add or duplicate error.
- If no lists exist yet, the modal should prompt the user to create one first
  instead of showing an empty checkbox list.
- Reuses the existing TMDB search route handler — no new external API
  integration.

This is a new capability alongside the existing in-list search (spec.md's
original FR-010 scope, which modeled search as in-list-only, is unchanged and
still valid for that flow).
```

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Search for a movie from anywhere in the app (Priority: P1)

A signed-in user, without first opening any specific list, navigates to a dedicated search page and searches by title, seeing the same familiar result cards (poster, title, release year, short overview) they already know from in-list search.

**Why this priority**: Today, search only exists inside a list's detail page, forcing the user to pick a destination list before they can even see if a movie exists. A destination-agnostic search page is the foundational capability every other story in this feature depends on.

**Independent Test**: Can be fully tested by navigating to the search page directly (without opening any list first), typing a known movie title, and confirming matching results render with poster/title/year/overview; typing a nonsense query shows a friendly empty state; and simulating a search-backend failure shows a retry-capable message without crashing the page.

**Acceptance Scenarios**:

1. **Given** a signed-in user on any page of the app, **When** they navigate to the search page, **Then** the page loads independent of any specific list context (no list needs to be open or selected first).
2. **Given** the search page, **When** the user types a movie title, **Then** results are fetched after a brief typing pause (debounced) rather than on every keystroke, and each result shows a poster (or placeholder), title, release year, and short overview.
3. **Given** a search with no matching movies, **When** results load, **Then** a friendly empty state is shown (never a raw error).
4. **Given** the movie search backend is unavailable or rate-limited, **When** the user searches, **Then** a retry-capable message is shown and the page does not crash.

---

### User Story 2 - Add a search result to one or more lists at once (Priority: P1)

From a search result, a signed-in user opens an "add to list" action that presents every one of their existing lists as an independent checkbox, checks as many as they want, and confirms once to add the movie to all of them in a single action.

**Why this priority**: This is the core value the feature adds over simply looking at search results — turning a global search into shared-list additions without requiring the user to repeat the search from within each target list. Without it, Story 1 is read-only and delivers no new capability beyond browsing.

**Independent Test**: Can be fully tested by searching for a movie, opening its "add to list" action, checking two or more lists, confirming, and verifying the movie now appears in every checked list.

**Acceptance Scenarios**:

1. **Given** a search result and at least one existing list, **When** the user triggers its "add to list" action, **Then** a modal opens showing every existing list as its own checkbox (not a single-choice control).
2. **Given** the modal is open, **When** the user checks multiple lists and confirms, **Then** the movie is added to every checked list in one confirmation step.
3. **Given** the modal is open, **When** the user closes it without confirming, **Then** no list is changed.
4. **Given** the movie was successfully added to some but not all of the checked lists (e.g., one target list fails while others succeed), **When** the confirmation completes, **Then** the user is told exactly which lists succeeded and which did not, and can retry the failed ones without re-adding to the lists that already succeeded.

---

### User Story 3 - See at a glance which lists already have the movie (Priority: P2)

While the "add to list" modal is open, a signed-in user sees that any list already containing the searched movie is shown checked and locked, so they understand it's already there rather than being invited to re-add it or hitting a duplicate error.

**Why this priority**: This directly reuses the app's existing per-list duplicate-prevention rule and prevents a confusing "add" action that silently does nothing or errors on lists that already have the movie. It refines Story 2 but Story 2 still delivers value without it (a duplicate could otherwise just be rejected per list).

**Independent Test**: Can be fully tested by adding a movie to one list from the search page, then reopening the "add to list" modal for the same movie and confirming that list's checkbox is pre-checked and cannot be unchecked, while other lists remain normal, unchecked checkboxes.

**Acceptance Scenarios**:

1. **Given** a movie already present in one of the user's lists, **When** the "add to list" modal opens for that movie, **Then** that list's checkbox is shown checked and disabled (not editable).
2. **Given** a movie already present in every existing list, **When** the modal opens, **Then** all checkboxes are checked and disabled, and it is clear to the user there is nothing left to add.
3. **Given** a movie present in some lists and not others, **When** the user confirms after checking additional (previously unchecked) lists, **Then** the movie is added only to the newly checked lists; already-containing lists are left untouched and produce no duplicate error.

---

### User Story 4 - Be guided to create a list when none exist yet (Priority: P3)

A signed-in user with no lists yet triggers "add to list" from a search result and is prompted to create a list first, instead of being shown a modal with nothing in it.

**Why this priority**: This is a necessary guardrail for a new account's first use of the feature, but it only affects the empty-lists edge case — the primary flows (Stories 1-3) assume at least one list already exists, which is the common case for an app that already requires lists to hold movies.

**Independent Test**: Can be fully tested with zero lists in the shared workspace: searching for a movie, triggering "add to list", and confirming the modal prompts list creation rather than displaying an empty checkbox list.

**Acceptance Scenarios**:

1. **Given** no lists currently exist, **When** the user triggers "add to list" on a search result, **Then** the modal prompts the user to create a list first instead of showing an empty set of checkboxes.
2. **Given** the user creates a list from that prompt, **When** the list is created, **Then** the user can proceed to check it (and any further lists created afterward) and add the movie without re-searching.

---

### Edge Cases

- What happens if the set of lists changes (a list is created or deleted by either user) while the "add to list" modal is already open? The modal reflects the lists that existed when it opened; the user must reopen it to see newly created or removed lists.
- What happens if the user opens the modal, makes no new selection (only the already-checked, disabled entries are checked), and confirms? Confirming is a no-op with no lists changed; the system does not treat this as an error.
- What happens if a movie is already present in every existing list and the user opens "add to list"? All checkboxes appear checked and disabled, communicating that the movie is already everywhere with nothing further to add.
- What happens when the search query matches no movies? A friendly empty state is shown, identical in spirit to the in-list search's empty state.
- How does the global search page behave on a narrow (360px) screen? All results, the "add to list" action, and the modal's checkboxes and confirmation remain visible and usable without horizontal scrolling.
- What happens if the user is mid-search (results visible) and navigates away without adding anything? No data is changed; nothing is persisted from an unconfirmed search or unconfirmed modal state.
- If the user confirms with no newly-checked (non-disabled) lists selected, this is a no-op and MUST NOT be reported as a failure — FR-012's per-list reporting applies only to lists the user actually attempted to add to in that confirmation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a search page reachable from anywhere in the app, without requiring the user to first open or select any specific list.
- **FR-002**: The global search page MUST let users search movies by title, with results debounced (fetched after a brief pause in typing rather than per keystroke).
- **FR-003**: Each global search result MUST display a poster (or placeholder), title, release year, and short overview, matching the existing in-list search's result presentation.
- **FR-004**: System MUST display a friendly empty state when a global search returns no matches, never a raw error.
- **FR-005**: System MUST display a retry-capable message, without crashing the page, when the movie search service is unavailable or rate-limited.
- **FR-006**: System MUST reuse the existing movie search backend for global search; this feature MUST NOT introduce a second, separate external search integration.
- **FR-007**: Each global search result MUST offer an "add to list" action.
- **FR-008**: Triggering "add to list" MUST open a modal presenting every existing list as its own independent checkbox, allowing the user to select any number of lists (not a single-choice/dropdown control).
- **FR-009**: Confirming the modal MUST add the movie to every currently-checked, currently-enabled list in one confirmation step.
- **FR-010**: For any list that already contains the movie (per the existing per-list duplicate rule), that list's checkbox in the modal MUST appear checked and disabled, so the user cannot uncheck it or trigger a duplicate-add on it.
- **FR-011**: Confirming the modal MUST NOT produce a duplicate-entry error for lists that already contained the movie; those lists are simply left unchanged.
- **FR-012**: If adding the movie succeeds for some checked lists and fails for others during a single confirmation, the system MUST report per-list success/failure to the user rather than a single all-or-nothing message, and MUST NOT re-attempt or duplicate the additions that already succeeded on a retry.
- **FR-013**: When no lists currently exist, triggering "add to list" MUST prompt the user to create a list first, instead of opening a modal with zero checkboxes.
- **FR-014**: After a list is created from that prompt, the user MUST be able to continue and select it (and any other existing lists) to add the movie, without needing to redo the search.
- **FR-015**: Closing or canceling the modal without confirming MUST leave all lists and movie entries unchanged.
- **FR-016**: The global search page and its "add to list" modal MUST remain fully usable, with no loss of content or actions, on a 360px-wide screen.
- **FR-017**: All UI text introduced by this feature MUST be presented in Portuguese (pt-BR), consistent with the rest of the app.
- **FR-018**: All actions introduced by this feature (searching, opening the modal, checking/unchecking a list, confirming, canceling, the create-a-list prompt) MUST be operable using only a keyboard.
- **FR-019**: The modal's list set and each list's checked/disabled state MUST NOT be re-fetched or live-updated while the modal remains open; both reflect a snapshot taken at the moment the modal opens (promotes the existing Assumption to a testable requirement).
- **FR-020**: Retrying a failed per-list add MUST be done by reopening the "add to list" modal for that movie — which recomputes every list's checked/disabled state from current data per FR-010 — and confirming again (governed by the same FR-009 confirmation behavior). No separate retry mechanism, retry button, or retry-specific state is required.
- **FR-021**: If a list shown in the modal was deleted between modal-open and confirmation, attempting to add the movie to it MUST be reported as a per-list failure (reason: list no longer exists), and MUST NOT abort or fail the confirmation for the other checked lists.
- **FR-022**: If the movie was already added to a checked list by a concurrent action (e.g., the other user) between modal-open and confirmation, this MUST be treated as a per-list SUCCESS (the desired end state — movie present in that list — already holds), not a duplicate error.
- **FR-023**: Per-list failure reports (FR-012) MUST include the list's name and a short human-readable reason (e.g., "lista não existe mais", "não foi possível adicionar, tente novamente").
- **FR-024**: The create-list-from-modal path (FR-013) MUST enforce the same validation as the primary list-creation flow: non-empty after trim (existing FR-004 semantics from 001-movie-watchlist), maximum 60 characters (existing FR-026), and case/whitespace-insensitive duplicate rejection (existing FR-005) — using the same inline error messaging style as the primary flow.
- **FR-025**: The create-list prompt (FR-013) MUST be presented INLINE within the same "add to list" modal (not a navigation away from the search page), so that after successful creation the user can immediately select the new list and confirm without redoing the search (FR-014). If list creation itself fails validation (FR-024), the user MUST remain in the same modal/context to correct it.

### Key Entities

- **Search Result**: A movie candidate returned by the movie search service for a given title query; carries the same external movie identifier, title, poster, release year, and overview used by the existing in-list search.
- **List Selection (modal state)**: The set of existing lists shown as checkboxes when "add to list" is triggered for a given movie, each marked as either already-containing (checked, disabled) or available (unchecked, editable), scoped to a single open instance of the modal.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from any page in the app to viewing search results for a movie title in under 10 seconds, without first opening any list.
- **SC-002**: A user can add one movie to 3 different lists in a single confirmation, in under 20 seconds total from triggering "add to list."
- **SC-003**: 100% of lists that already contain the searched movie are shown checked and disabled in the modal, with zero duplicate-entry errors surfaced to the user across testing.
- **SC-004**: When no lists exist, 100% of "add to list" attempts route the user to list creation instead of displaying an empty, actionless modal.
- **SC-005**: The global search page and its modal remain fully usable, with no loss of content or actions, on a 360px-wide screen.
- **SC-006**: When the movie search backend is unavailable, the user sees a clear retry message and can still navigate the rest of the app without the page crashing.

## Assumptions

- The global search page is a new, top-level entry point distinct from the existing in-list search inside a list's detail page; the in-list search's own behavior and its original requirement (searching from within a specific list) are unchanged and remain valid for that flow.
- Global search reuses the same underlying movie search backend and duplicate-prevention rule (same movie, same list) that in-list search already relies on; no new external search integration is introduced.
- "Every existing list" in the "add to list" modal means every list visible in the shared workspace (all lists are shared between the two users, per the existing app model); there is no per-user list filtering.
- The set of lists shown in an open modal is a snapshot taken when the modal opens; concurrent list creation/deletion by the other user while the modal is open is reflected only the next time the modal is opened, not live.
- Partial failure during a multi-list confirmation (some lists succeed, some fail) is possible (e.g., transient errors) and must be communicated per-list; this feature does not require an all-or-nothing (fully atomic) guarantee across lists.
- No new navigation/menu system is assumed beyond providing a reachable link or entry point to the search page from other pages in the app; the exact placement of that entry point is a presentation detail decided in the planning phase.
- Retries are manual only: the user re-triggers the flow by reopening the modal. There is no automatic retry, no retry limit, and no time-based staleness limit on how long a modal may remain open before confirming — acceptable given the app's 2-user, low-concurrency scale (consistent with the base app's existing last-write-wins model; this feature does not introduce a stricter consistency guarantee than the rest of the app).
- A per-list add attempt has exactly three possible outcomes when a confirmation completes: success (inserted, or already present via FR-022), failure (FR-021 and other transient errors), or not-attempted (list was already checked-disabled at modal-open and untouched by this confirmation).
