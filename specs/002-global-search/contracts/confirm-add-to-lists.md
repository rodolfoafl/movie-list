# Contract: `confirmAddToLists` Server Action

**Location**: `app/search/actions.ts`
**Kind**: Next.js Server Action (`"use server"`), the modal's confirm handler's single entry point for the whole batch — replaces a two-call pattern (an upfront session-check action plus a client-side `Promise.allSettled` over N calls to [[contracts/add-movie-to-list-with-outcome|addMovieToListWithOutcome]]) with one action that does both, server-side.

## Signature

```ts
export async function confirmAddToLists(
  listIds: string[],
  movie: MovieSnapshot // reused unchanged from app/(lists)/[listId]/actions.ts
): Promise<{ listId: string; status: "success" | "failure"; reason?: string }[]>
```

## Behavior (in order)

1. `verifySession()` — exactly once per call, regardless of `listIds.length`. This is the primary session check for a confirmation; a session that has already expired by the time the user clicks confirm redirects here, once, before any per-list work starts.
2. `Promise.allSettled(listIds.map((listId) => addMovieToListWithOutcome(listId, movie)))`, unchanged from the orchestration `addMovieToListWithOutcome`'s own contract previously described (see [[research]] §1 for why per-list classification must happen server-side, inside `addMovieToListWithOutcome`, and why this stays `Promise.allSettled` rather than a plain loop — an unexpected exception in one branch must not prevent the others from resolving).
3. Zip each settled result back with its `listId` before returning: `{ listId, status, reason }`. `addMovieToListWithOutcome` itself has no idea which list it was called for beyond its own `listId` parameter, so this zip step — not a change to `addMovieToListWithOutcome`'s return shape — is what lets the caller pair outcomes with list names.
   - `settled[i].status === "fulfilled"` (expected always, per `addMovieToListWithOutcome`'s contract) → `{ listId: listIds[i], ...settled[i].value }`.
   - `settled[i].status === "rejected"` (defensive only — not expected in normal operation) → `{ listId: listIds[i], status: "failure", reason: "Não foi possível adicionar, tente novamente." }`.

`listName` is deliberately **not** part of the return value — the modal already holds every list's name in its own snapshot (from `getListsForMovie`), keyed by `id`, so re-sending it here would be redundant data the modal would have to trust rather than reuse.

## Caller contract (the modal's confirm handler)

```ts
const outcomes = await confirmAddToLists(checkedEnabledListIds, movie);
// Pair each outcome with its list's name via outcomes[i].listId → snapshot lookup,
// to render the FR-012 / FR-023 per-list report.
```

- Only lists that are checked **and enabled** (i.e., not already-containing per the snapshot) are included in `checkedEnabledListIds`. Already-checked-disabled lists are never passed here — they are "not attempted," per spec.md's Assumptions (three possible per-list outcomes: success / failure / not-attempted).
- Zero newly-checked lists → `checkedEnabledListIds` is `[]` → `confirmAddToLists` still runs (step 1's `verifySession()` still executes — a confirm click always checks session, even if it turns out to be a no-op for list mutations), `Promise.allSettled([])` resolves immediately to `[]`, the function returns `[]`, and the modal renders no report — confirm is a silent no-op (Edge Case in spec.md, "MUST NOT be reported as a failure").

## Non-goals

- Does not duplicate `addMovieToListWithOutcome`'s per-list logic (existence check, `addMovieToList` call, error classification) — it calls that action unchanged and only adds the `listId` zip on top.
- Is not a batch-mutation mechanism in the sense the steering message ruled out — the actual list-mutation SQL still happens one list at a time, inside the unmodified `addMovieToList`; this action only consolidates the *session check and fan-out*, not the mutation itself.
