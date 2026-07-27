# Implementation Plan: Global Movie Search

**Branch**: `002-global-search` | **Date**: 2026-07-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-global-search/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Add a destination-agnostic movie search page (`/search`) reachable from anywhere in the app, reusing the existing TMDB search route handler unchanged. Each result gets an "add to list" action opening a modal that shows every list as a checkbox (already-containing lists pre-checked and disabled), lets the user check any number of lists, and adds the movie to all of them in one confirmation. The modal's list set is a snapshot fetched once on open (never re-fetched while open); the confirmation calls a single new `confirmAddToLists` Server Action, which checks the session once and then reuses the existing `addMovieToList` Server Action once per checked list via a server-side `Promise.allSettled`, wrapped in a thin new per-list outcome classifier (needed because Next.js sanitizes thrown Server Action errors before they reach the client, so "list was deleted" vs. "transient failure" must be classified server-side). If no lists exist, the modal prompts inline list creation reusing `createList`'s existing validation unchanged. See [research.md](./research.md) for the six design decisions this rests on.

## Technical Context

**Language/Version**: TypeScript 5, Next.js 16.2.11 (App Router), React 19.2.4

**Primary Dependencies**: Drizzle ORM 0.45 + `@neondatabase/serverless` (Postgres), `next-auth` v5-beta (session via `verifySession()` in `app/lib/dal`), `lucide-react` (icons, per CLAUDE.md), Tailwind CSS v4

**Storage**: PostgreSQL (Neon serverless), via existing `lists` / `movie_entries` tables (`app/lib/db/schema.ts`) — **no schema migration required** for this feature

**Testing**: Vitest 4, two existing projects — `unit` (`tests/unit/**`, no DB) and `integration` (`tests/integration/**`, real `TEST_DATABASE_URL`, `fileParallelism: false`)

**Target Platform**: Web — same Next.js app, no new deployment target

**Project Type**: Single Next.js web application (no separate frontend/backend split)

**Performance Goals**: No new perf target beyond existing SC-001 (search page reachable in <10s) / SC-002 (add to 3 lists in <20s) — both satisfied by reusing the existing 400ms-debounced TMDB route and adding at most one extra snapshot query on modal open

**Constraints**: FR-016 (360px usable, no horizontal scroll), FR-017 (all new UI text in pt-BR), FR-018 (fully keyboard-operable), FR-019 (modal snapshot never re-fetched while open), CLAUDE.md's Lighthouse accessibility ≥90 gate and lucide-react-only icon rule

**Scale/Scope**: Existing 2-user shared workspace, small number of lists (tens, not thousands) — no pagination or indexing work introduced

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template (`[PROJECT_NAME] Constitution` with bracketed placeholders throughout, no ratified principles, no version). There are no concrete gates to evaluate against — this is not a violation of this feature's plan, just a note that the project has not yet run `/speckit-constitution`. No complexity needs justifying against a constitution that doesn't exist yet. Re-checked post-design (Phase 1): still true, no change.

## Project Structure

### Documentation (this feature)

```text
specs/002-global-search/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
app/
├── layout.tsx                       # MODIFIED — renders new AppHeader
├── search/                          # NEW
│   ├── page.tsx                     # Server Component: verifySession + renders GlobalMovieSearch
│   ├── GlobalMovieSearch.tsx        # Client component: search input/results via shared hook+card,
│   │                                 # "Adicionar à lista" opens AddToListModal
│   ├── AddToListModal.tsx           # Client component: native <dialog>, snapshot fetch on open,
│   │                                 # checkboxes, inline create-list, confirm → confirmAddToLists
│   └── actions.ts                   # NEW Server Actions: getListsForMovie, addMovieToListWithOutcome
│                                     # (single-list, unmodified), confirmAddToLists (session check once
│                                     # + server-side Promise.allSettled over addMovieToListWithOutcome —
│                                     # the modal's one confirm-flow entry point)
├── components/                      # NEW shared UI (used by both search surfaces)
│   ├── AppHeader.tsx                # Minimal persistent nav: "Minhas listas" (/) + "Buscar filmes" (/search)
│   ├── useTmdbSearch.ts             # Extracted debounce/fetch state machine (from MovieSearch.tsx)
│   └── MovieResultCard.tsx          # Extracted result-card markup, renderAction slot
├── (lists)/
│   ├── actions.ts                   # MODIFIED — createList success return gains {id, name}
│   ├── page.tsx                     # unchanged
│   └── [listId]/
│       ├── actions.ts               # UNCHANGED — addMovieToList reused as-is
│       └── MovieSearch.tsx          # MODIFIED — refactored onto useTmdbSearch + MovieResultCard,
│                                     # list-scoped add behavior preserved exactly
└── api/tmdb/search/route.ts         # UNCHANGED — reused by useTmdbSearch

tests/
├── unit/                            # existing project, no DB
└── integration/                     # existing project, real TEST_DATABASE_URL
    ├── get-lists-for-movie.test.ts       # NEW
    ├── add-movie-to-list-with-outcome.test.ts  # NEW — deleted-list, already-in-list-as-success, generic-failure
    ├── confirm-add-to-lists.test.ts      # NEW — single verifySession + listId-zip over multiple lists
    └── lists.test.ts                # touched — regression test for createList's new {id,name} success shape
```

**Structure Decision**: Single Next.js App Router application (matches the existing repo — no frontend/backend split, no new project). All new code lives under a new `app/search/` route segment plus a new `app/components/` folder for the two pieces shared between the existing in-list search and the new global search. No new top-level directory, no new package, no DB migration.

## Complexity Tracking

*No entries — the Constitution Check above found no ratified constitution to violate, and this feature introduces no new project, service, or repository-pattern-style indirection. The one deliberate deviation from existing codebase style (extracting shared search UI instead of duplicating, per [research.md](./research.md) §5) is justified there against the concrete alternative, not listed here since it is not a constitutional violation.*
