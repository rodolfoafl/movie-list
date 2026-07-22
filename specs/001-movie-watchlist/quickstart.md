# Quickstart: Shared Movie Watchlist

Validates the feature end-to-end against the acceptance scenarios in [spec.md](./spec.md). See [data-model.md](./data-model.md) and [contracts/](./contracts/) for the underlying design.

## Prerequisites

- Node.js 20.9+ (Next.js 16 minimum — research.md §1)
- A Postgres database reachable via connection string — either:
  - a free [Neon](https://neon.tech) project (recommended, matches production), or
  - local Postgres (e.g. `docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16`)
- A [TMDB API key](https://www.themoviedb.org/settings/api) (free)

## Setup

1. Copy environment template and fill in values:

   ```bash
   cp .env.example .env.local
   ```

   | Variable | Example | Purpose |
   |---|---|---|
   | `DATABASE_URL` | `postgres://...neon.tech/movielist` | Drizzle + Neon driver |
   | `AUTH_SECRET` | output of `openssl rand -base64 32` | Auth.js session encryption |
   | `TMDB_API_KEY` | from TMDB account settings | server-side only, read in `app/api/tmdb/search/route.ts` |

2. Install dependencies and run migrations:

   ```bash
   npm install
   npx drizzle-kit push
   ```

3. Seed the two known users (see [data-model.md](./data-model.md) — `User` entity):

   ```bash
   npm run seed:users -- --email you@example.com --password <pw> --email partner@example.com --password <pw>
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

## Validation scenarios

Each maps to an Acceptance Scenario in spec.md.

### 1. Sign in and see shared lists (User Story 1)

- Visit `/` while signed out → redirected to `/login` (contracts/auth.md, `proxy.ts`).
- Submit a seeded email/password → redirected to the lists overview.
- Submit a wrong password → inline error, stays on `/login`.
- Sign in as the *other* seeded user in a different browser → same lists visible.

### 2. Create a list and add movies (User Story 2)

- From the lists overview, create list "Date night" → appears immediately.
- Try creating "date night " (different case/whitespace) → rejected inline, no new list (FR-005).
- Open "Date night", search "Matrix" → results show poster, title, year, overview (contracts/tmdb-search.md).
- Add "The Matrix" → appears in the list immediately.
- Search "Matrix" again and try adding the same result → indicated as already in the list, no duplicate row (contracts/server-actions.md, `addMovieToList`).
- Add the same movie to a second list, e.g. "Halloween marathon" → succeeds (FR-017).
- Search a nonsense title → friendly empty state, not an error (FR-012).

### 3. Track watched movies (User Story 3)

- Mark "The Matrix" watched in "Date night" → status updates, today's date shown (FR-020).
- Mark it unwatched → date no longer shown.
- Filter the list by "To watch" / "Watched" / "All" → only matching entries shown (FR-021).

### 4. Manage and clean up lists (User Story 4)

- Rename "Date night" to "Movie night" → new name shown everywhere.
- Remove one movie from a list (confirm) → gone from that list only; same movie in the other list unaffected (FR-008/FR-017).
- Delete "Halloween marathon" (confirm) → list and its entries gone; "Movie night" and its entries untouched.
- Cancel a delete confirmation → nothing removed.

## Automated tests

Business-rule tests (research.md §8) run against a real test Postgres instance, not mocks:

```bash
npm run test
```

Covers at minimum: duplicate list name rejection (including the concurrent-create race via the DB unique index), duplicate movie-in-list rejection, watched/unwatched date recording (including re-mark producing a new date), and cascade delete scoping (deleting a list never removes another list's entries).

## Non-functional spot checks

- Run Lighthouse (mobile) against the lists overview and a list page — target ≥ 90 performance and ≥ 90 accessibility (spec Non-functional Requirements).
- Resize the browser to 360px width and confirm no horizontal scroll and all actions remain reachable (SC-004).
- Tab through every primary action (sign in, create/rename/delete list, search, add/remove movie, toggle watched, filter) using only the keyboard (SC-005).
