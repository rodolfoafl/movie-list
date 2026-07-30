"use client";

import { Eye, EyeOff, Trash2 } from "lucide-react";
import { useActionState, useTransition } from "react";

import { removeMovieFromList, toggleWatchedAction } from "./actions";

export function WatchedToggle({
  entryId,
  title,
  watched,
}: {
  entryId: string;
  title: string;
  watched: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    toggleWatchedAction.bind(null, entryId),
    undefined
  );
  const [isRemoving, startRemoveTransition] = useTransition();

  function handleRemove() {
    if (!window.confirm(`Remover "${title}" desta lista?`)) {
      return;
    }
    startRemoveTransition(async () => {
      await removeMovieFromList(entryId);
    });
  }

  return (
    <div className="flex flex-shrink-0 flex-col items-end gap-1">
      <div className="flex flex-row gap-2">
        <form action={formAction}>
          <button
            type="submit"
            disabled={isPending}
            aria-label={watched ? "Marcar como não assistido" : "Marcar como assistido"}
            title={watched ? "Marcar como não assistido" : "Marcar como assistido"}
            className="rounded border border-ink-border/15 p-1.5 text-ink-soft transition-colors hover:bg-ink/5 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            {watched ? (
              <EyeOff size={16} aria-hidden="true" />
            ) : (
              <Eye size={16} aria-hidden="true" />
            )}
          </button>
        </form>
        <button
          type="button"
          onClick={handleRemove}
          disabled={isRemoving}
          aria-label={`Remover "${title}" da lista`}
          title={`Remover "${title}" da lista`}
          className="rounded border border-danger/40 p-1.5 text-danger transition-colors hover:bg-danger/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
      {state?.error === "already_removed" && (
        <p className="text-xs text-warning-text">
          Este filme já foi removido da lista.
        </p>
      )}
    </div>
  );
}
