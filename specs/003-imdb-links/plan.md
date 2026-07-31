# Implementation Plan: IMDb Links on Movie Cards

**Branch**: `003-imdb-links` | **Date**: 2026-07-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-imdb-links/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Add a plain-text "IMDb" link to movie entries on list-detail pages and to search result cards (both in-list and global search, via the shared `MovieResultCard`). `movie_entries` gains a nullable `imdb_id` column, resolved from TMDB's `GET /movie/{id}?append_to_response=external_ids` at add-time inside the existing `addMovieToList` flow — best-effort, never blocking the add. Search results resolve their own IMDb id via a new authenticated Route Handler, one extra TMDB call per rendered result, triggered only after that query's results have already settled (piggybacking on the existing 400ms debounce rather than adding a second one), cached for the life of the search session, and cancelled when a newer query supersedes it — keeping added volume proportionate to distinct settled queries and previously-unseen movies (FR-017, FR-021), not keystrokes. A same-shape standalone backfill script (`scripts/backfill-imdb-ids.ts`, mirroring `scripts/migrate-legacy.ts`) resolves `imdb_id` for every pre-existing `movie_entries` row lacking one, sequentially, rate-limited, idempotent, with an end-of-run orphan report. See [research.md](./research.md) for the eight design decisions this rests on.

## Technical Context

**Language/Version**: TypeScript 5, Next.js 16.2.11 (App Router), React 19.2.4

**Primary Dependencies**: Drizzle ORM 0.45 + `@neondatabase/serverless` (Postgres), `next-auth` v5-beta (session via `verifySession()` in `app/lib/dal`), `lucide-react` (icons, per CLAUDE.md — not needed for this feature's text-only link, but governs any icon touched incidentally), Tailwind CSS v4

**Storage**: PostgreSQL (Neon serverless) — **one schema migration required**: `movie_entries` gains a nullable `imdb_id` (`text`) column, no index (never queried by value, only read per-row)

**Testing**: Vitest 4, two existing projects — `unit` (`tests/unit/**`, no DB) and `integration` (`tests/integration/**`, real `TEST_DATABASE_URL`, `fileParallelism: false`)

**Target Platform**: Web — same Next.js app, no new deployment target

**Project Type**: Single Next.js web application (no separate frontend/backend split)

**Performance Goals**: No new latency target for the add flow itself (SC-002 — add must feel exactly as fast as today); the TMDB external-ids lookup on add is best-effort with a bounded timeout so a slow/failing call can never visibly delay the add. Search-result lookups are non-blocking relative to existing card rendering (FR-022) and bounded to at most one extra TMDB call per distinct, previously-unseen result per settled query (FR-021), capped by the existing 10-result search cap.

**Constraints**: FR-008 (add-time lookup failure/timeout must not block or fail the add), FR-014/FR-015/FR-016/FR-017 (session-cache reuse, stale-query cancellation, debounce-aligned triggering, keystroke-disproportionate volume), FR-021 (lookup volume bound expressed relative to the search cap, not hardcoded), FR-022 (sequential-after-render, non-blocking card update), FR-023 (add-time reuse of a session-cached id ahead of a fresh lookup), FR-019 (360px, no horizontal scroll, no crowding of existing actions), CLAUDE.md's Lighthouse accessibility ≥90 gate

**Scale/Scope**: Existing 2-user shared workspace; ~582+ pre-existing `movie_entries` rows to backfill (582 from the legacy migration plus everything added since, per FR-009) — no pagination or indexing work introduced

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template (`[PROJECT_NAME] Constitution` with bracketed placeholders throughout, no ratified principles, no version) — same state as when 002-global-search was planned. There are no concrete gates to evaluate against. No complexity needs justifying against a constitution that doesn't exist yet. Re-checked post-design (Phase 1): still true, no change.

## Project Structure

### Documentation (this feature)

```text
specs/003-imdb-links/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
├── checklists/            # already present (imdb-resolution.md, requirements.md — pre-plan)
├── spec-amendments.md     # already present — historical record, checklist already merged into spec.md
└── tasks.md               # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
app/
├── lib/
│   ├── db/schema.ts                 # MODIFIED — movie_entries gains nullable imdb_id (text)
│   └── tmdb.ts                      # MODIFIED — adds fetchExternalIds (throws, low-level) and
│                                      # resolveImdbId (safe wrapper, never throws, used by add-time
│                                      # flow and the new route handler)
├── (lists)/[listId]/
│   ├── actions.ts                   # MODIFIED — addMovieToList: MovieSnapshot gains optional
│   │                                  # imdbId?: string | null (FR-023 tri-state: undefined = "look
│   │                                  # it up", null = "already tried, no match", string = "resolved");
│   │                                  # insert now stores movieEntries.imdbId
│   └── page.tsx                     # MODIFIED — list-detail entry row renders <ImdbLink imdbId={entry.imdbId} />
├── search/
│   ├── GlobalMovieSearch.tsx         # MODIFIED — consumes new useImdbIds hook, passes resolved id
│   │                                  # into MovieResultCard and into the AddToListModal's movie prop
│   └── AddToListModal.tsx            # UNCHANGED — already forwards movie (now carrying imdbId) as-is
│                                      # to confirmAddToLists → addMovieToListWithOutcome → addMovieToList
├── components/
│   ├── MovieResultCard.tsx           # MODIFIED — new optional imdbId prop, renders <ImdbLink>
│   ├── ImdbLink.tsx                  # NEW — shared presentational link (plain "IMDb" text,
│   │                                  # target="_blank" rel="noopener"), renders nothing when
│   │                                  # imdbId is null/undefined (FR-003, FR-005)
│   └── useImdbIds.ts                 # NEW — per-mount session cache + fetch/cancel state machine
│                                      # (FR-014/015/016/017/021/022) driving the new route handler
├── (lists)/[listId]/MovieSearch.tsx  # MODIFIED — consumes useImdbIds the same way as GlobalMovieSearch
└── api/tmdb/
    ├── search/route.ts               # UNCHANGED
    └── external-ids/route.ts         # NEW — GET, one TMDB lookup per call, auth-gated like
                                        # tmdb/search, never surfaces a distinguishable error (FR-003/FR-005's
                                        # graceful-absence contract collapses all failure modes to null);
                                        # sets `export const dynamic = "force-dynamic"` explicitly — verified
                                        # against Next.js 16.2.11 source that it's dynamic-by-default anyway
                                        # (research.md §3), added regardless as a safety net

scripts/
└── backfill-imdb-ids.ts              # NEW — same shape as migrate-legacy.ts: sequential, rate-limited
                                        # (250ms), idempotent (WHERE imdb_id IS NULL), circuit-breaker on
                                        # consecutive API errors, end-of-run orphan report distinguishing
                                        # lookup-failed vs no-match (FR-012)

drizzle/
└── XXXX_*.sql                        # NEW — generated by `drizzle-kit generate` from the schema change
                                        # (not written by hand; produced in the implementation phase)

tests/
├── unit/                              # existing project, no DB
│   └── use-imdb-ids.test.ts           # NEW (or equivalent) — cache/cancel state machine, no network
└── integration/                       # existing project, real TEST_DATABASE_URL
    ├── add-movie-to-list.test.ts       # touched — regression: imdb_id persisted/null on lookup outcome,
    │                                    # tri-state cache-reuse behavior (FR-023)
    └── external-ids-route.test.ts      # NEW — auth gate, graceful-null on TMDB failure
```

**Structure Decision**: Single Next.js App Router application (matches 001/002 — no frontend/backend split, no new project, no new top-level directory beyond the one new script). All new UI code is additive within the existing `app/components/` and `app/api/tmdb/` conventions established by 002-global-search; the one schema change is additive (new nullable column, no backfill required for existing rows to keep working — FR-006). The backfill script lives alongside the existing `scripts/migrate-legacy.ts`, reusing its operational shape rather than introducing a new one.

## Complexity Tracking

*No entries — the Constitution Check above found no ratified constitution to violate, and this feature introduces no new project, service, or repository-pattern-style indirection. The two deliberate deviations from the simplest-possible approach — (a) splitting TMDB external-id lookups into a throwing low-level function plus a safe wrapper (research.md §2) instead of one function, and (b) a dedicated `useImdbIds` hook instead of inlining fetch logic into each search component (research.md §4) — are both justified in research.md against their concrete alternatives, not listed here since neither is a constitutional violation.*
