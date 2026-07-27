# Contract: `getListsForMovie` Server Action

**Location**: `app/search/actions.ts`
**Kind**: Next.js Server Action (`"use server"`), called directly as an async function from `AddToListModal.tsx` — not exposed as a Route Handler (see [[research]] §2 for why).

## Signature

```ts
export async function getListsForMovie(
  tmdbId: number
): Promise<{ id: string; name: string; alreadyInList: boolean }[]>
```

## Behavior

1. Calls `verifySession()` first, same as every other action in this codebase (`addMovieToList`, `createList`) — redirects unauthenticated callers.
2. Reads every row from `lists`, ordered by `name` (matches `app/(lists)/page.tsx:14-17`'s existing ordering).
3. Reads every `movie_entries.listId` where `tmdbId` matches the argument.
4. Returns one entry per list, `alreadyInList` set from step 3's set membership.
5. Empty `lists` table → returns `[]` (drives the modal's FR-013 empty-state / inline create-list prompt — this action does not special-case it; the caller does).

## Contract guarantees

- **Read-only**: never inserts/updates/deletes. Safe to call speculatively; no side effects to reason about on retry.
- **Snapshot semantics**: the caller (the modal) invokes this exactly once per modal-open and must not call it again while that instance stays open (FR-019) — enforced by the caller's `useEffect` dependency array, not by this action itself.
- **No pagination**: returns the full list set in one call — acceptable at this app's 2-user / small-list-count scale (no SC target requires otherwise).

## Error behavior

- Unauthenticated → `verifySession()`'s existing redirect (same as every other action; the modal's caller never sees this as a returned error, per the codebase's existing convention).
- Any DB error while reading → propagates as a thrown error (no expected-error cases exist for a pure read); the modal's `open/error` state (see data-model.md) is what the client renders when this rejects, with a retry that simply re-invokes this same action (safe, since it's read-only).

## Non-goals

- Does **not** compute or return anything about *other* movies — one call is scoped to exactly one `tmdbId`.
- Does **not** replace or wrap `addMovieToList` / `createList` — purely additive, new read path.
