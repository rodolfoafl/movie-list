"use client";

import { useState } from "react";

import { MovieResultCard } from "@/app/components/MovieResultCard";
import { useTmdbSearch } from "@/app/components/useTmdbSearch";

export function GlobalMovieSearch() {
  const [query, setQuery] = useState("");
  const { status, results, retry, reset } = useTmdbSearch(query);

  return (
    <section aria-labelledby="global-search-heading">
      <label htmlFor="global-movie-search" className="sr-only">
        Buscar filmes por título
      </label>
      <input
        id="global-movie-search"
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
          {results.map((result) => (
            <MovieResultCard
              key={result.tmdbId}
              result={result}
              renderAction={() => (
                <button
                  type="button"
                  aria-label={`Adicionar "${result.title}" à lista`}
                  title={`Adicionar "${result.title}" à lista`}
                  className="flex-shrink-0 rounded border border-black/15 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-black/5 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/5"
                >
                  Adicionar à lista
                </button>
              )}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
