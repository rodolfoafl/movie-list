# Spec Amendments — Data Integrity Checklist Resolution

**Date:** 2026-07-21
**Applies to:** specs/001-movie-watchlist/spec.md
**Source:** checklists/data-integrity.md review

Paste the sections below into spec.md as indicated, then mark the corresponding CHK items using the resolution table at the end.

---

## 1. REPLACE these Functional Requirements

- **FR-004**: Users MUST be able to create a list by providing a name that is non-empty after trimming leading/trailing whitespace; the trimmed name is what gets stored. Whitespace-only input MUST be rejected inline. The new list MUST appear in the lists overview immediately.

- **FR-005**: System MUST treat two list names as duplicates when they are equal case-insensitively after trimming leading/trailing whitespace, and MUST reject a duplicate on both create and rename with an inline message, taking no action. EXCEPTION: renaming a list to a variant of its own current name (e.g. changing only capitalization or surrounding whitespace) MUST be allowed — a list never conflicts with itself.

- **FR-016**: System MUST prevent duplicate movie entries within a list, where a duplicate is defined as the same external movie identifier (TMDB id) already present in that same list. The user MUST be informed the movie is already present instead of a duplicate entry being created. Title/year similarity is NOT used for duplicate detection.

- **FR-020**: System MUST record the current date each time a movie entry is marked watched and display it while the entry remains watched. Setting an entry back to unwatched MUST clear the stored date. Re-marking it watched later records a NEW current date (the previous date is not restored).

## 2. ADD these Functional Requirements

- **FR-026**: List names MUST be limited to 60 characters (after trimming). Longer input MUST be rejected inline with a message stating the limit.

- **FR-027**: When a list is deleted, its name immediately becomes available for reuse; creating a new list with a previously deleted list's name MUST succeed.

- **FR-028**: The empty state for a list with no movies (FR-009) and the empty state for a search with no matches (FR-012) MUST use visually and textually distinct messages, so the two situations cannot be confused when both could appear on the same screen.

## 3. ADD these Assumptions

- Movie snapshots (title, poster, release year) are captured once at add-time and are NEVER refreshed in this scope, even if the external source later changes that movie's data. Stale snapshots are acceptable for a personal app; a manual or scheduled refresh is a possible future enhancement.
- The external movie identifier (TMDB id) is assumed to be stable and never reused/reassigned by the provider; duplicate prevention (FR-016) and cross-list independence (FR-017) depend on this.
- No upper bound is imposed on the number of lists or entries; unbounded growth is an accepted risk given the two-user personal scale.
- Last-write-wins conflict resolution applies at whole-record granularity: the most recent successful save of a record replaces it entirely. Field-level merging is not attempted.

## 4. Resolution table for checklists/data-integrity.md

| Item | Resolution |
| --- | --- |
| CHK001 | Resolved by Key Entities + new snapshot assumption (§3): redundant per-list snapshots are a documented decision |
| CHK002 | Resolved: new assumption — snapshots never refreshed in MVP |
| CHK003 | Resolved: FR-016 now defines the uniqueness key as (list, external movie id) |
| CHK004 | Deferred to plan: create/create race handled by a database-level unique constraint + transaction |
| CHK005 | Resolved: FR-020 — re-marking watched records a new current date |
| CHK006 | Resolved: new assumption — unbounded growth accepted at personal scale |
| CHK007 | Resolved: FR-004 — trimmed, non-whitespace-only names |
| CHK008 | Resolved: FR-005 — trimming is part of the uniqueness rule itself |
| CHK009 | Resolved: new assumption — last-write-wins at whole-record granularity |
| CHK010 | Resolved: FR-016 — "same movie" = same external identifier, everywhere |
| CHK011 | Resolved: FR-005 now matches the Edge Cases wording (case + whitespace) |
| CHK012 | Resolved (no change needed): FR-007 and FR-018 both require explicit confirmation; identical mechanism intended |
| CHK013 | Resolved: FR-005 exception — a list never conflicts with itself on rename |
| CHK014 | Resolved: SC-002 now verifiable via FR-005 (trimmed, case-insensitive name key) and FR-016 (list + external id key) |
| CHK015 | Resolved: Key Entities — Movie Entry is scoped to exactly one List; verified via FR-008/FR-017 tests |
| CHK016 | Deferred to plan: durability guarantees (backups, loss window) are provider-level decisions |
| CHK017 | Deferred to plan: rename/delete race handled by transactions; either outcome (renamed-then-deleted or delete-wins) is acceptable |
| CHK018 | Deferred to plan: remove/toggle race — last-write-wins per assumption; toggle on a removed entry fails silently or with a gentle notice |
| CHK019 | Resolved: FR-027 — deleted names are reusable |
| CHK020 | Resolved: FR-026 — 60 character limit |
| CHK021 | Deferred to plan: search results lacking a valid external id are filtered out server-side before reaching the client |
| CHK022 | Resolved: FR-028 — distinct empty states |
| CHK023 | Resolved: Key Entities + FR-017 wording — entries are independent per list, never shared |
| CHK024 | Resolved: new assumption — TMDB ids assumed stable |

**Optional (product decision, not required):** if you choose to record WHO marked a movie watched, add: "FR-029: When a movie entry is marked watched, the system MUST also record which of the two users performed the action and display it alongside the date." Also remove the corresponding deferral from Assumptions. Skip entirely if keeping the current scope.
