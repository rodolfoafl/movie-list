# Requirements Quality Checklist: Multi-List Mutation Safety & Consistency

**Purpose**: Validate requirements quality (completeness, clarity, consistency, measurability) for three risk areas in the global search feature: multi-list add mutation semantics (partial failure/retry), stale-modal-state races against concurrent edits, and the create-list-from-modal path's alignment with existing list-creation rules.
**Created**: 2026-07-27
**Feature**: [spec.md](../spec.md)
**Depth**: Standard
**Audience/Timing**: Spec reviewer, pre-`/speckit-plan` gate

**Note**: This checklist tests whether the *requirements are written well enough to implement and test against* — it does not verify that any implementation behaves correctly.

## Multi-List Mutation Semantics (Partial Failure & Retry)

- [x] CHK001 Is "reported per-list success/failure" (FR-012) specified with enough detail to know the required message content, or only as a general obligation to report something? [Clarity, Spec §FR-012] — Resolved: FR-023 specifies message content (list name + short reason)
- [x] CHK002 Does the spec define what triggers a per-list failure (e.g., transient error, list deleted mid-flight, name/permission issue) that FR-012 requires the system to report? [Completeness, Gap, Spec §FR-012] — Resolved: FR-021 (deleted list) and FR-023 (generic transient reason) name the causes; further transient-error taxonomy deferred to plan
- [x] CHK003 Is "retry the failed ones" (FR-012) defined as a distinct requirement — e.g., does retry re-open the same modal, require a new confirmation, or auto-retry — or is the trigger for a retry left unspecified? [Clarity, Ambiguity, Spec §FR-012] — Resolved: FR-020 — retry = reopen modal, governed by FR-009
- [x] CHK004 Is the guarantee that "lists which already succeeded are not duplicated on retry" measurable/testable as written, i.e., is "already succeeded" a state the requirements make identifiable? [Measurability, Spec §FR-012] — Resolved: FR-010's recompute-from-current-data makes "already succeeded" directly observable (checked+disabled)
- [x] CHK005 Does the spec distinguish total failure (every checked list fails) from partial failure, or does FR-012 only address the partial case explicitly? [Coverage, Gap, Spec §FR-012] — Resolved: total failure is the N=0-successes case of the same per-list reporting mechanism — no separate handling needed
- [x] CHK006 Are FR-012 (partial failure retry) and FR-015 (canceling the modal changes nothing) consistent regarding what "canceling" means once a partial failure has already been confirmed once — is a post-failure retry a new "confirmation" governed by FR-009, or an undefined third state? [Consistency, Spec §FR-009, §FR-012, §FR-015] — Resolved: FR-020 clarifies retry is a new FR-009 confirmation, not a third state; FR-015 (cancel) still governs pre-confirmation exits only
- [x] CHK007 Does the spec bound how many times or how long a user may retry a failed per-list add, or is unlimited/unbounded retry an implicit assumption? [Gap, Edge Case] — Resolved: new assumption — retries are manual and unbounded, acceptable at this app's scale

## Stale Modal State & Concurrency Races

- [x] CHK008 Does the spec define the required behavior when a list shown in the modal is deleted (by the other user) after the modal snapshot is taken but before the user confirms? [Gap, Coverage, Spec §Edge Cases] — Resolved: FR-021
- [x] CHK009 Does the spec define the required behavior when the movie is added to one of the shown lists (by the other user, concurrently) between modal-open and confirm — is this scenario covered by the same no-duplicate-error guarantee (FR-011) as the "already contained it at open time" case, or left ambiguous? [Ambiguity, Spec §FR-010, §FR-011] — Resolved: FR-022 — concurrent add by the other user is treated as success, not duplicate error
- [x] CHK010 The Assumptions section states the modal's list set is "a snapshot taken when the modal opens" — is this snapshot behavior also asserted as a testable functional requirement, or does it exist only as an assumption with no corresponding FR to verify against? [Consistency, Spec §Assumptions, Gap] — Resolved: FR-019 promotes the snapshot assumption to a testable requirement
- [x] CHK011 Does the spec specify what the user sees/what happens if they confirm against a list that was deleted before confirmation completes — silent skip, explicit error, or something else? [Gap, Exception Flow] — Resolved: FR-021 (same as CHK008 — deletion mid-flight is a per-list failure, not a fatal error)
- [x] CHK012 Is the concurrency/conflict-resolution behavior implied by this feature (snapshot-at-open, no live update) explicitly reconciled with the base app's documented last-write-wins model, or could a reader reasonably infer a stricter or different guarantee is being made here? [Consistency, Cross-Spec, Spec §Assumptions] — Resolved: new assumption explicitly ties this feature's behavior to the base app's last-write-wins model — no stricter guarantee implied
- [x] CHK013 Does the spec define any upper bound on how long a modal may remain open before its snapshot is considered too stale to safely confirm against, or is indefinite staleness implicitly accepted? [Gap, Edge Case] — Resolved: new assumption — no staleness TTL; acceptable at this scale
- [x] CHK014 Is the no-op behavior for "user confirms with no new (non-disabled) selections" (Edge Cases) reconciled with the partial-failure reporting requirement (FR-012) — i.e., is it clear a no-op confirmation must not itself be reported as a "failure"? [Consistency, Spec §Edge Cases, §FR-012] — Resolved: Edge Cases amendment — no-op confirmations are not reported as failures

## Create-List-from-Modal Consistency

- [x] CHK015 Does the spec explicitly require the create-list-from-modal path (FR-013/FR-014) to enforce the same non-empty-after-trim rule used by the primary list-creation flow, or does it only state that a list gets "created"? [Gap, Consistency, Spec §FR-013] — Resolved: FR-024
- [x] CHK016 Does the spec explicitly require the create-list-from-modal path to enforce the existing 60-character list-name limit, or is this left unstated and assumed by inheritance? [Gap, Consistency] — Resolved: FR-024
- [x] CHK017 Does the spec explicitly require the create-list-from-modal path to apply the same case-insensitive duplicate-name rejection used by the primary create/rename flow? [Gap, Consistency] — Resolved: FR-024
- [x] CHK018 Is it specified whether validation error messaging in the create-list-from-modal path must match the inline messaging style of the primary list-management flow, or is divergent messaging left open? [Gap, Consistency] — Resolved: FR-024 ("same inline error messaging style")
- [x] CHK019 FR-013/FR-014 describe prompting the user to "create a list first" — is it clear from the requirements whether this is an inline form within the same modal/flow, or a navigation away from search — since FR-014's guarantee ("without needing to redo the search") depends on which one is meant? [Ambiguity, Spec §FR-013, §FR-014] — Resolved: FR-025 — inline within the modal, not a navigation
- [x] CHK020 Does the spec define what happens if list creation itself fails validation (e.g., duplicate/too-long name) from within the "add to list" flow — does the user remain in context to correct it, or is that left unspecified? [Gap, Exception Flow] — Resolved: FR-025's last sentence — user remains in context to correct validation errors

## Notes

- Items reference the base list-creation rules (trim/60-char/duplicate-name) as documented in `001-movie-watchlist`'s spec (FR-004, FR-005, FR-026); this checklist treats their reuse by the new create-list-from-modal path as an open requirements question rather than assuming it, since 002-global-search's spec does not currently cross-reference those FRs explicitly.
- No plan.md or tasks.md exist yet for this feature; this checklist was generated from spec.md only.
