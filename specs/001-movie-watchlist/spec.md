# Feature Specification: Shared Movie Watchlist

**Feature Branch**: `001-movie-watchlist`

**Created**: 2026-07-21

**Status**: Draft

**Input**: User description:

```text
# Movie List 2.0 — Specification

**Status:** Draft v1
**Date:** 2026-07-21
**Author:** Rodolfo Leal
**Context:** Rebuild of a 2020 personal project (react_Movie_List) as a Spec-Driven Development exercise. Original purpose preserved: a shared movie watchlist for two people (my wife and me) to plan and track what we watch together.

---

## 1. Purpose & Vision

A private, shared movie watchlist app for exactly two users. Users create named custom lists (e.g. "Date night", "Halloween marathon"), search movies via TMDB, add them to lists, and mark them as watched. The app should feel fast, look polished on mobile and desktop, and require zero maintenance once deployed.

## 2. Users & Access

- Exactly two known users (no public sign-up).
- Simple authentication: email + password, pre-registered accounts (seeded). No password recovery flow in MVP — accounts are reset manually if needed.
- Both users see and edit the SAME shared data (lists are collaborative, not per-user).
- All routes except the login page require authentication.

## 3. Core Features (MVP)

### 3.1 Lists
- WHEN a user creates a list with a non-empty name, THE SYSTEM SHALL create it and display it in the lists overview.
- Users can rename and delete lists.
- WHEN a user deletes a list, THE SYSTEM SHALL ask for confirmation and delete the list and its movie entries (movies in other lists are unaffected).
- Empty lists are allowed and displayed with an empty state.
- List names must be unique (case-insensitive). Duplicate names are rejected with an inline message.

### 3.2 Movie search (TMDB)
- Users search movies by title from within a list.
- Results show poster, title, release year and short overview.
- WHEN the TMDB API returns no results, THE SYSTEM SHALL display a friendly empty state (never an error).
- WHEN the TMDB API is unavailable or rate-limited, THE SYSTEM SHALL display a retry message without crashing the page.
- TMDB API key lives server-side only (API route proxy). The key SHALL never be exposed to the client.

### 3.3 Movies in lists
- Adding a movie stores its TMDB id plus a snapshot (title, poster path, year) so lists render without re-fetching TMDB.
- The same movie CAN exist in multiple lists.
- WHEN a user tries to add a movie already present in that list, THE SYSTEM SHALL indicate it is already there instead of duplicating.
- Users can remove a movie from a list (with confirmation).
- Users can toggle a movie as watched/unwatched. Watched state is per list entry.
- WHEN a movie is marked watched, THE SYSTEM SHALL record the date and display it.

### 3.4 List view
- Within a list, movies are grouped or filterable by watched status (All / To watch / Watched).
- Default ordering: alphabetically.

## 4. Non-functional Requirements

- **Performance:** Lighthouse performance ≥ 90 (mobile) on list pages. Poster images optimized (next/image).
- **Responsive:** usable from 360px width up.
- **Accessibility:** Lighthouse accessibility ≥ 90; all actions keyboard-reachable.
- **Language:** UI in Portuguese (pt-BR).
- **Persistence:** data survives deploys (managed Postgres).
- **Cost:** runs entirely on free tiers (Vercel + managed DB free tier + TMDB free API).

## 5. Technical Constraints (input for the plan phase)

- Next.js (App Router) + TypeScript + Tailwind, deployed on Vercel.
- Data layer: Postgres with a typed ORM. Exact provider (Neon / Vercel Postgres / Supabase-as-DB) decided in plan phase.
- Auth: lightweight session-based auth (e.g. Auth.js credentials provider). No OAuth in MVP.
- TMDB accessed exclusively through server-side API routes.
- Automated tests for business rules (duplicate prevention, watched toggle, list deletion cascade).

## 6. Out of Scope (MVP)

- Public sign-up, password recovery, user profiles
- TV series support (movies only)
- Ratings, reviews, comments
- Notifications
- Recommendations
- Offline mode
- Per-user private lists

## 7. Open Questions

- Should watched state also record WHO marked it? (Nice for the story; adds a column. Decide in plan phase.)
- Poster fallback when TMDB has no image: placeholder design TBD.

## 8. Success Criteria

- Both users can log in on their phones, create a list, add 3 movies via search, and mark one watched — with no errors — in under 2 minutes.
- Deployed and stable on Vercel with zero monthly cost.
- The /specs folder documents the full SDD journey (this spec, the plan, the task list, and a post-implementation notes file recording what the spec missed).
```

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in and see the shared lists (Priority: P1)

Either of the two known users opens the app on any device, signs in with their email and password, and lands on an overview of every shared list, since both people always work from the same shared data.

**Why this priority**: Nothing else in the app is reachable without this. It is also the first thing a real user does every single time, so it must be fast and reliable.

**Independent Test**: Can be fully tested by signing in with a seeded account and confirming the lists overview loads (even if empty), and that visiting any other page while signed out redirects to login.

**Acceptance Scenarios**:

1. **Given** a seeded account's correct email and password, **When** the user submits the login form, **Then** they are signed in and see the lists overview.
2. **Given** an incorrect email or password, **When** the user submits the login form, **Then** they see an inline error and remain on the login page.
3. **Given** a signed-out visitor, **When** they navigate directly to any page other than login, **Then** they are redirected to the login page.
4. **Given** a signed-in user, **When** the other known user also signs in from a different device, **Then** both see the same lists and data.

---

### User Story 2 - Create a list and add movies via search (Priority: P1)

A signed-in user creates a new named list, searches for movies by title, and adds chosen results to that list, building up a watchlist to plan what to watch together.

**Why this priority**: This is the core value of the product — turning a shared idea ("movies for date night") into a persisted, shared list. Without it the app has no purpose.

**Independent Test**: Can be fully tested by creating a list, searching for a known movie title, adding a result, and confirming it appears in the list without re-querying search on reload.

**Acceptance Scenarios**:

1. **Given** the lists overview, **When** the user submits a non-empty, unused list name, **Then** the list is created and shown in the overview.
2. **Given** an existing list name, **When** the user tries to create or rename another list to that same name (case-insensitive), **Then** the action is rejected with an inline message and no new list is created.
3. **Given** an open list, **When** the user searches for a movie title with matches, **Then** results show poster, title, release year, and a short overview.
4. **Given** search results, **When** the user adds one to the list, **Then** it appears in the list immediately with its snapshot data.
5. **Given** a movie already added to the current list, **When** the user tries to add it again from search, **Then** the system indicates it is already in the list instead of adding a duplicate.
6. **Given** a movie already in one list, **When** the user adds the same movie to a different list, **Then** it is added successfully (movies can exist in multiple lists).
7. **Given** a search with no matches, **When** results load, **Then** a friendly empty state is shown (never an error).
8. **Given** the movie search backend is down or rate-limited, **When** the user searches, **Then** a retry message is shown and the page does not crash.

---

### User Story 3 - Track watched movies (Priority: P2)

A signed-in user marks a movie in a list as watched (or reverts it to unwatched) and can see when it was watched, so the couple can track progress on a list.

**Why this priority**: This is the second core loop (after adding movies) and is required to satisfy the app's stated purpose of tracking, not just planning — but the app is still useful for planning without it.

**Independent Test**: Can be fully tested by toggling a movie's watched state in a list and confirming the watched date appears and disappears accordingly, independent of search or list-management features.

**Acceptance Scenarios**:

1. **Given** an unwatched movie in a list, **When** the user marks it watched, **Then** its status updates and today's date is recorded and displayed.
2. **Given** a watched movie, **When** the user marks it unwatched, **Then** its status updates and the previously recorded watched date is no longer displayed.
3. **Given** a list with both watched and unwatched movies, **When** the user filters by "To watch" or "Watched", **Then** only matching movies are shown; "All" shows every movie.

---

### User Story 4 - Manage and clean up lists (Priority: P3)

A signed-in user renames a list, removes an individual movie from a list, or deletes an entire list they no longer need, with confirmation before anything destructive happens.

**Why this priority**: Necessary for long-term usability and tidiness, but the app already delivers its core value (Stories 1–3) without it — this is refinement, not the primary loop.

**Independent Test**: Can be fully tested by renaming a list, removing a single movie from a list (with confirmation), and deleting a whole list (with confirmation), verifying other lists and their movies are unaffected.

**Acceptance Scenarios**:

1. **Given** an existing list, **When** the user renames it to a valid, unused name, **Then** the new name is saved and shown everywhere the list appears.
2. **Given** a movie in a list, **When** the user chooses to remove it and confirms, **Then** it disappears from that list only; the same movie in other lists is unaffected.
3. **Given** an existing list, **When** the user chooses to delete it and confirms, **Then** the list and all its movie entries are removed, while the same movies in other lists remain untouched.
4. **Given** a delete action for a list or a movie, **When** the user cancels the confirmation, **Then** nothing is deleted.

---

### Edge Cases

- What happens when a user submits an empty or whitespace-only list name? Rejected inline; no list is created.
- What happens when two lists differ only by case or surrounding whitespace (" Date Night " vs "date night")? Treated as duplicates and rejected.
- What happens when a movie has no poster image available from the search source? A placeholder image is shown instead of a broken image.
- What happens when both users edit the same list at nearly the same time (e.g. both add a movie)? Both changes are persisted; the shared list reflects the latest state on refresh (no real-time merge conflict UI in MVP).
- What happens when a user's session expires mid-action? The next action redirects them to login; in-progress unsaved input (e.g. a half-typed search) may be lost.
- What happens when a list has zero movies? An empty state is shown, distinct from the "no search results" empty state.
- How does the system behave on a very narrow screen (360px)? All content and actions remain visible and usable without horizontal scrolling.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST require a signed-in session for every page except login.
- **FR-002**: System MUST authenticate users via email and password against exactly two pre-registered (seeded) accounts; no self-service sign-up is offered.
- **FR-003**: All signed-in users MUST see and be able to modify the same shared lists and movie entries; the system MUST NOT partition data per user.
- **FR-004**: Users MUST be able to create a list by providing a name that is non-empty after trimming leading/trailing whitespace; the trimmed name is what gets stored. Whitespace-only input MUST be rejected inline. The new list MUST appear in the lists overview immediately.
- **FR-005**: System MUST treat two list names as duplicates when they are equal case-insensitively after trimming leading/trailing whitespace, and MUST reject a duplicate on both create and rename with an inline message, taking no action. EXCEPTION: renaming a list to a variant of its own current name (e.g. changing only capitalization or surrounding whitespace) MUST be allowed — a list never conflicts with itself.
- **FR-006**: Users MUST be able to rename an existing list, subject to the same non-empty and uniqueness rules as creation.
- **FR-007**: Users MUST be able to delete a list; the system MUST ask for confirmation before deleting.
- **FR-008**: Deleting a list MUST remove all of its movie entries but MUST NOT affect the same movie's entries in any other list.
- **FR-009**: System MUST display a distinct empty state for a list that currently has no movies.
- **FR-010**: Users MUST be able to search for movies by title from within a list.
- **FR-011**: Each search result MUST display a poster (or placeholder), title, release year, and short overview.
- **FR-012**: System MUST display a friendly empty state when a search returns no matches, never a raw error.
- **FR-013**: System MUST display a retry-capable message, without crashing the page, when the movie search service is unavailable or rate-limited.
- **FR-014**: System MUST keep any movie-search service credentials server-side only; they MUST never be exposed to client-side code or requests.
- **FR-015**: Adding a movie to a list MUST store the external movie identifier plus a snapshot of its title, poster, and release year, so the list can be rendered without re-querying the search service.
- **FR-016**: System MUST prevent duplicate movie entries within a list, where a duplicate is defined as the same external movie identifier (TMDB id) already present in that same list. The user MUST be informed the movie is already present instead of a duplicate entry being created. Title/year similarity is NOT used for duplicate detection.
- **FR-017**: System MUST allow the same movie to exist independently in multiple different lists.
- **FR-018**: Users MUST be able to remove a movie from a list; the system MUST ask for confirmation before removing.
- **FR-019**: Users MUST be able to toggle a movie entry between watched and unwatched.
- **FR-020**: System MUST record the current date each time a movie entry is marked watched and display it while the entry remains watched. Setting an entry back to unwatched MUST clear the stored date. Re-marking it watched later records a NEW current date (the previous date is not restored).
- **FR-021**: Within a list, users MUST be able to filter movies by watched status: All, To watch, or Watched.
- **FR-022**: Within a list, movies MUST be sorted alphabetically by title by default.
- **FR-023**: System MUST persist all lists, movie entries, and watched state so that data survives application restarts and redeployments.
- **FR-024**: All primary actions (sign in, create/rename/delete list, search, add/remove movie, toggle watched, filter) MUST be operable using only a keyboard.
- **FR-025**: All UI text MUST be presented in Portuguese (pt-BR).
- **FR-026**: List names MUST be limited to 60 characters (after trimming). Longer input MUST be rejected inline with a message stating the limit.
- **FR-027**: When a list is deleted, its name immediately becomes available for reuse; creating a new list with a previously deleted list's name MUST succeed.
- **FR-028**: The empty state for a list with no movies (FR-009) and the empty state for a search with no matches (FR-012) MUST use visually and textually distinct messages, so the two situations cannot be confused when both could appear on the same screen.

### Key Entities

- **User**: One of exactly two pre-registered people who can sign in; identified by email, authenticated by password. No profile, role, or permission differences between the two.
- **List**: A named, shared collection of movie entries. Has a name unique case-insensitively across all lists, and is created, renamed, or deleted by any user.
- **Movie Entry**: The association between a List and a specific movie. Stores the external movie identifier, a display snapshot (title, poster, release year), watched/unwatched status, and the date it was marked watched (if any). The same movie may appear as separate entries in different lists.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from the login screen to a newly created list containing 3 added movies, on a mobile-sized screen, in under 2 minutes.
- **SC-002**: 100% of attempts to create a duplicate list name or add a duplicate movie to the same list are caught and communicated to the user, with zero duplicate records created.
- **SC-003**: Deleting a list never removes a movie entry belonging to a different list (zero cross-list data loss across testing).
- **SC-004**: The lists overview and an individual list page remain fully usable, with no loss of content or actions, on a 360px-wide screen.
- **SC-005**: Every primary action (create/rename/delete list, search, add/remove movie, toggle watched, filter) can be completed using only a keyboard, with no dead ends.
- **SC-006**: When the movie search backend is unavailable, the user sees a clear retry message and can still navigate the rest of the app without the page crashing.
- **SC-007**: A returning user can tell, at a glance, which movies in a list are already watched and when each one was watched.

## Assumptions

- Exactly two user accounts are provisioned out-of-band (seeded) before the app is used; there is no in-app registration or password-recovery flow in this scope.
- Both users have equal, full read/write access to all lists and movie entries; there is no concept of list ownership, per-list permissions, or per-user private lists.
- Watched status records only the date it changed, not which of the two users made the change; capturing "who" is deferred as a possible future enhancement, not required for this scope.
- When a movie has no poster available from the search source, a generic placeholder image is shown in its place.
- Concurrent edits by both users are resolved by last-write-wins on refresh; no real-time (live-updating) collaboration is required.
- Movies-only scope: TV series, ratings, reviews, comments, notifications, and recommendations are not part of this feature.
- The app is expected to run entirely within free-tier hosting, database, and movie-search API limits; no paid infrastructure is assumed.
- Movie snapshots (title, poster, release year) are captured once at add-time and are NEVER refreshed in this scope, even if the external source later changes that movie's data. Stale snapshots are acceptable for a personal app; a manual or scheduled refresh is a possible future enhancement.
- The external movie identifier (TMDB id) is assumed to be stable and never reused/reassigned by the provider; duplicate prevention (FR-016) and cross-list independence (FR-017) depend on this.
- No upper bound is imposed on the number of lists or entries; unbounded growth is an accepted risk given the two-user personal scale.
- Last-write-wins conflict resolution applies at whole-record granularity: the most recent successful save of a record replaces it entirely. Field-level merging is not attempted.
