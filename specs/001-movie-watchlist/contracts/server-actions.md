# Contract: Mutation Server Actions

All mutations are Server Actions (research.md §6), colocated by feature area. Every action below starts by calling the DAL's `verifySession()`; if it fails, the action returns/redirects exactly as an expired-session edge case requires (spec Edge Cases: "next action redirects them to login"). None of these are public HTTP endpoints — they are called only from this app's own forms/UI, invoked via `<form action={...}>` or `startTransition` + `useActionState`.

Shared error-state shape returned to `useActionState` on validation failure:

```ts
type ActionState = { error?: string } | undefined
```

## `app/(lists)/actions.ts`

### `createList(state, formData)`

- **Input**: `formData.get('name')` (string)
- **Validates**: trim non-empty (FR-004), ≤ 60 chars (FR-026), not a case/whitespace-insensitive duplicate of an existing list (FR-005)
- **On success**: inserts row, returns nothing (form redirects / revalidates lists overview)
- **On failure**: returns `{ error: 'Este nome já está em uso.' }` or the empty/length-specific message — inline, no navigation
- **Race handling**: if the DB unique index rejects the insert (two simultaneous creates of the same name), the caught constraint-violation error is mapped to the same duplicate-name message (research.md §7, CHK004)

### `renameList(listId, state, formData)`

- Same validation as `createList`, except the list's own current name (any case/whitespace variant) is excluded from the duplicate check (FR-005 exception)

### `deleteList(listId)`

- Requires prior confirmation in the UI (FR-007) — the action itself performs the delete unconditionally once called
- Runs `DELETE FROM lists WHERE id = $1` in a transaction; `ON DELETE CASCADE` removes only that list's `movie_entries` (FR-008)
- No-op-safe if the list was already deleted concurrently (returns success either way)

## `app/(lists)/[listId]/actions.ts`

### `addMovieToList(listId, movie: { tmdbId, title, posterPath, releaseYear })`

- **Validates**: `(listId, tmdbId)` not already present (FR-016)
- **On duplicate**: returns `{ error: 'already_in_list' }` — client renders "já está nesta lista" instead of adding a row (never throws a raw DB error to the UI)
- **On success**: inserts the snapshot row; the same `tmdbId` may already exist in other lists — that's expected and unaffected (FR-017)

### `removeMovieFromList(entryId)`

- Requires prior confirmation in the UI (FR-018)
- No-op-safe: if the entry no longer exists (removed concurrently), returns success without error (research.md §7, CHK018)

### `toggleWatched(entryId)`

- Flips `watched_at`: `NULL → now()` or `<date> → NULL` (FR-019, FR-020) — always a fresh `now()` when re-marking watched, never restores a prior date
- No-op-safe: if the entry no longer exists, returns a gentle "already removed" state rather than erroring (CHK018)

## Non-goals

- No optimistic-locking / version column — last-write-wins at whole-record granularity is the accepted conflict model (spec Assumptions).
- No bulk operations (bulk-add, bulk-remove) — out of scope for MVP.
