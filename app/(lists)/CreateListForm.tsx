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
      className="flex flex-col gap-2 sm:flex-row sm:items-start"
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
          className="w-full rounded border border-ink-border/15 px-3 py-2 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        />
        {state?.error && (
          <p role="alert" className="mt-1 text-sm text-danger">
            {state.error}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-primary px-4 py-2 text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
      >
        {pending ? "Criando..." : "Criar lista"}
      </button>
    </form>
  );
}
