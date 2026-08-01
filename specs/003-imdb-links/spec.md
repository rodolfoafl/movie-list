# Feature Specification: IMDb Links on Movie Cards

**Feature Branch**: `003-imdb-links`

**Created**: 2026-07-31

**Status**: Draft

**Input**: User description:

```text
Add IMDb links to movie cards, in two places:

1. Movie entries already in a list (list detail page): each entry gets a
   plain-text "IMDb" link to the movie's IMDb page, opening in a new tab.
2. Search result cards (both the in-list search and the global search from
   002-global-search, which share MovieResultCard): same plain-text "IMDb"
   link, shown even for movies not yet added to any list.

Link style: plain text "IMDb" label only — no logo/branding, to avoid
trademark concerns. Opens in a new tab (target="_blank" rel="noopener").

Data: movie_entries (001-movie-watchlist's schema) gains a nullable
imdb_id column, fetched from TMDB (GET /movie/{id}?append_to_response=
external_ids) at add-time, inside the existing addMovieToList flow. If
the fetch fails or times out, the movie is still added normally and
imdb_id stays NULL — this must not block or fail the add action. A
backfill migration script (same shape as scripts/migrate-legacy.ts:
sequential, rate-limited, idempotent, an orphan/failure report at the
end) populates imdb_id for every existing movie_entries row, including
the 582 entries brought over by the earlier legacy-data migration.

For search results (not yet added movies): each rendered result needs its
own IMDb id lookup, which is an ADDITIONAL TMDB call per result on top of
the existing search call — unlike the add-time fetch, this multiplies
TMDB call volume by the number of results shown per query (up to the
existing 10-result cap from 001-movie-watchlist's Polish phase). The spec
must explicitly address how this is rate-limited/scoped so a fast-typing
user debouncing through many searches doesn't cause a burst of TMDB
requests disproportionate to the existing single-call-per-query pattern —
this is the primary open technical risk of covering search results, and
needs first-class treatment in the requirements, not an afterthought.

Movie removed from a list, or a fetch failure both at add-time and at
backfill time: no IMDb link is shown for that entry (graceful absence,
never a broken link or error state).
```

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See an IMDb link for a movie already in a list (Priority: P1)

A signed-in user viewing a list's detail page sees a plain-text "IMDb" link next to any movie entry whose IMDb identifier is known, and clicking it opens that movie's IMDb page in a new browser tab.

**Why this priority**: This is the feature's core, most visible deliverable — the majority of movies a user will encounter are already sitting in a list (including the 582 entries carried over from the legacy migration), so this is the highest-traffic surface for the new link.

**Independent Test**: Can be fully tested by opening a list that contains a movie with a known IMDb identifier, confirming an "IMDb" text link renders next to that entry, and confirming it opens the correct IMDb page in a new tab (not the current tab).

**Acceptance Scenarios**:

1. **Given** a list-detail page with a movie entry that has a resolved IMDb identifier, **When** the page renders, **Then** a plain-text "IMDb" link (no logo or icon) appears on that entry.
2. **Given** that "IMDb" link, **When** the user clicks it, **Then** the movie's IMDb page opens in a new browser tab and the list page remains open and unchanged in the original tab.
3. **Given** a movie entry whose IMDb identifier is not known (never resolved, or resolution failed), **When** the page renders, **Then** no IMDb link, placeholder, or error indicator appears on that entry — the entry looks and behaves exactly as it does today.

---

### User Story 2 - See an IMDb link on search results not yet added to any list (Priority: P1)

A signed-in user searching for a movie — whether from inside a list's own search or from the global search page — sees the same plain-text "IMDb" link on result cards, even though that movie has not been added to any list yet.

**Why this priority**: Search is the entry point before a movie ever reaches a list, and both search surfaces render through the same shared result card, so this delivers the link everywhere a movie can be seen, not only after it's collected into a list.

**Independent Test**: Can be fully tested by searching for a well-known movie from both the in-list search and the global search page, and confirming each result card shows the same "IMDb" link behavior (new-tab, plain text, correct destination) described in User Story 1, without needing to add the movie to any list first.

**Acceptance Scenarios**:

1. **Given** a search (in-list or global) that returns a movie whose IMDb identifier can be resolved, **When** the results render, **Then** that result's card shows the same plain-text "IMDb" link, opening in a new tab.
2. **Given** a search result whose IMDb identifier could not be resolved, **When** the results render, **Then** that result's card shows no IMDb link and no error or placeholder in its place.
3. **Given** the user is actively typing and re-typing a query (e.g., correcting or extending it several times within a few seconds), **When** results settle after each pause, **Then** the app does not visibly slow down, error, or drop already-working search functionality as a result of resolving IMDb links for the results shown.
4. **Given** a search result has rendered before its IMDb identifier resolves, **When** the identifier resolves shortly afterward, **Then** the IMDb link appears on that already-rendered card without re-rendering, reordering, or otherwise disturbing the rest of the card's content.

---

### User Story 3 - Newly added movies get their IMDb link automatically (Priority: P2)

When a user adds a movie to a list, the system resolves and stores that movie's IMDb identifier as part of the same action, without any extra step from the user and without risking the add itself.

**Why this priority**: This is what keeps User Story 1 populated going forward for every movie added from this point on; it depends on Story 1 existing but is a distinct, separately testable piece of behavior (the add-time data capture, not the link rendering).

**Independent Test**: Can be fully tested by adding a movie to a list and confirming its entry subsequently shows an IMDb link without any further user action; separately, by simulating a lookup failure/timeout during add and confirming the movie is still added successfully with no IMDb link and no error surfaced to the user.

**Acceptance Scenarios**:

1. **Given** a user adds a movie to a list, **When** the add completes, **Then** the system has attempted to resolve that movie's IMDb identifier as part of the same action, with no separate user-facing step.
2. **Given** the IMDb identifier lookup fails or times out during an add, **When** the add completes, **Then** the movie is added to the list exactly as it would be without this feature — same success message, same speed — and simply has no IMDb link afterward.

---

### User Story 4 - Existing movie entries are backfilled with IMDb links (Priority: P3)

An administrator runs a one-time process that resolves and stores IMDb identifiers for every movie entry that existed before this feature shipped — including the entries brought over by the earlier legacy-data migration (582 at the time of that migration; the actual count at backfill run-time will be higher, reflecting everything added since) — so User Story 1 isn't limited to newly-added movies.

**Why this priority**: This extends Story 1's value to the app's existing content. It's lower priority than the other stories because it's a one-time operational task rather than ongoing user-facing behavior, and the app remains fully correct (just link-sparse on old entries) until it's run.

**Independent Test**: Can be fully tested by running the backfill against a database containing a mix of entries with and without a resolvable IMDb identifier, then confirming: previously-unresolved entries now show a link where one exists, entries with no resolvable identifier are cleanly reported (not silently dropped or errored), and re-running the process afterward changes nothing and re-reports the same unresolved entries without re-querying already-resolved ones.

**Acceptance Scenarios**:

1. **Given** a database of pre-existing movie entries with no IMDb identifier stored, **When** the backfill process runs to completion, **Then** every entry for which an IMDb identifier could be found now has one stored, and each such entry subsequently shows an IMDb link.
2. **Given** an entry for which no IMDb identifier can be found (lookup failure or no match), **When** the backfill process runs, **Then** that entry is listed in an end-of-run report explaining why, and the process continues on to the remaining entries rather than stopping.
3. **Given** a backfill that has already completed for some entries, **When** the process is run again, **Then** entries that already have a stored IMDb identifier are left untouched and are not looked up again — only entries still missing one are attempted.

---

### Edge Cases

- What happens when a movie is removed from a list? Its entry (and any IMDb identifier stored for it) is deleted along with the removal — there is nothing left to show a link for, and no orphaned link data lingers anywhere.
- What happens when the add-time IMDb lookup and the backfill both fail (or never ran) for the same entry? The entry simply shows no IMDb link, indefinitely — there is no automatic retry; a future backfill run picks it up whenever it can resolve.
- What happens when a searched movie has no IMDb entry at all on the movie data source (a real "no match" rather than a failure)? Treated identically to a lookup failure: no link, no error shown.
- What happens if a user re-runs the backfill after it already fully succeeded? It reports that no entries needed resolving and makes no further external lookups.
- What happens if the movie search backend used for finding IMDb links on search results is unavailable? Individual result cards simply show no IMDb link (per the failure-is-silent rule above); this must not degrade or break the existing search results themselves (titles, posters, overviews continue to render normally).
- What happens when a user types and retypes a search query rapidly (e.g., correcting typos, backspacing)? IMDb lookups tied to a query the user has already moved past must not continue running or arrive late and show up under the wrong query's results — matching how the existing search results themselves are already protected against stale, superseded queries.
- What happens when the same movie shows up again in a later search within the same visit (e.g., the user backspaces and retypes a similar query, resurfacing an already-seen result)? Its IMDb identifier, if already resolved earlier in that visit, is reused rather than looked up again.
- How do IMDb links behave on a 360px-wide screen? They remain visible and tappable on both list entries and search result cards, without causing horizontal scrolling or crowding out existing actions (add/remove/mark watched).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a plain-text "IMDb" link (label text only — no logo, icon, or other IMDb branding) on any list-detail-page movie entry whose IMDb identifier has been resolved.
- **FR-002**: The IMDb link MUST open the movie's IMDb page in a new browser tab, leaving the current page open and unchanged (equivalent to `target="_blank"` with `rel="noopener"` behavior).
- **FR-003**: A movie entry with no resolved IMDb identifier (never looked up, lookup failed, or no match found) MUST render with no IMDb link and no broken-link, placeholder, or error state in its place.
- **FR-004**: System MUST display the same plain-text "IMDb" link (per FR-001, FR-002) on movie search result cards, in both the in-list search and the global search, for any result whose IMDb identifier has been resolved — regardless of whether that movie has been added to any list.
- **FR-005**: A search result with no resolved IMDb identifier MUST render with no IMDb link, matching the graceful-absence behavior of FR-003.
- **FR-006**: The system MUST be able to store an IMDb identifier per movie list entry, independent of that entry's existing title/poster/release-year snapshot, and this identifier MUST be optional (an entry with none stored is a valid, expected state, not an error).
- **FR-007**: When a movie is added to a list, the system MUST attempt to resolve and store that movie's IMDb identifier as part of the same add action, with no additional user-facing step.
- **FR-008**: If the add-time IMDb identifier lookup fails or times out, the add action MUST still complete successfully (same outcome and messaging as if this feature didn't exist), and the entry's IMDb identifier MUST simply remain unresolved rather than blocking, delaying, or failing the add.
- **FR-009**: A one-time backfill process MUST be available to resolve and store IMDb identifiers for every `movie_entries` row that lacks one **at the time the process runs** — this includes, but is not bounded by, the entries originally brought over by the legacy-data migration; the figure of 582 describes that migration's historical scope, not a literal count this process must match.
- **FR-010**: The backfill process MUST be safe to run more than once: entries that already have an IMDb identifier stored MUST be skipped (not re-looked-up or overwritten) on any subsequent run.
- **FR-011**: The backfill process MUST perform its lookups sequentially with a rate-limiting delay between requests, rather than issuing them concurrently, consistent with this project's existing legacy-data migration approach.
- **FR-012**: The backfill process MUST continue past individual lookup failures (rather than aborting the whole run) and MUST produce an end-of-run report listing every entry it could not resolve, distinguishing "lookup failed" from "no IMDb match found."
- **FR-013**: When a movie entry is removed from a list, any IMDb identifier stored for that entry MUST be removed along with it — no orphaned identifier or link may persist or display anywhere afterward.
- **FR-014**: For search results specifically, the system MUST reuse an already-resolved IMDb identifier for a given movie rather than re-fetching it, when that movie has already been looked up earlier in the same search session (e.g., it reappeared in a later query during the same visit).
- **FR-015**: For search results specifically, the system MUST NOT allow an in-flight IMDb identifier lookup belonging to a search query the user has since typed past to continue running or affect the currently-displayed results — matching the existing cancel-on-supersede protection already applied to the search results themselves.
- **FR-016**: For search results specifically, IMDb identifier lookups MUST only be triggered once a query has settled (after the same debounce delay already applied to triggering the search itself), never on every individual keystroke.
- **FR-017**: The combination of FR-014, FR-015, and FR-016 MUST keep the volume of additional lookups triggered by a user actively typing/correcting a search proportionate to how many distinct queries they actually let settle and how many previously-unseen movies those queries surface — not proportionate to how many characters they type.
- **FR-018**: All IMDb links introduced by this feature MUST be reachable and operable using only a keyboard (standard link semantics), consistent with the app's existing accessibility requirements.
- **FR-019**: IMDb links on both list entries and search result cards MUST remain visible and usable on a 360px-wide screen without introducing horizontal scrolling or displacing existing actions (add, remove, mark watched).
- **FR-020**: All user-visible text introduced by this feature MUST be in Portuguese (pt-BR), consistent with the rest of the app.
- **FR-021**: Search-result IMDb lookups triggered for a single settled query MUST NOT exceed the number of results actually displayed for that query — i.e., bounded by the search feature's own existing result-count cap (currently 10, per 001-movie-watchlist's Polish phase), expressed *relative to* whatever that cap is at any given time rather than as an independently hardcoded number. A future change to the search result cap is automatically reflected in this bound without requiring a separate update to this spec.
- **FR-022**: IMDb identifier resolution for search results MUST be sequential-after-render: a result's title, poster, release year, and overview MUST render immediately once the underlying search settles — exactly as today, unaffected by this feature — with the IMDb link (once resolved) appearing as a subsequent, non-blocking update to that same card. A slow or failed IMDb lookup MUST NOT delay, gate, or otherwise affect the rendering of the rest of the card.
- **FR-023**: When a movie is added to a list (FR-007), if that movie's IMDb identifier has already been resolved and cached in the current session (per FR-014, from an earlier search-result resolution), the add action MUST reuse that cached identifier directly rather than issuing a new lookup. The independent add-time lookup described in FR-007/FR-008 applies only when no session-cached identifier exists for that movie.

### Key Entities

- **Movie Entry** (extends the existing entity from 001-movie-watchlist): gains an optional IMDb identifier, resolved either at add-time or by the backfill process. Absence of this identifier is a normal, expected state, not an error condition. This identifier is deleted along with the entry when the entry is removed from its list (same lifecycle as the rest of the entry).
- **Search Result** (existing entity from 002-global-search): gains the same optional IMDb identifier for display purposes only. Search results are not persisted — this identifier exists only for the duration of the search session in which it was resolved. If the result is added to a list within that session, its cached identifier is reused as the persisted entry's IMDb identifier per FR-023, rather than being independently re-fetched; if the result is never added, the cached identifier is simply discarded at the end of the session.
- **Backfill Report**: a one-time, end-of-run accounting produced by the backfill process, listing every pre-existing movie entry that could not be resolved to an IMDb identifier and why (lookup failure vs. no match found). Not a persisted application entity — an operational artifact of running the process, in the same spirit as the earlier legacy-migration's orphan report.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every movie entry and search result with a resolved IMDb identifier displays a working "IMDb" link that opens the correct movie's IMDb page in a new tab, with zero broken or mismatched links observed across testing.
- **SC-002**: The success rate and perceived speed of adding a movie to a list are unaffected by this feature — a user cannot tell, from the add flow's outcome or responsiveness, whether the IMDb identifier lookup behind it succeeded or failed.
- **SC-003**: After the one-time backfill completes, every pre-existing movie entry is accounted for: it either displays an IMDb link or appears with a reason in the backfill report — no entry is left in a silent, unexplained state.
- **SC-004**: A user who types and corrects a search query repeatedly over several seconds sees no degradation in search responsiveness and no error state attributable to IMDb link resolution, regardless of how many characters they typed or how many times they revised the query.
- **SC-005**: IMDb links remain fully visible and usable on a 360px-wide screen on both list entries and search result cards, with no loss of existing actions.

## Assumptions

- The IMDb link destination is built from the resolved IMDb identifier using IMDb's standard public title-page URL convention; no additional data beyond the identifier itself is needed to construct it.
- "Resolved" IMDb identifier means successfully obtained from the movie data source (TMDB) at either add-time or backfill-time; a movie genuinely absent from that source's IMDb cross-reference data is treated the same as a fetch failure — permanently no link, no automatic retry.
- Search-result IMDb lookups reuse the same debounce and stale-query-cancellation behavior the existing search already relies on (FR-014–FR-017), plus a same-session cache of already-resolved movies, as the primary mitigation for the call-volume risk called out for this feature; this is judged sufficient at this app's two-user, low-traffic scale without introducing a separate server-side throttling layer.
- The backfill process follows the same operational shape as the project's existing legacy-data migration script: a manually-run, standalone process against a target database, sequential with a rate-limiting delay between external lookups, idempotent (skips already-resolved entries), and concluding with a written report of anything it could not resolve.
- No automatic retry or refresh is introduced for entries that failed to resolve an IMDb identifier, whether at add-time or during backfill — consistent with this project's existing "snapshot, never refreshed" approach to movie entry data. A future backfill run remains the only way to pick up a previously-unresolved entry.
- The exact visual placement of the "IMDb" link within each entry's or result card's existing layout is a presentation detail decided during planning, consistent with how prior features in this project have handled layout specifics.
