# Decision: Whole-Card IMDb Link with Separated Action Buttons

**Scope**: Polish/refactor item, no schema/behavior-data change — decision
doc only, no spec.md/plan.md/tasks.md. Mirrors `specs/aquamarine-theme/
decision.md` and `specs/confirm-dialog-component/decision.md`'s precedent.

## Context (audited 2026-08-02, current structure — supersedes the
original issue's assumptions, written before 003-imdb-links/ConfirmDialog
landed)

Both call sites are a single flex row today:

| File | Current row shape |
|---|---|
| `app/components/MovieResultCard.tsx` | poster → title/overview block → `<ImdbLink imdbId={imdbId} />` → `renderAction(result)` (add-to-list button, caller-supplied) |
| `app/(lists)/[listId]/page.tsx:139-187` (inlined, not its own component) | poster → title/year/watched-date block → `<ImdbLink imdbId={entry.imdbId} />` → `<WatchedToggle .../>` (which itself renders the watched-toggle button + the `ConfirmDialog`-guarded remove button as an internal pair) |

`ImdbLink.tsx` today: renders `null` if no `imdbId`, otherwise a plain
`<a>` with visible text "IMDb" — no icon.

## Decisions

1. **Two sibling regions, not a stretched-link overlay.** Each row becomes
   exactly two children: a **left region** (poster + title + detail text,
   wrapped in one `<a>`) and a **right region** (the existing action
   button(s), untouched internally), separated by a 1px divider using the
   existing `--color-ink-border` token (confirmed present,
   `globals.css:51`). This is *not* a `position: absolute; inset: 0`
   overlay making the whole `<li>` clickable through the button area —
   the two regions are visually and structurally distinct siblings, which
   is what avoids the click-ambiguity problem the plain-text-link design
   was originally created to sidestep.

2. **The right region is whatever already renders there today, unchanged
   internally**: `renderAction(result)` on search results;
   `<WatchedToggle ... />` (its internal toggle+remove button pair,
   including the `ConfirmDialog` it already owns) on list entries. Do not
   restructure either of those — only their *position* changes, from
   "after `ImdbLink`" to "the sole content of the right region."

3. **`ImdbLink`'s role changes from rendering its own text link to
   supplying the new region's href logic.** Extract its
   `imdbId → href` decision (specific movie page when resolved, IMDb
   homepage as a graceful fallback when `null`/`undefined` — this
   "always clickable, destination varies" behavior was already decided
   when this issue was filed) into the new left-region component itself,
   rather than keeping `ImdbLink` as a separate rendered element in the
   row. The distinct `aria-label` per case (specific movie vs. generic
   IMDb) carries over unchanged.

4. **New shared component**: `app/components/MovieClickableInfo.tsx`,
   used by both call sites (mirrors the `MovieResultCard`/`useTmdbSearch`
   extraction precedent from `002-global-search` — share what's
   identical, parameterize what differs):

   ```ts
   type MovieClickableInfoProps = {
     posterPath: string | null;
     title: string;
     releaseYear?: number | null; // rendered below the title, same position/style on both surfaces (text-sm text-ink-muted, matching the prior per-caller styling)
     imdbId?: string | null;
     detail?: React.ReactNode; // ONLY the surface-specific secondary content: overview text (search) or the watched-date paragraph (list entry) — releaseYear is no longer part of this slot
   };
   ```

5. **Link affordance**: a `lucide-react` `ExternalLink` icon (confirmed
   unused elsewhere in `app/`, no naming conflict) appears on `:hover`
   **and** `:focus-visible` (Tailwind `group`/`group-focus-within`
   pattern) — never hover-only. The `<a>`'s `aria-label`/`title` carry the
   descriptive text at all times, independent of the icon's visibility.

6. **Padding hazard (verify explicitly — same class of bug just found in
   `ConfirmDialog`)**: padding for the left region MUST live on the `<a>`
   element itself, not on a wrapping `<div>` around it — otherwise
   whitespace inside the region visually looks clickable but isn't,
   producing a dead zone. Verify via `elementFromPoint` at multiple
   points inside the region's bounding box (not just its center), the
   same method that caught `ConfirmDialog`'s backdrop-click hazard.

## Scope

- New: `app/components/MovieClickableInfo.tsx`.
- Modified: `MovieResultCard.tsx` (replace inline poster/title/overview +
  `<ImdbLink>` with `<MovieClickableInfo releaseYear={result.releaseYear}
  detail={overview} .../>`, keep `renderAction(result)` as the sibling
  right region).
- Modified: `app/(lists)/[listId]/page.tsx` (same replacement,
  `releaseYear={entry.releaseYear}`; `detail` slot receives only the
  watched-date paragraph; `<WatchedToggle>` becomes the sibling right
  region, internally unchanged).
- Deleted or reduced to a pure href-helper: `app/components/ImdbLink.tsx`
  (its rendering responsibility moves into `MovieClickableInfo`; if any
  other call site still needs a standalone text link, keep a minimal
  version — confirm none exists before deleting outright).

## Non-goals

- No change to `WatchedToggle`'s or the add-to-list button's internal
  behavior, including the `ConfirmDialog` integration just shipped.
- No change to which movies/entries get a specific-movie vs. homepage
  link — that resolution logic is unchanged, only where it's rendered.
- No visual redesign of the right region's buttons themselves.

## Verification checklist

- Both call sites: clicking the left region (anywhere within its full
  bounding box, including whitespace) navigates to the correct IMDb URL
  in a new tab; the right region's buttons remain independently clickable
  and unaffected.
- Icon appears on hover and on `:focus-visible`, not hover-only.
- Padding-hazard check via `elementFromPoint` at multiple interior points
  (§6).
- Keyboard-only: Tab reaches the left-region link and the right-region
  button(s) in a logical order; no nested interactive elements (confirm
  via accessibility tree, not just visual inspection).
- 360px width: both regions remain usable, divider visible, no
  horizontal scroll.
- No regression to existing `MovieResultCard`/list-entry integration
  tests (this is a presentation-only change).
