"use client";

import { useActionState } from "react";

import { toggleWatchedAction } from "./actions";

export function WatchedToggle({
  entryId,
  watched,
}: {
  entryId: string;
  watched: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    toggleWatchedAction.bind(null, entryId),
    undefined
  );

  return (
    <div className="flex flex-shrink-0 flex-col items-end gap-1">
      <form action={formAction}>
        <button
          type="submit"
          disabled={isPending}
          className="rounded border border-black/15 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5"
        >
          {watched ? "Marcar como não assistido" : "Marcar como assistido"}
        </button>
      </form>
      {state?.error === "already_removed" && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Este filme já foi removido da lista.
        </p>
      )}
    </div>
  );
}
