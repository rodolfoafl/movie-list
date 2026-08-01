# Spec Amendments — IMDb Resolution Semantics Checklist Resolution

**Status: APPLIED — fully merged into spec.md on 2026-07-31. Kept as historical record of the imdb-resolution checklist's resolution.**

**Applies to:** specs/003-imdb-links/spec.md
**Source:** checklists/imdb-resolution.md review

Paste the sections below into spec.md as indicated, then mark the
corresponding CHK items using the resolution table at the end.

---

## 1. REPLACE — User Story 4's rationale sentence

Old: "...existed before this feature shipped, including the 582 entries
brought over by the earlier legacy-data migration, so User Story 1 isn't
limited to newly-added movies."

New: "...existed before this feature shipped — including the entries
brought over by the earlier legacy-data migration (582 at the time of
that migration; the actual count at backfill run-time will be higher,
reflecting everything added since) — so User Story 1 isn't limited to
newly-added movies."

## 2. REPLACE — FR-009

Old: "A one-time backfill process MUST be available to resolve and store
IMDb identifiers for every pre-existing movie entry that lacks one,
including the 582 entries brought over by the earlier legacy-data
migration."

New: "**FR-009**: A one-time backfill process MUST be available to
resolve and store IMDb identifiers for every `movie_entries` row that
lacks one **at the time the process runs** — this includes, but is not
bounded by, the entries originally brought over by the legacy-data
migration; the figure of 582 describes that migration's historical scope,
not a literal count this process must match."

## 3. ADD — three new Functional Requirements (continuing from FR-020)

- **FR-021**: Search-result IMDb lookups triggered for a single settled
  query MUST NOT exceed the number of results actually displayed for that
  query — i.e., bounded by the search feature's own existing result-count
  cap (currently 10, per 001-movie-watchlist's Polish phase), expressed
  *relative to* whatever that cap is at any given time rather than as an
  independently hardcoded number. A future change to the search result cap
  is automatically reflected in this bound without requiring a separate
  update to this spec.

- **FR-022**: IMDb identifier resolution for search results MUST be
  sequential-after-render: a result's title, poster, release year, and
  overview MUST render immediately once the underlying search settles —
  exactly as today, unaffected by this feature — with the IMDb link (once
  resolved) appearing as a subsequent, non-blocking update to that same
  card. A slow or failed IMDb lookup MUST NOT delay, gate, or otherwise
  affect the rendering of the rest of the card.

- **FR-023**: When a movie is added to a list (FR-007), if that movie's
  IMDb identifier has already been resolved and cached in the current
  session (per FR-014, from an earlier search-result resolution), the add
  action MUST reuse that cached identifier directly rather than issuing a
  new lookup. The independent add-time lookup described in FR-007/FR-008
  applies only when no session-cached identifier exists for that movie.

## 4. ADD — new acceptance scenario under User Story 2

"4. **Given** a search result has rendered before its IMDb identifier
resolves, **When** the identifier resolves shortly afterward, **Then**
the IMDb link appears on that already-rendered card without re-rendering,
reordering, or otherwise disturbing the rest of the card's content."

## 5. AMEND — Key Entities' "Search Result" bullet

Old: "...this identifier exists only for the duration of the search
session in which it was resolved, and is discarded if the result is never
added to a list."

New: "...this identifier exists only for the duration of the search
session in which it was resolved. If the result is added to a list within
that session, its cached identifier is reused as the persisted entry's
IMDb identifier per FR-023, rather than being independently re-fetched; if
the result is never added, the cached identifier is simply discarded at
the end of the session."

## 6. Resolution table for checklists/imdb-resolution.md

| Item | Resolution |
| --- | --- |
| CHK001 | Resolved: FR-009 rewording explicitly frames 582 as historical, not literal |
| CHK002 | Resolved: FR-009 — "at the time the process runs", not bounded by the original count |
| CHK003 | Resolved (no change needed): SC-003 already anchors to "every pre-existing movie entry", never cited 582 — confirmed consistent with the corrected FR-009 |
| CHK004 | Resolved: User Story 4 rationale amendment clarifies 582 is Story 1's original motivating context, not Story 4's test input |
| CHK005 | Resolved: FR-021 states the bound inside this spec |
| CHK006 | Resolved: FR-021 quantifies "proportionate" as "no more than results displayed" |
| CHK007 | Resolved: FR-021 explicitly cross-references 001-movie-watchlist's cap by name |
| CHK008 | Resolved: FR-021's relative phrasing ("whatever that cap is at any given time") makes the bound track future changes automatically |
| CHK009 | Resolved: FR-022 — explicitly sequential-after-render |
| CHK010 | Resolved: FR-022 — link appears as a subsequent, non-blocking update |
| CHK011 | Resolved: new User Story 2 acceptance scenario #4 makes progressive reveal a tested requirement |
| CHK012 | Resolved: FR-022's last sentence — slow lookup MUST NOT affect card rendering |
| CHK013 | Resolved: FR-023 — cache-first, explicit fallback to FR-007 only when no cache hit |
| CHK014 | Resolved: FR-023 + Key Entities amendment — reuse is the stated rule |
| CHK015 | Resolved: Key Entities amendment makes the reuse-on-add path an explicit, testable statement rather than an inference |
| CHK016 | Resolved: FR-023 directly addresses the duplicate-lookup risk by mandating reuse |