# Spec Amendments — Mutation-Safety Checklist Resolution

**Applies to:** specs/002-global-search/spec.md
**Source:** checklists/mutation-safety.md review

Paste the sections below into spec.md as indicated, then mark the
corresponding CHK items using the resolution table at the end.

---

## 1. ADD these Functional Requirements (continuing from FR-018)

- **FR-019**: The modal's list set and each list's checked/disabled state
  MUST NOT be re-fetched or live-updated while the modal remains open; both
  reflect a snapshot taken at the moment the modal opens (promotes the
  existing Assumption to a testable requirement).

- **FR-020**: Retrying a failed per-list add MUST be done by reopening the
  "add to list" modal for that movie — which recomputes every list's
  checked/disabled state from current data per FR-010 — and confirming again
  (governed by the same FR-009 confirmation behavior). No separate retry
  mechanism, retry button, or retry-specific state is required.

- **FR-021**: If a list shown in the modal was deleted between modal-open
  and confirmation, attempting to add the movie to it MUST be reported as a
  per-list failure (reason: list no longer exists), and MUST NOT abort or
  fail the confirmation for the other checked lists.

- **FR-022**: If the movie was already added to a checked list by a
  concurrent action (e.g., the other user) between modal-open and
  confirmation, this MUST be treated as a per-list SUCCESS (the desired end
  state — movie present in that list — already holds), not a duplicate
  error.

- **FR-023**: Per-list failure reports (FR-012) MUST include the list's name
  and a short human-readable reason (e.g., "lista não existe mais", "não foi
  possível adicionar, tente novamente").

- **FR-024**: The create-list-from-modal path (FR-013) MUST enforce the same
  validation as the primary list-creation flow: non-empty after trim
  (existing FR-004 semantics from 001-movie-watchlist), maximum 60
  characters (existing FR-026), and case/whitespace-insensitive duplicate
  rejection (existing FR-005) — using the same inline error messaging style
  as the primary flow.

- **FR-025**: The create-list prompt (FR-013) MUST be presented INLINE
  within the same "add to list" modal (not a navigation away from the
  search page), so that after successful creation the user can immediately
  select the new list and confirm without redoing the search (FR-014). If
  list creation itself fails validation (FR-024), the user MUST remain in
  the same modal/context to correct it.

## 2. AMEND Edge Cases section

Add: "If the user confirms with no newly-checked (non-disabled) lists
selected, this is a no-op and MUST NOT be reported as a failure — FR-012's
per-list reporting applies only to lists the user actually attempted to add
to in that confirmation."

## 3. ADD these Assumptions

- Retries are manual only: the user re-triggers the flow by reopening the
  modal. There is no automatic retry, no retry limit, and no time-based
  staleness limit on how long a modal may remain open before confirming —
  acceptable given the app's 2-user, low-concurrency scale (consistent with
  the base app's existing last-write-wins model; this feature does not
  introduce a stricter consistency guarantee than the rest of the app).
- A per-list add attempt has exactly three possible outcomes when a
  confirmation completes: success (inserted, or already present via FR-022),
  failure (FR-021 and other transient errors), or not-attempted (list was
  already checked-disabled at modal-open and untouched by this confirmation).

## 4. Resolution table for checklists/mutation-safety.md

| Item | Resolution |
| --- | --- |
| CHK001 | Resolved: FR-023 specifies message content (list name + short reason) |
| CHK002 | Resolved: FR-021 (deleted list) and FR-023 (generic transient reason) name the causes; further transient-error taxonomy deferred to plan |
| CHK003 | Resolved: FR-020 — retry = reopen modal, governed by FR-009 |
| CHK004 | Resolved: FR-010's recompute-from-current-data makes "already succeeded" directly observable (checked+disabled) |
| CHK005 | Resolved: total failure is the N=0-successes case of the same per-list reporting mechanism — no separate handling needed |
| CHK006 | Resolved: FR-020 clarifies retry is a new FR-009 confirmation, not a third state; FR-015 (cancel) still governs pre-confirmation exits only |
| CHK007 | Resolved: new assumption — retries are manual and unbounded, acceptable at this app's scale |
| CHK008 | Resolved: FR-021 |
| CHK009 | Resolved: FR-022 — concurrent add by the other user is treated as success, not duplicate error |
| CHK010 | Resolved: FR-019 promotes the snapshot assumption to a testable requirement |
| CHK011 | Resolved: FR-021 (same as CHK008 — deletion mid-flight is a per-list failure, not a fatal error) |
| CHK012 | Resolved: new assumption explicitly ties this feature's behavior to the base app's last-write-wins model — no stricter guarantee implied |
| CHK013 | Resolved: new assumption — no staleness TTL; acceptable at this scale |
| CHK014 | Resolved: Edge Cases amendment — no-op confirmations are not reported as failures |
| CHK015 | Resolved: FR-024 |
| CHK016 | Resolved: FR-024 |
| CHK017 | Resolved: FR-024 |
| CHK018 | Resolved: FR-024 ("same inline error messaging style") |
| CHK019 | Resolved: FR-025 — inline within the modal, not a navigation |
| CHK020 | Resolved: FR-025's last sentence — user remains in context to correct validation errors |
