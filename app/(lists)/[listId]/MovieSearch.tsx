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
      <h2 id="search-heading" className="text-lg font-medium text-ink">
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
        className="mt-2 w-full rounded border border-ink-border/15 px-3 py-2 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
      />

      {status === "error" && (
        <div className="mt-4 rounded border border-warning-border bg-warning-bg p-3 text-sm text-warning-text">
          <p>Não foi possível buscar filmes agora. Tente novamente.</p>
          <button
            type="button"
            onClick={retry}
            className="mt-2 rounded border border-warning-border px-3 py-1 text-sm hover:bg-warning-border/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-warning-bg"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {status === "success" && results.length === 0 && (
        <p className="mt-4 text-ink-muted">
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
                    <span className="flex-shrink-0 text-sm text-ink-muted">
                      Já está nesta lista
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleAdd(result)}
                      aria-label={`Adicionar "${result.title}" à lista`}
                      title={`Adicionar "${result.title}" à lista`}
                      className="flex-shrink-0 rounded border border-ink-border/15 p-1.5 text-ink-soft transition-colors hover:bg-ink/5 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
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
