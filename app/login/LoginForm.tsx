"use client";

import { useActionState } from "react";

import { signInAction } from "./actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    signInAction,
    undefined
  );

  return (
    <div className="flex flex-1 items-center justify-center bg-paper p-6">
      <form
        action={formAction}
        className="w-full max-w-sm space-y-4 rounded-lg border border-ink-border/10 bg-surface p-8"
      >
        <h1 className="text-2xl font-semibold text-ink">
          Entrar
        </h1>

        <div className="space-y-1">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-ink-soft"
          >
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded border border-ink-border/15 px-3 py-2 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-ink-soft"
          >
            Senha
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full rounded border border-ink-border/15 px-3 py-2 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          />
        </div>

        {state?.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-primary px-4 py-2 text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          {pending ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
