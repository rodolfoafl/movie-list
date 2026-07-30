"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useActionState, useRef, useState, useTransition } from "react";

import { deleteList, renameList } from "./actions";

export function ListRow({ id, name }: { id: string; name: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (_state: Awaited<ReturnType<typeof renameList>>, formData: FormData) => {
      const result = await renameList(id, _state, formData);
      if (!result?.error) {
        setIsEditing(false);
      }
      return result;
    },
    undefined
  );

  function handleDelete() {
    if (!window.confirm(`Excluir a lista "${name}"? Todos os filmes desta lista serão removidos.`)) {
      return;
    }
    startDeleteTransition(async () => {
      await deleteList(id);
    });
  }

  if (isEditing) {
    return (
      <li className="rounded-lg border border-ink-border/10 bg-surface p-4">
        <form
          ref={formRef}
          action={formAction}
          className="flex items-center gap-2"
        >
          <label htmlFor={`rename-${id}`} className="sr-only">
            Novo nome da lista
          </label>
          <input
            id={`rename-${id}`}
            name="name"
            type="text"
            required
            maxLength={60}
            defaultValue={name}
            autoFocus
            className="flex-1 rounded border border-ink-border/15 px-3 py-1.5 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-primary px-3 py-1.5 text-sm text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            {pending ? "Salvando..." : "Salvar"}
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="rounded border border-ink-border/15 px-3 py-1.5 text-sm text-ink-soft transition-colors hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            Cancelar
          </button>
        </form>
        {state?.error && (
          <p role="alert" className="mt-1 text-sm text-danger">
            {state.error}
          </p>
        )}
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 rounded-lg border border-ink-border/10 bg-surface p-4">
      <Link
        href={`/${id}`}
        className="flex-1 rounded-sm text-ink transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        {name}
      </Link>
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        aria-label={`Renomear ${name}`}
        className="flex-shrink-0 rounded border border-ink-border/15 px-3 py-1.5 text-sm text-ink-soft transition-colors hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        Renomear
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        aria-label={`Excluir lista "${name}"`}
        title={`Excluir lista "${name}"`}
        className="flex-shrink-0 rounded border border-danger/40 p-1.5 text-danger transition-colors hover:bg-danger/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </li>
  );
}
