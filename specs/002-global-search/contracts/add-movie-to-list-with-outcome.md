# Contract: `addMovieToListWithOutcome` Server Action

**Location**: `app/search/actions.ts`
**Kind**: Next.js Server Action (`"use server"`), single-list, unmodified from its original shape. Primarily invoked server-side, once per checked-and-enabled list, by [[contracts/confirm-add-to-lists|confirmAddToLists]]'s internal `Promise.allSettled` — see [[research]] §1 for why this one-list-at-a-time shape (rather than a batch action) is required. It remains an independently exported Server Action (not inlined into `confirmAddToLists`), so it stays directly unit-testable and directly callable like any other Server Action in this codebase, even though the modal itself no longer calls it directly.

## Signature

```ts
export async function addMovieToListWithOutcome(
  listId: string,
  movie: MovieSnapshot // reused unchanged from app/(lists)/[listId]/actions.ts
): Promise<{ status: "success" | "failure"; reason?: string }>
```

This function never throws under expected conditions — every branch below returns a value, so `Promise.allSettled` around N calls is defensive (guards against a truly unexpected exception in one call) rather than load-bearing for the expected error paths.

## Behavior (in order)

1. `verifySession()` (same convention as every other action). This is **not** redundant with `confirmAddToLists`'s own upfront `verifySession()` call (see [[contracts/confirm-add-to-lists]]) — `addMovieToListWithOutcome` is still an exported Server Action and therefore a directly-callable public endpoint on its own, independent of whatever orchestration calls it, so it cannot skip its own auth check. In the normal flow (invoked by `confirmAddToLists`, milliseconds after that action's own check) this passes silently and cheaply.
2. `select id from lists where id = :listId` (existence check — mirrors the select-then-act idiom already used inside `addMovieToList` and `createList`).
   - No row found → return `{ status: "failure", reason: "Lista não existe mais." }` (FR-021). **Does not call `addMovieToList`.**
3. List exists → call the existing `addMovieToList(listId, movie)` from `app/(lists)/[listId]/actions.ts:20`, **unmodified**, wrapped in try/catch:
   - Returns `undefined` (inserted) → `{ status: "success" }`.
   - Returns `{ error: "already_in_list" }` → `{ status: "success" }` (FR-022 — desired end state already holds, regardless of whether the pre-existing row came from this feature's own concurrent add or the in-list search).
   - Throws (any other DB error) → caught here, `{ status: "failure", reason: "Não foi possível adicionar, tente novamente." }` (FR-023).

## Caller contract

The only caller is [[contracts/confirm-add-to-lists|`confirmAddToLists`]], which invokes this once per checked-and-enabled `listId` inside its own server-side `Promise.allSettled`:

```ts
const settled = await Promise.allSettled(
  listIds.map((listId) => addMovieToListWithOutcome(listId, movie))
);
```

The modal itself no longer imports or calls `addMovieToListWithOutcome` directly — it calls `confirmAddToLists` once. See that contract for the full caller-facing shape (including how `listId` is attached to each outcome for the modal to pair with list names).

## Non-goals

- Does not modify `addMovieToList` itself — that action's signature, return type, and existing tests (`tests/integration/movie-entries.test.ts`) are unaffected.
- Is not a batch/array-typed action — always exactly one list per call, matching the steering instruction.
- Does not orchestrate the batch or attach `listId` to its own return value — that's `confirmAddToLists`'s job, not this action's.
