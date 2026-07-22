# Data Model: Shared Movie Watchlist

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

Three tables, all shared (no per-user partitioning), matching the spec's Key Entities. Defined with Drizzle ORM (`drizzle-orm/pg-core`); DDL shown here is the logical shape, not literal Drizzle schema syntax.

> **Revised after auth version verification (2026-07-21)**: an earlier draft of this file included a fourth table, `Session` (Auth.js's database-session table), and assumed `@auth/drizzle-adapter` for it. Sessions are JWT-based, not database-based, and the adapter turned out to be unused even for user lookup (research.md §4) — both have been removed. Three tables remain: `users`, `lists`, `movie_entries`.

## Entity: User

Exactly two rows, seeded out-of-band (no in-app registration — see spec Assumptions).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` | |
| `email` | text | UNIQUE, NOT NULL | login identifier |
| `password_hash` | text | NOT NULL | bcrypt hash, never returned to client (DTO excludes it) |
| `created_at` | timestamptz | NOT NULL, default `now()` | |

No role/permission column — spec: "No profile, role, or permission differences between the two."

## Entity: List

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` | |
| `name` | text | NOT NULL | stored **trimmed**, original casing preserved for display |
| `created_at` | timestamptz | NOT NULL, default `now()` | |
| `updated_at` | timestamptz | NOT NULL, default `now()`, updated on rename | |

**Indexes / constraints**:
- `UNIQUE INDEX ON lists (lower(trim(name)))` — enforces FR-005's case/whitespace-insensitive uniqueness at the database level, including under concurrent creates (closes CHK004). Application code also pre-checks for a friendlier inline message; the DB constraint is the source of truth for the race case.

**Validation rules** (enforced in the Server Action before hitting the DB, then backstopped by the DB constraint):
- `trim(name)` must be non-empty (FR-004).
- `trim(name)` length ≤ 60 (FR-026).
- `lower(trim(name))` must not collide with another list's `lower(trim(name))`, EXCEPT the list's own current row on rename (FR-005 exception — a list never conflicts with itself).

**Lifecycle**: create → rename (any number of times) → delete. Delete cascades to all of that list's `movie_entries` only (FR-008), implemented via `ON DELETE CASCADE` on `movie_entries.list_id`, run inside a transaction (research.md §7, CHK017).

## Entity: MovieEntry

The association between a `List` and a specific TMDB movie, plus a display snapshot and watched state (spec Key Entities: "Movie Entry").

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` | |
| `list_id` | uuid | FK → `lists.id`, NOT NULL, ON DELETE CASCADE | |
| `tmdb_id` | integer | NOT NULL | external movie identifier, assumed stable (spec Assumptions) |
| `title` | text | NOT NULL | snapshot at add-time, never refreshed |
| `poster_path` | text | NULLABLE | snapshot; `NULL` renders as a placeholder image client-side |
| `release_year` | integer | NULLABLE | snapshot; TMDB sometimes lacks a release date |
| `watched_at` | timestamptz | NULLABLE | `NULL` = unwatched; set to `now()` on marking watched, cleared to `NULL` on unmarking (FR-020) |
| `created_at` | timestamptz | NOT NULL, default `now()` | used as a stable tiebreaker; primary sort is alphabetical by title (FR-022) |

**Indexes / constraints**:
- `UNIQUE INDEX ON movie_entries (list_id, tmdb_id)` — enforces FR-016 (no duplicate movie within the same list) at the database level; the same `tmdb_id` is free to appear in other lists (FR-017), since the constraint is scoped to `list_id`.

**Validation rules**:
- Reject add if `(list_id, tmdb_id)` already exists → surfaced to the user as "already in this list" (FR-016), not a raw constraint-violation error.
- `watched_at` is the sole source of watched/unwatched state and of the displayed watched date — no separate boolean flag, so the two can't drift out of sync.
- No "who watched it" column — explicitly deferred per spec Assumptions (FR-029 not adopted).

**State transitions** (watched status):

```
unwatched (watched_at = NULL)
  --mark watched--> watched (watched_at = now())
watched (watched_at = <date>)
  --mark unwatched--> unwatched (watched_at = NULL; previous date discarded)
  --mark watched again--> watched (watched_at = now(), a NEW date, per FR-020)
```

If the toggle action targets an entry that no longer exists (removed concurrently by the other user), it is a no-op returning a "already removed" state rather than an error (research.md §7, CHK018).

## Relationships

```
List (1) ──has many──> MovieEntry (N), ON DELETE CASCADE
```

There is no `List`-to-`User` ownership relationship and no `MovieEntry`-to-`User` relationship — both entities are fully shared, per FR-003 and the spec's Assumptions ("no concept of list ownership"). `User` has no outgoing relationship to anything else in the schema: sessions are JWT-based (encoded into the client's cookie, not a DB row — research.md §4), so `User` isn't referenced by a foreign key anywhere.

## Derived / read-time behavior (no extra columns needed)

- **Filter by watched status** (FR-021): `WHERE watched_at IS NOT NULL` / `IS NULL` / no filter — computed at query time, not stored.
- **Default alphabetical sort** (FR-022): `ORDER BY lower(title)` at query time.
- **Distinct empty states** (FR-009 vs FR-028): both are pure UI states derived from "list has 0 movie_entries" vs "last search returned 0 results" — no schema implication, noted here only to confirm no entity is needed to distinguish them.
