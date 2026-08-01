"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { MovieResultCard } from "@/app/components/MovieResultCard";
import { useImdbIds } from "@/app/components/useImdbIds";
import { useTmdbSearch, type TmdbSearchResult } from "@/app/components/useTmdbSearch";
import { AddToListModal } from "./AddToListModal";

export function GlobalMovieSearch() {
  const [query, setQuery] = useState("");
  const { status, results, retry, reset } = useTmdbSearch(query);
  const imdbIds = useImdbIds(results);
  const [selectedResult, setSelectedResult] = useState<TmdbSearchResult | null>(null);

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
        className="mt-2 w-full rounded border border-ink-border/15 px-3 py-2 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
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
          {results.map((result) => (
            <MovieResultCard
              key={result.tmdbId}
              result={result}
              imdbId={imdbIds[result.tmdbId]}
              renderAction={() => (
                <button
                  type="button"
                  aria-label={`Adicionar "${result.title}" à lista`}
                  title={`Adicionar "${result.title}" à lista`}
                  onClick={() => setSelectedResult(result)}
                  className="flex-shrink-0 rounded border border-ink-border/15 p-1.5 text-ink-soft transition-colors hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                >
                  <Plus size={16} aria-hidden="true" />
                </button>
              )}
            />
          ))}
        </ul>
      )}

      {selectedResult && (
        <AddToListModal
          key={selectedResult.tmdbId}
          movie={{
            tmdbId: selectedResult.tmdbId,
            title: selectedResult.title,
            posterPath: selectedResult.posterPath,
            releaseYear: selectedResult.releaseYear,
          }}
          onClose={() => setSelectedResult(null)}
        />
      )}
    </section>
  );
}
