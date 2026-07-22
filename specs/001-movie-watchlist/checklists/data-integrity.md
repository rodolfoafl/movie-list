# Data Integrity & CRUD Requirements Checklist: Shared Movie Watchlist

**Purpose**: Validate the completeness, clarity, consistency, and measurability of requirements governing list and movie-entry CRUD operations, uniqueness rules, cascade deletes, duplicate prevention, and snapshot data integrity — before these requirements move into planning.
**Created**: 2026-07-21
**Feature**: [spec.md](../spec.md)
**Depth**: Standard | **Audience**: Spec author

## Requirement Completeness

- [ ] CHK001 Is the data relationship between a movie's canonical identity (TMDB id) and its per-list snapshot entries explicitly specified, so that storing the same movie's data redundantly across multiple lists is a documented decision rather than an implicit side effect? [Completeness, Spec §Key Entities]
- [ ] CHK002 Are requirements defined for what happens if TMDB's title/poster/year for a movie changes after it was snapshotted into a list entry (e.g., is the snapshot ever refreshed)? [Gap, Spec §FR-015]
- [ ] CHK003 Is the uniqueness scope for a movie-in-list duplicate check explicitly defined (i.e., keyed on list + external movie id) rather than left implicit? [Completeness, Spec §FR-016]
- [ ] CHK004 Are requirements defined for concurrent creation of two lists with the same name submitted at nearly the same time (a create/create race), distinct from the concurrent-edit case already covered for movie entries? [Gap, Spec §Edge Cases]
- [ ] CHK005 Is it specified what value is stored/displayed when a movie is re-marked watched after previously being unwatched (a new "today" date vs. restoring a prior watched date)? [Gap, Spec §FR-020]
- [ ] CHK006 Are requirements defined for the maximum or expected scale of lists and movie entries (e.g., is there any bound), or is unbounded growth an explicit assumption? [Gap]

## Requirement Clarity

- [ ] CHK007 Is "non-empty name" for list creation/rename explicitly defined to exclude whitespace-only input, or does that rely only on the separate Edge Cases note? [Clarity, Spec §FR-004]
- [ ] CHK008 Is the list-name uniqueness rule in FR-005 explicit about trimming leading/trailing whitespace before comparison, matching the whitespace example given in Edge Cases? [Clarity/Consistency, Spec §FR-005 vs §Edge Cases]
- [ ] CHK009 Is "last-write-wins on refresh" for concurrent edits defined at a specific granularity (whole record vs. individual field), so two simultaneous different edits to the same list have an unambiguous resolution? [Clarity, Spec §Assumptions]
- [ ] CHK010 Is "the same movie" (used in FR-017, FR-008, and Edge Cases) consistently defined as matched by external movie identifier rather than by title/year? [Clarity]

## Requirement Consistency

- [ ] CHK011 Do FR-005 (case-insensitive duplicate rejection) and the Edge Cases entry (case- and whitespace-insensitive duplicate rejection) fully agree on what counts as a duplicate list name? [Conflict, Spec §FR-005 vs §Edge Cases]
- [ ] CHK012 Are the confirmation requirements for destructive actions consistent between list deletion (FR-007) and movie-entry removal (FR-018) in what "confirmation" entails? [Consistency, Spec §FR-007 vs §FR-018]
- [ ] CHK013 Is the rename-to-same-name case (renaming a list to a name that differs from its own current name only by case/whitespace) handled consistently with the general duplicate-name rule, rather than being incidentally rejected against itself? [Gap/Consistency, Spec §FR-006]

## Acceptance Criteria Quality (Measurability)

- [ ] CHK014 Can "zero duplicate records created" (SC-002) be objectively verified given the current uniqueness key definitions for both list names and movie-in-list entries? [Measurability, Spec §SC-002]
- [ ] CHK015 Can "zero cross-list data loss" (SC-003) be objectively verified without a defined data model showing movie entries are scoped per-list rather than shared? [Measurability, Spec §SC-003]
- [ ] CHK016 Is "data survives application restarts and redeployments" (FR-023) paired with any measurable criterion (e.g., no data loss window, backup expectations), or is it a qualitative statement only? [Measurability, Spec §FR-023]

## Scenario Coverage

- [ ] CHK017 Is there a requirement covering what happens when a rename request and a delete request target the same list at nearly the same time? [Gap, Coverage]
- [ ] CHK018 Is there a requirement covering removal of a movie entry that is simultaneously being toggled watched/unwatched by the other user? [Gap, Coverage]
- [ ] CHK019 Are requirements defined for creating a list whose name matches an already-deleted list's former name (is the old name available for reuse)? [Gap, Coverage]

## Edge Case Coverage

- [ ] CHK020 Does the spec define behavior when a list name exceeds a practical length (no maximum length is stated anywhere in FR-004/FR-006)? [Gap, Edge Case]
- [ ] CHK021 Does the spec define behavior when the external movie identifier returned by search is missing or malformed, given that FR-015 depends on it being stored? [Gap, Edge Case]
- [ ] CHK022 Is the boundary between "no movies in a list" (FR-009 empty state) and "search returned no matches" (FR-012 empty state) specified clearly enough that the two states cannot be confused in a single view? [Clarity, Spec §FR-009 vs §FR-012]

## Dependencies & Assumptions

- [ ] CHK023 Is the assumption that movie entries are always scoped to exactly one list (no shared/linked entries across lists) validated against FR-017's "same movie in multiple lists" wording, which could be misread as one shared entry? [Assumption, Spec §FR-017 vs §Assumptions]
- [ ] CHK024 Is the dependency on TMDB's external movie identifier remaining stable over time (never reused/reassigned) documented as an assumption underpinning duplicate-prevention (FR-016) and cross-list independence (FR-017)? [Dependency/Assumption, Gap]

## Notes

- Focus areas selected: Core CRUD & data integrity (list lifecycle, movie-entry lifecycle, uniqueness, cascade delete, snapshot data).
- Depth: Standard. Audience: spec author, pre-planning review.
- `plan.md` does not yet exist for this feature; this checklist was generated from `spec.md` alone (confirmed with user) — re-run or supplement after `/speckit-plan` if technical constraints reveal new data-integrity requirements (e.g., DB-level uniqueness constraints, transaction boundaries for cascade delete).
