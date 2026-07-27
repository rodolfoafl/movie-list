"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";

import { MovieResultCard } from "@/app/components/MovieResultCard";
import { useTmdbSearch, type TmdbSearchResult } from "@/app/components/useTmdbSearch";
import { addMovieToList } from "./actions";

type AddStatus = "pending" | "added" | "duplicate";

export function MovieSearch({
  listId,
  existingTmdbIds,
}: {
  listId: string;
  existingTmdbIds: number[];
}) {
  const [query, setQuery] = useState("");
  const { status, results, retry, reset } = useTmdbSearch(query);
  const [addStatuses, setAddStatuses] = useState<Record<number, AddStatus>>({});
  const [, startTransition] = useTransition();
  const alreadyInList = new Set(existingTmdbIds);

  function handleAdd(result: TmdbSearchResult) {
    setAddStatuses((prev) => ({ ...prev, [result.tmdbId]: "pending" }));
    startTransition(async () => {
      const outcome = await addMovieToList(listId, {
        tmdbId: result.tmdbId,
        title: result.title,
        posterPath: result.posterPath,
        releaseYear: result.releaseYear,
      });

      setAddStatuses((prev) => ({
        ...prev,
        [result.tmdbId]: outcome?.error ? "duplicate" : "added",
      }));
    });
  }

  return (
    <section aria-labelledby="search-heading" className="mt-8">
      <h2 id="search-heading" className="text-lg font-medium text-black dark:text-zinc-50">
        Buscar filmes
      </h2>

      <label htmlFor="movie-search" className="sr-only">
        Buscar filmes por título
      </label>
      <input
        id="movie-search"
        type="search"
        value={query}
        onChange={(event) => {
          const value = event.target.value;
          setQuery(value);
          if (!value.trim()) {
            reset();
          }
        }}
        placeholder="Buscar por título..."
        className="mt-2 w-full rounded border border-black/15 px-3 py-2 text-black dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-50"
      />

      {status === "error" && (
        <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <p>Não foi possível buscar filmes agora. Tente novamente.</p>
          <button
            type="button"
            onClick={retry}
            className="mt-2 rounded border border-amber-400 px-3 py-1 text-sm hover:bg-amber-100 dark:hover:bg-amber-900"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {status === "success" && results.length === 0 && (
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          Nenhum filme encontrado para essa busca.
        </p>
      )}

      {results.length > 0 && (
        <ul className="mt-4 space-y-2">
          {results.map((result) => {
            const addStatus = addStatuses[result.tmdbId];
            const isInList = alreadyInList.has(result.tmdbId) || addStatus === "added" || addStatus === "duplicate";
            const isPending = addStatus === "pending";

            return (
              <MovieResultCard
                key={result.tmdbId}
                result={result}
                renderAction={() =>
                  isInList ? (
                    <span className="flex-shrink-0 text-sm text-zinc-500 dark:text-zinc-400">
                      Já está nesta lista
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleAdd(result)}
                      aria-label={`Adicionar "${result.title}" à lista`}
                      title={`Adicionar "${result.title}" à lista`}
                      className="flex-shrink-0 rounded border border-black/15 p-1.5 text-zinc-700 transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5"
                    >
                      <Plus size={16} aria-hidden="true" />
                    </button>
                  )
                }
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}
