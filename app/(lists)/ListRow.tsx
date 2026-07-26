"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";

import { renameList } from "./actions";

export function ListRow({ id, name }: { id: string; name: string }) {
  const [isEditing, setIsEditing] = useState(false);
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

  if (isEditing) {
    return (
      <li className="rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
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
            className="flex-1 rounded border border-black/15 px-3 py-1.5 text-black dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-black px-3 py-1.5 text-sm text-white transition-colors hover:bg-[#383838] disabled:opacity-50 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
          >
            {pending ? "Salvando..." : "Salvar"}
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="rounded border border-black/15 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-black/5 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5"
          >
            Cancelar
          </button>
        </form>
        {state?.error && (
          <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-950">
      <Link
        href={`/${id}`}
        className="flex-1 text-black transition-colors hover:underline dark:text-zinc-50"
      >
        {name}
      </Link>
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        aria-label={`Renomear ${name}`}
        className="flex-shrink-0 rounded border border-black/15 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-black/5 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5"
      >
        Renomear
      </button>
    </li>
  );
}
