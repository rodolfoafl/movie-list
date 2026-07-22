# Implementation Plan: Shared Movie Watchlist

**Branch**: `001-movie-watchlist` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-movie-watchlist/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

A private, shared movie watchlist for exactly two pre-registered users: create named lists, search TMDB for movies, add them to lists (with per-list duplicate prevention), and toggle watched/unwatched with a recorded date. Built on Next.js 16 (App Router, TypeScript, Tailwind), deployed to Vercel, with Neon Postgres via Drizzle ORM, Auth.js v5 credentials-provider session auth, a single server-side Route Handler as the sole TMDB egress point, and Vitest-based tests for the spec's business rules. Full rationale in [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20.9+ (Next.js 16 minimum requirement)

**Primary Dependencies**: Next.js 16.2.11 (App Router, Turbopack default), React 19.2, Tailwind CSS v4, Drizzle ORM + drizzle-kit, `@neondatabase/serverless`, `next-auth@beta` (Auth.js v5, `5.0.0-beta.32` — no stable `5.x` exists on npm, see research.md §4), `bcryptjs` — **no `@auth/drizzle-adapter`**: verified unused, since Credentials-provider sign-in with JWT sessions never calls adapter methods (research.md §4)

**Storage**: Neon Postgres (serverless HTTP driver) — 3 tables (`users`, `lists`, `movie_entries`); no `sessions` table (sessions are JWT-based, not database-based — research.md §4); see [data-model.md](./data-model.md)

**Testing**: Vitest, run against a real test Postgres instance (Neon branch or local Docker Postgres), not mocks — see [research.md](./research.md) §8

**Target Platform**: Vercel (serverless functions, Node.js runtime — this Next.js version's `proxy.ts` does not support the Edge runtime)

**Project Type**: Web application (single Next.js project — no separate frontend/backend split)

**Performance Goals**: Lighthouse performance ≥ 90 (mobile) on list pages (spec Non-functional Requirements)

**Constraints**: Usable from 360px width up; Lighthouse accessibility ≥ 90; all actions keyboard-reachable; UI in pt-BR; must run entirely on free tiers (Vercel + Neon free tier + TMDB free API)

**Scale/Scope**: Exactly 2 users, unbounded (but personal-scale) lists and entries; 4 user stories, ~10 screens/views total (login, lists overview, list detail with search overlay)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template (all principles are `[PRINCIPLE_N_NAME]` placeholders) — there is no project-specific constitution to gate against yet. In its absence, this plan is held to the technical constraints stated directly in the spec (§5 Technical Constraints, §4 Non-functional Requirements) and to general simplicity discipline:

| Gate | Status | Note |
|---|---|---|
| No unjustified extra projects/services | PASS | Single Next.js app; no separate backend, no microservices |
| No speculative abstraction | PASS | 3 tables, Server Actions per mutation, one Route Handler for the one true external integration (TMDB) |
| Tests for business rules required by spec | PASS (planned) | Vitest suite scoped in research.md §8 to exactly the rules the spec calls out |
| Stack matches user-mandated constraints | PASS | Next.js App Router + TS + Tailwind + Vercel + Postgres/typed-ORM + Auth.js credentials + server-only TMDB — all explicitly required, all present |
| Free-tier feasibility | PASS | Vercel, Neon, and TMDB all have free tiers sufficient for 2 users (spec §4 Cost) |

No violations to justify in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-movie-watchlist/
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
├── layout.tsx                       # root layout (html lang="pt-BR")
├── login/
│   ├── page.tsx
│   └── actions.ts                   # signInAction (contracts/auth.md)
├── (lists)/
│   ├── page.tsx                     # lists overview (User Story 1, 2)
│   ├── actions.ts                   # createList, renameList, deleteList
│   └── [listId]/
│       ├── page.tsx                 # list detail: search, add, watched toggle, filter
│       └── actions.ts               # addMovieToList, removeMovieFromList, toggleWatched
├── api/
│   └── tmdb/
│       └── search/
│           └── route.ts             # sole TMDB egress point (contracts/tmdb-search.md)
└── lib/
    ├── db/
    │   ├── schema.ts                # Drizzle schema (data-model.md)
    │   └── client.ts                # Neon HTTP driver + drizzle()
    ├── auth.ts                      # Auth.js config, Credentials provider, `auth()`
    ├── dal.ts                       # verifySession() — authoritative auth check
    └── tmdb.ts                      # TMDB fetch wrapper, used only by api/tmdb/search

proxy.ts                             # optimistic session redirect (Next.js 16 — renamed from middleware.ts)
drizzle/                             # drizzle-kit generated migrations

tests/
├── integration/                     # against a real test Postgres — see research.md §8
│   ├── lists.test.ts                # uniqueness (incl. race), rename-exception, cascade delete
│   ├── movie-entries.test.ts        # duplicate prevention, multi-list independence
│   └── watched.test.ts              # watched/unwatched date recording
└── unit/
    └── tmdb-filter.test.ts          # dropping results without a usable id (CHK021)
```

**Structure Decision**: Single Next.js App Router project (spec explicitly rules out a separate backend — "TMDB accessed exclusively through server-side API routes" within the same app). Route-colocated Server Actions (`app/(lists)/actions.ts`, `app/(lists)/[listId]/actions.ts`) keep each mutation next to the UI that calls it, per research.md §6. `app/lib/` holds the three cross-cutting server modules (db, auth, TMDB client) shared by both the pages and the one Route Handler. Tests live outside `app/` in a top-level `tests/` directory, split `integration/` (real DB) vs `unit/` (pure functions like the TMDB result filter), matching research.md §8.

## Complexity Tracking

*No constitution violations to justify — see Constitution Check above (no active constitution; gated against spec's own stated constraints, all satisfied).*
