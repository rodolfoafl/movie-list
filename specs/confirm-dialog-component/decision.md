# Decision: Reusable ConfirmDialog Component

**Scope**: Polish/refactor item, not a Spec Kit feature — no spec.md/plan.md/
tasks.md. This document is the single source of truth for the design; the
implementation prompt references it directly. Mirrors `specs/aquamarine-theme/
decision.md`'s precedent for lightweight-cycle work with real accessibility
stakes.

## Context

Two destructive actions currently use the browser's native `window.confirm()`:

| Call site | Action | Current message |
|---|---|---|
| `app/(lists)/ListRow.tsx:25` | Delete an entire list | `Excluir a lista "${name}"? Todos os filmes desta lista serão removidos.` |
| `app/(lists)/[listId]/WatchedToggle.tsx:24` | Remove one movie from a list | `Remover "${title}" desta lista?` |

(Audited exhaustively 2026-08-02 — these are the only two call sites in `app/`.)

`window.confirm()` works and is fully accessible by default (native focus
trap, Escape-to-cancel, keyboard-operable), but looks visually inconsistent
with the rest of the app — especially since `002-global-search` introduced a
styled native `<dialog>` pattern (`AddToListModal.tsx`) the app didn't have
before. This replaces both call sites with one shared, themed component
built on the same native-`<dialog>` foundation already verified in that
feature.

## Decisions

1. **Foundation**: native `<dialog>` via `showModal()`/`close()`, same
   pattern as `AddToListModal.tsx` — inherits its already-verified focus
   trapping and inertness guarantees (`specs/notes.md`, 2026-07-27 entry)
   rather than re-deriving them for a hand-rolled overlay.

2. **Dismissal**: both Escape **and** clicking the backdrop cancel the
   action (confirmed with the product owner, 2026-08-02) — equivalent to
   clicking "Cancelar". Native `<dialog>` provides Escape-to-close for
   free; backdrop-click requires an explicit handler (checking
   `event.target === dialogRef.current`, the standard pattern for this,
   since a click anywhere inside the dialog's content — including
   whitespace around the buttons — must NOT be mistaken for a backdrop
   click).

3. **Focus return**: no specific requirement beyond "somewhere reasonable"
   (confirmed with the product owner, 2026-08-02) — native `<dialog>`'s
   default behavior (returning focus to whatever had it before
   `showModal()` was called, typically the triggering button) already
   satisfies this without any extra code.

4. **API shape** (`app/components/ConfirmDialog.tsx`, new):

   ```ts
   type ConfirmDialogProps = {
     open: boolean;
     title: string;
     message: string;
     confirmLabel?: string;  // default: "Confirmar"
     cancelLabel?: string;   // default: "Cancelar"
     onConfirm: () => void;
     onCancel: () => void;
   };
   ```

   Same `open`-as-prop shape `AddToListModal` was ORIGINALLY specified with
   (before that feature's implementation switched to full mount/unmount per
   research — see `specs/notes.md`, 2026-07-27 "artifact hierarchy" entry).
   For `ConfirmDialog`, mount/unmount-per-render (parent conditionally
   renders `{showDialog && <ConfirmDialog ... />}`) is used directly from
   the start, matching the pattern `AddToListModal` converged on anyway —
   no need to repeat that discovery process here.

5. **Styling**: reuses the same theme tokens as `AddToListModal`
   (`--color-surface`, `--color-ink`, `--color-ink-border`,
   `--color-danger` for the confirm button on destructive actions) — no
   new tokens introduced.

6. **Call-site copy unchanged**: both existing confirmation messages
   (table above) are reused verbatim as the `message` prop — this is a
   presentation/mechanism change, not a copy revision.

## Scope

- New: `app/components/ConfirmDialog.tsx`.
- Modified: `ListRow.tsx` (delete-list confirm), `WatchedToggle.tsx`
  (remove-movie confirm) — replace their `window.confirm()` calls with
  `ConfirmDialog`, preserving exact existing message text and the exact
  existing action taken on confirm (no change to `deleteList`/
  `removeMovieFromList` themselves).

## Non-goals

- No new confirm-guarded actions beyond the two audited call sites.
- No change to the underlying delete/remove Server Actions' logic,
  validation, or no-op-safety — purely a presentation/interaction change
  on top of already-correct behavior.
- No visual redesign of `ListRow`/`WatchedToggle` beyond what's needed to
  trigger the new dialog (button icons/positions unchanged).

## Verification checklist

- Both call sites: dialog opens with correct title/message, Confirmar
  performs the original action, Cancelar/Escape/backdrop-click all
  perform no action.
- Keyboard-only: Tab reaches the dialog's buttons in a logical order,
  Escape cancels, focus lands somewhere sensible after close.
- 360px width: dialog remains fully visible and usable, matching
  `AddToListModal`'s already-verified pattern.
- No regression to `deleteList`/`removeMovieFromList`'s own tests (this
  change touches only the UI trigger, not the Server Actions).
