"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { createList, type CreateListState } from "@/app/(lists)/actions";
import type { MovieSnapshot } from "@/app/(lists)/[listId]/actions";
import {
  confirmAddToLists,
  getListsForMovie,
  type ListSelection,
} from "./actions";

type Outcome = { listId: string; status: "success" | "failure"; reason?: string };

type ModalState =
  | { status: "loading" }
  | { status: "ready"; lists: ListSelection[] }
  | { status: "error" }
  | { status: "submitting"; lists: ListSelection[] }
  | { status: "done"; lists: ListSelection[]; outcomes: Outcome[] };

export function AddToListModal({
  movie,
  onClose,
}: {
  movie: MovieSnapshot;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const createListFormRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<ModalState>({ status: "loading" });
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [createListState, createListFormAction, creatingList] = useActionState(
    async (_state: CreateListState, formData: FormData) => {
      const result = await createList(_state, formData);
      if (result?.id) {
        createListFormRef.current?.reset();
        setState((prev) =>
          prev.status === "ready"
            ? {
                status: "ready",
                lists: [
                  ...prev.lists,
                  { id: result.id, name: result.name, alreadyInList: false },
                ],
              }
            : prev
        );
      }
      return result;
    },
    undefined
  );

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    let cancelled = false;

    getListsForMovie(movie.tmdbId)
      .then((lists) => {
        if (!cancelled) setState({ status: "ready", lists });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, [movie.tmdbId]);

  function retryFetch() {
    setState({ status: "loading" });
    getListsForMovie(movie.tmdbId)
      .then((lists) => setState({ status: "ready", lists }))
      .catch(() => setState({ status: "error" }));
  }

  function toggle(listId: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(listId)) {
        next.delete(listId);
      } else {
        next.add(listId);
      }
      return next;
    });
  }

  async function handleConfirm() {
    if (state.status !== "ready") return;
    const listsSnapshot = state.lists;
    setState({ status: "submitting", lists: listsSnapshot });
    const outcomes = await confirmAddToLists(Array.from(checkedIds), movie);
    setState({ status: "done", lists: listsSnapshot, outcomes });
  }

  const listsToShow =
    state.status === "loading" || state.status === "error" ? [] : state.lists;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="add-to-list-heading"
      className="m-auto w-[90vw] max-w-md min-h-[200px] rounded-lg border border-black/10 bg-white p-6 text-black backdrop:bg-black/50 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-50"
    >
      <h2 id="add-to-list-heading" className="text-lg font-semibold">
        Adicionar à lista
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{movie.title}</p>

      {state.status === "loading" && (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          Carregando listas...
        </p>
      )}

      {state.status === "error" && (
        <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <p>Não foi possível carregar as listas agora.</p>
          <button
            type="button"
            onClick={retryFetch}
            className="mt-2 rounded border border-amber-400 px-3 py-1 text-sm hover:bg-amber-100 dark:hover:bg-amber-900"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {listsToShow.length > 0 && (
        <ul className="mt-4 space-y-2">
          {listsToShow.map((list) => (
            <li key={list.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`add-to-list-${list.id}`}
                checked={list.alreadyInList || checkedIds.has(list.id)}
                disabled={list.alreadyInList || state.status !== "ready"}
                onChange={() => toggle(list.id)}
                className="h-4 w-4"
              />
              <label htmlFor={`add-to-list-${list.id}`} className="text-sm">
                {list.name}
                {list.alreadyInList && (
                  <span className="ml-1 text-zinc-500 dark:text-zinc-400">
                    (já está nesta lista)
                  </span>
                )}
              </label>
            </li>
          ))}
        </ul>
      )}

      {state.status === "ready" && state.lists.length === 0 && (
        <div className="mt-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Você ainda não tem nenhuma lista. Crie uma para adicionar este filme.
          </p>
          <form
            ref={createListFormRef}
            action={createListFormAction}
            className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start"
          >
            <div className="flex-1">
              <label htmlFor="add-to-list-new-list-name" className="sr-only">
                Nome da lista
              </label>
              <input
                id="add-to-list-new-list-name"
                name="name"
                type="text"
                required
                maxLength={60}
                placeholder="Nome da nova lista"
                className="w-full rounded border border-black/15 px-3 py-2 text-black dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-50"
              />
              {createListState?.error && (
                <p role="alert" className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {createListState.error}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={creatingList}
              className="rounded bg-black px-4 py-2 text-sm text-white transition-colors hover:bg-[#383838] disabled:opacity-50 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
            >
              {creatingList ? "Criando..." : "Criar lista"}
            </button>
          </form>
        </div>
      )}

      {state.status === "done" && (
        <ul className="mt-4 space-y-1 text-sm">
          {state.outcomes.map((outcome) => {
            const list = state.lists.find((candidate) => candidate.id === outcome.listId);
            return (
              <li
                key={outcome.listId}
                className={
                  outcome.status === "success"
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-red-700 dark:text-red-400"
                }
              >
                {list?.name ?? outcome.listId}:{" "}
                {outcome.status === "success" ? "adicionado com sucesso." : outcome.reason}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="rounded border border-black/15 px-3 py-1.5 text-sm dark:border-white/15"
        >
          Fechar
        </button>
        {state.status === "ready" && state.lists.length > 0 && (
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black"
          >
            Confirmar
          </button>
        )}
        {state.status === "submitting" && (
          <button
            type="button"
            disabled
            className="rounded bg-black px-3 py-1.5 text-sm text-white opacity-50 dark:bg-white dark:text-black"
          >
            Adicionando...
          </button>
        )}
      </div>
    </dialog>
  );
}
