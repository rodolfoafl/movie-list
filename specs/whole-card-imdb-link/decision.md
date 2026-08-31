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
   supplying the new region's interactivity decision.** Extract its
   `imdbId` handling into the new left-region component itself, rather
   than keeping `ImdbLink` as a separate rendered element in the row.
   The left region is **conditionally interactive**:

   | `imdbId` | Left region renders as |
   |---|---|
   | a resolved `tt…` string | `<a href="https://www.imdb.com/title/{imdbId}/">` with `target="_blank"`, `rel="noopener"`, the `aria-label`/`title` `"Abrir página do filme no IMDb"`, hover/focus `ExternalLink` icon (§5) |
   | `null` / `undefined` | a plain `<div>` — **no** `href`, no `target`/`rel`, no `aria-label`, no `title`, no hover/focus icon, not focusable |

   The inner content (poster, title, `releaseYear`, `detail`) is
   **identical** in both branches — only the wrapper element and its
   interactive affordances differ. No `aria-label` in the null case is
   deliberate, not an oversight: the region isn't interactive, so there
   is no control to name, and labelling a non-interactive `<div>` would
   announce an affordance that doesn't exist.

   **Reverses the original "always clickable, destination varies"
   decision**, which had the null case fall back to the IMDb homepage.
   That fallback was decided when the issue was filed, on the assumption
   that a missing `imdbId` was a rare gap where *some* IMDb destination
   still beat none.

   Production evidence (2026-08-31 smoke test, finding `F1` —
   `docs/production-smoke-test.md`) refuted both halves of that
   assumption:

   - **Not rare.** The null case hit **2 of 7** results on a single
     query (`Spirited Away`) on the global-search surface, and
     reproduced independently on the in-list search surface. That is a
     real, non-trivial frequency, not an edge case.
   - **Not a graceful degradation.** The affected rows are near-empty
     TMDB *stub* entries — no overview, no release date, zero votes, and
     **no external ids of any kind**, not merely a missing IMDb id. The
     concrete instance found in production was
     `龙猫&萤火虫之墓诞生物语` (tmdb_id `1684305`). For a stub like
     this there is no IMDb page to degrade *toward*; the homepage link
     sends the user somewhere unrelated to the title they clicked. A
     whole-card link that dead-ends on imdb.com's front page actively
     misleads — it reads as a broken feature, and the softened
     `"Abrir IMDb"` label does not rescue it.

   Rendering these rows as inert is the honest signal: the card still
   shows everything TMDB gave us, and it simply doesn't claim to lead
   anywhere.

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
- No change to how an `imdbId` is *resolved* (`useImdbIds`, the
  `/api/tmdb/external-ids` route, the `addMovieToList` tri-state
  handling) — §3 changes only what the left region renders once
  resolution has produced an id or a `null`.
- No visual redesign of the right region's buttons themselves.

## Verification checklist

- Both call sites: for an entry **with** an `imdbId`, clicking the left
  region (anywhere within its full bounding box, including whitespace)
  navigates to the correct IMDb URL in a new tab; the right region's
  buttons remain independently clickable and unaffected.
- For an entry **without** an `imdbId`: the left region contains no
  anchor element at all, is not reachable by Tab, and shows no
  hover/focus icon — while still rendering the same poster, title and
  detail content as the linked case.
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
