# Implementation Plan: Filter Lists by Name on the Overview Page

**Branch**: `004-lists-filter` | **Date**: 2026-08-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-lists-filter/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Add a live, case-insensitive, accent-sensitive name filter to the lists overview page, restructured into a 2-column layout (create-list form left, filter input right on desktop; filter first, form second when stacked on narrow viewports) — restoring 2020-app parity (GitHub issue #9). Typing debounces (400ms, matching `useTmdbSearch`'s existing pattern) into a `router.replace()`-driven `?q=` URL param, which a Server Component page reads and narrows entirely at query time via a new `position(lower($q) in lower(name)) > 0` `WHERE` clause — a pure substring test with no wildcard/escape vocabulary, so `%`, `_`, and `\` in the filter text can never be misinterpreted (FR-013, SC-005), and no `ILIKE`-style manual pattern-escaping is ever needed. Two small, directly-testable query functions (`getVisibleLists`, `hasAnyLists`) back the page, extending the same query-time-filter precedent `[listId]/page.tsx` already established for its watched-status filter (and the pattern `specs/notes.md` flags as a recurring drift risk when done in-memory instead). See [research.md](./research.md) for the eight decisions this rests on, several verified directly against this project's installed `next`/`drizzle-orm` source per `AGENTS.md`.

## Technical Context

**Language/Version**: TypeScript 5, Next.js 16.2.11 (App Router), React 19.2.4

**Primary Dependencies**: Drizzle ORM 0.45 + `@neondatabase/serverless` (Postgres), `next-auth` v5-beta (session via `verifySession()` in `app/lib/dal`), `lucide-react` (icons, per CLAUDE.md — not needed for this feature's plain-text-input UI, but governs any icon touched incidentally), Tailwind CSS v4. No new dependency is added.

**Storage**: PostgreSQL (Neon serverless) — **no schema change**. Filtering reuses the existing `lists.name` column via a new `WHERE position(lower($q) in lower(name)) > 0` clause; no migration, no new index (see [[research]] §8 for why `position()` needs no index at this app's 2-user scale — SC-001 only requires "feels immediate" narrowing over ~10+ lists, not large-N performance).

**Testing**: Vitest 4, two existing projects — `unit` (`tests/unit/**`, no DB) and `integration` (`tests/integration/**`, real `TEST_DATABASE_URL`, `fileParallelism: false`). This feature's correctness-critical property (FR-013/SC-005's literal-substring guarantee) is covered by a new integration test calling `getVisibleLists`/`hasAnyLists` directly against a real Postgres instance, per [[research]] §4's rationale for extracting them into a testable module rather than inlining the query in `page.tsx`.

**Target Platform**: Web — same Next.js app, no new deployment target

**Project Type**: Single Next.js web application (no separate frontend/backend split)

**Performance Goals**: SC-001's "feels immediate" narrowing is satisfied structurally — the query is a single indexless `WHERE` scan over a small (2-user-workspace-scale) `lists` table, and the 400ms debounce ([[research]] §2) bounds how often it re-runs while typing, matching the app's one existing debounced-search precedent (`useTmdbSearch`). No new performance target is introduced beyond "as fast as the existing unfiltered overview query," since the filtered and unfiltered queries are the same shape with one added `WHERE` clause.

**Constraints**: FR-005/FR-014 (URL updates must `replace()`, never `push()`, for every keystroke-driven change — verified against `next/navigation`'s actual `useRouter` docs, [[research]] §2), FR-013/SC-005 (literal-substring matching, no wildcard/escape interpretation of any character), FR-006 (server-side, query-time filtering only — no client-side `.filter()` over an unfiltered fetch), FR-009/FR-010 (full keyboard operability, no horizontal scroll at 360px), CLAUDE.md's icon/`aria-label` and Lighthouse accessibility ≥90 conventions (though this feature adds a plain text input, not an icon-only button, so the icon rule doesn't directly apply).

**Scale/Scope**: Existing 2-user shared workspace; the overview page today has no pagination and this feature doesn't add any — filtering narrows the same small, fully-fetched-per-query candidate set that already exists.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled template (`[PROJECT_NAME] Constitution` with bracketed placeholders throughout, no ratified principles, no version) — same state as every prior feature in this project (001, 002, 003). There are no concrete gates to evaluate against. No complexity needs justifying against a constitution that doesn't exist yet. Re-checked post-design (Phase 1): still true, no change — nothing in this design (a new query module, a new client component, one modified page) introduces a new project, service, or repository-pattern-style indirection that would need justifying even under a typical constitution.

## Project Structure

### Documentation (this feature)

```text
specs/004-lists-filter/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── lists-filter-url-param.md
│   └── lists-filter-query.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
app/(lists)/
├── page.tsx              # MODIFIED — ListsOverviewPage becomes searchParams-aware
│                          #   (searchParams: Promise<{ q?: string }>, per Next.js 16's async-props
│                          #   contract, verified against node_modules/next/dist/docs/.../page.md);
│                          #   awaits searchParams, calls getVisibleLists(q) + conditionally
│                          #   hasAnyLists(); wraps CreateListForm + ListsFilterInput in the new
│                          #   2-column grid (research.md §6); adds the FR-007 empty-filter-result
│                          #   branch alongside the existing zero-lists branch (data-model.md's
│                          #   page-level state table)
├── queries.ts             # NEW — getVisibleLists(filterValue), hasAnyLists() (contracts/lists-filter-query.md)
├── ListsFilterInput.tsx   # NEW — client component: local debounced input state, router.replace()
│                          #   writes to `?q=` (contracts/lists-filter-url-param.md, research.md §2/§3).
│                          #   Receives `initialQuery: string` as a prop from the server page — does
│                          #   NOT call useSearchParams(), so no Suspense boundary is needed
│                          #   (research.md §3). Rendered SECOND in page.tsx's DOM order (after
│                          #   CreateListForm), carrying `order-first sm:order-none` so it appears
│                          #   visually above the form below `sm:` while DOM/Tab order (form, then
│                          #   filter) governs desktop's visual order too (research.md §6)
└── CreateListForm.tsx     # MODIFIED (minimal) — drops its own `mt-6` top margin, since spacing
                            #   between the two grid columns/rows is now owned by the parent grid's
                            #   `gap`; no change to its form logic, fields, or Server Action wiring

tests/integration/
└── lists-filter.test.ts   # NEW — exercises getVisibleLists/hasAnyLists directly against
                            #   TEST_DATABASE_URL: case-insensitivity, accent-sensitivity, literal
                            #   %/_/\ matching (SC-005), whitespace-only input, ordering unchanged,
                            #   and the hasAnyLists gating behavior (data-model.md's page-level
                            #   state table)
```

**Structure Decision**: Single Next.js App Router application (matches 001/002/003 — no frontend/backend split, no new project, no new top-level directory). All new code is additive within the existing `app/(lists)/` route group, following that directory's established `actions.ts`-alongside-`page.tsx` shape (this feature adds the equivalent `queries.ts` for reads). The one new client component follows the naming and colocation convention already set by `CreateListForm.tsx`/`ListRow.tsx` in the same directory.

## Complexity Tracking

*No entries — the Constitution Check above found no ratified constitution to violate, and this feature introduces no new project, service, or repository-pattern-style indirection. The two deliberate, non-default choices this design makes — (a) extracting `getVisibleLists`/`hasAnyLists` into a new `queries.ts` rather than inlining the query in `page.tsx` as `[listId]/page.tsx` does today, and (b) accepting a visual/DOM tab-order mismatch on mobile (not desktop) from the CSS `order`-based responsive reorder — are both justified in research.md (§4 and §6 respectively) against their concrete alternatives, not listed here since neither is a constitutional violation.*
