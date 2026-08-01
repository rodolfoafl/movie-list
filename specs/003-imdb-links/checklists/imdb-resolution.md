# IMDb Resolution Semantics Checklist: IMDb Links on Movie Cards

**Purpose**: Validate requirement quality for four specific risk areas in the IMDb-resolution behavior: the "582 entries" figure's framing, the search-result lookup volume bound, search-result resolution timing, and add-time cache reuse.
**Created**: 2026-07-31
**Feature**: [spec.md](../spec.md)

**Note**: This checklist tests whether the requirements are written clearly enough to be implemented and verified without guesswork — not whether the (not-yet-built) feature behaves correctly.

## Legacy Backfill Scope Framing ("582 entries")

- [x] CHK001 Is the "582 entries" figure in FR-009 and User Story 4 explicitly framed as historical/illustrative context rather than as the literal count the backfill must resolve? [Ambiguity, Spec §FR-009, §User Story 4] — Resolved: FR-009 rewording explicitly frames 582 as historical, not literal.
- [x] CHK002 Does the spec state that the total set of pre-existing `movie_entries` rows at backfill run-time may exceed 582, given ongoing list activity since the legacy migration? [Completeness, Gap] — Resolved: FR-009 now says "at the time the process runs", not bounded by the original count.
- [x] CHK003 Is the backfill's completion criterion (SC-003) worded in a way that is unambiguously anchored to "all pre-existing entries at run-time" rather than to the "582" figure specifically, so the two cannot be conflated by an implementer? [Consistency, Spec §SC-003 vs §FR-009] — Resolved (no change needed): SC-003 already anchors to "every pre-existing movie entry", never cited 582 — confirmed consistent with the corrected FR-009.
- [x] CHK004 Is there a requirement or note clarifying that "582" is a description of Story 1's initial value proposition (why legacy content matters), not an acceptance-test input for Story 4's backfill? [Clarity, Spec §User Story 4 rationale] — Resolved: User Story 4 rationale amendment clarifies 582 is Story 1's original motivating context, not Story 4's test input.

## Search-Result Lookup Volume Bound (10-result cap)

- [x] CHK005 Is the per-query ceiling on additional TMDB calls for search-result IMDb resolution stated as a concrete number within this spec's Requirements or Success Criteria, rather than only in the feature-description prose? [Completeness, Spec §FR-014-017 vs Input description] — Resolved: FR-021 states the bound inside this spec.
- [x] CHK006 Do FR-014 through FR-017 or SC-004 quantify "proportionate" (e.g., "at most N additional TMDB calls per settled query") or leave it a qualitative term open to interpretation? [Clarity, Spec §FR-017] — Resolved: FR-021 quantifies "proportionate" as "no more than results displayed".
- [x] CHK007 Is this spec's dependency on 001-movie-watchlist's 10-result search cap made explicit and traceable (a stated cross-reference), rather than something a reader must infer by separately consulting that feature's spec? [Traceability, Spec §FR-017, Gap] — Resolved: FR-021 explicitly cross-references 001-movie-watchlist's cap by name.
- [x] CHK008 If the referenced result cap in 001-movie-watchlist changes in the future, does this spec define whether the search-result IMDb lookup bound is expected to track that change automatically or requires a separate update? [Dependency, Gap] — Resolved: FR-021's relative phrasing ("whatever that cap is at any given time") makes the bound track future changes automatically.

## Search-Result Resolution Timing (Sequential vs Parallel)

- [x] CHK009 Does FR-016 (or any other requirement) specify whether IMDb lookups for search results begin only after the search results have rendered (progressive reveal), or begin at the same time as the underlying search call itself (parallel, racing)? [Ambiguity, Spec §FR-016] — Resolved: FR-022 — explicitly sequential-after-render.
- [x] CHK010 Is the user-visible loading behavior for search-result IMDb links specified — whether the "IMDb" label appears together with title/poster/overview, or appears shortly afterward once resolution completes? [Gap, Spec §FR-004] — Resolved: FR-022 — link appears as a subsequent, non-blocking update.
- [x] CHK011 Do User Story 2's acceptance scenarios distinguish "IMDb link renders simultaneously with the rest of the card" from "IMDb link appears after a short, separate resolution delay" as a required behavior, or are both readings currently consistent with the wording? [Clarity, Spec §User Story 2] — Resolved: new User Story 2 acceptance scenario #4 makes progressive reveal a tested requirement.
- [x] CHK012 If IMDb lookups are triggered in parallel with the search call, does the spec address whether a slow-resolving IMDb lookup is prohibited from delaying or blocking the rendering of the search result itself (title/poster/overview)? [Coverage, Edge Case, Gap] — Resolved: FR-022's last sentence — slow lookup MUST NOT affect card rendering.

## Add-Time Cache Reuse vs Re-fetch (FR-007 vs FR-014)

- [x] CHK013 Does FR-007 (add-time IMDb lookup) specify whether it must first check the session-scoped cache established by FR-014 before issuing a new TMDB call, or does it always perform an independent fetch? [Gap, Spec §FR-007 vs §FR-014] — Resolved: FR-023 — cache-first, explicit fallback to FR-007 only when no cache hit.
- [x] CHK014 Is there a stated rule for what happens to a search result's session-cached IMDb identifier when that same movie is added to a list shortly afterward — consumed/promoted into the persisted entry, or discarded and independently re-resolved? [Completeness, Gap] — Resolved: FR-023 + Key Entities amendment — reuse is the stated rule.
- [x] CHK015 The Key Entities section states a Search Result's cached identifier "is discarded if the result is never added to a list" — does this imply the identifier is reused when the result *is* added, and if so, is that reuse path stated as a testable requirement rather than left as an inference from entity-lifecycle text? [Ambiguity, Spec §Key Entities] — Resolved: Key Entities amendment makes the reuse-on-add path an explicit, testable statement rather than an inference.
- [x] CHK016 Is the risk of a duplicate TMDB lookup for the same movie within seconds (once for search-result display per FR-004, once for add-time persistence per FR-007) addressed anywhere in the Requirements or Assumptions sections? [Coverage, Gap] — Resolved: FR-023 directly addresses the duplicate-lookup risk by mandating reuse.

## Notes

- Four focus areas investigated per user request: (1) whether "582 entries" in FR-009/User Story 4 could be misread as a literal completeness target rather than illustrative context; (2) whether the search-result lookup bound tied to 001-movie-watchlist's 10-result cap is stated explicitly enough to test standalone; (3) whether FR-016 disambiguates sequential-after-render vs. parallel-with-search-call resolution timing; (4) whether an already-resolved search-result IMDb identifier is reused at add-time (FR-007) or always independently re-fetched.
- None of these four points currently have an explicit answer in spec.md as written — each checklist item above surfaces a specific gap or ambiguity rather than confirming existing coverage. Recommend running `/speckit-clarify` targeting these four areas before `/speckit-plan`.
