# Contract: Overview Filter URL Param

**Surface**: `?q=` on the lists overview route (`/`) | **Kind**: Public, shareable/bookmarkable URL contract, driven by `app/(lists)/ListsFilterInput.tsx` (client) and read by `app/(lists)/page.tsx` (server)

This is the one genuinely public interface this feature introduces — the URL itself, since FR-005 requires it to be shareable and reload-safe.

## Shape

| Param | Presence | Meaning |
|---|---|---|
| `q` | Absent, or present with any string value (including empty) | The current filter text. Absent and `q=` (empty) are treated identically to "no filter" — both fall through to the unfiltered, all-lists view. |

No other params are read or written by this feature. Existing/future unrelated params on this route (there are none today) are out of scope — this feature's `router.replace()` call only ever targets `/` or `` `/?q=<value>` ``, so it does not need to preserve or merge other params.

## Write behavior (client → URL)

| Trigger | Action | History effect |
|---|---|---|
| Keystroke in the filter input | Local input state updates immediately (no debounce on what's displayed) | none — no URL write yet |
| 400ms of no further keystrokes (debounce settles, [[research]] §2) | `router.replace(value ? \`/?q=${encodeURIComponent(trimmedValue)}\` : "/")` | **Replaces** the current history entry. Never `router.push()`. Applies on every settled change, with no exception. |
| Component mounts with a non-empty `initialQuery` already in the URL (e.g. a shared/bookmarked link) | No write — the value already matches the URL it came from | none |

`trimmedValue` is the input's current value with leading/trailing whitespace stripped; if trimming yields an empty string, the URL reverts to `/` (no `q` param) — matches the Edge Case "whitespace-only filter treated as empty."

## Read behavior (URL → server render)

`ListsOverviewPage` reads `(await searchParams).q` on every render (server-side, request-time — this route is dynamically rendered as a result, per [[research]] §3). The raw value (untrimmed, in case of a hand-edited or malformed URL) is passed to `getVisibleLists`, which trims it itself ([[data-model]]) — the server never trusts the client to have already trimmed.

## Guarantees

- **Reload/share reproducibility (FR-005, SC-003)**: loading any URL of the form `/?q=<value>` produces byte-for-byte the same filtered view as a user typing `<value>` interactively — both paths converge on the same `getVisibleLists` call with the same trimmed input.
- **No intermediate history entries (FR-005, FR-014)**: because every write is a `replace()`, pressing Back from a filtered overview page always lands on whatever page the user was on *before* they navigated to the overview page — never on an earlier, less-filtered value of `q`. This holds regardless of how many keystrokes/settles occurred, since none of them ever call `push()`.
- **Normal navigation unaffected**: navigating to `/` via a header link or `<Link>` (not through the filter input) is ordinary Next.js navigation and pushes a history entry as usual — this contract only governs the filter input's own keystroke-driven writes ([[spec]] Assumptions).

## Non-goals

- No debounce-cancel-on-unmount edge case to handle beyond the standard `useEffect` cleanup (`clearTimeout`) already used by `useTmdbSearch` — if the user navigates away mid-debounce, the pending timeout is cleared and no stale `replace()` fires after unmount.
- Does not attempt to distinguish "user cleared the box" from "user never typed anything" in the URL — both produce `/` with no `q` param, which is correct since they're behaviorally identical (FR-008).
