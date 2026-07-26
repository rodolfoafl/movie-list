"use client";

import { useActionState, useRef } from "react";

import { createList } from "./actions";

export function CreateListForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    async (_state: Awaited<ReturnType<typeof createList>>, formData: FormData) => {
      const result = await createList(_state, formData);
      if (!result?.error) {
        formRef.current?.reset();
      }
      return result;
    },
    undefined
  );

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-start"
    >
      <div className="flex-1">
        <label htmlFor="name" className="sr-only">
          Nome da lista
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={60}
          placeholder="Nome da nova lista"
          className="w-full rounded border border-black/15 px-3 py-2 text-black dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-50"
        />
        {state?.error && (
          <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-4 py-2 text-white transition-colors hover:bg-[#383838] disabled:opacity-50 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
      >
        {pending ? "Criando..." : "Criar lista"}
      </button>
    </form>
  );
}
